/* =========================================================
   テスト成績システム
   共通認証・権限管理
========================================================= */


/* =========================================================
   1. Supabaseクライアント
========================================================= */

if (
  !window.TEST_SCORE_CONFIG ||
  !window.TEST_SCORE_CONFIG.supabaseUrl ||
  !window.TEST_SCORE_CONFIG.supabasePublishableKey
) {

  console.error(
    "Supabaseの設定が見つかりません。"
  );

}


const supabaseClient =
  window.supabase.createClient(
    window.TEST_SCORE_CONFIG.supabaseUrl,
    window.TEST_SCORE_CONFIG.supabasePublishableKey
  );


/* =========================================================
   2. セッション取得
========================================================= */

async function getSession() {

  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();


  if (error) {

    console.error(
      "セッション取得エラー:",
      error
    );

    return null;

  }


  return data.session || null;

}


/* =========================================================
   3. 現在のログインユーザー
========================================================= */

async function getCurrentUser() {

  const session =
    await getSession();


  if (!session) {

    return null;

  }


  return session.user;

}


/* =========================================================
   4. profiles取得
========================================================= */

async function getProfile() {

  const user =
    await getCurrentUser();


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
        role,
        name,
        email
      `)
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


  if (error) {

    console.error(
      "プロフィール取得エラー:",
      error
    );

    return null;

  }


  return data || null;

}


/* =========================================================
   5. role取得
========================================================= */

async function getRole() {

  const profile =
    await getProfile();


  if (!profile) {

    return null;

  }


  return profile.role;

}


/* =========================================================
   6. ログイン済みか
========================================================= */

async function isLoggedIn() {

  const session =
    await getSession();


  return !!session;

}


/* =========================================================
   7. ログイン
========================================================= */

async function login(
  email,
  password
) {

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
   8. ログアウト
========================================================= */

async function logout() {

  try {

    const {
      error
    } =
      await supabaseClient.auth
        .signOut();


    if (error) {

      console.error(
        "ログアウトエラー:",
        error
      );

    }

  } finally {

    /*
      必ずログイン画面へ戻す
    */

    window.location.replace(
      "/login"
    );

  }

}


/* =========================================================
   9. role別ログイン後移動
========================================================= */

async function redirectByRole() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  if (
    profile.role ===
      "teacher" ||
    profile.role ===
      "admin"
  ) {

    window.location.replace(
      "/teacher/dashboard"
    );

    return profile;

  }


  if (
    profile.role ===
    "student"
  ) {

    window.location.replace(
      "/student/dashboard"
    );

    return profile;

  }


  /*
    role不正
  */

  await logout();

  return null;

}


/* =========================================================
   10. 先生権限チェック
========================================================= */

async function requireTeacher() {

  const session =
    await getSession();


  if (!session) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  if (
    profile.role !==
      "teacher" &&
    profile.role !==
      "admin"
  ) {

    /*
      生徒が先生URLへ入った場合
    */

    window.location.replace(
      "/student/dashboard"
    );

    return null;

  }


  return profile;

}


/* =========================================================
   11. 生徒権限チェック
========================================================= */

async function requireStudent() {

  const session =
    await getSession();


  if (!session) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  if (
    profile.role !==
    "student"
  ) {

    /*
      先生・管理者が
      生徒URLへ入った場合
    */

    window.location.replace(
      "/teacher/dashboard"
    );

    return null;

  }


  return profile;

}


/* =========================================================
   12. 管理者権限チェック
========================================================= */

async function requireAdmin() {

  const session =
    await getSession();


  if (!session) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return null;

  }


  if (
    profile.role !==
    "admin"
  ) {

    window.location.replace(
      "/teacher/dashboard"
    );

    return null;

  }


  return profile;

}


/* =========================================================
   13. ログイン画面専用
========================================================= */

async function redirectIfAlreadyLoggedIn() {

  const session =
    await getSession();


  if (!session) {

    return false;

  }


  const profile =
    await getProfile();


  if (!profile) {

    /*
      Authはあるが
      profilesがない場合は
      一度ログアウト
    */

    await supabaseClient.auth
      .signOut();

    return false;

  }


  if (
    profile.role ===
      "teacher" ||
    profile.role ===
      "admin"
  ) {

    window.location.replace(
      "/teacher/dashboard"
    );

    return true;

  }


  if (
    profile.role ===
    "student"
  ) {

    window.location.replace(
      "/student/dashboard"
    );

    return true;

  }


  return false;

}


/* =========================================================
   14. Auth状態変更監視
========================================================= */

supabaseClient.auth
  .onAuthStateChange(
    async (
      event,
      session
    ) => {

      /*
        SIGNED_OUT
      */

      if (
        event ===
        "SIGNED_OUT"
      ) {

        if (
          location.pathname !==
          "/login"
        ) {

          window.location.replace(
            "/login"
          );

        }

        return;

      }


      /*
        PASSWORD_RECOVERY
      */

      if (
        event ===
        "PASSWORD_RECOVERY"
      ) {

        /*
          将来パスワード変更画面を
          ここへ接続
        */

        return;

      }


      /*
        ログイン済みなら
        ページ側の処理に任せる
      */

      if (
        event ===
          "SIGNED_IN" &&
        session
      ) {

        return;

      }

    }
  );


/* =========================================================
   15. ログインフォーム
========================================================= */

const loginForm =
  document.getElementById(
    "loginForm"
  );


if (loginForm) {

  /*
    すでにログインしている場合
    login画面を表示しない
  */

  redirectIfAlreadyLoggedIn();


  loginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const email =
        document.getElementById(
          "email"
        ).value.trim();


      const password =
        document.getElementById(
          "password"
        ).value;


      const button =
        document.getElementById(
          "loginButton"
        );


      const message =
        document.getElementById(
          "loginMessage"
        );


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


        /*
          profiles.roleを確認して
          先生・生徒を分岐
        */

        const profile =
          await getProfile();


        if (!profile) {

          throw new Error(
            "ユーザー情報が見つかりません。"
          );

        }


        if (
          profile.role ===
            "teacher" ||
          profile.role ===
            "admin"
        ) {

          window.location.replace(
            "/teacher/dashboard"
          );

          return;

        }


        if (
          profile.role ===
          "student"
        ) {

          window.location.replace(
            "/student/dashboard"
          );

          return;

        }


        /*
          不正なrole
        */

        await supabaseClient.auth
          .signOut();


        throw new Error(
          "ユーザー権限が設定されていません。"
        );


      } catch (error) {

        console.error(
          "ログインエラー:",
          error
        );


        message.textContent =
          convertAuthError(
            error
          );


        button.disabled =
          false;


        button.textContent =
          "ログイン";

      }

    }
  );

}


/* =========================================================
   16. Authエラーメッセージ
========================================================= */

function convertAuthError(
  error
) {

  const message =
    error?.message || "";


  if (
    message.includes(
      "Invalid login credentials"
    )
  ) {

    return "メールアドレスまたはパスワードが正しくありません。";

  }


  if (
    message.includes(
      "Email not confirmed"
    )
  ) {

    return "メールアドレスの確認が完了していません。";

  }


  if (
    message.includes(
      "Too many requests"
    )
  ) {

    return "ログイン試行が多すぎます。しばらく待ってから再試行してください。";

  }


  return (
    message ||
    "ログインに失敗しました。"
  );

}


/* =========================================================
   17. HTMLエスケープ
========================================================= */

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   18. 生徒情報取得
========================================================= */

async function getCurrentStudent() {

  const profile =
    await getProfile();


  if (
    !profile ||
    profile.role !==
    "student"
  ) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("students")
      .select(`
        id,
        student_no,
        name,
        grade,
        class_name,
        class_id,
        active
      `)
      .eq(
        "auth_user_id",
        profile.id
      )
      .maybeSingle();


  if (error) {

    console.error(
      "生徒情報取得エラー:",
      error
    );

    return null;

  }


  return data || null;

}


/* =========================================================
   19. 現在の生徒ID
========================================================= */

async function getCurrentStudentId() {

  const student =
    await getCurrentStudent();


  return student?.id || null;

}


/* =========================================================
   20. URLのrole保護
========================================================= */

async function protectCurrentPage() {

  const path =
    location.pathname;


  /*
    ログイン画面
  */

  if (
    path ===
    "/login"
  ) {

    return;

  }


  /*
    先生URL
  */

  if (
    path.startsWith(
      "/teacher/"
    )
  ) {

    await requireTeacher();

    return;

  }


  /*
    生徒URL
  */

  if (
    path.startsWith(
      "/student/"
    )
  ) {

    await requireStudent();

    return;

  }

}


/* =========================================================
   21. セッション状態
========================================================= */

window.TEST_SCORE_AUTH = {

  supabase:
    supabaseClient,

  getSession,

  getCurrentUser,

  getProfile,

  getRole,

  getCurrentStudent,

  getCurrentStudentId,

  login,

  logout,

  requireTeacher,

  requireStudent,

  requireAdmin,

  redirectByRole

};
