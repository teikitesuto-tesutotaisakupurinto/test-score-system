
/* =========================================================
   テスト成績システム
   js/auth.js 完全版

   役割
   ---------------------------------------------------------
   ・Supabaseセッション取得
   ・ログインユーザー取得
   ・プロフィール取得
   ・Teacher / Admin / Student判定
   ・ページアクセス制御
   ・ログイン後の自動振り分け
   ・確実なログアウト
   ・Clean URL管理

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
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     ROUTES
  ======================================================= */

  const APP_ROUTES = {

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


  /*
    他のJSから使用できるようにする
  */

  window.APP_ROUTES =
    APP_ROUTES;


  /* =======================================================
     SUPABASE
  ======================================================= */

  function getClient() {

    if (
      window.supabaseClient
    ) {

      return window.supabaseClient;

    }


    console.error(
      "supabaseClientが初期化されていません。"
    );


    return null;

  }


  /* =======================================================
     SESSION
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
     AUTH USER
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
     PROFILE
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
          "Supabaseの設定を読み込めませんでした。"
        );

      }


      /*
        public.get_my_profile()

        現在のログインユーザーから
        profilesを取得する。
      */

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


      /*
        RPCが
        配列 / 単一オブジェクト
        のどちらでも対応。
      */

      const profile =
        Array.isArray(data)
          ? data[0]
          : data;


      if (!profile) {

        throw new Error(
          "ログインユーザーのプロフィールが見つかりません。"
        );

      }


      const role =
        String(
          profile.role ||
          ""
        )
          .trim()
          .toLowerCase();


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
     STUDENT PROFILE
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
          "Supabaseの設定を読み込めませんでした。"
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
          "getStudentProfile:",
          error
        );


        throw new Error(
          "生徒情報を取得できません。"
        );

      }


      return data || null;

    };


  /* =======================================================
     CURRENT ROLE
  ======================================================= */

  window.getCurrentRole =
    async function () {

      const profile =
        await window.getProfile();


      return profile?.role ||
        null;

    };


  /* =======================================================
     REQUIRE AUTH
  ======================================================= */

  window.requireAuth =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          APP_ROUTES.login
        );


        return null;

      }


      return session;

    };


  /* =======================================================
     REQUIRE TEACHER
  ======================================================= */

  window.requireTeacher =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          APP_ROUTES.login
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


        await forceLocalLogout();


        return null;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        window.location.replace(
          APP_ROUTES.studentTests
        );


        return null;

      }


      return profile;

    };


  /* =======================================================
     REQUIRE STUDENT
  ======================================================= */

  window.requireStudent =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          APP_ROUTES.login
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


        await forceLocalLogout();


        return null;

      }


      if (
        profile.role !== "student"
      ) {

        window.location.replace(
          APP_ROUTES.teacher
        );


        return null;

      }


      let student;


      try {

        student =
          await window.getStudentProfile();

      } catch (error) {

        console.error(
          "requireStudent student:",
          error
        );


        return null;

      }


      if (!student) {

        alert(
          "このアカウントは生徒マスターに紐付いていません。"
        );


        await window.logout();


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
     LOGIN
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
        ).trim();


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
     REDIRECT AFTER LOGIN
  ======================================================= */

  window.redirectAfterLogin =
    async function () {

      const session =
        await window.getSession();


      if (!session) {

        window.location.replace(
          APP_ROUTES.login
        );


        return;

      }


      const profile =
        await window.getProfile();


      /*
        Teacher / Admin
      */

      if (
        profile.role === "teacher" ||
        profile.role === "admin"
      ) {

        window.location.replace(
          APP_ROUTES.teacher
        );


        return;

      }


      /*
        Student
      */

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
          APP_ROUTES.studentTests
        );


        return;

      }


      throw new Error(
        "ユーザー権限が正しく設定されていません。"
      );

    };


  /* =======================================================
     LOCAL AUTH CLEANUP
  ======================================================= */

  async function clearAuthStorage() {

    /*
      localStorage
    */

    try {

      const keys =
        [];


      for (
        let i = 0;
        i < localStorage.length;
        i++
      ) {

        const key =
          localStorage.key(
            i
          );


        if (!key) {
          continue;
        }


        /*
          Supabase v2の認証キー
          sb-xxxx-auth-token

          旧構成なども考慮。
        */

        if (
          key.includes(
            "auth-token"
          ) ||
          key.startsWith(
            "sb-"
          )
        ) {

          keys.push(
            key
          );

        }

      }


      for (
        const key
        of keys
      ) {

        try {

          localStorage.removeItem(
            key
          );

        } catch (_) {}

      }

    } catch (error) {

      console.error(
        "localStorage cleanup:",
        error
      );

    }


    /*
      sessionStorage
    */

    try {

      sessionStorage.clear();

    } catch (error) {

      console.error(
        "sessionStorage cleanup:",
        error
      );

    }

  }


  /* =======================================================
     FORCE LOCAL LOGOUT
  ======================================================= */

  async function forceLocalLogout() {

    await clearAuthStorage();


    window.location.replace(
      APP_ROUTES.login
    );

  }


  /* =======================================================
     LOGOUT
     
     重要
     -------------------------------------------------------
     1. Supabase signOut
     2. 認証Storage削除
     3. loginへreplace
  ======================================================= */

  window.logout =
    async function () {

      /*
        二重クリック防止
      */

      if (
        window.__LOGGING_OUT__
      ) {

        return;

      }


      window.__LOGGING_OUT__ =
        true;


      try {

        const client =
          getClient();


        if (client) {

          try {

            /*
              Supabaseセッションを破棄
            */

            const {
              error
            } =
              await client
                .auth
                .signOut();


            if (error) {

              console.error(
                "Supabase signOut:",
                error
              );

            }

          } catch (error) {

            console.error(
              "Supabase logout:",
              error
            );

          }

        }

      } finally {

        /*
          Supabase signOutが失敗しても
          ローカル認証情報を消す。
        */

        await clearAuthStorage();


        /*
          戻るボタンで保護ページへ
          戻りにくくする。
        */

        window.location.replace(
          APP_ROUTES.login
        );

      }

    };


  /* =======================================================
     URL PARAMETER
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
     REQUIRED URL PARAMETER
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
     CURRENT PATH
  ======================================================= */

  window.getCurrentPath =
    function () {

      return window.location.pathname;

    };


  /* =======================================================
     AUTH STATE LISTENER
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
            ログアウト済みなら
            ログイン画面へ。
          */

          if (
            event ===
            "SIGNED_OUT"
          ) {

            if (
              window.location.pathname !==
                APP_ROUTES.login &&
              !window.location.pathname
                .startsWith(
                  "/login"
                )
            ) {

              window.location.replace(
                APP_ROUTES.login
              );

            }

          }

        }
      );

  }


})();
