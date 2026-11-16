
"use strict";

/* =========================================================
   クラス作成
========================================================= */

let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeClassNew
);


async function initializeClassNew() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


  } catch (error) {

    console.error(
      "class-new:",
      error
    );


    showMessage(
      error.message ||
      "クラス作成画面を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        await logout();

      }
    );


  document
    .getElementById(
      "classForm"
    )
    ?.addEventListener(
      "submit",
      createClass
    );

}


/* =========================================================
   CREATE
========================================================= */

async function createClass(
  event
) {

  event.preventDefault();


  const grade =
    document
      .getElementById(
        "grade"
      )
      .value
      .trim();


  const name =
    document
      .getElementById(
        "className"
      )
      .value
      .trim();


  if (!grade) {

    showMessage(
      "学年を入力してください。",
      true
    );

    return;

  }


  if (!name) {

    showMessage(
      "クラス名を入力してください。",
      true
    );

    return;

  }


  const button =
    document.getElementById(
      "saveButton"
    );


  button.disabled =
    true;


  button.textContent =
    "作成中...";


  showMessage(
    ""
  );


  try {

    /*
     * 作成前に同一学年・クラス名を確認。
     */

    const {
      data:
        existing,
      error:
        findError
    } =
      await DB
        .from(
          "classes"
        )
        .select(
          "id"
        )
        .eq(
          "grade",
          grade
        )
        .eq(
          "name",
          name
        )
        .maybeSingle();


    if (findError) {

      throw findError;

    }


    if (existing) {

      throw new Error(
        "同じ学年・クラス名のクラスが既に登録されています。"
      );

    }


    const {
      data,
      error
    } =
      await DB
        .from(
          "classes"
        )
        .insert({

          grade,

          name

        })
        .select(
          "id"
        )
        .single();


    if (error) {

      /*
       * DB側のunique制約にも対応。
       */

      if (
        error.code ===
        "23505"
      ) {

        throw new Error(
          "同じ学年・クラス名のクラスが既に登録されています。"
        );

      }


      throw error;

    }


    if (!data?.id) {

      throw new Error(
        "クラスIDを取得できませんでした。"
      );

    }


    showMessage(
      "クラスを作成しました。",
      false
    );


    /*
     * 少しだけ成功表示してから一覧へ。
     */

    setTimeout(
      () => {

        location.href =
          "/teacher/classes";

      },
      300
    );


  } catch (error) {

    console.error(
      "create class:",
      error
    );


    showMessage(
      error.message ||
      "クラス作成に失敗しました。",
      true
    );


    button.disabled =
      false;


    button.textContent =
      "作成する";

  }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  error = false
) {

  const element =
    document.getElementById(
      "message"
    );


  if (!element) {

    return;

  }


  element.textContent =
    text;


  element.style.color =
    error
      ? "#b42318"
      : "#16834b";

}
