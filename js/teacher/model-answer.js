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
    params.get("id");


  let currentTest =
    null;


  let modelPages =
    [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

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

      alert(
        "テストが指定されていません。"
      );


      location.replace(
        "/teacher/tests"
      );


      return;

    }


    setupNavigation();

    await loadTest();

    await loadPages();

  }


  /* =====================================================
     ナビゲーション
  ===================================================== */

  function setupNavigation() {

    document.getElementById(
      "pagesLink"
    ).href =
      `/teacher/tests/pages?id=${encodeURIComponent(testId)}`;


    document.getElementById(
      "layoutLink"
    ).href =
      `/teacher/tests/layout?id=${encodeURIComponent(testId)}`;


    document.getElementById(
      "modelAnswerLink"
    ).href =
      `/teacher/tests/model-answer?id=${encodeURIComponent(testId)}`;


    document.getElementById(
      "previewLink"
    ).href =
      `/teacher/tests/preview?id=${encodeURIComponent(testId)}`;

  }


  /* =====================================================
     テスト
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


    document.getElementById(
      "testInformation"
    ).innerHTML = `

      <strong>
        ${escapeHtml(data.name)}
      </strong>

      <br>

      教科：
      ${escapeHtml(
        data.subject || "-"
      )}

      ／

      学年：
      ${escapeHtml(
        data.grade || "-"
      )}

      ／

      クラス：
      ${escapeHtml(
        data.class_name || "-"
      )}

      ／

      満点：
      ${data.max_score}

    `;

  }


  /* =====================================================
     ページ取得
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
            ascending:
              true
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
     ページ表示
  ===================================================== */

  async function renderPages() {

    const container =
      document.getElementById(
        "pageList"
      );


    document.getElementById(
      "pageCount"
    ).textContent =
      `${modelPages.length}ページ`;


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
      modelPages
        .map(
          page => `

            <div
              class="card"
              style="
                margin:0;
                padding:10px;
              "
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  margin-bottom:8px;
                "
              >

                <strong>
                  ${page.page_no}ページ
                </strong>


                <button
                  class="btn"
                  type="button"
                  data-delete-page="${escapeHtml(page.id)}"
                >
                  削除
                </button>

              </div>


              <div
                id="preview-${escapeHtml(page.id)}"
                style="
                  height:300px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  overflow:hidden;
                  background:#f5f6f7;
                  border:1px solid #d0d6dc;
                "
              >
                読み込み中...
              </div>


              <div
                style="
                  margin-top:7px;
                  color:#777;
                  font-size:12px;
                "
              >

                ${
                  page.width_px &&
                  page.height_px
                    ? `${page.width_px} × ${page.height_px}px`
                    : ""
                }

              </div>

            </div>

          `
        )
        .join("");


    for (
      const page
      of modelPages
    ) {

      await renderPage(
        page
      );

    }


    container
      .querySelectorAll(
        "[data-delete-page]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              await deletePage(
                button.dataset.deletePage
              );

            }
          );

        }
      );

  }


  /* =====================================================
     ページ画像
  ===================================================== */

  async function renderPage(
    page
  ) {

    const target =
      document.getElementById(
        `preview-${page.id}`
      );


    if (!target) {

      return;

    }


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


    if (error) {

      target.textContent =
        "画像を取得できません。";


      return;

    }


    const image =
      document.createElement(
        "img"
      );


    image.src =
      data.signedUrl;


    image.alt =
      "模範解答";


    image.style.cssText = `

      max-width:100%;
      max-height:100%;
      object-fit:contain;

    `;


    target.innerHTML =
      "";


    target.appendChild(
      image
    );

  }


  /* =====================================================
     アップロード
  ===================================================== */

  document
    .getElementById(
      "uploadButton"
    )
    .addEventListener(
      "click",
      async () => {

        const input =
          document.getElementById(
            "modelAnswerFiles"
          );


        const files =
          [
            ...input.files
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

          for (
            const file
            of files
          ) {

            await processFile(
              file
            );

          }


          input.value =
            "";


          await loadPages();


          showMessage(
            "模範解答の登録が完了しました。"
          );


        } catch (error) {

          console.error(
            error
          );


          showMessage(
            error.message ||
            "模範解答の登録に失敗しました。",
            true
          );

        }


        button.disabled =
          false;


        button.textContent =
          "模範解答を登録";

      }
    );


  /* =====================================================
     ファイル処理
  ===================================================== */

  async function processFile(
    file
  ) {

    if (
      !window.TEST_SCORE_FILES
    ) {

      throw new Error(
        "ファイル処理エンジンが読み込まれていません。"
      );

    }


    const pages =
      await window.TEST_SCORE_FILES
        .parseFile(
          file
        );


    if (
      !pages.length
    ) {

      throw new Error(
        `${file.name}からページを取得できませんでした。`
      );

    }


    for (
      const page
      of pages
    ) {

      const pageNo =
        await getNextPageNo();


      const path =
        `${testId}/page-${String(pageNo).padStart(3,"0")}-${crypto.randomUUID()}.png`;


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
          path,
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
              path,

            width_px:
              page.width,

            height_px:
              page.height,

            original_name:
              page.name ||
              file.name

          });


      if (error) {

        throw error;

      }

    }

  }


  /* =====================================================
     次ページ番号
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
            ascending:
              false
          }
        )
        .limit(1);


    if (error) {

      throw error;

    }


    if (
      !data?.length
    ) {

      return 1;

    }


    return (
      Number(
        data[0].page_no
      ) + 1
    );

  }


  /* =====================================================
     削除
  ===================================================== */

  async function deletePage(
    pageId
  ) {

    if (
      !confirm(
        "この模範解答ページを削除しますか？"
      )
    ) {

      return;

    }


    try {

      const {
        data: page,
        error:
          pageError
      } =
        await supabaseClient
          .from(
            "model_answer_pages"
          )
          .select(`
            id,
            image_path
          `)
          .eq(
            "id",
            pageId
          )
          .single();


      if (pageError) {

        throw pageError;

      }


      const {
        error:
          deleteError
      } =
        await supabaseClient
          .from(
            "model_answer_pages"
          )
          .delete()
          .eq(
            "id",
            pageId
          );


      if (deleteError) {

        throw deleteError;

      }


      if (
        page?.image_path
      ) {

        await supabaseClient
          .storage
          .from(
            "model-answers"
          )
          .remove([
            page.image_path
          ]);

      }


      await loadPages();


      showMessage(
        "ページを削除しました。"
      );


    } catch (error) {

      console.error(
        error
      );


      showMessage(
        error.message ||
        "ページを削除できませんでした。",
        true
      );

    }

  }


  /* =====================================================
     解除
  ===================================================== */

  document
    .getElementById(
      "clearButton"
    )
    .addEventListener(
      "click",
      () => {

        document.getElementById(
          "modelAnswerFiles"
        ).value =
          "";


        showMessage(
          ""
        );

      }
    );


  /* =====================================================
     Logout
  ===================================================== */

  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  /* =====================================================
     Message
  ===================================================== */

  function showMessage(
    message,
    error = false
  ) {

    const element =
      document.getElementById(
        "message"
      );


    element.textContent =
      message;


    element.style.color =
      error
        ? "#c62828"
        : "#16834b";

  }


  /* =====================================================
     Escape
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
