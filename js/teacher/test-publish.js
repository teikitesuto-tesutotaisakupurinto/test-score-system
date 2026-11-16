"use strict";

/* =========================================================
   テスト公開状態

   公開は手動では行わない。

   正式な流れ
   ---------------------------------------------------------
   採点完了
      ↓
   成績処理
      ↓
   全件確認
      ↓
   results_published = true
      ↓
   生徒へ自動公開

   この画面は現在の公開状態を確認するために使用。
========================================================= */

(function () {

  "use strict";


  let DB =
    null;

  let tests =
    [];

  let selectedTest =
    null;


  /* =====================================================
     DOM
  ===================================================== */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const statusElement =
    document.getElementById(
      "status"
    );


  /* =====================================================
     INIT
  ===================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

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


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          auth.profile?.name ||
          "先生";

      }


      setupEvents();


      await loadTests();


      const params =
        new URLSearchParams(
          location.search
        );


      const requested =
        params.get(
          "test"
        );


      if (
        requested &&
        tests.some(
          test =>
            test.id ===
            requested
        )
      ) {

        testSelect.value =
          requested;


        selectedTest =
          tests.find(
            test =>
              test.id ===
              requested
          );


        renderStatus();

      }

    } catch (error) {

      console.error(
        "test-publish:",
        error
      );


      showStatus(
        error.message ||
        "公開状態を取得できませんでした。",
        true
      );

    }

  }


  /* =====================================================
     EVENTS
  ===================================================== */

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

  }


  /* =====================================================
     TESTS
  ===================================================== */

  async function loadTests() {

    const {
      data,
      error
    } =
      await DB
        .from(
          "tests"
        )
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name,
          results_published,
          results_published_at,
          created_at
          `
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data ||
      [];


    if (!testSelect) {

      return;

    }


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


  /* =====================================================
     STATUS
  ===================================================== */

  function renderStatus() {

    if (!statusElement) {

      return;

    }


    if (!selectedTest) {

      statusElement.className =
        "status";


      statusElement.textContent =
        "テストを選択してください。";


      return;

    }


    if (
      selectedTest.results_published
    ) {

      statusElement.className =
        "status completed";


      statusElement.innerHTML = `

        <strong>
          結果確定・公開済み
        </strong>

        <br>

        公開日時：
        ${escapeHtml(
          formatDate(
            selectedTest.results_published_at
          )
        )}

      `;


      return;

    }


    statusElement.className =
      "status processing";


    statusElement.innerHTML = `

      <strong>
        未公開
      </strong>

      <br>

      採点・成績処理が完了するまで、
      生徒には結果を表示しません。

      <br><br>

      全採点が完了すると、
      成績処理画面で自動的に確定・公開されます。

    `;

  }


  /* =====================================================
     STATUS
  ===================================================== */

  function showStatus(
    message,
    error = false
  ) {

    if (!statusElement) {

      return;

    }


    statusElement.textContent =
      message;


    statusElement.className =
      error
        ? "status error"
        : "status";

  }


  /* =====================================================
     DATE
  ===================================================== */

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
      "ja-JP"
    );

  }


  /* =====================================================
     ESCAPE
  ===================================================== */

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


})();
