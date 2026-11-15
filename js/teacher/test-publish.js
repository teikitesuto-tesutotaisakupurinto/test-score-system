
/* =========================================================
   テスト成績システム
   js/teacher/test-publish.js

   成績・答案 公開 / 非公開

   URL
   ---------------------------------------------------------
   /teacher/tests/publish?test=UUID

   公開
   ---------------------------------------------------------
   results_published = true
   results_published_at = 現在日時

   非公開
   ---------------------------------------------------------
   results_published = false
   results_published_at = null

   重要
   ---------------------------------------------------------
   公開・非公開はWeb上から操作可能。

   Teacher / Adminのみ操作可能。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let profile = null;

  let tests = [];

  let selectedTest = null;

  let initialTestId = null;


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

      profile =
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


      /*
        /teacher/tests/publish?test=UUID
      */

      initialTestId =
        window.__INITIAL_TEST_ID__ ||
        new URLSearchParams(
          window.location.search
        ).get("test") ||
        null;


      setupEvents();

      await loadTests();


      /*
        URLのtestを初期選択
      */

      if (initialTestId) {

        const exists =
          tests.some(
            test =>
              test.id ===
              initialTestId
          );


        if (exists) {

          testSelect.value =
            initialTestId;


          selectedTest =
            tests.find(
              test =>
                test.id ===
                initialTestId
            ) ||
            null;


          renderStatus();

        } else {

          showStatus(
            "指定されたテストが見つかりません。",
            "error"
          );

        }

      } else {

        renderStatus();

      }

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
     LOAD TESTS
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
          subject,
          grade,
          class_name,
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

                ${
                  test.subject
                    ? ` / ${escapeHtml(
                        test.subject
                      )}`
                    : ""
                }

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
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


    publishButton?.addEventListener(
      "click",
      publishTest
    );


    unpublishButton?.addEventListener(
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
        "status";


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
        "status public";


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
      "status private";


    statusElement.innerHTML = `

      <strong>
        非公開
      </strong>

      <br>

      現在、生徒には公開されていません。

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


    /*
      最終確認
    */

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
            subject,
            grade,
            class_name,
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


      /*
        URLにもテストIDを残す。

        /teacher/tests/publish?test=UUID
      */

      history.replaceState(
        null,
        "",
        `/teacher/tests/publish?test=${encodeURIComponent(
          data.id
        )}`
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
            subject,
            grade,
            class_name,
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

      renderStatus();

    }

  }


  /* =======================================================
     BUTTONS
  ======================================================= */

  function setButtonsDisabled(
    disabled
  ) {

    if (!selectedTest) {

      publishButton.disabled =
        true;

      unpublishButton.disabled =
        true;

      return;

    }


    publishButton.disabled =
      disabled ||
      selectedTest.results_published ===
        true;


    unpublishButton.disabled =
      disabled ||
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
      "status";


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
      value ?? ""
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
