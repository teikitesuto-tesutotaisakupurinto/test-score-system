-- Restrict student access to layout boxes to tests with their own published answer.
-- This corrects the earlier policy that checked only whether the test existed.
-- Existing rows and unrelated policies are preserved.
BEGIN;

DROP POLICY IF EXISTS student_published_test_layout
ON public.layout_boxes;

CREATE POLICY student_published_test_layout
ON public.layout_boxes
FOR SELECT
TO authenticated
USING (
    public.my_role()::text = 'student'
    AND public.student_has_published_answer(test_id)
);

COMMIT;
