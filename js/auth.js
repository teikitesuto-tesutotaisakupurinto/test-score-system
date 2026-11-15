
"use strict";


/* =========================================================
   共通認証
========================================================= */

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} =
  window.APP_CONFIG || {};


const sb =
  (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.startsWith("http") &&
    SUPABASE_ANON_KEY.startsWith("ey")
  )
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      )
    : null;


/* =========================================================
   PROFILE
   ---------------------------------------------------------
   今のDBには profiles.student_id が無い。
   role と name だけ取得する。
========================================================= */

async function getProfile() {

  if (!sb) {

    throw new Error(
      "Supabase設定がありません。"
    );

  }


  const {
    data: {
      user
    },
    error: userError
  } =
    await sb.auth.getUser();


  if (userError) {

    throw userError;

  }


  if (!user) {

    return null;

  }


  const {
    data,
    error
  } =
    await sb
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
      "先生",

    role:
      data?.role ||
      null,

    user

  };

}


/* =========================================================
   SESSION
========================================================= */

async function getSession() {

  if (!sb) {

    return null;

  }


  const {
    data,
    error
  } =
    await sb.auth.getSession();


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

  if (!sb) {

    return null;

  }


  const {
    data,
    error
  } =
    await sb.auth.getUser();


  if (error) {

    throw error;

  }


  return (
    data?.user ||
    null
  );

}


/* =========================================================
   ROLE
========================================================= */

window.requireRole =
  async function (
    role
  ) {

    if (!sb) {

      throw new Error(
        "Supabase設定がありません。"
      );

    }


    const {
      data: {
        user
      },
      error: userError
    } =
      await sb.auth.getUser();


    if (userError) {

      throw userError;

    }


    if (!user) {

      location.replace(
        "/login"
      );

      return null;

    }


    /*
     * student_id は絶対に取得しない。
     */

    const {
      data: profile,
      error: profileError
    } =
      await sb
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


    if (profileError) {

      throw new Error(
        `プロフィール取得エラー: ${profileError.message}`
      );

    }


    if (!profile) {

      throw new Error(
        "プロフィールが登録されていません。"
      );

    }


    const allowed =
      profile.role === role ||
      profile.role === "admin";


    if (!allowed) {

      if (
        profile.role ===
        "student"
      ) {

        location.replace(
          "/student.html"
        );

      } else {

        location.replace(
          "/login"
        );

      }


      return null;

    }


    return {

      user,

      profile

    };

  };


/* =========================================================
   LOGOUT
========================================================= */

window.signOut =
  async function () {

    if (sb) {

      await sb.auth.signOut();

    }


    location.replace(
      "/login"
    );

  };


window.logout =
  window.signOut;


/* =========================================================
   GLOBAL
========================================================= */

window.SB =
  sb;


window.supabaseClient =
  sb;


window.getProfile =
  getProfile;


window.getSession =
  getSession;


window.getCurrentUser =
  getCurrentUser;
