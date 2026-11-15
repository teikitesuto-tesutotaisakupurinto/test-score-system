
/* =========================================================
   テスト成績システム
   Supabase Configuration
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Supabase設定
  ======================================================= */

  const SUPABASE_URL =
    "https://vwlxcregufhhfzjrnnrr.supabase.co";


  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Z3ghYk1JsOI7lbG6Si1nXg_PaEoY8Rn";


  /* =======================================================
     設定値をWindowへ
  ======================================================= */

  window.SUPABASE_URL =
    SUPABASE_URL;


  window.SUPABASE_KEY =
    SUPABASE_PUBLISHABLE_KEY;


  /* =======================================================
     Supabaseライブラリ確認
  ======================================================= */

  if (
    !window.supabase
  ) {

    console.error(
      "Supabase JS SDKが読み込まれていません。"
    );


    return;

  }


  /* =======================================================
     Client作成
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
            window.localStorage

        }

      }

    );


  /*
    既存コードが

      supabaseClient

    と直接参照しているため、
    グローバル変数としても公開する。
  */

  var supabaseClient =
    window.supabaseClient;


  /* =======================================================
     初期化確認
  ======================================================= */

  console.log(
    "Supabase initialized:",
    SUPABASE_URL
  );


})();
