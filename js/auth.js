
/* =========================================================
   テスト成績システム
   共通認証 完全版

   Auth
      ↓
   profiles
      ↓
   role

   student
      ↓
   students.auth_user_id
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     Client
  ======================================================= */

  function client() {

    if (
      !window.supabaseClient
    ) {

      throw new Error(
        "Supabaseが初期化されていません。"
      );

    }


    return window.supabaseClient;

  }


  /* =======================================================
     Session
  ======================================================= */

  window.getSession =
    async function () {

      const {
        data,
        error
      } =
        await client()
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

  window.getAuthUser =
    async function () {

      const session =
        await window.getSession();


      return (
        session?.user ||
        null
      );

    };


  /* =======================================================
     Profile

     RPC:
       get_my_profile()

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


      const {
        data,
        error
      } =
        await client()
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
        RETURNS TABLE
        → 配列
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
        ![
          "teacher",
          "admin",
          "student"
        ].includes(
          role
        )
      ) {

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
     Student
  ======================================================= */

  window.getStudentProfile =
    async function () {

      const user =
        await window.getAuthUser();


      if (!user) {

        return null;

      }


      const {
        data,
        error
      } =
        await client()
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
          "students:",
          error
        );


        throw new Error(
          `生徒情報を取得できません。${error.message ? " " + error.message : ""}`
        );

      }


      return data || null;

    };


  /* =======================================================
     Login
  ======================================================= */

  window.login =
    async function (
      email,
      password
    ) {

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
        await client()
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
     Login後遷移
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
          student.active !==
          true
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
     Require Auth
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
     Require Teacher
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
     Require Student
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


      if (
        profile.role !==
        "student"
      ) {

        window.location.replace(
          "/teacher"
        );

        return null;

      }


      const student =
        await window.getStudentProfile();


      if (!student) {

        alert(
          "このアカウントは生徒マスターに紐付いていません。"
        );

        return null;

      }


      if (
        student.active !==
        true
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
     Logout
  ======================================================= */

  window.logout =
    async function () {

      try {

        await client()
          .auth
          .signOut();

      } catch (error) {

        console.error(
          "logout:",
          error
        );

      }


      window.location.replace(
        "/login"
      );

    };


  /* =======================================================
     Auth State Change

     自動遷移はlogin.jsに任せる。
     ここではSIGNED_OUTだけ処理。
  ======================================================= */

  if (
    window.supabaseClient
  ) {

    window.supabaseClient
      .auth
      .onAuthStateChange(
        (
          event
        ) => {

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
