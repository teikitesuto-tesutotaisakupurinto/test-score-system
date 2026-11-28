
"use strict";

/* =========================================================
   Supabase Configuration

   このファイルでは
   ・Supabase URL
   ・Publishable Key
   ・Supabase Client
   の初期化だけを担当。

   認証処理は auth.js に統一。
========================================================= */

(function () {

  "use strict";


  const SUPABASE_URL =
    "https://vwlxcregufhhfzjrnnrr.supabase.co";


  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Z3ghYk1JsOI7lbG6Si1nXg_PaEoY8Rn";


  /*
   * グローバル設定
   */

  window.SUPABASE_URL =
    SUPABASE_URL;


  window.SUPABASE_KEY =
    SUPABASE_PUBLISHABLE_KEY;


  /*
   * SDK確認
   */

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


  /*
   * 二重初期化を防止。
   *
   * config.js
   * auth.js
   *
   * の両方から読み込まれても
   * 同じClientを使用する。
   */

  // アプリ全体でSupabase Clientを必ず1つだけ共有する。
  const existingClient = window.supabaseClient || window.SB || null;
  if (existingClient) {
    window.supabaseClient = existingClient;
    window.SB = existingClient;
    window.__APP_SUPABASE_CLIENT__ = existingClient;
    return;
  }


  const client =
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


  window.supabaseClient = client;
  window.SB = client;
  window.__APP_SUPABASE_CLIENT__ = client;

})();
