
"use strict";

/* =========================================================
   デジタル採点

   新仕様
   ---------------------------------------------------------
   テスト
      ↓
   1設問
      ↓
   全答案を一括表示
      ↓
   L / K / 数字
      ↓
   保存
      ↓
   次の答案へ自動移動

   採点画面では
   ---------------------------------------------------------
   ・生徒名を表示しない
   ・生徒番号を表示しない
   ・答案を選択させない
   ・設問を選択させない
   ・大問を表示しない

   採点対象
   ---------------------------------------------------------
   layout_boxes.box_type = answer

   除外
   ---------------------------------------------------------
   QR
   氏名
   合計
   小計
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB = null;

let testId = null;

let selectedStudentId = null;

let test = null;

let answers = [];

let questions = [];

let scores = [];

let marks = [];

let regions = new Map();

let pages = new Map();

let questionIndex = 0;

let activeAnswerIndex = 0;

let selectedMarkType = null;

let numericBuffer = "";

let saving = false;


/* =========================================================
   DOM
========================================================= */

const $ = id =>
  document.getElementById(id);


const statusElement =
  $("status");


const answerTableWrap =
  $("answerTableWrap");


const questionTitleElement =
  $("questionTitle");


const questionMetaElement =
  $("questionMeta");


const previousButton =
  $("previousButton");


const nextButton =
  $("nextButton");


const refreshButton =
  $("refreshButton");


const progressBar =
  $("progressBar");


const progressText =
  $("progressText");


const completeElement =
  $("complete");


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


    const params =
      new URLSearchParams(
        location.search
      );


    testId =
      params.get(
        "test"
      );

    selectedStudentId = params.get("student");


    if (!testId) {

      throw new Error(
        "テストIDがありません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    const teacherName =
      $("teacherName");


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


    setupEvents();

    setupMarkToolbar();

    setupNavigationLinks();
    setupStudentNavigation();


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

      activeAnswerIndex =
        0;

      clearKeyboard();

      await renderQuestion();

    }
  );


  nextButton?.addEventListener(
    "click",
    async () => {

      if (
        questionIndex >=
        questions.length - 1
      ) {

        if (
          isAllMarked()
        ) {

          completeElement
            ?.classList.add(
              "show"
            );


          setStatus(
            "全答案・全設問の採点が完了しました。"
          );

        } else {

          setStatus(
            "未採点の答案があります。",
            true
          );

        }


        return;

      }


      questionIndex++;

      activeAnswerIndex =
        0;

      clearKeyboard();

      await renderQuestion();

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


  $("logoutButton")
    ?.addEventListener(
      "click",
      async () => {

        await logout();

      }
    );

}


/* =========================================================
   LINKS
========================================================= */

function setupNavigationLinks() {

  const points =
    $("pointsButton");


  if (points) {

    points.href =
      `/teacher/tests/points?test=${encodeURIComponent(
        testId
      )}`;

  }

}


/* =========================================================
   TOOLBAR
========================================================= */

function setupMarkToolbar() {
  const applyScoreTypography = () => {
    const family = $("scoreFontFamily")?.value || "sans-serif";
    const size = Number($("scoreFontSize")?.value) || 18;
    document.documentElement.style.setProperty("--score-font-family", family);
    document.documentElement.style.setProperty("--score-font-size", size + "px");
  };
  $("scoreFontFamily")?.addEventListener("change", applyScoreTypography);
  $("scoreFontSize")?.addEventListener("change", applyScoreTypography);
  applyScoreTypography();

  document
    .querySelectorAll(
      "#markToolbar [data-mark]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectedMarkType =
              button.dataset.mark ||
              null;


            document
              .querySelectorAll(
                "#markToolbar [data-mark]"
              )
              .forEach(
                item => {

                  item.classList.toggle(
                    "active",
                    item ===
                      button
                  );

                }
              );


            setStatus(
              `${markLabel(
                selectedMarkType
              )}を選択しました。答案をクリックして配置できます。`
            );

          }
        );

      }
    );

}



function setupStudentNavigation() {
  const go = async direction => {
    try {
      const { data, error } = await DB.from("answer_sheets")
        .select("student_id,created_at")
        .eq("test_id", testId)
        .not("student_id", "is", null)
        .in("status", ["matched","marking","marked"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = [...new Set((data || []).map(row => row.student_id).filter(Boolean))];
      const index = ids.indexOf(selectedStudentId);
      const next = ids[index + direction];
      if (!next) {
        setStatus(direction > 0 ? "最後の生徒です。" : "最初の生徒です。");
        return;
      }
      location.href = "/teacher/marking/mark?test=" + encodeURIComponent(testId) + "&student=" + encodeURIComponent(next);
    } catch (error) {
      setStatus(error.message || "生徒を切り替えられませんでした。", true);
    }
  };
  $("previousStudentButton")?.addEventListener("click", () => go(-1));
  $("nextStudentButton")?.addEventListener("click", () => go(1));
  const back = $("studentListButton");
  if (back) back.href = "/teacher/marking/select?test=" + encodeURIComponent(testId);
}

/* =========================================================
   LOAD EVERYTHING
========================================================= */

async function loadEverything() {

  setStatus(
    "採点データを読み込んでいます..."
  );


  await loadTest();

  await loadAnswers();

  await loadQuestions();

  await loadScores();

  await loadMarks();

  await loadPages();

  await loadRegions();


  if (!answers.length) {

    throw new Error(
      "採点対象の答案がありません。"
    );

  }


  if (!questions.length) {

    throw new Error(
      "採点対象の解答欄がありません。"
    );

  }


  questionIndex =
    Math.min(
      questionIndex,
      questions.length - 1
    );


  activeAnswerIndex =
    0;


  await renderQuestion();


  setStatus(
    `${test.name || "テスト"} の採点です。`
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
        class_name
        `
      )
      .eq(
        "id",
        testId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "テストが見つかりません。"
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
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        student_id,
        status,
        created_at
        `
      )
      .eq(
        "test_id",
        testId
      )
      .eq(
        "student_id",
        selectedStudentId
      )
      .not(
        "student_id",
        "is",
        null
      )
      .in(
        "status",
        [
          "matched",
          "marking",
          "marked"
        ]
      )
      .order(
        "created_at",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  answers =
    data || [];

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
        box_role,
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
        box =>
          !["major", "minor"].includes(box.box_role) &&
          !excluded.has(
            String(
              box.label ||
              ""
            ).trim()
          )
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
      "採点対象のanswer枠がありません。"
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


  if (!ids.length) {

    return;

  }


  const chunkSize =
    300;


  for (
    let start = 0;
    start <
    ids.length;
    start +=
      chunkSize
  ) {

    const chunk =
      ids.slice(
        start,
        start +
          chunkSize
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
          chunk
        );


    if (error) {

      throw error;

    }


    scores.push(
      ...(data || [])
    );

  }

}


/* =========================================================
   MARKS
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


  const chunkSize =
    300;


  for (
    let start = 0;
    start <
    ids.length;
    start +=
      chunkSize
  ) {

    const chunk =
      ids.slice(
        start,
        start +
          chunkSize
      );


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
          font_family,
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
          chunk
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      /*
       * 記号テーブルが無い環境でも
       * 点数採点は続行。
       */

      console.warn(
        "mark_objects:",
        error
      );

      return;

    }


    marks.push(
      ...(data || [])
    );

  }

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


  const chunkSize =
    300;


  for (
    let start = 0;
    start <
    ids.length;
    start +=
      chunkSize
  ) {

    const chunk =
      ids.slice(
        start,
        start +
          chunkSize
      );


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
          width_px,
          height_px
          `
        )
        .in(
          "answer_sheet_id",
          chunk
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


    (
      data ||
      []
    ).forEach(
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

}


/* =========================================================
   REGIONS
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


  const chunkSize =
    300;


  for (
    let start = 0;
    start <
    ids.length;
    start +=
      chunkSize
  ) {

    const chunk =
      ids.slice(
        start,
        start +
          chunkSize
      );


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
          chunk
        );


    if (error) {

      console.warn(
        "answer_regions:",
        error
      );

      continue;

    }


    (
      data ||
      []
    ).forEach(
      region => {

        regions.set(
          `${region.answer_sheet_id}:${region.layout_box_id}`,
          region
        );

      }
    );

  }

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
    [
      test.name,
      test.subject,
      `配点 ${formatNumber(
        question.points
      )}点`,
      `${questionIndex + 1} / ${questions.length}`
    ]
      .filter(Boolean)
      .join(
        " / "
      );


  previousButton.disabled =
    questionIndex <=
    0;


  nextButton.textContent =
    questionIndex >=
      questions.length - 1
      ? "完了"
      : "次の問題";


  activeAnswerIndex =
    Math.min(
      activeAnswerIndex,
      Math.max(
        0,
        answers.length - 1
      )
    );


  answerTableWrap.innerHTML =
    "";


  const grid =
    document.createElement(
      "div"
    );


  grid.className =
    "answer-grid";


  /*
   * 全答案を一気にカード化。
   */

  const fragments =
    await Promise.all(
      answers.map(
        (
          answer,
          index
        ) =>
          createAnswerCard(
            answer,
            question,
            index
          )
      )
    );


  fragments.forEach(
    card =>
      grid.appendChild(
        card
      )
  );


  answerTableWrap.appendChild(
    grid
  );


  updateActiveCard();

  updateProgress();

}


/* =========================================================
   ANSWER CARD
========================================================= */

async function createAnswerCard(
  answer,
  question,
  index
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "answer-card";


  card.dataset.answerId =
    answer.id;


  card.dataset.index =
    String(
      index
    );


  const head =
    document.createElement(
      "div"
    );


  head.className =
    "answer-card-head";


  const label =
    document.createElement(
      "span"
    );


  label.className =
    "answer-label";


  /*
   * 生徒名・番号は出さない。
   */

  label.textContent =
    `答案 ${String(
      index + 1
    ).padStart(
      3,
      "0"
    )}`;


  const state =
    document.createElement(
      "span"
    );


  state.className =
    "answer-state";


  const existing =
    findScore(
      answer.id,
      question.id
    );


  if (
    existing?.status ===
    "marked"
  ) {

    state.textContent =
      "採点済み";


    state.classList.add(
      "marked"
    );

  } else {

    state.textContent =
      "未採点";

  }


  head.append(
    label,
    state
  );


  const imageArea =
    document.createElement(
      "div"
    );


  imageArea.className =
    "answer-image-area";


  imageArea.dataset.answerId =
    answer.id;


  imageArea.dataset.questionId =
    question.id;


  imageArea.addEventListener(
    "click",
    event => {

      activeAnswerIndex =
        index;


      updateActiveCard();


      if (
        selectedMarkType
      ) {

        placeMark(
          event,
          imageArea,
          answer,
          question,
          selectedMarkType
        );

      }

    }
  );


  await renderAnswerImage(
    imageArea,
    answer,
    question
  );


  renderMarksForCard(
    imageArea,
    answer,
    question
  );


  const score =
    document.createElement(
      "div"
    );


  score.className =
    "answer-score";


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
    existing?.score ??
    "";


  input.dataset.answerId =
    answer.id;


  input.dataset.questionId =
    question.id;


  input.addEventListener(
    "focus",
    () => {

      activeAnswerIndex =
        index;


      numericBuffer =
        input.value ||
        "";


      updateActiveCard();

    }
  );


  input.addEventListener(
    "input",
    () => {

      activeAnswerIndex =
        index;

      numericBuffer =
        input.value ||
        "";

    }
  );


  input.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();


        saveCardScore(
          answer,
          question,
          input,
          state
        );

      }

    }
  );


  const saveButton =
    document.createElement(
      "button"
    );


  saveButton.className =
    "score-button primary";


  saveButton.type =
    "button";


  saveButton.textContent =
    "保存";


  saveButton.addEventListener(
    "click",
    () => {

      activeAnswerIndex =
        index;


      saveCardScore(
        answer,
        question,
        input,
        state
      );

    }
  );


  const zeroButton =
    document.createElement(
      "button"
    );


  zeroButton.className =
    "score-button";


  zeroButton.type =
    "button";


  zeroButton.textContent =
    "0";


  zeroButton.addEventListener(
    "click",
    () => {

      activeAnswerIndex =
        index;

      input.value =
        "0";


      numericBuffer =
        "0";


      saveCardScore(
        answer,
        question,
        input,
        state,
        true
      );

    }
  );


  const fullButton =
    document.createElement(
      "button"
    );


  fullButton.className =
    "score-button";


  fullButton.type =
    "button";


  fullButton.textContent =
    "満点";


  fullButton.addEventListener(
    "click",
    () => {

      activeAnswerIndex =
        index;

      input.value =
        String(
          question.points
        );


      numericBuffer =
        input.value;


      saveCardScore(
        answer,
        question,
        input,
        state,
        true
      );

    }
  );


  score.append(
    input,
    saveButton,
    zeroButton,
    fullButton
  );


  const status =
    document.createElement(
      "div"
    );


  status.className =
    "score-status";


  status.textContent =
    existing?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    existing?.status ===
    "marked"
  ) {

    status.classList.add(
      "marked"
    );

  }


  card.append(
    head,
    imageArea,
    score,
    status
  );


  card._scoreState =
    status;


  card._scoreInput =
    input;


  card._answer =
    answer;


  card._question =
    question;


  return card;

}


/* =========================================================
   ANSWER IMAGE
========================================================= */

async function renderAnswerImage(
  target,
  answer,
  question
) {

  const region =
    regions.get(
      `${answer.id}:${question.id}`
    );


  if (
    region?.image_path
  ) {

    try {

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
            1800
          );


      if (
        !error &&
        data?.signedUrl
      ) {

        const image =
          document.createElement(
            "img"
          );


        image.src =
          data.signedUrl;


        image.alt =
          "答案";


        target.appendChild(
          image
        );


        return;

      }

    } catch (error) {

      console.warn(
        "region image:",
        error
      );

    }

  }


  /*
   * regionが無い場合は
   * 元答案ページから表示。
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


  if (!page?.file_path) {

    target.innerHTML = `

      <div class="answer-error">
        答案画像がありません。
      </div>

    `;

    return;

  }


  try {

    const {
      data,
      error
    } =
      await DB
        .storage
        .from(
          "test-files"
        )
        .createSignedUrl(
          page.file_path,
          1800
        );


    if (
      error ||
      !data?.signedUrl
    ) {

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


    await waitForImage(
      image
    );


    /*
     * 元答案を問題枠でCSSクロップ。
     */

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
      (
        Number(
          question.x
        ) || 0
      ) *
      scaleX;


    const y =
      (
        Number(
          question.y
        ) || 0
      ) *
      scaleY;


    const width =
      (
        Number(
          question.width
        ) || 1
      ) *
      scaleX;


    const height =
      (
        Number(
          question.height
        ) || 1
      ) *
      scaleY;


    target.style.aspectRatio =
      `${Math.max(
        1,
        width
      )} / ${Math.max(
        1,
        height
      )}`;


    image.style.position =
      "absolute";


    image.style.width =
      `${image.naturalWidth}px`;


    image.style.maxWidth =
      "none";


    image.style.left =
      `${-x}px`;


    image.style.top =
      `${-y}px`;


    target.appendChild(
      image
    );

  } catch (error) {

    target.innerHTML = `

      <div class="answer-error">

        ${escapeHtml(
          error.message ||
          "答案画像を表示できませんでした。"
        )}

      </div>

    `;

  }

}


/* =========================================================
   MARK RENDER
========================================================= */

function renderMarksForCard(
  target,
  answer,
  question
) {

  const list =
    marks.filter(
      mark =>
        mark.answer_sheet_id ===
          answer.id &&
        mark.layout_box_id ===
          question.id
    );


  list.forEach(
    mark => {

      const element =
        createMarkElement(
          mark,
          target
        );


      target.appendChild(
        element
      );

    }
  );

}


/* =========================================================
   CREATE MARK
========================================================= */

function createMarkElement(
  mark,
  target
) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "mark-object";


  element.dataset.markId =
    mark.id;


  element.dataset.markType =
    mark.object_type;


  const fontSize =
    Number(
      mark.font_size
    ) || 32;


  const x =
    Number(
      mark.x
    ) || 0;


  const y =
    Number(
      mark.y
    ) || 0;


  element.style.left =
    `${x}px`;


  element.style.top =
    `${y}px`;


  element.style.fontSize =
    `${fontSize}px`;

  element.style.fontFamily = mark.font_family || "sans-serif";


  element.style.color =
    mark.color ||
    "#d00000";


  if (
    mark.object_type ===
    "circle"
  ) {

    element.textContent =
      "○";

  } else if (
    mark.object_type ===
    "x"
  ) {

    element.textContent =
      "×";

  } else if (
    mark.object_type ===
    "triangle"
  ) {

    element.textContent =
      "△";

  } else if (
    mark.object_type ===
    "double_circle"
  ) {

    element.textContent =
      "◎";

  } else if (
    mark.object_type ===
    "text"
  ) {

    element.textContent =
      mark.text_value ||
      "";

  } else if (
    mark.object_type ===
    "pen"
  ) {

    element.textContent =
      "／";

  }


  element.addEventListener(
    "click",
    async event => {

      event.stopPropagation();


      const answer =
        answers.find(
          item =>
            marks.some(
              markItem =>
                markItem.id ===
                mark.id &&
                markItem.answer_sheet_id ===
                item.id
            )
        );


      const question =
        questions.find(
          item =>
            item.id ===
            mark.layout_box_id
        );


      if (
        answer &&
        question
      ) {

        await deleteMark(
          mark,
          answer,
          question
        );

      }

    }
  );


  return element;

}


/* =========================================================
   PLACE MARK
========================================================= */

function placeMark(
  event,
  target,
  answer,
  question,
  type
) {
  const markColor = $("markColor")?.value || "#d00000";
  const markFontSize = Number($("markFontSize")?.value) || 32;
  const markStrokeWidth = Number($("markStrokeWidth")?.value) || 3;
  const markFontFamily = $("markFontFamily")?.value || "sans-serif";
  const markTextValue = $("markTextValue")?.value?.trim() || "文字";


  const rect =
    target.getBoundingClientRect();


  const x =
    Math.max(
      0,
      event.clientX -
        rect.left -
        16
    );


  const y =
    Math.max(
      0,
      event.clientY -
        rect.top -
        16
    );


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
      type ===
        "text"
        ? markTextValue
        : null,

    color:
      markColor,

    font_size:
      markFontSize,

    font_family:
      markFontFamily,

    stroke_width:
      markStrokeWidth,

    x,

    y,

    width:
      40,

    height:
      40,

    points:
      null

  };


  marks =
    marks.filter(
      item =>
        !(
          item.answer_sheet_id ===
            answer.id &&
          item.layout_box_id ===
            question.id &&
          type !==
            "pen"
        )
    );


  marks.push(
    mark
  );


  renderMarksForCard(
    target,
    answer,
    question
  );


  /*
   * 保存は点数保存時だけでなく、
   * 記号選択直後にも実行。
   */

  saveMarkObject(
    mark
  );


  selectedMarkType =
    null;


  document
    .querySelectorAll(
      "#markToolbar [data-mark]"
    )
    .forEach(
      button =>
        button.classList.remove(
          "active"
        )
    );

}


/* =========================================================
   SAVE MARK
========================================================= */

async function saveMarkObject(
  mark
) {
  try {
    const { error } = await DB
      .from("mark_objects")
      .upsert({
        id: mark.id,
        answer_sheet_id: mark.answer_sheet_id,
        layout_box_id: mark.layout_box_id,
        question_id: mark.question_id,
        object_type: mark.object_type,
        text_value: mark.text_value,
        color: mark.color,
        font_size: mark.font_size,
        font_family: mark.font_family || "sans-serif",
        stroke_width: mark.stroke_width,
        x: mark.x,
        y: mark.y,
        width: mark.width,
        height: mark.height,
        points: mark.points
      }, { onConflict: "id" });

    if (error) throw error;
    setStatus("採点記号を保存しました。");
    return true;
  } catch (error) {
    console.error("mark save:", error);
    setStatus(
      `採点記号を保存できませんでした: ${error.message || "原因不明のエラー"}`,
      true
    );
    return false;
  }
}

/* =========================================================
   DELETE MARK
========================================================= */

async function deleteMark(
  mark,
  answer,
  question
) {

  marks =
    marks.filter(
      item =>
        item.id !==
        mark.id
    );


  try {

    await DB
      .from(
        "mark_objects"
      )
      .delete()
      .eq(
        "id",
        mark.id
      );

  } catch (error) {

    console.warn(
      "mark delete:",
      error
    );

  }


  const card =
    document.querySelector(
      `.answer-card[data-answer-id="${cssEscape(
        answer.id
      )}"]`
    );


  const area =
    card?.querySelector(
      ".answer-image-area"
    );


  if (area) {

    renderMarksForCard(
      area,
      answer,
      question
    );

  }

}


/* =========================================================
   KEYBOARD
========================================================= */

async function handleKeyboard(
  event
) {

  /*
   * 入力欄で通常入力している場合、
   * L/K/Escapeだけ処理。
   */

  const target =
    event.target;


  const isInput =
    target instanceof
      HTMLInputElement ||
    target instanceof
      HTMLTextAreaElement ||
    target instanceof
      HTMLSelectElement;


  if (
    isInput &&
    target.classList.contains(
      "score-input"
    )
  ) {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();


      const card =
        target.closest(
          ".answer-card"
        );


      if (
        card?._answer &&
        card?._question
      ) {

        await saveCardScore(
          card._answer,
          card._question,
          target,
          card._scoreState
        );

      }


      return;

    }


    if (
      event.key ===
      "Escape"
    ) {

      event.preventDefault();


      clearKeyboard();


      target.blur();


      return;

    }

  }


  if (
    event.key ===
    "Escape"
  ) {

    selectedMarkType =
      null;


    numericBuffer =
      "";


    document
      .querySelectorAll(
        "#markToolbar [data-mark]"
      )
      .forEach(
        button =>
          button.classList.remove(
            "active"
          )
      );


    return;

  }


  /*
   * L = ○ + 満点
   */

  if (
    event.key ===
      "l" ||
    event.key ===
      "L"
  ) {

    event.preventDefault();


    await quickScore(
      questionIndex,
      activeAnswerIndex,
      "full"
    );


    return;

  }


  /*
   * K = × + 0点
   */

  if (
    event.key ===
      "k" ||
    event.key ===
      "K"
  ) {

    event.preventDefault();


    await quickScore(
      questionIndex,
      activeAnswerIndex,
      "zero"
    );


    return;

  }


  /*
   * 数字キー
   */

  if (
    /^[0-9]$/.test(
      event.key
    )
  ) {

    event.preventDefault();


    const card =
      getActiveCard();


    const input =
      card?.querySelector(
        ".score-input"
      );


    if (!input) {

      return;

    }


    numericBuffer +=
      event.key;


    /*
     * 3桁以上にはしない。
     */

    numericBuffer =
      numericBuffer.slice(
        -3
      );


    input.value =
      numericBuffer;


    return;

  }


  if (
    event.key ===
    "Backspace"
  ) {

    event.preventDefault();


    numericBuffer =
      numericBuffer.slice(
        0,
        -1
      );


    const card =
      getActiveCard();


    const input =
      card?.querySelector(
        ".score-input"
      );


    if (input) {

      input.value =
        numericBuffer;

    }


    return;

  }


  /*
   * Enter
   */

  if (
    event.key ===
    "Enter"
  ) {

    event.preventDefault();


    const card =
      getActiveCard();


    if (
      card?._answer &&
      card?._question
    ) {

      const input =
        card.querySelector(
          ".score-input"
        );


      await saveCardScore(
        card._answer,
        card._question,
        input,
        card._scoreState
      );

    }

  }

}


/* =========================================================
   QUICK SCORE
========================================================= */

async function quickScore(
  qIndex,
  answerIndex,
  type
) {

  const question =
    questions[
      qIndex
    ];


  const answer =
    answers[
      answerIndex
    ];


  if (
    !question ||
    !answer
  ) {

    return;

  }


  const card =
    getActiveCard();


  if (!card) {

    return;

  }


  const input =
    card.querySelector(
      ".score-input"
    );


  const state =
    card._scoreState;


  const value =
    type ===
      "full"
      ? Number(
          question.points
        )
      : 0;


  input.value =
    String(
      value
    );


  /*
   * 記号をローカル追加。
   */

  const markType =
    type ===
      "full"
      ? "circle"
      : "x";


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
      markType,

    text_value:
      null,

    color:
      "#d00000",

    font_size:
      32,

    stroke_width:
      3,

    x:
      8,

    y:
      8,

    width:
      40,

    height:
      40,

    points:
      value

  };


  marks =
    marks.filter(
      item =>
        !(
          item.answer_sheet_id ===
            answer.id &&
          item.layout_box_id ===
            question.id
        )
    );


  marks.push(
    mark
  );


  await saveCardScore(
    answer,
    question,
    input,
    state,
    true
  );

}


/* =========================================================
   SAVE CARD SCORE
========================================================= */

async function saveCardScore(
  answer,
  question,
  input,
  state,
  autoNext = true
) {

  if (saving) {

    return;

  }


  const raw =
    input?.value ??
    "";


  if (
    raw ===
    ""
  ) {

    setStatus(
      "点数を入力してください。",
      true
    );

    return;

  }


  const value =
    Number(
      raw
    );


  if (
    !Number.isFinite(
      value
    )
  ) {

    setStatus(
      "点数が不正です。",
      true
    );

    return;

  }


  if (
    value <
    0
  ) {

    setStatus(
      "0点未満にはできません。",
      true
    );

    return;

  }


  if (
    value >
    Number(
      question.points
    )
  ) {

    setStatus(
      `配点 ${formatNumber(
        question.points
      )}点を超えています。`,
      true
    );

    return;

  }


  try {

    saving =
      true;


    const existing =
      findScore(
        answer.id,
        question.id
      );


    if (
      existing?.id
    ) {

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
          .select()
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
          .select()
          .single();


      if (error) {

        throw error;

      }


      scores.push(
        data
      );

    }


    /*
     * 答案状態をmarkingにしておき、
     * 全設問完了時にmarkedへ。
     */

    await DB
      .from(
        "answer_sheets"
      )
      .update({
        status:
          "marking"
      })
      .eq(
        "id",
        answer.id
      );


    await saveMarksForAnswerQuestion(
      answer,
      question
    );


    if (state) {

      state.textContent =
        "採点済み";


      state.className =
        "score-status marked";

    }


    numericBuffer =
      "";


    updateProgress();


    /*
     * 同じ設問の次の答案へ。
     */

    if (
      autoNext
    ) {

      await moveToNextAnswer();

    }


  } catch (error) {

    console.error(
      "save score:",
      error
    );


    setStatus(
      error.message ||
      "採点を保存できませんでした。",
      true
    );

  } finally {

    saving =
      false;

  }

}


/* =========================================================
   SAVE MARKS
========================================================= */

async function saveMarksForAnswerQuestion(
  answer,
  question
) {

  const questionMarks =
    marks.filter(
      mark =>
        mark.answer_sheet_id ===
          answer.id &&
        mark.layout_box_id ===
          question.id
    );


  /*
   * DB側を一度クリア。
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

    throw deleteError;

  }


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
          ) || 32,

        font_family:
          mark.font_family || "sans-serif",

        stroke_width:
          Number(
            mark.stroke_width
          ) || 3,

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
          ) || 40,

        height:
          Number(
            mark.height
          ) || 40,

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

    throw insertError;

  }

}


/* =========================================================
   MOVE NEXT ANSWER
========================================================= */

async function moveToNextAnswer() {

  if (
    activeAnswerIndex >=
    answers.length - 1
  ) {

    /*
     * この設問の全答案完了。
     */

    if (
      isQuestionMarked(
        questions[
          questionIndex
        ]
      )
    ) {

      setStatus(
        `${questions[questionIndex].label} の全答案を採点しました。`
      );

    }


    return;

  }


  activeAnswerIndex++;

  numericBuffer =
    "";


  updateActiveCard();


  const nextCard =
    getActiveCard();


  const input =
    nextCard?.querySelector(
      ".score-input"
    );


  if (input) {

    input.focus();

  }

}


/* =========================================================
   ACTIVE CARD
========================================================= */

function getActiveCard() {

  return document.querySelector(
    `.answer-card[data-index="${activeAnswerIndex}"]`
  );

}


function updateActiveCard() {

  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      (
        card,
        index
      ) => {

        card.classList.toggle(
          "active",
          index ===
            activeAnswerIndex
        );

      }
    );

}


/* =========================================================
   SCORE FIND
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
            score?.status ===
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


  if (progressBar) {

    progressBar.style.width =
      `${percent}%`;

  }


  if (progressText) {

    progressText.textContent =
      `${completed} / ${total}件`;

  }


  if (
    total > 0 &&
    completed === total
  ) {

    completeElement
      ?.classList.add(
        "show"
      );


    /*
     * 全答案をmarkedへ。
     */

    finalizeAnswerStatuses();


  } else {

    completeElement
      ?.classList.remove(
        "show"
      );

  }

}


/* =========================================================
   FINALIZE ANSWER STATUS
========================================================= */

async function finalizeAnswerStatuses() {

  /*
   * ここは何度呼ばれても安全。
   */

  for (
    const answer
    of answers
  ) {

    const complete =
      questions.every(
        question =>
          findScore(
            answer.id,
            question.id
          )?.status ===
          "marked"
      );


    if (!complete) {

      continue;

    }


    /*
     * DB状態をmarkedへ。
     */

    const {
      error
    } =
      await DB
        .from(
          "answer_sheets"
        )
        .update({
          status:
            "marked"
        })
        .eq(
          "id",
          answer.id
        );


    if (error) {

      console.warn(
        "answer status:",
        error
      );

    }

  }


  /*
   * 公開状態はここでは変更しない。
   *
   * 成績集計が完了してから
   * results_published=true にする。
   */

  setStatus(
    "全答案・全設問の採点が完了しました。"
  );

}


/* =========================================================
   QUESTION COMPLETE
========================================================= */

function isQuestionMarked(
  question
) {

  if (!question) {

    return false;

  }


  return answers.every(
    answer =>
      findScore(
        answer.id,
        question.id
      )?.status ===
      "marked"
  );

}


/* =========================================================
   ALL COMPLETE
========================================================= */

function isAllMarked() {

  return questions.every(
    question =>
      isQuestionMarked(
        question
      )
  );

}


/* =========================================================
   KEYBOARD CLEAR
========================================================= */

function clearKeyboard() {

  numericBuffer =
    "";

}


/* =========================================================
   MARK LABEL
========================================================= */

function markLabel(
  type
) {

  const labels = {

    circle:
      "○",

    x:
      "×",

    triangle:
      "△",

    double_circle:
      "◎",

    text:
      "文字",

    pen:
      "ペン"

  };


  return labels[
    type
  ] ||
  type ||
  "";

}


/* =========================================================
   IMAGE WAIT
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
        resolve;


      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );

    }
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


  if (answerTableWrap) {

    answerTableWrap.innerHTML = `

      <div
        style="
          padding:50px;
          text-align:center;
          color:#b42318;
        "
      >

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
   CSS ESCAPE
========================================================= */

function cssEscape(
  value
) {

  const text =
    String(
      value ??
      ""
    );


  if (
    window.CSS &&
    typeof window.CSS.escape ===
      "function"
  ) {

    return window.CSS.escape(
      text
    );

  }


  return text.replace(
    /[^a-zA-Z0-9_-]/g,
    "\\$&"
  );

}


/* =========================================================
   NUMBER
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
