-- Ensure atomic marking does not depend on an optional scores.created_at column.
BEGIN;



REVOKE ALL ON FUNCTION public.save_answer_marking(uuid, uuid, uuid, numeric, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_answer_marking(uuid, uuid, uuid, numeric, jsonb)
TO authenticated;

COMMIT;
