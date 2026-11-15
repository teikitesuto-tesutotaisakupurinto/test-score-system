
"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   テスト単位採点

   URL:
     /teacher/marking/mark?test=TEST_ID

   仕様:
   ---------------------------------------------------------
   テストを1つ選択
       ↓
   そのテストの答案を全件取得
       ↓
   問1
       ↓
   全生徒の答案を表示・採点
       ↓
   問2
       ↓
   全生徒の答案を表示・採点
       ↓
   ...
       ↓
   全設問 × 全答案 完了

   答案画像:
     answer_sheet_pages
       ↓
     Storage bucket: answer-files
       ↓
     signed URL
       ↓
     img

   Canvas / toBlob:
     使用しない

   source_page_id:
     使用しない

   answer_regions:
     必須ではない

   answer_sheets:
     全問採点完了しても、このファイルでは
     markedへ変更しない。

   公開:
     このファイルでは行わない。
     成績・偏差値・順位処理完了後の
     最終公開処理で行う。
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB = null;

let testId = null;

let test = null;

let answers = [];

let students = new Map();

let pages = new Map();

let questions = [];

let scores = [];

let questionIndex = 0;

let saving = false;


/* =========================================================
   DOM
========================================================= */

const statusElement =
  document.getElementById(
    "status"
  );

const teacherNameElement =
  document.getElementById(
    "teacherName"
  );

const answerTableWrap =
  document.getElementById(
    "answerTableWrap"
  );

const questionTitleElement =
  document.getElementById(
    "questionTitle"
  );

const questionMetaElement =
  document.getElementById(
    "questionMeta"
  );

const previousButton =
  document.getElementById(
    "previousButton"
  );

const nextButton =
  document.getElementById(
    "nextButton"
  );

const refreshButton =
  document.getElementById(
    "refreshButton"
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

const completeElement =
  document.getElementById(
    "complete"
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

    setStatus(
      "JavaScriptを起動しました。"
    );


    /*
     * -----------------------------------------------------
     * Supabase
     * -----------------------------------------------------
     *
     * config.js:
     *
     * window.SB
     */

    DB =
      window.SB ||
      window.supabaseClient ||
      null;


    if (!DB) {

      throw new Error(
        "Supabaseクライアントがありません。js/config.js の設定を確認してください。"
      );

    }


    /*
     * -----------------------------------------------------
     * URL
     * -----------------------------------------------------
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    testId =
      params.get(
        "test"
      );


    if (!testId) {

      throw new Error(
        "テストIDがありません。採点一覧から「採点開始」を押してください。"
      );

    }


    testId =
      String(
        testId
      ).trim();


    if (!testId) {

      throw new Error(
        "テストIDが空です。"
      );

    }


    /*
     * -----------------------------------------------------
     * 認証
     * -----------------------------------------------------
     */

    await checkTeacher();


    /*
     * -----------------------------------------------------
     * イベント
     * -----------------------------------------------------
     */

    setupEvents();


    /*
     * -----------------------------------------------------
     * データ
     * -----------------------------------------------------
     */

    await loadEverything();


  } catch (error) {

    console.error(
      "marking initialize:",
      error
    );


    showFatal(
      error.message ||
      "採点画面を起動できませんでした。"
    );

  }

}


/* =========================================================
   AUTH
========================================================= */

async function checkTeacher() {

  /*
   * 現在の auth.js に合わせる。
   *
   * window.requireRole("teacher")
   *
   * 戻り値:
   * {
   *   user,
   *   profile
   * }
   */

  if (
    typeof window.requireRole ===
    "function"
  ) {

    const result =
      await withTimeout(
        window.requireRole(
          "teacher"
        ),
        10000,
        "ログイン確認がタイムアウトしました。"
      );


    if (!result) {

      return;

    }


    const profile =
      result.profile ||
      result;


    if (
      teacherNameElement
    ) {

      teacherNameElement.textContent =
        profile.name ||
        "先生";

    }


    return;

  }


  /*
   * 念のため直接確認。
   */

  if (
    DB.auth &&
    typeof DB.auth.getUser ===
    "function"
  ) {

    const {
      data,
      error
    } =
      await withTimeout(
        DB.auth.getUser(),
        10000,
        "ログイン確認がタイムアウトしました。"
      );


    if (error) {

      throw new Error(
        `ログイン確認エラー: ${error.message}`
      );

    }


    if (!data?.user) {

      throw new Error(
        "ログインセッションがありません。"
      );

    }

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  /*
   * 前の問題
   */

  previousButton?.addEventListener(
    "click",
    async () => {

      if (
        questionIndex <=
        0
      ) {

        return;

      }


      questionIndex--;


      try {

        await renderQuestion();

      } catch (error) {

        showFatal(
          error.message ||
          "問題を表示できませんでした。"
        );

      }

    }
  );


  /*
   * 次の問題
   */

  nextButton?.addEventListener(
    "click",
    async () => {

      try {

        await nextQuestion();

      } catch (error) {

        showFatal(
          error.message ||
          "次の問題へ進めませんでした。"
        );

      }

    }
  );


  /*
   * 更新
   */

  refreshButton?.addEventListener(
    "click",
    async () => {

      try {

        setStatus(
          "更新しています..."
        );


        await loadEverything();

      } catch (error) {

        showFatal(
          error.message ||
          "更新に失敗しました。"
        );

      }

    }
  );


  /*
   * ログアウト
   */

  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        try {

          if (
            typeof window.signOut ===
            "function"
          ) {

            await window.signOut();

            return;

          }


          if (
            typeof window.logout ===
            "function"
          ) {

            await window.logout();

            return;

          }


          if (
            DB.auth &&
            typeof DB.auth.signOut ===
            "function"
          ) {

            await DB.auth.signOut();

            location.replace(
              "/login"
            );

          }

        } catch (error) {

          console.error(
            "logout:",
            error
          );

        }

      }
    );

}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadEverything() {

  /*
   * -------------------------------------------------------
   * TEST
   * -------------------------------------------------------
   */

  setStatus(
    "テスト情報を取得しています..."
  );


  const {
    data: testData,
    error: testError
  } =
    await withTimeout(
      DB
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
        .eq(
          "id",
          testId
        )
        .maybeSingle(),
      10000,
      "テスト情報取得がタイムアウトしました。"
    );


  if (testError) {

    throw new Error(
      `テスト取得エラー: ${testError.message}`
    );

  }


  if (!testData) {

    throw new Error(
      "指定されたテストが見つかりません。"
    );

  }


  test =
    testData;


  /*
   * -------------------------------------------------------
   * ANSWERS
   * -------------------------------------------------------
   */

  setStatus(
    "答案を取得しています..."
  );


  const {
    data: answerData,
    error: answerError
  } =
    await withTimeout(
      DB
        .from(
          "answer_sheets"
        )
        .select(
          `
          id,
          test_id,
          student_id,
          original_file_path,
          rendered_file_path,
          page_count,
          qr_value,
          status,
          uploaded_at,
          created_at
          `
        )
        .eq(
          "test_id",
          testId
        )
        .order(
          "uploaded_at",
          {
            ascending:
              true
          }
        ),
      10000,
      "答案取得がタイムアウトしました。"
    );


  if (answerError) {

    throw new Error(
      `答案取得エラー: ${answerError.message}`
    );

  }


  answers =
    answerData ||
    [];


  if (!answers.length) {

    throw new Error(
      `「${test.name}」には答案が登録されていません。`
    );

  }


  /*
   * -------------------------------------------------------
   * STUDENTS
   * -------------------------------------------------------
   */

  setStatus(
    "生徒情報を取得しています..."
  );


  await loadStudents();


  /*
   * -------------------------------------------------------
   * ANSWER PAGES
   * -------------------------------------------------------
   */

  setStatus(
    "答案ページを取得しています..."
  );


  await loadPages();


  /*
   * -------------------------------------------------------
   * LAYOUT BOXES
   * -------------------------------------------------------
   */

  setStatus(
    "採点枠を取得しています..."
  );


  const {
    data: boxData,
    error: boxError
  } =
    await withTimeout(
      DB
        .from(
          "layout_boxes"
        )
        .select(
          `
          id,
          test_id,
          page_no,
          box_type,
          label,
          x,
          y,
          width,
          height,
          question_id,
          points,
          created_at
          `
        )
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        ),
      10000,
      "採点枠取得がタイムアウトしました。"
    );


  if (boxError) {

    throw new Error(
      `採点枠取得エラー: ${boxError.message}`
    );

  }


  /*
   * -------------------------------------------------------
   * QUESTIONS
   * -------------------------------------------------------
   *
   * 採点対象:
   *
   * box_type = answer
   * AND question_idあり
   *
   * 大問・合計・小計・QR等は除外。
   */

  questions =
    (boxData || [])
      .filter(
        box => {

          const type =
            String(
              box.box_type ||
              ""
            )
              .trim()
              .toLowerCase();


          return (
            type ===
              "answer" &&
            Boolean(
              box.question_id
            )
          );

        }
      )
      .map(
        box => ({

          id:
            box.id,

          label:
            box.label ||
            "設問",

          pageNo:
            Number(
              box.page_no
            ),

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
            ) || 1,

          height:
            Number(
              box.height
            ) || 1,

          questionId:
            box.question_id,

          points:
            Number(
              box.points
            ) || 0

        })
      );


  if (!questions.length) {

    throw new Error(
      "採点対象の設問がありません。layout_boxes の box_type=answer と question_id を確認してください。"
    );

  }


  /*
   * -------------------------------------------------------
   * SCORES
   * -------------------------------------------------------
   */

  setStatus(
    "既存の採点結果を取得しています..."
  );


  await loadScores();


  /*
   * -------------------------------------------------------
   * READY
   * -------------------------------------------------------
   */

  questionIndex =
    0;


  progressElement?.classList.add(
    "show"
  );


  completeElement?.classList.remove(
    "show"
  );


  nextButton.disabled =
    false;


  await renderQuestion();


  setStatus(
    `${test.name} / 答案 ${answers.length}件 / 設問 ${questions.length}問`
  );

}


/* =========================================================
   LOAD STUDENTS
========================================================= */

async function loadStudents() {

  students =
    new Map();


  const studentIds =
    [
      ...new Set(
        answers
          .map(
            answer =>
              answer.student_id
          )
          .filter(Boolean)
      )
    ];


  if (!studentIds.length) {

    return;

  }


  const {
    data,
    error
  } =
    await withTimeout(
      DB
        .from(
          "students"
        )
        .select(
          `
          id,
          student_no,
          name
          `
        )
        .in(
          "id",
          studentIds
        ),
      10000,
      "生徒情報取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `生徒情報取得エラー: ${error.message}`
    );

  }


  for (
    const student
    of data || []
  ) {

    students.set(
      student.id,
      student
    );

  }

}


/* =========================================================
   LOAD PAGES
========================================================= */

async function loadPages() {

  pages =
    new Map();


  const answerIds =
    answers.map(
      answer =>
        answer.id
    );


  if (!answerIds.length) {

    return;

  }


  const {
    data,
    error
  } =
    await withTimeout(
      DB
        .from(
          "answer_sheet_pages"
        )
        .select(
          `
          answer_sheet_id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
          `
        )
        .in(
          "answer_sheet_id",
          answerIds
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        ),
      10000,
      "答案ページ取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `答案ページ取得エラー: ${error.message}`
    );

  }


  for (
    const page
    of data || []
  ) {

    if (
      !pages.has(
        page.answer_sheet_id
      )
    ) {

      pages.set(
        page.answer_sheet_id,
        []
      );

    }


    pages
      .get(
        page.answer_sheet_id
      )
      .push(
        page
      );

  }

}


/* =========================================================
   LOAD SCORES
========================================================= */

async function loadScores() {

  scores =
    [];


  const answerIds =
    answers.map(
      answer =>
        answer.id
    );


  if (!answerIds.length) {

    return;

  }


  const {
    data,
    error
  } =
    await withTimeout(
      DB
        .from(
          "scores"
        )
        .select(
          `
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status,
          marked_at
          `
        )
        .in(
          "answer_sheet_id",
          answerIds
        ),
      10000,
      "採点結果取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `採点結果取得エラー: ${error.message}`
    );

  }


  scores =
    data ||
    [];

}


/* =========================================================
   RENDER QUESTION
========================================================= */

async function renderQuestion() {

  const question =
    questions[
      questionIndex
    ];


  if (!question) {

    throw new Error(
      "表示する設問がありません。"
    );

  }


  questionTitleElement.textContent =
    question.label;


  questionMetaElement.textContent =
    `${test.name} / 配点 ${formatNumber(
      question.points
    )}点 / 問題 ${
      questionIndex + 1
    } / ${
      questions.length
    }`;


  previousButton.disabled =
    questionIndex <=
    0;


  nextButton.disabled =
    false;


  nextButton.textContent =
    questionIndex >=
      questions.length - 1
      ? "採点完了確認"
      : "次の問題";


  answerTableWrap.innerHTML =
    "";


  const table =
    document.createElement(
      "table"
    );


  table.className =
    "answer-table";


  table.innerHTML = `

    <thead>

      <tr>

        <th class="student-cell">
          生徒
        </th>

        <th class="answer-cell">
          答案
        </th>

        <th class="score-cell">
          得点
        </th>

        <th>
          状態
        </th>

      </tr>

    </thead>

    <tbody></tbody>

  `;


  const tbody =
    table.querySelector(
      "tbody"
    );


  /*
   * 同じ問題を全生徒分表示。
   */

  for (
    const answer
    of answers
  ) {

    const row =
      await createAnswerRow(
        answer,
        question
      );


    tbody.appendChild(
      row
    );

  }


  answerTableWrap.appendChild(
    table
  );


  updateProgress();

}


/* =========================================================
   CREATE ANSWER ROW
========================================================= */

async function createAnswerRow(
  answer,
  question
) {

  const row =
    document.createElement(
      "tr"
    );


  /*
   * -------------------------------------------------------
   * STUDENT
   * -------------------------------------------------------
   */

  const studentCell =
    document.createElement(
      "td"
    );


  studentCell.className =
    "student-cell";


  const student =
    students.get(
      answer.student_id
    );


  const studentNo =
    document.createElement(
      "div"
    );


  studentNo.className =
    "student-no";


  studentNo.textContent =
    student?.student_no ||
    "未紐付け";


  const studentName =
    document.createElement(
      "div"
    );


  studentName.className =
    "student-name";


  studentName.textContent =
    student?.name ||
    "";


  studentCell.append(
    studentNo,
    studentName
  );


  /*
   * -------------------------------------------------------
   * ANSWER IMAGE
   * -------------------------------------------------------
   */

  const answerCell =
    document.createElement(
      "td"
    );


  answerCell.className =
    "answer-cell";


  try {

    const viewer =
      await createAnswerViewer(
        answer,
        question
      );


    answerCell.appendChild(
      viewer
    );

  } catch (error) {

    const errorElement =
      document.createElement(
        "div"
      );


    errorElement.className =
      "answer-error";


    errorElement.textContent =
      error.message ||
      "答案画像を表示できません。";


    answerCell.appendChild(
      errorElement
    );

  }


  /*
   * -------------------------------------------------------
   * SCORE
   * -------------------------------------------------------
   */

  const scoreCell =
    document.createElement(
      "td"
    );


  scoreCell.className =
    "score-cell";


  const existing =
    findScore(
      answer.id,
      question.id
    );


  const input =
    document.createElement(
      "input"
    );


  input.type =
    "number";


  input.step =
    "0.1";


  input.min =
    "0";


  input.max =
    String(
      question.points
    );


  input.className =
    "score-input";


  input.value =
    existing
      ? existing.score
      : "";


  const saveButton =
    document.createElement(
      "button"
    );


  saveButton.type =
    "button";


  saveButton.className =
    "btn btn-primary score-save";


  saveButton.textContent =
    "保存";


  const state =
    document.createElement(
      "div"
    );


  state.className =
    "score-state";


  state.textContent =
    existing &&
    existing.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    existing &&
    existing.status ===
      "marked"
  ) {

    state.classList.add(
      "marked"
    );

  }


  const warning =
    document.createElement(
      "div"
    );


  warning.className =
    "warning";


  input.addEventListener(
    "input",
    () => {

      validateScore(
        input,
        warning,
        question.points
      );

    }
  );


  saveButton.addEventListener(
    "click",
    async () => {

      await saveScore(
        answer,
        question,
        input,
        warning,
        state
      );

    }
  );


  scoreCell.append(
    input,
    document.createElement(
      "br"
    ),
    saveButton,
    state,
    warning
  );


  /*
   * -------------------------------------------------------
   * STATUS
   * -------------------------------------------------------
   */

  const statusCell =
    document.createElement(
      "td"
    );


  if (
    existing &&
    existing.status ===
      "marked"
  ) {

    statusCell.textContent =
      "採点済み";


    statusCell.style.color =
      "#1769aa";

  } else {

    statusCell.textContent =
      "未採点";


    statusCell.style.color =
      "#b42318";

  }


  row.append(
    studentCell,
    answerCell,
    scoreCell,
    statusCell
  );


  return row;

}


/* =========================================================
   CREATE ANSWER VIEWER
========================================================= */

async function createAnswerViewer(
  answer,
  question
) {

  const answerPages =
    pages.get(
      answer.id
    ) ||
    [];


  /*
   * 問題のpage_noと答案ページを一致させる。
   */

  const page =
    answerPages.find(
      item =>
        Number(
          item.page_no
        ) ===
        Number(
          question.pageNo
        )
    );


  if (!page) {

    throw new Error(
      `答案ページ ${question.pageNo} がありません。`
    );

  }


  if (!page.file_path) {

    throw new Error(
      "答案ページのfile_pathがありません。"
    );

  }


  /*
   * -------------------------------------------------------
   * Storage
   * -------------------------------------------------------
   */

  const {
    data,
    error
  } =
    await withTimeout(
      DB
        .storage
        .from(
          "answer-files"
        )
        .createSignedUrl(
          page.file_path,
          600
        ),
      10000,
      "答案画像URL取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `答案画像取得エラー: ${error.message}`
    );

  }


  if (!data?.signedUrl) {

    throw new Error(
      "答案画像の署名URLを取得できませんでした。"
    );

  }


  /*
   * -------------------------------------------------------
   * Viewer
   * -------------------------------------------------------
   */

  const viewer =
    document.createElement(
      "div"
    );


  viewer.className =
    "answer-viewer";


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    "答案";


  image.draggable =
    false;


  await waitForImage(
    image
  );


  /*
   * -------------------------------------------------------
   * Crop
   * -------------------------------------------------------
   *
   * Canvasは使わない。
   *
   * CSSのoverflow:hiddenで
   * 必要な部分だけ表示する。
   */

  const pageWidth =
    Number(
      page.width_px
    ) ||
    image.naturalWidth;


  const pageHeight =
    Number(
      page.height_px
    ) ||
    image.naturalHeight;


  const scaleX =
    image.naturalWidth /
    pageWidth;


  const scaleY =
    image.naturalHeight /
    pageHeight;


  const x =
    Number(
      question.x
    ) ||
    0;


  const y =
    Number(
      question.y
    ) ||
    0;


  const width =
    Math.max(
      1,
      Number(
        question.width
      ) ||
      1
    );


  const height =
    Math.max(
      1,
      Number(
        question.height
      ) ||
      1
    );


  const cropWidth =
    width *
    scaleX;


  const cropHeight =
    height *
    scaleY;


  const displayWidth =
    Math.min(
      500,
      Math.max(
        350,
        cropWidth
      )
    );


  const displayScale =
    displayWidth /
    cropWidth;


  const displayHeight =
    Math.max(
      150,
      cropHeight *
      displayScale
    );


  viewer.style.height =
    `${displayHeight}px`;


  image.style.width =
    `${image.naturalWidth *
      displayScale}px`;


  image.style.height =
    `${image.naturalHeight *
      displayScale}px`;


  image.style.left =
    `${-x *
      scaleX *
      displayScale}px`;


  image.style.top =
    `${-y *
      scaleY *
      displayScale}px`;


  viewer.appendChild(
    image
  );


  return viewer;

}


/* =========================================================
   SAVE SCORE
========================================================= */

async function saveScore(
  answer,
  question,
  input,
  warning,
  state
) {

  if (saving) {

    return;

  }


  const value =
    Number(
      input.value
    );


  if (
    input.value ===
    ""
  ) {

    showWarning(
      warning,
      "点数を入力してください。"
    );

    return;

  }


  if (
    !Number.isFinite(
      value
    )
  ) {

    showWarning(
      warning,
      "点数が不正です。"
    );

    return;

  }


  if (
    value < 0
  ) {

    showWarning(
      warning,
      "0点未満にはできません。"
    );

    return;

  }


  if (
    value >
    question.points
  ) {

    showWarning(
      warning,
      `配点 ${question.points}点を超えています。`
    );

    return;

  }


  saving =
    true;


  try {

    /*
     * -----------------------------------------------------
     * Existing
     * -----------------------------------------------------
     */

    const {
      data: existing,
      error: findError
    } =
      await withTimeout(
        DB
          .from(
            "scores"
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
            question.id
          )
          .maybeSingle(),
        10000,
        "既存採点確認がタイムアウトしました。"
      );


    if (findError) {

      throw new Error(
        `既存採点確認エラー: ${findError.message}`
      );

    }


    /*
     * -----------------------------------------------------
     * UPDATE
     * -----------------------------------------------------
     */

    if (existing?.id) {

      const {
        error
      } =
        await withTimeout(
          DB
            .from(
              "scores"
            )
            .update({

              question_id:
                question.questionId,

              score:
                value,

              status:
                "marked",

              marked_at:
                new Date().toISOString()

            })
            .eq(
              "id",
              existing.id
            ),
          10000,
          "採点更新がタイムアウトしました。"
        );


      if (error) {

        throw new Error(
          `採点更新エラー: ${error.message}`
        );

      }


      updateLocalScore(
        existing.id,
        answer.id,
        question,
        value
      );

    }


    /*
     * -----------------------------------------------------
     * INSERT
     * -----------------------------------------------------
     */

    else {

      const {
        data,
        error
      } =
        await withTimeout(
          DB
            .from(
              "scores"
            )
            .insert({

              answer_sheet_id:
                answer.id,

              layout_box_id:
                question.id,

              question_id:
                question.questionId,

              score:
                value,

              status:
                "marked",

              marked_at:
                new Date().toISOString()

            })
            .select(
              "id"
            )
            .single(),
          10000,
          "採点登録がタイムアウトしました。"
        );


      if (error) {

        throw new Error(
          `採点登録エラー: ${error.message}`
        );

      }


      updateLocalScore(
        data.id,
        answer.id,
        question,
        value
      );

    }


    warning.classList.remove(
      "show"
    );


    state.textContent =
      "採点済み";


    state.className =
      "score-state marked";


    updateProgress();


    showStatus(
      `${getStudentLabel(
        answer
      )} / ${question.label} を保存しました。`
    );


  } catch (error) {

    console.error(
      "saveScore:",
      error
    );


    state.textContent =
      "保存失敗";


    state.className =
      "score-state error";


    showWarning(
      warning,
      error.message ||
      "採点を保存できませんでした。"
    );


  } finally {

    saving =
      false;

  }

}


/* =========================================================
   NEXT QUESTION
========================================================= */

async function nextQuestion() {

  const question =
    questions[
      questionIndex
    ];


  if (
    !isQuestionComplete(
      question
    )
  ) {

    const proceed =
      window.confirm(
        "この問題には未採点の答案があります。このまま次へ進みますか？"
      );


    if (!proceed) {

      return;

    }

  }


  if (
    questionIndex >=
    questions.length - 1
  ) {

    finishMarking();

    return;

  }


  questionIndex++;


  await renderQuestion();

}


/* =========================================================
   FINISH
========================================================= */

function finishMarking() {

  const allComplete =
    questions.every(
      question =>
        isQuestionComplete(
          question
        )
    );


  if (!allComplete) {

    const remaining =
      questions.filter(
        question =>
          !isQuestionComplete(
            question
          )
      ).length;


    showStatus(
      `まだ未採点の設問があります。残り ${remaining}問です。`,
      true
    );


    return;

  }


  completeElement?.classList.add(
    "show"
  );


  showStatus(
    "全答案・全設問の採点が完了しました。成績処理待ちです。"
  );


  updateProgress();


  nextButton.disabled =
    true;


  /*
   * 重要:
   *
   * ここでは
   * answer_sheets.status = marked
   * にしない。
   *
   * 公開もしない。
   *
   * 成績・偏差値・順位の処理が
   * 完了してから最終確定する。
   */

}


/* =========================================================
   QUESTION COMPLETE
========================================================= */

function isQuestionComplete(
  question
) {

  if (!question) {

    return false;

  }


  return answers.every(
    answer => {

      const score =
        findScore(
          answer.id,
          question.id
        );


      return Boolean(
        score &&
        score.status ===
          "marked"
      );

    }
  );

}


/* =========================================================
   FIND SCORE
========================================================= */

function findScore(
  answerId,
  questionId
) {

  return scores.find(
    score =>
      score.answer_sheet_id ===
        answerId &&
      score.layout_box_id ===
        questionId
  ) ||
  null;

}


/* =========================================================
   LOCAL SCORE
========================================================= */

function updateLocalScore(
  id,
  answerId,
  question,
  value
) {

  const existing =
    findScore(
      answerId,
      question.id
    );


  if (existing) {

    existing.id =
      id;

    existing.score =
      value;

    existing.status =
      "marked";

    return;

  }


  scores.push({

    id,

    answer_sheet_id:
      answerId,

    layout_box_id:
      question.id,

    question_id:
      question.questionId,

    score:
      value,

    status:
      "marked"

  });

}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress() {

  const total =
    answers.length *
    questions.length;


  let completed =
    0;


  for (
    const answer
    of answers
  ) {

    for (
      const question
      of questions
    ) {

      const score =
        findScore(
          answer.id,
          question.id
        );


      if (
        score &&
        score.status ===
          "marked"
      ) {

        completed++;

      }

    }

  }


  const percent =
    total > 0
      ? Math.round(
          completed /
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
      `${completed} / ${total} 設問答案を採点済み (${percent}%)`;

  }

}


/* =========================================================
   VALIDATE SCORE
========================================================= */

function validateScore(
  input,
  warning,
  max
) {

  if (
    input.value ===
    ""
  ) {

    warning.classList.remove(
      "show"
    );

    return;

  }


  const value =
    Number(
      input.value
    );


  if (
    !Number.isFinite(
      value
    ) ||
    value < 0 ||
    value > max
  ) {

    showWarning(
      warning,
      `0〜${max}点で入力してください。`
    );

    return;

  }


  warning.classList.remove(
    "show"
  );

}


/* =========================================================
   IMAGE
========================================================= */

function waitForImage(
  image
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        image.complete &&
        image.naturalWidth >
          0
      ) {

        resolve();

        return;

      }


      image.onload =
        () => {

          resolve();

        };


      image.onerror =
        () => {

          reject(
            new Error(
              "答案画像を読み込めませんでした。"
            )
          );

        };

    }
  );

}


/* =========================================================
   TIMEOUT
========================================================= */

async function withTimeout(
  promise,
  milliseconds,
  message
) {

  let timer = null;


  const timeout =
    new Promise(
      (
        resolve,
        reject
      ) => {

        timer =
          setTimeout(
            () => {

              reject(
                new Error(
                  message
                )
              );

            },
            milliseconds
          );

      }
    );


  try {

    return await Promise.race(
      [
        promise,
        timeout
      ]
    );

  } finally {

    if (timer) {

      clearTimeout(
        timer
      );

    }

  }

}


/* =========================================================
   STATUS
========================================================= */

function showStatus(
  message,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    message;


  statusElement.style.color =
    error
      ? "#b42318"
      : "#333";

}


/* =========================================================
   FATAL
========================================================= */

function showFatal(
  message
) {

  showStatus(
    message,
    true
  );


  if (answerTableWrap) {

    answerTableWrap.innerHTML = `

      <div class="empty">

        ${escapeHtml(
          message
        )}

        <br><br>

        <a
          href="/teacher/marking"
          class="btn"
        >
          採点一覧へ戻る
        </a>

      </div>

    `;

  }

}


/* =========================================================
   HELPERS
========================================================= */

function showWarning(
  element,
  message
) {

  if (!element) {

    return;

  }


  element.textContent =
    message;


  element.classList.add(
    "show"
  );

}


function getStudentLabel(
  answer
) {

  const student =
    students.get(
      answer.student_id
    );


  if (!student) {

    return "未紐付け";

  }


  return `${student.student_no || ""} / ${student.name || ""}`;

}


function formatNumber(
  value
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

    return "0";

  }


  return Number.isInteger(
    number
  )
    ? String(
        number
      )
    : number.toFixed(
        1
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


/* =========================================================
   END
========================================================= */

})();
