
/* =========================================================
   テスト成績システム
   共通認証
   js/auth.js 完全版

   DB構成
   ---------------------------------------------------------
   auth.users.id
        ↓
   public.profiles.id
        ↓
   profiles.role
        ↓
   teacher / admin / student

   student
        ↓
   public.students.auth_user_id
        ↓
   public.students.id


   ログイン
   ---------------------------------------------------------
   Supabase Auth
        ↓
   profiles
        ↓
   role判定
        ↓
   teacher/admin → /teacher
   student       → /student/tests


   セキュリティ
   ---------------------------------------------------------
   ・パスワードはこのファイルに保存しない
   ・Supabase Authを使用
   ・生徒IDをURLから信用しない
   ・students.auth_user_idで本人確認
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Supabase Client確認
  ======================================================= */

  function ensureSupabase() {

    if (
      typeof window.supabaseClient ===
      "undefined" ||
      !window.supabaseClient
    ) {

      console.error(
        "supabaseClientが初期化されていません。"
      );


      return false;

    }


    return true;

  }


  /* =======================================================
     Session取得
  ======================================================= */

  window.getSession =
    async function () {

      if (
        !ensureSupabase()
      ) {

        return null;

      }


      const {
        data,
        error
      } =
        await window.supabaseClient
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
     
     実際のDB:
     
     public.profiles
       id
       role
       name
       email
     
     profiles.id =
     auth.users.id
  ======================================================= */

  window.getProfile =
    async function () {

      const user =
        await window.getAuthUser();


      if (!user) {

        return null;

      }


      if (
        !ensureSupabase()
      ) {

        return null;

      }


      const {
        data,
        error
      } =
        await window.supabaseClient
          .from(
            "profiles"
          )
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
          "profiles取得エラー:",
          error
        );


        throw new Error(
          "ユーザー権限を取得できません。"
        );

      }


      if (!data) {

        console.error(
          "profilesにユーザーがありません:",
          user.id
        );


        throw new Error(
          "ログインユーザーの権限情報が登録されていません。"
        );

      }


      const role =
        String(
          data.role ||
          ""
        )
          .toLowerCase()
          .trim();


      if (
        ![
          "teacher",
          "admin",
          "student"
        ].includes(
          role
        )
      ) {

        console.error(
          "未対応role:",
          data.role
        );


        throw new Error(
          "ユーザー権限が正しく設定されていません。"
        );

      }


      return {

        id:
          data.id,

        role,

        name:
          data.name ||
          "",

        email:
          data.email ||
          user.email ||
          "",

        auth_user_id:
          user.id

      };

    };


  /* =======================================================
     Student Profile
     
     public.students
       auth_user_id
         =
       auth.uid()
  ======================================================= */

  window.getStudentProfile =
    async function () {

      const user =
        await window.getAuthUser();


      if (!user) {

        return null;

      }


      if (
        !ensureSupabase()
      ) {

        return null;

      }


      const {
        data,
        error
      } =
        await window.supabaseClient
          .from(
            "students"
          )
          .select(`
            id,
            student_no,
            name,
            active,
            auth_user_id
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


      if (!data) {

        return null;

      }


      return data;

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
     
     Roleだけではなく
     students.auth_user_idまで確認。
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
          "Student認証:",
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
          "students.auth_user_idに一致する生徒がありません。",
          session.user.id
        );


        alert(
          "このアカウントは生徒情報に紐付いていません。"
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

      if (
        !ensureSupabase()
      ) {

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
        await window.supabaseClient
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
     Login後のRole別遷移
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

      if (
        !ensureSupabase()
      ) {

        window.location.replace(
          "/login"
        );


        return;

      }


      const {
        error
      } =
        await window.supabaseClient
          .auth
          .signOut();


      if (error) {

        console.error(
          "Logout:",
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

  if (
    typeof window.supabaseClient !==
    "undefined"
  ) {

    window.supabaseClient.auth
      .onAuthStateChange(
        (
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
            TOKEN_REFRESHED

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
            redirectAfterLogin()を呼ぶので、
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
