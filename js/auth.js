
/* =========================================================
   テスト成績システム
   js/auth.js

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
       ├─ teacher → /teacher
       ├─ admin   → /teacher
       └─ student → /student/tests

   生徒
       ↓
   public.students.auth_user_id
       ↓
   public.students.id


   重要
   ---------------------------------------------------------
   ・public.users は使用しない
   ・profilesを直接SELECTしてrole判定しない
   ・get_my_profile() RPCを使用
   ・パスワードは保存しない
   ・student_idをURLから信用しない
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Supabase Client
  ======================================================= */

  function getClient() {

    if (
      typeof window.supabaseClient ===
      "undefined" ||
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
     Session取得
  ======================================================= */

  window.getSession =
    async function () {

      const client =
        getClient();


      if (!client) {

        return null;

      }


      const {
        data,
        error
      } =
        await client.auth.getSession();


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
     Auth User取得
  ======================================================= */

  window.getAuthUser =
    async function () {

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
     Profile取得
     
     RPC:
       public.get_my_profile()

     RPC内部:
       profiles.id = auth.uid()
  ======================================================= */

  window.getProfile =
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
          .rpc(
            "get_my_profile"
          );


      if (error) {

        console.error(
          "get_my_profile ERROR:",
          error
        );


        throw new Error(
          "ユーザー権限を取得できません。"
        );

      }


      /*
        RETURNS TABLEなので通常は配列。

        念のため単一オブジェクトにも対応。
      */

      let profile = null;


      if (
        Array.isArray(
          data
        )
      ) {

        profile =
          data.length > 0
            ? data[0]
            : null;

      } else {

        profile =
          data || null;

      }


      if (!profile) {

        console.error(
          "プロフィールがありません。",
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


      /*
        role正規化
      */

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
          "未対応のrole:",
          profile.role
        );


        throw new Error(
          "ユーザー権限が正しく設定されていません。"
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
     生徒プロフィール
     
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
            qr_token,
            active
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
          "生徒情報を取得できません。"
        );

      }


      return data || null;

    };


  /* =======================================================
     現在Role
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
          "Teacher認証:",
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
        profile.role !==
          "teacher" &&
        profile.role !==
          "admin"
      ) {

        window.location.replace(
          "/student/tests"
        );


        return null;

      }


      return profile;

    };


  /* =======================================================
     Student 必須
     
     1.
       profiles.role = student

     2.
       students.auth_user_id = auth.uid()

     3.
       students.active = true
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
          "Student Profile:",
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
        profile.role !==
        "student"
      ) {

        window.location.replace(
          "/teacher"
        );


        return null;

      }


      let student;


      try {

        student =
          await window.getStudentProfile();

      } catch (error) {

        console.error(
          "Student情報:",
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
          "students.auth_user_idが見つかりません。",
          {

            auth_user_id:
              session.user.id,

            profile_id:
              profile.id

          }
        );


        alert(
          "このアカウントは生徒マスターに紐付いていません。"
        );


        return null;

      }


      if (
        student.active ===
        false
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
          "Supabase Login:",
          error
        );


        throw error;

      }


      if (!data?.session) {

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


      /*
        Teacher
      */

      if (
        profile.role ===
        "teacher"
      ) {

        window.location.replace(
          "/teacher"
        );


        return;

      }


      /*
        Admin
      */

      if (
        profile.role ===
        "admin"
      ) {

        window.location.replace(
          "/teacher"
        );


        return;

      }


      /*
        Student
      */

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
          student.active ===
          false
        ) {

          throw new Error(
            "この生徒アカウントは現在利用できません。"
          );

        }


        window.location.replace(
          "/student/tests"
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
            "Logout:",
            error
          );

        }

      } catch (error) {

        console.error(
          "Logout exception:",
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
          event,
          session
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


            return;

          }


          /*
            Token refresh

            画面遷移しない。
          */

          if (
            event ===
            "TOKEN_REFRESHED"
          ) {

            return;

          }


          /*
            SIGNED_IN

            login.js側で
            redirectAfterLogin()
            を実行する。

            ここでは遷移しない。
          */

          if (
            event ===
            "SIGNED_IN"
          ) {

            return;

          }

        }
      );

  }

})();
