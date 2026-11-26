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

let uploaderId = null;

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


/* =========================================================
   INIT
========================================================= */

let initializationStarted = false;

function startInitialization() {
  if (initializationStarted) return;
  initializationStarted = true;
  initialize();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startInitialization, { once: true });
} else {
  startInitialization();
}


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

    const { data: authUserData, error: authUserError } = await DB.auth.getUser();
    if (authUserError) throw authUserError;
    uploaderId = authUserData?.user?.id || auth.profile?.id || null;
    if (!uploaderId) {
      throw new Error("ログインユーザーを確認できませんでした。再ログインしてください。");
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

  // 処理中に対象テストやファイル選択が変わると、別テストへ混在するため固定する。
  if (testSelect) testSelect.disabled = true;
  if (answerType) answerType.disabled = true;
  if (fileInput) fileInput.disabled = true;
  if (clearButton) clearButton.disabled = true;

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

    uploading = false;
    if (testSelect) testSelect.disabled = false;
    if (answerType) answerType.disabled = false;
    if (fileInput) fileInput.disabled = false;
    if (clearButton) clearButton.disabled = false;

    updateState();

  }

}


/* =========================================================
   PROCESS ONE ANSWER
========================================================= */

async function processStudentAnswer(
  file
) {

  const parsed =
    await parseInputFile(
      file
    );


  if (
    !parsed?.length
  ) {

    throw new Error(
      "答案ページを取得できませんでした。"
    );

  }


  /*
   * まず答案レコードを作る。
   * QRが読めなくても unmatched として残す。
   */

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
          file.name,

        page_count:
          parsed.length,

        uploaded_by:
          uploaderId,

        qr_value:
          null

      })
      .select(
        `
        id,
        test_id,
        status
        `
      )
      .single();


  if (answerError) {

    throw answerError;

  }


  const uploadedPaths =
    [];


  try {

    /*
     * ページをStorageへ保存。
     */

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
     * ここが重要。
     *
     * 答案全体からQRを探さない。
     *
     * layout_boxes の
     * box_type = qr
     * の座標だけを取得する。
     */

    const qrValue =
      await readQrOnlyFromConfiguredRegions(
        parsed
      );


    if (qrValue) {

      await matchAnswerByQr(
        answer.id,
        qrValue
      );

    } else {

      /*
       * QRが無い / 読めない
       *
       * unmatched のまま。
       */

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
          answer.id
        );

    }


  } catch (error) {

    /*
     * 途中失敗ならStorageとDBを戻す。
     */

    if (
      uploadedPaths.length
    ) {

      await DB
        .storage
        .from(
          "test-files"
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

async function readQrOnlyFromConfiguredRegions(
  pages
) {

  /*
   * QR枠をDBから取得。
   */

  const {
    data,
    error
  } =
    await DB
      .from(
        "layout_boxes"
      )
      .select(
        `
        id,
        page_no,
        box_type,
        x,
        y,
        width,
        height
        `
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .eq(
        "box_type",
        "qr"
      );


  if (error) {

    throw error;

  }


  const qrBoxes =
    data || [];


  if (typeof jsQR !== "function") {
    console.warn("QR読み取りライブラリ(jsQR)が利用できないため、この答案は未紐付けで登録します。");
    return null;
  }


  for (
    const page
    of pages
  ) {

    const pageNo =
      pages.indexOf(
        page
      ) + 1;


    const pageBoxes =
      qrBoxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          pageNo
      );


    if (
      !pageBoxes.length
    ) {

      continue;

    }


    for (
      const box
      of pageBoxes
    ) {

      const value =
        await readQrFromRegion(
          page,
          box
        );


      if (value) {

        return value;

      }

    }

  }

  // QR枠が未設定、または枠内で読み取れない場合は
  // 誤照合を防ぐため自動照合せず、手動紐付けへ回す。
  return null;

}


/* =========================================================
   QR REGION
========================================================= */

async function readQrFromRegion(
  page,
  box
) {

  if (
    typeof jsQR !==
    "function"
  ) {

    console.warn(
      "jsQRが読み込まれていません。"
    );

    return null;

  }


  const image =
    await blobToImage(
      page.blob
    );


  const sourceWidth =
    image.naturalWidth;


  const sourceHeight =
    image.naturalHeight;


  /*
   * layout_boxesは原寸座標。
   */

  const x =
    clamp(
      Number(
        box.x
      ),
      0,
      sourceWidth
    );


  const y =
    clamp(
      Number(
        box.y
      ),
      0,
      sourceHeight
    );


  const width =
    clamp(
      Number(
        box.width
      ),
      1,
      sourceWidth -
      x
    );


  const height =
    clamp(
      Number(
        box.height
      ),
      1,
      sourceHeight -
      y
    );


  /*
   * 少しだけ余白を追加。
   * ただしQR枠外を大きく読むことはしない。
   */

  const padding =
    Math.round(
      Math.min(
        width,
        height
      ) *
      0.05
    );


  const cropX =
    Math.max(
      0,
      x -
      padding
    );


  const cropY =
    Math.max(
      0,
      y -
      padding
    );


  const cropRight =
    Math.min(
      sourceWidth,
      x +
      width +
      padding
    );


  const cropBottom =
    Math.min(
      sourceHeight,
      y +
      height +
      padding
    );


  const cropWidth =
    cropRight -
    cropX;


  const cropHeight =
    cropBottom -
    cropY;


  /*
   * QRが小さい場合に備えて
   * 最大1600px程度まで拡大。
   */

  const scale =
    Math.min(
      4,
      Math.max(
        1,
        800 /
        Math.max(
          cropWidth,
          cropHeight
        )
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.round(
      cropWidth *
      scale
    );


  canvas.height =
    Math.round(
      cropHeight *
      scale
    );


  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  context.imageSmoothingEnabled =
    false;


  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
   * まず通常。
   */

  let result =
    scanQrCanvas(
      canvas
    );


  if (result) {

    return normalizeQr(
      result
    );

  }


  /*
   * 反転も試す。
   */

  result =
    scanQrCanvas(
      canvas,
      true
    );


  if (result) {

    return normalizeQr(
      result
    );

  }


  return null;

}


/* =========================================================
   QR SCAN
========================================================= */

function scanQrCanvas(
  canvas,
  invert = false
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


  if (!invert) {

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


  /*
   * 反転画像。
   */

  const pixels =
    imageData.data;


  for (
    let i = 0;
    i <
    pixels.length;
    i += 4
  ) {

    pixels[i] =
      255 -
      pixels[i];

    pixels[i + 1] =
      255 -
      pixels[i + 1];

    pixels[i + 2] =
      255 -
      pixels[i + 2];

  }


  const result =
    jsQR(
      pixels,
      imageData.width,
      imageData.height,
      {
        inversionAttempts:
          "dontInvert"
      }
    );


  return result?.data ||
    null;

}


/* =========================================================
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
