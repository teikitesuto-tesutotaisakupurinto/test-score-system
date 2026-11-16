
"use strict";

/* =========================================================
   テスト作成
========================================================= */

let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeTestNew
);


async function initializeTestNew() {

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
        "testForm"
      )
      ?.addEventListener(
        "submit",
        createTest
      );


  } catch (error) {

    console.error(
      "test-new:",
      error
    );


    showMessage(
      error.message ||
      "テスト作成画面を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   CREATE
========================================================= */

async function createTest(
  event
) {

  event.preventDefault();


  const name =
    document
      .getElementById(
        "testName"
      )
      .value
      .trim();


  const subject =
    document
      .getElementById(
        "subject"
      )
      .value
      .trim();


  const grade =
    document
      .getElementById(
        "grade"
      )
      .value
      .trim();


  const className =
    document
      .getElementById(
        "className"
      )
      .value
      .trim();


  const testDate =
    document.getElementById(
      "testDate"
    ).value;


  const maxScore =
    Number(
      document
        .getElementById(
          "maxScore"
        )
        .value
    );


  const button =
    document.getElementById(
      "saveButton"
    );


  if (!name) {

    showMessage(
      "テスト名を入力してください。",
      true
    );

    return;

  }


  if (
    !Number.isFinite(
      maxScore
    ) ||
    maxScore < 0
  ) {

    showMessage(
      "満点を正しく入力してください。",
      true
    );

    return;

  }


  button.disabled =
    true;


  button.textContent =
    "作成中...";


  showMessage(
    ""
  );


  try {

    const {
      data,
      error
    } =
      await DB
        .from(
          "tests"
        )
        .insert({

          name,

          subject:
            subject ||
            null,

          grade:
            grade ||
            null,

          class_name:
            className ||
            null,

          test_date:
            testDate ||
            null,

          max_score:
            maxScore,

          status:
            "draft"

        })
        .select(
          `
          id,
          name
          `
        )
        .single();


    if (error) {

      throw error;

    }


    if (!data?.id) {

      throw new Error(
        "テストIDを取得できませんでした。"
      );

    }


    /*
     * テスト作成直後は
     * 解答用紙登録画面へ。
     *
     * 以降
     * ページ登録
     *   ↓
     * 枠設定
     *   ↓
     * 配点
     *   ↓
     * 採点
     */

    location.href =
      `/teacher/tests/pages?test=${encodeURIComponent(
        data.id
      )}`;


  } catch (error) {

    console.error(
      "create test:",
      error
    );


    showMessage(
      error.message ||
      "テスト作成に失敗しました。",
      true
    );


    button.disabled =
      false;


    button.textContent =
      "テストを作成";

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
