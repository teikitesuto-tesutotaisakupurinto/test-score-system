-- Production-safe additive schema extension for layout hierarchy and score grouping.
-- This migration does not drop tables, rows, or existing policies.
begin;

alter table public.layout_boxes
  add column if not exists box_role text,
  add column if not exists parent_box_id uuid,
  add column if not exists major_no integer,
  add column if not exists minor_no integer,
  add column if not exists sort_order integer not null default 0,
  add column if not exists subtotal_group integer;

update public.layout_boxes
set box_role = case
  when lower(coalesce(box_type,'')) = 'qr' then 'qr'
  when lower(coalesce(box_type,'')) = 'name' then 'name'
  when lower(coalesce(box_type,'')) = 'student_no' then 'student_no'
  when lower(coalesce(box_type,'')) = 'other' then 'other'
  when coalesce(label,'') = '大問' then 'major'
  else 'answer'
end
where box_role is null or btrim(box_role) = '';

alter table public.students
  add column if not exists municipality text,
  add column if not exists school_name text;

create index if not exists layout_boxes_test_page_sort_idx
  on public.layout_boxes(test_id, page_no, sort_order);

create index if not exists students_municipality_idx
  on public.students(municipality);

create index if not exists students_school_name_idx
  on public.students(school_name);


-- Return only the authenticated student's own published standard scores.
-- Cohort aggregates are calculated inside this SECURITY DEFINER function so
-- students never receive other students' names or individual marks.
create or replace function public.get_student_test_standard_scores(p_test_id uuid)
returns table (
  total_score numeric,
  max_score numeric,
  overall_mean numeric,
  overall_sd numeric,
  overall_standard_score numeric,
  municipality_mean numeric,
  municipality_sd numeric,
  municipality_standard_score numeric,
  school_mean numeric,
  school_sd numeric,
  school_standard_score numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_student_id uuid;
begin
  if public.my_role()::text <> 'student' then
    raise exception '生徒権限が必要です。';
  end if;

  v_student_id := public.my_student_id();
  if v_student_id is null then
    raise exception '生徒アカウントが紐付いていません。';
  end if;

  if not exists (
    select 1 from public.tests t
    where t.id = p_test_id and t.results_published = true
  ) then
    raise exception '公開済みのテストではありません。';
  end if;

  return query
  with latest_answers as (
    select distinct on (a.student_id)
      a.id as answer_sheet_id,
      a.student_id
    from public.answer_sheets a
    where a.test_id = p_test_id
      and a.status = 'published'
      and a.student_id is not null
    order by a.student_id, a.created_at desc
  ),
  totals as (
    select
      la.student_id,
      sum(coalesce(s.score, 0))::numeric as total_score
    from latest_answers la
    join public.scores s
      on s.answer_sheet_id = la.answer_sheet_id
     and s.status = 'marked'
    group by la.student_id
  ),
  cohort as (
    select
      t.student_id,
      t.total_score,
      st.municipality,
      st.school_name
    from totals t
    join public.students st on st.id = t.student_id
  ),
  mine as (
    select * from cohort where student_id = v_student_id
  ),
  maximum as (
    select coalesce(sum(b.points), 0)::numeric as max_score
    from public.layout_boxes b
    where b.test_id = p_test_id
      and lower(coalesce(b.box_type, '')) = 'answer'
      and coalesce(trim(b.label), '') not in ('QR','氏名','小計','合計')
  ),
  overall_stats as (
    select avg(c.total_score)::numeric as mean_score,
           stddev_pop(c.total_score)::numeric as sd_score
    from cohort c
  ),
  municipality_stats as (
    select avg(c.total_score)::numeric as mean_score,
           stddev_pop(c.total_score)::numeric as sd_score
    from cohort c
    join mine m on c.municipality = m.municipality
    where m.municipality is not null and btrim(m.municipality) <> ''
  ),
  school_stats as (
    select avg(c.total_score)::numeric as mean_score,
           stddev_pop(c.total_score)::numeric as sd_score
    from cohort c
    join mine m on c.school_name = m.school_name
    where m.school_name is not null and btrim(m.school_name) <> ''
  )
  select
    m.total_score,
    maximum.max_score,
    overall_stats.mean_score,
    overall_stats.sd_score,
    case when coalesce(overall_stats.sd_score, 0) > 0
      then round(50 + 10 * (m.total_score - overall_stats.mean_score) / overall_stats.sd_score, 1)
      else 50::numeric end,
    municipality_stats.mean_score,
    municipality_stats.sd_score,
    case when coalesce(municipality_stats.sd_score, 0) > 0
      then round(50 + 10 * (m.total_score - municipality_stats.mean_score) / municipality_stats.sd_score, 1)
      when municipality_stats.mean_score is not null then 50::numeric
      else null end,
    school_stats.mean_score,
    school_stats.sd_score,
    case when coalesce(school_stats.sd_score, 0) > 0
      then round(50 + 10 * (m.total_score - school_stats.mean_score) / school_stats.sd_score, 1)
      when school_stats.mean_score is not null then 50::numeric
      else null end
  from mine m
  cross join maximum
  cross join overall_stats
  left join municipality_stats on true
  left join school_stats on true;
end;
$function$;

revoke all on function public.get_student_test_standard_scores(uuid) from public, anon;
grant execute on function public.get_student_test_standard_scores(uuid) to authenticated;

commit;
