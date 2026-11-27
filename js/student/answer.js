
"use strict";

/* =========================================================
   生徒用 未採点答案表示

   仕様
   ---------------------------------------------------------
   ・自分自身の答案だけ
   ・student_idはURLから取得しない
   ・採点済み記号を表示しない
   ・scoresを表示しない
   ・mark_objectsを表示しない
   ・元答案のみ表示
   ・results_published=trueになった後は
     「採点済み答案を見る」側へ誘導可能

   注意
   ---------------------------------------------------------
   この画面では採点結果を絶対に表示しない。
========================================================= */


(function () {

  let student = null;

  let test = null;

  let answer = null;

  let pages = [];


  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


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


      document.getElementById(
        "studentName"
      ).textContent =
        student.name ||
        auth.profile?.name ||
        "生徒";


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


      if (!testId) {

        showError(
          "テストが指定されていません。"
        );

        return;

      }


      const available =
        await loadTest();


      if (!available) {

        return;

      }


      await loadAnswer();


    } catch (error) {

      console.error(
        "student answer:",
        error
      );


      showError(
        error.message ||
        "答案を表示できませんでした。"
      );

    }

  }


  /* =======================================================
     TEST
  ======================================================= */

  async function loadTest() {

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
          results_published,
          results_published_at
          `
        )
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

      showError(
        "テストが見つかりません。"
      );

      return false;

    }


    test =
      data;


    document.getElementById(
      "testName"
    ).textContent =
      data.name ||
      "";


    /*
     * 公開済みなら
     * 採点済み答案画面へ誘導できる状態。
     *
     * ただし、この画面自体では
     * 採点記号・点数を表示しない。
     */

    if (
      data.results_published
    ) {

      const notice =
        document.createElement(
          "div"
        );


      notice.style.cssText = `
        margin-bottom:12px;
        padding:10px;
        background:#edf8ef;
        border:1px solid #b7d9c0;
        color:#176b35;
      `;


      notice.innerHTML = `

        採点結果が確定しています。

        <br><br>

        <a
          href="/student/tests/result.html?test=${encodeURIComponent(
            testId
          )}"
          class="btn btn-primary"
        >
          成績・採点済み答案を見る
        </a>

      `;


      const container =
        document.getElementById(
          "answerPages"
        );


      container?.before(
        notice
      );

    }


    return true;

  }


  /* =======================================================
     ANSWER
  ======================================================= */

  async function loadAnswer() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(
          `
          id,
          student_id,
          status,
          created_at
          `
        )
        .eq(
          "test_id",
          testId
        )
        .eq(
          "student_id",
          student.id
        )
        .eq(
          "status",
          "published"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(
          1
        )
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


    await loadPages();


    await renderPages();

  }


  /* =======================================================
     PAGES
  ======================================================= */

  async function loadPages() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(
          `
          id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
          `
        )
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


    if (error) {

      throw error;

    }


    pages =
      data || [];

  }


  /* =======================================================
     RENDER
  ======================================================= */

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

      const element =
        await createPageElement(
          page
        );


      container.appendChild(
        element
      );

    }

  }


  /* =======================================================
     PAGE
  ======================================================= */

  async function createPageElement(
    page
  ) {

    const wrapper =
      document.createElement(
        "section"
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
      `答案 ${page.page_no}ページ`;


    wrapper.appendChild(
      title
    );


    if (
      !page.file_path
    ) {

      return wrapper;

    }


    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .storage
          .from(
            "test-files"
          )
          .createSignedUrl(
            page.file_path,
            3600
          );


      if (
        error ||
        !data?.signedUrl
      ) {

        throw new Error(
          "答案ファイルを取得できませんでした。"
        );

      }


      const image =
        document.createElement(
          "img"
        );


      image.className =
        "student-answer-image";


      image.src =
        data.signedUrl;


      image.alt =
        `答案 ${page.page_no}ページ`;


      image.loading =
        "lazy";


      image.decoding =
        "async";


      image.addEventListener(
        "error",
        () => {

          image.remove();


          const errorElement =
            document.createElement(
              "div"
            );


          errorElement.className =
            "empty-state";


          errorElement.style.color =
            "#b42318";


          errorElement.textContent =
            "答案画像を表示できませんでした。";


          wrapper.appendChild(
            errorElement
          );

        }
      );


      wrapper.appendChild(
        image
      );


    } catch (error) {

      const errorElement =
        document.createElement(
          "div"
        );


      errorElement.className =
        "empty-state";


      errorElement.style.color =
        "#b42318";


      errorElement.textContent =
        error.message ||
        "答案を取得できませんでした。";


      wrapper.appendChild(
        errorElement
      );

    }


    return wrapper;

  }


  /* =======================================================
     EMPTY
  ======================================================= */

  function renderNoAnswer() {

    const container =
      document.getElementById(
        "answerPages"
      );


    if (!container) {

      return;

    }


    container.innerHTML = `

      <div class="empty-state">

        このテストの答案はありません。

      </div>

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
        "answerPages"
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
