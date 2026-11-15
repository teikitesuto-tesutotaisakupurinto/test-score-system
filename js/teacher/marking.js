/* =========================================================
   デジタル採点 本体
========================================================= */


const markingParams =
  new URLSearchParams(
    location.search
  );


const markingTestId =
  markingParams.get("test");


const markingBoxId =
  markingParams.get("box");


let currentBox = null;

let currentTest = null;

let answerSheets = [];

let activeTool = "select";

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


  await loadTest();

  await loadBox();

  await loadAnswers();

  await loadModelAnswer();

  setupTools();

  setupKeyboard();

  updateProgress();

}


/* =========================================================
   テスト
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
        max_score
      `)
      .eq(
        "id",
        markingTestId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  currentTest =
    data;


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
        markingBoxId
      )
      .eq(
        "test_id",
        markingTestId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    alert(
      "解答欄が見つかりません。"
    );

    location.href =
      `/teacher/marking/select?test=${encodeURIComponent(markingTestId)}`;

    return;

  }


  currentBox =
    data;


  document.getElementById(
    "questionInfo"
  ).textContent =
    currentBox.label ||
    "解答欄";


  document.getElementById(
    "pointInfo"
  ).textContent =
    `設定点数：${currentBox.points ?? "未設定"}点`;

}


/* =========================================================
   答案
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
        original_file_path,
        students(
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
        "created_at"
      );


  if (error) {

    throw error;

  }


  answerSheets =
    data || [];


  renderAnswers();

}


/* =========================================================
   答案2列
========================================================= */

function renderAnswers() {

  const grid =
    document.getElementById(
      "answerGrid"
    );


  if (!answerSheets.length) {

    grid.innerHTML = `

      <div
        class="no-answer"
      >
        答案がありません。
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
    answer => {

      loadAnswerImage(
        answer
      );

      loadExistingMarks(
        answer
      );

    }
  );


  /*
    カードクリック
  */

  grid
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
                "button"
              )
            ) {

              return;

            }


            handleCanvasClick(
              card,
              event
            );

          }
        );

      }
    );


  /*
    各カードの点数ボタン
  */

  grid
    .querySelectorAll(
      ".answer-score"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            const card =
              button.closest(
                ".answer-card"
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


function createAnswerCard(
  answer
) {

  return `

    <article
      class="answer-card"
      data-answer-id="${answer.id}"
    >


      <div
        class="answer-header"
      >

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


        <span
          class="answer-status"
        >
          未採点
        </span>

      </div>


      <div
        class="answer-stage"
      >

        <img
          class="answer-image"
          alt="生徒答案"
        >


        <canvas
          class="answer-canvas"
        ></canvas>

      </div>


      <div
        class="answer-score-bar"
      >

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
   答案画像
========================================================= */

async function loadAnswerImage(
  answer
) {

  /*
    今回は元答案ファイルを取得。
    次段階でanswer_regionsの
    切り出し画像を優先する。
  */

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

    console.error(error);

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
        image.clientHeight;

    };

}


/* =========================================================
   既存採点
========================================================= */

async function loadExistingMarks(
  answer
) {

  /*
    現在はscoresを確認。
  */

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
      .maybeSingle();


  if (error) {

    console.error(error);

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
   採点
========================================================= */

async function setScore(
  card,
  score
) {

  if (!currentBox) {
    return;
  }


  const maxPoints =
    Number(
      currentBox.points
    );


  /*
    配点が設定されている場合
    「設定点数以上」は禁止
  */

  if (
    Number.isFinite(
      maxPoints
    )
  ) {

    if (
      score >= maxPoints
    ) {

      alert(
        `設定点数は ${maxPoints} 点です。\n${maxPoints}点以上は設定できません。`
      );

      return;

    }

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


  const {
    error
  } =
    await supabaseClient
      .from("scores")
      .upsert(
        {

          answer_sheet_id:
            answerId,

          /*
            問題登録方式ではなく
            layout_boxを問題単位として
            今後question_idをnull許容で
            拡張する
          */

          question_id:
            null,

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
            "answer_sheet_id,question_id"
        }
      );


  /*
    現在のSQLでは
    question_idがNOT NULLなので、
    このupsertはまだ本番保存できません。

    次のDB変更で
    layout_box_idをscoresへ追加して
    完全にlayout_box基準へ変更します。
  */

  if (error) {

    console.error(error);

    alert(
      error.message
    );

    return;

  }


  markCardDone(
    card,
    score
  );


  /*
    即次へ
  */

  focusNextUnmarked(
    card
  );


  updateProgress();

}


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
   ○ ×
========================================================= */

async function applySymbol(
  card,
  symbol
) {

  if (
    symbol === "○"
  ) {

    /*
      ○は満点ではなく、
      現在の採点仕様では
      設定点数未満で扱う必要がある。

      満点判定は今後
      「正答設定」を別途持たせて実装する。
    */

    drawSymbol(
      card,
      "○"
    );

    return;

  }


  if (
    symbol === "×"
  ) {

    drawSymbol(
      card,
      "×"
    );


    await setScore(
      card,
      0
    );

  }

}


/* =========================================================
   描画
========================================================= */

function drawSymbol(
  card,
  symbol
) {

  const canvas =
    card.querySelector(
      ".answer-canvas"
    );


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
   ツール
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

            const card =
              document.querySelector(
                ".answer-card.selected"
              );


            if (!card) {

              alert(
                "答案を選択してください。"
              );

              return;

            }


            setScore(
              card,
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

        const next =
          document.querySelector(
            ".answer-card:not(.done)"
          );


        if (next) {

          selectCard(
            next
          );

        }

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

        changeZoom(
          0.1
        );

      }
    );


  document
    .getElementById(
      "zoomOut"
    )
    .addEventListener(
      "click",
      () => {

        changeZoom(
          -0.1
        );

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
   キーボード
========================================================= */

function setupKeyboard() {

  document.addEventListener(
    "keydown",
    event => {

      /*
        入力中はショートカットを無視
      */

      if (
        event.target.tagName ===
          "INPUT" ||
        event.target.tagName ===
          "TEXTAREA"
      ) {

        return;

      }


      const card =
        document.querySelector(
          ".answer-card.selected"
        );


      /*
        L = ○
      */

      if (
        event.key.toLowerCase() ===
        "l"
      ) {

        event.preventDefault();


        if (card) {

          drawSymbol(
            card,
            "○"
          );

        }

        return;

      }


      /*
        K = ×
      */

      if (
        event.key.toLowerCase() ===
        "k"
      ) {

        event.preventDefault();


        if (card) {

          drawSymbol(
            card,
            "×"
          );


          setScore(
            card,
            0
          );

        }

        return;

      }


      /*
        数字
      */

      if (
        /^[0-9]$/.test(
          event.key
        )
      ) {

        event.preventDefault();


        if (!card) {
          return;
        }


        setScore(
          card,
          Number(
            event.key
          )
        );

      }

    }
  );

}


/* =========================================================
   答案クリック
========================================================= */

function handleCanvasClick(
  card,
  event
) {

  selectCard(
    card
  );


  if (
    activeTool ===
    "circle"
  ) {

    drawSymbol(
      card,
      "○"
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
      Number(
        value
      );


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


    setScore(
      card,
      score
    );

  }


  if (
    activeTool ===
    "text"
  ) {

    drawText(
      card
    );

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
   選択
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

}


/* =========================================================
   次の答案
========================================================= */

function focusNextUnmarked(
  current
) {

  const cards =
    [
      ...document.querySelectorAll(
        ".answer-card"
      )
    ];


  const index =
    cards.indexOf(
      current
    );


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
    後ろに無ければ先頭から探す
  */

  const first =
    cards.find(
      card =>
        !card.classList.contains(
          "done"
        )
    );


  if (first) {

    selectCard(
      first
    );

  }

}


/* =========================================================
   進捗
========================================================= */

function updateProgress() {

  const all =
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
    `${done} / ${all}`;

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


  ctx.fillStyle =
    document.getElementById(
      "markColor"
    ).value;


  ctx.font =
    `${size}px Arial`;


  ctx.fillText(
    text,
    20,
    50
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


  canvas.onpointerdown =
    event => {

      drawing =
        true;

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


      ctx.strokeStyle =
        document.getElementById(
          "markColor"
        ).value;


      ctx.lineWidth =
        3;


      ctx.lineTo(
        event.offsetX,
        event.offsetY
      );


      ctx.stroke();

    };


  canvas.onpointerup =
    () => {

      drawing =
        false;

    };

}


/* =========================================================
   ズーム
========================================================= */

function changeZoom(
  amount
) {

  zoom += amount;


  if (
    zoom < 0.5
  ) {

    zoom =
      0.5;

  }


  if (
    zoom > 2
  ) {

    zoom =
      2;

  }


  applyZoom();

}


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

  /*
    page_no=999 を模範解答として
    登録している現在の仕様
  */

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


  if (!data?.image_path) {

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


  if (
    signedError
  ) {

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


function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


initializeMarking();
