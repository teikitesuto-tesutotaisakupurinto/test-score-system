
/* =========================================================
   テスト成績システム
   js/auth.js 完全版

   URLはすべてClean URLを使用。

   実ファイル
   ---------------------------------------------------------
   /login.html
   /teacher/index.html
   /teacher/tests/index.html
   /teacher/tests/edit.html
   /teacher/tests/pages.html
   /teacher/tests/publish.html
   /teacher/answers/upload.html
   /teacher/answers/matched.html
   /teacher/answers/regions.html
   /teacher/marking/index.html
   /teacher/marking/mark.html
   /teacher/results/summary.html
   /student/tests/index.html
   /student/answer.html

   URL
   ---------------------------------------------------------
   /login
   /teacher
   /teacher/tests
   /teacher/tests/edit?id=UUID
   /teacher/tests/pages?test=UUID
   /teacher/tests/publish?test=UUID
   /teacher/answers/upload
   /teacher/answers/matched
   /teacher/answers/regions
   /teacher/marking
   /teacher/marking/mark?answer=UUID
   /teacher/results/summary
   /student/tests
   /student/answer


   認証
   ---------------------------------------------------------
   Supabase Auth
       ↓
   get_my_profile()
       ↓
   profiles
       ↓
   role

   teacher/admin
       ↓
   /teacher

   student
       ↓
   students.auth_user_id
       ↓
   /student/tests
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     ROUTES
  ======================================================= */

  window.APP_ROUTES = {

    login:
      "/login",

    teacher:
      "/teacher",

    teacherTests:
      "/teacher/tests",

    teacherTestEdit:
      "/teacher/tests/edit",

    teacherTestPages:
      "/teacher/tests/pages",

    teacherTestPublish:
      "/teacher/tests/publish",

    teacherAnswersUpload:
      "/teacher/answers/upload",

    teacherAnswersMatched:
      "/teacher/answers/matched",

    teacherAnswersRegions:
      "/teacher/answers/regions",

    teacherMarking:
      "/teacher/marking",

    teacherMark:
      "/teacher/marking/mark",

    teacherResults:
      "/teacher/results/summary",

    studentTests:
      "/student/tests",

    studentAnswer:
      "/student/answer"

  };


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
     Profile
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
          "get_my_profile:",
          error
        );


        throw new Error(
          "ユーザー権限を取得できません。"
        );

      }


      const profile =
        Array.isArray(data)
          ? data[0]
          : data;


      if (!profile) {

        throw new Error(
          "ログインユーザーの権限情報が登録されていません。"
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
     Student
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
          .from("students")
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
          "生徒情報を取得できません。"
        );

      }


      return data || null;

    };


  /* =======================================================
     Current Role
  ======================================================= */

  window.getCurrentRole =
    async function () {

      const profile =
        await window.getProfile();


      return profile?.role ||
        null;

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
          window.APP_ROUTES.login
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
          window.APP_ROUTES.login
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
          window.APP_ROUTES.login
        );

        return null;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        window.location.replace(
          window.APP_ROUTES.studentTests
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
          window.APP_ROUTES.login
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
          window.APP_ROUTES.login
        );

        return null;

      }


      if (
        profile.role !== "student"
      ) {

        window.location.replace(
          window.APP_ROUTES.teacher
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
          email || ""
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


      if (
        profile.role === "teacher" ||
        profile.role === "admin"
      ) {

        window.location.replace(
          window.APP_ROUTES.teacher
        );

        return;

      }


      if (
        profile.role === "student"
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
          window.APP_ROUTES.studentTests
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


      if (client) {

        try {

          await client
            .auth
            .signOut();

        } catch (error) {

          console.error(
            "logout:",
            error
          );

        }

      }


      window.location.replace(
        window.APP_ROUTES.login
      );

    };


  /* =======================================================
     URL Helper
  ======================================================= */

  window.getUrlParam =
    function (
      name
    ) {

      const params =
        new URLSearchParams(
          window.location.search
        );


      return params.get(
        name
      );

    };


  /* =======================================================
     Require URL Parameter
  ======================================================= */

  window.requireUrlParam =
    function (
      name
    ) {

      const value =
        window.getUrlParam(
          name
        );


      if (!value) {

        throw new Error(
          `URLパラメータ「${name}」がありません。`
        );

      }


      return value;

    };


  /* =======================================================
     Auth State
  ======================================================= */

  const client =
    getClient();


  if (client) {

    client.auth
      .onAuthStateChange(
        event => {

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
                window.APP_ROUTES.login
              );

            }

          }

        }
      );

  }

})();
