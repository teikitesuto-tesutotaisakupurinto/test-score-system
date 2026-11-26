-- Complete workflow correction for the existing test-score-system schema.
-- Safe to run repeatedly. Does not drop tables, rows, or existing RLS policies.
-- Requires the existing public.my_role(), public.my_student_id() and auth.uid().

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Query indexes used by upload, marking, and result screens
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_answer_sheets_test_status_student
    ON public.answer_sheets (test_id, status, student_id);

CREATE INDEX IF NOT EXISTS idx_answer_sheets_student_test_created
    ON public.answer_sheets (student_id, test_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scores_sheet_layout_status
    ON public.scores (answer_sheet_id, layout_box_id, status);

CREATE INDEX IF NOT EXISTS idx_layout_boxes_test_type_role_page
    ON public.layout_boxes (test_id, box_type, box_role, page_no);

CREATE INDEX IF NOT EXISTS idx_answer_sheet_pages_sheet_page
    ON public.answer_sheet_pages (answer_sheet_id, page_no);

CREATE INDEX IF NOT EXISTS idx_mark_objects_sheet_layout
    ON public.mark_objects (answer_sheet_id, layout_box_id);

CREATE INDEX IF NOT EXISTS idx_students_auth_user
    ON public.students (auth_user_id);


-- ---------------------------------------------------------------------
-- 2. Rebuild the views with invoker RLS and correct answer-box filtering
-- ---------------------------------------------------------------------

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


CREATE OR REPLACE VIEW public.student_published_test_results
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    a.id AS answer_sheet_id,
    a.student_id,
    s.student_no,
    s.name AS student_name,
    COALESCE(
        SUM(
            CASE
                WHEN sc.status = 'marked' THEN sc.score
                ELSE 0::numeric
            END
        ),
        0::numeric
    ) AS total_score,
    COUNT(
        DISTINCT CASE
            WHEN sc.status = 'marked' THEN sc.layout_box_id
            ELSE NULL::uuid
        END
    ) AS marked_count
FROM public.answer_sheets AS a
JOIN public.students AS s
    ON s.id = a.student_id
JOIN public.tests AS t
    ON t.id = a.test_id
LEFT JOIN (
    SELECT
        sc.answer_sheet_id,
        sc.layout_box_id,
        sc.score
    FROM public.scores AS sc
    JOIN public.layout_boxes AS lb
        ON lb.id = sc.layout_box_id
    WHERE
        sc.status = 'marked'
        AND COALESCE(lb.box_role, 'answer') = 'answer'
        AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
        AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
) AS sc
    ON sc.answer_sheet_id = a.id
WHERE
    s.auth_user_id = auth.uid()
    AND t.results_published = true
    AND a.status = 'published'
GROUP BY
    a.test_id,
    a.id,
    a.student_id,
    s.student_no,
    s.name;


CREATE OR REPLACE VIEW public.test_question_summary
WITH (security_invoker = true)
AS
SELECT
    lb.test_id,
    lb.id AS layout_box_id,
    lb.page_no,
    lb.label,
    lb.points,
    lb.x,
    lb.y,
    lb.width,
    lb.height
FROM public.layout_boxes AS lb
WHERE
    lb.box_type = 'answer'
    AND COALESCE(lb.box_role, 'answer') = 'answer'
    AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
    AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])';


CREATE OR REPLACE VIEW public.question_score_summary
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    sc.layout_box_id,
    lb.label,
    lb.page_no,
    lb.points AS max_points,
    COUNT(*) AS marked_count,
    COALESCE(SUM(sc.score), 0::numeric) AS score_sum,
    AVG(sc.score) AS score_average,
    MIN(sc.score) AS score_min,
    MAX(sc.score) AS score_max
FROM public.scores AS sc
JOIN public.answer_sheets AS a
    ON a.id = sc.answer_sheet_id
JOIN public.layout_boxes AS lb
    ON lb.id = sc.layout_box_id
WHERE
    sc.status = 'marked'
    AND a.status IN ('marked', 'published')
    AND COALESCE(lb.box_role, 'answer') = 'answer'
    AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
    AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
GROUP BY
    a.test_id,
    sc.layout_box_id,
    lb.label,
    lb.page_no,
    lb.points;


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
        SUM(
            CASE
                WHEN sc.status = 'marked' THEN sc.score
                ELSE 0::numeric
            END
        ),
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
    WHERE
        sc.status = 'marked'
        AND COALESCE(lb.box_role, 'answer') = 'answer'
        AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
        AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
) AS sc
    ON sc.answer_sheet_id = a.id
WHERE
    a.student_id IS NOT NULL
    AND a.status IN ('matched', 'marking', 'marked', 'published')
GROUP BY
    a.test_id,
    a.id,
    a.student_id,
    s.student_no,
    s.name;


-- ---------------------------------------------------------------------
-- 3. Keep view permissions read-only for signed-in application users
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE
    public.question_score_summary,
    public.student_published_test_results,
    public.student_published_tests,
    public.test_question_summary,
    public.test_score_summary
FROM anon, authenticated;

GRANT SELECT ON TABLE
    public.question_score_summary,
    public.student_published_test_results,
    public.student_published_tests,
    public.test_question_summary,
    public.test_score_summary
TO authenticated;


-- ---------------------------------------------------------------------
-- 4. Correct publication workflow
--    Valid answer_sheets.status values:
--    unmatched, matched, marking, marked, published
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_test_publication(
    p_test_id uuid,
    p_publish boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_test_status text;
    v_answer_sheet_count integer;
    v_unmatched_count integer;
    v_nonfinal_count integer;
    v_answer_box_count integer;
    v_missing_score_count integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'ログインが必要です。';
    END IF;

    IF public.my_role()::text IS DISTINCT FROM 'teacher' THEN
        RAISE EXCEPTION '先生権限が必要です。';
    END IF;

    SELECT t.status
      INTO v_test_status
      FROM public.tests AS t
     WHERE t.id = p_test_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'テストが見つかりません。';
    END IF;

    IF p_publish THEN
        SELECT COUNT(*)
          INTO v_answer_sheet_count
          FROM public.answer_sheets AS a
         WHERE a.test_id = p_test_id
           AND a.student_id IS NOT NULL;

        IF v_answer_sheet_count = 0 THEN
            RAISE EXCEPTION '生徒に紐付いた答案がありません。';
        END IF;

        SELECT COUNT(*)
          INTO v_unmatched_count
          FROM public.answer_sheets AS a
         WHERE a.test_id = p_test_id
           AND (a.student_id IS NULL OR a.status = 'unmatched');

        IF v_unmatched_count > 0 THEN
            RAISE EXCEPTION '未紐付けの答案が % 件あります。先に生徒へ紐付けてください。', v_unmatched_count;
        END IF;

        SELECT COUNT(*)
          INTO v_nonfinal_count
          FROM public.answer_sheets AS a
         WHERE a.test_id = p_test_id
           AND a.student_id IS NOT NULL
           AND a.status NOT IN ('marked', 'published');

        IF v_nonfinal_count > 0 THEN
            RAISE EXCEPTION '採点が完了していない答案が % 件あります。', v_nonfinal_count;
        END IF;

        SELECT COUNT(*)
          INTO v_answer_box_count
          FROM public.layout_boxes AS b
         WHERE b.test_id = p_test_id
           AND b.box_type = 'answer'
           AND COALESCE(b.box_role, 'answer') = 'answer'
           AND COALESCE(BTRIM(b.label), '') NOT IN ('QR', '氏名', '小計', '合計')
           AND COALESCE(BTRIM(b.label), '') !~ '^(大問|小問|問[0-9])';

        IF v_answer_box_count = 0 THEN
            RAISE EXCEPTION '採点対象の解答欄が登録されていません。';
        END IF;

        SELECT COUNT(*)
          INTO v_missing_score_count
          FROM public.answer_sheets AS a
          CROSS JOIN public.layout_boxes AS b
         WHERE a.test_id = p_test_id
           AND a.student_id IS NOT NULL
           AND a.status IN ('marked', 'published')
           AND b.test_id = p_test_id
           AND b.box_type = 'answer'
           AND COALESCE(b.box_role, 'answer') = 'answer'
           AND COALESCE(BTRIM(b.label), '') NOT IN ('QR', '氏名', '小計', '合計')
           AND COALESCE(BTRIM(b.label), '') !~ '^(大問|小問|問[0-9])'
           AND NOT EXISTS (
                SELECT 1
                  FROM public.scores AS sc
                 WHERE sc.answer_sheet_id = a.id
                   AND sc.layout_box_id = b.id
                   AND sc.status = 'marked'
           );

        IF v_missing_score_count > 0 THEN
            RAISE EXCEPTION '未採点の解答欄が % 件あります。', v_missing_score_count;
        END IF;

        UPDATE public.answer_sheets
           SET status = 'published'
         WHERE test_id = p_test_id
           AND student_id IS NOT NULL
           AND status = 'marked';

        UPDATE public.tests
           SET results_published = true,
               results_published_at = now(),
               results_published_by = auth.uid(),
               status = 'published'
         WHERE id = p_test_id;

    ELSE
        UPDATE public.tests
           SET results_published = false,
               results_published_at = NULL,
               results_published_by = NULL,
               status = CASE
                   WHEN status = 'published' THEN 'completed'
                   ELSE status
               END
         WHERE id = p_test_id;

        UPDATE public.answer_sheets
           SET status = 'marked'
         WHERE test_id = p_test_id
           AND status = 'published';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_test_publication(uuid, boolean)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_test_publication(uuid, boolean)
TO authenticated;


-- ---------------------------------------------------------------------
-- 5. Student-only standard-score RPC (overall / municipality / school)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_student_test_standard_scores(p_test_id uuid)
RETURNS TABLE (
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_student_id uuid;
BEGIN
    IF public.my_role()::text IS DISTINCT FROM 'student' THEN
        RAISE EXCEPTION '生徒権限が必要です。';
    END IF;

    v_student_id := public.my_student_id();

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION '生徒アカウントが紐付いていません。';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.tests AS t
        WHERE t.id = p_test_id
          AND t.results_published = true
    ) THEN
        RAISE EXCEPTION '公開済みのテストではありません。';
    END IF;

    RETURN QUERY
    WITH latest_answers AS (
        SELECT DISTINCT ON (a.student_id)
            a.id AS answer_sheet_id,
            a.student_id
        FROM public.answer_sheets AS a
        WHERE a.test_id = p_test_id
          AND a.status = 'published'
          AND a.student_id IS NOT NULL
        ORDER BY a.student_id, a.created_at DESC, a.id DESC
    ),
    eligible_scores AS (
        SELECT
            sc.answer_sheet_id,
            sc.score
        FROM public.scores AS sc
        JOIN public.layout_boxes AS lb
            ON lb.id = sc.layout_box_id
        WHERE sc.status = 'marked'
          AND COALESCE(lb.box_role, 'answer') = 'answer'
          AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
          AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
    ),
    totals AS (
        SELECT
            la.student_id,
            COALESCE(SUM(es.score), 0::numeric) AS total_score
        FROM latest_answers AS la
        LEFT JOIN eligible_scores AS es
            ON es.answer_sheet_id = la.answer_sheet_id
        GROUP BY la.student_id
    ),
    cohort AS (
        SELECT
            totals.student_id,
            totals.total_score,
            st.municipality,
            st.school_name
        FROM totals
        JOIN public.students AS st
            ON st.id = totals.student_id
    ),
    mine AS (
        SELECT *
        FROM cohort
        WHERE student_id = v_student_id
    ),
    maximum AS (
        SELECT COALESCE(SUM(lb.points), 0::numeric) AS max_score
        FROM public.layout_boxes AS lb
        WHERE lb.test_id = p_test_id
          AND lb.box_type = 'answer'
          AND COALESCE(lb.box_role, 'answer') = 'answer'
          AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
          AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])'
    ),
    overall_stats AS (
        SELECT
            AVG(c.total_score)::numeric AS mean_score,
            STDDEV_POP(c.total_score)::numeric AS sd_score
        FROM cohort AS c
    ),
    municipality_stats AS (
        SELECT
            AVG(c.total_score)::numeric AS mean_score,
            STDDEV_POP(c.total_score)::numeric AS sd_score
        FROM cohort AS c
        JOIN mine AS m
            ON c.municipality = m.municipality
        WHERE m.municipality IS NOT NULL
          AND BTRIM(m.municipality) <> ''
    ),
    school_stats AS (
        SELECT
            AVG(c.total_score)::numeric AS mean_score,
            STDDEV_POP(c.total_score)::numeric AS sd_score
        FROM cohort AS c
        JOIN mine AS m
            ON c.school_name = m.school_name
        WHERE m.school_name IS NOT NULL
          AND BTRIM(m.school_name) <> ''
    )
    SELECT
        m.total_score,
        maximum.max_score,
        overall_stats.mean_score,
        overall_stats.sd_score,
        CASE
            WHEN COALESCE(overall_stats.sd_score, 0) > 0
                THEN ROUND(
                    50 + 10 * (m.total_score - overall_stats.mean_score)
                    / overall_stats.sd_score,
                    1
                )
            ELSE 50::numeric
        END,
        municipality_stats.mean_score,
        municipality_stats.sd_score,
        CASE
            WHEN COALESCE(municipality_stats.sd_score, 0) > 0
                THEN ROUND(
                    50 + 10 * (m.total_score - municipality_stats.mean_score)
                    / municipality_stats.sd_score,
                    1
                )
            WHEN municipality_stats.mean_score IS NOT NULL
                THEN 50::numeric
            ELSE NULL
        END,
        school_stats.mean_score,
        school_stats.sd_score,
        CASE
            WHEN COALESCE(school_stats.sd_score, 0) > 0
                THEN ROUND(
                    50 + 10 * (m.total_score - school_stats.mean_score)
                    / school_stats.sd_score,
                    1
                )
            WHEN school_stats.mean_score IS NOT NULL
                THEN 50::numeric
            ELSE NULL
        END
    FROM mine AS m
    CROSS JOIN maximum
    CROSS JOIN overall_stats
    LEFT JOIN municipality_stats ON true
    LEFT JOIN school_stats ON true;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_student_test_standard_scores(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_student_test_standard_scores(uuid)
TO authenticated;

COMMIT;
