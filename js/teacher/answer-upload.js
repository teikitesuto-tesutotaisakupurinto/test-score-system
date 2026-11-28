"use strict";

/* =========================================================
   答案アップロード

   重要仕様
   ---------------------------------------------------------
   1. テストを選択してからアップロード
   2. ?test=UUID があれば自動選択
   3. PDF / 画像 / ZIP
   4. 1ファイル = 1答案
   5. QRは答案全体を読まない
   6. layout_boxes の box_type = "qr" の範囲だけ読む
   7. QRが読めなければ unmatched
   8. QRが読めれば matched
   9. 手動紐付けも unmatched → matched
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;

let uploading = false;
let authUserId = null;


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


    authUserId = auth.user?.id || null;

    if (!authUserId) {
      throw new Error("ログインユーザーIDを取得できません。再ログインしてください。");
    }

    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


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


  if (!testSelect) {

    throw new Error(
      "テスト選択欄が見つかりません。"
    );

  }


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


  if (
    !fileList
  ) {

    return;

  }


  if (!files.length) {

    fileList.hidden =
      true;

    fileList.innerHTML =
      "";

    updateState();

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


  updateState();

}


/* =========================================================
   STATE
========================================================= */

function updateState() {

  if (!uploadButton) {

    return;

  }


  const ready =
    Boolean(
      selectedTestId
    ) &&
    Boolean(
      fileInput?.files?.length
    ) &&
    !uploading;


  uploadButton.disabled =
    !ready;

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


        console.error(
          file.name,
          error
        );


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


    if (processingTitle) {

      processingTitle.textContent =
        "処理完了";

    }


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
   PROCESS ONE ANSWER
========================================================= */

async function processStudentAnswer(
  file
) {
  const parsed = await parseInputFile(file);
  if (!parsed?.length) {
    throw new Error("答案ページを取得できませんでした。");
  }

  // 元PDF/画像もStorageへ保存し、DBには実在するStorageパスを記録する。
  const safeName = String(file.name || "answer")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 100) || "answer";
  const token = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const originalPath = [
    selectedTestId,
    "originals",
    `${token}-${safeName}`
  ].join("/");

  const { error: originalUploadError } = await DB
    .storage
    .from("test-files")
    .upload(originalPath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false
    });

  if (originalUploadError) throw originalUploadError;

  const {
    data: answer,
    error: answerError
  } = await DB
    .from("answer_sheets")
    .insert({
      test_id: selectedTestId,
      uploaded_by: authUserId,
      uploaded_at: new Date().toISOString(),
      page_count: parsed.length,
      status: "unmatched",
      original_file_path: originalPath,
      qr_value: null
    })
    .select("id,test_id,status")
    .single();

  if (answerError) {
    await DB.storage.from("test-files").remove([originalPath]);
    throw answerError;
  }

  // 元ファイルも含め、途中失敗時にアップロード分をすべてロールバックする。
  const uploadedPaths = [originalPath];

  try {
    for (let index = 0; index < parsed.length; index++) {
      const page = parsed[index];
      const pageNo = index + 1;
      const path = [
        selectedTestId,
        answer.id,
        `page-${String(pageNo).padStart(3, "0")}.png`
      ].join("/");

      const { error } = await DB
        .storage
        .from("test-files")
        .upload(path, page.blob, {
          contentType: "image/png",
          cacheControl: "3600",
          upsert: false
        });

      if (error) throw error;
      uploadedPaths.push(path);

      const { error: pageError } = await DB
        .from("answer_sheet_pages")
        .insert({
          answer_sheet_id: answer.id,
          page_no: pageNo,
          file_path: path,
          file_type: "image/png",
          original_name: file.name,
          width_px: Number(page.width) || null,
          height_px: Number(page.height) || null
        });

      if (pageError) throw pageError;
    }

    // QR判定失敗は答案登録全体を取り消さない。未紐付けとして必ず残す。
    let qrValue = null;
    let qrReadWarning = null;
    try {
      qrValue = await readQrOnlyFromConfiguredRegions(parsed);
    } catch (qrError) {
      qrReadWarning = qrError;
      console.warn("QR読取のみ失敗。答案は未紐付けで保持します。", qrError);
    }

    if (qrValue) {
      await matchAnswerByQr(answer.id, qrValue);
    } else {
      const { error: unmatchedError } = await DB
        .from("answer_sheets")
        .update({ status: "unmatched", qr_value: null })
        .eq("id", answer.id);
      if (unmatchedError) throw unmatchedError;
      if (qrReadWarning) console.warn("QR読取エラー:", qrReadWarning.message);
    }
  } catch (error) {
    const { error: storageCleanupError } = await DB
      .storage
      .from("test-files")
      .remove(uploadedPaths);

    if (storageCleanupError) {
      console.error("答案Storageのロールバックに失敗しました。", storageCleanupError);
    }

    const { error: pagesCleanupError } = await DB
      .from("answer_sheet_pages")
      .delete()
      .eq("answer_sheet_id", answer.id);

    if (pagesCleanupError) {
      console.error("答案ページDBのロールバックに失敗しました。", pagesCleanupError);
    }

    const { error: answerCleanupError } = await DB
      .from("answer_sheets")
      .delete()
      .eq("id", answer.id);

    if (answerCleanupError) {
      console.error("答案レコードのロールバックに失敗しました。", answerCleanupError);
    }

    throw error;
  }
}

/* =========================================================
   FULL PAGE QR FALLBACK
========================================================= */

async function readQrFromWholePage(page) {
  const image = await blobToImage(page.blob);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return null;

  const scale = Math.min(2, 2200 / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("QR読み取り用Canvasを作成できませんでした。");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let value = scanQrCanvas(canvas);
  if (value) return value;
  value = scanQrCanvas(canvas, true);
  return value || null;
}


/* =========================================================
   QR REGIONS
========================================================= */

async function readQrOnlyFromConfiguredRegions(pages) {
  const { data: qrBoxes, error: boxError } = await DB.from("layout_boxes")
    .select("id,page_no,box_type,x,y,width,height")
    .eq("test_id", selectedTestId)
    .eq("box_type", "qr");
  if (boxError) throw boxError;
  if (typeof jsQR !== "function") throw new Error("QR読み取りライブラリ(jsQR)を読み込めませんでした。");

  const { data: templatePages, error: templateError } = await DB.from("test_pages")
    .select("page_no,width_px,height_px")
    .eq("test_id", selectedTestId);
  if (templateError) throw templateError;

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const pageNo = index + 1;
    const image = await blobToImage(page.blob);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    if (!sourceWidth || !sourceHeight) continue;

    const template = (templatePages || []).find(row => Number(row.page_no) === pageNo);
    const templateWidth = Number(template?.width_px) || sourceWidth;
    const templateHeight = Number(template?.height_px) || sourceHeight;
    const scaleX = sourceWidth / templateWidth;
    const scaleY = sourceHeight / templateHeight;

    const pageBoxes = (qrBoxes || []).filter(box => Number(box.page_no) === pageNo);
    for (const box of pageBoxes) {
      const scaledBox = {
        ...box,
        x: Number(box.x) * scaleX,
        y: Number(box.y) * scaleY,
        width: Number(box.width) * scaleX,
        height: Number(box.height) * scaleY
      };
      const value = await readQrFromRegion(page, scaledBox);
      if (value) return value;
    }

    // 登録枠内で読めない場合も、答案全体を縮小して再走査する。
    const wholePageValue = await readQrFromWholePage(page);
    if (wholePageValue) return normalizeQr(wholePageValue);
  }
  return null;
}

/* =========================================================
   QR REGION
========================================================= */

async function readQrFromRegion(page, box) {
  if (typeof jsQR !== "function") return null;
  const image = await blobToImage(page.blob);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) return null;

  const rawX = Number(box.x), rawY = Number(box.y);
  const rawWidth = Number(box.width), rawHeight = Number(box.height);
  if (![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite) || rawWidth <= 0 || rawHeight <= 0) return null;

  const x = Math.max(0, Math.min(sourceWidth - 1, Math.floor(rawX)));
  const y = Math.max(0, Math.min(sourceHeight - 1, Math.floor(rawY)));
  const right = Math.max(x + 1, Math.min(sourceWidth, Math.ceil(rawX + rawWidth)));
  const bottom = Math.max(y + 1, Math.min(sourceHeight, Math.ceil(rawY + rawHeight)));
  const cropWidth = right - x, cropHeight = bottom - y;
  if (cropWidth <= 0 || cropHeight <= 0) return null;

  const padding = Math.round(Math.min(cropWidth, cropHeight) * 0.05);
  const cropX = Math.max(0, x - padding), cropY = Math.max(0, y - padding);
  const cropRight = Math.min(sourceWidth, right + padding);
  const cropBottom = Math.min(sourceHeight, bottom + padding);
  const actualWidth = cropRight - cropX, actualHeight = cropBottom - cropY;
  if (actualWidth <= 0 || actualHeight <= 0) return null;

  const scale = Math.min(4, Math.max(1, 800 / Math.max(actualWidth, actualHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(actualWidth * scale));
  canvas.height = Math.max(1, Math.round(actualHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("QR読み取り用Canvasを作成できませんでした。");
  context.imageSmoothingEnabled = false;
  context.drawImage(image, cropX, cropY, actualWidth, actualHeight, 0, 0, canvas.width, canvas.height);
  return normalizeQr(scanQrCanvas(canvas) || scanQrCanvas(canvas, true) || "");
}

/* =========================================================
   QR SCAN
========================================================= */

function scanQrCanvas(canvas, invert = false) {
  if (!canvas || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width < 1 || canvas.height < 1) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  if (!imageData.width || !imageData.height || !imageData.data?.length) return null;
  const pixels = imageData.data;
  if (invert) {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255 - pixels[i];
      pixels[i + 1] = 255 - pixels[i + 1];
      pixels[i + 2] = 255 - pixels[i + 2];
    }
  }
  const result = jsQR(pixels, imageData.width, imageData.height, {
    inversionAttempts: invert ? "dontInvert" : "attemptBoth"
  });
  return result?.data || null;
}

MATCH BY QR
========================================================= */

async function matchAnswerByQr(
  answerId,
  qrValue
) {

  const value =
    normalizeQr(
      qrValue
    );


  if (!value) {

    return;

  }


  /*
   * QR形式:
   *
   * STUDENT:123456
   *
   * または
   *
   * 123456
   *
   * または既存シール形式
   * 26447_2_1
   */

  const studentNo =
    value
      .replace(
        /^STUDENT:/i,
        ""
      )
      .trim();


  /*
   * まずstudent_no完全一致。
   */

  let student = null;

  // 発行済みQRの実値(qr_token)を優先して照合する。
  const {
    data: tokenStudent,
    error: tokenError
  } = await DB
    .from("students")
    .select("id,student_no,name,active,qr_token")
    .eq("active", true)
    .eq("qr_token", value)
    .maybeSingle();

  if (tokenError) throw tokenError;
  student = tokenStudent || null;

  // 旧形式 STUDENT:<生徒番号> と生徒番号直書きにも対応。
  if (!student) {
    const studentNo = value.replace(/^STUDENT:/i, "").trim();
    const candidates = [studentNo];
    const legacyParts = studentNo.match(/^(\d+)_\d+_\d+$/);
    if (legacyParts && legacyParts[1] !== studentNo) candidates.push(legacyParts[1]);

    for (const candidateNo of candidates) {
      const {
        data: numberStudent,
        error: numberError
      } = await DB
        .from("students")
        .select("id,student_no,name,active,qr_token")
        .eq("active", true)
        .eq("student_no", candidateNo)
        .maybeSingle();

      if (numberError) throw numberError;
      if (numberStudent) {
        student = numberStudent;
        break;
      }
    }
  }


  /*
   * 既存QR値を保存している場合に備えて
   * students側のQR列があれば別処理に拡張可能。
   */

  if (!student) {

    const { error: unmatchedError } = await DB
      .from("answer_sheets")
      .update({ qr_value: value, status: "unmatched" })
      .eq("id", answerId);

    if (unmatchedError) throw unmatchedError;
    return;

  }


  /*
   * QR成功
   *
   * matchedへ統一する。
   * matchedへ統一。
   */

  const {
    error:
      updateError
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .update({

        student_id:
          student.id,

        qr_value:
          value,

        status: "matched"

      })
      .eq(
        "id",
        answerId
      );


  if (updateError) {

    throw updateError;

  }

}


/* =========================================================
   FILE PARSER
========================================================= */

async function parseInputFile(
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
   UI
========================================================= */

function showProcessing() {

  if (
    !processingArea
  ) {

    return;

  }


  processingArea.hidden =
    false;


  if (processingTitle) {

    processingTitle.textContent =
      "処理中";

  }


  if (processingLog) {

    processingLog.innerHTML =
      "";

  }


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


  if (progressBar) {

    progressBar.style.width =
      `${percent}%`;

  }


  if (progressText) {

    progressText.textContent =
      text;

  }

}


function addLog(
  text,
  error = false
) {

  if (
    !processingLog
  ) {

    return;

  }


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

  if (!messageElement) {

    return;

  }


  messageElement.textContent =
    text;


  messageElement.style.color =
    error
      ? "#b42318"
      : "#16834b";

}


function clearMessage() {

  if (
    messageElement
  ) {

    messageElement.textContent =
      "";

  }

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeQr(
  value
) {

  return String(
    value ||
    ""
  )
    .trim();

}


function clamp(
  value,
  min,
  max
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return min;

  }


  return Math.max(
    min,
    Math.min(
      max,
      number
    )
  );

}


function blobToImage(blob) {
  if (!(blob instanceof Blob) || blob.size === 0) return Promise.reject(new Error("画像データが空です。"));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("画像サイズが0です。ファイルを開ける画像形式か確認してください。"));
        return;
      }
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    image.src = url;
  });
}

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
