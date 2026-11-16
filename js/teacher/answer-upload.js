
"use strict";

/* =========================================================
   答案アップロード

   生徒答案
   ---------------------------------------------------------
   ファイル
      ↓
   PDF / 画像 / ZIP解析
      ↓
   ページ画像
      ↓
   QR読み取り
      ↓
   生徒特定
      ↓
   answer_sheets
      ↓
   answer_sheet_pages
      ↓
   未紐付け / 紐付け済み

   模範解答
   ---------------------------------------------------------
   この画面では直接登録せず、
   模範解答画面へ移動。

   注意
   ---------------------------------------------------------
   ・QRで生徒を推測しない
   ・読めなければ未紐付け
   ・既存答案を勝手に別生徒へ変更しない
========================================================= */


/* =========================================================
   STATE
========================================================= */

let tests =
  [];

let students =
  [];

let selectedTestId =
  null;

let selectedAnswerType =
  "student";

let running =
  false;

let totalPages =
  0;

let completedPages =
  0;

let uploadedCount =
  0;

let matchedCount =
  0;

let unmatchedCount =
  0;


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "test"
  );

const answerTypeSelect =
  document.getElementById(
    "answerType"
  );

const fileInput =
  document.getElementById(
    "files"
  );

const uploadButton =
  document.getElementById(
    "uploadButton"
  );

const clearButton =
  document.getElementById(
    "clearButton"
  );

const fileList =
  document.getElementById(
    "fileList"
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

const message =
  document.getElementById(
    "message"
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

    const profile =
      await getProfile();


    if (!profile) {

      location.replace(
        "/login"
      );

      return;

    }


    if (
      profile.role !==
        "teacher" &&
      profile.role !==
        "admin"
    ) {

      location.replace(
        "/student/index.html"
      );

      return;

    }


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        profile.name ||
        "先生";

    }


    setupEvents();


    await loadTests();


    await loadStudents();

  } catch (error) {

    console.error(
      "answer-upload:",
      error
    );


    showMessage(
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

    }
  );


  answerTypeSelect?.addEventListener(
    "change",
    () => {

      selectedAnswerType =
        answerTypeSelect.value ||
        "student";


      /*
       * 模範解答を選んだ場合は
       * 専用画面へ誘導。
       */

      if (
        selectedAnswerType ===
        "model"
      ) {

        if (
          selectedTestId
        ) {

          location.href =
            `/teacher/tests/model-answer?test=${encodeURIComponent(
              selectedTestId
            )}`;

        }

      }

    }
  );


  fileInput?.addEventListener(
    "change",
    renderFileList
  );


  uploadButton?.addEventListener(
    "click",
    startUpload
  );


  clearButton?.addEventListener(
    "click",
    clearSelection
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
    data ||
    [];


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
                  .filter(
                    value =>
                      value !== null &&
                      value !== undefined &&
                      String(
                        value
                      ).trim() !== ""
                  )
                  .join(
                    " / "
                  )
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  const params =
    new URLSearchParams(
      location.search
    );


  const requestedTest =
    params.get(
      "test"
    );


  if (
    requestedTest &&
    tests.some(
      test =>
        test.id ===
        requestedTest
    )
  ) {

    testSelect.value =
      requestedTest;


    selectedTestId =
      requestedTest;

  }

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        active
        `
      )
      .eq(
        "active",
        true
      )
      .order(
        "student_no",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  students =
    data ||
    [];

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

    <strong>
      選択ファイル ${files.length}件
    </strong>

    <br><br>

    ${
      files
        .map(
          file => `

            <div class="file-item">

              ${escapeHtml(
                file.name
              )}

              /

              ${formatBytes(
                file.size
              )}

            </div>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   START
========================================================= */

async function startUpload() {

  if (running) {

    return;

  }


  if (!selectedTestId) {

    showMessage(
      "テストを選択してください。",
      true
    );

    return;

  }


  if (
    selectedAnswerType !==
    "student"
  ) {

    location.href =
      `/teacher/tests/model-answer?test=${encodeURIComponent(
        selectedTestId
      )}`;

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


  running =
    true;


  resetProgress();


  setControlsDisabled(
    true
  );


  try {

    /*
     * まず全ファイルをページ化。
     *
     * 3000人でもファイル単位で処理し、
     * 一度に大量の画像をメモリへ保持しない。
     */

    for (
      const file
      of files
    ) {

      addLog(
        `${file.name} を解析しています。`
      );


      const pages =
        await parseFile(
          file
        );


      if (!pages.length) {

        addLog(
          `${file.name}: ページがありません。`,
          true
        );


        continue;

      }


      totalPages +=
        pages.length;


      updateProgress();


      for (
        const page
        of pages
      ) {

        try {

          await uploadPage(
            page,
            file.name
          );


        } catch (error) {

          addLog(
            `${file.name} / ${page.pageNo}ページ: ${error.message}`,
            true
          );

        }


        completedPages++;


        updateProgress();


        /*
         * ブラウザを固めない。
         */

        await yieldBrowser();

      }

    }


    processingTitle.textContent =
      "アップロード完了";


    showSummary();


    showMessage(
      `処理完了：答案 ${uploadedCount}件 / 自動紐付け ${matchedCount}件 / 未紐付け ${unmatchedCount}件`
    );


  } catch (error) {

    console.error(
      "upload:",
      error
    );


    showMessage(
      error.message ||
      "アップロード処理に失敗しました。",
      true
    );


  } finally {

    running =
      false;


    setControlsDisabled(
      false
    );

  }

}


/* =========================================================
   PARSE
========================================================= */

async function parseFile(
  file
) {

  if (
    !window.TEST_SCORE_FILES?.parseFile
  ) {

    throw new Error(
      "ファイル解析ライブラリが読み込まれていません。"
    );

  }


  return await window.TEST_SCORE_FILES
    .parseFile(
      file
    );

}


/* =========================================================
   UPLOAD PAGE
========================================================= */

async function uploadPage(
  page,
  originalFileName
) {

  /*
   * QRを読む。
   */

  const qr =
    await readQrFromBlob(
      page.blob
    );


  const matchedStudent =
    findStudentByQr(
      qr
    );


  /*
   * 答案本体を作成。
   */

  const answerId =
    crypto.randomUUID();


  const status =
    matchedStudent
      ? "uploaded"
      : "unmatched";


  const storagePath =
    [
      selectedTestId,
      "answers",
      answerId,
      `page-${String(
        page.pageNo
      ).padStart(
        3,
        "0"
      )}.png`
    ].join(
      "/"
    );


  /*
   * 元答案画像をStorageへ。
   */

  const {
    error:
      uploadError
  } =
    await supabaseClient
      .storage
      .from(
        "answer-files"
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


  /*
   * answer_sheets
   *
   * 同一PDFの複数ページを
   * 1答案として扱う必要があるため、
   * ここではページ単位で作成する。
   *
   * 既存構造との互換を優先。
   */

  const {
    data:
      answer,
    error:
      answerError
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .insert({

        id:
          answerId,

        test_id:
          selectedTestId,

        student_id:
          matchedStudent?.id ||
          null,

        qr_value:
          qr ||
          null,

        status

      })
      .select(
        "id"
      )
      .single();


  if (answerError) {

    await removeStorage(
      storagePath
    );


    throw answerError;

  }


  /*
   * answer_sheet_pages
   */

  const {
    error:
      pageError
  } =
    await supabaseClient
      .from(
        "answer_sheet_pages"
      )
      .insert({

        answer_sheet_id:
          answer.id,

        page_no:
          Number(
            page.pageNo
          ) || 1,

        file_path:
          storagePath,

        file_type:
          "image/png",

        original_name:
          originalFileName,

        width_px:
          Number(
            page.width
          ) || null,

        height_px:
          Number(
            page.height
          ) || null

      });


  if (pageError) {

    await removeStorage(
      storagePath
    );


    await supabaseClient
      .from(
        "answer_sheets"
      )
      .delete()
      .eq(
        "id",
        answer.id
      );


    throw pageError;

  }


  uploadedCount++;


  if (
    matchedStudent
  ) {

    matchedCount++;


    addLog(
      `${originalFileName} / ${page.pageNo}ページ → 生徒自動紐付け済み`
    );


  } else {

    unmatchedCount++;


    addLog(
      `${originalFileName} / ${page.pageNo}ページ → QR未読取・未紐付け`,
      true
    );

  }

}


/* =========================================================
   QR
========================================================= */

async function readQrFromBlob(
  blob
) {

  if (
    typeof jsQR !==
    "function"
  ) {

    return null;

  }


  try {

    const image =
      await loadImage(
        blob
      );


    /*
     * QRは元画像全体を縮小しすぎない。
     *
     * 大きな答案でも
     * 最大1600px程度に抑える。
     */

    const maxSide =
      1600;


    const scale =
      Math.min(
        1,
        maxSide /
        Math.max(
          image.naturalWidth,
          image.naturalHeight
        )
      );


    const width =
      Math.max(
        1,
        Math.round(
          image.naturalWidth *
          scale
        )
      );


    const height =
      Math.max(
        1,
        Math.round(
          image.naturalHeight *
          scale
        )
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;


    canvas.height =
      height;


    const context =
      canvas.getContext(
        "2d",
        {
          willReadFrequently:
            true
        }
      );


    if (!context) {

      return null;

    }


    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );


    const imageData =
      context.getImageData(
        0,
        0,
        width,
        height
      );


    const result =
      jsQR(
        imageData.data,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    return cleanQr(
      result?.data ||
      null
    );

  } catch (error) {

    console.warn(
      "QR:",
      error
    );


    return null;

  }

}


/* =========================================================
   STUDENT MATCH
========================================================= */

function findStudentByQr(
  qr
) {

  if (!qr) {

    return null;

  }


  const clean =
    cleanQr(
      qr
    );


  if (!clean) {

    return null;

  }


  /*
   * 生徒番号完全一致。
   *
   * 部分一致は禁止。
   */

  return (
    students.find(
      student =>
        normalizeStudentNo(
          student.student_no
        ) ===
        normalizeStudentNo(
          clean
        )
    ) ||
    null
  );

}


/* =========================================================
   QR CLEAN
========================================================= */

function cleanQr(
  value
) {

  if (
    value ===
    null ||
    value ===
    undefined
  ) {

    return null;

  }


  const text =
    String(
      value
    )
      .trim();


  if (!text) {

    return null;

  }


  /*
   * JSON QRにも対応。
   */

  if (
    text.startsWith("{") &&
    text.endsWith("}")
  ) {

    try {

      const object =
        JSON.parse(
          text
        );


      return (
        object.student_no ||
        object.studentId ||
        object.student_id ||
        object.id ||
        null
      );

    } catch (_) {

      /* 通常文字列として続行 */

    }

  }


  return text;

}


/* =========================================================
   STUDENT NO NORMALIZE
========================================================= */

function normalizeStudentNo(
  value
) {

  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .toUpperCase();

}


/* =========================================================
   IMAGE
========================================================= */

function loadImage(
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
   STORAGE DELETE
========================================================= */

async function removeStorage(
  path
) {

  try {

    await supabaseClient
      .storage
      .from(
        "answer-files"
      )
      .remove([
        path
      ]);

  } catch (error) {

    console.warn(
      "Storage削除:",
      error
    );

  }

}


/* =========================================================
   PROGRESS
========================================================= */

function resetProgress() {

  totalPages =
    0;

  completedPages =
    0;

  uploadedCount =
    0;

  matchedCount =
    0;

  unmatchedCount =
    0;


  processingArea.classList.add(
    "show"
  );


  processingTitle.textContent =
    "処理中";


  processingLog.innerHTML =
    "";


  updateProgress();

}


function updateProgress() {

  const percent =
    totalPages > 0
      ? Math.round(
          completedPages /
          totalPages *
          100
        )
      : 0;


  progressBar.style.width =
    `${percent}%`;


  progressText.textContent =
    totalPages
      ? `${completedPages} / ${totalPages}ページ`
      : "解析中...";

}


/* =========================================================
   LOG
========================================================= */

function addLog(
  text,
  error = false
) {

  const row =
    document.createElement(
      "div"
    );


  row.className =
    error
      ? "log-row error"
      : "log-row success";


  row.textContent =
    text;


  processingLog.appendChild(
    row
  );


  processingLog.scrollTop =
    processingLog.scrollHeight;

}


/* =========================================================
   SUMMARY
========================================================= */

function showSummary() {

  const container =
    document.getElementById(
      "uploadList"
    );


  container.classList.add(
    "show"
  );


  document.getElementById(
    "uploadedCount"
  ).textContent =
    uploadedCount;


  document.getElementById(
    "matchedCount"
  ).textContent =
    matchedCount;


  document.getElementById(
    "unmatchedCount"
  ).textContent =
    unmatchedCount;

}


/* =========================================================
   CLEAR
========================================================= */

function clearSelection() {

  if (running) {

    return;

  }


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


  processingArea.classList.remove(
    "show"
  );


  document.getElementById(
    "uploadList"
  ).classList.remove(
    "show"
  );


  processingLog.innerHTML =
    "";


  showMessage(
    ""
  );

}


/* =========================================================
   CONTROLS
========================================================= */

function setControlsDisabled(
  disabled
) {

  if (testSelect) {

    testSelect.disabled =
      disabled;

  }


  if (answerTypeSelect) {

    answerTypeSelect.disabled =
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
        : "アップロード開始";

  }


  if (clearButton) {

    clearButton.disabled =
      disabled;

  }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  error = false
) {

  message.textContent =
    text;


  message.className =
    error
      ? "message error"
      : text
        ? "message success"
        : "message";

}


/* =========================================================
   YIELD
========================================================= */

function yieldBrowser() {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        0
      )
  );

}


/* =========================================================
   BYTES
========================================================= */

function formatBytes(
  bytes
) {

  const value =
    Number(
      bytes
    );


  if (
    !Number.isFinite(
      value
    )
  ) {

    return "0 B";

  }


  if (
    value <
    1024
  ) {

    return `${value} B`;

  }


  if (
    value <
    1024 *
    1024
  ) {

    return `${(
      value /
      1024
    ).toFixed(
      1
    )} KB`;

  }


  return `${(
    value /
    1024 /
    1024
  ).toFixed(
    1
  )} MB`;

}


/* =========================================================
   ESCAPE
========================================================= */

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
