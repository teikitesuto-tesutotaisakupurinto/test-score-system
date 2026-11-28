-- Permit students to read only their own published answer-region crop images.
-- Existing files and database rows are preserved.
BEGIN;
DROP POLICY IF EXISTS student_own_published_answer_storage ON storage.objects;
CREATE POLICY student_own_published_answer_storage
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('answer-files', 'student-answers', 'test-files')
  AND (
    EXISTS (
      SELECT 1 FROM public.answer_sheet_pages p
      JOIN public.answer_sheets a ON a.id = p.answer_sheet_id
      JOIN public.tests t ON t.id = a.test_id
      WHERE p.file_path = storage.objects.name
        AND a.student_id = public.my_student_id()
        AND a.status = 'published'
        AND t.results_published = true
    )
    OR (
      bucket_id = 'student-answers'
      AND EXISTS (
        SELECT 1 FROM public.answer_regions r
        JOIN public.answer_sheets a ON a.id = r.answer_sheet_id
        JOIN public.tests t ON t.id = a.test_id
        WHERE r.image_path = storage.objects.name
          AND a.student_id = public.my_student_id()
          AND a.status = 'published'
          AND t.results_published = true
      )
    )
  )
);
COMMIT;
