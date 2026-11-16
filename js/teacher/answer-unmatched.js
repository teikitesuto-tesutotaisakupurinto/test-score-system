
"use strict";

/* =========================================================
   未紐付け答案

   QR未読取
      ↓
   生徒を手動選択
      ↓
   answer_sheets.student_id設定
      ↓
   status = uploaded
      ↓
   既存answer_regions削除
      ↓
   新しい生徒としてクロップ再生成
      ↓
   採点対象へ
========================================================= */

let DB = null;

let students = [];

let unmatchedAnswers = [];


/* =========================================================
   DOM
========================================================= */

const answerList =
  document.getElementById(
    "answerList"
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
  initializeUnmatched
);


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeUnmatched() {

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


    await loadStudents();

    await loadUnmatched();


  } catch (error) {

    console.error(
      "answer-unmatched:",
      error
    );


    showError(
      error.message ||
      "未紐付け答案を読み込めませんでした。"
    );

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
    await DB
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
    data || [];

}


/* =========================================================
   LOAD UNMATCHED
========================================================= */

async function loadUnmatched() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        qr_value,
        status,
        created_at,
        uploaded_at,
        tests(
          id,
          name,
          subject,
          grade,
          class_name
        )
        `
      )
      .eq(
        "status",
        "unmatched"
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


  unmatchedAnswers =
    data || [];


  renderAnswers();

}


/* =========================================================
   RENDER
========================================================= */

function renderAnswers() {

  if (!answerList) {

    return;

  }


  if (!unmatchedAnswers.length) {

    answerList.innerHTML = `

      <div class="unmatched-card">

        <div class="empty">

          未紐付け答案はありません。

        </div>

      </div>

    `;

    return;

  }


  answerList.innerHTML =
    "";


  unmatchedAnswers.forEach(
    answer => {

      answerList.appendChild(
        createAnswerCard(
          answer
        )
      );

    }
  );

}


/* =========================================================
   CARD
========================================================= */

function createAnswerCard(
  answer
) {

  const card =
    document.createElement(
      "section"
    );


  card.className =
    "unmatched-card";


  card.id =
    `answer-${answer.id}`;


  const grid =
    document.createElement(
      "div"
    );


  grid.className =
    "answer-grid";


  /* -------------------------------------------------------
     INFO
  ------------------------------------------------------- */

  const info =
    document.createElement(
      "div"
    );


  info.className =
    "answer-info";


  const title =
    document.createElement(
      "h3"
    );


  title.textContent =
    answer.tests?.name ||
    "テスト";


  const subject =
    document.createElement(
      "p"
    );


  subject.textContent =
    [
      answer.tests?.subject,
      answer.tests?.grade,
      answer.tests?.class_name
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


  const date =
    document.createElement(
      "p"
    );


  date.textContent =
    `アップロード：${formatDate(
      answer.created_at ||
      answer.uploaded_at
    )}`;


  const qr =
    document.createElement(
      "p"
    );


  qr.textContent =
    answer.qr_value
      ? `QR：${answer.qr_value}`
      : "QR：読み取り不可";


  const badge =
    document.createElement(
      "span"
    );


  badge.className =
    "status-badge";


  badge.textContent =
    "未紐付け";


  info.append(
    title,
    badge,
    subject,
    date,
    qr
  );


  /* -------------------------------------------------------
     CONTROLS
  ------------------------------------------------------- */

  const controls =
    document.createElement(
      "div"
    );


  const label =
    document.createElement(
      "label"
    );


  label.textContent =
    "生徒";


  const select =
    document.createElement(
      "select"
    );


  select.className =
    "student-select";


  select.dataset.answerId =
    answer.id;


  const emptyOption =
    document.createElement(
      "option"
    );


  emptyOption.value =
    "";


  emptyOption.textContent =
    "生徒を選択";


  select.appendChild(
    emptyOption
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
        [
          student.student_no,
          student.name
        ]
          .filter(Boolean)
          .join(
            " / "
          );


      select.appendChild(
        option
      );

    }
  );


  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.className =
    "btn btn-primary match-button";


  button.textContent =
    "この生徒に紐付け";


  button.addEventListener(
    "click",
    async () => {

      await matchAnswer(
        answer,
        select.value,
        button
      );

    }
  );


  controls.append(
    label,
    select,
    button
  );


  grid.append(
    info,
    controls
  );


  card.appendChild(
    grid
  );


  return card;

}


/* =========================================================
   MATCH
========================================================= */

async function matchAnswer(
  answer,
  studentId,
  button
) {

  if (!studentId) {

    showError(
      "生徒を選択してください。"
    );

    return;

  }


  const student =
    students.find(
      item =>
        item.id ===
        studentId
    );


  if (!student) {

    showError(
      "選択した生徒が見つかりません。"
    );

    return;

  }


  const confirmed =
    window.confirm(
      `${student.student_no || ""} / ${student.name || ""} にこの答案を紐付けますか？`
    );


  if (!confirmed) {

    return;

  }


  button.disabled =
    true;


  button.textContent =
    "処理中...";


  try {

    /*
     * 既存クロップを削除。
     */

    const {
      error:
        regionDeleteError
    } =
      await DB
        .from(
          "answer_regions"
        )
        .delete()
        .eq(
          "answer_sheet_id",
          answer.id
        );


    if (regionDeleteError) {

      throw regionDeleteError;

    }


    /*
     * 生徒紐付け。
     *
     * statusはmatchedではなく
     * uploadedに統一。
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
            answer.qr_value ||
            `MANUAL:${student.student_no}`,

          status:
            "uploaded"

        })
        .eq(
          "id",
          answer.id
        );


    if (updateError) {

      throw updateError;

    }


    /*
     * クロップ再生成。
     */

    await recropAnswer(
      answer.id,
      answer.test_id
    );


    /*
     * カード削除。
     */

    const card =
      document.getElementById(
        `answer-${answer.id}`
      );


    card?.remove();


    unmatchedAnswers =
      unmatchedAnswers.filter(
        item =>
          item.id !==
          answer.id
      );


    if (!unmatchedAnswers.length) {

      renderAnswers();

    }


    showSuccess(
      "生徒への紐付けと答案クロップが完了しました。"
    );


  } catch (error) {

    console.error(
      "match answer:",
      error
    );


    showError(
      error.message ||
      "紐付けに失敗しました。"
    );


    button.disabled =
      false;


    button.textContent =
      "この生徒に紐付け";

  }

}


/* =========================================================
   RECROP
========================================================= */

async function recropAnswer(
  answerId,
  testId
) {

  /*
   * 答案ページ
   */

  const {
    data:
      pages,
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
        answerId
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


  if (!pages?.length) {

    throw new Error(
      "答案ページがありません。"
    );

  }


  /*
   * 解答欄
   */

  const {
    data:
      boxes,
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
        testId
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
      );


  if (boxError) {

    throw boxError;

  }


  if (!boxes?.length) {

    /*
     * 枠がまだ無ければ
     * 紐付け自体は成功。
     */

    return;

  }


  for (
    const page
    of pages
  ) {

    const pageBoxes =
      boxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            page.page_no
          )
      );


    if (!pageBoxes.length) {

      continue;

    }


    const {
      data:
        sourceBlob,
      error:
        downloadError
    } =
      await DB
        .storage
        .from(
          "answer-files"
        )
        .download(
          page.file_path
        );


    if (downloadError) {

      throw downloadError;

    }


    const image =
      await blobToImage(
        sourceBlob
      );


    const sourceWidth =
      Number(
        page.width_px
      ) ||
      image.naturalWidth;


    const sourceHeight =
      Number(
        page.height_px
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

      const x =
        Math.max(
          0,
          Math.floor(
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
          Math.floor(
            (
              Number(
                box.y
              ) || 0
            ) *
            scaleY
          )
        );


      const width =
        Math.min(
          image.naturalWidth -
            x,
          Math.floor(
            (
              Number(
                box.width
              ) || 0
            ) *
            scaleX
          )
        );


      const height =
        Math.min(
          image.naturalHeight -
            y,
          Math.floor(
            (
              Number(
                box.height
              ) || 0
            ) *
            scaleY
          )
        );


      if (
        width <= 0 ||
        height <= 0
      ) {

        continue;

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


      const blob =
        await canvasToBlob(
          canvas
        );


      const path =
        [
          testId,
          answerId,
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


      const region = {

        answer_sheet_id:
          answerId,

        layout_box_id:
          box.id,

        page_no:
          page.page_no,

        image_path:
          path,

        x,

        y,

        width,

        height

      };


      const {
        error:
          regionError
      } =
        await DB
          .from(
            "answer_regions"
          )
          .upsert(
            region,
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
                "クロップ画像を作成できませんでした。"
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
   MESSAGE
========================================================= */

function setMessage(
  text,
  type = ""
) {

  if (!message) {

    return;

  }


  message.textContent =
    text;


  message.className =
    type
      ? `message ${type}`
      : "message";

}


function showError(
  text
) {

  setMessage(
    text,
    "error"
  );

}


function showSuccess(
  text
) {

  setMessage(
    text,
    "success"
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
