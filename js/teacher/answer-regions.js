
"use strict";

/* =========================================================
   答案クロップ処理

   テストを選択
      ↓
   answer枠取得
      ↓
   全答案取得
      ↓
   answer_sheet_pages取得
      ↓
   Storageから元画像をdownload
      ↓
   layout_boxesの座標で実クロップ
      ↓
   student-answersへ保存
      ↓
   answer_regionsへ保存

   注意
   ---------------------------------------------------------
   question_idはNULLでも保存可能。
   採点対象の判定はbox_type=answerで行う。
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;

let selectedTest = null;

let running = false;

let totalCount = 0;

let completedCount = 0;

let successCount = 0;

let errorCount = 0;


/* =========================================================
   DOM
========================================================= */

const $ = id =>
  document.getElementById(id);


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


    const authResult =
      await requireRole(
        "teacher"
      );


    if (!authResult) {

      return;

    }


    const teacherName =
      $("teacherName");


    if (teacherName) {

      teacherName.textContent =
        authResult.profile?.name ||
        "先生";

    }


    setupEvents();

    await loadTests();


    const params =
      new URLSearchParams(
        location.search
      );


    const requestedTest =
      params.get("test") ||
      params.get("id");


    if (
      requestedTest &&
      tests.some(
        test =>
          test.id ===
          requestedTest
      )
    ) {

      $("testSelect").value =
        requestedTest;


      selectedTestId =
        requestedTest;


      await selectTest();

    }

  } catch (error) {

    console.error(
      "answer-regions initialize:",
      error
    );


    showStatus(
      error.message ||
      "答案クロップ処理を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  $("testSelect")
    ?.addEventListener(
      "change",
      async event => {

        selectedTestId =
          event.target.value ||
          null;


        await selectTest();

      }
    );


  /*
   * regions.htmlのボタン。
   *
   * executeButtonでもsaveButtonでも動くようにする。
   */

  const executeButton =
    $("executeButton");


  const saveButton =
    $("saveButton");


  executeButton?.addEventListener(
    "click",
    startCrop
  );


  saveButton?.addEventListener(
    "click",
    startCrop
  );


  $("logoutButton")
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
      .from("tests")
      .select(`
        id,
        name,
        subject,
        grade,
        class_name,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    throw new Error(
      `テスト一覧取得エラー: ${error.message}`
    );

  }


  tests =
    data || [];


  const select =
    $("testSelect");


  if (!select) {

    return;

  }


  select.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

  `;


  tests.forEach(
    test => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        test.id;


      option.textContent =
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
          );


      select.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   TEST SELECT
========================================================= */

async function selectTest() {

  clearResults();


  if (!selectedTestId) {

    selectedTest =
      null;


    setStatus(
      "テストを選択してください。"
    );


    return;

  }


  selectedTest =
    tests.find(
      test =>
        test.id ===
        selectedTestId
    ) ||
    null;


  if (!selectedTest) {

    showStatus(
      "テストが見つかりません。",
      true
    );

    return;

  }


  try {

    await renderTestInformation();

    await loadSummary();

  } catch (error) {

    showStatus(
      error.message ||
      "テスト情報を取得できませんでした。",
      true
    );

  }

}


/* =========================================================
   TEST INFORMATION
========================================================= */

async function renderTestInformation() {

  const element =
    $("testInformation");


  if (!element || !selectedTest) {

    return;

  }


  element.innerHTML = `

    <strong>
      ${escapeHtml(
        selectedTest.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      selectedTest.subject ||
      "-"
    )}

    ／

    学年：
    ${escapeHtml(
      selectedTest.grade ||
      "-"
    )}

    ／

    クラス：
    ${escapeHtml(
      selectedTest.class_name ||
      "-"
    )}

  `;

}


/* =========================================================
   SUMMARY
========================================================= */

async function loadSummary() {

  if (!selectedTestId) {

    return;

  }


  const [
    boxesResult,
    answersResult,
    pagesResult,
    regionsResult
  ] =
    await Promise.all([

      DB
        .from("layout_boxes")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .eq(
          "test_id",
          selectedTestId
        )
        .eq(
          "box_type",
          "answer"
        ),

      DB
        .from("answer_sheets")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .eq(
          "test_id",
          selectedTestId
        )
        .not(
          "student_id",
          "is",
          null
        ),

      DB
        .from("answer_sheet_pages")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .in(
          "answer_sheet_id",
          await getAnswerIds()
        ),

      DB
        .from("answer_regions")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )

    ]);


  if (boxesResult.error) {

    throw boxesResult.error;

  }


  if (answersResult.error) {

    throw answersResult.error;

  }


  if (pagesResult.error) {

    throw pagesResult.error;

  }


  const summary =
    $("summary");


  if (!summary) {

    return;

  }


  summary.style.display =
    "block";


  summary.innerHTML = `

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:12px;
      "
    >

      <div>
        <small>解答欄</small>
        <br>
        <strong>
          ${boxesResult.count || 0}
        </strong>
        個
      </div>

      <div>
        <small>答案</small>
        <br>
        <strong>
          ${answersResult.count || 0}
        </strong>
        枚
      </div>

      <div>
        <small>答案ページ</small>
        <br>
        <strong>
          ${pagesResult.count || 0}
        </strong>
        ページ
      </div>

      <div>
        <small>クロップ済み</small>
        <br>
        <strong>
          ${regionsResult.count || 0}
        </strong>
        件
      </div>

    </div>

  `;

}


/* =========================================================
   ANSWER IDS
========================================================= */

async function getAnswerIds() {

  if (!selectedTestId) {

    return [];

  }


  const {
    data,
    error
  } =
    await DB
      .from("answer_sheets")
      .select(
        "id"
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .not(
        "student_id",
        "is",
        null
      );


  if (error) {

    throw error;

  }


  return (
    data || []
  ).map(
    item =>
      item.id
  );

}


/* =========================================================
   START
========================================================= */

async function startCrop() {

  if (!selectedTestId) {

    showStatus(
      "テストを選択してください。",
      true
    );

    return;

  }


  if (running) {

    return;

  }


  running =
    true;


  resetCounters();


  setButtonsDisabled(
    true
  );


  try {

    await buildRegions(
      selectedTestId
    );


    await loadSummary();


    if (
      errorCount ===
      0
    ) {

      showStatus(
        `クロップ完了：${successCount}件`
      );

    } else {

      showStatus(
        `クロップ完了：成功 ${successCount}件 / 失敗 ${errorCount}件`,
        true
      );

    }

  } catch (error) {

    console.error(
      "buildRegions:",
      error
    );


    showStatus(
      error.message ||
      "クロップ処理に失敗しました。",
      true
    );

  } finally {

    running =
      false;


    setButtonsDisabled(
      false
    );

  }

}


/* =========================================================
   BUILD REGIONS
========================================================= */

async function buildRegions(
  currentTestId
) {

  /*
   * 解答欄
   */

  setStatus(
    "解答欄を取得しています..."
  );


  const {
    data: rawBoxes,
    error: boxError
  } =
    await DB
      .from("layout_boxes")
      .select(`
        id,
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height,
        question_id,
        points,
        sort_order
      `)
      .eq(
        "test_id",
        currentTestId
      )
      .eq(
        "box_type",
        "answer"
      )
      .order(
        "page_no",
        {
          ascending:true
        }
      )
      .order(
        "sort_order",
        {
          ascending:true
        }
      );


  if (boxError) {

    throw boxError;

  }


  const excludedLabels =
    new Set([
      "QR",
      "氏名",
      "合計",
      "小計"
    ]);


  const boxes =
    (
      rawBoxes ||
      []
    )
      .filter(
        box =>
          !excludedLabels.has(
            String(
              box.label ||
              ""
            ).trim()
          )
      );


  if (!boxes.length) {

    throw new Error(
      "採点対象の解答欄がありません。"
    );

  }


  /*
   * 答案
   */

  setStatus(
    "答案を取得しています..."
  );


  const {
    data: answers,
    error: answerError
  } =
    await DB
      .from("answer_sheets")
      .select(`
        id,
        student_id,
        status
      `)
      .eq(
        "test_id",
        currentTestId
      )
      .not(
        "student_id",
        "is",
        null
      )
      .order(
        "created_at",
        {
          ascending:true
        }
      );


  if (answerError) {

    throw answerError;

  }


  if (!answers?.length) {

    throw new Error(
      "生徒に紐付いた答案がありません。"
    );

  }


  totalCount =
    answers.length *
    boxes.length;


  updateProgress();


  /*
   * 3000人でもブラウザを固めにくくするため、
   * 1答案ごとに処理する。
   */

  for (
    const answer
    of answers
  ) {

    let answerPages;


    try {

      answerPages =
        await loadAnswerPages(
          answer.id
        );

    } catch (error) {

      for (
        const box
        of boxes
      ) {

        completedCount++;

        errorCount++;


        addResult(
          answer,
          box,
          "答案ページ取得失敗",
          true
        );


        updateProgress();

      }


      continue;

    }


    for (
      const box
      of boxes
    ) {

      completedCount++;


      try {

        const page =
          answerPages.find(
            item =>
              Number(
                item.page_no
              ) ===
              Number(
                box.page_no
              )
          );


        if (!page) {

          throw new Error(
            `ページ${box.page_no}がありません。`
          );

        }


        if (!page.file_path) {

          throw new Error(
            "答案ページのfile_pathがありません。"
          );

        }


        const blob =
          await cropAnswerImage(
            page.file_path,
            page,
            box
          );


        const storagePath =
          `${currentTestId}/${answer.id}/${box.id}.png`;


        const {
          error:
            uploadError
        } =
          await DB
            .storage
            .from(
              "student-answers"
            )
            .upload(
              storagePath,
              blob,
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


        const values = {

          answer_sheet_id:
            answer.id,

          layout_box_id:
            box.id,

          /*
           * question_idはNULLでもOK。
           */

          question_id:
            box.question_id ||
            null,

          page_no:
            Number(
              box.page_no
            ) || 1,

          image_path:
            storagePath,

          x:
            Number(
              box.x
            ) || 0,

          y:
            Number(
              box.y
            ) || 0,

          width:
            Number(
              box.width
            ) || 0,

          height:
            Number(
              box.height
            ) || 0

        };


        const {
          data:
            existing,
          error:
            existingError
        } =
          await DB
            .from(
              "answer_regions"
            )
            .select(
              "id"
            )
            .eq(
              "answer_sheet_id",
              answer.id
            )
            .eq(
              "layout_box_id",
              box.id
            )
            .maybeSingle();


        if (existingError) {

          throw existingError;

        }


        if (existing) {

          const {
            error
          } =
            await DB
              .from(
                "answer_regions"
              )
              .update(
                values
              )
              .eq(
                "id",
                existing.id
              );


          if (error) {

            throw error;

          }

        } else {

          const {
            error
          } =
            await DB
              .from(
                "answer_regions"
              )
              .insert(
                values
              );


          if (error) {

            throw error;

          }

        }


        successCount++;


        addResult(
          answer,
          box,
          "クロップ完了"
        );


      } catch (error) {

        errorCount++;


        console.error(
          "crop:",
          error
        );


        addResult(
          answer,
          box,
          error.message ||
          "クロップ失敗",
          true
        );

      }


      updateProgress();

    }

  }


  return successCount;

}


/* =========================================================
   ANSWER PAGES
========================================================= */

async function loadAnswerPages(
  answerId
) {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheet_pages"
      )
      .select(`
        id,
        answer_sheet_id,
        page_no,
        file_path,
        file_type,
        original_name,
        width_px,
        height_px
      `)
      .eq(
        "answer_sheet_id",
        answerId
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


  return data || [];

}


/* =========================================================
   CROP
========================================================= */

async function cropAnswerImage(
  filePath,
  page,
  box
) {

  /*
   * 旧処理の
   *
   * createSignedUrl()
   * ↓
   * Image
   * ↓
   * Canvas.toBlob()
   *
   * は使用しない。
   *
   * Storage.download()でBlobを直接取得する。
   */

  const {
    data:
      sourceBlob,
    error
  } =
    await DB
      .storage
      .from(
        "answer-files"
      )
      .download(
        filePath
      );


  if (error) {

    throw new Error(
      `答案画像取得エラー: ${error.message}`
    );

  }


  if (!sourceBlob) {

    throw new Error(
      "答案画像を取得できませんでした。"
    );

  }


  const objectUrl =
    URL.createObjectURL(
      sourceBlob
    );


  try {

    const image =
      await loadImage(
        objectUrl
      );


    /*
     * layout_boxesの座標が
     * 元ページの座標系。
     *
     * width_px / height_px があれば
     * 実画像との倍率を補正する。
     */

    const sourceWidth =
      Number(
        page.width_px
      ) || 0;


    const sourceHeight =
      Number(
        page.height_px
      ) || 0;


    const scaleX =
      sourceWidth > 0
        ? image.naturalWidth /
          sourceWidth
        : 1;


    const scaleY =
      sourceHeight > 0
        ? image.naturalHeight /
          sourceHeight
        : 1;


    const x =
      Math.max(
        0,
        Math.round(
          (
            Number(
              box.x
            ) || 0
          ) *
          scaleX
        )
      );


    const y =
      Math.max(
        0,
        Math.round(
          (
            Number(
              box.y
            ) || 0
          ) *
          scaleY
        )
      );


    const requestedWidth =
      Math.round(
        (
          Number(
            box.width
          ) || 0
        ) *
        scaleX
      );


    const requestedHeight =
      Math.round(
        (
          Number(
            box.height
          ) || 0
        ) *
        scaleY
      );


    const cropWidth =
      Math.min(
        requestedWidth,
        image.naturalWidth -
          x
      );


    const cropHeight =
      Math.min(
        requestedHeight,
        image.naturalHeight -
          y
      );


    if (
      cropWidth <= 0 ||
      cropHeight <= 0
    ) {

      throw new Error(
        [
          "枠が答案画像の範囲外です。",
          `画像=${image.naturalWidth}x${image.naturalHeight}`,
          `枠=${x},${y},${requestedWidth},${requestedHeight}`
        ].join(
          " "
        )
      );

    }


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      cropWidth;


    canvas.height =
      cropHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    if (!context) {

      throw new Error(
        "Canvasを初期化できませんでした。"
      );

    }


    context.drawImage(

      image,

      x,
      y,

      cropWidth,
      cropHeight,

      0,
      0,

      cropWidth,
      cropHeight

    );


    return await canvasToBlob(
      canvas
    );

  } finally {

    URL.revokeObjectURL(
      objectUrl
    );

  }

}


/* =========================================================
   IMAGE
========================================================= */

function loadImage(
  source
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        () => {

          if (
            image.naturalWidth <=
            0 ||
            image.naturalHeight <=
            0
          ) {

            reject(
              new Error(
                "画像サイズを取得できませんでした。"
              )
            );

            return;

          }


          resolve(
            image
          );

        };


      image.onerror =
        () => {

          reject(
            new Error(
              "答案画像を読み込めませんでした。"
            )
          );

        };


      image.src =
        source;

    }
  );

}


/* =========================================================
   BLOB
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
                "クロップ画像の生成に失敗しました。"
              )
            );

            return;

          }


          resolve(
            blob
          );

        },
        "image/png",
        1
      );

    }
  );

}


/* =========================================================
   RESULT
========================================================= */

function addResult(
  answer,
  box,
  message,
  error = false
) {

  const list =
    $("resultList");


  if (!list) {

    return;

  }


  const item =
    document.createElement(
      "div"
    );


  item.className =
    error
      ? "result-item error"
      : "result-item success";


  item.textContent =
    [
      box?.label ||
      "解答欄",
      message
    ].join(
      " / "
    );


  list.prepend(
    item
  );

}


/* =========================================================
   PROGRESS
========================================================= */

function resetCounters() {

  totalCount =
    0;

  completedCount =
    0;

  successCount =
    0;

  errorCount =
    0;


  clearResults();

}


function updateProgress() {

  const progress =
    $("cropProgress");


  const counter =
    $("cropCounter");


  const box =
    $("cropProgressBox");


  if (box) {

    box.classList.add(
      "show"
    );

  }


  if (progress) {

    progress.max =
      Math.max(
        1,
        totalCount
      );


    progress.value =
      completedCount;

  }


  if (counter) {

    counter.textContent =
      `${completedCount} / ${totalCount}`;

  }

}


/* =========================================================
   CLEAR
========================================================= */

function clearResults() {

  const list =
    $("resultList");


  if (list) {

    list.innerHTML =
      "";

  }


  const box =
    $("cropProgressBox");


  if (box) {

    box.classList.remove(
      "show"
    );

  }

}


/* =========================================================
   BUTTONS
========================================================= */

function setButtonsDisabled(
  disabled
) {

  const select =
    $("testSelect");


  const execute =
    $("executeButton");


  const save =
    $("saveButton");


  if (select) {

    select.disabled =
      disabled;

  }


  if (execute) {

    execute.disabled =
      disabled;

    execute.textContent =
      disabled
        ? "クロップ中..."
        : "答案を問題別に切り出す";

  }


  if (save) {

    save.disabled =
      disabled;

    save.textContent =
      disabled
        ? "クロップ中..."
        : "クロップ開始";

  }

}


/* =========================================================
   STATUS
========================================================= */

function showStatus(
  message,
  error = false
) {

  const element =
    $("status");


  if (!element) {

    return;

  }


  element.textContent =
    message;


  element.className =
    error
      ? "status error"
      : "status";

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
