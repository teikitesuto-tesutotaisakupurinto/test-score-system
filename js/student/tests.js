
/* =========================================================
   テスト成績システム
   生徒用 テスト一覧 完全版

   認証
   ---------------------------------------------------------
   Supabase Auth
        ↓
   requireStudent()
        ↓
   students.auth_user_id
        ↓
   自分の生徒ID確定

   表示
   ---------------------------------------------------------
   results_published = true
   のテストだけ表示

   生徒自身のstudent_idは
   URLやGETパラメータから取得しない。
========================================================= */


(function () {

  "use strict";


  /* =====================================================
     状態
  ===================================================== */

  let profile = null;

  let student = null;

  let tests = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    try {

      /*
        生徒認証

        role確認だけではなく、
        students.auth_user_idまで確認。
      */

      const auth =
        await requireStudent();


      if (!auth) {

        return;

      }


      profile =
        auth.profile;


      student =
        auth.student;


      /*
        生徒名
      */

      const studentName =
        document.getElementById(
          "studentName"
        );


      if (studentName) {

        studentName.textContent =
          student.name ||
          profile.name ||
          "生徒";

      }


      /*
        公開済みテスト取得
      */

      await loadTests();


    } catch (error) {

      console.error(
        "生徒テスト一覧:",
        error
      );


      showError(
        error.message ||
        "テスト一覧を取得できませんでした。"
      );

    }

  }


  /* =====================================================
     公開済みテスト
  ===================================================== */

  async function loadTests() {

    /*
      student_published_tests View

      results_published = true
      のみ。

      RLSでも
      student_published_tests_select
      が設定されている。
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "student_published_tests"
        )
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          max_score,
          results_published,
          results_published_at
        `)
        .order(
          "results_published_at",
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


    renderTests();

  }


  /* =====================================================
     テスト表示
  ===================================================== */

  function renderTests() {

    const container =
      document.getElementById(
        "testList"
      );


    if (!container) {

      return;

    }


    /*
      公開テストなし
    */

    if (!tests.length) {

      container.innerHTML = `

        <div
          class="empty-state"
        >

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
        .join("");

  }


  /* =====================================================
     テストカード
  ===================================================== */

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
            test.name
          )}

        </div>


        <div
          class="student-test-info"
        >

          ${
            test.subject

              ? `
                <div>
                  教科：
                  ${escapeHtml(
                    test.subject
                  )}
                </div>
              `

              : ""
          }


          ${
            test.grade

              ? `
                <div>
                  学年：
                  ${escapeHtml(
                    test.grade
                  )}
                </div>
              `

              : ""
          }


          ${
            test.class_name

              ? `
                <div>
                  クラス：
                  ${escapeHtml(
                    test.class_name
                  )}
                </div>
              `

              : ""
          }


          ${
            test.max_score !== null &&
            test.max_score !== undefined

              ? `
                <div>
                  満点：
                  ${test.max_score}点
                </div>
              `

              : ""
          }


          ${
            publishedAt

              ? `
                <div>
                  公開日：
                  ${escapeHtml(
                    publishedAt
                  )}
                </div>
              `

              : ""
          }

        </div>


        <div
          class="student-test-actions"
        >

          <a
            class="btn"
            href="/student/tests/answer?test=${encodeURIComponent(
              test.id
            )}"
          >
            採点前答案
          </a>


          <a
            class="btn btn-primary"
            href="/student/tests/result?test=${encodeURIComponent(
              test.id
            )}"
          >
            採点済み答案・成績
          </a>

        </div>

      </article>

    `;

  }


  /* =====================================================
     エラー
  ===================================================== */

  function showError(
    message
  ) {

    const container =
      document.getElementById(
        "testList"
      );


    if (!container) {

      alert(
        message
      );


      return;

    }


    container.innerHTML = `

      <div
        class="empty-state"
        style="
          color:#c62828;
        "
      >

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  /* =====================================================
     日付
  ===================================================== */

  function formatDate(
    value
  ) {

    if (!value) {

      return "";

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

      return "";

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


  /* =====================================================
     Logout
  ===================================================== */

  const logoutButton =
    document.getElementById(
      "logoutButton"
    );


  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async () => {

        await logout();

      }
    );

  }


  /* =====================================================
     HTML Escape
  ===================================================== */

  function escapeHtml(
    value
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    return String(
      value
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


  /* =====================================================
     START
  ===================================================== */

  initialize();

})();
