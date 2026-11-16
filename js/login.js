
/* =========================================================
   テスト成績システム
   js/login.js

   ログイン処理
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     DOM
  ======================================================= */

  const form =
    document.getElementById(
      "loginForm"
    );


  const emailInput =
    document.getElementById(
      "email"
    );


  const passwordInput =
    document.getElementById(
      "password"
    );


  const loginButton =
    document.getElementById(
      "loginButton"
    );


  const loginError =
    document.getElementById(
      "loginError"
    );


  if (!form) {

    console.error(
      "loginFormがありません。"
    );

    return;

  }


  /* =======================================================
     ERROR
  ======================================================= */

  function showError(
    message
  ) {

    if (!loginError) {

      alert(
        message
      );

      return;

    }


    loginError.textContent =
      message;


    loginError.style.display =
      "block";

  }


  function clearError() {

    if (!loginError) {

      return;

    }


    loginError.textContent =
      "";


    loginError.style.display =
      "none";

  }


  /* =======================================================
     LOADING
  ======================================================= */

  function setLoading(
    value
  ) {

    if (!loginButton) {

      return;

    }


    loginButton.disabled =
      value;


    loginButton.textContent =
      value
        ? "ログイン中..."
        : "ログイン";

  }


  /* =======================================================
     ERROR FORMAT
  ======================================================= */

  function formatError(
    error
  ) {

    const message =
      String(
        error?.message ||
        ""
      );


    const lower =
      message.toLowerCase();


    if (
      lower.includes(
        "invalid login credentials"
      )
    ) {

      return (
        "メールアドレスまたはパスワードが正しくありません。"
      );

    }


    if (
      lower.includes(
        "email not confirmed"
      )
    ) {

      return (
        "メールアドレスの確認が完了していません。"
      );

    }


    if (
      lower.includes(
        "too many requests"
      )
    ) {

      return (
        "ログイン試行が多すぎます。しばらく待ってから再度お試しください。"
      );

    }


    if (
      lower.includes(
        "permission denied"
      )
    ) {

      return (
        "ログイン権限を確認できません。管理者に確認してください。"
      );

    }


    return (
      message ||
      "ログインできませんでした。"
    );

  }


  /* =======================================================
     SUBMIT
  ======================================================= */

  form.addEventListener(
    "submit",
    async event => {

      /*
       * 通常フォーム送信は禁止。
       */

      event.preventDefault();

      event.stopPropagation();


      clearError();


      const email =
        emailInput
          ?.value
          .trim() ||
        "";


      const password =
        passwordInput
          ?.value ||
        "";


      if (!email) {

        showError(
          "メールアドレスを入力してください。"
        );


        emailInput?.focus();


        return;

      }


      if (!password) {

        showError(
          "パスワードを入力してください。"
        );


        passwordInput?.focus();


        return;

      }


      /*
       * config.jsで作成された
       * Supabase Clientを使用。
       */

      if (
        !window.supabaseClient
      ) {

        showError(
          "Supabaseの設定を読み込めませんでした。"
        );


        return;

      }


      /*
       * auth.jsが読み込まれているか確認。
       */

      if (
        typeof window.login !==
        "function"
      ) {

        showError(
          "認証処理を読み込めませんでした。"
        );


        return;

      }


      if (
        typeof window.redirectAfterLogin !==
        "function"
      ) {

        showError(
          "ログイン後の移動処理を読み込めませんでした。"
        );


        return;

      }


      setLoading(
        true
      );


      try {

        /*
         * Supabase Auth
         */

        await window.login(
          email,
          password
        );


        /*
         * teacher/admin/student
         * に応じて移動。
         *
         * teacher
         *   /teacher/index.html
         *
         * student
         *   /student/index.html
         */

        await window.redirectAfterLogin();


      } catch (error) {

        console.error(
          "LOGIN ERROR:",
          error
        );


        showError(
          formatError(
            error
          )
        );


        setLoading(
          false
        );

      }

    },
    true
  );


})();
