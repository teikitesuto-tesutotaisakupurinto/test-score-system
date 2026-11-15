/* =========================================================
   テスト成績システム
   解答用紙登録

   対応:
   JPG
   JPEG
   PNG
   WEBP
   GIF
   BMP
   PDF
   ZIP

   ZIP
   ↓
   展開
   ↓
   画像 / PDF
   ↓
   ページ画像
   ↓
   Supabase Storage
   ↓
   test_pages

   PDFはページごとにPNGへ変換して保存
========================================================= */


/* =========================================================
   状態
========================================================= */

const pageParams =
  new URLSearchParams(
    window.location.search
  );

const pageTestId =
  pageParams.get("id");


let currentTest = null;

let registeredPages = [];


/* =========================================================
   対応拡張子
========================================================= */

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp"
];


const PDF_EXTENSIONS = [
  "pdf"
];


const ZIP_EXTENSIONS = [
  "zip"
];


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
      "テスト取得エラー:",
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


/* =========================================================
   登録済みページ取得
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
          ascending: true
        }
      );


  if (error) {

    console.error(
      "ページ取得エラー:",
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


  if (!registeredPages.length) {

    container.innerHTML = `

      <div
        style="
          grid-column:1/-1;
          text-align:center;
          padding:35px;
          color:#777;
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
                data-delete-page="${page.id}"
              >
                削除
              </button>

            </div>


            <div
              id="page-preview-${page.id}"
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
    画像URL取得
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
          () =>
            deletePage(
              button.dataset.deletePage
            )
        );

      }
    );

}


/* =========================================================
   ページ画像
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


  target.innerHTML = `

    <img
      src="${escapeHtml(data.signedUrl)}"
      alt="解答用紙"
      style="
        max-width:100%;
        max-height:100%;
        object-fit:contain;
      "
    >

  `;

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

      const files =
        [
          ...
          document.getElementById(
            "pageFile"
          ).files
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


        showMessage(
          "解答用紙の登録が完了しました。"
        );


        document.getElementById(
          "pageFile"
        ).value =
          "";


      } catch (error) {

        console.error(
          "解答用紙登録エラー:",
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
   入力ファイル判定
========================================================= */

async function processInputFile(
  file
) {

  const extension =
    getExtension(
      file.name
    );


  /*
    ZIP
  */

  if (
    ZIP_EXTENSIONS
      .includes(extension)
  ) {

    await processZip(
      file
    );

    return;

  }


  /*
    PDF
  */

  if (
    PDF_EXTENSIONS
      .includes(extension)
  ) {

    await processPdf(
      file
    );

    return;

  }


  /*
    画像
  */

  if (
    IMAGE_EXTENSIONS
      .includes(extension)
  ) {

    await processImage(
      file
    );

    return;

  }


  throw new Error(
    `${file.name}：対応していないファイル形式です。`
  );

}


/* =========================================================
   画像登録
========================================================= */

async function processImage(
  file
) {

  const image =
    await loadImageFromBlob(
      file
    );


  const pageNo =
    await getNextPageNo();


  const path =
    `${pageTestId}/page-${String(pageNo).padStart(3,"0")}-${crypto.randomUUID()}.png`;


  /*
    解答用紙はPNGへ統一
  */

  const pngBlob =
    await convertImageToPng(
      file
    );


  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(
        "model-answers"
      )
      .upload(
        path,
        pngBlob,
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
      image.naturalWidth,

    height:
      image.naturalHeight

  });

}


/* =========================================================
   ZIP
========================================================= */

async function processZip(
  file
) {

  if (
    typeof JSZip ===
    "undefined"
  ) {

    throw new Error(
      "ZIP処理ライブラリが読み込まれていません。"
    );

  }


  const zip =
    await JSZip.loadAsync(
      file
    );


  const entries = [];


  for (
    const [
      path,
      entry
    ]
    of Object.entries(
      zip.files
    )
  ) {

    if (
      entry.dir
    ) {

      continue;

    }


    const extension =
      getExtension(
        path
      );


    if (
      ![
        ...IMAGE_EXTENSIONS,
        ...PDF_EXTENSIONS
      ].includes(
        extension
      )
    ) {

      continue;

    }


    const blob =
      await entry.async(
        "blob"
      );


    entries.push({

      path,

      name:
        path
          .split("/")
          .pop(),

      blob

    });

  }


  if (!entries.length) {

    throw new Error(
      "ZIP内に対応ファイルがありません。"
    );

  }


  entries.sort(
    (a, b) =>
      a.path.localeCompare(
        b.path,
        undefined,
        {
          numeric:
            true
        }
      )
  );


  for (
    const entry
    of entries
  ) {

    const extension =
      getExtension(
        entry.name
      );


    if (
      PDF_EXTENSIONS
        .includes(
          extension
        )
    ) {

      await processPdf(
        entry.blob,
        entry.name
      );

    } else {

      await processImage(
        entry.blob,
        entry.name
      );

    }

  }

}


/* =========================================================
   PDF
========================================================= */

async function processPdf(
  file,
  originalName
) {

  const pdf =
    await loadPdf(
      file
    );


  if (!pdf) {

    throw new Error(
      `${originalName || file.name}：PDFを読み込めませんでした。`
    );

  }


  for (
    let pageNo = 1;
    pageNo <= pdf.numPages;
    pageNo++
  ) {

    const page =
      await pdf.getPage(
        pageNo
      );


    /*
      高解像度
    */

    const viewport =
      page.getViewport({
        scale:
          2
      });


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      Math.ceil(
        viewport.width
      );


    canvas.height =
      Math.ceil(
        viewport.height
      );


    const context =
      canvas.getContext(
        "2d"
      );


    await page.render({

      canvasContext:
        context,

      viewport

    }).promise;


    const blob =
      await canvasToBlob(
        canvas
      );


    const nextPage =
      await getNextPageNo();


    const path =
      `${pageTestId}/page-${String(nextPage).padStart(3,"0")}-${crypto.randomUUID()}.png`;


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
          blob,
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

      pageNo:
        nextPage,

      path,

      width:
        canvas.width,

      height:
        canvas.height

    });

  }

}


/* =========================================================
   PDF.js
========================================================= */

async function loadPdf(
  blob
) {

  if (
    !window.pdfjsLib
  ) {

    await loadPdfJs();

  }


  if (
    !window.pdfjsLib
  ) {

    throw new Error(
      "PDF.jsを読み込めませんでした。"
    );

  }


  const buffer =
    await blob.arrayBuffer();


  return await window.pdfjsLib
    .getDocument({
      data:
        buffer
    })
    .promise;

}


async function loadPdfJs() {

  /*
    PDF.js 4.x は
    ESM版を使用する。
  */

  if (
    window.pdfjsLib
  ) {

    return;

  }


  const module =
    await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
    );


  window.pdfjsLib =
    module;

}


/* =========================================================
   次のページ番号
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
   画像をPNGへ
========================================================= */

async function convertImageToPng(
  blob
) {

  const image =
    await loadImageFromBlob(
      blob
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    image.naturalWidth;


  canvas.height =
    image.naturalHeight;


  const context =
    canvas.getContext(
      "2d"
    );


  context.drawImage(
    image,
    0,
    0
  );


  return await canvasToBlob(
    canvas
  );

}


/* =========================================================
   Blob画像
========================================================= */

function loadImageFromBlob(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      const url =
        URL.createObjectURL(
          blob
        );


      image.onload =
        () => {

          URL.revokeObjectURL(
            url
          );

          resolve(
            image
          );

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            url
          );

          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );

        };


      image.src =
        url;

    }
  );

}


/* =========================================================
   Canvas → PNG
========================================================= */

function canvasToBlob(
  canvas
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      canvas.toBlob(
        blob => {

          if (!blob) {

            reject(
              new Error(
                "画像変換に失敗しました。"
              )
            );

            return;

          }


          resolve(
            blob
          );

        },
        "image/png"
      );

    }
  );

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
        .select(
          "id,image_path"
        )
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

    console.error(error);

    showMessage(
      error.message ||
      "削除に失敗しました。",
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
   Logout
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
   拡張子
========================================================= */

function getExtension(
  filename
) {

  const clean =
    String(filename)
      .split("?")[0]
      .toLowerCase();


  const parts =
    clean.split(".");


  if (
    parts.length < 2
  ) {

    return "";

  }


  return parts
    .pop();

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
