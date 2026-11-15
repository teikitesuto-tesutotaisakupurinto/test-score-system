
/* =========================================================
   テスト成績システム
   js/auth.js 完全版

   認証構成
   ---------------------------------------------------------
   Supabase Auth
        ↓
   auth.users.id
        ↓
   public.get_my_profile()
        ↓
   public.profiles
        ↓
   role
        ├─ teacher → /teacher/index.html
        ├─ admin   → /teacher/index.html
        └─ student → /student/tests/index.html

   生徒
        ↓
   students.auth_user_id
        ↓
   students.id
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Supabase Client
  ======================================================= */

  function getClient() {

    if (
      !window.supabaseClient
    ) {

      console.error(
        "supabaseClientが初期化されていません。"
      );

      return null;

    }

    return window.supabaseClient;

  }


  /* =======================================================
     Session
  ======================================================= */

  window.getSession = async function () {

    const client =
      getClient();


    if (!client) {

      return null;

    }


    const {
      data,
      error
    } =
      await client
        .auth
        .getSession();


    if (error) {

      console.error(
        "getSession:",
        error
      );

      return null;

    }


    return (
      data?.session ||
      null
    );

  };


  /* =======================================================
     Auth User
  ======================================================= */

  window.getAuthUser = async function () {

    const session =
      await window.getSession();


    if (!session) {

      return null;

    }


    return (
      session.user ||
      null
    );

  };


  /* =======================================================
     Profile
     
     RPC:
       public.get_my_profile()

     RPC内部:
       profiles.id = auth.uid()
  ======================================================= */

  window.getProfile = async function () {

    const user =
      await window.getAuthUser();


    if (!user) {

      return null;

    }


    const client =
      getClient();


    if (!client) {

      throw new Error(
        "Supabaseが初期化されていません。"
      );

    }


    const {
      data,
      error
    } =
      await client
        .rpc(
          "get_my_profile"
        );


    if (error) {

      console.error(
        "get_my_profile ERROR:",
        error
      );


      throw new Error(
        `ユーザー権限を取得できません。${error.message ? " " + error.message : ""}`
      );

    }


    /*
      RETURNS TABLEは配列で返る。
    */

    const profile =
      Array.isArray(data)
        ? data[0]
        : data;


    if (!profile) {

      console.error(
        "profilesが見つかりません。",
        {
          auth_user_id:
            user.id,

          email:
            user.email
        }
      );


      throw new Error(
        "ログインユーザーの権限情報がprofilesに登録されていません。"
      );

    }


    const role =
      String(
        profile.role ||
        ""
      )
        .toLowerCase()
        .trim();


    if (
      role !== "teacher" &&
      role !== "admin" &&
      role !== "student"
    ) {

      console.error(
        "未対応role:",
        profile.role
      );


      throw new Error(
        `未対応のユーザー権限です: ${profile.role}`
      );

    }


    return {

      id:
        profile.id,

      role,

      name:
        profile.name ||
        "",

      email:
        profile.email ||
        user.email ||
        "",

      auth_user_id:
        user.id

    };

  };


  /* =======================================================
     Student Profile
     
     students.auth_user_id
       =
     auth.users.id
  ======================================================= */

  window.getStudentProfile =
    async function () {

      const user =
        await window.getAuthUser();


      if (!user) {

        return null;

      }


      const client =
        getClient();


      if (!client) {

        throw new Error(
          "Supabaseが初期化されていません。"
        );

      }


      const {
        data,
        error
      } =
        await client
          .from(
            "students"
          )
          .select(`
            id,
            student_no,
            name,
            grade,
            class_name,
            class_id,
            auth_user_id,
            active,
            created_at,
            updated_at
          `)
          .eq(
            "auth_user_id",
            user.id
          )
          .maybeSingle();


      if (error) {

        console.error(
          "students取得エラー:",
          error
        );


        throw new Error(
          `生徒情報を取得できません。${error.message ? " " + error.message : ""}`
        );

      }


      return data || null;

    };


  /* =======================================================
     現在のRole
  ======================================================= */

  window.getCurrentRole =
    async function () {

      const profile =
        await window.getProfile();


      if (!profile) {

        return null;

      }


      return profile.role;

    };


  /* =======================================================
     認証必須
  ======================================================= */

  window.requireAuth =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          "/login"
        );

        return null;

      }


      return session;

    };


  /* =======================================================
     Teacher / Admin 必須
  ======================================================= */

  window.requireTeacher =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          "/login"
        );

        return null;

      }


      let profile;


      try {

        profile =
          await window.getProfile();

      } catch (error) {

        console.error(
          "requireTeacher:",
          error
        );


        window.location.replace(
          "/login"
        );

        return null;

      }


      if (!profile) {

        window.location.replace(
          "/login"
        );

        return null;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        window.location.replace(
          "/student/tests/index.html"
        );

        return null;

      }


      return profile;

    };


  /* =======================================================
     Student 必須
  ======================================================= */

  window.requireStudent =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          "/login"
        );

        return null;

      }


      let profile;


      try {

        profile =
          await window.getProfile();

      } catch (error) {

        console.error(
          "requireStudent:",
          error
        );


        window.location.replace(
          "/login"
        );

        return null;

      }


      if (!profile) {

        window.location.replace(
          "/login"
        );

        return null;

      }


      if (
        profile.role !== "student"
      ) {

        window.location.replace(
          "/teacher/index.html"
        );

        return null;

      }


      let student;


      try {

        student =
          await window.getStudentProfile();

      } catch (error) {

        console.error(
          "getStudentProfile:",
          error
        );


        alert(
          error.message ||
          "生徒情報を取得できません。"
        );


        return null;

      }


      if (!student) {

        console.error(
          "生徒マスター未紐付け:",
          session.user.id
        );


        alert(
          "このアカウントは生徒マスターに紐付いていません。"
        );


        return null;

      }


      if (
        student.active !== true
      ) {

        alert(
          "この生徒アカウントは現在利用できません。"
        );


        await window.logout();

        return null;

      }


      return {

        profile,

        student

      };

    };


  /* =======================================================
     Login
  ======================================================= */

  window.login =
    async function (
      email,
      password
    ) {

      const client =
        getClient();


      if (!client) {

        throw new Error(
          "Supabaseの設定を読み込めませんでした。"
        );

      }


      const cleanEmail =
        String(
          email ||
          ""
        )
          .trim();


      if (!cleanEmail) {

        throw new Error(
          "メールアドレスを入力してください。"
        );

      }


      if (!password) {

        throw new Error(
          "パスワードを入力してください。"
        );

      }


      const {
        data,
        error
      } =
        await client
          .auth
          .signInWithPassword({

            email:
              cleanEmail,

            password

          });


      if (error) {

        console.error(
          "signInWithPassword:",
          error
        );


        throw error;

      }


      if (
        !data?.session
      ) {

        throw new Error(
          "ログインセッションを取得できませんでした。"
        );

      }


      return data;

    };


  /* =======================================================
     Login後の遷移
  ======================================================= */

  window.redirectAfterLogin =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        throw new Error(
          "ログインセッションを取得できませんでした。"
        );

      }


      const profile =
        await window.getProfile();


      if (!profile) {

        throw new Error(
          "ユーザー権限を取得できません。"
        );

      }


      /* -----------------------------------------------
         Teacher
      ------------------------------------------------ */

      if (
        profile.role ===
        "teacher"
      ) {

        window.location.replace(
          "/teacher/index.html"
        );

        return;

      }


      /* -----------------------------------------------
         Admin
      ------------------------------------------------ */

      if (
        profile.role ===
        "admin"
      ) {

        window.location.replace(
          "/teacher/index.html"
        );

        return;

      }


      /* -----------------------------------------------
         Student
      ------------------------------------------------ */

      if (
        profile.role ===
        "student"
      ) {

        const student =
          await window.getStudentProfile();


        if (!student) {

          throw new Error(
            "生徒アカウントと生徒マスターが紐付いていません。"
          );

        }


        if (
          student.active !== true
        ) {

          throw new Error(
            "この生徒アカウントは現在利用できません。"
          );

        }


        window.location.replace(
          "/student/tests/index.html"
        );

        return;

      }


      throw new Error(
        "ユーザー権限が正しく設定されていません。"
      );

    };


  /* =======================================================
     Logout
  ======================================================= */

  window.logout =
    async function () {

      const client =
        getClient();


      if (!client) {

        window.location.replace(
          "/login"
        );

        return;

      }


      try {

        const {
          error
        } =
          await client
            .auth
            .signOut();


        if (error) {

          console.error(
            "signOut:",
            error
          );

        }

      } catch (error) {

        console.error(
          "logout exception:",
          error
        );

      }


      window.location.replace(
        "/login"
      );

    };


  /* =======================================================
     Auth State Change
  ======================================================= */

  const client =
    getClient();


  if (client) {

    client.auth
      .onAuthStateChange(
        (
          event
        ) => {

          /*
            ログアウト
          */

          if (
            event ===
            "SIGNED_OUT"
          ) {

            if (
              !window.location.pathname
                .startsWith(
                  "/login"
                )
            ) {

              window.location.replace(
                "/login"
              );

            }

          }

        }
      );

  }

})();
