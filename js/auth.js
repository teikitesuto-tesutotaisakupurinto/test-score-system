
/* =========================================================
   テスト成績システム
   auth.js
   ログイン復旧版
========================================================= */

(function () {

  "use strict";


  /* =====================================================
     Session
  ===================================================== */

  window.getSession = async function () {

    if (
      typeof supabaseClient ===
      "undefined"
    ) {

      console.error(
        "supabaseClientがありません。"
      );

      return null;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (error) {

      console.error(
        "getSession:",
        error
      );


      return null;

    }


    return data?.session || null;

  };


  /* =====================================================
     Auth User
  ===================================================== */

  window.getAuthUser = async function () {

    const session =
      await getSession();


    return session?.user || null;

  };


  /* =====================================================
     Profile / User情報

     まず profiles
     ↓
     users
     ↓
     user_metadata

     の順で確認する。
========================================================= */

  window.getProfile = async function () {

    const user =
      await getAuthUser();


    if (!user) {

      return null;

    }


    /*
      profiles
    */

    try {

      const {
        data,
        error
      } =
        await supabaseClient
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


      if (
        !error &&
        data
      ) {

        return {

          id:
            data.id,

          role:
            data.role,

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

      }

    } catch (error) {

      console.warn(
        "profiles取得:",
        error
      );

    }


    /*
      users

      既存システムで
      id, role, name, email
      を持っている場合に対応。
    */

    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "users"
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


      if (
        !error &&
        data
      ) {

        return {

          id:
            data.id,

          role:
            data.role,

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

      }

    } catch (error) {

      console.warn(
        "users取得:",
        error
      );

    }


    /*
      user_metadata

      Auth User作成時に
      roleを入れている場合。
    */

    const metadata =
      user.user_metadata ||
      {};


    if (
      metadata.role
    ) {

      return {

        id:
          user.id,

        role:
          metadata.role,

        name:
          metadata.name ||
          metadata.full_name ||
          "",

        email:
          user.email ||
          "",

        auth_user_id:
          user.id

      };

    }


    /*
      Role不明
    */

    return null;

  };


  /* =====================================================
     生徒プロフィール
  ===================================================== */

  window.getStudentProfile =
    async function () {

      const user =
        await getAuthUser();


      if (!user) {

        return null;

      }


      const {
        data,
        error
      } =
        await supabaseClient
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
          "生徒情報取得:",
          error
        );


        return null;

      }


      return data || null;

    };


  /* =====================================================
     Login
  ===================================================== */

  window.login = async function (
    email,
    password
  ) {

    const cleanEmail =
      String(
        email || ""
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
      await supabaseClient
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


    return data;

  };


  /* =====================================================
     Role別遷移
  ===================================================== */

  window.redirectAfterLogin =
    async function () {

      const user =
        await getAuthUser();


      if (!user) {

        throw new Error(
          "ログイン情報を取得できませんでした。"
        );

      }


      const profile =
        await getProfile();


      if (!profile) {

        /*
          ここで勝手にsignOutしない。

          実際のDB構成を確認するため、
          セッションを残す。
        */

        console.error(
          "Role情報を取得できませんでした。",
          user
        );


        throw new Error(
          "ユーザー権限を取得できません。"
        );

      }


      const role =
        String(
          profile.role ||
          ""
        )
          .toLowerCase()
          .trim();


      /*
        teacher
      */

      if (
        role ===
        "teacher"
      ) {

        window.location.replace(
          "/teacher"
        );


        return;

      }


      /*
        admin
      */

      if (
        role ===
        "admin"
      ) {

        window.location.replace(
          "/teacher"
        );


        return;

      }


      /*
        student
      */

      if (
        role ===
        "student"
      ) {

        const student =
          await getStudentProfile();


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
        `未対応のユーザー権限です: ${profile.role}`
      );

    };


  /* =====================================================
     Teacher
  ===================================================== */

  window.requireTeacher =
    async function () {

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


      const role =
        String(
          profile.role ||
          ""
        )
          .toLowerCase()
          .trim();


      if (
        role !== "teacher" &&
        role !== "admin"
      ) {

        window.location.replace(
          "/student/tests"
        );


        return null;

      }


      return profile;

    };


  /* =====================================================
     Student
  ===================================================== */

  window.requireStudent =
    async function () {

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


      const role =
        String(
          profile.role ||
          ""
        )
          .toLowerCase()
          .trim();


      if (
        role !==
        "student"
      ) {

        window.location.replace(
          "/teacher"
        );


        return null;

      }


      const student =
        await getStudentProfile();


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


      return {

        profile,

        student

      };

    };


  /* =====================================================
     Logout
  ===================================================== */

  window.logout =
    async function () {

      try {

        await supabaseClient
          .auth
          .signOut();

      } catch (error) {

        console.error(
          "Logout:",
          error
        );

      }


      window.location.replace(
        "/login"
      );

    };


})();
