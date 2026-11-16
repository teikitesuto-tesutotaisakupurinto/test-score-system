
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
    params.get("test") ||
    params.get("id");


  let currentTest =
    null;


  let modelPages =
    [];


  /* =====================================================
     INIT
  ===================================================== */

  async function initialize() {

    try {

      const profile =
        await getProfile();


      if (!profile) {

        location.replace(
          "/login"
        );

        return;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        location.replace(
          "/student/dashboard"
        );

        return;

      }


      document.getElementById(
        "teacherName"
      ).textContent =
        profile.name ||
        "先生";


      if (!testId) {

        throw new Error(
          "テストが指定されていません。"
        );

      }


      setupNavigation();


      setupEvents();


      await loadTest();


      await loadPages();


    } catch (error) {

      console.error(
        "model-answer:",
        error
      );


      showMessage(
        error.message ||
        "模範解答画面を読み込めませんでした。",
        true
      );

    }

  }


  /* =====================================================
     NAVIGATION
  ===================================================== */

  function setupNavigation() {

    const id =
      encodeURIComponent(
        testId
      );


    const pagesLink =
      document.getElementById(
        "pagesLink"
      );


    const layoutLink =
      document.getElementById(
        "layoutLink"
      );


    const pointsLink =
      document.getElementById(
        "pointsLink"
      );


    const modelLink =
      document.getElementById(
        "modelAnswerLink"
      );


    const previewLink =
      document.getElementById(
        "previewLink"
      );


    if (pagesLink) {

      pagesLink.href =
        `/teacher/tests/pages?test=${id}`;

    }


    if (layoutLink) {

      layoutLink.href =
        `/teacher/tests/layout?test=${id}`;

    }


    if (pointsLink) {

      pointsLink.href =
        `/teacher/tests/points?test=${id}`;

    }


    if (modelLink) {

      modelLink.href =
        `/teacher/tests/model-answer?test=${id}`;

    }


    if (previewLink) {

      previewLink.href =
        `/teacher/tests/preview?test=${id}`;

    }

  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {

    document
      .getElementById(
        "uploadButton"
      )
      ?.addEventListener(
        "click",
        uploadFiles
      );


    document
      .getElementById(
        "clearButton"
      )
      ?.addEventListener(
        "click",
        () => {

          const input =
            document.getElementById(
              "modelAnswerFiles"
            );


          if (input) {

            input.value =
              "";

          }


          showMessage(
            ""
          );

        }
      );


    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        async () => {

          if (
            typeof window.logout ===
            "function"
          ) {

            await window.logout();

            return;

          }


          await supabaseClient.auth
            .signOut();


          location.replace(
            "/login"
          );

        }
      );

  }


  /* =====================================================
     TEST
  ===================================================== */

  async function loadTest() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          max_score
        `)
        .eq(
          "id",
          testId
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      throw new Error(
        "テストが見つかりません。"
      );

    }


    currentTest =
      data;


    const element =
      document.getElementById(
        "testInformation"
      );


    if (element) {

      element.innerHTML = `

        <strong>
          ${escapeHtml(
            data.name
          )}
        </strong>

        <br>

        教科：
        ${escapeHtml(
          data.subject ||
          "-"
        )}

        ／

        学年：
        ${escapeHtml(
          data.grade ||
          "-"
        )}

        ／

        クラス：
        ${escapeHtml(
          data.class_name ||
          "-"
        )}

        ／

        満点：
        ${escapeHtml(
          data.max_score ??
          "-"
        )}

      `;

    }

  }


  /* =====================================================
     LOAD PAGES
  ===================================================== */

  async function loadPages() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "model_answer_pages"
        )
        .select(`
          id,
          page_no,
          image_path,
          width_px,
          height_px,
          original_name
        `)
        .eq(
          "test_id",
          testId
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


    modelPages =
      data || [];


    renderPages();

  }


  /* =====================================================
     RENDER
  ===================================================== */

  async function renderPages() {

    const container =
      document.getElementById(
        "pageList"
      );


    const count =
      document.getElementById(
        "pageCount"
      );


    if (count) {

      count.textContent =
        `${modelPages.length}ページ`;

    }


    if (!container) {

      return;

    }


    if (!modelPages.length) {

      container.innerHTML = `

        <div
          style="
            grid-column:1/-1;
            text-align:center;
            color:#777;
            padding:35px;
          "
        >
          模範解答が登録されていません。
        </div>

      `;

      return;

    }


    container.innerHTML =
      "";


    for (
      const page
      of modelPages
    ) {

      const card =
        document.createElement(
          "div"
        );


      card.className =
        "model-page";


      const header =
        document.createElement(
          "div"
        );


      header.className =
        "model-page-header";


      const title =
        document.createElement(
          "strong"
        );


      title.textContent =
        `${page.page_no}ページ`;


      const deleteButton =
        document.createElement(
          "button"
        );


      deleteButton.type =
        "button";


      deleteButton.className =
        "btn";


      deleteButton.textContent =
        "削除";


      deleteButton.addEventListener(
        "click",
        async () => {

          await deletePage(
            page
          );

        }
      );


      header.append(
        title,
        deleteButton
      );


      const preview =
        document.createElement(
          "div"
        );


      preview.className =
        "model-preview";


      preview.textContent =
        "読み込み中...";


      const meta =
        document.createElement(
          "div"
        );


      meta.className =
        "model-page-meta";


      meta.textContent =
        [
          page.width_px &&
          page.height_px
            ? `${page.width_px} × ${page.height_px}px`
            : "",

          page.original_name ||
          ""

        ]
          .filter(Boolean)
          .join(
            " / "
          );


      card.append(
        header,
        preview,
        meta
      );


      container.appendChild(
        card
      );


      await renderPage(
        page,
        preview
      );

    }

  }


  /* =====================================================
     PAGE IMAGE
  ===================================================== */

  async function renderPage(
    page,
    target
  ) {

    try {

      const {
        data,
        error
      } =
        await supabaseClient
          .storage
          .from(
            "model-answers"
          )
          .createSignedUrl(
            page.image_path,
            3600
          );


      if (
        error ||
        !data?.signedUrl
      ) {

        throw new Error(
          "画像URLを取得できませんでした。"
        );

      }


      const image =
        document.createElement(
          "img"
        );


      image.src =
        data.signedUrl;


      image.alt =
        "模範解答";


      image.draggable =
        false;


      target.innerHTML =
        "";


      target.appendChild(
        image
      );


    } catch (error) {

      target.textContent =
        error.message ||
        "画像を取得できませんでした。";

    }

  }


  /* =====================================================
     UPLOAD
  ===================================================== */

  async function uploadFiles() {

    const input =
      document.getElementById(
        "modelAnswerFiles"
      );


    const files =
      [
        ...(input?.files || [])
      ];


    if (!files.length) {

      showMessage(
        "模範解答ファイルを選択してください。",
        true
      );

      return;

    }


    const button =
      document.getElementById(
        "uploadButton"
      );


    button.disabled =
      true;


    button.textContent =
      "登録中...";


    try {

      let count =
        0;


      for (
        const file
        of files
      ) {

        const pages =
          await parseFile(
            file
          );


        for (
          const page
          of pages
        ) {

          await uploadPage(
            page,
            file.name
          );


          count++;

        }

      }


      input.value =
        "";


      await loadPages();


      showMessage(
        `${count}ページの模範解答を登録しました。`
      );


    } catch (error) {

      console.error(
        "model answer upload:",
        error
      );


      showMessage(
        error.message ||
        "模範解答の登録に失敗しました。",
        true
      );

    } finally {

      button.disabled =
        false;


      button.textContent =
        "模範解答を登録";

    }

  }


  /* =====================================================
     FILE PARSER
  ===================================================== */

  async function parseFile(
    file
  ) {

    /*
     * 既存の共通ファイル処理エンジンを優先。
     */

    if (
      window.TEST_SCORE_FILES?.parseFile
    ) {

      const result =
        await window.TEST_SCORE_FILES
          .parseFile(
            file
          );


      return (
        result ||
        []
      );

    }


    throw new Error(
      "ファイル処理エンジンが読み込まれていません。"
    );

  }


  /* =====================================================
     UPLOAD PAGE
  ===================================================== */

  async function uploadPage(
    page,
    originalName
  ) {

    const pageNo =
      await getNextPageNo();


    const storagePath =
      [
        testId,
        `page-${String(
          pageNo
        ).padStart(
          3,
          "0"
        )}`,
        crypto.randomUUID(),
        "answer.png"
      ].join(
        "/"
      );


    const {
      error:
        uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "model-answers"
        )
        .upload(
          storagePath,
          page.blob,
          {

            contentType:
              "image/png",

            upsert:
              false

          }
        );


    if (uploadError) {

      throw uploadError;

    }


    const {
      error
    } =
      await supabaseClient
        .from(
          "model_answer_pages"
        )
        .insert({

          test_id:
            testId,

          page_no:
            pageNo,

          image_path:
            storagePath,

          width_px:
            page.width,

          height_px:
            page.height,

          original_name:
            page.name ||
            originalName

        });


    if (error) {

      /*
       * DB保存失敗時は
       * Storageファイルも削除。
       */

      await supabaseClient
        .storage
        .from(
          "model-answers"
        )
        .remove([
          storagePath
        ]);


      throw error;

    }

  }


  /* =====================================================
     NEXT PAGE
  ===================================================== */

  async function getNextPageNo() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "model_answer_pages"
        )
        .select(
          "page_no"
        )
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending:false
          }
        )
        .limit(
          1
        );


    if (error) {

      throw error;

    }


    if (!data?.length) {

      return 1;

    }


    return (
      Number(
        data[0].page_no
      ) || 0
    ) + 1;

  }


  /* =====================================================
     DELETE
  ===================================================== */

  async function deletePage(
    page
  ) {

    if (
      !window.confirm(
        `${page.page_no}ページの模範解答を削除しますか？`
      )
    ) {

      return;

    }


    try {

      const {
        error
      } =
        await supabaseClient
          .from(
            "model_answer_pages"
          )
          .delete()
          .eq(
            "id",
            page.id
          );


      if (error) {

        throw error;

      }


      if (
        page.image_path
      ) {

        const {
          error:
            storageError
        } =
          await supabaseClient
            .storage
            .from(
              "model-answers"
            )
            .remove([
              page.image_path
            ]);


        if (storageError) {

          console.warn(
            "Storage削除:",
            storageError
          );

        }

      }


      await loadPages();


      showMessage(
        "模範解答ページを削除しました。"
      );


    } catch (error) {

      console.error(
        "delete model answer:",
        error
      );


      showMessage(
        error.message ||
        "模範解答を削除できませんでした。",
        true
      );

    }

  }


  /* =====================================================
     MESSAGE
  ===================================================== */

  function showMessage(
    message,
    error = false
  ) {

    const element =
      document.getElementById(
        "message"
      );


    if (!element) {

      return;

    }


    element.textContent =
      message;


    element.className =
      `model-message ${
        error
          ? "error"
          : "success"
      }`;

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


  initialize();

})();
