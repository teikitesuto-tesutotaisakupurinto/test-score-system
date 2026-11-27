-- =========================================================
-- Test Score System: student isolation + teacher-only data operations
-- Review the policy inventory before applying. This script changes policies only;
-- it does not delete or rewrite any application data.
-- Run in Supabase SQL Editor as project owner.
-- =========================================================

begin;

-- Preserve all existing annotations; add a non-destructive font-family attribute.
alter table public.mark_objects
  add column if not exists font_family text not null default 'sans-serif';

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
    execute format('drop policy if exists teacher_only_data_access on public.%I', t);
    execute format(
      'create policy teacher_only_data_access on public.%I for all to authenticated using (public.my_role()::text = ''teacher'') with check (public.my_role()::text = ''teacher'')',
      t
    );
  end loop;
end $$;

-- Recreate this migration's student policies safely on repeated runs.
drop policy if exists student_own_published_answer_sheets on public.answer_sheets;
drop policy if exists student_own_published_answer_pages on public.answer_sheet_pages;
drop policy if exists student_own_published_answer_regions on public.answer_regions;
drop policy if exists student_own_published_scores on public.scores;
drop policy if exists student_own_published_marks on public.mark_objects;
drop policy if exists student_published_test_layout on public.layout_boxes;
drop policy if exists student_published_tests on public.tests;
drop policy if exists student_own_student_record on public.students;
drop policy if exists student_own_class on public.classes;
drop policy if exists student_own_published_test_results on public.student_test_results;
drop policy if exists student_own_published_viewpoint_results on public.viewpoint_results;

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
  public.my_role()::text = 'student'
  and exists (
    select 1 from public.tests t
    where t.id = layout_boxes.test_id
      and t.results_published = true
  )
);

create policy student_published_tests
on public.tests for select to authenticated
using (
  public.my_role()::text = 'student'
  and results_published = true
);

create policy student_own_student_record
on public.students for select to authenticated
using (auth_user_id = auth.uid());

create policy student_own_class
on public.classes for select to authenticated
using (
  public.my_role()::text = 'student'
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

-- Storage: remove legacy broad teacher/admin and permissive published-file policies.
drop policy if exists storage_teacher_all on storage.objects;
drop policy if exists "teachers can upload/read/update/delete answer files" on storage.objects;
drop policy if exists "teachers can read/upload/update/delete test files" on storage.objects;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname ilike '%student%published%'
        or coalesce(qual,'') ilike '%results_published%'
        or coalesce(with_check,'') ilike '%results_published%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

-- Recreate this migration's storage policies safely on repeated runs.
drop policy if exists teacher_only_application_storage on storage.objects;
drop policy if exists student_own_published_answer_storage on storage.objects;

-- Teachers can operate the application file buckets; administrators cannot.
create policy teacher_only_application_storage
on storage.objects for all to authenticated
using (
  bucket_id in ('answer-files','student-answers','test-files','model-answers')
  and public.my_role() = 'teacher'::public.user_role
)
with check (
  bucket_id in ('answer-files','student-answers','test-files','model-answers')
  and public.my_role() = 'teacher'::public.user_role
);

-- A student can fetch only file objects explicitly referenced by their own
-- published answer pages. The same path is checked against the database row.
create policy student_own_published_answer_storage
on storage.objects for select to authenticated
using (
  bucket_id in ('answer-files','student-answers','test-files')
  and exists (
    select 1
    from public.answer_sheet_pages p
    join public.answer_sheets a on a.id = p.answer_sheet_id
    join public.tests t on t.id = a.test_id
    where p.file_path = storage.objects.name
      and a.student_id = public.my_student_id()
      and a.status = 'published'
      and t.results_published = true
  )
);

-- Atomic publication: only a teacher can publish/unpublish after every answer box is marked.
create or replace function public.set_test_publication(
  p_test_id uuid,
  p_publish boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_exists boolean;
  v_sheet_count integer;
  v_box_count integer;
  v_missing_count integer;
begin
  if public.my_role()::text <> 'teacher' then
    raise exception '先生権限が必要です。';
  end if;

  select exists(select 1 from public.tests where id = p_test_id)
    into v_test_exists;
  if not v_test_exists then
    raise exception 'テストが見つかりません。';
  end if;

  if p_publish then
    select count(*) into v_sheet_count
    from public.answer_sheets
    where test_id = p_test_id and student_id is not null;

    if v_sheet_count = 0 then
      raise exception '答案が登録されていません。';
    end if;

    select count(*) into v_box_count
    from public.layout_boxes b
    where b.test_id = p_test_id
      and lower(coalesce(b.box_type,'')) = 'answer'
      and coalesce(trim(b.label),'') not in ('QR','氏名','小計','合計');

    if v_box_count = 0 then
      raise exception '採点対象の設問が登録されていません。';
    end if;

    select count(*) into v_missing_count
    from public.answer_sheets a
    cross join public.layout_boxes b
    where a.test_id = p_test_id
      and a.student_id is not null
      and a.status in ('matched','uploaded','marking','marked','published')
      and b.test_id = p_test_id
      and lower(coalesce(b.box_type,'')) = 'answer'
      and coalesce(trim(b.label),'') not in ('QR','氏名','小計','合計')
      and not exists (
        select 1 from public.scores s
        where s.answer_sheet_id = a.id
          and s.layout_box_id = b.id
          and s.status = 'marked'
      );

    if v_missing_count > 0 then
      raise exception '未採点の設問があります（%件）。', v_missing_count;
    end if;

    update public.answer_sheets
      set status = 'published'
      where test_id = p_test_id and student_id is not null
        and status in ('marked','published');

    update public.tests
      set results_published = true,
          results_published_at = now(),
          results_published_by = auth.uid()
      where id = p_test_id;
  else
    update public.tests
      set results_published = false,
          results_published_at = null,
          results_published_by = null
      where id = p_test_id;

    update public.answer_sheets
      set status = 'marked'
      where test_id = p_test_id and status = 'published';
  end if;
end;
$$;

revoke all on function public.set_test_publication(uuid, boolean) from public, anon;
grant execute on function public.set_test_publication(uuid, boolean) to authenticated;


-- Restrict student test and layout visibility to the student's own published answer.
create or replace function public.student_has_published_answer(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    public.my_role()::text = 'student'
    and public.my_student_id() is not null
    and exists (
      select 1
      from public.answer_sheets a
      where a.test_id = p_test_id
        and a.student_id = public.my_student_id()
        and a.status = 'published'
    );
$function$;

revoke all on function public.student_has_published_answer(uuid) from public, anon;
grant execute on function public.student_has_published_answer(uuid) to authenticated;

drop policy if exists student_published_tests on public.tests;
create policy student_published_tests
on public.tests for select to authenticated
using (
  public.my_role()::text = 'student'
  and results_published = true
  and public.student_has_published_answer(id)
);

drop policy if exists student_published_test_layout on public.layout_boxes;
create policy student_published_test_layout
on public.layout_boxes for select to authenticated
using (
  public.my_role()::text = 'student'
  and exists (
    select 1 from public.tests t
    where t.id = layout_boxes.test_id
  )
);

create or replace view public.student_published_tests
with (security_invoker = true)
as
select
  t.id, t.name, t.subject, t.grade, t.class_name, t.max_score,
  t.results_published, t.results_published_at
from public.tests t
where t.results_published = true;

commit;

-- IMPORTANT: Storage policies are intentionally not modified by this script.
-- Before changing storage, run this query and inspect bucket IDs + expressions.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
