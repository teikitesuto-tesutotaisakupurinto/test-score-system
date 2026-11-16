
"use strict";

/* =========================================================
   テスト成績システム
   js/auth.js

   共通認証

   対応:
   ---------------------------------------------------------
   teacher
   admin
   student

   遷移:
   ---------------------------------------------------------
   teacher / admin
      → /teacher/index.html

   student
      → /student/index.html

   profiles:
   ---------------------------------------------------------
   id
   name
   role

   student_id は使用しない。
========================================================= */


/* =========================================================
   SUPABASE CLIENT
========================================================= */

function getSupabaseClient() {

  /*
   * 現在の config.js が作成するClient
   */

  if (
    window.supabaseClient
  ) {

    return window.supabaseClient;

  }


  /*
   * 念のためSBも確認
   */

  if (
    window.SB
  ) {

    return window.SB;

  }


  /*
   * config.jsがClientを作っていない場合、
   * グローバル設定から作成。
   */

  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {

    console.error(
      "Supabase JS SDKが読み込まれていません。"
    );

    return null;

  }


  const url =
    window.SUPABASE_URL ||
    window.APP_CONFIG?.SUPABASE_URL ||
    "";


  const key =
    window.SUPABASE_KEY ||
    window.APP_CONFIG?.SUPABASE_ANON_KEY ||
    "";


  if (
    !url ||
    !key
  ) {

    console.error(
      "Supabaseの設定がありません。"
    );

    return null;

  }


  const client =
    window.supabase.createClient(
      url,
      key,
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


  window.supabaseClient =
    client;


  window.SB =
    client;


  return client;

}


/* =========================================================
   CLIENT
========================================================= */

const sb =
  getSupabaseClient();


window.SB =
  sb;


window.supabaseClient =
  sb;


/* =========================================================
   SESSION
========================================================= */

async function getSession() {

  const client =
    getSupabaseClient();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data,
    error
  } =
    await client.auth.getSession();


  if (error) {

    throw error;

  }


  return (
    data?.session ||
    null
  );

}


/* =========================================================
   CURRENT USER
========================================================= */

async function getCurrentUser() {

  const client =
    getSupabaseClient();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data,
    error
  } =
    await client.auth.getUser();


  if (error) {

    throw error;

  }


  return (
    data?.user ||
    null
  );

}


/* =========================================================
   PROFILE
========================================================= */

async function getProfile() {

  const client =
    getSupabaseClient();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const user =
    await getCurrentUser();


  if (!user) {

    return null;

  }


  /*
   * 重要:
   *
   * profiles.student_id は取得しない。
   *
   * 現在必要なのは
   *
   * id
   * name
   * role
   */

  const {
    data,
    error
  } =
    await client
      .from(
        "profiles"
      )
      .select(
        `
        id,
        name,
        role
        `
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      `プロフィール取得エラー: ${error.message}`
    );

  }


  if (!data) {

    return {

      id:
        user.id,

      name:
        user.email ||
        "ユーザー",

      role:
        null,

      user

    };

  }


  return {

    ...data,

    user

  };

}


/* =========================================================
   REDIRECT BY ROLE
========================================================= */

function redirectByRole(
  role
) {

  /*
   * 生徒
   */

  if (
    role ===
    "student"
  ) {

    location.replace(
      "/student/index.html"
    );

    return;

  }


  /*
   * 先生・管理者
   */

  if (
    role ===
      "teacher" ||
    role ===
      "admin"
  ) {

    location.replace(
      "/teacher/index.html"
    );

    return;

  }


  /*
   * 不明
   */

  location.replace(
    "/login"
  );

}


/* =========================================================
   REDIRECT AFTER LOGIN
========================================================= */

async function redirectAfterLogin() {

  const profile =
    await getProfile();


  if (!profile) {

    throw new Error(
      "プロフィールを取得できませんでした。"
    );

  }


  redirectByRole(
    profile.role
  );

}


/* =========================================================
   GO BY ROLE
========================================================= */

async function goByRole() {

  await redirectAfterLogin();

}


/* =========================================================
   REQUIRE ROLE
========================================================= */

async function requireRole(
  requiredRole
) {

  const client =
    getSupabaseClient();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const user =
    await getCurrentUser();


  if (!user) {

    location.replace(
      "/login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (!profile) {

    location.replace(
      "/login"
    );

    return null;

  }


  /*
   * teacher
   *
   * adminも先生画面を利用可能。
   */

  if (
    requiredRole ===
    "teacher"
  ) {

    if (
      profile.role !==
        "teacher" &&
      profile.role !==
        "admin"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  /*
   * admin
   */

  else if (
    requiredRole ===
    "admin"
  ) {

    if (
      profile.role !==
      "admin"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  /*
   * student
   */

  else if (
    requiredRole ===
    "student"
  ) {

    if (
      profile.role !==
      "student"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  return {

    user,

    profile

  };

}


/* =========================================================
   LOGIN
========================================================= */

async function login(
  email,
  password
) {

  const client =
    getSupabaseClient();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data,
    error
  } =
    await client.auth
      .signInWithPassword({

        email:
          String(
            email ||
            ""
          ).trim(),

        password:
          String(
            password ||
            ""
          )

      });


  if (error) {

    throw error;

  }


  return data;

}


/* =========================================================
   SIGN OUT
========================================================= */

async function signOut() {

  const client =
    getSupabaseClient();


  try {

    if (client) {

      await client.auth.signOut();

    }

  } catch (error) {

    console.error(
      "signOut:",
      error
    );

  }


  location.replace(
    "/login"
  );

}


async function logout() {

  await signOut();

}


/* =========================================================
   LOGIN PAGE
========================================================= */

function setupLoginPage() {

  /*
   * login.html以外では何もしない。
   */

  const loginButton =
    document.getElementById(
      "loginBtn"
    );


  if (!loginButton) {

    return;

  }


  const emailInput =
    document.getElementById(
      "email"
    );


  const passwordInput =
    document.getElementById(
      "password"
    );


  const message =
    document.getElementById(
      "loginMsg"
    );


  loginButton.addEventListener(
    "click",
    async () => {

      const email =
        emailInput?.value.trim() ||
        "";


      const password =
        passwordInput?.value ||
        "";


      if (!email) {

        if (message) {

          message.textContent =
            "メールアドレスを入力してください。";

        }

        emailInput?.focus();

        return;

      }


      if (!password) {

        if (message) {

          message.textContent =
            "パスワードを入力してください。";

        }

        passwordInput?.focus();

        return;

      }


      loginButton.disabled =
        true;


      loginButton.textContent =
        "ログイン中...";


      if (message) {

        message.textContent =
          "";

      }


      try {

        await login(
          email,
          password
        );


        await redirectAfterLogin();


      } catch (error) {

        console.error(
          "LOGIN ERROR:",
          error
        );


        if (message) {

          message.textContent =
            error.message ||
            "ログインできませんでした。";

        }


        loginButton.disabled =
          false;


        loginButton.textContent =
          "ログイン";

      }

    }
  );


  /*
   * Enterキー
   */

  emailInput?.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        loginButton.click();

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

        loginButton.click();

      }

    }
  );

}


/* =========================================================
   LOGIN PAGE AUTO START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupLoginPage();

  }
);


/* =========================================================
   GLOBAL
========================================================= */

window.getSession =
  getSession;


window.getCurrentUser =
  getCurrentUser;


window.getProfile =
  getProfile;


window.requireRole =
  requireRole;


window.login =
  login;


window.goByRole =
  goByRole;


window.redirectAfterLogin =
  redirectAfterLogin;


window.signOut =
  signOut;


window.logout =
  logout;
