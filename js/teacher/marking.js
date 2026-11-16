
"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   テスト全体採点

   現在のDB構造
   ---------------------------------------------------------
   answer_sheets
   answer_sheet_pages
   layout_boxes
   scores
   students

   採点対象
   ---------------------------------------------------------
   layout_boxes.box_type = "answer"

   除外
   ---------------------------------------------------------
   QR
   氏名
   合計
   小計

   question_id
   ---------------------------------------------------------
   NULLでも採点可能。

   公開
   ---------------------------------------------------------
   採点完了だけでは公開しない。
   成績・偏差値・順位処理とは分離する。
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB =
  null;

let testId =
  null;

let initialAnswerId =
  null;

let test =
  null;

let answers =
  [];

let students =
  new Map();

let pages =
  new Map();

let questions =
  [];

let scores =
  [];

let questionIndex =
  0;

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
        "Supabase Clientが初期化されていません。"
      );

    }


    const params =
      new URLSearchParams(
        window.location.search
      );


    testId =
      params.get(
        "test"
      );


    initialAnswerId =
      params.get(
        "answer"
      );


    /*
     * mark.htmlから渡される
     * グローバル値にも対応。
     */

    if (!testId) {

      testId =
        window.__INITIAL_TEST_ID__ ||
        null;

    }


    if (!initialAnswerId) {

      initialAnswerId =
        window.__INITIAL_ANSWER_ID__ ||
        null;

    }


    if (!testId) {

      throw new Error(
        "テストIDがありません。テスト全体の採点画面から開始してください。"
      );

    }


    await checkTeacher();


    setupEvents();


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
   * auth.jsが正常なら使用。
   */

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


  /*
   * フォールバック。
   */

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


  if (
    teacherNameElement
  ) {

    teacherNameElement.textContent =
      "先生";

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
    "採点対象の設問を取得しています..."
  );


  await loadQuestions();


  setStatus(
    "既存の採点結果を取得しています..."
  );


  await loadScores();


  questionIndex =
    0;


  /*
   * 初期答案が指定されている場合でも、
   * 採点はテスト全体を表示する。
   *
   * その答案が存在することだけ確認する。
   */

  if (
    initialAnswerId &&
    !answers.some(
      answer =>
        answer.id ===
        initialAnswerId
    )
  ) {

    initialAnswerId =
      null;

  }


  progressElement?.classList.add(
    "show"
  );


  completeElement?.classList.remove(
    "show"
  );


  await renderQuestion();


  setStatus(
    `${test.name} / 答案 ${answers.length}件 / 設問 ${questions.length}問`
  );

}


/* =========================================================
   LOAD TEST
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
   LOAD ANSWERS
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
   LOAD STUDENTS
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
          ids
        ),
      10000,
      "生徒情報取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `生徒情報取得エラー: ${error.message}`
    );

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
   LOAD PAGES
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
          ids
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
   LOAD QUESTIONS
========================================================= */

async function loadQuestions() {

  const {
    data,
    error
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
            ascending:
              true
          }
        )
        .order(
          "sort_order",
          {
            ascending:
              true
          }
        ),
      10000,
      "採点枠取得がタイムアウトしました。"
    );


  if (error) {

    throw new Error(
      `採点枠取得エラー: ${error.message}`
    );

  }


  const excludedLabels =
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


          /*
           * answerだけ採点。
           */

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


          /*
           * 集計枠は除外。
           */

          if (
            excludedLabels.has(
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

          questionId:
            box.question_id ||
            null,

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

          sortOrder:
            Number(
              box.sort_order
            ) || 0

        })
      );


  questions.sort(
    (
      a,
      b
    ) => {

      if (
        a.pageNo !==
        b.pageNo
      ) {

        return (
          a.pageNo -
          b.pageNo
        );

      }


      return (
        a.sortOrder -
        b.sortOrder
      );

    }
  );


  if (!questions.length) {

    throw new Error(
      [
        "このテストには採点対象のanswer枠がありません。",
        `layout_boxes取得数: ${
          data?.length ||
          0
        }件`
      ].join(
        "\n"
      )
    );

  }

}


/* =========================================================
   LOAD SCORES
========================================================= */

async function loadScores() {

  scores =
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
          ids
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
    [
      test.name,
      `配点 ${formatNumber(
        question.points
      )}点`,
      `問題 ${
        questionIndex + 1
      } / ${
        questions.length
      }`
    ].join(
      " / "
    );


  previousButton.disabled =
    questionIndex <=
    0;


  nextButton.textContent =
    questionIndex >=
      questions.length - 1
      ? "採点完了確認"
      : "次の問題";


  answerTableWrap.innerHTML = `

    <div class="empty">
      答案を表示しています...
    </div>

  `;


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

        <th>
          生徒
        </th>

        <th>
          答案
        </th>

        <th>
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
   CREATE ROW
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
   * 生徒
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
   * 答案
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
   * 得点
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


  const controls =
    document.createElement(
      "div"
    );


  controls.className =
    "score-controls";


  const input =
    document.createElement(
      "input"
    );


  input.type =
    "number";


  input.className =
    "score-input";


  input.min =
    "0";


  input.max =
    String(
      question.points
    );


  input.step =
    "0.1";


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


  const zeroButton =
    document.createElement(
      "button"
    );


  zeroButton.type =
    "button";


  zeroButton.className =
    "btn";


  zeroButton.textContent =
    "0点";


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
    existing?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    existing?.status ===
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


  zeroButton.addEventListener(
    "click",
    async () => {

      input.value =
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
   * 状態
   */

  const statusCell =
    document.createElement(
      "td"
    );


  statusCell.textContent =
    existing?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    existing?.status ===
    "marked"
  ) {

    statusCell.style.color =
      "#1769aa";

  } else {

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
   ANSWER VIEWER
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
   * Canvasは使用しない。
   *
   * 画像そのものをCSSで移動して
   * 設問枠だけ見せる。
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
      520,
      Math.max(
        360,
        cropWidth
      )
    );


  const displayScale =
    displayWidth /
    cropWidth;


  const displayHeight =
    Math.max(
      180,
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


  const rawValue =
    input.value;


  if (
    rawValue ===
    ""
  ) {

    showWarning(
      warning,
      "点数を入力してください。"
    );

    return;

  }


  const value =
    Number(
      rawValue
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
      question.points
    )
  ) {

    showWarning(
      warning,
      `配点 ${formatNumber(
        question.points
      )}点を超えています。保存できません。`
    );

    return;

  }


  saving =
    true;


  try {

    const existing =
      findScore(
        answer.id,
        question.id
      );


    if (existing) {

      const {
        error
      } =
        await withTimeout(
          DB
            .from(
              "scores"
            )
            .update({

              /*
               * question_idはNULLでもよい。
               */

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
            ),
          10000,
          "採点更新がタイムアウトしました。"
        );


      if (error) {

        throw new Error(
          `採点更新エラー: ${error.message}`
        );

      }


      existing.score =
        value;


      existing.status =
        "marked";


      existing.marked_at =
        new Date().toISOString();

    } else {

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
            .single(),
          10000,
          "採点登録がタイムアウトしました。"
        );


      if (error) {

        throw new Error(
          `採点登録エラー: ${error.message}`
        );

      }


      scores.push(
        data
      );

    }


    state.textContent =
      "採点済み";


    state.className =
      "score-state marked";


    warning.classList.remove(
      "show"
    );


    /*
     * ここでは answer_sheets.status を
     * marked に変更しない。
     *
     * 成績・偏差値・順位処理完了前に
     * 「採点済み答案」として公開しないため。
     */

    updateProgress();


    setStatus(
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
   FIND SCORE
========================================================= */

function findScore(
  answerId,
  layoutBoxId
) {

  return scores.find(
    score =>
      score.answer_sheet_id ===
        answerId &&
      score.layout_box_id ===
        layoutBoxId
  ) ||
  null;

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
   NEXT
========================================================= */

async function nextQuestion() {

  if (
    questionIndex >=
    questions.length - 1
  ) {

    const complete =
      questions.every(
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


    if (complete) {

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


  await renderQuestion();

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
      `配点 ${formatNumber(
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
   STUDENT LABEL
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


function showStatus(
  message
) {

  setStatus(
    message
  );

}


function showFatal(
  message
) {

  setStatus(
    message,
    true
  );


  if (
    answerTableWrap
  ) {

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
