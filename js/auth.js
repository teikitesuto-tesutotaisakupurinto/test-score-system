
"use strict";

/* =========================================================
   テスト成績システム
   共通認証
========================================================= */


/* =========================================================
   Supabase Client
   ---------------------------------------------------------
   現在の config.js は

     window.SUPABASE_URL
     window.SUPABASE_KEY
     window.supabaseClient

   を作成する構成。
========================================================= */

function getSupabaseClient() {

  if (
    window.supabaseClient
  ) {

    return window.supabaseClient;

  }


  if (
    window.SB
  ) {

    return window.SB;

  }


  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {

    return null;

  }


  const url =
    window.SUPABASE_URL;


  const key =
    window.SUPABASE_KEY;


  if (
    !url ||
    !key
  ) {

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
   Client
========================================================= */

const sb =
  getSupabaseClient();


window.SB =
  sb;


/* =========================================================
   Session
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
   Current User
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
   Profile
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
   * profiles.student_id は使用しない。
   *
   * 現在必要なのは
   * id / name / role。
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
   Role Check
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


  const actualRole =
    profile.role;


  /*
   * teacher画面はadminも利用可能。
   */

  if (
    requiredRole ===
    "teacher"
  ) {

    if (
      actualRole !==
        "teacher" &&
      actualRole !==
        "admin"
    ) {

      redirectByRole(
        actualRole
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
      actualRole !==
      "admin"
    ) {

      redirectByRole(
        actualRole
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
      actualRole !==
      "student"
    ) {

      redirectByRole(
        actualRole
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
    await client.auth.signInWithPassword({

      email:
        email.trim(),

      password

    });


  if (error) {

    throw error;

  }


  return data;

}


/* =========================================================
   Redirect After Login
   ---------------------------------------------------------
   これを追加することで、既存コードの

     window.redirectAfterLogin()

   にも対応する。
========================================================= */

async function redirectAfterLogin() {

  const profile =
    await getProfile();


  if (!profile) {

    throw new Error(
      "プロフィールを取得できませんでした。"
    );

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
   goByRole
   ---------------------------------------------------------
   既存コードとの互換用。
========================================================= */

async function goByRole() {

  await redirectAfterLogin();

}


/* =========================================================
   Logout
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
   Login Page
========================================================= */

function setupLoginPage() {

  const button =
    document.getElementById(
      "loginBtn"
    );


  if (!button) {

    return;

  }


  button.addEventListener(
    "click",
    async () => {

      const emailElement =
        document.getElementById(
          "email"
        );


      const passwordElement =
        document.getElementById(
          "password"
        );


      const message =
        document.getElementById(
          "loginMsg"
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


      button.disabled =
        true;


      button.textContent =
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
          "login:",
          error
        );


        if (message) {

          message.textContent =
            error.message ||
            "ログインできませんでした。";

        }


        button.disabled =
          false;


        button.textContent =
          "ログイン";

      }

    }
  );

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


window.redirectAfterLogin =
  redirectAfterLogin;


window.signOut =
  signOut;


window.logout =
  logout;
