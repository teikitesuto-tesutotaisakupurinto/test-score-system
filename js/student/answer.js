
/* =========================================================
   テスト成績システム
   生徒用 採点前答案表示 完全版

   ・Supabase Auth確認
   ・student role確認
   ・students.auth_user_id確認
   ・公開済みテストのみ
   ・ログイン中本人の答案のみ
   ・answer-filesから元答案を表示

   URL:
   /student/tests/answer?test=TEST_ID

   student_idはURLから取得しない。
========================================================= */


(function () {

  "use strict";


  /* =====================================================
     URL
  ===================================================== */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


  /* =====================================================
     状態
  ===================================================== */

  let profile = null;

  let student = null;

  let test = null;

  let answer = null;

  let pages = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    try {

      /*
        生徒認証

        roleだけでなく、
        students.auth_user_idまで確認する。
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
        testパラメータ必須
      */

      if (!testId) {

        showError(
          "テストが指定されていません。"
        );


        return;

      }


      /*
        公開済みテスト確認
      */

      await loadTest();


      /*
        自分の答案取得
      */

      await loadAnswer();

    } catch (error) {

      console.error(
        "採点前答案:",
        error
      );


      showError(
        error.message ||
        "答案を表示できませんでした。"
      );

    }

  }


  /* =====================================================
     テスト取得
  ===================================================== */

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
          results_published,
          results_published_at
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


    /*
      公開されていない
      または存在しない
    */

    if (!data) {

      showError(
        "このテストは現在公開されていません。"
      );


      return;

    }


    test =
      data;


    renderTestInformation();

  }


  /* =====================================================
     テスト情報
  ===================================================== */

  function renderTestInformation() {

    const title =
      document.getElementById(
        "testName"
      );


    if (title) {

      title.textContent =
        test.name;

    }


    /*
      HTML側にtestMetaがある場合
    */

    const meta =
      document.getElementById(
        "testMeta"
      );


    if (meta) {

      meta.textContent =

        [

          test.subject
            ? `教科：${test.subject}`
            : "",

          test.grade
            ? `学年：${test.grade}`
            : "",

          test.class_name
            ? `クラス：${test.class_name}`
            : "",

          test.max_score !== null &&
          test.max_score !== undefined

            ? `満点：${test.max_score}点`
            : "",

          test.results_published_at
            ? `公開：${formatDate(
                test.results_published_at
              )}`
            : ""

        ]
          .filter(
            Boolean
          )
          .join(
            " ／ "
          );

    }

  }


  /* =====================================================
     自分の答案取得
  ===================================================== */

  async function loadAnswer() {

    /*
      URLのstudent_idは絶対に使わない。

      requireStudent()
        ↓
      student.id

      で本人を確定。
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
        .eq(
          "student_id",
          student.id
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      renderNoAnswer();

      return;

    }


    answer =
      data;


    /*
      答案ページ
    */

    await loadPages();


    /*
      表示
    */

    await renderPages();

  }


  /* =====================================================
     答案ページ取得
  ===================================================== */

  async function loadPages() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          answer_sheet_id,
          page_no,
          file_path,
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (error) {

      throw error;

    }


    pages =
      data || [];

  }


  /* =====================================================
     答案表示
  ===================================================== */

  async function renderPages() {

    const container =
      document.getElementById(
        "answerPages"
      );


    if (!container) {

      return;

    }


    container.innerHTML =
      "";


    if (!pages.length) {

      renderNoAnswer();

      return;

    }


    for (
      const page
      of pages
    ) {

      const wrapper =
        document.createElement(
          "section"
        );


      wrapper.className =
        "student-answer-page";


      /*
        ページ番号
      */

      const title =
        document.createElement(
          "div"
        );


      title.className =
        "student-answer-page-title";


      title.textContent =
        `答案 ${page.page_no}ページ`;


      wrapper.appendChild(
        title
      );


      /*
        画像取得
      */

      try {

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

          throw error;

        }


        if (
          !data?.signedUrl
        ) {

          throw new Error(
            "答案画像URLを取得できませんでした。"
          );

        }


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


        image.decoding =
          "async";


        wrapper.appendChild(
          image
        );


      } catch (error) {

        console.error(
          `答案ページ ${page.page_no}:`,
          error
        );


        const errorElement =
          document.createElement(
            "div"
          );


        errorElement.className =
          "empty-state";


        errorElement.style.color =
          "#c62828";


        errorElement.textContent =
          `${page.page_no}ページの答案を表示できませんでした。`;


        wrapper.appendChild(
          errorElement
        );

      }


      container.appendChild(
        wrapper
      );

    }

  }


  /* =====================================================
     答案なし
  ===================================================== */

  function renderNoAnswer() {

    const container =
      document.getElementById(
        "answerPages"
      );


    if (!container) {

      return;

    }


    container.innerHTML = `

      <div
        class="empty-state"
      >

        このテストの答案はありません。

      </div>

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
        "answerPages"
      );


    if (container) {

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

    } else {

      alert(
        message
      );

    }

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
