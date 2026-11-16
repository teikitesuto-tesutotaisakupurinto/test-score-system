
"use strict";

/* =========================================================
   テスト成績システム
   js/auth.js
========================================================= */

function getSupabaseClient() {

  if (window.supabaseClient) {
    return window.supabaseClient;
  }

  if (window.SB) {
    return window.SB;
  }

  if (
    !window.supabase ||
    typeof window.supabase.createClient !==
      "function"
  ) {

    throw new Error(
      "Supabase JS SDKが読み込まれていません。"
    );

  }

  const url =
    window.SUPABASE_URL || "";

  const key =
    window.SUPABASE_KEY || "";

  if (!url || !key) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }

  const client =
    window.supabase.createClient(
      url,
      key,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          flowType: "pkce"
        }
      }
    );

  window.supabaseClient =
    client;

  window.SB =
    client;

  return client;

}


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

  const {
    data,
    error
  } =
    await client.auth.getSession();

  if (error) {
    throw error;
  }

  return data?.session || null;

}


/* =========================================================
   CURRENT USER
========================================================= */

async function getCurrentUser() {

  const client =
    getSupabaseClient();

  const {
    data,
    error
  } =
    await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data?.user || null;

}


/* =========================================================
   PROFILE
========================================================= */

async function getProfile() {

  const client =
    getSupabaseClient();

  const user =
    await getCurrentUser();


  if (!user) {
    return null;
  }


  /*
   * profiles.student_id は存在しないため
   * 取得しない。
   */

  const {
    data,
    error
  } =
    await client
      .from("profiles")
      .select(`
        id,
        name,
        role
      `)
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


  return {

    id:
      user.id,

    name:
      data?.name ||
      user.email ||
      "ユーザー",

    role:
      data?.role ||
      null,

    user

  };

}


/* =========================================================
   REDIRECT
========================================================= */

function redirectByRole(
  role
) {

  if (
    role === "student"
  ) {

    location.replace(
      "/student/index.html"
    );

    return;

  }


  if (
    role === "teacher" ||
    role === "admin"
  ) {

    location.replace(
      "/teacher/index.html"
    );

    return;

  }


  location.replace(
    "/login"
  );

}


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


async function goByRole() {

  await redirectAfterLogin();

}


/* =========================================================
   REQUIRE ROLE
========================================================= */

async function requireRole(
  requiredRole
) {

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


  if (
    requiredRole === "teacher"
  ) {

    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  if (
    requiredRole === "admin"
  ) {

    if (
      profile.role !== "admin"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  if (
    requiredRole === "student"
  ) {

    if (
      profile.role !== "student"
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


  const {
    data,
    error
  } =
    await client.auth.signInWithPassword({

      email:
        String(
          email || ""
        ).trim(),

      password:
        String(
          password || ""
        )

    });


  if (error) {
    throw error;
  }


  return data;

}


/* =========================================================
   LOGOUT
========================================================= */

async function signOut() {

  const client =
    getSupabaseClient();


  try {

    await client.auth.signOut();

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


  emailInput?.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
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
        event.key === "Enter"
      ) {

        event.preventDefault();

        loginButton.click();

      }

    }
  );

}


/* =========================================================
   AUTO START
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
