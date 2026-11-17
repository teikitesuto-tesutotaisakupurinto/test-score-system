
"use strict";

/* =========================================================
   答案アップロード

   ・先生 / 管理者のみ
   ・テスト選択
   ・?test=UUID の自動選択
   ・複数ファイル
   ・PDF / 画像 / ZIP
   ・answer_sheets
   ・answer_sheet_pages
   ・QRによる生徒紐付け
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;

let uploading = false;


/* =========================================================
   DOM
========================================================= */

const teacherName =
  document.getElementById(
    "teacherName"
  );

const testSelect =
  document.getElementById(
    "test"
  );

const answerType =
  document.getElementById(
    "answerType"
  );

const fileInput =
  document.getElementById(
    "files"
  );

const fileList =
  document.getElementById(
    "fileList"
  );

const uploadButton =
  document.getElementById(
    "uploadButton"
  );

const clearButton =
  document.getElementById(
    "clearButton"
  );

const messageElement =
  document.getElementById(
    "message"
  );

const processingArea =
  document.getElementById(
    "processingArea"
  );

const processingTitle =
  document.getElementById(
    "processingTitle"
  );

const progressBar =
  document.getElementById(
    "progressBar"
  );

const progressText =
  document.getElementById(
    "progressText"
  );

const processingLog =
  document.getElementById(
    "processingLog"
  );

const uploadList =
  document.getElementById(
    "uploadList"
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


    teacherName.textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


    await loadTests();


    selectTestFromUrl();


    updateState();


  } catch (error) {

    console.error(
      "answer-upload initialize:",
      error
    );


    showMessage(
      error.message ||
      "答案アップロード画面を読み込めませんでした。",
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


      updateState();

    }
  );


  answerType?.addEventListener(
    "change",
    updateState
  );


  fileInput?.addEventListener(
    "change",
    renderFileList
  );


  uploadButton?.addEventListener(
    "click",
    uploadFiles
  );


  clearButton?.addEventListener(
    "click",
    clearFiles
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
        class_name,
        test_date,
        status
        `
      )
      .order(
        "created_at",
        {
          ascending: false
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
                formatTestName(
                  test
                )
              )}

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   URL TEST
========================================================= */

function selectTestFromUrl() {

  const params =
    new URLSearchParams(
      location.search
    );


  const testId =
    params.get(
      "test"
    );


  if (!testId) {

    return;

  }


  const exists =
    tests.some(
      test =>
        test.id ===
        testId
    );


  if (!exists) {

    showMessage(
      "URLで指定されたテストが見つかりません。",
      true
    );

    return;

  }


  selectedTestId =
    testId;


  testSelect.value =
    testId;

}


/* =========================================================
   FILE LIST
========================================================= */

function renderFileList() {

  const files =
    [
      ...(fileInput?.files || [])
    ];


  if (!files.length) {

    fileList.hidden =
      true;

    fileList.innerHTML =
      "";

    return;

  }


  fileList.hidden =
    false;


  fileList.innerHTML = `

    <div
      style="
        padding:10px;
        margin-top:10px;
        background:#f5f6f7;
        border:1px solid #d5dbe0;
      "
    >

      <strong>
        選択ファイル ${files.length}件
      </strong>

      <div
        style="
          margin-top:7px;
          line-height:1.7;
        "
      >

        ${
          files
            .map(
              (
                file,
                index
              ) => `

                <div>

                  ${index + 1}.
                  ${escapeHtml(
                    file.name
                  )}

                </div>

              `
            )
            .join("")
        }

      </div>

    </div>

  `;

}


/* =========================================================
   STATE
========================================================= */

function updateState() {

  const ready =
    Boolean(
      selectedTestId
    ) &&
    Boolean(
      fileInput?.files?.length
    ) &&
    !uploading;


  if (uploadButton) {

    uploadButton.disabled =
      !ready;

  }

}


/* =========================================================
   UPLOAD
========================================================= */

async function uploadFiles() {

  if (uploading) {

    return;

  }


  if (!selectedTestId) {

    showMessage(
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

    showMessage(
      "答案ファイルを選択してください。",
      true
    );

    return;

  }


  if (
    answerType?.value ===
    "model"
  ) {

    location.href =
      `/teacher/tests/model-answer?test=${encodeURIComponent(
        selectedTestId
      )}`;

    return;

  }


  uploading =
    true;


  updateState();


  showProcessing();


  clearMessage();


  let success =
    0;

  let failed =
    0;


  try {

    for (
      let index = 0;
      index <
      files.length;
      index++
    ) {

      const file =
        files[index];


      setProgress(
        index,
        files.length,
        `処理中: ${file.name}`
      );


      try {

        await processStudentAnswer(
          file
        );


        success++;


        addLog(
          `完了: ${file.name}`
        );


      } catch (error) {

        failed++;


        addLog(
          `失敗: ${file.name} - ${
            error.message
          }`,
          true
        );

      }


      await nextFrame();

    }


    setProgress(
      files.length,
      files.length,
      "処理完了"
    );


    processingTitle.textContent =
      "処理完了";


    if (failed) {

      showMessage(
        `${success}件完了、${failed}件失敗しました。`,
        true
      );

    } else {

      showMessage(
        `${success}件の答案を登録しました。`
      );

    }


  } finally {

    uploading =
      false;


    updateState();

  }

}


/* =========================================================
   PROCESS ANSWER
========================================================= */

async function processStudentAnswer(
  file
) {

  const parsed =
    await parseFile(
      file
    );


  if (
    !parsed?.length
  ) {

    throw new Error(
      "ページを取得できませんでした。"
    );

  }


  const {
    data:answer,
    error:answerError
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .insert({

        test_id:
          selectedTestId,

        status:
          "unmatched",

        original_file_path:
          null,

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
      parsed.length;
      index++
    ) {

      const page =
        parsed[index];


      const pageNo =
        index + 1;


      const path =
        [
          selectedTestId,
          answer.id,
          `page-${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}.png`
        ].join(
          "/"
        );


      const {
        error
      } =
        await DB
          .storage
          .from(
            "test-files"
          )
          .upload(
            path,
            page.blob,
            {
              contentType:
                "image/png",

              cacheControl:
                "3600",

              upsert:
                false
            }
          );


      if (error) {

        throw error;

      }


      uploadedPaths.push(
        path
      );


      const {
        error:
          pageError
      } =
        await DB
          .from(
            "answer_sheet_pages"
          )
          .insert({

            answer_sheet_id:
              answer.id,

            page_no:
              pageNo,

            file_path:
              path,

            file_type:
              "image/png",

            original_name:
              file.name,

            width_px:
              Number(
                page.width
              ) ||
              null,

            height_px:
              Number(
                page.height
              ) ||
              null

          });


      if (pageError) {

        throw pageError;

      }

    }


    /*
     * QRは読めた場合のみ自動紐付け。
     * 読めなくても答案自体は残す。
     */

    const qr =
      await detectQr(
        parsed
      );


    if (qr) {

      await matchStudent(
        answer.id,
        qr
      );

    }


  } catch (error) {

    await DB
      .storage
      .from(
        "test-files"
      )
      .remove(
        uploadedPaths
      );


    await DB
      .from(
        "answer_sheet_pages"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answer.id
      );


    await DB
      .from(
        "answer_sheets"
      )
      .delete()
      .eq(
        "id",
        answer.id
      );


    throw error;

  }

}


/* =========================================================
   PARSER
========================================================= */

async function parseFile(
  file
) {

  if (
    window.TEST_SCORE_FILES?.parseFile
  ) {

    return await window.TEST_SCORE_FILES
      .parseFile(
        file
      );

  }


  throw new Error(
    "ファイル解析ライブラリが読み込まれていません。"
  );

}


/* =========================================================
   QR
========================================================= */

async function detectQr(
  pages
) {

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


    const data =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );


    const result =
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
      result?.data
    ) {

      return result.data.trim();

    }

  }


  return null;

}


/* =========================================================
   MATCH STUDENT
========================================================= */

async function matchStudent(
  answerId,
  qrValue
) {

  const value =
    String(
      qrValue ||
      ""
    )
      .trim()
      .replace(
        /^STUDENT:/i,
        ""
      );


  if (!value) {

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
        value
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
          value,

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
        value,

      status:
        "uploaded"

    })
    .eq(
      "id",
      answerId
    );

}


/* =========================================================
   PROCESS UI
========================================================= */

function showProcessing() {

  processingArea.hidden =
    false;


  processingTitle.textContent =
    "処理中";


  processingLog.innerHTML =
    "";


  setProgress(
    0,
    1,
    "開始しています..."
  );

}


function setProgress(
  current,
  total,
  text
) {

  const percent =
    total > 0
      ? Math.round(
          current /
          total *
          100
        )
      : 0;


  progressBar.style.width =
    `${percent}%`;


  progressText.textContent =
    text;

}


function addLog(
  text,
  error = false
) {

  const element =
    document.createElement(
      "div"
    );


  element.textContent =
    text;


  if (error) {

    element.style.color =
      "#b42318";

  }


  processingLog.appendChild(
    element
  );


  processingLog.scrollTop =
    processingLog.scrollHeight;

}


/* =========================================================
   CLEAR
========================================================= */

function clearFiles() {

  if (fileInput) {

    fileInput.value =
      "";

  }


  if (fileList) {

    fileList.hidden =
      true;

    fileList.innerHTML =
      "";

  }


  if (processingArea) {

    processingArea.hidden =
      true;

  }


  clearMessage();


  updateState();

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  error = false
) {

  messageElement.textContent =
    text;


  messageElement.style.color =
    error
      ? "#b42318"
      : "#16834b";

}


function clearMessage() {

  messageElement.textContent =
    "";

}


/* =========================================================
   UTIL
========================================================= */

function formatTestName(
  test
) {

  return [
    test.name,
    test.subject,
    test.grade,
    test.class_name
  ]
    .filter(Boolean)
    .join(
      " / "
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


function nextFrame() {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        0
      )
  );

}


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
