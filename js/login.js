
/* =========================================================
   テスト成績システム
   ログイン処理 完全版
========================================================= */

(function () {

  "use strict";


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
     Error
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
     Loading
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
     Supabase Error
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


    return (
      message ||
      "ログインできませんでした。"
    );

  }


  /* =======================================================
     Submit
  ======================================================= */

  form.addEventListener(
    "submit",
    async event => {

      /*
        絶対に通常フォーム送信しない。

        これにより、

        /login?email=...
        /login?password=...

        を防止。
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


      if (
        !window.supabaseClient
      ) {

        showError(
          "Supabaseの設定を読み込めませんでした。"
        );


        return;

      }


      setLoading(
        true
      );


      try {

        /*
          Authログイン
        */

        await window.login(
          email,
          password
        );


        /*
          Role取得
          ↓
          teacher/admin/student
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
