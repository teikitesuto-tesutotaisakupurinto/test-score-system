
"use strict";

/* =========================================================
   認証共通

   teacher
   ---------------------------------------------------------
   profiles.role = teacher / admin

   student
   ---------------------------------------------------------
   profiles.role = student
   ↓
   students.auth_user_id = auth.uid()

   生徒IDはURLから取得しない。
========================================================= */


/* =========================================================
   CLIENT
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

    throw new Error(
      "Supabase JS SDKが読み込まれていません。"
    );

  }


  const url =
    window.SUPABASE_URL ||
    "";


  const key =
    window.SUPABASE_KEY ||
    "";


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


  return (
    data?.session ||
    null
  );

}


/* =========================================================
   USER
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


  const user =
    await getCurrentUser();


  if (!user) {

    return null;

  }


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
   STUDENT
========================================================= */

async function getStudentForUser(
  userId
) {

  const client =
    getSupabaseClient();


  const {
    data,
    error
  } =
    await client
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        grade,
        class_name,
        active,
        auth_user_id
        `
      )
      .eq(
        "auth_user_id",
        userId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      `生徒情報取得エラー: ${error.message}`
    );

  }


  return data || null;

}


/* =========================================================
   REQUIRE STUDENT
========================================================= */

async function requireStudent() {

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
    profile.role !==
    "student"
  ) {

    redirectByRole(
      profile.role
    );

    return null;

  }


  /*
   * ここが生徒認証の本体。
   *
   * URLのstudent_idは信用しない。
   * Authユーザー自身のauth_user_idから
   * studentsを取得する。
   */

  const student =
    await getStudentForUser(
      user.id
    );


  if (!student) {

    throw new Error(
      "ログイン中の生徒情報が登録されていません。"
    );

  }


  return {

    user,

    profile,

    student

  };

}


/* =========================================================
   REDIRECT
========================================================= */

function redirectByRole(
  role
) {

  if (
    role ===
    "student"
  ) {

    location.replace(
      "/student/tests/index.html"
    );

    return;

  }


  if (role === "teacher") {
    location.replace("/teacher/index.html");
    return;
  }

  if (role === "admin") {
    location.replace("/admin");
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
    requiredRole ===
    "teacher"
  ) {

    if (
      profile.role !==
      "teacher"
    ) {

      redirectByRole(
        profile.role
      );

      return null;

    }

  }


  if (
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


  if (
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
   GLOBAL
========================================================= */

window.getSession =
  getSession;


window.getCurrentUser =
  getCurrentUser;


window.getProfile =
  getProfile;


window.getStudentForUser =
  getStudentForUser;


window.requireStudent =
  requireStudent;


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
