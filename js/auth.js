
"use strict";


/* =========================================================
   Supabase
========================================================= */

const supabaseClient =
  window.supabaseClient;


if (!supabaseClient) {

  console.error(
    "Supabase Clientが初期化されていません。"
  );

}


/* =========================================================
   Profile
========================================================= */

async function getProfile() {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data: {
      user
    },
    error: userError
  } =
    await supabaseClient.auth.getUser();


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
    await supabaseClient
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
   Session
========================================================= */

async function getSession() {

  if (!supabaseClient) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();


  if (error) {

    throw error;

  }


  return data?.session ||
    null;

}


/* =========================================================
   Current User
========================================================= */

async function getCurrentUser() {

  if (!supabaseClient) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient.auth.getUser();


  if (error) {

    throw error;

  }


  return data?.user ||
    null;

}


/* =========================================================
   Login
========================================================= */

async function login(
  email,
  password
) {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signInWithPassword({

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
   これを必ずwindowへ公開する。
========================================================= */

async function redirectAfterLogin() {

  const profile =
    await getProfile();


  if (!profile) {

    throw new Error(
      "プロフィールが見つかりません。"
    );

  }


  if (
    profile.role === "teacher" ||
    profile.role === "admin"
  ) {

    location.replace(
      "teacher.html"
    );

    return;

  }


  if (
    profile.role === "student"
  ) {

    location.replace(
      "student.html"
    );

    return;

  }


  throw new Error(
    "ユーザーの権限が設定されていません。"
  );

}


/* =========================================================
   goByRole
========================================================= */

async function goByRole() {

  await redirectAfterLogin();

}


/* =========================================================
   Require Role
========================================================= */

async function requireRole(
  requiredRole
) {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseの設定を読み込めませんでした。"
    );

  }


  const user =
    await getCurrentUser();


  if (!user) {

    location.replace(
      "login.html"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (!profile) {

    location.replace(
      "login.html"
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

      location.replace(
        "login.html"
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

      location.replace(
        "login.html"
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

      location.replace(
        "login.html"
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
   Logout
========================================================= */

async function signOut() {

  if (
    supabaseClient
  ) {

    try {

      await supabaseClient.auth.signOut();

    } catch (error) {

      console.error(
        error
      );

    }

  }


  location.replace(
    "login.html"
  );

}


async function logout() {

  await signOut();

}


/* =========================================================
   Global
========================================================= */

window.SB =
  supabaseClient;


window.supabaseClient =
  supabaseClient;


window.getProfile =
  getProfile;


window.getSession =
  getSession;


window.getCurrentUser =
  getCurrentUser;


window.login =
  login;


window.goByRole =
  goByRole;


window.redirectAfterLogin =
  redirectAfterLogin;


window.requireRole =
  requireRole;


window.signOut =
  signOut;


window.logout =
  logout;


/* =========================================================
   Login Page
========================================================= */

if (
  location.pathname.endsWith(
    "/login.html"
  ) ||
  location.pathname ===
    "/login"
) {

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      const button =
        document.getElementById(
          "loginBtn"
        );


      if (!button) {

        return;

      }


      button.onclick =
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
            emailElement
              ?.value
              .trim() ||
            "";


          const password =
            passwordElement
              ?.value ||
            "";


          if (!email) {

            message.textContent =
              "メールアドレスを入力してください。";

            return;

          }


          if (!password) {

            message.textContent =
              "パスワードを入力してください。";

            return;

          }


          button.disabled =
            true;


          button.textContent =
            "ログイン中...";


          message.textContent =
            "";


          try {

            await login(
              email,
              password
            );


            await redirectAfterLogin();


          } catch (error) {

            console.error(
              "LOGIN:",
              error
            );


            message.textContent =
              error.message ||
              "ログインできませんでした。";


            button.disabled =
              false;


            button.textContent =
              "ログイン";

          }

        };


      /*
       * 既にログイン済みなら
       * ロールに応じて移動。
       */

      getCurrentUser()
        .then(
          user => {

            if (!user) {

              return;

            }


            redirectAfterLogin()
              .catch(
                error => {

                  console.warn(
                    error
                  );

                }
              );

          }
        )
        .catch(
          error => {

            console.warn(
              error
            );

          }
        );

    }
  );

}
