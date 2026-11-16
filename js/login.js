
"use strict";

/* =========================================================
   ログイン

   login.html
   ---------------------------------------------------------
   email
   password
   loginBtn
   loginMsg

   ↓

   Supabase Auth

   ↓

   profiles.role

   ↓

   teacher / admin
     /teacher/index.html

   student
     /student/tests/index.html
========================================================= */


/* =========================================================
   DOM
========================================================= */

const loginButton =
  document.getElementById(
    "loginBtn"
  );


const emailInput =
  document.getElementById(
    "email"
  );


const passwordInput =
  document.getElementById(
    "password"
  );


const loginMessage =
  document.getElementById(
    "loginMsg"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeLogin
);


function initializeLogin() {

  if (!loginButton) {

    return;

  }


  loginButton.addEventListener(
    "click",
    handleLogin
  );


  emailInput?.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        handleLogin();

      }

    }
  );


  passwordInput?.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        handleLogin();

      }

    }
  );

}


/* =========================================================
   LOGIN
========================================================= */

async function handleLogin() {

  clearMessage();


  const email =
    emailInput?.value
      ?.trim() ||
    "";


  const password =
    passwordInput?.value ||
    "";


  if (!email) {

    showMessage(
      "メールアドレスを入力してください。"
    );


    emailInput?.focus();

    return;

  }


  if (!password) {

    showMessage(
      "パスワードを入力してください。"
    );


    passwordInput?.focus();

    return;

  }


  if (
    typeof window.login !==
    "function"
  ) {

    showMessage(
      "認証処理を読み込めませんでした。"
    );

    return;

  }


  setLoading(
    true
  );


  try {

    await window.login(
      email,
      password
    );


    await window.redirectAfterLogin();


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );


    showMessage(
      formatLoginError(
        error
      )
    );


    setLoading(
      false
    );

  }

}


/* =========================================================
   LOADING
========================================================= */

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


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  message
) {

  if (!loginMessage) {

    return;

  }


  loginMessage.textContent =
    message;


  loginMessage.style.display =
    "block";

}


function clearMessage() {

  if (!loginMessage) {

    return;

  }


  loginMessage.textContent =
    "";

}


/* =========================================================
   ERROR
========================================================= */

function formatLoginError(
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
      "network"
    )
  ) {

    return (
      "通信に失敗しました。しばらく待ってから再度お試しください。"
    );

  }


  return (
    message ||
    "ログインできませんでした。"
  );

}
