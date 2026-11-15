/* =========================================================
   テスト成績システム
   デジタル採点

   採点単位
   answer_sheets
        ↓
   layout_boxes
        ↓
   scores
        ↓
   mark_objects

   キー
   L = ○
   K = ×

   数字キー
   → 部分点

   設定点数以上
   → 警告
   → 保存しない
========================================================= */


const markingParams =
  new URLSearchParams(
    window.location.search
  );


const markingTestId =
  markingParams.get("test");


const markingBoxId =
  markingParams.get("box");


let currentTest = null;
let currentBox = null;

let answerSheets = [];

let activeTool = "select";

let selectedCard = null;

let zoom = 1;


/* =========================================================
   初期化
========================================================= */

async function initializeMarking() {

  const profile =
    await getProfile();


  if (!profile) {

    location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    location.href =
      "/student/dashboard";

    return;

  }


  if (
    !markingTestId ||
    !markingBoxId
  ) {

    alert(
      "採点対象が指定されていません。"
    );

    location.href =
      "/teacher/marking";

    return;

  }


  try {

    await loadTest();

    await loadBox();

    await loadAnswers();

    await loadModelAnswer();

    setupTools();

    setupKeyboard();

    updateProgress();

  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "採点画面の読み込みに失敗しました。"
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
        markingTestId
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
   解答欄取得
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
        markingBoxId
      )
      .eq(
        "test_id",
        markingTestId
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


  document.getElementById(
    "questionInfo"
  ).textContent =
    data.label ||
    "解答欄";


  const pointText =
    data.points === null ||
    data.points === undefined
      ? "配点未設定"
      : `設定点数：${data.points}点`;


  document.getElementById(
    "pointInfo"
  ).textContent =
    pointText;

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
        original_file_path,
        status,
        created_at,
        students(
          id,
          student_no,
          name
        )
      `)
      .eq(
        "test_id",
        markingTestId
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


  answerSheets =
    data || [];


  renderAnswers();

}


/* =========================================================
   答案2列表示
========================================================= */

function renderAnswers() {

  const grid =
    document.getElementById(
      "answerGrid"
    );


  if (!answerSheets.length) {

    grid.innerHTML = `

      <div class="no-answer">
        採点対象の答案がありません。
      </div>

    `;

    return;

  }


  grid.innerHTML =
    answerSheets
      .map(
        answer =>
          createAnswerCard(
            answer
          )
      )
      .join("");


  answerSheets.forEach(
    async answer => {

      await loadAnswerImage(
        answer
      );

      await loadExistingScore(
        answer
      );

      await loadExistingMarks(
        answer
      );

    }
  );


  setupAnswerEvents();

}


/* =========================================================
   答案カード
========================================================= */

function createAnswerCard(
  answer
) {

  return `

    <article
      class="answer-card"
      data-answer-id="${escapeHtml(answer.id)}"
    >

      <div class="answer-header">

        <span>

          ${escapeHtml(
            answer.students?.student_no ||
            ""
          )}

          -

          ${escapeHtml(
            answer.students?.name ||
            "未紐付け"
          )}

        </span>


        <span class="answer-status">
          未採点
        </span>

      </div>


      <div class="answer-stage">

        <img
          class="answer-image"
          alt="生徒答案"
        >


        <canvas
          class="answer-canvas"
        ></canvas>

      </div>


      <div class="answer-score-bar">

        <button
          class="answer-score"
          data-score="0"
        >
          0
        </button>

        <button
          class="answer-score"
          data-score="1"
        >
          1
        </button>

        <button
          class="answer-score"
          data-score="2"
        >
          2
        </button>

        <button
          class="answer-score"
          data-score="3"
        >
          3
        </button>

        <button
          class="answer-score"
          data-score="4"
        >
          4
        </button>

        <button
          class="answer-score"
          data-score="5"
        >
          5
        </button>

      </div>

    </article>

  `;

}


/* =========================================================
   イベント設定
========================================================= */

function setupAnswerEvents() {

  document
    .querySelectorAll(
      ".answer-card"
    )
    .forEach(
      card => {

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


            handleToolClick(
              card,
              event
            );

          }
        );


        card
          .querySelectorAll(
            ".answer-score"
          )
          .forEach(
            button => {

              button.addEventListener(
                "click",
                event => {

                  event.stopPropagation();


                  selectCard(
                    card
                  );


                  const score =
                    Number(
                      button.dataset.score
                    );


                  setScore(
                    card,
                    score
                  );

                }
              );

            }
          );

      }
    );

}


/* =========================================================
   答案画像
========================================================= */

async function loadAnswerImage(
  answer
) {

  if (
    !answer.original_file_path
  ) {

    return;

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from("answer-files")
      .createSignedUrl(
        answer.original_file_path,
        3600
      );


  if (error) {

    console.error(
      "答案画像取得:",
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


  const image =
    card.querySelector(
      ".answer-image"
    );


  image.src =
    data.signedUrl;


  image.onload =
    () => {

      const canvas =
        card.querySelector(
          ".answer-canvas"
        );


      const stage =
        card.querySelector(
          ".answer-stage"
        );


      canvas.width =
        stage.clientWidth;


      canvas.height =
        stage.clientHeight;

    };

}


/* =========================================================
   既存score
========================================================= */

async function loadExistingScore(
  answer
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("scores")
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
        markingBoxId
      )
      .maybeSingle();


  if (error) {

    console.error(
      "採点結果取得:",
      error
    );

    return;

  }


  if (
    !data ||
    data.status !== "marked"
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


  markCardDone(
    card,
    data.score
  );

}


/* =========================================================
   既存mark_objects
========================================================= */

async function loadExistingMarks(
  answer
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("mark_objects")
      .select(`
        id,
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
        markingBoxId
      )
      .order(
        "created_at"
      );


  if (error) {

    console.error(
      "採点記号取得:",
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


  (data || [])
    .forEach(
      mark =>
        drawStoredMark(
          card,
          mark
        )
    );

}


/* =========================================================
   採点保存
========================================================= */

async function setScore(
  card,
  score
) {

  if (!currentBox) {

    return;

  }


  /*
    配点チェック
  */

  const maxPoints =
    Number(
      currentBox.points
    );


  if (
    Number.isFinite(
      maxPoints
    )
  ) {

    /*
      設定点数以上は禁止
    */

    if (
      score >= maxPoints
    ) {

      alert(
        `設定点数は ${maxPoints}点です。\n${maxPoints}点以上は設定できません。`
      );

      return;

    }

  }


  /*
    マイナス点も禁止
    */

  if (
    score < 0
  ) {

    alert(
      "0点未満は設定できません。"
    );

    return;

  }


  const answerId =
    card.dataset.answerId;


  const session =
    await getSession();


  if (!session) {

    location.href =
      "/login";

    return;

  }


  /*
    layout_box単位で保存
  */

  const {
    error
  } =
    await supabaseClient
      .from("scores")
      .upsert(
        {

          answer_sheet_id:
            answerId,

          question_id:
            null,

          layout_box_id:
            markingBoxId,

          score:
            score,

          status:
            "marked",

          marked_by:
            session.user.id,

          marked_at:
            new Date().toISOString()

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


    return;

  }


  markCardDone(
    card,
    score
  );


  /*
    答案全体の状態
  */

  await updateAnswerStatus(
    answerId
  );


  updateProgress();


  /*
    採点後すぐ次へ
  */

  focusNextUnmarked(
    card
  );

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
      .from("answer_sheets")
      .update({
        status: "marking"
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
   完了表示
========================================================= */

function markCardDone(
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

function focusNextUnmarked(
  currentCard
) {

  const cards =
    [
      ...
      document.querySelectorAll(
        ".answer-card"
      )
    ];


  const currentIndex =
    cards.indexOf(
      currentCard
    );


  /*
    現在位置より後
  */

  for (
    let i = currentIndex + 1;
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
    先頭から探す
  */

  for (
    let i = 0;
    i < currentIndex;
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
    全部採点完了
  */

  alert(
    "この解答欄の採点が完了しました。"
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


  document.getElementById(
    "markingProgress"
  ).textContent =
    `${done} / ${total} 採点済み`;

}


/* =========================================================
   L / K / 数字キー
========================================================= */

function setupKeyboard() {

  document.addEventListener(
    "keydown",
    event => {

      /*
        入力欄ではショートカット無効
      */

      const tag =
        event.target.tagName;


      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {

        return;

      }


      const key =
        event.key.toLowerCase();


      /*
        L → ○
      */

      if (
        key === "l"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirstUnmarked();

          return;

        }


        drawSymbol(
          selectedCard,
          "○"
        );


        saveMarkObject(
          selectedCard,
          {
            object_type:
              "circle"
          }
        );


        return;

      }


      /*
        K → ×
      */

      if (
        key === "k"
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirstUnmarked();

          return;

        }


        drawSymbol(
          selectedCard,
          "×"
        );


        saveMarkObject(
          selectedCard,
          {
            object_type:
              "x"
          }
        );


        /*
          ×は0点
        */

        setScore(
          selectedCard,
          0
        );


        return;

      }


      /*
        数字
      */

      if (
        /^[0-9]$/.test(
          key
        )
      ) {

        event.preventDefault();


        if (!selectedCard) {

          selectFirstUnmarked();

          return;

        }


        const score =
          Number(key);


        setScore(
          selectedCard,
          score
        );


        return;

      }

    }
  );

}


/* =========================================================
   最初の未採点を選択
========================================================= */

function selectFirstUnmarked() {

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
   ツール設定
========================================================= */

function setupTools() {

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

          }
        );

      }
    );


  document
    .querySelectorAll(
      ".footer-score"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            if (!selectedCard) {

              selectFirstUnmarked();

              return;

            }


            setScore(
              selectedCard,
              Number(
                button.dataset.score
              )
            );

          }
        );

      }
    );


  document
    .getElementById(
      "nextUnmarked"
    )
    .addEventListener(
      "click",
      () => {

        if (!selectedCard) {

          selectFirstUnmarked();

          return;

        }


        focusNextUnmarked(
          selectedCard
        );

      }
    );


  document
    .getElementById(
      "exitMarking"
    )
    .addEventListener(
      "click",
      () => {

        location.href =
          `/teacher/marking/select?test=${encodeURIComponent(markingTestId)}`;

      }
    );


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
   ツールクリック
========================================================= */

function handleToolClick(
  card,
  event
) {

  if (
    activeTool ===
    "select"
  ) {

    return;

  }


  if (
    activeTool ===
    "circle"
  ) {

    drawSymbol(
      card,
      "○"
    );


    saveMarkObject(
      card,
      {
        object_type:
          "circle"
      }
    );


    return;

  }


  if (
    activeTool ===
    "x"
  ) {

    drawSymbol(
      card,
      "×"
    );


    saveMarkObject(
      card,
      {
        object_type:
          "x"
      }
    );


    setScore(
      card,
      0
    );


    return;

  }


  if (
    activeTool ===
    "triangle"
  ) {

    drawSymbol(
      card,
      "△"
    );


    saveMarkObject(
      card,
      {
        object_type:
          "triangle"
      }
    );


    return;

  }


  if (
    activeTool ===
    "double"
  ) {

    drawSymbol(
      card,
      "◎"
    );


    saveMarkObject(
      card,
      {
        object_type:
          "double_circle"
      }
    );


    return;

  }


  if (
    activeTool ===
    "number"
  ) {

    const value =
      prompt(
        "点数を入力してください。"
      );


    if (
      value === null
    ) {

      return;

    }


    const score =
      Number(value);


    if (
      !Number.isFinite(
        score
      )
    ) {

      alert(
        "数字を入力してください。"
      );

      return;

    }


    /*
      setScore側で
      配点チェック
    */

    setScore(
      card,
      score
    );


    return;

  }


  if (
    activeTool ===
    "text"
  ) {

    drawText(
      card
    );


    return;

  }


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
   ○ × △ ◎
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


  const ctx =
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
    );


  ctx.strokeStyle =
    color;


  ctx.fillStyle =
    color;


  ctx.lineWidth =
    3;


  const x =
    canvas.width / 2;


  const y =
    canvas.height / 2;


  if (
    symbol === "○"
  ) {

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );

    ctx.stroke();

  }


  if (
    symbol === "×"
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x - size / 2,
      y - size / 2
    );

    ctx.lineTo(
      x + size / 2,
      y + size / 2
    );

    ctx.moveTo(
      x + size / 2,
      y - size / 2
    );

    ctx.lineTo(
      x - size / 2,
      y + size / 2
    );

    ctx.stroke();

  }


  if (
    symbol === "△"
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x,
      y - size / 2
    );

    ctx.lineTo(
      x - size / 2,
      y + size / 2
    );

    ctx.lineTo(
      x + size / 2,
      y + size / 2
    );

    ctx.closePath();

    ctx.stroke();

  }


  if (
    symbol === "◎"
  ) {

    ctx.font =
      `${size}px Arial`;

    ctx.fillText(
      "◎",
      x - size / 2,
      y + size / 2
    );

  }

}


/* =========================================================
   テキスト
========================================================= */

function drawText(
  card
) {

  const text =
    document.getElementById(
      "markText"
    ).value.trim();


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


  const ctx =
    canvas.getContext(
      "2d"
    );


  const size =
    Number(
      document.getElementById(
        "markSize"
      ).value
    );


  const color =
    document.getElementById(
      "markColor"
    ).value;


  ctx.fillStyle =
    color;


  ctx.font =
    `${size}px Arial`;


  const x =
    canvas.width / 2;


  const y =
    canvas.height / 2;


  ctx.fillText(
    text,
    x - 40,
    y
  );


  saveMarkObject(
    card,
    {

      object_type:
        "text",

      text_value:
        text,

      color,

      font_size:
        size,

      x,

      y

    }
  );

}


/* =========================================================
   ペン
========================================================= */

function enablePen(
  card
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


  const ctx =
    canvas.getContext(
      "2d"
    );


  let drawing =
    false;


  let points = [];


  canvas.style.pointerEvents =
    "auto";


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


      ctx.beginPath();


      ctx.moveTo(
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


      ctx.strokeStyle =
        document.getElementById(
          "markColor"
        ).value;


      ctx.lineWidth =
        Number(
          document.getElementById(
            "markSize"
          ).value
        ) / 10;


      ctx.lineTo(
        point.x,
        point.y
      );


      ctx.stroke();

    };


  canvas.onpointerup =
    async () => {

      if (!drawing) {

        return;

      }


      drawing =
        false;


      canvas.style.pointerEvents =
        "none";


      await saveMarkObject(
        card,
        {

          object_type:
            "pen",

          color:
            document.getElementById(
              "markColor"
            ).value,

          stroke_width:
            Number(
              document.getElementById(
                "markSize"
              ).value
            ) / 10,

          points

        }
      );

    };

}


/* =========================================================
   mark_objects保存
========================================================= */

async function saveMarkObject(
  card,
  mark
) {

  const session =
    await getSession();


  if (!session) {

    return;

  }


  const answerId =
    card.dataset.answerId;


  const row = {

    answer_sheet_id:
      answerId,

    question_id:
      null,

    layout_box_id:
      markingBoxId,

    object_type:
      mark.object_type,

    text_value:
      mark.text_value ||
      null,

    color:
      mark.color ||
      document.getElementById(
        "markColor"
      ).value,

    font_size:
      mark.font_size ||
      Number(
        document.getElementById(
          "markSize"
        ).value
      ),

    stroke_width:
      mark.stroke_width ||
      3,

    x:
      mark.x ||
      0,

    y:
      mark.y ||
      0,

    width:
      mark.width ||
      null,

    height:
      mark.height ||
      null,

    points:
      mark.points ||
      null,

    created_by:
      session.user.id

  };


  const {
    error
  } =
    await supabaseClient
      .from("mark_objects")
      .insert(
        row
      );


  if (error) {

    console.error(
      "採点記号保存:",
      error
    );

  }

}


/* =========================================================
   保存済み記号の描画
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


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.strokeStyle =
    mark.color ||
    "#e53935";


  ctx.fillStyle =
    mark.color ||
    "#e53935";


  ctx.lineWidth =
    Number(
      mark.stroke_width
    ) || 3;


  const x =
    Number(mark.x) ||
    canvas.width / 2;


  const y =
    Number(mark.y) ||
    canvas.height / 2;


  const size =
    Number(mark.font_size) ||
    42;


  if (
    mark.object_type ===
    "circle"
  ) {

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      size / 2,
      0,
      Math.PI * 2
    );

    ctx.stroke();

  }


  if (
    mark.object_type ===
    "x"
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x - size / 2,
      y - size / 2
    );

    ctx.lineTo(
      x + size / 2,
      y + size / 2
    );

    ctx.moveTo(
      x + size / 2,
      y - size / 2
    );

    ctx.lineTo(
      x - size / 2,
      y + size / 2
    );

    ctx.stroke();

  }


  if (
    mark.object_type ===
    "triangle"
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x,
      y - size / 2
    );

    ctx.lineTo(
      x - size / 2,
      y + size / 2
    );

    ctx.lineTo(
      x + size / 2,
      y + size / 2
    );

    ctx.closePath();

    ctx.stroke();

  }


  if (
    mark.object_type ===
    "double_circle"
  ) {

    ctx.font =
      `${size}px Arial`;

    ctx.fillText(
      "◎",
      x,
      y
    );

  }


  if (
    mark.object_type ===
    "text"
  ) {

    ctx.font =
      `${size}px Arial`;

    ctx.fillText(
      mark.text_value ||
      "",
      x,
      y
    );

  }


  if (
    mark.object_type ===
    "pen" &&
    Array.isArray(
      mark.points
    )
  ) {

    ctx.beginPath();


    mark.points.forEach(
      (point, index) => {

        if (index === 0) {

          ctx.moveTo(
            point.x,
            point.y
          );

        } else {

          ctx.lineTo(
            point.x,
            point.y
          );

        }

      }
    );


    ctx.stroke();

  }

}


/* =========================================================
   ズーム
========================================================= */

function applyZoom() {

  document.getElementById(
    "zoomValue"
  ).textContent =
    `${Math.round(zoom * 100)}%`;


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
   模範解答
========================================================= */

async function loadModelAnswer() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("test_pages")
      .select(
        "image_path"
      )
      .eq(
        "test_id",
        markingTestId
      )
      .eq(
        "page_no",
        999
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    return;

  }


  if (
    !data?.image_path
  ) {

    document.getElementById(
      "modelAnswer"
    ).textContent =
      "模範解答未登録";

    return;

  }


  const {
    data: signed,
    error: signedError
  } =
    await supabaseClient
      .storage
      .from("model-answers")
      .createSignedUrl(
        data.image_path,
        3600
      );


  if (signedError) {

    console.error(
      signedError
    );

    return;

  }


  document.getElementById(
    "modelAnswer"
  ).innerHTML = `

    <img
      src="${signed.signedUrl}"
      alt="模範解答"
    >

  `;

}


/* =========================================================
   ログアウト
========================================================= */

initializeMarking();
