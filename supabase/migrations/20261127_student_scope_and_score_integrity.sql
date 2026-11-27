-- Restrict student-visible tests to tests with that student's own published answer.
-- Keep teacher operations unchanged and preserve every existing row.
BEGIN;

CREATE OR REPLACE FUNCTION public.student_has_published_answer(p_test_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT
        public.my_role()::text = 'student'
        AND public.my_student_id() IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.answer_sheets AS a
            WHERE a.test_id = p_test_id
              AND a.student_id = public.my_student_id()
              AND a.status = 'published'
        );
$function$;

REVOKE ALL ON FUNCTION public.student_has_published_answer(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_has_published_answer(uuid)
TO authenticated;

-- A student may see only tests for which their own answer sheet is published.
DROP POLICY IF EXISTS student_published_tests ON public.tests;
CREATE POLICY student_published_tests
ON public.tests
FOR SELECT
TO authenticated
USING (
    public.my_role()::text = 'student'
    AND results_published = true
    AND public.student_has_published_answer(id)
);

-- The layout of a test is visible to a student only after that student's
-- answer sheet has been published for that test.
DROP POLICY IF EXISTS student_published_test_layout ON public.layout_boxes;
CREATE POLICY student_published_test_layout
ON public.layout_boxes
FOR SELECT
TO authenticated
USING (
    public.my_role()::text = 'student'
    AND EXISTS (
        SELECT 1
        FROM public.tests AS t
        WHERE t.id = layout_boxes.test_id
    )
);

-- Keep the student list view invoker-secured so the tests RLS policy applies.
CREATE OR REPLACE VIEW public.student_published_tests
WITH (security_invoker = true)
AS
SELECT
    t.id,
    t.name,
    t.subject,
    t.grade,
    t.class_name,
    t.max_score,
    t.results_published,
    t.results_published_at
FROM public.tests AS t
WHERE t.results_published = true;

-- Do not expose partial/in-progress scores in finalized test score summaries.
CREATE OR REPLACE VIEW public.test_score_summary
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    a.id AS answer_sheet_id,
    a.student_id,
    s.student_no,
    s.name AS student_name,
    COALESCE(
        SUM(CASE WHEN sc.status = 'marked' THEN sc.score ELSE 0::numeric END),
        0::numeric
    ) AS total_score,
    COUNT(
        DISTINCT CASE
            WHEN sc.status = 'marked' THEN sc.layout_box_id
            ELSE NULL::uuid
        END
    ) AS marked_count
FROM public.answer_sheets AS a
LEFT JOIN public.students AS s
    ON s.id = a.student_id
LEFT JOIN (
    SELECT
        sc.answer_sheet_id,
        sc.layout_box_id,
        sc.score
    FROM public.scores AS sc
    JOIN public.layout_boxes AS lb
        ON lb.id = sc.layout_box_id
    WHERE sc.status = 'marked'
      AND COALESCE(lb.box_role, 'answer') = 'answer'
      AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
      AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
) AS sc
    ON sc.answer_sheet_id = a.id
WHERE
    a.student_id IS NOT NULL
    AND a.status IN ('marked', 'published')
GROUP BY
    a.test_id,
    a.id,
    a.student_id,
    s.student_no,
    s.name;

REVOKE ALL PRIVILEGES ON TABLE public.student_published_tests, public.test_score_summary
FROM anon, authenticated;
GRANT SELECT ON TABLE public.student_published_tests, public.test_score_summary
TO authenticated;

COMMIT;
