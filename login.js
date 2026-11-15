
/* =========================================================
   テスト成績システム
   Login
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
      "loginFormが見つかりません。"
    );

    return;

  }


  /* =====================================================
     既にログイン済みなら
     適切なページへ
  ===================================================== */

  checkExistingSession();


  async function checkExistingSession() {

    try {

      const session =
        await getSession();


      if (!session) {

        return;

      }


      /*
        ログイン済みなら
        Roleに応じて移動
      */

      await redirectAfterLogin();

    } catch (error) {

      /*
        Role判定できない場合は
        ログイン画面に留める。
      */

      console.warn(
        "既存Session確認:",
        error
      );

    }

  }


  /* =====================================================
     Submit
  ===================================================== */

  form.addEventListener(
    "submit",
    async event => {

      /*
        これが重要。

        ブラウザの通常GET/POST送信を
        完全に止める。

        これにより

        /login?email=...&password=...

        にならない。
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


      setLoading(
        true
      );


      try {

        /*
          Supabase Authへ直接送信。

          URLには
          email/passwordを付けない。
        */

        await login(
          email,
          password
        );


        /*
          成功後にRole判定
        */

        await redirectAfterLogin();


      } catch (error) {

        console.error(
          "ログイン:",
          error
        );


        showError(
          getLoginErrorMessage(
            error
          )
        );


        setLoading(
          false
        );

      }

    }
  );


  /* =====================================================
     Enterキー
  ===================================================== */

  [
    emailInput,
    passwordInput
  ]
    .filter(Boolean)
    .forEach(
      input => {

        input.addEventListener(
          "keydown",
          event => {

            if (
              event.key ===
              "Enter"
            ) {

              /*
                submitイベントに任せる
              */

              return;

            }

          }
        );

      }
    );


  /* =====================================================
     Loading
  ===================================================== */

  function setLoading(
    loading
  ) {

    if (!loginButton) {

      return;

    }


    loginButton.disabled =
      loading;


    loginButton.textContent =
      loading
        ? "ログイン中..."
        : "ログイン";

  }


  /* =====================================================
     Error
  ===================================================== */

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


  /* =====================================================
     Supabase Error
  ===================================================== */

  function getLoginErrorMessage(
    error
  ) {

    const message =
      String(
        error?.message ||
        ""
      ).toLowerCase();


    if (
      message.includes(
        "invalid login credentials"
      )
    ) {

      return (
        "メールアドレスまたはパスワードが正しくありません。"
      );

    }


    if (
      message.includes(
        "email not confirmed"
      )
    ) {

      return (
        "メールアドレスの確認が完了していません。"
      );

    }


    if (
      message.includes(
        "too many requests"
      )
    ) {

      return (
        "ログイン試行が多すぎます。しばらく待ってから再度お試しください。"
      );

    }


    if (
      message.includes(
        "network"
      )
    ) {

      return (
        "通信に失敗しました。ネットワーク接続を確認してください。"
      );

    }


    return (
      error?.message ||
      "ログインできませんでした。"
    );

  }

})();
