
"use strict";

/* =========================================================
   生徒用 テスト一覧

   未確定
   ---------------------------------------------------------
   ・結果ボタンを表示しない
   ・採点済み答案を選択させない
   ・「処理中」と表示

   確定
   ---------------------------------------------------------
   ・点数を見る
   ・結果画面へ

   生徒自身のstudent_idは
   URLから取得しない。
========================================================= */

(function () {

  "use strict";


  let profile =
    null;

  let student =
    null;

  let tests =
    [];


  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  /* =====================================================
     INIT
  ===================================================== */

  async function initialize() {

    try {

      const auth =
        await requireStudent();


      if (!auth) {

        return;

      }


      profile =
        auth.profile;


      student =
        auth.student;


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


  /* =====================================================
     LOAD TESTS
  ===================================================== */

  async function loadTests() {

    /*
     * 全テストを取得。
     *
     * 公開済みだけではなく、
     * 生徒が受ける対象テストを表示する。
     *
     * 結果表示は
     * results_publishedで制御。
     */

    const {
      data,
      error
    } =
      await supabaseClient
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
          max_score,
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
      data || [];


    renderTests();

  }


  /* =====================================================
     RENDER
  ===================================================== */

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

          現在、テストはありません。

        </div>

      `;

      return;

    }


    container.innerHTML =
      tests
        .map(
          createTestCard
        )
        .join("");

  }


  /* =====================================================
     CARD
  ===================================================== */

  function createTestCard(
    test
  ) {

    const published =
      test.results_published ===
      true;


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
            test.max_score !==
              null &&
            test.max_score !==
              undefined
              ? `
                <div>
                  満点：
                  ${escapeHtml(
                    test.max_score
                  )}点
                </div>
              `
              : ""
          }


        </div>


        ${
          published
            ? `

              <div
                class="student-test-result-status"
                style="
                  margin-top:10px;
                  color:#16834b;
                  font-weight:700;
                "
              >

                結果確定

                ${
                  publishedAt
                    ? `
                      <br>
                      <span
                        style="
                          color:#777;
                          font-size:12px;
                          font-weight:400;
                        "
                      >
                        公開：
                        ${escapeHtml(
                          publishedAt
                        )}
                      </span>
                    `
                    : ""
                }

              </div>


              <div
                class="student-test-actions"
              >

                <a
                  class="btn btn-primary"
                  href="/student/tests/result?test=${encodeURIComponent(
                    test.id
                  )}"
                >
                  結果を見る
                </a>

              </div>

            `
            : `

              <div
                class="student-test-result-status"
                style="
                  margin-top:10px;
                  color:#777;
                "
              >

                採点・成績処理中

                <br>

                <span
                  style="
                    font-size:12px;
                  "
                >
                  結果確定後に点数を確認できます。
                </span>

              </div>

            `
        }


      </article>

    `;

  }


  /* =====================================================
     ERROR
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
     DATE
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


  /* =====================================================
     LOGOUT
  ===================================================== */

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


})();
