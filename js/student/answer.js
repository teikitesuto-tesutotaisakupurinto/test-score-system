
(function () {

  "use strict";


  const params =
    new URLSearchParams(
      location.search
    );


  const testId =
    params.get(
      "test"
    );


  let profile = null;

  let test = null;

  let answer = null;

  let pages = [];


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


    if (
      !profile ||
      profile.role !==
        "student"
    ) {

      location.replace(
        "/login"
      );

      return;

    }


    document.getElementById(
      "studentName"
    ).textContent =
      profile.name ||
      "生徒";


    if (!testId) {

      alert(
        "テストが指定されていません。"
      );


      location.replace(
        "/student/tests"
      );


      return;

    }


    await loadTest();

    await loadAnswer();

  }


  async function loadTest() {

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
          max_score,
          results_published
        `)
        .eq(
          "id",
          testId
        )
        .eq(
          "results_published",
          true
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      alert(
        "このテストは公開されていません。"
      );


      location.replace(
        "/student/tests"
      );


      return;

    }


    test =
      data;


    document.getElementById(
      "testName"
    ).textContent =
      test.name;

  }


  async function loadAnswer() {

    /*
      RLSにより
      現在ログインしている生徒の答案しか
      取得できない。
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          student_id,
          status,
          created_at
        `)
        .eq(
          "test_id",
          testId
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      document.getElementById(
        "answerPages"
      ).innerHTML = `

        <div class="empty-state">

          答案がありません。

        </div>

      `;


      return;

    }


    answer =
      data;


    const {
      data:
        pageData,
      error:
        pageError
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          page_no,
          file_path,
          original_name
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (pageError) {

      throw pageError;

    }


    pages =
      pageData || [];


    await renderPages();

  }


  async function renderPages() {

    const container =
      document.getElementById(
        "answerPages"
      );


    if (!pages.length) {

      container.innerHTML = `

        <div class="empty-state">

          答案ページがありません。

        </div>

      `;


      return;

    }


    container.innerHTML =
      "";


    for (
      const page
      of pages
    ) {

      const {
        data,
        error
      } =
        await supabaseClient
          .storage
          .from(
            "answer-files"
          )
          .createSignedUrl(
            page.file_path,
            3600
          );


      if (error) {

        console.error(
          error
        );


        continue;

      }


      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "student-answer-page";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "student-answer-page-title";


      title.textContent =
        `${page.page_no}ページ`;


      const image =
        document.createElement(
          "img"
        );


      image.src =
        data.signedUrl;


      image.alt =
        `答案 ${page.page_no}ページ`;


      image.loading =
        "lazy";


      wrapper.appendChild(
        title
      );


      wrapper.appendChild(
        image
      );


      container.appendChild(
        wrapper
      );

    }

  }


  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  initialize();

})();
