
"use strict";

/* =========================================================
   生徒用テスト一覧

   公開済みテスト
   ---------------------------------------------------------
   results_published = true

   未公開テスト
   ---------------------------------------------------------
   一覧には出さない。

   生徒本人
   ---------------------------------------------------------
   requireStudent()で確定したstudentのみ使用。
========================================================= */


(function () {

  let student = null;

  let tests = [];


  /* =======================================================
     INIT
  ======================================================= */

  async function initialize() {

    try {

      const auth =
        await requireStudent();


      if (!auth) {

        return;

      }


      student =
        auth.student;


      const studentName =
        document.getElementById(
          "studentName"
        );


      if (studentName) {

        studentName.textContent =
          student.name ||
          auth.profile?.name ||
          "生徒";

      }


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
          "refreshButton"
        )
        ?.addEventListener(
          "click",
          loadTests
        );


      await loadTests();


    } catch (error) {

      console.error(
        "student tests:",
        error
      );


      showError(
        error.message ||
        "テスト一覧を取得できませんでした。"
      );

    }

  }


  /* =======================================================
     LOAD
  ======================================================= */

  async function loadTests() {

    const container =
      document.getElementById(
        "testList"
      );


    if (container) {

      container.innerHTML = `

        <div class="empty-state">
          読み込んでいます...
        </div>

      `;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "student_published_tests"
        )
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name,
          max_score,
          results_published,
          results_published_at
          `
        )
        .eq(
          "results_published",
          true
        )
        .order(
          "results_published_at",
          {
            ascending:false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data || [];


    renderTests();

  }


  /* =======================================================
     RENDER
  ======================================================= */

  function renderTests() {

    const container =
      document.getElementById(
        "testList"
      );


    if (!container) {

      return;

    }


    if (!tests.length) {

      container.innerHTML = `

        <div class="empty-state">

          現在、公開されているテストはありません。

        </div>

      `;

      return;

    }


    container.innerHTML =
      tests
        .map(
          test =>
            createTestCard(
              test
            )
        )
        .join(
          ""
        );

  }


  /* =======================================================
     CARD
  ======================================================= */

  function createTestCard(
    test
  ) {

    const publishedAt =
      test.results_published_at
        ? formatDate(
            test.results_published_at
          )
        : "";


    return `

      <article
        class="student-test-card"
      >

        <div
          class="student-test-title"
        >

          ${escapeHtml(
            test.name ||
            ""
          )}

        </div>


        <div
          class="student-test-meta"
        >

          ${escapeHtml(
            [
              test.subject,
              test.grade,
              test.class_name
            ]
              .filter(Boolean)
              .join(
                " / "
              )
          )}

        </div>


        <div
          style="
            margin-top:8px;
            color:#666;
            font-size:12px;
          "
        >

          公開：
          ${escapeHtml(
            publishedAt
          )}

        </div>


        <div
          style="
            display:flex;
            gap:7px;
            flex-wrap:wrap;
            margin-top:12px;
          "
        >

          <a
            href="/student/tests/result.html?test=${encodeURIComponent(
              test.id
            )}"
            class="btn btn-primary"
          >
            成績を見る
          </a>


          <a
            href="/student/tests/answer.html?test=${encodeURIComponent(
              test.id
            )}"
            class="btn"
          >
            採点済み答案を見る
          </a>

        </div>

      </article>

    `;

  }


  /* =======================================================
     ERROR
  ======================================================= */

  function showError(
    message
  ) {

    const container =
      document.getElementById(
        "testList"
      );


    if (!container) {

      return;

    }


    container.innerHTML = `

      <div
        class="empty-state"
        style="color:#b42318;"
      >

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  /* =======================================================
     DATE
  ======================================================= */

  function formatDate(
    value
  ) {

    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "";

    }


    return date.toLocaleString(
      "ja-JP"
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


  initialize();

})();
