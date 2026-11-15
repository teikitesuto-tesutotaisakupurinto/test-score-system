
/* =========================================================
   テスト成績システム
   Supabase Configuration
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Supabase
  ======================================================= */

  const SUPABASE_URL =
    "https://vwlxcregufhhfzjrnnrr.supabase.co";


  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Z3ghYk1JsOI7lbG6Si1nXg_PaEoY8Rn";


  /* =======================================================
     Global
  ======================================================= */

  window.SUPABASE_URL =
    SUPABASE_URL;


  window.SUPABASE_KEY =
    SUPABASE_PUBLISHABLE_KEY;


  /* =======================================================
     SDK確認
  ======================================================= */

  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {

    console.error(
      "Supabase JS SDKが読み込まれていません。"
    );

    return;

  }


  /* =======================================================
     Client
  ======================================================= */

  window.supabaseClient =
    window.supabase.createClient(

      SUPABASE_URL,

      SUPABASE_PUBLISHABLE_KEY,

      {

        auth: {

          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true,

          storage:
            window.localStorage,

          flowType:
            "pkce"

        }

      }

    );


  /* =======================================================
     初期化確認
  ======================================================= */

  console.log(
    "Supabase initialized"
  );

})();
