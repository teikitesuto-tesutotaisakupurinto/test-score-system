-- Atomic answer marking and one canonical score source for teacher/student results.
-- This migration preserves existing records and does not change publication state.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_answer_marking(
    p_answer_sheet_id uuid,
    p_layout_box_id uuid,
    p_question_id uuid,
    p_score numeric,
    p_marks jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_test_id uuid;
    v_answer_status text;
    v_results_published boolean;
    v_box_type text;
    v_box_role text;
    v_box_label text;
    v_max_points numeric;
    v_existing_score_id uuid;
BEGIN
    IF auth.uid() IS NULL OR public.my_role()::text <> 'teacher' THEN
        RAISE EXCEPTION '先生権限が必要です。';
    END IF;

    IF p_answer_sheet_id IS NULL OR p_layout_box_id IS NULL OR p_score IS NULL THEN
        RAISE EXCEPTION '答案・解答欄・点数を指定してください。';
    END IF;

    IF jsonb_typeof(COALESCE(p_marks, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION '採点記号データが不正です。';
    END IF;

    SELECT a.test_id, a.status, t.results_published
      INTO v_test_id, v_answer_status, v_results_published
      FROM public.answer_sheets AS a
      JOIN public.tests AS t ON t.id = a.test_id
     WHERE a.id = p_answer_sheet_id
     FOR UPDATE OF a, t;

    IF NOT FOUND THEN
        RAISE EXCEPTION '答案が見つかりません。';
    END IF;

    IF v_answer_status = 'published' OR COALESCE(v_results_published, false) THEN
        RAISE EXCEPTION '公開済みの答案は採点変更できません。先に公開を解除してください。';
    END IF;

    SELECT b.box_type, b.box_role, b.label, b.points
      INTO v_box_type, v_box_role, v_box_label, v_max_points
      FROM public.layout_boxes AS b
     WHERE b.id = p_layout_box_id
       AND b.test_id = v_test_id
     FOR UPDATE;

    IF NOT FOUND
       OR v_box_type <> 'answer'
       OR (COALESCE(v_box_role, 'answer') <> 'answer')
       OR COALESCE(BTRIM(v_box_label), '') IN ('QR', '氏名', '小計', '合計')
       OR COALESCE(BTRIM(v_box_label), '') ~ '^(大問|小問|問[0-9])' THEN
        RAISE EXCEPTION '採点対象の解答欄ではありません。';
    END IF;

    IF p_score < 0 OR p_score > COALESCE(v_max_points, 0) THEN
        RAISE EXCEPTION '点数は0点以上、配点以下で入力してください（配点: %）。', COALESCE(v_max_points, 0);
    END IF;

    SELECT sc.id
      INTO v_existing_score_id
      FROM public.scores AS sc
     WHERE sc.answer_sheet_id = p_answer_sheet_id
       AND sc.layout_box_id = p_layout_box_id
     ORDER BY sc.marked_at DESC NULLS LAST, sc.created_at DESC NULLS LAST
     LIMIT 1
     FOR UPDATE;

    IF v_existing_score_id IS NULL THEN
        INSERT INTO public.scores (
            answer_sheet_id, layout_box_id, question_id,
            marked_by, score, status, marked_at
        ) VALUES (
            p_answer_sheet_id, p_layout_box_id, p_question_id,
            auth.uid(), p_score, 'marked', now()
        );
    ELSE
        UPDATE public.scores
           SET question_id = p_question_id,
               marked_by = auth.uid(),
               score = p_score,
               status = 'marked',
               marked_at = now()
         WHERE id = v_existing_score_id;
    END IF;

    DELETE FROM public.mark_objects
     WHERE answer_sheet_id = p_answer_sheet_id
       AND layout_box_id = p_layout_box_id;

    INSERT INTO public.mark_objects (
        id, answer_sheet_id, layout_box_id, question_id,
        object_type, text_value, color, font_size, font_family,
        stroke_width, x, y, width, height, points
    )
    SELECT
        COALESCE(m.id, gen_random_uuid()),
        p_answer_sheet_id,
        p_layout_box_id,
        p_question_id,
        m.object_type,
        m.text_value,
        COALESCE(m.color, '#d00000'),
        COALESCE(m.font_size, 32),
        COALESCE(m.font_family, 'sans-serif'),
        COALESCE(m.stroke_width, 3),
        COALESCE(m.x, 0),
        COALESCE(m.y, 0),
        COALESCE(m.width, 40),
        COALESCE(m.height, 40),
        m.points
    FROM jsonb_to_recordset(COALESCE(p_marks, '[]'::jsonb)) AS m(
        id uuid,
        object_type text,
        text_value text,
        color text,
        font_size numeric,
        font_family text,
        stroke_width numeric,
        x numeric,
        y numeric,
        width numeric,
        height numeric,
        points numeric
    );

    UPDATE public.answer_sheets
       SET status = 'marking'
     WHERE id = p_answer_sheet_id
       AND status <> 'published';
END;
$function$;

REVOKE ALL ON FUNCTION public.save_answer_marking(uuid, uuid, uuid, numeric, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_answer_marking(uuid, uuid, uuid, numeric, jsonb)
TO authenticated;

CREATE OR REPLACE VIEW public.canonical_answer_scores
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    a.id AS answer_sheet_id,
    a.student_id,
    sc.id AS score_id,
    sc.layout_box_id,
    sc.question_id,
    sc.score,
    sc.status,
    sc.marked_at,
    lb.label,
    lb.points
FROM public.scores AS sc
JOIN public.answer_sheets AS a
  ON a.id = sc.answer_sheet_id
JOIN public.layout_boxes AS lb
  ON lb.id = sc.layout_box_id
 AND lb.test_id = a.test_id
WHERE lb.box_type = 'answer'
  AND COALESCE(lb.box_role, 'answer') = 'answer'
  AND COALESCE(BTRIM(lb.label), '') NOT IN ('QR', '氏名', '小計', '合計')
  AND COALESCE(BTRIM(lb.label), '') !~ '^(大問|小問|問[0-9])';

REVOKE ALL PRIVILEGES ON TABLE public.canonical_answer_scores FROM anon, authenticated;
GRANT SELECT ON TABLE public.canonical_answer_scores TO authenticated;

CREATE OR REPLACE VIEW public.test_score_summary
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    a.id AS answer_sheet_id,
    a.student_id,
    s.student_no,
    s.name AS student_name,
    COALESCE(SUM(cas.score) FILTER (WHERE cas.status = 'marked'), 0::numeric) AS total_score,
    COUNT(DISTINCT cas.layout_box_id) FILTER (WHERE cas.status = 'marked') AS marked_count
FROM public.answer_sheets AS a
LEFT JOIN public.students AS s ON s.id = a.student_id
LEFT JOIN public.canonical_answer_scores AS cas ON cas.answer_sheet_id = a.id
WHERE a.student_id IS NOT NULL
  AND a.status IN ('marked', 'published')
GROUP BY a.test_id, a.id, a.student_id, s.student_no, s.name;

CREATE OR REPLACE VIEW public.student_published_test_results
WITH (security_invoker = true)
AS
SELECT
    a.test_id,
    a.id AS answer_sheet_id,
    a.student_id,
    s.student_no,
    s.name AS student_name,
    COALESCE(SUM(cas.score) FILTER (WHERE cas.status = 'marked'), 0::numeric) AS total_score,
    COUNT(DISTINCT cas.layout_box_id) FILTER (WHERE cas.status = 'marked') AS marked_count
FROM public.answer_sheets AS a
JOIN public.students AS s ON s.id = a.student_id
JOIN public.tests AS t ON t.id = a.test_id
LEFT JOIN public.canonical_answer_scores AS cas ON cas.answer_sheet_id = a.id
WHERE s.auth_user_id = auth.uid()
  AND t.results_published = true
  AND a.status = 'published'
GROUP BY a.test_id, a.id, a.student_id, s.student_no, s.name;

CREATE OR REPLACE VIEW public.question_score_summary
WITH (security_invoker = true)
AS
SELECT
    cas.test_id,
    cas.layout_box_id,
    cas.label,
    lb.page_no,
    cas.points AS max_points,
    COUNT(*) FILTER (WHERE cas.status = 'marked') AS marked_count,
    COALESCE(SUM(cas.score) FILTER (WHERE cas.status = 'marked'), 0::numeric) AS score_sum,
    AVG(cas.score) FILTER (WHERE cas.status = 'marked') AS score_average,
    MIN(cas.score) FILTER (WHERE cas.status = 'marked') AS score_min,
    MAX(cas.score) FILTER (WHERE cas.status = 'marked') AS score_max
FROM public.canonical_answer_scores AS cas
JOIN public.layout_boxes AS lb ON lb.id = cas.layout_box_id
GROUP BY cas.test_id, cas.layout_box_id, cas.label, lb.page_no, cas.points;

REVOKE ALL PRIVILEGES ON TABLE
    public.test_score_summary,
    public.student_published_test_results,
    public.question_score_summary
FROM anon, authenticated;
GRANT SELECT ON TABLE
    public.test_score_summary,
    public.student_published_test_results,
    public.question_score_summary
TO authenticated;


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

    PERFORM 1
      FROM public.tests AS t
     WHERE t.id = p_test_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'テストが見つかりません。';
    END IF;

    IF p_publish IS NULL THEN
        RAISE EXCEPTION '公開状態を指定してください。';
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
                  FROM public.canonical_answer_scores AS cas
                 WHERE cas.answer_sheet_id = a.id
                   AND cas.layout_box_id = b.id
                   AND cas.status = 'marked'
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


REVOKE ALL ON FUNCTION public.set_test_publication(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_test_publication(uuid, boolean) TO authenticated;

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
            cas.answer_sheet_id,
            cas.score
        FROM public.canonical_answer_scores AS cas
        WHERE cas.test_id = p_test_id
          AND cas.status = 'marked'
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


REVOKE ALL ON FUNCTION public.get_student_test_standard_scores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_test_standard_scores(uuid) TO authenticated;

COMMIT;
