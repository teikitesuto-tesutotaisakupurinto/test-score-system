-- =========================================================
-- Test Score System: student isolation + teacher-only data operations
-- Review the policy inventory before applying. This script changes policies only;
-- it does not delete or rewrite any application data.
-- Run in Supabase SQL Editor as project owner.
-- =========================================================

begin;

-- Remove permissive legacy policies that allowed admin to perform teacher work,
-- and remove student SELECT policies that did not consistently require publication.
drop policy if exists regions_teacher_all on public.answer_regions;
drop policy if exists teacher_all_answer_regions on public.answer_regions;
drop policy if exists answer_regions_student_read on public.answer_regions;
drop policy if exists student_own_answer_regions_select on public.answer_regions;

drop policy if exists answer_sheet_pages_teacher_all on public.answer_sheet_pages;
drop policy if exists teacher_all_answer_sheet_pages on public.answer_sheet_pages;
drop policy if exists answer_sheet_pages_student_read on public.answer_sheet_pages;
drop policy if exists student_own_answer_pages_select on public.answer_sheet_pages;

drop policy if exists answers_teacher_all on public.answer_sheets;
drop policy if exists teacher_all_answer_sheets on public.answer_sheets;
drop policy if exists answer_sheets_student_read on public.answer_sheets;
drop policy if exists student_own_answer_sheets_select on public.answer_sheets;

drop policy if exists classes_teacher_all on public.classes;
drop policy if exists teacher_all_classes on public.classes;
drop policy if exists "teachers can delete classes" on public.classes;
drop policy if exists "teachers can insert classes" on public.classes;
drop policy if exists "teachers can read classes" on public.classes;
drop policy if exists "teachers can update classes" on public.classes;
drop policy if exists classes_student_read on public.classes;

drop policy if exists comments_teacher_all on public.comment_templates;
drop policy if exists item_statistics_teacher_all on public.item_statistics;

drop policy if exists layout_teacher_all on public.layout_boxes;
drop policy if exists teacher_all_layout_boxes on public.layout_boxes;
drop policy if exists student_published_layout_boxes_select on public.layout_boxes;

drop policy if exists mark_objects_teacher_all on public.mark_objects;
drop policy if exists marks_teacher_all on public.mark_objects;
drop policy if exists teacher_all_mark_objects on public.mark_objects;
drop policy if exists marks_student_read on public.mark_objects;
drop policy if exists student_own_mark_objects_select on public.mark_objects;

drop policy if exists teacher_all_model_answer_pages on public.model_answer_pages;
drop policy if exists teacher_model_answer_pages_all on public.model_answer_pages;

drop policy if exists qr_batches_teacher_all on public.qr_sticker_batches;
drop policy if exists teacher_all_qr_batches on public.qr_sticker_batches;
drop policy if exists qr_stickers_teacher_all on public.qr_stickers;
drop policy if exists teacher_all_qr_stickers on public.qr_stickers;

drop policy if exists questions_teacher_all on public.questions;

drop policy if exists scores_teacher_all on public.scores;
drop policy if exists teacher_all_scores on public.scores;
drop policy if exists scores_student_read on public.scores;
drop policy if exists student_own_scores_select on public.scores;

drop policy if exists results_teacher_all on public.student_test_results;
drop policy if exists results_student_read on public.student_test_results;

drop policy if exists students_teacher_all on public.students;
drop policy if exists student_own_profile_select on public.students;
drop policy if exists students_self_read on public.students;

drop policy if exists teacher_all_test_model_pages on public.test_model_pages;

drop policy if exists pages_teacher_all on public.test_pages;
drop policy if exists teacher_all_test_pages on public.test_pages;

drop policy if exists publication_teacher_all on public.test_publications;

drop policy if exists test_statistics_teacher_all on public.test_statistics;

drop policy if exists teacher_all_tests on public.tests;
drop policy if exists tests_teacher_all on public.tests;
drop policy if exists student_published_tests_select on public.tests;

drop policy if exists viewpoint_results_teacher_all on public.viewpoint_results;
drop policy if exists viewpoint_student_read on public.viewpoint_results;

-- One teacher-only ALL policy per data table.
do $$
declare
  t text;
  tables text[] := array[
    'answer_regions','answer_sheet_pages','answer_sheets','classes',
    'comment_templates','item_statistics','layout_boxes','mark_objects',
    'model_answer_pages','qr_sticker_batches','qr_stickers','questions',
    'scores','student_test_results','students','test_model_pages',
    'test_pages','test_publications','test_statistics','tests','viewpoint_results'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create policy teacher_only_data_access on public.%I for all to authenticated using (public.my_role() = ''teacher''::public.user_role) with check (public.my_role() = ''teacher''::public.user_role)',
      t
    );
  end loop;
end $$;

-- Students can read only their own published answer sheet.
create policy student_own_published_answer_sheets
on public.answer_sheets for select to authenticated
using (
  student_id = public.my_student_id()
  and status = 'published'
  and exists (
    select 1 from public.tests t
    where t.id = answer_sheets.test_id
      and t.results_published = true
  )
);

create policy student_own_published_answer_pages
on public.answer_sheet_pages for select to authenticated
using (
  exists (
    select 1
    from public.answer_sheets a
    join public.tests t on t.id = a.test_id
    where a.id = answer_sheet_pages.answer_sheet_id
      and a.student_id = public.my_student_id()
      and a.status = 'published'
      and t.results_published = true
  )
);

create policy student_own_published_answer_regions
on public.answer_regions for select to authenticated
using (
  exists (
    select 1
    from public.answer_sheets a
    join public.tests t on t.id = a.test_id
    where a.id = answer_regions.answer_sheet_id
      and a.student_id = public.my_student_id()
      and a.status = 'published'
      and t.results_published = true
  )
);

create policy student_own_published_scores
on public.scores for select to authenticated
using (
  status = 'marked'
  and exists (
    select 1
    from public.answer_sheets a
    join public.tests t on t.id = a.test_id
    where a.id = scores.answer_sheet_id
      and a.student_id = public.my_student_id()
      and a.status = 'published'
      and t.results_published = true
  )
);

create policy student_own_published_marks
on public.mark_objects for select to authenticated
using (
  exists (
    select 1
    from public.answer_sheets a
    join public.tests t on t.id = a.test_id
    where a.id = mark_objects.answer_sheet_id
      and a.student_id = public.my_student_id()
      and a.status = 'published'
      and t.results_published = true
  )
);

create policy student_published_test_layout
on public.layout_boxes for select to authenticated
using (
  public.my_role() = 'student'::public.user_role
  and exists (
    select 1 from public.tests t
    where t.id = layout_boxes.test_id
      and t.results_published = true
  )
);

create policy student_published_tests
on public.tests for select to authenticated
using (
  public.my_role() = 'student'::public.user_role
  and results_published = true
);

create policy student_own_student_record
on public.students for select to authenticated
using (auth_user_id = auth.uid());

create policy student_own_class
on public.classes for select to authenticated
using (
  public.my_role() = 'student'::public.user_role
  and id in (
    select s.class_id from public.students s
    where s.auth_user_id = auth.uid()
  )
);

create policy student_own_published_test_results
on public.student_test_results for select to authenticated
using (
  student_id = public.my_student_id()
  and published = true
);

create policy student_own_published_viewpoint_results
on public.viewpoint_results for select to authenticated
using (
  student_id = public.my_student_id()
  and exists (
    select 1 from public.tests t
    where t.id = viewpoint_results.test_id
      and t.results_published = true
  )
);

-- Profiles: users may read only their own profile.
-- Existing profiles_self_read policy is retained.

commit;

-- IMPORTANT: Storage policies are intentionally not modified by this script.
-- Before changing storage, run this query and inspect bucket IDs + expressions.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
