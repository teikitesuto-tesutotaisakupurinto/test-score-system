-- Allow authenticated teachers to preview and reload registered test answer sheets.
-- Narrowly scoped to the private test-files bucket; no student access is granted.
begin;

drop policy if exists teacher_test_files_access on storage.objects;

create policy teacher_test_files_access
on storage.objects
for all
to authenticated
using (
  bucket_id = 'test-files'
  and public.my_role()::text = 'teacher'
)
with check (
  bucket_id = 'test-files'
  and public.my_role()::text = 'teacher'
);

commit;
