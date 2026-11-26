
"use strict";

/* =========================================================
   答案確認・生徒紐付け

   ・QR自動紐付け済み答案を確認
   ・未紐付け答案を手動紐付け
   ・紐付け変更時は既存answer_regionsを削除
   ・再クロップを実行
   ・生徒情報はこの管理画面では確認可能
   ・採点画面には生徒情報を渡さない
========================================================= */

let DB = null;

let tests = [];

let students = [];

let answers = [];

let selectedTestId = null;

let selectedStatus = "all";


const $ = id =>
  document.getElementById(id);


document.addEventListener(
  "DOMContentLoaded",
  initialize
);


/* =========================================================
   INIT
========================================================= */

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


    $("teacherName").textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();

    await loadTests();

    await loadStudents();


    const params =
      new URLSearchParams(
        location.search
      );


    const requested =
      params.get(
        "test"
      );


    selectedTestId =
      requested && tests.some(test => test.id === requested)
        ? requested
        : "all";

    $("testSelect").value = selectedTestId;
    selectedStatus = $("statusSelect")?.value || "unmatched";
    await loadAnswers();

  } catch (error) {

    console.error(
      "answer-matched:",
      error
    );


    showError(
      error.message ||
      "答案確認画面を読み込めませんでした。"
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
          String(
            event.target.value ||
            ""
          ).trim() ||
          null;


        selectedStatus =
          $("statusSelect")?.value ||
          "all";


        await loadAnswers();

      }
    );


  $("statusSelect")
    ?.addEventListener(
      "change",
      () => {

        selectedStatus =
          $("statusSelect").value ||
          "all";


        renderAnswers();

      }
    );


  $("reloadButton")
    ?.addEventListener(
      "click",
      loadAnswers
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
        created_at
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


  $("testSelect").innerHTML = `

    <option value="all">
      すべてのテスト
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

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

  const {
    data,
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
        name,
        active,
        qr_token
        `
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
    data || [];

}


/* =========================================================
   ANSWERS
========================================================= */

async function loadAnswers() {

  if (!selectedTestId) {

    answers =
      [];

    renderAnswers();

    setStatus(
      "テストを選択してください。"
    );

    return;

  }


  setStatus(
    "答案を読み込んでいます..."
  );


  let answerQuery = DB
    .from("answer_sheets")
    .select(`
      id,
      test_id,
      student_id,
      qr_value,
      status,
      created_at,
      uploaded_at
    `);

  if (selectedTestId && selectedTestId !== "all") {
    answerQuery = answerQuery.eq("test_id", selectedTestId);
  }

  const { data, error } = await answerQuery.order(
    "created_at",
    { ascending: false }
  );


  if (error) {

    throw error;

  }


  answers =
    data || [];


  renderAnswers();


  const matched =
    answers.filter(
      answer =>
        answer.status ===
        "matched" &&
        answer.student_id
    ).length;


  const unmatched =
    answers.filter(
      answer =>
        answer.status ===
        "unmatched" ||
        !answer.student_id
    ).length;


  setStatus(
    `答案 ${answers.length}件 / 紐付け済み ${matched}件 / 未紐付け ${unmatched}件`
  );

}


/* =========================================================
   RENDER
========================================================= */

function renderAnswers() {

  const tbody =
    $("answerTableBody");


  if (!tbody) {

    return;

  }


  let visible =
    answers;


  if (
    selectedStatus ===
    "matched"
  ) {

    visible =
      answers.filter(
        answer =>
          ["matched", "uploaded"].includes(answer.status) &&
          !!answer.student_id
      );

  }


  if (
    selectedStatus ===
    "unmatched"
  ) {

    visible =
      answers.filter(
        answer =>
          answer.status ===
            "unmatched" ||
          !answer.student_id
      );

  }


  if (!visible.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty"
        >
          該当する答案はありません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    "";


  visible.forEach(
    answer => {

      tbody.appendChild(
        createAnswerRow(
          answer
        )
      );

    }
  );

}


/* =========================================================
   ROW
========================================================= */

function createAnswerRow(
  answer
) {

  const row =
    document.createElement(
      "tr"
    );


  /* 状態 */

  const statusCell =
    document.createElement(
      "td"
    );


  const badge =
    document.createElement(
      "span"
    );


  const matched =
    answer.status ===
      "matched" &&
    !!answer.student_id;


  badge.className =
    matched
      ? "status-badge status-matched"
      : "status-badge status-unmatched";


  badge.textContent =
    matched
      ? "紐付け済み"
      : "未紐付け";


  statusCell.appendChild(
    badge
  );


  /* 生徒 */

  const studentCell =
    document.createElement(
      "td"
    );


  const select =
    createStudentSelect(
      answer
    );


  studentCell.appendChild(
    select
  );


  /* QR */

  const qrCell =
    document.createElement(
      "td"
    );


  qrCell.className =
    "qr-value";


  qrCell.title =
    answer.qr_value ||
    "";


  qrCell.textContent =
    answer.qr_value ||
    "-";


  /* ID */

  const idCell =
    document.createElement(
      "td"
    );


  idCell.className =
    "answer-id";


  idCell.title =
    answer.id;


  idCell.textContent =
    answer.id;


  /* 日時 */

  const dateCell =
    document.createElement(
      "td"
    );


  dateCell.textContent =
    formatDate(
      answer.created_at ||
      answer.uploaded_at
    );


  /* 操作 */

  const actionCell =
    document.createElement(
      "td"
    );


  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "actions";


  const saveButton =
    document.createElement(
      "button"
    );


  saveButton.type =
    "button";


  saveButton.className =
    "btn btn-primary";


  saveButton.textContent =
    "紐付け保存";


  saveButton.addEventListener(
    "click",
    async () => {

      await saveStudent(
        answer,
        select.value ||
        null
      );

    }
  );


  actions.appendChild(
    saveButton
  );


  if (
    answer.student_id
  ) {

    const removeButton =
      document.createElement(
        "button"
      );


    removeButton.type =
      "button";


    removeButton.className =
      "btn";


    removeButton.textContent =
      "解除";


    removeButton.addEventListener(
      "click",
      async () => {

        await unmatchAnswer(
          answer.id
        );

      }
    );


    actions.appendChild(
      removeButton
    );

  }


  const processingLink =
    document.createElement(
      "a"
    );


  processingLink.className =
    "btn";


  processingLink.href =
    `/teacher/answers/processing?answer=${encodeURIComponent(
      answer.id
    )}`;


  processingLink.textContent =
    "処理状況";


  actions.appendChild(
    processingLink
  );


  actionCell.appendChild(
    actions
  );


  row.append(
    statusCell,
    studentCell,
    qrCell,
    idCell,
    dateCell,
    actionCell
  );


  return row;

}


/* =========================================================
   STUDENT SELECT
========================================================= */

function createStudentSelect(
  answer
) {

  const select =
    document.createElement(
      "select"
    );


  select.className =
    "student-select";


  const empty =
    document.createElement(
      "option"
    );


  empty.value =
    "";


  empty.textContent =
    "生徒を選択";


  select.appendChild(
    empty
  );


  students.forEach(
    student => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        student.id;


      option.textContent =
        `${student.student_no || ""} / ${student.name || ""}${student.active === false ? "（在籍外）" : ""}`;


      option.selected =
        student.id ===
        answer.student_id;


      select.appendChild(
        option
      );

    }
  );


  return select;

}


/* =========================================================
   SAVE
========================================================= */

async function saveStudent(
  answer,
  studentId
) {

  if (!studentId) {

    setStatus(
      "生徒を選択してください。",
      true
    );

    return;

  }


  if (
    answer.student_id ===
    studentId &&
    answer.status ===
    "matched"
  ) {

    setStatus(
      "この答案はすでにその生徒へ紐付いています。"
    );

    return;

  }


  const confirmed =
    window.confirm(
      "この答案を選択した生徒へ紐付けますか？"
    );


  if (!confirmed) {

    return;

  }


  try {

    setStatus(
      "生徒を紐付けています..."
    );


    /*
     * 既存クロップを先に削除。
     */

    await DB
      .from(
        "answer_regions"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answer.id
      );


    const {
      error
    } =
      await DB
        .from(
          "answer_sheets"
        )
        .update({

          student_id:
            studentId,

          status:
            "matched"

        })
        .eq(
          "id",
          answer.id
        );


    if (error) {

      throw error;

    }


    /*
     * 既存クロップを新しい紐付けで再生成。
     */

    await recropAnswer(
      answer.id
    );

    const { error: statusError } = await DB
      .from("answer_sheets")
      .update({ status: "uploaded" })
      .eq("id", answer.id);

    if (statusError) throw statusError;

    setStatus(
      "紐付け・答案画像の切り出しが完了し、採点待ちに登録しました。"
    );


    await loadAnswers();

  } catch (error) {

    console.error(
      "save student:",
      error
    );


    showError(
      error.message ||
      "紐付けに失敗しました。"
    );

  }

}


/* =========================================================
   UNMATCH
========================================================= */

async function unmatchAnswer(
  answerId
) {

  const confirmed =
    window.confirm(
      "この答案の生徒紐付けを解除しますか？"
    );


  if (!confirmed) {

    return;

  }


  try {

    const {
      error
    } =
      await DB
        .from(
          "answer_sheets"
        )
        .update({

          student_id:
            null,

          status:
            "unmatched"

        })
        .eq(
          "id",
          answerId
        );


    if (error) {

      throw error;

    }


    await DB
      .from(
        "answer_regions"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerId
      );


    await loadAnswers();


  } catch (error) {

    showError(
      error.message ||
      "紐付け解除に失敗しました。"
    );

  }

}


/* =========================================================
   RECROP
========================================================= */

async function recropAnswer(
  answerSheetId
) {

  /*
   * 答案情報
   */

  const {
    data:
      answer,
    error:
      answerError
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        "id,test_id"
      )
      .eq(
        "id",
        answerSheetId
      )
      .single();


  if (answerError) {

    throw answerError;

  }


  /*
   * 答案ページ
   */

  const {
    data:
      answerPages,
    error:
      pageError
  } =
    await DB
      .from(
        "answer_sheet_pages"
      )
      .select(
        `
        id,
        page_no,
        file_path,
        width_px,
        height_px
        `
      )
      .eq(
        "answer_sheet_id",
        answerSheetId
      )
      .order(
        "page_no",
        {
          ascending:true
        }
      );


  if (pageError) {

    throw pageError;

  }


  /*
   * 枠
   */

  const {
    data:
      layoutBoxes,
    error:
      boxError
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
        answer.test_id
      )
      .eq(
        "box_type",
        "answer"
      );


  if (boxError) {

    throw boxError;

  }


  /*
   * ページ単位
   */

  for (
    const answerPage
    of (
      answerPages ||
      []
    )
  ) {

    const pageBoxes =
      (
        layoutBoxes ||
        []
      ).filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            answerPage.page_no
          )
      );


    if (!pageBoxes.length) {

      continue;

    }


    const {
      data:
        downloaded,
      error:
        downloadError
    } =
      await DB
        .storage
        .from(
          "test-files"
        )
        .download(
          answerPage.file_path
        );


    if (downloadError) {

      throw downloadError;

    }


    const image =
      await blobToImage(
        downloaded
      );


    const sourceWidth =
      Number(
        answerPage.width_px
      ) ||
      image.naturalWidth;


    const sourceHeight =
      Number(
        answerPage.height_px
      ) ||
      image.naturalHeight;


    const scaleX =
      image.naturalWidth /
      sourceWidth;


    const scaleY =
      image.naturalHeight /
      sourceHeight;


    for (
      const box
      of pageBoxes
    ) {

      const rect = {

        x:
          (
            Number(
              box.x
            ) || 0
          ) *
          scaleX,

        y:
          (
            Number(
              box.y
            ) || 0
          ) *
          scaleY,

        width:
          (
            Number(
              box.width
            ) || 0
          ) *
          scaleX,

        height:
          (
            Number(
              box.height
            ) || 0
          ) *
          scaleY

      };


      const crop =
        cropImage(
          image,
          rect
        );


      if (!crop) {

        continue;

      }


      const blob =
        await canvasToBlob(
          crop
        );


      const path =
        [
          answer.test_id,
          answerSheetId,
          `${box.id}.png`
        ].join(
          "/"
        );


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
            path,
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


      const {
        error:
          regionError
      } =
        await DB
          .from(
            "answer_regions"
          )
          .upsert(
            {

              answer_sheet_id:
                answerSheetId,

              layout_box_id:
                box.id,

              page_no:
                answerPage.page_no,

              image_path:
                path,

              x:
                rect.x,

              y:
                rect.y,

              width:
                rect.width,

              height:
                rect.height

            },
            {
              onConflict:
                "answer_sheet_id,layout_box_id"
            }
          );


      if (regionError) {

        throw regionError;

      }

    }

  }

}


/* =========================================================
   IMAGE
========================================================= */

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
              "答案画像を読み込めませんでした。"
            )
          );

        };


      image.src =
        url;

    }
  );

}


/* =========================================================
   CROP
========================================================= */

function cropImage(
  image,
  rect
) {

  const x =
    Math.max(
      0,
      Math.floor(
        rect.x
      )
    );


  const y =
    Math.max(
      0,
      Math.floor(
        rect.y
      )
    );


  const width =
    Math.min(
      image.naturalWidth -
        x,
      Math.floor(
        rect.width
      )
    );


  const height =
    Math.min(
      image.naturalHeight -
        y,
      Math.floor(
        rect.height
      )
    );


  if (
    width <= 0 ||
    height <= 0
  ) {

    return null;

  }


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
      "2d"
    );


  context.drawImage(
    image,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  );


  return canvas;

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
                "クロップ画像を生成できませんでした。"
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
   STATUS
========================================================= */

function setStatus(
  text,
  error = false
) {

  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


function showError(
  text
) {

  setStatus(
    text,
    true
  );

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
  value
) {

  if (!value) {

    return "-";

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }


  return date.toLocaleString(
    "ja-JP"
  );

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
