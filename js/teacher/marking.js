
"use strict";

/* =========================================================
   デジタル採点・高速串刺し採点

   仕様
   ---------------------------------------------------------
   ・答案選択画面を使用しない
   ・同じ設問を画面いっぱいに複数答案表示
   ・画面サイズから表示数を自動調整
   ・生徒名、学籍番号、QRは表示しない
   ・大問は表示しない
   ・設問単位で採点
   ・L  → ○ + 満点
   ・K  → × + 0点
   ・数字 → 部分点
   ・Enter → 保存
   ・Backspace → 数字削除
   ・Escape → 選択解除
   ・○ × △ ◎ 文字 ペン 消しゴム
   ・answer_regionsを優先表示
   ・クロップが無い場合は元答案を枠位置で表示
   ・採点済みは自動的に次の答案へ
   ・現在のグループ終了で次グループ
   ・全員終了で次の設問
   ・最後まで終了したら成績処理へ
========================================================= */


/* =========================================================
   STATE
========================================================= */

let DB = null;

let testId = null;

let test = null;

let answers = [];

let questions = [];

let pages = new Map();

let regions = new Map();

let scores = new Map();

let marks = new Map();

let questionIndex = 0;

let batchStart = 0;

let batchSize = 1;

let selectedAnswerId = null;

let selectedTool = null;

let numericBuffer = "";

let processing = false;


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


    const params =
      new URLSearchParams(
        location.search
      );


    testId =
      params.get("test") ||
      window.__INITIAL_TEST_ID__ ||
      null;


    if (!testId) {

      throw new Error(
        "テストIDがありません。"
      );

    }


    await requireTeacher();

    setupEvents();

    createNumberButtons();

    await loadAll();

    calculateBatchSize();

    window.addEventListener(
      "resize",
      handleResize
    );

    await render();

  } catch (error) {

    console.error(
      "marking:",
      error
    );

    showError(
      error.message ||
      "採点画面を起動できませんでした。"
    );

  }

}


/* =========================================================
   AUTH
========================================================= */

async function requireTeacher() {

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


    const name =
      $("teacherName");


    if (name) {

      name.textContent =
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

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  $("previousButton")
    ?.addEventListener(
      "click",
      previousQuestion
    );


  $("nextButton")
    ?.addEventListener(
      "click",
      nextQuestion
    );


  $("nextUnmarked")
    ?.addEventListener(
      "click",
      nextUnmarked
    );


  $("refreshButton")
    ?.addEventListener(
      "click",
      async () => {

        await loadAll();

        await render();

      }
    );


  $("logoutButton")
    ?.addEventListener(
      "click",
      async () => {

        if (
          typeof window.logout ===
          "function"
        ) {

          await window.logout();

        }

      }
    );


  /*
   * 採点ツール
   */

  document
    .querySelectorAll(
      "[data-mark]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            setTool(
              button.dataset.mark
            );

          }
        );

      }
    );


  /*
   * L / K
   */

  document
    .querySelector(
      "[data-quick-score=\"full\"]"
    )
    ?.addEventListener(
      "click",
      () => {

        quickScore(
          "full"
        );

      }
    );


  document
    .querySelector(
      "[data-quick-score=\"zero\"]"
    )
    ?.addEventListener(
      "click",
      () => {

        quickScore(
          "zero"
        );

      }
    );


  document
    .getElementById(
      "numberToolbar"
    )
    ?.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-score]"
          );


        if (!button) {

          return;

        }


        scoreSelected(
          Number(
            button.dataset.score
          )
        );

      }
    );


  document.addEventListener(
    "keydown",
    handleKeyboard
  );

}


/* =========================================================
   LOAD ALL
========================================================= */

async function loadAll() {

  setStatus(
    "採点データを読み込んでいます..."
  );


  await loadTest();

  await loadAnswers();

  await loadPages();

  await loadRegions();

  await loadQuestions();

  await loadScores();

  await loadMarks();


  questionIndex =
    Math.min(
      questionIndex,
      Math.max(
        0,
        questions.length - 1
      )
    );


  batchStart =
    Math.min(
      batchStart,
      Math.max(
        0,
        answers.length - 1
      )
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
      .from("tests")
      .select(`
        id,
        name,
        subject,
        grade,
        class_name
      `)
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
      .from("answer_sheets")
      .select(`
        id,
        test_id,
        student_id,
        qr_value,
        status,
        uploaded_at,
        created_at
      `)
      .eq(
        "test_id",
        testId
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


  if (!answers.length) {

    throw new Error(
      "このテストには答案がありません。"
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


  const {
    data,
    error
  } =
    await DB
      .from("answer_sheet_pages")
      .select(`
        answer_sheet_id,
        page_no,
        file_path,
        file_type,
        original_name,
        width_px,
        height_px
      `)
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


  const {
    data,
    error
  } =
    await DB
      .from("answer_regions")
      .select(`
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
      `)
      .in(
        "answer_sheet_id",
        ids
      );


  if (error) {

    /*
     * クロップ未作成でも
     * 元答案から表示できる。
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
          regionKey(
            region.answer_sheet_id,
            region.layout_box_id
          ),
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
        box =>
          String(
            box.box_type ||
            ""
          )
            .trim()
            .toLowerCase() ===
          "answer"
      )
      .filter(
        box =>
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
            ) || index

        })
      );


  if (!questions.length) {

    throw new Error(
      "採点対象の解答欄がありません。"
    );

  }

}


/* =========================================================
   SCORES
========================================================= */

async function loadScores() {

  scores =
    new Map();


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
      .from("scores")
      .select(`
        id,
        answer_sheet_id,
        layout_box_id,
        question_id,
        score,
        status,
        marked_at
      `)
      .in(
        "answer_sheet_id",
        ids
      );


  if (error) {

    throw error;

  }


  (data || [])
    .forEach(
      score => {

        scores.set(
          scoreKey(
            score.answer_sheet_id,
            score.layout_box_id
          ),
          score
        );

      }
    );

}


/* =========================================================
   MARKS
========================================================= */

async function loadMarks() {

  marks =
    new Map();


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
      .from("mark_objects")
      .select(`
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
      `)
      .in(
        "answer_sheet_id",
        ids
      );


  if (error) {

    /*
     * 記号テーブルが無い場合でも
     * 点数採点は可能。
     */

    console.warn(
      "mark_objects:",
      error
    );

    return;

  }


  (data || [])
    .forEach(
      mark => {

        const key =
          scoreKey(
            mark.answer_sheet_id,
            mark.layout_box_id
          );


        if (
          !marks.has(key)
        ) {

          marks.set(
            key,
            []
          );

        }


        marks
          .get(key)
          .push(
            mark
          );

      }
    );

}


/* =========================================================
   BATCH SIZE
========================================================= */

function calculateBatchSize() {

  const area =
    $("answerArea");


  if (!area) {

    batchSize =
      12;

    return;

  }


  const width =
    area.clientWidth;


  const height =
    area.clientHeight;


  const minCardWidth =
    240;


  const minCardHeight =
    230;


  const columns =
    Math.max(
      1,
      Math.floor(
        width /
        minCardWidth
      )
    );


  const rows =
    Math.max(
      1,
      Math.floor(
        height /
        minCardHeight
      )
    );


  batchSize =
    Math.max(
      1,
      columns *
      rows
    );

}


function handleResize() {

  const oldSize =
    batchSize;


  calculateBatchSize();


  if (
    oldSize !==
    batchSize
  ) {

    render();

  }

}


/* =========================================================
   RENDER
========================================================= */

async function render() {

  if (
    !questions.length
  ) {

    return;

  }


  calculateBatchSize();


  const question =
    questions[
      questionIndex
    ];


  const visible =
    answers.slice(
      batchStart,
      batchStart +
        batchSize
    );


  $("questionTitle").textContent =
    question.label;


  $("questionMeta").textContent =
    [
      test?.name,
      test?.subject,
      `配点 ${formatNumber(
        question.points
      )}点`,
      `${questionIndex + 1} / ${questions.length}`
    ]
      .filter(Boolean)
      .join(
        " / "
      );


  $("progressText").textContent =
    `${batchStart + 1}～${
      Math.min(
        batchStart +
        visible.length,
        answers.length
      )
    } / ${answers.length}`;


  $("progressTextBar").textContent =
    `${countMarked()} / ${
      answers.length *
      questions.length
    }`;

  
  $("progress").classList.add(
    "show"
  );


  const total =
    answers.length *
    questions.length;


  const done =
    countMarked();


  $("progressBar").style.width =
    `${
      total
        ? Math.round(
            done /
            total *
            100
          )
        : 0
    }%`;


  const grid =
    $("answerTableWrap");


  grid.innerHTML =
    "";


  if (!visible.length) {

    grid.innerHTML = `

      <div class="no-answer">
        答案がありません。
      </div>

    `;

    return;

  }


  for (
    const answer
    of visible
  ) {

    const card =
      await createCard(
        answer,
        question
      );


    grid.appendChild(
      card
    );

  }


  updateNavigation();


  /*
   * 先頭答案を選択。
   */

  if (
    !selectedAnswerId ||
    !visible.some(
      answer =>
        answer.id ===
        selectedAnswerId
    )
  ) {

    selectAnswer(
      visible[0]?.id
    );

  }

}


/* =========================================================
   CARD
========================================================= */

async function createCard(
  answer,
  question
) {

  const card =
    document.createElement(
      "article"
    );


  card.className =
    "answer-card";


  card.dataset.answerId =
    answer.id;


  const score =
    getScore(
      answer.id,
      question.id
    );


  if (
    score?.status ===
    "marked"
  ) {

    card.classList.add(
      "done"
    );

  }


  if (
    selectedAnswerId ===
    answer.id
  ) {

    card.classList.add(
      "selected"
    );

  }


  const header =
    document.createElement(
      "div"
    );


  header.className =
    "answer-header";


  header.textContent =
    "答案";


  const state =
    document.createElement(
      "span"
    );


  state.className =
    "answer-status";


  state.textContent =
    score?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  header.appendChild(
    state
  );


  const stage =
    await createStage(
      answer,
      question
    );


  const scoreBar =
    createScoreBar(
      answer,
      question
    );


  card.append(
    header,
    stage,
    scoreBar
  );


  card.addEventListener(
    "click",
    event => {

      if (
        event.target.closest(
          "button,input"
        )
      ) {

        return;

      }


      selectAnswer(
        answer.id
      );

    }
  );


  return card;

}


/* =========================================================
   STAGE
========================================================= */

async function createStage(
  answer,
  question
) {

  const stage =
    document.createElement(
      "div"
    );


  stage.className =
    "answer-stage";


  const region =
    regions.get(
      regionKey(
        answer.id,
        question.id
      )
    );


  if (
    region?.image_path
  ) {

    const image =
      await createRegionImage(
        region
      );


    if (image) {

      image.classList.add(
        "answer-image",
        "crop"
      );


      stage.appendChild(
        image
      );


    }

  } else {

    await renderOriginalCrop(
      stage,
      answer,
      question
    );

  }


  const layer =
    document.createElement(
      "div"
    );


  layer.className =
    "answer-mark-layer";


  stage.appendChild(
    layer
  );


  renderMarks(
    layer,
    answer.id,
    question.id
  );


  stage.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      selectAnswer(
        answer.id
      );


      if (
        selectedTool
      ) {

        placeMark(
          event,
          stage,
          answer.id,
          question.id
        );

      }

    }
  );


  return stage;

}


/* =========================================================
   REGION IMAGE
========================================================= */

async function createRegionImage(
  region
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
        900
      );


  if (error) {

    console.warn(
      error
    );

    return null;

  }


  if (
    !data?.signedUrl
  ) {

    return null;

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


  await waitImage(
    image
  );


  return image;

}


/* =========================================================
   ORIGINAL CROP
========================================================= */

async function renderOriginalCrop(
  stage,
  answer,
  question
) {

  const list =
    pages.get(
      answer.id
    ) ||
    [];


  const page =
    list.find(
      item =>
        Number(
          item.page_no
        ) ===
        Number(
          question.pageNo
        )
    );


  if (!page) {

    stage.innerHTML = `

      <div class="answer-error">
        答案ページがありません。
      </div>

    `;

    return;

  }


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
        900
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    stage.innerHTML = `

      <div class="answer-error">
        答案画像を取得できません。
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


  image.className =
    "answer-image-source";


  image.alt =
    "答案";


  await waitImage(
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


  const sx =
    image.naturalWidth /
    sourceWidth;


  const sy =
    image.naturalHeight /
    sourceHeight;


  const x =
    question.x *
    sx;


  const y =
    question.y *
    sy;


  const w =
    question.width *
    sx;


  const h =
    question.height *
    sy;


  const displayWidth =
    Math.min(
      600,
      Math.max(
        220,
        w
      )
    );


  const scale =
    displayWidth /
    w;


  stage.style.height =
    `${Math.max(
      150,
      h * scale
    )}px`;


  image.style.width =
    `${image.naturalWidth *
      scale}px`;


  image.style.height =
    `${image.naturalHeight *
      scale}px`;


  image.style.left =
    `${-x * scale}px`;


  image.style.top =
    `${-y * scale}px`;


  stage.appendChild(
    image
  );

}


/* =========================================================
   SCORE BAR
========================================================= */

function createScoreBar(
  answer,
  question
) {

  const bar =
    document.createElement(
      "div"
    );


  bar.className =
    "answer-score-bar";


  const score =
    getScore(
      answer.id,
      question.id
    );


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
    score
      ? score.score
      : "";


  input.addEventListener(
    "focus",
    () => {

      selectAnswer(
        answer.id
      );

    }
  );


  input.addEventListener(
    "change",
    async () => {

      await saveScore(
        answer.id,
        question.id,
        Number(
          input.value
        )
      );

    }
  );


  const full =
    createButton(
      "L",
      "quick-score full",
      async () => {

        selectAnswer(
          answer.id
        );

        await saveScore(
          answer.id,
          question.id,
          question.points
        );

      }
    );


  const zero =
    createButton(
      "K",
      "quick-score zero",
      async () => {

        selectAnswer(
          answer.id
        );

        await saveScore(
          answer.id,
          question.id,
          0
        );

      }
    );


  const state =
    document.createElement(
      "span"
    );


  state.className =
    "answer-state";


  state.textContent =
    score?.status ===
      "marked"
      ? "採点済み"
      : "未採点";


  if (
    score?.status ===
    "marked"
  ) {

    state.classList.add(
      "marked"
    );

  }


  bar.append(
    input,
    full,
    zero,
    state
  );


  return bar;

}


/* =========================================================
   BUTTON
========================================================= */

function createButton(
  text,
  className,
  handler
) {

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.textContent =
    text;


  button.className =
    className;


  button.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      handler();

    }
  );


  return button;

}


/* =========================================================
   TOOL
========================================================= */

function setTool(
  tool
) {

  selectedTool =
    tool;


  document
    .querySelectorAll(
      ".mark-tool"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.mark ===
            tool
        );

      }
    );


  if (
    tool ===
    "eraser"
  ) {

    setStatus(
      "消しゴム：答案上の記号をクリックしてください。"
    );

  }

}


/* =========================================================
   QUICK SCORE
========================================================= */

async function quickScore(
  type
) {

  const answer =
    getSelectedAnswer();


  if (!answer) {

    setStatus(
      "答案を選択してください。",
      true
    );

    return;

  }


  const question =
    questions[
      questionIndex
    ];


  if (!question) {

    return;

  }


  if (
    type ===
    "full"
  ) {

    await addAutoMark(
      answer.id,
      question.id,
      "circle"
    );


    await saveScore(
      answer.id,
      question.id,
      question.points
    );


  } else {

    await addAutoMark(
      answer.id,
      question.id,
      "x"
    );


    await saveScore(
      answer.id,
      question.id,
      0
    );

  }


  await autoAdvance();

}


/* =========================================================
   NUMBER
========================================================= */

async function scoreSelected(
  value
) {

  const answer =
    getSelectedAnswer();


  if (!answer) {

    return;

  }


  const question =
    questions[
      questionIndex
    ];


  if (!question) {

    return;

  }


  if (
    value >
    question.points
  ) {

    setStatus(
      `配点 ${formatNumber(
        question.points
      )}点を超えています。`,
      true
    );

    return;

  }


  numericBuffer =
    String(
      value
    );


  await saveScore(
    answer.id,
    question.id,
    value
  );


  await autoAdvance();

}


/* =========================================================
   KEYBOARD
========================================================= */

function handleKeyboard(
  event
) {

  if (
    event.target instanceof
      HTMLInputElement ||
    event.target instanceof
      HTMLTextAreaElement
  ) {

    /*
     * score-inputは数字入力を許可。
     */

    if (
      event.target.classList.contains(
        "score-input"
      )
    ) {

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        const answer =
          getSelectedAnswer();


        if (answer) {

          saveScore(
            answer.id,
            questions[
              questionIndex
            ].id,
            Number(
              event.target.value
            )
          );

        }

      }

      return;

    }

  }


  const key =
    event.key;


  if (
    key ===
    "l" ||
    key ===
    "L"
  ) {

    event.preventDefault();

    quickScore(
      "full"
    );

    return;

  }


  if (
    key ===
    "k" ||
    key ===
    "K"
  ) {

    event.preventDefault();

    quickScore(
      "zero"
    );

    return;

  }


  if (
    /^[0-9]$/.test(
      key
    )
  ) {

    event.preventDefault();


    numericBuffer +=
      key;


    const value =
      Number(
        numericBuffer
      );


    const question =
      questions[
        questionIndex
      ];


    if (
      value <=
      question.points
    ) {

      const answer =
        getSelectedAnswer();


      if (answer) {

        saveScore(
          answer.id,
          question.id,
          value
        );

      }

    }


    return;

  }


  if (
    key ===
    "Backspace"
  ) {

    numericBuffer =
      numericBuffer.slice(
        0,
        -1
      );


    return;

  }


  if (
    key ===
    "Escape"
  ) {

    numericBuffer =
      "";


    selectedTool =
      null;


    document
      .querySelectorAll(
        ".mark-tool"
      )
      .forEach(
        button =>
          button.classList.remove(
            "active"
          )
      );


    return;

  }


  if (
    key ===
    "Enter"
  ) {

    const answer =
      getSelectedAnswer();


    const question =
      questions[
        questionIndex
      ];


    if (
      answer &&
      numericBuffer !==
        ""
    ) {

      saveScore(
        answer.id,
        question.id,
        Number(
          numericBuffer
        )
      );


      numericBuffer =
        "";

    }

  }

}


/* =========================================================
   SELECT ANSWER
========================================================= */

function selectAnswer(
  answerId
) {

  selectedAnswerId =
    answerId;


  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      card => {

        card.classList.toggle(
          "selected",
          card.dataset.answerId ===
            answerId
        );

      }
    );

}


function getSelectedAnswer() {

  return answers.find(
    answer =>
      answer.id ===
      selectedAnswerId
  ) ||
  null;

}


/* =========================================================
   AUTO ADVANCE
========================================================= */

async function autoAdvance() {

  /*
   * 保存直後に次の未採点答案へ。
   */

  const visible =
    answers.slice(
      batchStart,
      batchStart +
        batchSize
    );


  const next =
    visible.find(
      answer => {

        const score =
          getScore(
            answer.id,
            questions[
              questionIndex
            ].id
          );


        return !(
          score?.status ===
          "marked"
        );

      }
    );


  if (next) {

    selectAnswer(
      next.id
    );

    return;

  }


  /*
   * 現在グループ完了。
   */

  const nextStart =
    batchStart +
    batchSize;


  if (
    nextStart <
    answers.length
  ) {

    batchStart =
      nextStart;


    selectedAnswerId =
      null;


    await render();

    return;

  }


  /*
   * この設問の全員終了。
   */

  if (
    questionIndex <
    questions.length - 1
  ) {

    questionIndex++;

    batchStart =
      0;

    selectedAnswerId =
      null;

    numericBuffer =
      "";

    await render();

    return;

  }


  /*
   * 全設問終了。
   */

  await finishMarking();

}


/* =========================================================
   PREVIOUS
========================================================= */

async function previousQuestion() {

  if (
    questionIndex <=
    0
  ) {

    return;

  }


  questionIndex--;

  batchStart =
    0;

  selectedAnswerId =
    null;

  numericBuffer =
    "";

  await render();

}


/* =========================================================
   NEXT
========================================================= */

async function nextQuestion() {

  if (
    questionIndex <
    questions.length - 1
  ) {

    questionIndex++;

    batchStart =
      0;

    selectedAnswerId =
      null;

    numericBuffer =
      "";

    await render();

    return;

  }


  if (
    countMarked() >=
    answers.length *
    questions.length
  ) {

    await finishMarking();

  } else {

    setStatus(
      "未採点の答案があります。",
      true
    );

  }

}


/* =========================================================
   NEXT UNMARKED
========================================================= */

async function nextUnmarked() {

  const question =
    questions[
      questionIndex
    ];


  const index =
    answers.findIndex(
      answer =>
        !(
          getScore(
            answer.id,
            question.id
          )?.status ===
          "marked"
        )
    );


  if (
    index < 0
  ) {

    setStatus(
      "この設問は全員採点済みです。"
    );

    return;

  }


  batchStart =
    Math.floor(
      index /
      batchSize
    ) *
    batchSize;


  selectedAnswerId =
    answers[
      index
    ].id;


  await render();

}


/* =========================================================
   SAVE SCORE
========================================================= */

async function saveScore(
  answerId,
  questionId,
  value
) {

  const question =
    questions.find(
      item =>
        item.id ===
        questionId
    );


  if (!question) {

    return;

  }


  if (
    !Number.isFinite(
      value
    )
  ) {

    return;

  }


  if (
    value < 0 ||
    value >
      question.points
  ) {

    setStatus(
      `配点 ${formatNumber(
        question.points
      )}点を超えています。`,
      true
    );

    return;

  }


  const key =
    scoreKey(
      answerId,
      questionId
    );


  const existing =
    scores.get(
      key
    );


  const payload = {

    answer_sheet_id:
      answerId,

    layout_box_id:
      questionId,

    question_id:
      question.questionId ||
      null,

    score:
      value,

    status:
      "marked",

    marked_at:
      new Date().toISOString()

  };


  let saved;


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
        .update(
          payload
        )
        .eq(
          "id",
          existing.id
        )
        .select()
        .single();


    if (error) {

      throw error;

    }


    saved =
      data;

  } else {

    const {
      data,
      error
    } =
      await DB
        .from(
          "scores"
        )
        .insert(
          payload
        )
        .select()
        .single();


    if (error) {

      throw error;

    }


    saved =
      data;

  }


  scores.set(
    key,
    saved
  );


  await saveMarks(
    answerId,
    questionId,
    question.questionId
  );


  updateProgress();

}


/* =========================================================
   MARKS
========================================================= */

async function addAutoMark(
  answerId,
  questionId,
  type
) {

  const key =
    scoreKey(
      answerId,
      questionId
    );


  const existing =
    marks.get(
      key
    ) || [];


  const filtered =
    existing.filter(
      mark =>
        mark.object_type !==
          "circle" &&
        mark.object_type !==
          "x"
    );


  filtered.push({

    id:
      crypto.randomUUID(),

    answer_sheet_id:
      answerId,

    layout_box_id:
      questionId,

    question_id:
      questions[
        questionIndex
      ].questionId ||
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
      12,

    y:
      12,

    width:
      48,

    height:
      48,

    points:
      null

  });


  marks.set(
    key,
    filtered
  );


  await saveMarks(
    answerId,
    questionId,
    questions[
      questionIndex
    ].questionId
  );


  await render();

}


/* =========================================================
   PLACE MARK
========================================================= */

async function placeMark(
  event,
  stage,
  answerId,
  questionId
) {

  if (
    selectedTool ===
    "eraser"
  ) {

    const object =
      event.target.closest(
        ".mark-object"
      );


    if (object) {

      await deleteMark(
        answerId,
        questionId,
        object.dataset.markId
      );

    }

    return;

  }


  const rect =
    stage.getBoundingClientRect();


  const x =
    event.clientX -
    rect.left;


  const y =
    event.clientY -
    rect.top;


  const key =
    scoreKey(
      answerId,
      questionId
    );


  const list =
    marks.get(
      key
    ) || [];


  list.push({

    id:
      crypto.randomUUID(),

    answer_sheet_id:
      answerId,

    layout_box_id:
      questionId,

    question_id:
      questions[
        questionIndex
      ].questionId ||
      null,

    object_type:
      selectedTool,

    text_value:
      selectedTool ===
        "text"
        ? (
            $("markText")
              ?.value ||
            "文字"
          )
        : null,

    color:
      $("markColor")
        ?.value ||
      "#d00000",

    font_size:
      Number(
        $("markSize")
          ?.value
      ) ||
      42,

    stroke_width:
      4,

    x,
    y,

    width:
      selectedTool ===
        "pen"
        ? 80
        : 50,

    height:
      selectedTool ===
        "pen"
        ? 80
        : 50,

    points:
      null

  });


  marks.set(
    key,
    list
  );


  await saveMarks(
    answerId,
    questionId,
    questions[
      questionIndex
    ].questionId
  );


  await render();

}


/* =========================================================
   SAVE MARKS
========================================================= */

async function saveMarks(
  answerId,
  questionId,
  realQuestionId
) {

  /*
   * 既存記号削除
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
        answerId
      )
      .eq(
        "layout_box_id",
        questionId
      );


  if (deleteError) {

    /*
     * 点数保存には影響させない。
     */

    console.warn(
      "mark_objects delete:",
      deleteError
    );

    return;

  }


  const list =
    marks.get(
      scoreKey(
        answerId,
        questionId
      )
    ) || [];


  if (!list.length) {

    return;

  }


  const rows =
    list.map(
      mark => ({

        id:
          mark.id,

        answer_sheet_id:
          answerId,

        layout_box_id:
          questionId,

        question_id:
          realQuestionId ||
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
    error
  } =
    await DB
      .from(
        "mark_objects"
      )
      .insert(
        rows
      );


  if (error) {

    console.warn(
      "mark_objects insert:",
      error
    );

  }

}


/* =========================================================
   DELETE MARK
========================================================= */

async function deleteMark(
  answerId,
  questionId,
  markId
) {

  const key =
    scoreKey(
      answerId,
      questionId
    );


  const list =
    marks.get(
      key
    ) || [];


  marks.set(
    key,
    list.filter(
      mark =>
        mark.id !==
        markId
    )
  );


  await saveMarks(
    answerId,
    questionId,
    questions[
      questionIndex
    ].questionId
  );


  await render();

}


/* =========================================================
   RENDER MARKS
========================================================= */

function renderMarks(
  layer,
  answerId,
  questionId
) {

  const list =
    marks.get(
      scoreKey(
        answerId,
        questionId
      )
    ) || [];


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


  list.forEach(
    mark => {

      const element =
        document.createElement(
          "div"
        );


      element.className =
        "mark-object";


      element.dataset.markId =
        mark.id;


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


      element.textContent =
        symbols[
          mark.object_type
        ] ||
        mark.text_value ||
        (
          mark.object_type ===
          "pen"
            ? "／"
            : ""
        );


      element.addEventListener(
        "dblclick",
        async event => {

          event.stopPropagation();


          await deleteMark(
            answerId,
            questionId,
            mark.id
          );

        }
      );


      layer.appendChild(
        element
      );

    }
  );

}


/* =========================================================
   SCORE
========================================================= */

function getScore(
  answerId,
  questionId
) {

  return scores.get(
    scoreKey(
      answerId,
      questionId
    )
  ) ||
  null;

}


/* =========================================================
   PROGRESS
========================================================= */

function countMarked() {

  let count =
    0;


  answers.forEach(
    answer => {

      questions.forEach(
        question => {

          const score =
            getScore(
              answer.id,
              question.id
            );


          if (
            score?.status ===
            "marked"
          ) {

            count++;

          }

        }
      );

    }
  );


  return count;

}


function updateProgress() {

  const total =
    answers.length *
    questions.length;


  const done =
    countMarked();


  const percent =
    total
      ? Math.round(
          done /
          total *
          100
        )
      : 0;


  $("progressBar").style.width =
    `${percent}%`;


  $("progressText").textContent =
    `${done} / ${total}`;


  $("progressTextBar").textContent =
    `${done} / ${total} (${percent}%)`;


}


/* =========================================================
   FINISH
========================================================= */

async function finishMarking() {

  if (
    processing
  ) {

    return;

  }


  processing =
    true;


  $("complete")
    ?.classList.add(
      "show"
    );


  setStatus(
    "全設問の採点が完了しました。成績処理を開始しています..."
  );


  try {

    /*
     * 採点結果を集計。
     *
     * 3000人規模を想定し、
     * 画面側で全件を一度に描画しない。
     * 結果は結果画面側で再取得する。
     */

    sessionStorage.setItem(
      `marking_complete_${testId}`,
      JSON.stringify({

        testId,

        completedAt:
          new Date().toISOString(),

        totalAnswers:
          answers.length,

        totalQuestions:
          questions.length

      })
    );


    /*
     * 結果画面へ。
     */

    location.replace(
      `/teacher/results/summary?test=${encodeURIComponent(
        testId
      )}&process=1`
    );


  } catch (error) {

    processing =
      false;


    $("complete")
      ?.classList.remove(
        "show"
      );


    setStatus(
      error.message ||
      "成績処理を開始できませんでした。",
      true
    );

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function updateNavigation() {

  $("previousButton").disabled =
    questionIndex <=
    0;


  $("nextButton").textContent =
    questionIndex >=
      questions.length - 1
      ? "採点完了"
      : "次の問題";

}


/* =========================================================
   UTIL
========================================================= */

function scoreKey(
  answerId,
  questionId
) {

  return `${answerId}:${questionId}`;

}


function regionKey(
  answerId,
  questionId
) {

  return `${answerId}:${questionId}`;

}


function waitImage(
  image
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        image.complete &&
        image.naturalWidth
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


function createNumberButtons() {

  const toolbar =
    $("numberToolbar");


  if (!toolbar) {

    return;

  }


  toolbar.innerHTML =
    "";


  for (
    let i = 0;
    i <= 100;
    i++
  ) {

    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.className =
      "number-button";


    button.dataset.score =
      String(
        i
      );


    button.textContent =
      String(
        i
      );


    toolbar.appendChild(
      button
    );

  }

}


function setStatus(
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


function showError(
  message
) {

  setStatus(
    message,
    true
  );


  const grid =
    $("answerTableWrap");


  if (grid) {

    grid.innerHTML = `

      <div class="no-answer">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }

}


function formatNumber(
  value
) {

  const n =
    Number(
      value
    );


  if (
    !Number.isFinite(
      n
    )
  ) {

    return "0";

  }


  return Number.isInteger(
    n
  )
    ? String(
        n
      )
    : n.toFixed(
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
