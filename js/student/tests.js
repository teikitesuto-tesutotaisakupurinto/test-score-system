
(function () {

  "use strict";


  let profile = null;


  async function initialize() {

    const session =
      await getSession();


    if (!session) {

      location.replace(
        "/login"
      );

      return;

    }


    profile =
      await getProfile();


    if (!profile) {

      location.replace(
        "/login"
      );

      return;

    }


    if (
      profile.role !==
      "student"
    ) {

      location.replace(
        "/teacher"
      );

      return;

    }


    document.getElementById(
      "studentName"
    ).textContent =
      profile.name ||
      "生徒";


    await loadTests();

  }


  async function loadTests() {

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
            ascending:false
          }
        );


    if (error) {

      console.error(
        error
      );


      document.getElementById(
        "testList"
      ).textContent =
        "テストを取得できませんでした。";


      return;

    }


    renderTests(
      data || []
    );

  }


  function renderTests(
    tests
  ) {

    const container =
      document.getElementById(
        "testList"
      );


    if (!tests.length) {

      container.innerHTML = `

        <div class="empty-state">

          公開されたテストはありません。

        </div>

      `;


      return;

    }


    container.innerHTML =
      tests
        .map(
          test => `

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

                教科：
                ${escapeHtml(
                  test.subject ||
                  "-"
                )}

                <br>

                学年：
                ${escapeHtml(
                  test.grade ||
                  "-"
                )}

                <br>

                満点：
                ${test.max_score ?? "-"}

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

          `
        )
        .join("");

  }


  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  function escapeHtml(
    value
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    return String(value)
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
