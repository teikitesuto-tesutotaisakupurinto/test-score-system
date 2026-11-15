
/* =========================================================
   テスト成績システム
   デジタル採点 完全版

   URL
   /teacher/marking/mark?test=TEST_ID&box=LAYOUT_BOX_ID

   採点単位
   answer_sheets
        ↓
   answer_regions
        ↓
   layout_box_id
        ↓
   scores

   採点記号
   mark_objects

   キー
   L       → ○ → 満点
   K       → × → 0点
   数字    → 点数入力
   Enter   → 点数確定

   点数ルール
   通常の数字入力:
      0 ～ 配点未満 → 保存可能
      配点以上      → 警告・保存しない

   ○:
      配点と同じ点数を保存

   表示
   左  → 現在の解答欄に対応する模範解答
   右  → 現在の解答欄に対応する生徒答案2列
========================================================= */


/* =========================================================
   URL
========================================================= */

const markingParams =
  new URLSearchParams(
    window.location.search
  );


const testId =
  markingParams.get("test");


const boxId =
  markingParams.get("box");


/* =========================================================
   状態
========================================================= */

let currentTest = null;

let currentBox = null;

let markingBoxes = [];

let currentBoxIndex = -1;

let answers = [];

let selectedCard = null;

let activeTool = "select";

let zoom = 1;

let scoreInputValue = "";


/* =========================================================
   初期化
========================================================= */

async function initializeMarking() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.replace(
      "/login"
    );

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    window.location.replace(
      "/student/dashboard"
    );

    return;

  }


  if (
    !testId ||
    !boxId
  ) {

    alert(
      "採点対象が指定されていません。"
    );


    window.location.replace(
      "/teacher/marking"
    );


    return;

  }


  try {

    await loadTest();

    await loadMarkingBoxes();

    await loadBox();

    await loadAnswers();

    await loadModelAnswer();

    setupToolbar();

    setupKeyboard();

    updateProgress();

    updateQuestionNavigation();

  } catch (error) {

    console.error(
      "採点画面初期化エラー:",
      error
    );


    alert(
      error.message ||
      "採点画面を読み込めませんでした。"
    );

  }

}


/* =========================================================
   テスト取得
========================================================= */

async function loadTest() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select(`
        id,
        name,
        subject,
        grade,
        class_name,
        max_score,
        status
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


  currentTest =
    data;

}


/* =========================================================
   採点対象の解答欄一覧
========================================================= */

async function loadMarkingBoxes() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        id,
        test_id,
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height,
        points
      `)
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
          ascending: true
        }
      )
      .order(
        "y",
        {
          ascending: true
        }
      )
      .order(
        "x",
        {
          ascending: true
        }
      );


  if (error) {

    throw error;

  }


  markingBoxes =
    data || [];


  currentBoxIndex =
    markingBoxes.findIndex(
      box =>
        box.id ===
        boxId
    );


  if (
    currentBoxIndex < 0
  ) {

    throw new Error(
      "現在の解答欄が見つかりません。"
    );

  }

}


/* =========================================================
   現在の解答欄
========================================================= */

async function loadBox() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        id,
        test_id,
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height,
        points
      `)
      .eq(
        "id",
        boxId
      )
      .eq(
        "test_id",
        testId
      )
      .eq(
        "box_type",
        "answer"
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "指定された解答欄が見つかりません。"
    );

  }


  currentBox =
    data;


  const questionInfo =
    document.getElementById(
      "questionInfo"
    );


  if (questionInfo) {

    questionInfo.textContent =
      data.label ||
      `解答欄 ${currentBoxIndex + 1}`;

  }


  const pointInfo =
    document.getElementById(
      "pointInfo"
    );


  if (pointInfo) {

    pointInfo.textContent =

      data.points === null ||
      data.points === undefined

        ? "配点未設定"

        : `設定点数：${data.points}点`;

  }

}


/* =========================================================
   答案取得
========================================================= */

async function loadAnswers() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("answer_sheets")
      .select(`
        id,
        student_id,
        status,
        created_at,
        students(
          student_no,
          name
        )
      `)
      .eq(
        "test_id",
        testId
      )
      .neq(
        "status",
        "unmatched"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {

    throw error;

  }


  answers =
    data || [];


  if (!answers.length) {

    renderAnswers();

    return;

  }


  const answerIds =
    answers.map(
      answer =>
        answer.id
    );


  /*
    現在の解答欄に対応する
    answer_regionsのみ取得
  */

  const {
    data: regions,
    error: regionError
  } =
    await supabaseClient
      .from("answer_regions")
      .select(`
        id,
        answer_sheet_id,
        layout_box_id,
        image_path,
        page_no,
        width,
        height
      `)
      .in(
        "answer_sheet_id",
        answerIds
      )
      .eq(
        "layout_box_id",
        boxId
      );


  if (regionError) {

    throw regionError;

  }


  const regionMap =
    new Map();


  (
    regions || []
  ).forEach(
    region => {

      regionMap.set(
        region.answer_sheet_id,
        region
      );

    }
  );


  answers =
    answers.map(
      answer => ({

        ...answer,

        region:
          regionMap.get(
            answer.id
          ) || null

      })
    );


  renderAnswers();

}


/* =========================================================
   答案表示
========================================================= */

function renderAnswers() {

  const grid =
    document.getElementById(
      "answerGrid"
    );


  if (!grid) {

    return;

  }


  if (!answers.length) {

    grid.innerHTML = `

      <div class="no-answer">
        採点対象の答案がありません。
      </div>

    `;


    return;

  }


  grid.innerHTML =
    answers
      .map(
        answer =>
          createAnswerCard(
            answer
          )
      )
      .join("");


  setupAnswerEvents();


  /*
    画像・既存採点・既存記号
  */

  answers.forEach(
    async answer => {

      await loadRegionImage(
        answer
      );

      await loadScore(
        answer
      );

      await loadMarks(
        answer
      );

    }
  );

}


/* =========================================================
   答案カード
========================================================= */

function createAnswerCard(
  answer
) {

  const studentNo =
    answer.students?.student_no ||
    "";


  const studentName =
    answer.students?.name ||
    "未紐付け";


  return `

    <article
      class="answer-card"
      data-answer-id="${escapeHtml(
        answer.id
      )}"
    >

      <div class="answer-header">

        <span>

          ${escapeHtml(
            studentNo
          )}

          -

          ${escapeHtml(
            studentName
          )}

        </span>


        <span class="answer-status">
          未採点
        </span>

      </div>


      <div class="answer-stage">

        ${
          answer.region

            ? `

              <img
                class="answer-image"
                alt="生徒答案"
              >

              <canvas
                class="answer-canvas"
              ></canvas>

            `

            :

            `

              <div
                style="
                  padding:30px;
                  color:#999;
                  text-align:center;
                "
              >
                答案領域未作成
              </div>

            `
        }

      </div>


      <div class="answer-score-bar">

        ${[
          0,
          1,
          2,
          3,
          4,
          5
        ]
          .map(
            score => `

              <button
                class="answer-score"
                data-score="${score}"
                type="button"
              >
                ${score}
              </button>

            `
          )
          .join("")}

      </div>

    </article>

  `;

}


/* =========================================================
   答案領域画像
========================================================= */

async function loadRegionImage(
  answer
) {

  if (
    !answer.region
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        "student-answers"
      )
      .createSignedUrl(
        answer.region.image_path,
        3600
      );


  if (error) {

    console.error(
      "答案領域画像取得:",
      error
    );


    return;

  }


  if (
    !data?.signedUrl
  ) {

    return;

  }


  const card =
    document.querySelector(
      `[data-answer-id="${answer.id}"]`
    );


  if (!card) {

    return;

  }


  const image =
    card.querySelector(
      ".answer-image"
    );


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!image) {

    return;

  }


  image.src =
    data.signedUrl;


  image.onload =
    () => {

      resizeMarkCanvas(
        card
      );

    };

}


/* =========================================================
   Canvasサイズ
========================================================= */

function resizeMarkCanvas(
  card
) {

  const image =
    card.querySelector(
      ".answer-image"
    );


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (
    !image ||
    !canvas
  ) {

    return;

  }


  canvas.width =
    Math.max(
      1,
      image.clientWidth
    );


  canvas.height =
    Math.max(
      1,
      image.clientHeight
    );

}


/* =========================================================
   既存採点
========================================================= */

async function loadScore(
  answer
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "scores"
      )
      .select(`
        score,
        status
      `)
      .eq(
        "answer_sheet_id",
        answer.id
      )
      .eq(
        "layout_box_id",
        boxId
      )
      .maybeSingle();


  if (error) {

    console.error(
      "既存採点取得:",
      error
    );


    return;

  }


  if (
    !data ||
    data.status !==
    "marked"
  ) {

    return;

  }


  const card =
    document.querySelector(
      `[data-answer-id="${answer.id}"]`
    );


  if (!card) {

    return;

  }


  markDone(
    card,
    data.score
  );

}


/* =========================================================
   既存記号
========================================================= */

async function loadMarks(
  answer
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .select(`
        object_type,
        text_value,
        color,
        font_size,
        stroke_width,
        x,
        y,
        width,
        height,
        points
      `)
      .eq(
        "answer_sheet_id",
        answer.id
      )
      .eq(
        "layout_box_id",
        boxId
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "既存記号取得:",
      error
    );


    return;

  }


  const card =
    document.querySelector(
      `[data-answer-id="${answer.id}"]`
    );


  if (!card) {

    return;

  }


  /*
    Canvasサイズが決まってから描画
  */

  const drawMarks =
    () => {

      (
        data || []
      ).forEach(
        mark =>
          drawStoredMark(
            card,
            mark
          )
      );

    };


  const image =
    card.querySelector(
      ".answer-image"
    );


  if (
    image &&
    !image.complete
  ) {

    image.addEventListener(
      "load",
      drawMarks,
      {
        once: true
      }
    );

  } else {

    resizeMarkCanvas(
      card
    );


    drawMarks();

  }

}


/* =========================================================
   答案イベント
========================================================= */

function setupAnswerEvents() {

  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      card => {

        /*
          カードクリック
        */

        card.addEventListener(
          "click",
          event => {

            if (
              event.target.closest(
                ".answer-score"
              )
            ) {

              return;

            }


            selectCard(
              card
            );


            handleTool(
              card
            );

          }
        );


        /*
          クイック点数
        */

        card
          .querySelectorAll(
            ".answer-score"
          )
          .forEach(
            button => {

              button.addEventListener(
                "click",
                async event => {

                  event.stopPropagation();


                  selectCard(
                    card
                  );


                  await setScore(
                    card,
                    Number(
                      button.dataset.score
                    )
                  );

                }
              );

            }
          );

      }
    );

}


/* =========================================================
   点数保存
========================================================= */

async function setScore(
  card,
  score,
  options = {}
) {

  score =
    Number(
      score
    );


  /*
    数値チェック
  */

  if (
    !Number.isFinite(
      score
    )
  ) {

    alert(
      "正しい点数を入力してください。"
    );


    return false;

  }


  /*
    0未満
  */

  if (
    score < 0
  ) {

    alert(
      "0点未満は設定できません。"
    );


    return false;

  }


  /*
    配点
  */

  const max =
    Number(
      currentBox?.points
    );


  /*
    通常入力
    → 配点以上は禁止
  */

  if (
    Number.isFinite(max) &&
    !options.fullMark &&
    score >= max
  ) {

    alert(
      `設定点数は ${max}点です。\n\n${max}点以上は設定できません。`
    );


    return false;

  }


  /*
    ○による満点
  */

  if (
    Number.isFinite(max) &&
    options.fullMark
  ) {

    if (
      score !== max
    ) {

      alert(
        `満点は ${max}点です。`
      );


      return false;

    }

  }


  /*
    ログイン
  */

  const session =
    await getSession();


  if (!session) {

    window.location.replace(
      "/login"
    );


    return false;

  }


  const answerId =
    card.dataset.answerId;


  /*
    保存
  */

  const {
    error
  } =
    await supabaseClient
      .from(
        "scores"
      )
      .upsert(
        {

          answer_sheet_id:
            answerId,

          question_id:
            null,

          layout_box_id:
            boxId,

          score,

          status:
            "marked",

          marked_by:
            session.user.id,

          marked_at:
            new Date()
              .toISOString()

        },
        {

          onConflict:
            "answer_sheet_id,layout_box_id"

        }
      );


  if (error) {

    console.error(
      "採点保存エラー:",
      error
    );


    alert(
      error.message ||
      "採点結果を保存できませんでした。"
    );


    return false;

  }


  /*
    表示
  */

  markDone(
    card,
    score
  );


  /*
    答案状態
  */

  await updateAnswerStatus(
    answerId
  );


  /*
    進捗
  */

  updateProgress();


  /*
    入力欄
  */

  clearScoreInput();


  /*
    保存成功後のみ次へ
  */

  focusNext(
    card
  );


  return true;

}


/* =========================================================
   答案状態
========================================================= */

async function updateAnswerStatus(
  answerId
) {

  const {
    error
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .update({

        status:
          "marking"

      })
      .eq(
        "id",
        answerId
      );


  if (error) {

    console.error(
      "答案状態更新:",
      error
    );

  }

}


/* =========================================================
   採点済み表示
========================================================= */

function markDone(
  card,
  score
) {

  card.classList.add(
    "done"
  );


  const status =
    card.querySelector(
      ".answer-status"
    );


  if (status) {

    status.textContent =
      `${score}点`;

  }

}


/* =========================================================
   カード選択
========================================================= */

function selectCard(
  card
) {

  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      item =>
        item.classList.remove(
          "selected"
        )
    );


  card.classList.add(
    "selected"
  );


  selectedCard =
    card;

}


/* =========================================================
   次の未採点
========================================================= */

function focusNext(
  current
) {

  const cards =
    [
      ...
      document.querySelectorAll(
        ".answer-card"
      )
    ];


  const index =
    cards.indexOf(
      current
    );


  /*
    後ろ
  */

  for (
    let i = index + 1;
    i < cards.length;
    i++
  ) {

    if (
      !cards[i].classList.contains(
        "done"
      )
    ) {

      selectCard(
        cards[i]
      );


      cards[i].scrollIntoView({

        behavior:
          "smooth",

        block:
          "center"

      });


      return;

    }

  }


  /*
    先頭から
  */

  for (
    let i = 0;
    i < index;
    i++
  ) {

    if (
      !cards[i].classList.contains(
        "done"
      )
    ) {

      selectCard(
        cards[i]
      );


      cards[i].scrollIntoView({

        behavior:
          "smooth",

        block:
          "center"

      });


      return;

    }

  }


  /*
    全員終了
  */

  alert(
    "この解答欄の採点が完了しました。"
  );

}


/* =========================================================
   最初の未採点
========================================================= */

function selectFirst() {

  const card =
    document.querySelector(
      ".answer-card:not(.done)"
    );


  if (card) {

    selectCard(
      card
    );

  }

}


/* =========================================================
   ツールバー
========================================================= */

function setupToolbar() {

  /*
    ツール
  */

  document
    .querySelectorAll(
      "[data-tool]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                "[data-tool]"
              )
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            activeTool =
              button.dataset.tool;


            if (
              activeTool ===
              "number"
            ) {

              const input =
                document.getElementById(
                  "scoreInput"
                );


              if (input) {

                input.focus();

              }

            }

          }
        );

      }
    );


  /*
    クイック点数
  */

  document
    .querySelectorAll(
      ".footer-score"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          async () => {

            if (!selectedCard) {

              selectFirst();

              return;

            }


            await setScore(
              selectedCard,
              Number(
                button.dataset.score
              )
            );

          }
        );

      }
    );


  /*
    点数確定
  */

  const scoreApply =
    document.getElementById(
      "scoreApply"
    );


  if (scoreApply) {

    scoreApply.addEventListener(
      "click",
      async () => {

        await applyScoreInput();

      }
    );

  }


  /*
    次の未採点
  */

  document
    .getElementById(
      "nextUnmarked"
    )
    .addEventListener(
      "click",
      () => {

        if (!selectedCard) {

          selectFirst();

          return;

        }


        focusNext(
          selectedCard
        );

      }
    );


  /*
    前の解答欄
  */

  document
    .getElementById(
      "previousQuestion"
    )
    .addEventListener(
      "click",
      () => {

        openPreviousBox();

      }
    );


  /*
    次の解答欄
  */

  document
    .getElementById(
      "nextQuestion"
    )
    .addEventListener(
      "click",
      () => {

        openNextBox();

      }
    );


  /*
    採点終了
  */

  document
    .getElementById(
      "exitMarking"
    )
    .addEventListener(
      "click",
      () => {

        window.location.href =
          `/teacher/marking/select?test=${encodeURIComponent(
            testId
          )}`;

      }
    );


  /*
    ズーム
  */

  document
    .getElementById(
      "zoomIn"
    )
    .addEventListener(
      "click",
      () => {

        zoom =
          Math.min(
            2,
            zoom + 0.1
          );


        applyZoom();

      }
    );


  document
    .getElementById(
      "zoomOut"
    )
    .addEventListener(
      "click",
      () => {

        zoom =
          Math.max(
            0.5,
            zoom - 0.1
          );


        applyZoom();

      }
    );


  document
    .getElementById(
      "fitScreen"
    )
    .addEventListener(
      "click",
      () => {

        zoom =
          1;


        applyZoom();

      }
    );

}


/* =========================================================
   前の解答欄
========================================================= */

function openPreviousBox() {

  if (
    currentBoxIndex <= 0
  ) {

    return;

  }


  const box =
    markingBoxes[
      currentBoxIndex - 1
    ];


  if (!box) {

    return;

  }


  openBox(
    box
  );

}


/* =========================================================
   次の解答欄
========================================================= */

function openNextBox() {

  if (
    currentBoxIndex < 0
  ) {

    return;

  }


  if (
    currentBoxIndex >=
    markingBoxes.length - 1
  ) {

    return;

  }


  const box =
    markingBoxes[
      currentBoxIndex + 1
    ];


  if (!box) {

    return;

  }


  openBox(
    box
  );

}


/* =========================================================
   解答欄へ移動
========================================================= */

function openBox(
  box
) {

  window.location.href =
    `/teacher/marking/mark?test=${encodeURIComponent(
      testId
    )}&box=${encodeURIComponent(
      box.id
    )}`;

}


/* =========================================================
   ナビゲーション状態
========================================================= */

function updateQuestionNavigation() {

  const previous =
    document.getElementById(
      "previousQuestion"
    );


  const next =
    document.getElementById(
      "nextQuestion"
    );


  if (
    !previous ||
    !next
  ) {

    return;

  }


  previous.disabled =
    currentBoxIndex <= 0;


  next.disabled =
    currentBoxIndex < 0 ||
    currentBoxIndex >=
      markingBoxes.length - 1;

}


/* =========================================================
   点数入力
========================================================= */

async function applyScoreInput() {

  if (!selectedCard) {

    selectFirst();

  }


  if (!selectedCard) {

    alert(
      "答案を選択してください。"
    );


    return;

  }


  const input =
    document.getElementById(
      "scoreInput"
    );


  if (!input) {

    return;

  }


  const value =
    input.value.trim();


  if (!value) {

    alert(
      "点数を入力してください。"
    );


    return;

  }


  const score =
    Number(
      value
    );


  if (
    !Number.isFinite(
      score
    )
  ) {

    alert(
      "正しい点数を入力してください。"
    );


    return;

  }


  /*
    通常の部分点
  */

  const saved =
    await setScore(
      selectedCard,
      score,
      {
        fullMark:
          false
      }
    );


  if (saved) {

    clearScoreInput();

  }

}


/* =========================================================
   点数入力クリア
========================================================= */

function clearScoreInput() {

  const input =
    document.getElementById(
      "scoreInput"
    );


  if (input) {

    input.value =
      "";

  }


  scoreInputValue =
    "";

}


/* =========================================================
   キーボード
========================================================= */

function setupKeyboard() {

  document.addEventListener(
    "keydown",
    async event => {

      const tag =
        event.target.tagName;


      /*
        Select / textarea
      */

      if (
        tag === "SELECT" ||
        tag === "TEXTAREA"
      ) {

        return;

      }


      /*
        通常のINPUT

        scoreInputだけ
        ショートカット対象
      */

      if (
        tag === "INPUT" &&
        event.target.id !==
          "scoreInput"
      ) {

        return;

      }


      /*
        ================================================
        L → ○ → 満点
        ================================================
      */

      if (
        event.key.toLowerCase() ===
        "l"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirst();

        }


        if (!selectedCard) {

          return;

        }


        const max =
          Number(
            currentBox?.points
          );


        if (
          !Number.isFinite(max)
        ) {

          alert(
            "この解答欄には配点が設定されていません。"
          );


          return;

        }


        /*
          ○
        */

        drawSymbol(
          selectedCard,
          "○"
        );


        await saveMark(
          selectedCard,
          "circle"
        );


        /*
          ○ = 満点
        */

        await setScore(
          selectedCard,
          max,
          {
            fullMark:
              true
          }
        );


        return;

      }


      /*
        ================================================
        K → × → 0点
        ================================================
      */

      if (
        event.key.toLowerCase() ===
        "k"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirst();

        }


        if (!selectedCard) {

          return;

        }


        drawSymbol(
          selectedCard,
          "×"
        );


        await saveMark(
          selectedCard,
          "x"
        );


        await setScore(
          selectedCard,
          0
        );


        return;

      }


      /*
        ================================================
        数字キー
        ================================================
      */

      if (
        /^[0-9]$/.test(
          event.key
        )
      ) {

        event.preventDefault();


        const input =
          document.getElementById(
            "scoreInput"
          );


        if (!input) {

          return;

        }


        /*
          先頭0を整理
        */

        if (
          input.value ===
          "0"
        ) {

          input.value =
            event.key;

        } else {

          input.value +=
            event.key;

        }


        scoreInputValue =
          input.value;


        return;

      }


      /*
        ================================================
        Backspace
        ================================================
      */

      if (
        event.key ===
        "Backspace"
      ) {

        if (
          event.target.id !==
          "scoreInput"
        ) {

          event.preventDefault();


          const input =
            document.getElementById(
              "scoreInput"
            );


          if (input) {

            input.value =
              input.value.slice(
                0,
                -1
              );


            scoreInputValue =
              input.value;

          }

        }


        return;

      }


      /*
        ================================================
        Enter
        ================================================
      */

      if (
        event.key ===
        "Enter"
      ) {

        if (
          scoreInputValue ||
          document.activeElement?.id ===
            "scoreInput"
        ) {

          event.preventDefault();


          await applyScoreInput();


          return;

        }

      }


      /*
        ================================================
        Escape
        ================================================
      */

      if (
        event.key ===
        "Escape"
      ) {

        clearScoreInput();

        return;

      }

    }
  );


  /*
    scoreInput直接入力
  */

  const scoreInput =
    document.getElementById(
      "scoreInput"
    );


  if (scoreInput) {

    scoreInput.addEventListener(
      "input",
      () => {

        scoreInputValue =
          scoreInput.value;

      }
    );


    scoreInput.addEventListener(
      "keydown",
      async event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();


          await applyScoreInput();

        }

      }
    );

  }

}


/* =========================================================
   ツール処理
========================================================= */

function handleTool(
  card
) {

  /*
    選択
  */

  if (
    activeTool ===
    "select"
  ) {

    return;

  }


  /*
    ○
  */

  if (
    activeTool ===
    "circle"
  ) {

    drawSymbol(
      card,
      "○"
    );


    saveMark(
      card,
      "circle"
    );


    const max =
      Number(
        currentBox?.points
      );


    if (
      Number.isFinite(max)
    ) {

      setScore(
        card,
        max,
        {
          fullMark:
            true
        }
      );

    }


    return;

  }


  /*
    ×
  */

  if (
    activeTool ===
    "x"
  ) {

    drawSymbol(
      card,
      "×"
    );


    saveMark(
      card,
      "x"
    );


    setScore(
      card,
      0
    );


    return;

  }


  /*
    △
  */

  if (
    activeTool ===
    "triangle"
  ) {

    drawSymbol(
      card,
      "△"
    );


    saveMark(
      card,
      "triangle"
    );


    const input =
      document.getElementById(
        "scoreInput"
      );


    if (input) {

      input.value =
        "";

      scoreInputValue =
        "";

      input.focus();

    }


    return;

  }


  /*
    ◎
  */

  if (
    activeTool ===
    "double"
  ) {

    drawSymbol(
      card,
      "◎"
    );


    saveMark(
      card,
      "double_circle"
    );


    return;

  }


  /*
    数字
  */

  if (
    activeTool ===
    "number"
  ) {

    const input =
      document.getElementById(
        "scoreInput"
      );


    if (input) {

      input.focus();

      input.select();

    }


    return;

  }


  /*
    テキスト
  */

  if (
    activeTool ===
    "text"
  ) {

    drawText(
      card
    );


    return;

  }


  /*
    描画
  */

  if (
    activeTool ===
    "pen"
  ) {

    enablePen(
      card
    );

  }

}


/* =========================================================
   記号描画
========================================================= */

function drawSymbol(
  card,
  symbol
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  context.strokeStyle =
    color;


  context.fillStyle =
    color;


  context.lineWidth =
    3;


  const x =
    canvas.width / 2;


  const y =
    canvas.height / 2;


  /*
    ○
  */

  if (
    symbol ===
    "○"
  ) {

    context.beginPath();


    context.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );


    context.stroke();


    return;

  }


  /*
    ×
  */

  if (
    symbol ===
    "×"
  ) {

    context.beginPath();


    context.moveTo(
      x - size / 2,
      y - size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.moveTo(
      x + size / 2,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.stroke();


    return;

  }


  /*
    △
  */

  if (
    symbol ===
    "△"
  ) {

    context.beginPath();


    context.moveTo(
      x,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.closePath();


    context.stroke();


    return;

  }


  /*
    ◎
  */

  if (
    symbol ===
    "◎"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      "◎",
      x - size / 2,
      y + size / 2
    );

  }

}


/* =========================================================
   記号保存
========================================================= */

async function saveMark(
  card,
  objectType
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  const x =
    canvas
      ? canvas.width / 2
      : 0;


  const y =
    canvas
      ? canvas.height / 2
      : 0;


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          objectType,

        text_value:
          null,

        color,

        font_size:
          size,

        stroke_width:
          3,

        x,

        y,

        width:
          null,

        height:
          null,

        points:
          null,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "記号保存:",
      error
    );

  }

}


/* =========================================================
   テキスト
========================================================= */

function drawText(
  card
) {

  const input =
    document.getElementById(
      "markText"
    );


  const text =
    input.value.trim();


  if (!text) {

    alert(
      "テキストを入力してください。"
    );


    return;

  }


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  const x =
    10;


  const y =
    Math.max(
      size,
      20
    );


  context.fillStyle =
    color;


  context.font =
    `${size}px Arial`;


  context.fillText(
    text,
    x,
    y
  );


  saveTextMark(
    card,
    text,
    color,
    size,
    x,
    y
  );

}


/* =========================================================
   テキスト保存
========================================================= */

async function saveTextMark(
  card,
  text,
  color,
  size,
  x,
  y
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          "text",

        text_value:
          text,

        color,

        font_size:
          size,

        stroke_width:
          3,

        x,

        y,

        width:
          null,

        height:
          null,

        points:
          null,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "テキスト保存:",
      error
    );

  }

}


/* =========================================================
   描画
========================================================= */

function enablePen(
  card
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  canvas.style.pointerEvents =
    "auto";


  const context =
    canvas.getContext(
      "2d"
    );


  let drawing =
    false;


  let points = [];


  canvas.onpointerdown =
    event => {

      drawing =
        true;


      points = [

        {

          x:
            event.offsetX,

          y:
            event.offsetY

        }

      ];


      context.beginPath();


      context.moveTo(
        event.offsetX,
        event.offsetY
      );

    };


  canvas.onpointermove =
    event => {

      if (!drawing) {

        return;

      }


      const point = {

        x:
          event.offsetX,

        y:
          event.offsetY

      };


      points.push(
        point
      );


      context.strokeStyle =
        document.getElementById(
          "markColor"
        ).value;


      context.lineWidth =
        3;


      context.lineTo(
        point.x,
        point.y
      );


      context.stroke();

    };


  canvas.onpointerup =
    async () => {

      await finishPen();

    };


  canvas.onpointerleave =
    async () => {

      if (drawing) {

        await finishPen();

      }

    };


  async function finishPen() {

    if (!drawing) {

      return;

    }


    drawing =
      false;


    canvas.style.pointerEvents =
      "none";


    if (!points.length) {

      return;

    }


    await savePenMark(
      card,
      points
    );

  }

}


/* =========================================================
   描画保存
========================================================= */

async function savePenMark(
  card,
  points
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  if (
    !Array.isArray(points) ||
    !points.length
  ) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          "pen",

        text_value:
          null,

        color:
          document.getElementById(
            "markColor"
          ).value,

        font_size:
          null,

        stroke_width:
          3,

        x:
          0,

        y:
          0,

        width:
          null,

        height:
          null,

        points,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "描画保存:",
      error
    );

  }

}


/* =========================================================
   保存済み記号
========================================================= */

function drawStoredMark(
  card,
  mark
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    mark.color ||
    "#e53935";


  const size =
    Number(
      mark.font_size
    ) || 42;


  context.strokeStyle =
    color;


  context.fillStyle =
    color;


  context.lineWidth =
    Number(
      mark.stroke_width
    ) || 3;


  const x =
    Number(
      mark.x
    ) ||
    canvas.width / 2;


  const y =
    Number(
      mark.y
    ) ||
    canvas.height / 2;


  /*
    ○
  */

  if (
    mark.object_type ===
    "circle"
  ) {

    context.beginPath();


    context.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );


    context.stroke();


    return;

  }


  /*
    ×
  */

  if (
    mark.object_type ===
    "x"
  ) {

    context.beginPath();


    context.moveTo(
      x - size / 2,
      y - size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.moveTo(
      x + size / 2,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.stroke();


    return;

  }


  /*
    △
  */

  if (
    mark.object_type ===
    "triangle"
  ) {

    context.beginPath();


    context.moveTo(
      x,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.closePath();


    context.stroke();


    return;

  }


  /*
    ◎
  */

  if (
    mark.object_type ===
    "double_circle"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      "◎",
      x,
      y
    );


    return;

  }


  /*
    テキスト
  */

  if (
    mark.object_type ===
    "text"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      mark.text_value ||
      "",
      x,
      y
    );


    return;

  }


  /*
    ペン
  */

  if (
    mark.object_type ===
    "pen"
  ) {

    const points =
      Array.isArray(
        mark.points
      )
        ? mark.points
        : [];


    if (!points.length) {

      return;

    }


    context.beginPath();


    points.forEach(
      (
        point,
        index
      ) => {

        if (
          index === 0
        ) {

          context.moveTo(
            point.x,
            point.y
          );

        } else {

          context.lineTo(
            point.x,
            point.y
          );

        }

      }
    );


    context.stroke();

  }

}


/* =========================================================
   模範解答
   現在のlayout_boxに対応するページを取得し、
   その解答欄だけを切り出して表示
========================================================= */

async function loadModelAnswer() {

  const container =
    document.getElementById(
      "modelAnswer"
    );


  if (!container) {

    return;

  }


  container.textContent =
    "読み込み中...";


  /*
    現在の解答欄と同じページ
  */

  const {
    data: modelPage,
    error: pageError
  } =
    await supabaseClient
      .from(
        "model_answer_pages"
      )
      .select(`
        id,
        page_no,
        image_path,
        width_px,
        height_px
      `)
      .eq(
        "test_id",
        testId
      )
      .eq(
        "page_no",
        currentBox.page_no
      )
      .maybeSingle();


  if (pageError) {

    console.error(
      "模範解答ページ:",
      pageError
    );


    container.textContent =
      "模範解答ページを取得できませんでした。";


    return;

  }


  if (!modelPage) {

    container.textContent =
      "この解答欄の模範解答ページが登録されていません。";


    return;

  }


  /*
    Storage
  */

  const {
    data: signed,
    error: signedError
  } =
    await supabaseClient
      .storage
      .from(
        "model-answers"
      )
      .createSignedUrl(
        modelPage.image_path,
        3600
      );


  if (signedError) {

    console.error(
      "模範解答Storage:",
      signedError
    );


    container.textContent =
      "模範解答画像を取得できませんでした。";


    return;

  }


  if (
    !signed?.signedUrl
  ) {

    container.textContent =
      "模範解答画像URLを取得できませんでした。";


    return;

  }


  try {

    const image =
      await loadImageForMarking(
        signed.signedUrl
      );


    const cropped =
      cropCanvasForBox(
        image,
        currentBox
      );


    if (!cropped) {

      container.textContent =
        "模範解答の解答欄を切り出せませんでした。";


      return;

    }


    const resultImage =
      document.createElement(
        "img"
      );


    resultImage.src =
      cropped.toDataURL(
        "image/png"
      );


    resultImage.alt =
      "模範解答";


    resultImage.style.cssText = `

      display:block;

      max-width:100%;

      max-height:500px;

      object-fit:contain;

    `;


    container.innerHTML =
      "";


    container.appendChild(
      resultImage
    );


  } catch (error) {

    console.error(
      "模範解答切り出し:",
      error
    );


    container.textContent =
      "模範解答の表示に失敗しました。";

  }

}


/* =========================================================
   模範解答画像ロード
========================================================= */

function loadImageForMarking(
  src
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        () =>
          resolve(
            image
          );


      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );


      image.src =
        src;

    }
  );

}


/* =========================================================
   模範解答切り出し
========================================================= */

function cropCanvasForBox(
  image,
  box
) {

  const x =
    Math.max(
      0,
      Number(
        box.x
      ) || 0
    );


  const y =
    Math.max(
      0,
      Number(
        box.y
      ) || 0
    );


  const width =
    Number(
      box.width
    ) || 1;


  const height =
    Number(
      box.height
    ) || 1;


  const cropWidth =
    Math.min(
      width,
      image.naturalWidth - x
    );


  const cropHeight =
    Math.min(
      height,
      image.naturalHeight - y
    );


  if (
    cropWidth <= 0 ||
    cropHeight <= 0
  ) {

    return null;

  }


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.round(
      cropWidth
    );


  canvas.height =
    Math.round(
      cropHeight
    );


  const context =
    canvas.getContext(
      "2d"
    );


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


  return canvas;

}


/* =========================================================
   ズーム
========================================================= */

function applyZoom() {

  const zoomValue =
    document.getElementById(
      "zoomValue"
    );


  if (zoomValue) {

    zoomValue.textContent =
      `${Math.round(
        zoom * 100
      )}%`;

  }


  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      card => {

        card.style.transform =
          `scale(${zoom})`;


        card.style.transformOrigin =
          "top left";

      }
    );

}


/* =========================================================
   進捗
========================================================= */

function updateProgress() {

  const total =
    document.querySelectorAll(
      ".answer-card"
    ).length;


  const done =
    document.querySelectorAll(
      ".answer-card.done"
    ).length;


  const element =
    document.getElementById(
      "markingProgress"
    );


  if (element) {

    element.textContent =
      `${done} / ${total}`;

  }

}


/* =========================================================
   点数入力
========================================================= */

async function applyScoreInput() {

  if (!selectedCard) {

    selectFirst();

  }


  if (!selectedCard) {

    alert(
      "答案を選択してください。"
    );


    return;

  }


  const input =
    document.getElementById(
      "scoreInput"
    );


  if (!input) {

    return;

  }


  const value =
    input.value.trim();


  if (!value) {

    alert(
      "点数を入力してください。"
    );


    return;

  }


  const score =
    Number(
      value
    );


  if (
    !Number.isFinite(
      score
    )
  ) {

    alert(
      "正しい点数を入力してください。"
    );


    return;

  }


  const saved =
    await setScore(
      selectedCard,
      score,
      {
        fullMark:
          false
      }
    );


  if (saved) {

    clearScoreInput();

  }

}


/* =========================================================
   点数入力クリア
========================================================= */

function clearScoreInput() {

  const input =
    document.getElementById(
      "scoreInput"
    );


  if (input) {

    input.value =
      "";

  }


  scoreInputValue =
    "";

}


/* =========================================================
   キーボード
========================================================= */

function setupKeyboard() {

  document.addEventListener(
    "keydown",
    async event => {

      const tag =
        event.target.tagName;


      /*
        SELECT / TEXTAREA
      */

      if (
        tag === "SELECT" ||
        tag === "TEXTAREA"
      ) {

        return;

      }


      /*
        scoreInput以外のINPUT
      */

      if (
        tag === "INPUT" &&
        event.target.id !==
          "scoreInput"
      ) {

        return;

      }


      /*
        ===================================================
        L → ○ → 満点
        ===================================================
      */

      if (
        event.key.toLowerCase() ===
        "l"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirst();

        }


        if (!selectedCard) {

          return;

        }


        const max =
          Number(
            currentBox?.points
          );


        if (
          !Number.isFinite(max)
        ) {

          alert(
            "この解答欄には配点が設定されていません。"
          );


          return;

        }


        drawSymbol(
          selectedCard,
          "○"
        );


        await saveMark(
          selectedCard,
          "circle"
        );


        await setScore(
          selectedCard,
          max,
          {
            fullMark:
              true
          }
        );


        return;

      }


      /*
        ===================================================
        K → × → 0点
        ===================================================
      */

      if (
        event.key.toLowerCase() ===
        "k"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirst();

        }


        if (!selectedCard) {

          return;

        }


        drawSymbol(
          selectedCard,
          "×"
        );


        await saveMark(
          selectedCard,
          "x"
        );


        await setScore(
          selectedCard,
          0
        );


        return;

      }


      /*
        ===================================================
        数字
        ===================================================
      */

      if (
        /^[0-9]$/.test(
          event.key
        )
      ) {

        event.preventDefault();


        const input =
          document.getElementById(
            "scoreInput"
          );


        if (!input) {

          return;

        }


        if (
          input.value ===
          "0"
        ) {

          input.value =
            event.key;

        } else {

          input.value +=
            event.key;

        }


        scoreInputValue =
          input.value;


        return;

      }


      /*
        ===================================================
        Backspace
        ===================================================
      */

      if (
        event.key ===
        "Backspace"
      ) {

        if (
          event.target.id !==
          "scoreInput"
        ) {

          event.preventDefault();


          const input =
            document.getElementById(
              "scoreInput"
            );


          if (input) {

            input.value =
              input.value.slice(
                0,
                -1
              );


            scoreInputValue =
              input.value;

          }

        }


        return;

      }


      /*
        ===================================================
        Enter
        ===================================================
      */

      if (
        event.key ===
        "Enter"
      ) {

        if (
          scoreInputValue ||
          document.activeElement?.id ===
            "scoreInput"
        ) {

          event.preventDefault();


          await applyScoreInput();


          return;

        }

      }


      /*
        ===================================================
        Escape
        ===================================================
      */

      if (
        event.key ===
        "Escape"
      ) {

        clearScoreInput();

      }

    }
  );


  /*
    scoreInput直接入力
  */

  const scoreInput =
    document.getElementById(
      "scoreInput"
    );


  if (scoreInput) {

    scoreInput.addEventListener(
      "input",
      () => {

        scoreInputValue =
          scoreInput.value;

      }
    );


    scoreInput.addEventListener(
      "keydown",
      async event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();


          await applyScoreInput();

        }

      }
    );

  }

}


/* =========================================================
   ツール処理
========================================================= */

function handleTool(
  card
) {

  /*
    選択
  */

  if (
    activeTool ===
    "select"
  ) {

    return;

  }


  /*
    ○
  */

  if (
    activeTool ===
    "circle"
  ) {

    drawSymbol(
      card,
      "○"
    );


    saveMark(
      card,
      "circle"
    );


    const max =
      Number(
        currentBox?.points
      );


    if (
      Number.isFinite(max)
    ) {

      setScore(
        card,
        max,
        {
          fullMark:
            true
        }
      );

    }


    return;

  }


  /*
    ×
  */

  if (
    activeTool ===
    "x"
  ) {

    drawSymbol(
      card,
      "×"
    );


    saveMark(
      card,
      "x"
    );


    setScore(
      card,
      0
    );


    return;

  }


  /*
    △
  */

  if (
    activeTool ===
    "triangle"
  ) {

    drawSymbol(
      card,
      "△"
    );


    saveMark(
      card,
      "triangle"
    );


    const input =
      document.getElementById(
        "scoreInput"
      );


    if (input) {

      input.value =
        "";

      scoreInputValue =
        "";

      input.focus();

    }


    return;

  }


  /*
    ◎
  */

  if (
    activeTool ===
    "double"
  ) {

    drawSymbol(
      card,
      "◎"
    );


    saveMark(
      card,
      "double_circle"
    );


    return;

  }


  /*
    数字
  */

  if (
    activeTool ===
    "number"
  ) {

    const input =
      document.getElementById(
        "scoreInput"
      );


    if (input) {

      input.focus();

      input.select();

    }


    return;

  }


  /*
    テキスト
  */

  if (
    activeTool ===
    "text"
  ) {

    drawText(
      card
    );


    return;

  }


  /*
    描画
  */

  if (
    activeTool ===
    "pen"
  ) {

    enablePen(
      card
    );

  }

}


/* =========================================================
   記号描画
========================================================= */

function drawSymbol(
  card,
  symbol
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  context.strokeStyle =
    color;


  context.fillStyle =
    color;


  context.lineWidth =
    3;


  const x =
    canvas.width / 2;


  const y =
    canvas.height / 2;


  if (
    symbol ===
    "○"
  ) {

    context.beginPath();


    context.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );


    context.stroke();


    return;

  }


  if (
    symbol ===
    "×"
  ) {

    context.beginPath();


    context.moveTo(
      x - size / 2,
      y - size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.moveTo(
      x + size / 2,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.stroke();


    return;

  }


  if (
    symbol ===
    "△"
  ) {

    context.beginPath();


    context.moveTo(
      x,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.closePath();


    context.stroke();


    return;

  }


  if (
    symbol ===
    "◎"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      "◎",
      x - size / 2,
      y + size / 2
    );

  }

}


/* =========================================================
   記号保存
========================================================= */

async function saveMark(
  card,
  objectType
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  const x =
    canvas
      ? canvas.width / 2
      : 0;


  const y =
    canvas
      ? canvas.height / 2
      : 0;


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          objectType,

        text_value:
          null,

        color,

        font_size:
          size,

        stroke_width:
          3,

        x,

        y,

        width:
          null,

        height:
          null,

        points:
          null,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "記号保存:",
      error
    );

  }

}


/* =========================================================
   テキスト
========================================================= */

function drawText(
  card
) {

  const input =
    document.getElementById(
      "markText"
    );


  const text =
    input.value.trim();


  if (!text) {

    alert(
      "テキストを入力してください。"
    );


    return;

  }


  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    ) || 42;


  const x =
    10;


  const y =
    Math.max(
      size,
      20
    );


  context.fillStyle =
    color;


  context.font =
    `${size}px Arial`;


  context.fillText(
    text,
    x,
    y
  );


  saveTextMark(
    card,
    text,
    color,
    size,
    x,
    y
  );

}


/* =========================================================
   テキスト保存
========================================================= */

async function saveTextMark(
  card,
  text,
  color,
  size,
  x,
  y
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          "text",

        text_value:
          text,

        color,

        font_size:
          size,

        stroke_width:
          3,

        x,

        y,

        width:
          null,

        height:
          null,

        points:
          null,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "テキスト保存:",
      error
    );

  }

}


/* =========================================================
   描画
========================================================= */

function enablePen(
  card
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  canvas.style.pointerEvents =
    "auto";


  const context =
    canvas.getContext(
      "2d"
    );


  let drawing =
    false;


  let points = [];


  canvas.onpointerdown =
    event => {

      drawing =
        true;


      points = [

        {
          x:
            event.offsetX,

          y:
            event.offsetY
        }

      ];


      context.beginPath();


      context.moveTo(
        event.offsetX,
        event.offsetY
      );

    };


  canvas.onpointermove =
    event => {

      if (!drawing) {

        return;

      }


      const point = {

        x:
          event.offsetX,

        y:
          event.offsetY

      };


      points.push(
        point
      );


      context.strokeStyle =
        document.getElementById(
          "markColor"
        ).value;


      context.lineWidth =
        3;


      context.lineTo(
        point.x,
        point.y
      );


      context.stroke();

    };


  canvas.onpointerup =
    async () => {

      await finishPen();

    };


  canvas.onpointerleave =
    async () => {

      if (drawing) {

        await finishPen();

      }

    };


  async function finishPen() {

    if (!drawing) {

      return;

    }


    drawing =
      false;


    canvas.style.pointerEvents =
      "none";


    if (!points.length) {

      return;

    }


    await savePenMark(
      card,
      points
    );

  }

}


/* =========================================================
   描画保存
========================================================= */

async function savePenMark(
  card,
  points
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  if (
    !Array.isArray(points) ||
    !points.length
  ) {

    return;

  }


  const {
    error
  } =
    await supabaseClient
      .from(
        "mark_objects"
      )
      .insert({

        answer_sheet_id:
          card.dataset.answerId,

        question_id:
          null,

        layout_box_id:
          boxId,

        object_type:
          "pen",

        text_value:
          null,

        color:
          document.getElementById(
            "markColor"
          ).value,

        font_size:
          null,

        stroke_width:
          3,

        x:
          0,

        y:
          0,

        width:
          null,

        height:
          null,

        points,

        created_by:
          session.user.id

      });


  if (error) {

    console.error(
      "描画保存:",
      error
    );

  }

}


/* =========================================================
   保存済み記号
========================================================= */

function drawStoredMark(
  card,
  mark
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  if (!canvas) {

    return;

  }


  resizeMarkCanvas(
    card
  );


  const context =
    canvas.getContext(
      "2d"
    );


  const color =
    mark.color ||
    "#e53935";


  const size =
    Number(
      mark.font_size
    ) || 42;


  context.strokeStyle =
    color;


  context.fillStyle =
    color;


  context.lineWidth =
    Number(
      mark.stroke_width
    ) || 3;


  const x =
    Number(
      mark.x
    ) ||
    canvas.width / 2;


  const y =
    Number(
      mark.y
    ) ||
    canvas.height / 2;


  if (
    mark.object_type ===
    "circle"
  ) {

    context.beginPath();


    context.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );


    context.stroke();


    return;

  }


  if (
    mark.object_type ===
    "x"
  ) {

    context.beginPath();


    context.moveTo(
      x - size / 2,
      y - size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.moveTo(
      x + size / 2,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.stroke();


    return;

  }


  if (
    mark.object_type ===
    "triangle"
  ) {

    context.beginPath();


    context.moveTo(
      x,
      y - size / 2
    );


    context.lineTo(
      x - size / 2,
      y + size / 2
    );


    context.lineTo(
      x + size / 2,
      y + size / 2
    );


    context.closePath();


    context.stroke();


    return;

  }


  if (
    mark.object_type ===
    "double_circle"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      "◎",
      x,
      y
    );


    return;

  }


  if (
    mark.object_type ===
    "text"
  ) {

    context.font =
      `${size}px Arial`;


    context.fillText(
      mark.text_value ||
      "",
      x,
      y
    );


    return;

  }


  if (
    mark.object_type ===
    "pen"
  ) {

    const points =
      Array.isArray(
        mark.points
      )
        ? mark.points
        : [];


    if (!points.length) {

      return;

    }


    context.beginPath();


    points.forEach(
      (
        point,
        index
      ) => {

        if (
          index === 0
        ) {

          context.moveTo(
            point.x,
            point.y
          );

        } else {

          context.lineTo(
            point.x,
            point.y
          );

        }

      }
    );


    context.stroke();

  }

}


/* =========================================================
   模範解答
   model_answer_pagesから現在ページを取得し、
   currentBoxの範囲だけ切り出す
========================================================= */

async function loadModelAnswer() {

  const container =
    document.getElementById(
      "modelAnswer"
    );


  if (!container) {

    return;

  }


  container.textContent =
    "読み込み中...";


  /*
    現在のlayout_boxと同じページ
  */

  const {
    data: modelPage,
    error: pageError
  } =
    await supabaseClient
      .from(
        "model_answer_pages"
      )
      .select(`
        id,
        page_no,
        image_path,
        width_px,
        height_px
      `)
      .eq(
        "test_id",
        testId
      )
      .eq(
        "page_no",
        currentBox.page_no
      )
      .maybeSingle();


  if (pageError) {

    console.error(
      "模範解答ページ取得:",
      pageError
    );


    container.textContent =
      "模範解答ページを取得できませんでした。";


    return;

  }


  if (!modelPage) {

    container.textContent =
      "この解答欄の模範解答ページが登録されていません。";


    return;

  }


  /*
    Storage
  */

  const {
    data: signed,
    error: signedError
  } =
    await supabaseClient
      .storage
      .from(
        "model-answers"
      )
      .createSignedUrl(
        modelPage.image_path,
        3600
      );


  if (signedError) {

    console.error(
      "模範解答Storage取得:",
      signedError
    );


    container.textContent =
      "模範解答画像を取得できませんでした。";


    return;

  }


  if (
    !signed?.signedUrl
  ) {

    container.textContent =
      "模範解答画像URLを取得できませんでした。";


    return;

  }


  try {

    const image =
      await loadImageForMarking(
        signed.signedUrl
      );


    /*
      現在の解答欄だけ切り出す
    */

    const cropped =
      cropCanvasForBox(
        image,
        currentBox
      );


    if (!cropped) {

      container.textContent =
        "模範解答の解答欄を切り出せませんでした。";


      return;

    }


    const resultImage =
      document.createElement(
        "img"
      );


    resultImage.src =
      cropped.toDataURL(
        "image/png"
      );


    resultImage.alt =
      "模範解答";


    resultImage.style.cssText = `

      display:block;

      width:100%;

      max-width:100%;

      max-height:500px;

      object-fit:contain;

    `;


    container.innerHTML =
      "";


    container.appendChild(
      resultImage
    );


  } catch (error) {

    console.error(
      "模範解答切り出し:",
      error
    );


    container.textContent =
      "模範解答の表示に失敗しました。";

  }

}


/* =========================================================
   模範解答画像
========================================================= */

function loadImageForMarking(
  src
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        () =>
          resolve(
            image
          );


      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );


      image.src =
        src;

    }
  );

}


/* =========================================================
   模範解答切り出し
========================================================= */

function cropCanvasForBox(
  image,
  box
) {

  const x =
    Math.max(
      0,
      Number(
        box.x
      ) || 0
    );


  const y =
    Math.max(
      0,
      Number(
        box.y
      ) || 0
    );


  const width =
    Number(
      box.width
    ) || 1;


  const height =
    Number(
      box.height
    ) || 1;


  const cropWidth =
    Math.min(
      width,
      image.naturalWidth - x
    );


  const cropHeight =
    Math.min(
      height,
      image.naturalHeight - y
    );


  if (
    cropWidth <= 0 ||
    cropHeight <= 0
  ) {

    return null;

  }


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.round(
      cropWidth
    );


  canvas.height =
    Math.round(
      cropHeight
    );


  const context =
    canvas.getContext(
      "2d"
    );


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


  return canvas;

}


/* =========================================================
   ズーム
========================================================= */

function applyZoom() {

  const zoomValue =
    document.getElementById(
      "zoomValue"
    );


  if (zoomValue) {

    zoomValue.textContent =
      `${Math.round(
        zoom * 100
      )}%`;

  }


  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      card => {

        card.style.transform =
          `scale(${zoom})`;


        card.style.transformOrigin =
          "top left";

      }
    );

}


/* =========================================================
   HTML escape
========================================================= */

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(value)
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
   START
========================================================= */

initializeMarking();
