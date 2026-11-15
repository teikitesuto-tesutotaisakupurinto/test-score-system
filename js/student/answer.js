
/* =========================================================
   テスト成績システム
   生徒用 採点前答案表示 完全版

   対応
   ---------------------------------------------------------
   ・JPG
   ・JPEG
   ・PNG
   ・WEBP
   ・GIF
   ・PDF

   ZIPについて
   ---------------------------------------------------------
   ZIPはアップロード時に展開・ページ化する。
   生徒画面ではZIPそのものを扱わない。

   認証
   ---------------------------------------------------------
   Supabase Auth
       ↓
   requireStudent()
       ↓
   students.auth_user_id
       ↓
   自分のstudent.id

   公開
   ---------------------------------------------------------
   tests.results_published = true

   答案
   ---------------------------------------------------------
   自分のanswer_sheetsだけ取得

   Storage
   ---------------------------------------------------------
   answer-files
       ↓
   自分の公開済み答案だけSigned URL取得
========================================================= */


/* =========================================================
   IIFE
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     URL
  ======================================================= */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


  /* =======================================================
     状態
  ======================================================= */

  let profile = null;

  let student = null;

  let test = null;

  let answer = null;

  let pages = [];


  /* =======================================================
     初期化
  ======================================================= */

  async function initialize() {

    try {

      /*
        生徒認証

        roleだけでなく
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
        ヘッダー
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
        test ID
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

      const loaded =
        await loadTest();


      if (!loaded) {

        return;

      }


      /*
        自分の答案
      */

      await loadAnswer();

    } catch (error) {

      console.error(
        "student/answer:",
        error
      );


      showError(
        error.message ||
        "答案を表示できませんでした。"
      );

    }

  }


  /* =======================================================
     テスト取得
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


    if (!data) {

      showError(
        "このテストは現在公開されていません。"
      );


      return false;

    }


    test =
      data;


    renderTestInformation();


    return true;

  }


  /* =======================================================
     テスト情報
  ======================================================= */

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
      testMetaがHTMLに存在する場合
    */

    const meta =
      document.getElementById(
        "testMeta"
      );


    if (meta) {

      const values =
        [];


      if (
        test.subject
      ) {

        values.push(
          `教科：${test.subject}`
        );

      }


      if (
        test.grade
      ) {

        values.push(
          `学年：${test.grade}`
        );

      }


      if (
        test.class_name
      ) {

        values.push(
          `クラス：${test.class_name}`
        );

      }


      if (
        test.max_score !==
          null &&
        test.max_score !==
          undefined
      ) {

        values.push(
          `満点：${test.max_score}点`
        );

      }


      if (
        test.results_published_at
      ) {

        values.push(
          `公開：${formatDate(
            test.results_published_at
          )}`
        );

      }


      meta.textContent =
        values.join(
          " ／ "
        );

    }

  }


  /* =======================================================
     自分の答案取得
  ======================================================= */

  async function loadAnswer() {

    /*
      student_idはURLから取得しない。

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
      ページ取得
    */

    await loadPages();


    /*
      表示
    */

    await renderPages();

  }


  /* =======================================================
     answer_sheet_pages
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
        .select(`
          id,
          answer_sheet_id,
          page_no,
          file_path,
          file_type,
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


  /* =======================================================
     ページ表示
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


    /*
      ページを順番に表示
    */

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
     ページElement
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
      ファイルURL
    */

    let signedUrl = null;


    try {

      signedUrl =
        await createSignedUrl(
          page.file_path
        );

    } catch (error) {

      console.error(
        `ページ${page.page_no} URL:`,
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
        "答案ファイルを取得できませんでした。";


      wrapper.appendChild(
        errorElement
      );


      return wrapper;

    }


    /*
      ファイル形式判定
    */

    const fileType =
      getFileType(
        page
      );


    /*
      PDF
    */

    if (
      fileType ===
      "pdf"
    ) {

      appendPdfViewer(
        wrapper,
        signedUrl,
        page
      );


      return wrapper;

    }


    /*
      画像
    */

    if (
      isImageType(
        fileType
      )
    ) {

      appendImageViewer(
        wrapper,
        signedUrl,
        page
      );


      return wrapper;

    }


    /*
      不明形式

      MIME情報が不明でも
      画像URLならimgで試す。
    */

    appendImageViewer(
      wrapper,
      signedUrl,
      page
    );


    return wrapper;

  }


  /* =======================================================
     Signed URL
  ======================================================= */

  async function createSignedUrl(
    filePath
  ) {

    if (!filePath) {

      throw new Error(
        "file_pathがありません。"
      );

    }


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
          filePath,
          3600
        );


    if (error) {

      throw error;

    }


    if (
      !data?.signedUrl
    ) {

      throw new Error(
        "Signed URLを取得できませんでした。"
      );

    }


    return data.signedUrl;

  }


  /* =======================================================
     画像表示
  ======================================================= */

  function appendImageViewer(
    wrapper,
    url,
    page
  ) {

    const image =
      document.createElement(
        "img"
      );


    image.className =
      "student-answer-image";


    image.src =
      url;


    image.alt =
      `答案 ${page.page_no}ページ`;


    image.loading =
      "lazy";


    image.decoding =
      "async";


    /*
      画像読み込みエラー
    */

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
          "#c62828";


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

  }


  /* =======================================================
     PDF表示
     
     PDF.jsをここで動的ロード。

     通常の運用ではPDFは
     answer_sheet_pagesのページ画像へ
     変換しておくため、この分岐は保険。
  ======================================================= */

  async function appendPdfViewer(
    wrapper,
    url,
    page
  ) {

    /*
      まずブラウザ標準PDF表示を使用。

      PDF.jsが読み込まれていなくても
      動作する。
    */

    const frame =
      document.createElement(
        "iframe"
      );


    frame.className =
      "student-answer-pdf";


    frame.src =
      url;


    frame.title =
      `答案PDF ${page.page_no}ページ`;


    frame.loading =
      "lazy";


    frame.setAttribute(
      "allow",
      "fullscreen"
    );


    wrapper.appendChild(
      frame
    );

  }


  /* =======================================================
     ファイル形式取得
  ======================================================= */

  function getFileType(
    page
  ) {

    /*
      file_typeを優先
    */

    if (
      page.file_type
    ) {

      const value =
        String(
          page.file_type
        )
          .toLowerCase()
          .trim();


      if (
        value.includes(
          "pdf"
        )
      ) {

        return "pdf";

      }


      if (
        value.includes(
          "jpeg"
        )
      ) {

        return "jpeg";

      }


      if (
        value.includes(
          "jpg"
        )
      ) {

        return "jpg";

      }


      if (
        value.includes(
          "png"
        )
      ) {

        return "png";

      }


      if (
        value.includes(
          "webp"
        )
      ) {

        return "webp";

      }


      if (
        value.includes(
          "gif"
        )
      ) {

        return "gif";

      }

    }


    /*
      file_pathから判定
    */

    return getFileExtension(
      page.file_path
    );

  }


  /* =======================================================
     拡張子
  ======================================================= */

  function getFileExtension(
    value
  ) {

    if (!value) {

      return "";

    }


    const clean =
      String(
        value
      )
        .split("?")[0]
        .split("#")[0];


    const parts =
      clean.split(
        "."
      );


    if (
      parts.length <
      2
    ) {

      return "";

    }


    return parts
      .pop()
      .toLowerCase();

  }


  /* =======================================================
     画像判定
  ======================================================= */

  function isImageType(
    type
  ) {

    return [

      "jpg",

      "jpeg",

      "png",

      "webp",

      "gif"

    ].includes(
      String(
        type ||
        ""
      )
        .toLowerCase()
    );

  }


  /* =======================================================
     答案なし
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

      <div
        class="empty-state"
      >

        このテストの答案はありません。

      </div>

    `;

  }


  /* =======================================================
     エラー
  ======================================================= */

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

      return;

    }


    alert(
      message
    );

  }


  /* =======================================================
     Logout
  ======================================================= */

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


  /* =======================================================
     日付
  ======================================================= */

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


  /* =======================================================
     HTML Escape
  ======================================================= */

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
