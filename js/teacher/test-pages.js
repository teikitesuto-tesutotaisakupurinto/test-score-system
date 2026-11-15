/* =========================================================
   テスト成績システム
   解答用紙登録

   入力:
   JPG
   JPEG
   PNG
   WEBP
   GIF
   BMP
   PDF
   ZIP

   ↓

   共通file-parser

   ↓

   全ページPNG

   ↓

   Supabase Storage

   ↓

   test_pages
========================================================= */


const pageParams =
  new URLSearchParams(
    window.location.search
  );


const pageTestId =
  pageParams.get("id");


let currentTest =
  null;


let registeredPages =
  [];


/* =========================================================
   初期化
========================================================= */

async function initializeTestPages() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    window.location.replace(
      "/student/dashboard"
    );

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name ||
    "先生";


  if (!pageTestId) {

    alert(
      "テストが指定されていません。"
    );


    window.location.replace(
      "/teacher/tests"
    );


    return;

  }


  setNavigation();


  await loadTest();


  await loadPages();

}


/* =========================================================
   ナビゲーション
========================================================= */

function setNavigation() {

  document.getElementById(
    "pagesLink"
  ).href =
    `/teacher/tests/pages?id=${encodeURIComponent(pageTestId)}`;


  document.getElementById(
    "layoutLink"
  ).href =
    `/teacher/tests/layout?id=${encodeURIComponent(pageTestId)}`;


  document.getElementById(
    "modelAnswerLink"
  ).href =
    `/teacher/tests/model-answer?id=${encodeURIComponent(pageTestId)}`;


  document.getElementById(
    "previewLink"
  ).href =
    `/teacher/tests/preview?id=${encodeURIComponent(pageTestId)}`;

}


/* =========================================================
   テスト取得
========================================================= */

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
        test_date,
        max_score,
        status
      `)
      .eq(
        "id",
        pageTestId
      )
      .maybeSingle();


  if (error) {

    console.error(
      error
    );


    showMessage(
      "テスト情報を取得できませんでした。",
      true
    );


    return;

  }


  if (!data) {

    showMessage(
      "指定されたテストが見つかりません。",
      true
    );


    return;

  }


  currentTest =
    data;


  document.getElementById(
    "testInformation"
  ).innerHTML = `

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
    ${data.max_score}

  `;

}


/* =========================================================
   ページ取得
========================================================= */

async function loadPages() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("test_pages")
      .select(`
        id,
        page_no,
        image_path,
        width_px,
        height_px
      `)
      .eq(
        "test_id",
        pageTestId
      )
      .neq(
        "page_no",
        999
      )
      .order(
        "page_no",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      error
    );


    showMessage(
      "登録済みページを取得できませんでした。",
      true
    );


    return;

  }


  registeredPages =
    data || [];


  renderPages();

}


/* =========================================================
   ページ表示
========================================================= */

async function renderPages() {

  const container =
    document.getElementById(
      "pageList"
    );


  document.getElementById(
    "pageCount"
  ).textContent =
    `${registeredPages.length}ページ`;


  if (
    !registeredPages.length
  ) {

    container.innerHTML = `

      <div
        style="
          grid-column:1/-1;
          text-align:center;
          color:#777;
          padding:35px;
        "
      >

        解答用紙が登録されていません。

      </div>

    `;


    return;

  }


  container.innerHTML =
    registeredPages
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
                align-items:center;
                justify-content:space-between;
                margin-bottom:8px;
              "
            >

              <strong>
                ${page.page_no}ページ
              </strong>


              <button
                type="button"
                class="btn"
                data-delete-page="${escapeHtml(page.id)}"
              >
                削除
              </button>

            </div>



            <div
              id="page-preview-${escapeHtml(page.id)}"
              style="
                height:300px;
                border:1px solid #d0d6dc;
                background:#f5f6f7;
                display:flex;
                align-items:center;
                justify-content:center;
                overflow:hidden;
              "
            >

              読み込み中...

            </div>



            <div
              style="
                margin-top:7px;
                font-size:12px;
                color:#777;
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


  /*
    各ページ画像
  */

  for (
    const page
    of registeredPages
  ) {

    await renderPageImage(
      page
    );

  }


  /*
    削除イベント
  */

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


/* =========================================================
   Storage画像
========================================================= */

async function renderPageImage(
  page
) {

  const target =
    document.getElementById(
      `page-preview-${page.id}`
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


  if (
    !data?.signedUrl
  ) {

    target.textContent =
      "画像URLを取得できません。";


    return;

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    "解答用紙";


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


/* =========================================================
   アップロード
========================================================= */

document
  .getElementById(
    "addPageButton"
  )
  .addEventListener(
    "click",
    async () => {

      const input =
        document.getElementById(
          "pageFile"
        );


      const files =
        [
          ...input.files
        ];


      if (!files.length) {

        showMessage(
          "解答用紙ファイルを選択してください。",
          true
        );


        return;

      }


      const button =
        document.getElementById(
          "addPageButton"
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

          await processInputFile(
            file
          );

        }


        await loadPages();


        input.value =
          "";


        showMessage(
          "解答用紙の登録が完了しました。"
        );


      } catch (error) {

        console.error(
          "解答用紙登録:",
          error
        );


        showMessage(
          error.message ||
          "解答用紙の登録に失敗しました。",
          true
        );

      }


      button.disabled =
        false;


      button.textContent =
        "解答用紙を登録";

    }
  );


/* =========================================================
   ファイル処理
========================================================= */

async function processInputFile(
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
    !pages ||
    !pages.length
  ) {

    throw new Error(
      `${file.name}からページを取得できませんでした。`
    );

  }


  /*
    PDFやZIPは複数ページになる。
    入力順に登録する。
  */

  for (
    const page
    of pages
  ) {

    const pageNo =
      await getNextPageNo();


    const path =
      `${pageTestId}/page-${String(pageNo).padStart(3, "0")}-${crypto.randomUUID()}.png`;


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


    await insertTestPage({

      pageNo,

      path,

      width:
        page.width,

      height:
        page.height

    });

  }

}


/* =========================================================
   次ページ番号
========================================================= */

async function getNextPageNo() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "test_pages"
      )
      .select(
        "page_no"
      )
      .eq(
        "test_id",
        pageTestId
      )
      .neq(
        "page_no",
        999
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
    !data ||
    !data.length
  ) {

    return 1;

  }


  return (
    Number(
      data[0].page_no
    ) + 1
  );

}


/* =========================================================
   test_pages登録
========================================================= */

async function insertTestPage({
  pageNo,
  path,
  width,
  height
}) {

  const {
    error
  } =
    await supabaseClient
      .from(
        "test_pages"
      )
      .insert({

        test_id:
          pageTestId,

        page_no:
          pageNo,

        image_path:
          path,

        width_px:
          width,

        height_px:
          height

      });


  if (error) {

    throw error;

  }

}


/* =========================================================
   ページ削除
========================================================= */

async function deletePage(
  pageId
) {

  if (
    !confirm(
      "この解答用紙ページを削除しますか？"
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
          "test_pages"
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


    /*
      DB削除
    */

    const {
      error:
        deleteError
    } =
      await supabaseClient
        .from(
          "test_pages"
        )
        .delete()
        .eq(
          "id",
          pageId
        );


    if (deleteError) {

      throw deleteError;

    }


    /*
      Storage削除
    */

    if (
      page?.image_path
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

        console.error(
          "Storage削除:",
          storageError
        );

      }

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
      "ページの削除に失敗しました。",
      true
    );

  }

}


/* =========================================================
   選択解除
========================================================= */

document
  .getElementById(
    "clearButton"
  )
  .addEventListener(
    "click",
    () => {

      document.getElementById(
        "pageFile"
      ).value =
        "";


      showMessage(
        ""
      );

    }
  );


/* =========================================================
   ログアウト
========================================================= */

document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


/* =========================================================
   メッセージ
========================================================= */

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


/* =========================================================
   HTML escape
========================================================= */

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


/* =========================================================
   START
========================================================= */

initializeTestPages();
