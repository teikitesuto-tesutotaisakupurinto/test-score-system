
/* =========================================================
   テスト成績システム
   成績・答案 公開 / 非公開
   js/teacher/test-publish.js

   仕様
   ---------------------------------------------------------
   非公開
      ↓
   生徒には非公開

   公開
      ↓
   results_published = true
   results_published_at = 現在日時

   非公開へ戻す
      ↓
   results_published = false
   results_published_at = null

   公開・非公開は先生Web画面から操作する。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let tests = [];

  let selectedTest = null;


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const statusElement =
    document.getElementById(
      "status"
    );


  const publishButton =
    document.getElementById(
      "publishButton"
    );


  const unpublishButton =
    document.getElementById(
      "unpublishButton"
    );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {

        return;

      }


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      setupEvents();

      await loadTests();


    } catch (error) {

      console.error(
        "test-publish initialize:",
        error
      );


      showStatus(
        error.message ||
        "公開設定画面を読み込めませんでした。",
        "error"
      );

    }

  }


  /* =======================================================
     TESTS
  ======================================================= */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(`
          id,
          name,
          results_published,
          results_published_at,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data || [];


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        tests
          .map(
            test => `

              <option
                value="${escapeHtml(
                  test.id
                )}"
              >

                ${escapeHtml(
                  test.name
                )}

              </option>

            `
          )
          .join("")
      }

    `;


    selectedTest =
      null;


    renderStatus();

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect.addEventListener(
      "change",
      () => {

        selectedTest =
          tests.find(
            test =>
              test.id ===
              testSelect.value
          ) ||
          null;


        renderStatus();

      }
    );


    publishButton.addEventListener(
      "click",
      publishTest
    );


    unpublishButton.addEventListener(
      "click",
      unpublishTest
    );


    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        logout
      );

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function renderStatus() {

    if (!selectedTest) {

      statusElement.className =
        "publish-status";


      statusElement.textContent =
        "テストを選択してください。";


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        true;


      return;

    }


    if (
      selectedTest.results_published ===
      true
    ) {

      statusElement.className =
        "publish-status public";


      statusElement.innerHTML = `

        <strong>
          公開中
        </strong>

        <br>

        公開日時：
        ${escapeHtml(
          formatDate(
            selectedTest.results_published_at
          )
        )}

      `;


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        false;


      return;

    }


    statusElement.className =
      "publish-status private";


    statusElement.innerHTML = `

      <strong>
        非公開
      </strong>

      <br>

      生徒には成績・答案を公開していません。

    `;


    publishButton.disabled =
      false;


    unpublishButton.disabled =
      true;

  }


  /* =======================================================
     PUBLISH
  ======================================================= */

  async function publishTest() {

    if (!selectedTest) {

      return;

    }


    const confirmed =
      window.confirm(
        `「${selectedTest.name}」の成績・答案を公開しますか？`
      );


    if (!confirmed) {

      return;

    }


    setButtonsDisabled(
      true
    );


    try {

      const publishedAt =
        new Date()
          .toISOString();


      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "tests"
          )
          .update({

            results_published:
              true,

            results_published_at:
              publishedAt

          })
          .eq(
            "id",
            selectedTest.id
          )
          .select(`
            id,
            name,
            results_published,
            results_published_at,
            created_at
          `)
          .single();


      if (error) {

        throw error;

      }


      selectedTest =
        data;


      tests =
        tests.map(
          test =>
            test.id ===
            data.id
              ? data
              : test
        );


      renderStatus();


    } catch (error) {

      console.error(
        "publish:",
        error
      );


      showStatus(
        error.message ||
        "公開に失敗しました。",
        "error"
      );


    } finally {

      setButtonsDisabled(
        false
      );


      /*
        現在状態を再反映。
      */

      renderStatus();

    }

  }


  /* =======================================================
     UNPUBLISH
  ======================================================= */

  async function unpublishTest() {

    if (!selectedTest) {

      return;

    }


    const confirmed =
      window.confirm(
        `「${selectedTest.name}」を非公開に戻しますか？`
      );


    if (!confirmed) {

      return;

    }


    setButtonsDisabled(
      true
    );


    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "tests"
          )
          .update({

            results_published:
              false,

            results_published_at:
              null

          })
          .eq(
            "id",
            selectedTest.id
          )
          .select(`
            id,
            name,
            results_published,
            results_published_at,
            created_at
          `)
          .single();


      if (error) {

        throw error;

      }


      selectedTest =
        data;


      tests =
        tests.map(
          test =>
            test.id ===
            data.id
              ? data
              : test
        );


      renderStatus();


    } catch (error) {

      console.error(
        "unpublish:",
        error
      );


      showStatus(
        error.message ||
        "非公開への変更に失敗しました。",
        "error"
      );


    } finally {

      setButtonsDisabled(
        false
      );


      renderStatus();

    }

  }


  /* =======================================================
     BUTTON STATE
  ======================================================= */

  function setButtonsDisabled(
    disabled
  ) {

    publishButton.disabled =
      disabled ||
      !selectedTest ||
      selectedTest.results_published ===
        true;


    unpublishButton.disabled =
      disabled ||
      !selectedTest ||
      selectedTest.results_published !==
        true;

  }


  /* =======================================================
     STATUS MESSAGE
  ======================================================= */

  function showStatus(
    message,
    type
  ) {

    statusElement.className =
      "publish-status";


    if (
      type ===
      "error"
    ) {

      statusElement.classList.add(
        "private"
      );

    }


    statusElement.textContent =
      message;

  }


  /* =======================================================
     DATE
  ======================================================= */

  function formatDate(
    value
  ) {

    if (!value) {

      return "-";

    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "-";

    }


    return date.toLocaleString(
      "ja-JP",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"

      }
    );

  }


  /* =======================================================
     ESCAPE
  ======================================================= */

  function escapeHtml(
    value
  ) {

    return String(
      value ??
      ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
