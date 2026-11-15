
"use strict";

/* =========================================================
   テスト成績システム
   共通認証
========================================================= */


/* =========================================================
   Supabase Client
========================================================= */

function getSupabase() {

  /*
   * config.jsがすでに作成しているClientを優先
   */

  if (
    window.supabaseClient
  ) {

    return window.supabaseClient;

  }


  /*
   * SBが既にある場合
   */

  if (
    window.SB
  ) {

    return window.SB;

  }


  /*
   * config.jsのグローバル設定から作成
   *
   * 現在のconfig.js:
   *
   * window.SUPABASE_URL
   * window.SUPABASE_KEY
   */

  const url =
    window.SUPABASE_URL;


  const key =
    window.SUPABASE_KEY;


  if (
    !url ||
    !key
  ) {

    console.error(
      "Supabaseの設定を読み込めませんでした。"
    );

    return null;

  }


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


/*
 * Client
 */

const sb =
  getSupabase();


/* =========================================================
   Session
========================================================= */

async function getSession() {

  const client =
    getSupabase();


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
   Current User
========================================================= */

async function getCurrentUser() {

  const client =
    getSupabase();


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
   Profile
========================================================= */

async function getProfile() {

  const client =
    getSupabase();


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
   * profilesには
   *
   * id
   * name
   * role
   *
   * だけを使用。
   *
   * student_idなど存在しないカラムは
   * SELECTしない。
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
        "先生",

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
   Require Role
========================================================= */

async function requireRole(
  requiredRole
) {

  const client =
    getSupabase();


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
   * teacher画面
   *
   * adminも使用可能。
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
   Role Redirect
========================================================= */

function redirectByRole(
  role
) {

  if (
    role ===
    "student"
  ) {

    location.replace(
      "/student.html"
    );

    return;

  }


  if (
    role ===
      "teacher" ||
    role ===
      "admin"
  ) {

    location.replace(
      "/teacher.html"
    );

    return;

  }


  location.replace(
    "/login"
  );

}


/* =========================================================
   Login
========================================================= */

async function login(
  email,
  password
) {

  const client =
    getSupabase();


  if (!client) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data,
    error
  } =
    await client.auth.signInWithPassword({

      email,

      password

    });


  if (error) {

    throw error;

  }


  return data;

}


/* =========================================================
   Role Redirect After Login
========================================================= */

async function goByRole() {

  const profile =
    await getProfile();


  if (!profile) {

    return;

  }


  if (
    profile.role ===
      "teacher" ||
    profile.role ===
      "admin"
  ) {

    location.replace(
      "/teacher.html"
    );

    return;

  }


  if (
    profile.role ===
    "student"
  ) {

    location.replace(
      "/student.html"
    );

    return;

  }


  throw new Error(
    "ユーザーの権限が設定されていません。"
  );

}


/* =========================================================
   Login Page
========================================================= */

function setupLoginPage() {

  const loginButton =
    document.getElementById(
      "loginBtn"
    );


  if (!loginButton) {

    return;

  }


  loginButton.addEventListener(
    "click",
    async () => {

      const message =
        document.getElementById(
          "loginMsg"
        );


      const emailElement =
        document.getElementById(
          "email"
        );


      const passwordElement =
        document.getElementById(
          "password"
        );


      const email =
        emailElement?.value.trim() ||
        "";


      const password =
        passwordElement?.value ||
        "";


      if (!email) {

        if (message) {

          message.textContent =
            "メールアドレスを入力してください。";

        }

        return;

      }


      if (!password) {

        if (message) {

          message.textContent =
            "パスワードを入力してください。";

        }

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


        await goByRole();


      } catch (error) {

        console.error(
          "login:",
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


}


/* =========================================================
   Sign Out
========================================================= */

async function signOut() {

  const client =
    getSupabase();


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
   Login Page Auto Start
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupLoginPage();

  }
);


/* =========================================================
   Global
========================================================= */

window.SB =
  sb;


window.supabaseClient =
  sb;


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


window.signOut =
  signOut;


window.logout =
  logout;
