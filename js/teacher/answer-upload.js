/* =========================================================
   答案アップロード完全版

   対応
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
   画像/PDF
   ↓
   ページ化
   ↓
   answer_sheets
   ↓
   answer_sheet_pages
   ↓
   QR
   ↓
   生徒紐付け
========================================================= */


let uploadTests = [];


/* =========================================================
   対応形式
========================================================= */

const SUPPORTED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp"
];


const SUPPORTED_PDF_EXTENSIONS = [
  "pdf"
];


const SUPPORTED_ARCHIVE_EXTENSIONS = [
  "zip"
];


/* =========================================================
   初期化
========================================================= */

async function initializeAnswerUpload() {

  const profile =
    await getProfile();


  if (!profile) {

    location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    location.href =
      "/student/dashboard";

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  await loadTests();

}


/* =========================================================
   テスト
========================================================= */

async function loadTests() {

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
        status
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    showMessage(
      "テスト一覧を取得できませんでした。",
      true
    );

    return;

  }


  uploadTests =
    data || [];


  const select =
    document.getElementById(
      "testSelect"
    );


  select.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      uploadTests
        .map(
          test => `

            <option
              value="${test.id}"
            >

              ${escapeHtml(
                test.name
              )}

              ${
                test.subject
                  ? ` / ${escapeHtml(test.subject)}`
                  : ""
              }

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   アップロード
========================================================= */

document
  .getElementById(
    "uploadButton"
  )
  .addEventListener(
    "click",
    async () => {

      const testId =
        document.getElementById(
          "testSelect"
        ).value;


      const files =
        [
          ...
          document.getElementById(
            "answerFiles"
          ).files
        ];


      if (!testId) {

        showMessage(
          "テストを選択してください。",
          true
        );

        return;

      }


      if (!files.length) {

        showMessage(
          "ファイルを選択してください。",
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
        "処理中...";


      clearUploadList();


      try {

        for (
          const file
          of files
        ) {

          await processUploadFile(
            testId,
            file
          );

        }


        showMessage(
          "すべてのファイルの処理が完了しました。"
        );


      } catch (error) {

        console.error(error);

        showMessage(
          error.message ||
          "アップロードに失敗しました。",
          true
        );

      }


      button.disabled =
        false;

      button.textContent =
        "アップロード開始";

    }
  );


/* =========================================================
   1ファイル処理
========================================================= */

async function processUploadFile(
  testId,
  file
) {

  const row =
    createUploadRow(
      file.name
    );


  try {

    const extension =
      getExtension(
        file.name
      );


    /*
      ZIP
    */

    if (
      SUPPORTED_ARCHIVE_EXTENSIONS
        .includes(extension)
    ) {

      await processZip(
        testId,
        file,
        row
      );

      return;

    }


    /*
      PDF
    */

    if (
      SUPPORTED_PDF_EXTENSIONS
        .includes(extension)
    ) {

      await processPdf(
        testId,
        file,
        row
      );

      return;

    }


    /*
      画像
    */

    if (
      SUPPORTED_IMAGE_EXTENSIONS
        .includes(extension)
    ) {

      await processImage(
        testId,
        file,
        row
      );

      return;

    }


    throw new Error(
      "対応していないファイル形式です。"
    );


  } catch (error) {

    console.error(error);

    setRowStatus(
      row,
      error.message ||
      "処理失敗",
      true
    );

  }

}


/* =========================================================
   ZIP
========================================================= */

async function processZip(
  testId,
  file,
  row
) {

  setRowStatus(
    row,
    "ZIP展開中..."
  );


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
        ...SUPPORTED_IMAGE_EXTENSIONS,
        ...SUPPORTED_PDF_EXTENSIONS
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

      name:
        path
          .split("/")
          .pop(),

      path,

      blob

    });

  }


  if (!entries.length) {

    throw new Error(
      "ZIP内に対応ファイルがありません。"
    );

  }


  setRowStatus(
    row,
    `${entries.length}ファイル展開`
  );


  /*
    ZIP内の順番を安定させる
  */

  entries.sort(
    (a, b) =>
      a.path.localeCompare(
        b.path,
        undefined,
        {
          numeric: true
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
      SUPPORTED_PDF_EXTENSIONS
        .includes(extension)
    ) {

      await processPdfBlob(
        testId,
        entry.blob,
        entry.name,
        row
      );

    } else {

      await processImageBlob(
        testId,
        entry.blob,
        entry.name,
        row
      );

    }

  }


  setRowStatus(
    row,
    "ZIP処理完了"
  );

}


/* =========================================================
   画像
========================================================= */

async function processImage(
  testId,
  file,
  row
) {

  await processImageBlob(
    testId,
    file,
    file.name,
    row
  );


  setRowStatus(
    row,
    "画像処理完了"
  );

}


async function processImageBlob(
  testId,
  blob,
  originalName,
  row
) {

  /*
    画像をStorageへ保存
  */

  const path =
    `${testId}/raw/${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;


  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(
        "answer-files"
      )
      .upload(
        path,
        blob,
        {
          upsert: false
        }
      );


  if (uploadError) {

    throw uploadError;

  }


  /*
    画像サイズ
  */

  const image =
    await loadImageFromBlob(
      blob
    );


  /*
    答案1件作成
  */

  const answer =
    await createAnswerSheet(
      testId,
      path,
      originalName
    );


  /*
    ページ1
  */

  await createAnswerPage(
    answer.id,
    1,
    path,
    originalName,
    image.naturalWidth,
    image.naturalHeight,
    blob.type
  );


  /*
    QR読み取り
  */

  setRowStatus(
    row,
    `${originalName}：QR読み取り中...`
  );


  const qr =
    await readQRCodeFromBlob(
      blob
    );


  if (qr) {

    await matchAnswerByQr(
      answer.id,
      qr
    );

  }


}


/* =========================================================
   PDF
========================================================= */

async function processPdf(
  testId,
  file,
  row
) {

  await processPdfBlob(
    testId,
    file,
    file.name,
    row
  );


  setRowStatus(
    row,
    "PDF処理完了"
  );

}


async function processPdfBlob(
  testId,
  blob,
  originalName,
  row
) {

  const pdf =
    await loadPdf(
      blob
    );


  if (!pdf) {

    throw new Error(
      "PDFを読み込めませんでした。"
    );

  }


  /*
    PDFは1ページごとに
    PNGとして保存
  */

  const answer =
    await createAnswerSheet(
      testId,
      null,
      originalName
    );


  let detectedStudent =
    null;


  for (
    let pageNo = 1;
    pageNo <= pdf.numPages;
    pageNo++
  ) {

    const page =
      await pdf.getPage(
        pageNo
      );


    const viewport =
      page.getViewport({
        scale: 2
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


    const pageBlob =
      await canvasToBlob(
        canvas
      );


    const pagePath =
      `${testId}/raw/${answer.id}/page-${String(pageNo).padStart(3,"0")}.png`;


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "answer-files"
        )
        .upload(
          pagePath,
          pageBlob,
          {
            contentType:
              "image/png",

            upsert:
              true
          }
        );


    if (uploadError) {

      throw uploadError;

    }


    await createAnswerPage(
      answer.id,
      pageNo,
      pagePath,
      originalName,
      canvas.width,
      canvas.height,
      "image/png"
    );


    /*
      QRは全ページを確認
    */

    if (!detectedStudent) {

      const qr =
        await readQRCodeFromBlob(
          pageBlob
        );


      if (qr) {

        detectedStudent =
          qr;

      }

    }

  }


  if (detectedStudent) {

    await matchAnswerByQr(
      answer.id,
      detectedStudent
    );

  }


}


/* =========================================================
   PDF.js
========================================================= */

async function loadPdf(
  blob
) {

  /*
    PDF.jsを動的ロード
  */

  if (
    !window.pdfjsLib
  ) {

    await loadPdfJs();

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

  if (
    window.pdfjsLib
  ) {

    return;

  }


  await new Promise(
    (
      resolve,
      reject
    ) => {

      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";


      script.type =
        "module";


      script.onload =
        resolve;


      script.onerror =
        reject;


      document.head.appendChild(
        script
      );

    }
  );

}


/* =========================================================
   答案作成
========================================================= */

async function createAnswerSheet(
  testId,
  filePath,
  originalName
) {

  const session =
    await getSession();


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .insert({

        test_id:
          testId,

        original_file_path:
          filePath,

        status:
          "unmatched",

        uploaded_by:
          session.user.id

      })
      .select()
      .single();


  if (error) {

    throw error;

  }


  return data;

}


/* =========================================================
   答案ページ
========================================================= */

async function createAnswerPage(
  answerId,
  pageNo,
  filePath,
  originalName,
  width,
  height,
  fileType
) {

  const {
    error
  } =
    await supabaseClient
      .from(
        "answer_sheet_pages"
      )
      .upsert(
        {

          answer_sheet_id:
            answerId,

          page_no:
            pageNo,

          file_path:
            filePath,

          file_type:
            fileType,

          original_name:
            originalName,

          width_px:
            width,

          height_px:
            height

        },
        {
          onConflict:
            "answer_sheet_id,page_no"
        }
      );


  if (error) {

    throw error;

  }

}


/* =========================================================
   QR
========================================================= */

async function readQRCodeFromBlob(
  blob
) {

  if (
    typeof jsQR ===
    "undefined"
  ) {

    return null;

  }


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


  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );


  const result =
    jsQR(
      imageData.data,
      imageData.width,
      imageData.height,
      {
        inversionAttempts:
          "attemptBoth"
      }
    );


  return result?.data ||
    null;

}


/* =========================================================
   QR → 生徒
========================================================= */

async function matchAnswerByQr(
  answerId,
  qrValue
) {

  if (
    !qrValue
  ) {

    return false;

  }


  const prefix =
    "STUDENT:";


  if (
    !qrValue.startsWith(
      prefix
    )
  ) {

    return false;

  }


  const studentNo =
    qrValue
      .substring(
        prefix.length
      )
      .trim();


  if (
    !/^\d{6}$/.test(
      studentNo
    )
  ) {

    return false;

  }


  const {
    data: student,
    error
  } =
    await supabaseClient
      .from(
        "students"
      )
      .select(`
        id,
        student_no,
        name
      `)
      .eq(
        "student_no",
        studentNo
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!student) {

    return false;

  }


  const {
    error: updateError
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .update({

        student_id:
          student.id,

        qr_value:
          qrValue,

        status:
          "matched"

      })
      .eq(
        "id",
        answerId
      );


  if (updateError) {

    throw updateError;

  }


  return true;

}


/* =========================================================
   画像読み込み
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
   Canvas → Blob
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

          if (blob) {

            resolve(
              blob
            );

          } else {

            reject(
              new Error(
                "画像変換に失敗しました。"
              )
            );

          }

        },
        "image/png"
      );

    }
  );

}


/* =========================================================
   ファイル名
========================================================= */

function sanitizeFileName(
  filename
) {

  return filename
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

}


function getExtension(
  filename
) {

  const clean =
    filename
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
   UI
========================================================= */

function createUploadRow(
  name
) {

  const container =
    document.getElementById(
      "uploadList"
    );


  const row =
    document.createElement(
      "div"
    );


  row.style.cssText = `
    padding:10px;
    margin-bottom:6px;
    border:1px solid #d0d6dc;
    background:#fff;
  `;


  row.innerHTML = `

    <strong>
      ${escapeHtml(name)}
    </strong>

    <span
      class="upload-status"
      style="
        margin-left:15px;
        color:#777;
      "
    >
      待機中
    </span>

  `;


  container.appendChild(
    row
  );


  return row;

}


function setRowStatus(
  row,
  text,
  error = false
) {

  const status =
    row.querySelector(
      ".upload-status"
    );


  status.textContent =
    text;


  status.style.color =
    error
      ? "#c62828"
      : "#16834b";

}


function clearUploadList() {

  document.getElementById(
    "uploadList"
  ).innerHTML =
    "";

}


function showMessage(
  text,
  error = false
) {

  const element =
    document.getElementById(
      "message"
    );


  element.textContent =
    text;


  element.style.color =
    error
      ? "#c62828"
      : "#16834b";

}


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


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


initializeAnswerUpload();
