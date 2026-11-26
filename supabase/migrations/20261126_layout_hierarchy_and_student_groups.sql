-- Production-safe additive schema extension for layout hierarchy and score grouping.
-- This migration does not drop tables, rows, or existing policies.
begin;

alter table public.layout_boxes
  add column if not exists box_role text,
  add column if not exists parent_box_id uuid,
  add column if not exists major_no integer,
  add column if not exists minor_no integer,
  add column if not exists sort_order integer not null default 0,
  add column if not exists subtotal_group text;

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

commit;
