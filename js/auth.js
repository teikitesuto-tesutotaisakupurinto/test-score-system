
"use strict";

/* =========================================================
   テスト成績システム
   js/auth.js

   共通認証

   提供:
     requireRole(role)
     getSession()
     getProfile()
     getCurrentUser()
     signOut()
     logout()

   対応:
     teacher
     student
     admin

   DB:
     profiles
       id
       name
       role
       student_id
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

function getSupabaseClient() {

  /*
   * 既にconfig.js側で作られている場合
   */

  if (
    window.SB
  ) {

    return window.SB;

  }


  if (
    window.supabaseClient
  ) {

    return window.supabaseClient;

  }


  /*
   * config.jsの設定から作成
   */

  if (
    window.supabase &&
    window.APP_CONFIG
  ) {

    const url =
      window.APP_CONFIG
        .SUPABASE_URL;


    const key =
      window.APP_CONFIG
        .SUPABASE_ANON_KEY;


    if (
      url &&
      key &&
      url !==
        "YOUR_SUPABASE_URL" &&
      key !==
        "YOUR_SUPABASE_ANON_KEY"
    ) {

      const client =
        window.supabase.createClient(
          url,
          key
        );


      window.SB =
        client;


      window.supabaseClient =
        client;


      return client;

    }

  }


  return null;

}


/* =========================================================
   SESSION
========================================================= */

async function getSession() {

  const DB =
    getSupabaseClient();


  if (!DB) {

    throw new Error(
      "Supabaseクライアントがありません。js/config.jsを確認してください。"
    );

  }


  const {
    data,
    error
  } =
    await DB.auth.getSession();


  if (error) {

    throw new Error(
      `セッション取得エラー: ${error.message}`
    );

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

  const DB =
    getSupabaseClient();


  if (!DB) {

    throw new Error(
      "Supabaseクライアントがありません。"
    );

  }


  const {
    data,
    error
  } =
    await DB.auth.getUser();


  if (error) {

    throw new Error(
      `ユーザー取得エラー: ${error.message}`
    );

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

  const DB =
    getSupabaseClient();


  if (!DB) {

    throw new Error(
      "Supabaseクライアントがありません。"
    );

  }


  const user =
    await getCurrentUser();


  if (!user) {

    return null;

  }


  const {
    data,
    error
  } =
    await DB
      .from(
        "profiles"
      )
      .select(
        `
        id,
        name,
        role,
        student_id
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

      student_id:
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
   REQUIRE ROLE
========================================================= */

async function requireRole(
  requiredRole
) {

  const user =
    await getCurrentUser();


  /*
   * 未ログイン
   */

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


  const role =
    profile.role;


  /*
   * teacherを要求
   *
   * adminも先生画面を利用可能。
   */

  if (
    requiredRole ===
    "teacher"
  ) {

    if (
      role !== "teacher" &&
      role !== "admin"
    ) {

      redirectByRole(
        role
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
      role !== "admin"
    ) {

      redirectByRole(
        role
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
      role !== "student"
    ) {

      redirectByRole(
        role
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
   ROLE REDIRECT
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
   SIGN OUT
========================================================= */

async function signOut() {

  const DB =
    getSupabaseClient();


  if (!DB) {

    location.replace(
      "/login"
    );

    return;

  }


  try {

    const {
      error
    } =
      await DB.auth.signOut();


    if (error) {

      throw error;

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


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  await signOut();

}


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


window.signOut =
  signOut;


window.logout =
  logout;

