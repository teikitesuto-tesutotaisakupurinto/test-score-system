
"use strict";

/* =========================================================
   テスト成績システム
   共通認証
========================================================= */


/* =========================================================
   Supabase
========================================================= */

const DB =
  window.supabaseClient;


if (!DB) {

  console.error(
    "Supabase Clientが初期化されていません。"
  );

}


/* =========================================================
   Session
========================================================= */

async function getSession() {

  if (!DB) {

    throw new Error(
      "Supabase接続がありません。"
    );

  }


  const {
    data,
    error
  } =
    await DB.auth.getSession();


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

  if (!DB) {

    throw new Error(
      "Supabase接続がありません。"
    );

  }


  const {
    data,
    error
  } =
    await DB.auth.getUser();


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

  if (!DB) {

    throw new Error(
      "Supabase接続がありません。"
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
   * を使用。
   *
   * student_idは取得しない。
   */

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
   * teacher画面
   *
   * adminも利用可能。
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
   Logout
========================================================= */

async function signOut() {

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

      console.error(
        "signOut:",
        error
      );

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
   Global
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


/*
 * config.jsで作られた
 * supabaseClientをそのまま使用。
 */

window.SB =
  DB;

