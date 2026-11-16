
"use strict";

/* =========================================================
   答案アップロード

   PDF / 画像 / ZIP
        ↓
   ページ画像化
        ↓
   Storage
        ↓
   answer_sheets
        ↓
   answer_sheet_pages
        ↓
   QR解析
        ↓
   生徒自動紐付け
        ↓
   uploaded / unmatched

   採点画面では
   uploaded の答案を対象にする。
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;

let uploading = false;


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "testSelect"
  );


const fileInput =
  document.getElementById(
    "answerFiles"
  );


const uploadButton =
  document.getElementById(
    "uploadButton"
  );


const statusElement =
  document.getElementById(
    "status"
  );


const progressElement =
  document.getElementById(
    "progress"
  );


const progressBar =
  document.getElementById(
    "progressBar"
  );


const progressText =
  document.getElementById(
    "progressText"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


    await loadTests();


    selectTestFromUrl();


  } catch (error) {

    console.error(
      "answer-upload:",
      error
    );


    setStatus(
      error.message ||
      "答案アップロード画面を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    () => {

      selectedTestId =
        testSelect.value ||
        null;


      updateUploadButton();

    }
  );


  uploadButton?.addEventListener(
    "click",
    uploadAnswers
  );


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

}


/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "tests"
      )
      .select(
        `
        id,
        name,
        subject,
        grade,
        class_name
        `
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    throw error;

  }


  tests =
    data || [];


  testSelect.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      tests
        .map(
          test => `

            <option
              value="${escapeHtml(
                test.id
              )}"
            >

              ${escapeHtml(
                [
                  test.name,
                  test.subject,
                  test.grade,
                  test.class_name
                ]
                  .filter(Boolean)
                  .join(" / ")
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  updateUploadButton();

}


/* =========================================================
   URL
========================================================= */

function selectTestFromUrl() {

  const params =
    new URLSearchParams(
      location.search
    );


  const requested =
    params.get(
      "test"
    );


  if (
    requested &&
    tests.some(
      test =>
        test.id ===
        requested
    )
  ) {

    selectedTestId =
      requested;


    testSelect.value =
      requested;


    updateUploadButton();

  }

}


/* =========================================================
   UPLOAD
========================================================= */

async function uploadAnswers() {

  if (uploading) {

    return;

  }


  if (!selectedTestId) {

    setStatus(
      "テストを選択してください。",
      true
    );

    return;

  }


  const files =
    [
      ...(fileInput?.files || [])
    ];


  if (!files.length) {

    setStatus(
      "答案ファイルを選択してください。",
      true
    );

    return;

  }


  uploading =
    true;


  setControlsDisabled(
    true
  );


  showProgress(
    0,
    files.length
  );


  let completed =
    0;


  let success =
    0;


  let failed =
    0;


  try {

    for (
      const file
      of files
    ) {

      try {

        await processFile(
          file
        );


        success++;


      } catch (error) {

        console.error(
          `答案処理失敗: ${file.name}`,
          error
        );


        failed++;


      }


      completed++;


      updateProgress(
        completed,
        files.length
      );


      /*
       * 大量答案でもUIを固めない。
       */

      await yieldBrowser();

    }


    if (
      failed
    ) {

      setStatus(
        `${success}ファイルを処理しました。${failed}ファイルは失敗しました。`,
        true
      );

    } else {

      setStatus(
        `${success}ファイルの答案登録が完了しました。`
      );

    }


  } finally {

    uploading =
      false;


    setControlsDisabled(
      false
    );

  }

}


/* =========================================================
   PROCESS FILE
========================================================= */

async function processFile(
  file
) {

  if (
    !window.TEST_SCORE_FILES
  ) {

    throw new Error(
      "ファイル解析エンジンが読み込まれていません。"
    );

  }


  const pages =
    await window.TEST_SCORE_FILES
      .parseFile(
        file
      );


  if (!pages?.length) {

    throw new Error(
      `${file.name} に有効なページがありません。`
    );

  }


  /*
   * 1ファイル = 1答案。
   *
   * ZIPの場合は内部の全ページを
   * 1答案として登録する。
   */

  const answerId =
    crypto.randomUUID();


  const {
    data:answer,
    error:answerError
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .insert({

        id:
          answerId,

        test_id:
          selectedTestId,

        status:
          "unmatched",

        qr_value:
          null

      })
      .select()
      .single();


  if (answerError) {

    throw answerError;

  }


  const uploadedPaths =
    [];


  try {

    for (
      let index = 0;
      index <
      pages.length;
      index++
    ) {

      const page =
        pages[index];


      const pageNo =
        index + 1;


      const safeName =
        sanitizeFileName(
          file.name
        );


      const path =
        [
          selectedTestId,
          answerId,
          `${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}_${safeName}.png`
        ].join(
          "/"
        );


      const {
        error:uploadError
      } =
        await DB
          .storage
          .from(
            "answer-files"
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


      uploadedPaths.push(
        path
      );


      const {
        error:pageError
      } =
        await DB
          .from(
            "answer_sheet_pages"
          )
          .insert({

            answer_sheet_id:
              answerId,

            page_no:
              pageNo,

            file_path:
              path,

            width_px:
              page.width ||
              null,

            height_px:
              page.height ||
              null,

            file_type:
              "image/png",

            original_name:
              page.name ||
              file.name

          });


      if (pageError) {

        throw pageError;

      }

    }


    /*
     * QRを読み取れる場合は
     * 生徒を自動紐付け。
     */

    const qrValue =
      await detectQrFromPages(
        pages
      );


    if (qrValue) {

      await matchByQr(
        answerId,
        qrValue
      );

    } else {

      await DB
        .from(
          "answer_sheets"
        )
        .update({

          status:
            "unmatched"

        })
        .eq(
          "id",
          answerId
        );

    }


  } catch (error) {

    /*
     * 失敗した答案を残さない。
     */

    if (
      uploadedPaths.length
    ) {

      await DB
        .storage
        .from(
          "answer-files"
        )
        .remove(
          uploadedPaths
        );

    }


    await DB
      .from(
        "answer_sheet_pages"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerId
      );


    await DB
      .from(
        "answer_sheets"
      )
      .delete()
      .eq(
        "id",
        answerId
      );


    throw error;

  }

}


/* =========================================================
   QR
========================================================= */

async function detectQrFromPages(
  pages
) {

  /*
   * QRライブラリが無い環境では
   * QR未読取として扱う。
   */

  if (
    typeof jsQR !==
    "function"
  ) {

    return null;

  }


  for (
    const page
    of pages
  ) {

    try {

      const image =
        await blobToImage(
          page.blob
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
          "2d",
          {
            willReadFrequently:
              true
          }
        );


      context.drawImage(
        image,
        0,
        0
      );


      /*
       * 原寸を直接読ませる。
       *
       * QRが小さい場合は
       * 左上・右上・左下・右下を
       * 順に拡大して試す。
       */

      const result =
        scanCanvas(
          canvas
        );


      if (
        result
      ) {

        return normalizeQrValue(
          result
        );

      }

    } catch (error) {

      console.warn(
        "QR scan:",
        error
      );

    }

  }


  return null;

}


/* =========================================================
   QR SCAN
========================================================= */

function scanCanvas(
  canvas
) {

  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
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


  if (
    result?.data
  ) {

    return result.data;

  }


  /*
   * 画像全体で取れない場合、
   * 四隅を走査。
   */

  const size =
    Math.min(
      canvas.width,
      canvas.height
    );


  const areas = [

    [0, 0],

    [
      canvas.width -
        size,
      0
    ],

    [
      0,
      canvas.height -
        size
    ],

    [
      canvas.width -
        size,
      canvas.height -
        size
    ]

  ];


  for (
    const [
      left,
      top
    ]
    of areas
  ) {

    const data =
      context.getImageData(
        left,
        top,
        size,
        size
      );


    const found =
      jsQR(
        data.data,
        data.width,
        data.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (
      found?.data
    ) {

      return found.data;

    }

  }


  return null;

}


/* =========================================================
   MATCH QR
========================================================= */

async function matchByQr(
  answerId,
  qrValue
) {

  const normalized =
    normalizeQrValue(
      qrValue
    );


  if (!normalized) {

    return;

  }


  /*
   * STUDENT:123456
   * または
   * 123456
   */

  const studentNo =
    normalized
      .replace(
        /^STUDENT:/i,
        ""
      )
      .trim();


  if (!studentNo) {

    return;

  }


  const {
    data:student,
    error
  } =
    await DB
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        active
        `
      )
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

    await DB
      .from(
        "answer_sheets"
      )
      .update({

        qr_value:
          normalized,

        status:
          "unmatched"

      })
      .eq(
        "id",
        answerId
      );


    return;

  }


  await DB
    .from(
      "answer_sheets"
    )
    .update({

      student_id:
        student.id,

      qr_value:
        normalized,

      status:
        "uploaded"

    })
    .eq(
      "id",
      answerId
    );

}


/* =========================================================
   UTIL
========================================================= */

function normalizeQrValue(
  value
) {

  return String(
    value ||
    ""
  )
    .trim();

}


function sanitizeFileName(
  value
) {

  return String(
    value ||
    ""
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

}


function blobToImage(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const url =
        URL.createObjectURL(
          blob
        );


      const image =
        new Image();


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


function updateUploadButton() {

  if (!uploadButton) {

    return;

  }


  uploadButton.disabled =
    !selectedTestId ||
    uploading;

}


function setControlsDisabled(
  disabled
) {

  if (testSelect) {

    testSelect.disabled =
      disabled;

  }


  if (fileInput) {

    fileInput.disabled =
      disabled;

  }


  if (uploadButton) {

    uploadButton.disabled =
      disabled;


    uploadButton.textContent =
      disabled
        ? "処理中..."
        : "答案をアップロード";

  }

}


function showProgress(
  current,
  total
) {

  if (!progressElement) {

    return;

  }


  progressElement.style.display =
    "block";


  updateProgress(
    current,
    total
  );

}


function updateProgress(
  current,
  total
) {

  const percent =
    total > 0
      ? Math.round(
          current /
          total *
          100
        )
      : 0;


  if (progressBar) {

    progressBar.style.width =
      `${percent}%`;

  }


  if (progressText) {

    progressText.textContent =
      `${current} / ${total} (${percent}%)`;

  }

}


function setStatus(
  text,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


function yieldBrowser() {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        0
      )
  );

}
