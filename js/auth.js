const supabaseClient = window.supabase.createClient(
  window.TEST_SCORE_CONFIG.supabaseUrl,
  window.TEST_SCORE_CONFIG.supabasePublishableKey
);


/*
  現在のログインセッション取得
*/
async function getSession() {

  const {
    data,
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    return null;
  }

  return data.session;
}


/*
  現在のユーザーのプロフィール取得
*/
async function getProfile() {

  const session = await getSession();

  if (!session) {
    return null;
  }

  const {
    data,
    error
  } = await supabaseClient
    .from("profiles")
    .select("id, role, name, email")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}


/*
  ログイン
*/
async function login(email, password) {

  const {
    data,
    error
  } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }

  return data;
}


/*
  ログアウト
*/
async function logout() {

  const {
    error
  } = await supabaseClient.auth.signOut();

  if (error) {
    console.error(error);
  }

  window.location.href = "/login";
}


/*
  ログイン画面
*/
const loginForm =
  document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async function(event) {

      event.preventDefault();

      const email =
        document.getElementById("email").value.trim();

      const password =
        document.getElementById("password").value;

      const button =
        document.getElementById("loginButton");

      const message =
        document.getElementById("loginMessage");


      message.textContent = "";

      button.disabled = true;
      button.textContent = "ログイン中...";


      try {

        await login(
          email,
          password
        );


        const profile =
          await getProfile();


        if (!profile) {

          throw new Error(
            "ユーザー情報が見つかりません。"
          );

        }


        /*
          roleによって移動先を分ける
        */

        if (
          profile.role === "teacher" ||
          profile.role === "admin"
        ) {

          window.location.href =
            "/teacher/dashboard";

          return;
        }


        if (
          profile.role === "student"
        ) {

          window.location.href =
            "/student/dashboard";

          return;
        }


        throw new Error(
          "ユーザー権限が設定されていません。"
        );


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "ログインに失敗しました。";

        button.disabled = false;
        button.textContent = "ログイン";

      }

    }
  );
}
