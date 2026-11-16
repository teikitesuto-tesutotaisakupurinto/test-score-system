
"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   テスト全体採点

   採点単位
   ---------------------------------------------------------
   テスト
      ↓
   大問・設問
      ↓
   全生徒

   採点仕様
   ---------------------------------------------------------
   L
     → ○
     → 満点

   K
     → ×
     → 0点

   数字キー
     → 複数桁

   Backspace
     → 数字1桁削除

   Enter
     → 点数確定

   Escape
     → 数字入力・記号選択解除

   記号
   ---------------------------------------------------------
   ○
   ×
   △
   ◎
   文字
   ペン

   DB
   ---------------------------------------------------------
   scores
   mark_objects

   layout_boxes.question_id
   ---------------------------------------------------------
   NULLでも採点可能。

   採点対象
   ---------------------------------------------------------
   box_type = answer

   除外
   ---------------------------------------------------------
   QR
   氏名
   合計
   小計

   答案画像
   ---------------------------------------------------------
   answer_regions.image_path
   を優先。

   answer_regionsが無い場合は
   answer_sheet_pagesの元画像を
   CSSクロップして表示。

   Canvas
   ---------------------------------------------------------
   採点画面では使用しない。
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB =
  null;

let testId =
  null;

let test =
  null;

let answers =
  [];

let students =
  new Map();

let pages =
  new Map();

let regions =
  new Map();

let questions =
  [];

let scores =
  [];

let marks =
  [];

let questionIndex =
  0;

let selectedAnswerId =
  null;

let selectedMarkType =
  null;

let numericBuffer =
  "";

let saving =
  false;


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
      "採点画面を起動しています..."
    );


    DB =
      window.supabaseClient ||
      window.SB ||
      null;


    if (!DB) {

      throw new Error(
        "Supabaseクライアントがありません。"
      );

    }


    const params =
      new URLSearchParams(
        window.location.search
      );


    testId =
      params.get(
        "test"
      ) ||
      window.__INITIAL_TEST_ID__ ||
      null;


    if (!testId) {

      throw new Error(
        "テストIDがありません。"
      );

    }


    testId =
      String(
        testId
      ).trim();


    await checkTeacher();


    setupEvents();


    createMarkToolbar();


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

  if (
    typeof window.requireRole ===
    "function"
  ) {

    const result =
      await window.requireRole(
        "teacher"
      );


    if (!result) {

      return;

    }


    if (
      teacherNameElement
    ) {

      teacherNameElement.textContent =
        result.profile?.name ||
        "先生";

    }


    return;

  }


  const {
    data,
    error
  } =
    await DB.auth.getUser();


  if (error) {

    throw error;

  }


  if (!data?.user) {

    location.replace(
      "/login"
    );

    return;

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

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


      numericBuffer =
        "";

      selectedAnswerId =
        null;


      await renderQuestion();

    }
  );


  nextButton?.addEventListener(
    "click",
    async () => {

      await nextQuestion();

    }
  );


  refreshButton?.addEventListener(
    "click",
    async () => {

      try {

        await loadEverything();

      } catch (error) {

        showFatal(
          error.message ||
          "更新できませんでした。"
        );

      }

    }
  );


  document.addEventListener(
    "keydown",
    handleKeyboard
  );


  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        if (
          typeof window.logout ===
          "function"
        ) {

          await window.logout();

          return;

        }


        await DB.auth.signOut();


        location.replace(
          "/login"
        );

      }
    );

}


/* =========================================================
   MARK TOOLBAR
========================================================= */

function createMarkToolbar() {

  const existing =
    document.getElementById(
      "markToolbar"
    );


  if (existing) {

    return;

  }


  const toolbar =
    document.createElement(
      "div"
    );


  toolbar.id =
    "markToolbar";


  toolbar.style.cssText = `

    display:flex;

    flex-wrap:wrap;

    align-items:center;

    gap:6px;

    margin-bottom:12px;

    padding:10px;

    background:#fff;

    border:1px solid #d0d6dc;

  `;


  const title =
    document.createElement(
      "strong"
    );


  title.textContent =
    "採点記号";


  title.style.marginRight =
    "5px";


  toolbar.appendChild(
    title
  );


  const buttons = [

    ["circle", "○"],

    ["x", "×"],

    ["triangle", "△"],

    ["double_circle", "◎"],

    ["text", "文字"],

    ["pen", "ペン"]

  ];


  buttons.forEach(
    (
      [
        type,
        label
      ]
    ) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.dataset.mark =
        type;


      button.textContent =
        label;


      button.style.cssText = `

        min-width:52px;

        height:38px;

        border:1px solid #bbb;

        background:#fff;

        cursor:pointer;

        font-weight:700;

      `;


      button.addEventListener(
        "click",
        () => {

          selectedMarkType =
            type;


          toolbar
            .querySelectorAll(
              "[data-mark]"
            )
            .forEach(
              item => {

                item.style.background =
                  item === button
                    ? "#e9ecef"
                    : "#fff";

                item.style.borderColor =
                  item === button
                    ? "#333"
                    : "#bbb";

              }
            );

        }
      );


      toolbar.appendChild(
        button
      );

    }
  );


  const hint =
    document.createElement(
      "span"
    );


  hint.textContent =
    "L=○満点 / K=×0点 / 数字=部分点";


  hint.style.cssText = `

    margin-left:8px;

    color:#666;

    font-size:12px;

  `;


  toolbar.appendChild(
    hint
  );


  const parent =
    answerTableWrap?.parentElement;


  if (parent) {

    parent.insertBefore(
      toolbar,
      answerTableWrap
    );

  }

}


/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadEverything() {

  setStatus(
    "テスト情報を取得しています..."
  );


  await loadTest();


  setStatus(
    "答案を取得しています..."
  );


  await loadAnswers();


  setStatus(
    "生徒情報を取得しています..."
  );


  await loadStudents();


  setStatus(
    "答案ページを取得しています..."
  );


  await loadPages();


  setStatus(
    "答案クロップ情報を取得しています..."
  );


  await loadRegions();


  setStatus(
    "採点対象の設問を取得しています..."
  );


  await loadQuestions();


  setStatus(
    "既存の採点結果を取得しています..."
  );


  await loadScores();


  setStatus(
    "採点記号を取得しています..."
  );


  await loadMarks();


  questionIndex =
    0;


  selectedAnswerId =
    null;


  numericBuffer =
    "";


  selectedMarkType =
    null;


  completeElement?.classList.remove(
    "show"
  );


  await renderQuestion();


  updateProgress();


  setStatus(
    `${test.name} / 答案 ${answers.length}件 / 設問 ${questions.length}問`
  );

}


/* =========================================================
   TEST
========================================================= */

async function loadTest() {

  const {
    data,
    error
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


  if (error) {

    throw new Error(
      `テスト取得エラー: ${error.message}`
    );

  }


  if (!data) {

    throw new Error(
      "指定されたテストが見つかりません。"
    );

  }


  test =
    data;

}


/* =========================================================
   ANSWERS
========================================================= */

async function loadAnswers() {

  const {
    data,
    error
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
            ascending:true
          }
        ),
      10000,
      "答案取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `答案取得エラー: ${error.message}`
    );

  }


  answers =
    data ||
    [];


  if (!answers.length) {

    throw new Error(
      `「${test.name}」には答案が登録されていません。`
    );

  }

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

  students =
    new Map();


  const ids =
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


  if (!ids.length) {

    return;

  }


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
        name
        `
      )
      .in(
        "id",
        ids
      );


  if (error) {

    throw error;

  }


  (data || [])
    .forEach(
      student => {

        students.set(
          student.id,
          student
        );

      }
    );

}


/* =========================================================
   PAGES
========================================================= */

async function loadPages() {

  pages =
    new Map();


  const ids =
    answers.map(
      answer =>
        answer.id
    );


  if (!ids.length) {

    return;

  }


  const {
    data,
    error
  } =
    await DB
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
        ids
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


  (data || [])
    .forEach(
      page => {

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
    );

}


/* =========================================================
   ANSWER REGIONS
========================================================= */

async function loadRegions() {

  regions =
    new Map();


  const ids =
    answers.map(
      answer =>
        answer.id
    );


  if (!ids.length) {

    return;

  }


  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_regions"
      )
      .select(
        `
        id,
        answer_sheet_id,
        layout_box_id,
        question_id,
        page_no,
        image_path,
        x,
        y,
        width,
        height
        `
      )
      .in(
        "answer_sheet_id",
        ids
      )
      .order(
        "page_no",
        {
          ascending:true
        }
      );


  if (error) {

    /*
     * answer_regionsがまだ作られていない場合は
     * 元答案ページから表示する。
     */

    console.warn(
      "answer_regions:",
      error
    );

    return;

  }


  (data || [])
    .forEach(
      region => {

        regions.set(
          `${region.answer_sheet_id}:${region.layout_box_id}`,
          region
        );

      }
    );

}


/* =========================================================
   QUESTIONS
========================================================= */

async function loadQuestions() {

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
        label,
        x,
        y,
        width,
        height,
        question_id,
        points,
        sort_order
        `
      )
      .eq(
        "test_id",
        testId
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


  if (error) {

    throw error;

  }


  const excluded =
    new Set([
      "QR",
      "氏名",
      "合計",
      "小計"
    ]);


  questions =
    (data || [])
      .filter(
        box => {

          const type =
            String(
              box.box_type ||
              ""
            )
            .trim()
            .toLowerCase();


          if (
            type !==
            "answer"
          ) {

            return false;

          }


          const label =
            String(
              box.label ||
              ""
            ).trim();


          if (
            excluded.has(
              label
            )
          ) {

            return false;

          }


          return true;

        }
      )
      .map(
        (
          box,
          index
        ) => ({

          id:
            box.id,

          label:
            box.label ||
            `問${index + 1}`,

          pageNo:
            Number(
              box.page_no
            ) || 1,

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

          points:
            Number(
              box.points
            ) || 0,

          questionId:
            box.question_id ||
            null,

          sortOrder:
            Number(
              box.sort_order
            ) || 0

        })
      );


  if (!questions.length) {

    throw new Error(
      `採点対象のanswer枠がありません。layout_boxes取得数: ${
        data?.length ||
        0
      }件`
    );

  }

}


/* =========================================================
   SCORES
========================================================= */

async function loadScores() {

  scores =
    [];


  const ids =
    answers.map(
      answer =>
        answer.id
    );


  const {
    data,
    error
  } =
    await DB
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
        ids
      );


  if (error) {

    throw error;

  }


  scores =
    data ||
    [];

}


/* =========================================================
   MARK OBJECTS
========================================================= */

async function loadMarks() {

  marks =
    [];


  const ids =
    answers.map(
      answer =>
        answer.id
    );


  if (!ids.length) {

    return;

  }


  const {
    data,
    error
  } =
    await DB
      .from(
        "mark_objects"
      )
      .select(
        `
        id,
        answer_sheet_id,
        layout_box_id,
        question_id,
        object_type,
        text_value,
        color,
        font_size,
        stroke_width,
        x,
        y,
        width,
        height,
        points,
        created_at
        `
      )
      .in(
        "answer_sheet_id",
        ids
      )
      .order(
        "created_at",
        {
          ascending:true
        }
      );


  if (error) {

    /*
     * mark_objectsがまだ無い環境でも
     * 点数採点は可能にする。
     */

    console.warn(
      "mark_objects:",
      error
    );

    return;

  }


  marks =
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

    return;

  }


  questionTitleElement.textContent =
    question.label;


  questionMetaElement.textContent =
    `${test.name} / 配点 ${formatNumber(
      question.points
    )}点 / ${
      questionIndex + 1
    } / ${
      questions.length
    }`;


  previousButton.disabled =
    questionIndex <=
    0;


  nextButton.textContent =
    questionIndex >=
      questions.length - 1
      ? "採点完了確認"
      : "次の問題";


  selectedAnswerId =
    null;


  numericBuffer =
    "";


  const rows =
    await Promise.all(
      answers.map(
        answer =>
          createAnswerRow(
            answer,
            question
          )
      )
    );


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


  rows.forEach(
    row =>
      tbody.appendChild(
        row
      )
  );


  answerTableWrap.innerHTML =
    "";


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
   * STUDENT
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


  const no =
    document.createElement(
      "div"
    );


  no.className =
    "student-no";


  no.textContent =
    student?.student_no ||
    "未紐付け";


  const name =
    document.createElement(
      "div"
    );


  name.className =
    "student-name";


  name.textContent =
    student?.name ||
    "";


  studentCell.append(
    no,
    name
  );


  /*
   * ANSWER
   */

  const answerCell =
    document.createElement(
      "td"
    );


  answerCell.className =
    "answer-cell";


  const viewer =
    await createAnswerViewer(
      answer,
      question
    );


  answerCell.appendChild(
    viewer
  );


  /*
   * SCORE
   */

  const scoreCell =
    document.createElement(
      "td"
    );


  scoreCell.className =
    "score-cell";


  const existingScore =
    findScore(
      answer.id,
      question.id
    );


  const controls =
    document.createElement(
      "div"
    );


  controls.style.cssText = `

    display:flex;

    flex-wrap:wrap;

    justify-content:center;

    gap:5px;

  `;


  const input =
    document.createElement(
      "input"
    );


  input.className =
    "score-input";


  input.type =
    "number";


  input.min =
    "0";


  input.max =
    String(
      question.points
    );


  input.step =
    "0.1";


  input.value =
    existingScore
      ? existingScore.score
      : "";


  input.dataset.answerId =
    answer.id;


  input.dataset.questionId =
    question.id;


  const saveButton =
    document.createElement(
      "button"
    );


  saveButton.type =
    "button";


  saveButton.className =
    "btn btn-primary";


  saveButton.textContent =
    "保存";


  const zeroButton =
    document.createElement(
      "button"
    );


  zeroButton.type =
    "button";


  zeroButton.className =
    "btn";


  zeroButton.textContent =
    "0";


  const fullButton =
    document.createElement(
      "button"
    );


  fullButton.type =
    "button";


  fullButton.className =
    "btn";


  fullButton.textContent =
    "満点";


  const state =
    document.createElement(
      "div"
    );


  state.className =
    "score-state";


  state.textContent =
    existingScore?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    existingScore?.status ===
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

      numericBuffer =
        input.value;


      validateScore(
        input,
        warning,
        question.points
      );

    }
  );


  input.addEventListener(
    "focus",
    () => {

      selectedAnswerId =
        answer.id;


      numericBuffer =
        input.value ||
        "";

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


  zeroButton.addEventListener(
    "click",
    async () => {

      input.value =
        "0";


      numericBuffer =
        "0";


      await saveScore(
        answer,
        question,
        input,
        warning,
        state
      );

    }
  );


  fullButton.addEventListener(
    "click",
    async () => {

      input.value =
        String(
          question.points
        );


      numericBuffer =
        input.value;


      await saveScore(
        answer,
        question,
        input,
        warning,
        state
      );

    }
  );


  controls.append(
    input,
    saveButton,
    zeroButton,
    fullButton
  );


  scoreCell.append(
    controls,
    state,
    warning
  );


  /*
   * STATUS
   */

  const statusCell =
    document.createElement(
      "td"
    );


  statusCell.textContent =
    existingScore?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  /*
   * ROW
   */

  row.append(
    studentCell,
    answerCell,
    scoreCell,
    statusCell
  );


  return row;

}


/* =========================================================
   ANSWER VIEWER
========================================================= */

async function createAnswerViewer(
  answer,
  question
) {

  const viewer =
    document.createElement(
      "div"
    );


  viewer.className =
    "answer-viewer";


  viewer.dataset.answerId =
    answer.id;


  viewer.dataset.questionId =
    question.id;


  viewer.addEventListener(
    "click",
    event => {

      selectedAnswerId =
        answer.id;


      /*
       * 記号が選択されている場合は
       * クリック位置へ配置。
       */

      if (
        selectedMarkType
      ) {

        createMarkAtViewer(
          event,
          viewer,
          answer,
          question,
          selectedMarkType
        );

      }

    }
  );


  /*
   * まずanswer_regionsを確認。
   */

  const region =
    regions.get(
      `${answer.id}:${question.id}`
    );


  if (
    region?.image_path
  ) {

    await renderRegionImage(
      viewer,
      region,
      answer,
      question
    );

    return viewer;

  }


  /*
   * answer_regionsが無い場合。
   *
   * 元答案ページをCSSクロップ。
   */

  const answerPages =
    pages.get(
      answer.id
    ) ||
    [];


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

    viewer.innerHTML = `

      <div class="answer-error">
        答案ページ ${question.pageNo} がありません。
      </div>

    `;

    return viewer;

  }


  if (!page.file_path) {

    viewer.innerHTML = `

      <div class="answer-error">
        答案画像のfile_pathがありません。
      </div>

    `;

    return viewer;

  }


  await renderPageCrop(
    viewer,
    page,
    question
  );


  return viewer;

}


/* =========================================================
   REGION IMAGE
========================================================= */

async function renderRegionImage(
  viewer,
  region,
  answer,
  question
) {

  const {
    data,
    error
  } =
    await DB
      .storage
      .from(
        "student-answers"
      )
      .createSignedUrl(
        region.image_path,
        600
      );


  if (error) {

    viewer.innerHTML = `

      <div class="answer-error">
        ${escapeHtml(
          error.message
        )}
      </div>

    `;

    return;

  }


  if (!data?.signedUrl) {

    viewer.innerHTML = `

      <div class="answer-error">
        クロップ画像URLを取得できませんでした。
      </div>

    `;

    return;

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    `${question.label} 答案`;


  image.draggable =
    false;


  image.style.cssText = `

    display:block;

    width:100%;

    height:auto;

  `;


  viewer.appendChild(
    image
  );


  await waitForImage(
    image
  );


  renderMarks(
    viewer,
    answer,
    question,
    image.naturalWidth,
    image.naturalHeight
  );

}


/* =========================================================
   PAGE CROP
========================================================= */

async function renderPageCrop(
  viewer,
  page,
  question
) {

  const {
    data,
    error
  } =
    await DB
      .storage
      .from(
        "answer-files"
      )
      .createSignedUrl(
        page.file_path,
        600
      );


  if (error) {

    viewer.innerHTML = `

      <div class="answer-error">
        ${escapeHtml(
          error.message
        )}
      </div>

    `;

    return;

  }


  if (!data?.signedUrl) {

    throw new Error(
      "答案画像URLを取得できませんでした。"
    );

  }


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
      520,
      Math.max(
        360,
        cropWidth
      )
    );


  const scale =
    displayWidth /
    cropWidth;


  const displayHeight =
    Math.max(
      180,
      cropHeight *
      scale
    );


  viewer.style.height =
    `${displayHeight}px`;


  viewer.style.position =
    "relative";


  viewer.style.overflow =
    "hidden";


  image.style.position =
    "absolute";


  image.style.maxWidth =
    "none";


  image.style.width =
    `${image.naturalWidth *
      scale}px`;


  image.style.height =
    `${image.naturalHeight *
      scale}px`;


  image.style.left =
    `${-x *
      scaleX *
      scale}px`;


  image.style.top =
    `${-y *
      scaleY *
      scale}px`;


  viewer.appendChild(
    image
  );


  renderMarks(
    viewer,
    null,
    question,
    cropWidth,
    cropHeight
  );

}


/* =========================================================
   CREATE MARK
========================================================= */

function createMarkAtViewer(
  event,
  viewer,
  answer,
  question,
  type
) {

  const rect =
    viewer.getBoundingClientRect();


  const x =
    event.clientX -
    rect.left;


  const y =
    event.clientY -
    rect.top;


  /*
   * マークは画面上の表示座標。
   *
   * answer_regionsなら
   * そのクロップ画像の座標。
   *
   * 元画像CSSクロップなら
   * クロップ内座標。
   */

  const mark = {

    id:
      crypto.randomUUID(),

    answer_sheet_id:
      answer.id,

    layout_box_id:
      question.id,

    question_id:
      question.questionId ||
      null,

    object_type:
      type,

    text_value:
      type === "text"
        ? "文字"
        : null,

    color:
      "#d00000",

    font_size:
      42,

    stroke_width:
      4,

    x,

    y,

    width:
      type === "pen"
        ? 80
        : 50,

    height:
      type === "pen"
        ? 80
        : 50,

    points:
      null

  };


  /*
   * 同じ問題・答案で
   * ペン以外の記号は追加可能。
   */

  marks.push(
    mark
  );


  renderMarksForViewer(
    viewer,
    answer,
    question
  );

}


/* =========================================================
   RENDER MARKS
========================================================= */

function renderMarks(
  viewer,
  answer,
  question
) {

  /*
   * viewer内の既存markを削除。
   */

  viewer
    .querySelectorAll(
      ".mark-object"
    )
    .forEach(
      element =>
        element.remove()
    );


  const answerId =
    answer?.id ||
    viewer.dataset.answerId ||
    null;


  if (!answerId) {

    return;

  }


  const questionMarks =
    marks.filter(
      mark =>
        mark.answer_sheet_id ===
          answerId &&
        mark.layout_box_id ===
          question.id
    );


  questionMarks.forEach(
    mark => {

      const element =
        createMarkElement(
          mark
        );


      viewer.appendChild(
        element
      );

    }
  );

}


/* =========================================================
   RENDER MARKS AGAIN
========================================================= */

function renderMarksForViewer(
  viewer,
  answer,
  question
) {

  renderMarks(
    viewer,
    answer,
    question
  );

}


/* =========================================================
   MARK ELEMENT
========================================================= */

function createMarkElement(
  mark
) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "mark-object";


  element.style.position =
    "absolute";


  element.style.left =
    `${Number(
      mark.x
    ) || 0}px`;


  element.style.top =
    `${Number(
      mark.y
    ) || 0}px`;


  element.style.width =
    `${Number(
      mark.width
    ) || 50}px`;


  element.style.height =
    `${Number(
      mark.height
    ) || 50}px`;


  element.style.color =
    mark.color ||
    "#d00000";


  element.style.fontSize =
    `${Number(
      mark.font_size
    ) || 42}px`;


  element.style.fontWeight =
    "700";


  element.style.lineHeight =
    "1";


  element.style.zIndex =
    "20";


  element.style.pointerEvents =
    "auto";


  element.style.userSelect =
    "none";


  const symbols = {

    circle:
      "○",

    x:
      "×",

    triangle:
      "△",

    double_circle:
      "◎"

  };


  if (
    symbols[
      mark.object_type
    ]
  ) {

    element.textContent =
      symbols[
        mark.object_type
      ];

  }


  else if (
    mark.object_type ===
    "text"
  ) {

    element.textContent =
      mark.text_value ||
      "文字";

  }


  else if (
    mark.object_type ===
    "pen"
  ) {

    element.textContent =
      "／";

  }


  else {

    element.textContent =
      "";

  }


  /*
   * ダブルクリックで削除。
   */

  element.addEventListener(
    "dblclick",
    async event => {

      event.stopPropagation();


      const confirmed =
        window.confirm(
          "この採点記号を削除しますか？"
        );


      if (!confirmed) {

        return;

      }


      await deleteMark(
        mark
      );

    }
  );


  return element;

}


/* =========================================================
   DELETE MARK
========================================================= */

async function deleteMark(
  mark
) {

  try {

    if (
      mark.id
    ) {

      const {
        error
      } =
        await DB
          .from(
            "mark_objects"
          )
          .delete()
          .eq(
            "id",
            mark.id
          );


      if (error) {

        throw error;

      }

    }


    marks =
      marks.filter(
        item =>
          item.id !==
          mark.id
      );


    await renderQuestion();

  } catch (error) {

    console.error(
      "delete mark:",
      error
    );


    alert(
      error.message ||
      "採点記号を削除できませんでした。"
    );

  }

}


/* =========================================================
   KEYBOARD
========================================================= */

function handleKeyboard(
  event
) {

  if (
    !questions.length
  ) {

    return;

  }


  /*
   * 入力欄にフォーカス中。
   */

  if (
    event.target instanceof
      HTMLInputElement ||
    event.target instanceof
      HTMLTextAreaElement ||
    event.target instanceof
      HTMLSelectElement
  ) {

    /*
     * Escapeだけは許可。
     */

    if (
      event.key !==
      "Escape"
    ) {

      return;

    }

  }


  const key =
    event.key;


  /*
   * L
   * ○ + 満点
   */

  if (
    key === "l" ||
    key === "L"
  ) {

    event.preventDefault();


    const target =
      getKeyboardTarget();


    if (!target) {

      return;

    }


    const {
      answer,
      question
    } =
      target;


    selectedAnswerId =
      answer.id;


    addOrReplaceKeyboardMark(
      answer,
      question,
      "circle"
    );


    setScoreDirect(
      answer,
      question,
      question.points
    );


    return;

  }


  /*
   * K
   * × + 0
   */

  if (
    key === "k" ||
    key === "K"
  ) {

    event.preventDefault();


    const target =
      getKeyboardTarget();


    if (!target) {

      return;

    }


    const {
      answer,
      question
    } =
      target;


    selectedAnswerId =
      answer.id;


    addOrReplaceKeyboardMark(
      answer,
      question,
      "x"
    );


    setScoreDirect(
      answer,
      question,
      0
    );


    return;

  }


  /*
   * 数字
   */

  if (
    /^[0-9]$/.test(
      key
    )
  ) {

    event.preventDefault();


    const target =
      getKeyboardTarget();


    if (!target) {

      return;

    }


    selectedAnswerId =
      target.answer.id;


    numericBuffer +=
      key;


    const input =
      findScoreInput(
        target.answer.id,
        target.question.id
      );


    if (input) {

      input.value =
        numericBuffer;

      input.focus();

    }


    return;

  }


  /*
   * Backspace
   */

  if (
    key ===
    "Backspace"
  ) {

    if (
      numericBuffer.length
    ) {

      event.preventDefault();


      numericBuffer =
        numericBuffer.slice(
          0,
          -1
        );


      const target =
        getKeyboardTarget();


      if (target) {

        const input =
          findScoreInput(
            target.answer.id,
            target.question.id
          );


        if (input) {

          input.value =
            numericBuffer;

        }

      }

    }


    return;

  }


  /*
   * Enter
   */

  if (
    key ===
    "Enter"
  ) {

    if (
      numericBuffer.length
    ) {

      event.preventDefault();


      const target =
        getKeyboardTarget();


      if (target) {

        const input =
          findScoreInput(
            target.answer.id,
            target.question.id
          );


        if (input) {

          saveScoreFromKeyboard(
            target.answer,
            target.question,
            input
          );

        }

      }


      numericBuffer =
        "";

    }


    return;

  }


  /*
   * Escape
   */

  if (
    key ===
    "Escape"
  ) {

    event.preventDefault();


    numericBuffer =
      "";

    selectedMarkType =
      null;


    document
      .querySelectorAll(
        "#markToolbar [data-mark]"
      )
      .forEach(
        button => {

          button.style.background =
            "#fff";

          button.style.borderColor =
            "#bbb";

        }
      );

  }

}


/* =========================================================
   KEYBOARD TARGET
========================================================= */

function getKeyboardTarget() {

  /*
   * 選択中の生徒を優先。
   */

  if (
    selectedAnswerId
  ) {

    const answer =
      answers.find(
        item =>
          item.id ===
          selectedAnswerId
      );


    if (answer) {

      return {

        answer,

        question:
          questions[
            questionIndex
          ]

      };

    }

  }


  /*
   * 選択が無ければ
   * 現在画面の先頭生徒。
   */

  const answer =
    answers[0];


  if (!answer) {

    return null;

  }


  return {

    answer,

    question:
      questions[
        questionIndex
      ]

  };

}


/* =========================================================
   KEYBOARD MARK
========================================================= */

function addOrReplaceKeyboardMark(
  answer,
  question,
  type
) {

  /*
   * L/Kでは同一設問の
   * 既存自動記号を置き換える。
   */

  marks =
    marks.filter(
      mark =>
        !(
          mark.answer_sheet_id ===
            answer.id &&
          mark.layout_box_id ===
            question.id &&
          (
            mark.object_type ===
              "circle" ||
            mark.object_type ===
              "x"
          )
        )
    );


  marks.push({

    id:
      crypto.randomUUID(),

    answer_sheet_id:
      answer.id,

    layout_box_id:
      question.id,

    question_id:
      question.questionId ||
      null,

    object_type:
      type,

    text_value:
      null,

    color:
      "#d00000",

    font_size:
      42,

    stroke_width:
      4,

    x:
      20,

    y:
      20,

    width:
      50,

    height:
      50,

    points:
      null

  });


  renderQuestion();

}


/* =========================================================
   DIRECT SCORE
========================================================= */

async function setScoreDirect(
  answer,
  question,
  value
) {

  const existing =
    findScore(
      answer.id,
      question.id
    );


  /*
   * ローカル更新。
   * DB保存は通常のsaveScoreと同じ。
   */

  if (existing) {

    existing.score =
      value;

    existing.status =
      "marked";

  } else {

    scores.push({

      id:
        crypto.randomUUID(),

      answer_sheet_id:
        answer.id,

      layout_box_id:
        question.id,

      question_id:
        question.questionId ||
        null,

      score:
        value,

      status:
        "marked"

    });

  }


  await saveScoreRecord(
    answer,
    question,
    value
  );


  updateProgress();

}


/* =========================================================
   SAVE SCORE FROM KEYBOARD
========================================================= */

async function saveScoreFromKeyboard(
  answer,
  question,
  input
) {

  const warning =
    document.createElement(
      "div"
    );


  const state =
    document.createElement(
      "div"
    );


  await saveScore(
    answer,
    question,
    input,
    warning,
    state
  );

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
    Number(
      question.points
    )
  ) {

    showWarning(
      warning,
      `設定配点 ${formatNumber(
        question.points
      )}点を超えています。保存できません。`
    );

    return;

  }


  try {

    saving =
      true;


    await saveScoreRecord(
      answer,
      question,
      value
    );


    const existing =
      findScore(
        answer.id,
        question.id
      );


    if (existing) {

      existing.score =
        value;

      existing.status =
        "marked";

    }


    if (state) {

      state.textContent =
        "採点済み";


      state.className =
        "score-state marked";

    }


    if (warning) {

      warning.classList.remove(
        "show"
      );

    }


    numericBuffer =
      "";


    updateProgress();


    setStatus(
      `${getStudentLabel(
        answer
      )} / ${question.label} を ${formatNumber(
        value
      )}点で保存しました。`
    );


  } catch (error) {

    console.error(
      "saveScore:",
      error
    );


    if (state) {

      state.textContent =
        "保存失敗";


      state.className =
        "score-state error";

    }


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
   SAVE SCORE RECORD
========================================================= */

async function saveScoreRecord(
  answer,
  question,
  value
) {

  const existing =
    findScore(
      answer.id,
      question.id
    );


  if (existing?.id) {

    const {
      data,
      error
    } =
      await DB
        .from(
          "scores"
        )
        .update({

          question_id:
            question.questionId ||
            null,

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
        .single();


    if (error) {

      throw error;

    }


    Object.assign(
      existing,
      data
    );


  } else {

    const {
      data,
      error
    } =
      await DB
        .from(
          "scores"
        )
        .insert({

          answer_sheet_id:
            answer.id,

          layout_box_id:
            question.id,

          question_id:
            question.questionId ||
            null,

          score:
            value,

          status:
            "marked",

          marked_at:
            new Date().toISOString()

        })
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
        .single();


    if (error) {

      throw error;

    }


    scores.push(
      data
    );

  }


  /*
   * mark_objectsも保存。
   */

  await saveQuestionMarks(
    answer,
    question
  );

}


/* =========================================================
   SAVE MARK OBJECTS
========================================================= */

async function saveQuestionMarks(
  answer,
  question
) {

  /*
   * DB上の既存記号を削除。
   */

  const {
    error:
      deleteError
  } =
    await DB
      .from(
        "mark_objects"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answer.id
      )
      .eq(
        "layout_box_id",
        question.id
      );


  if (deleteError) {

    /*
     * テーブル未作成環境では
     * 点数保存自体は成功扱いにする。
     */

    console.warn(
      "mark_objects delete:",
      deleteError
    );

    return;

  }


  const questionMarks =
    marks.filter(
      mark =>
        mark.answer_sheet_id ===
          answer.id &&
        mark.layout_box_id ===
          question.id
    );


  if (!questionMarks.length) {

    return;

  }


  const rows =
    questionMarks.map(
      mark => ({

        id:
          mark.id,

        answer_sheet_id:
          answer.id,

        layout_box_id:
          question.id,

        question_id:
          question.questionId ||
          null,

        object_type:
          mark.object_type,

        text_value:
          mark.text_value ||
          null,

        color:
          mark.color ||
          "#d00000",

        font_size:
          Number(
            mark.font_size
          ) || 42,

        stroke_width:
          Number(
            mark.stroke_width
          ) || 4,

        x:
          Number(
            mark.x
          ) || 0,

        y:
          Number(
            mark.y
          ) || 0,

        width:
          Number(
            mark.width
          ) || 50,

        height:
          Number(
            mark.height
          ) || 50,

        points:
          mark.points ??
          null

      })
    );


  const {
    error:
      insertError
  } =
    await DB
      .from(
        "mark_objects"
      )
      .insert(
        rows
      );


  if (insertError) {

    console.warn(
      "mark_objects insert:",
      insertError
    );

  }

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
   FIND SCORE INPUT
========================================================= */

function findScoreInput(
  answerId,
  questionId
) {

  return document.querySelector(
    `.score-input[data-answer-id="${cssEscape(
      answerId
    )}"][data-question-id="${cssEscape(
      questionId
    )}"]`
  );

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


  answers.forEach(
    answer => {

      questions.forEach(
        question => {

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
      );

    }
  );


  const percent =
    total > 0
      ? Math.round(
          completed /
          total *
          100
        )
      : 0;


  if (
    progressBar
  ) {

    progressBar.style.width =
      `${percent}%`;

  }


  if (
    progressText
  ) {

    progressText.textContent =
      `${completed} / ${total} 設問答案を採点済み (${percent}%)`;

  }


  if (
    progressElement
  ) {

    progressElement.textContent =
      `${completed} / ${total}`;

  }


  if (
    total > 0 &&
    completed === total
  ) {

    completeElement?.classList.add(
      "show"
    );


    setStatus(
      "全答案・全設問の採点が完了しました。成績処理待ちです。"
    );

  } else {

    completeElement?.classList.remove(
      "show"
    );

  }

}


/* =========================================================
   NEXT QUESTION
========================================================= */

async function nextQuestion() {

  if (
    questionIndex >=
    questions.length - 1
  ) {

    if (
      isAllMarked()
    ) {

      completeElement?.classList.add(
        "show"
      );


      setStatus(
        "全答案・全設問の採点が完了しました。成績処理待ちです。"
      );

    } else {

      setStatus(
        "まだ未採点の答案があります。",
        true
      );

    }


    return;

  }


  questionIndex++;


  numericBuffer =
    "";


  selectedAnswerId =
    null;


  await renderQuestion();

}


/* =========================================================
   ALL MARKED
========================================================= */

function isAllMarked() {

  return questions.every(
    question =>
      answers.every(
        answer => {

          const score =
            findScore(
              answer.id,
              question.id
            );


          return (
            score &&
            score.status ===
              "marked"
          );

        }
      )
  );

}


/* =========================================================
   VALIDATE
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
    Number(
      max
    )
  ) {

    showWarning(
      warning,
      `設定配点 ${formatNumber(
        max
      )}点を超えています。`
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

  let timer =
    null;


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
   STUDENT
========================================================= */

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


  return [
    student.student_no,
    student.name
  ]
    .filter(Boolean)
    .join(
      " / "
    );

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  message,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    message;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


function showFatal(
  message
) {

  setStatus(
    message,
    true
  );


  if (!answerTableWrap) {

    return;

  }


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


/* =========================================================
   WARNING
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


/* =========================================================
   CSS ESCAPE
========================================================= */

function cssEscape(
  value
) {

  const string =
    String(
      value ||
      ""
    );


  if (
    window.CSS &&
    typeof window.CSS.escape ===
      "function"
  ) {

    return window.CSS.escape(
      string
    );

  }


  return string.replace(
    /[^a-zA-Z0-9_-]/g,
    "\\$&"
  );

}


/* =========================================================
   FORMAT
========================================================= */

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
