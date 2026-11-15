/* =========================================================
   デジタル採点

   採点単位:
   answer_sheet
      ↓
   layout_box
      ↓
   answer_region

   表示:
   answer_region.image_path

   保存:
   scores
   mark_objects

   キー:
   L = ○
   K = ×
   数字 = 点数
========================================================= */


(function () {

  "use strict";


  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get("test");


  const boxId =
    params.get("box");


  let currentTest =
    null;


  let currentBox =
    null;


  let answers =
    [];


  let selectedCard =
    null;


  let activeTool =
    "select";


  let zoom =
    1;


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    const profile =
      await getProfile();


    if (!profile) {

      location.replace(
        "/login"
      );

      return;

    }


    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {

      location.replace(
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


      location.replace(
        "/teacher/marking"
      );


      return;

    }


    try {

      await loadTest();

      await loadBox();

      await loadAnswers();

      await loadModelAnswer();

      setupToolbar();

      setupKeyboard();

      updateProgress();


    } catch (error) {

      console.error(
        error
      );


      alert(
        error.message ||
        "採点画面を読み込めませんでした。"
      );

    }

  }


  /* =====================================================
     テスト
  ===================================================== */

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


  /* =====================================================
     解答欄
  ===================================================== */

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
        "解答欄が見つかりません。"
      );

    }


    currentBox =
      data;


    document.getElementById(
      "questionInfo"
    ).textContent =
      data.label ||
      "解答欄";


    document.getElementById(
      "pointInfo"
    ).textContent =

      data.points === null ||
      data.points === undefined

        ? "配点未設定"

        : `設定点数：${data.points}点`;

  }


  /* =====================================================
     答案
  ===================================================== */

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


    /*
      answer_regionsを取得
    */

    const answerIds =
      answers.map(
        answer =>
          answer.id
      );


    if (!answerIds.length) {

      renderAnswers();

      return;

    }


    const {
      data:
        regions,
      error:
        regionError
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
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


  /* =====================================================
     答案表示
  ===================================================== */

  function renderAnswers() {

    const grid =
      document.getElementById(
        "answerGrid"
      );


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


    /*
      画像URL
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


    setupAnswerEvents();

  }


  /* =====================================================
     答案カード
  ===================================================== */

  function createAnswerCard(
    answer
  ) {

    return `

      <article
        class="answer-card"
        data-answer-id="${escapeHtml(answer.id)}"
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

          ${
            answer.region

              ? `

                <img
                  class="answer-image"
                  alt="生徒答案"
                >

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
                  切り出し未作成
                </div>

              `
          }


          ${
            answer.region
              ? `
                <canvas
                  class="answer-canvas"
                ></canvas>
              `
              : ""
          }

        </div>



        <div
          class="answer-score-bar"
        >

          ${[0,1,2,3,4,5]
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


  /* =====================================================
     画像
  ===================================================== */

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

        if (!canvas) {

          return;

        }


        canvas.width =
          image.clientWidth;


        canvas.height =
          image.clientHeight;

      };

  }


  /* =====================================================
     既存score
  ===================================================== */

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


    if (card) {

      markDone(
        card,
        data.score
      );

    }

  }


  /* =====================================================
     既存mark_objects
  ===================================================== */

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
          "created_at"
        );


    if (error) {

      console.error(
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


    (
      data || []
    ).forEach(
      mark =>
        drawStoredMark(
          card,
          mark
        )
    );

  }


  /* =====================================================
     イベント
  ===================================================== */

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


              handleTool(
                card
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

        }
      );

  }


  /* =====================================================
     採点保存
  ===================================================== */

  async function setScore(
    card,
    score
  ) {

    /*
      数字点数チェック
    */

    const max =
      Number(
        currentBox.points
      );


    if (
      Number.isFinite(max)
    ) {

      /*
        ユーザー指定:
        設定点数以上は禁止
      */

      if (
        score >= max
      ) {

        alert(
          `設定点数は ${max}点です。\n${max}点以上は設定できません。`
        );


        return false;

      }

    }


    if (
      score < 0
    ) {

      alert(
        "0点未満は設定できません。"
      );


      return false;

    }


    const session =
      await getSession();


    if (!session) {

      location.replace(
        "/login"
      );


      return false;

    }


    const answerId =
      card.dataset.answerId;


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
        error
      );


      alert(
        error.message ||
        "採点結果を保存できませんでした。"
      );


      return false;

    }


    markDone(
      card,
      score
    );


    await updateAnswerStatus(
      answerId
    );


    updateProgress();


    /*
      即次へ
    */

    focusNext(
      card
    );


    return true;

  }


  /* =====================================================
     答案状態
  ===================================================== */

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
        error
      );

    }

  }


  /* =====================================================
     完了
  ===================================================== */

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


  /* =====================================================
     選択
  ===================================================== */

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


  /* =====================================================
     次へ
  ===================================================== */

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


  /* =====================================================
     キーボード
  ===================================================== */

  function setupKeyboard() {

    document.addEventListener(
      "keydown",
      event => {

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
          L = ○
        */

        if (
          key === "l"
        ) {

          event.preventDefault();


          if (!selectedCard) {

            selectFirst();

            return;

          }


          drawSymbol(
            selectedCard,
            "○"
          );


          saveMark(
            selectedCard,
            "circle"
          );


          return;

        }


        /*
          K = ×
        */

        if (
          key === "k"
        ) {

          event.preventDefault();


          if (!selectedCard) {

            selectFirst();

            return;

          }


          drawSymbol(
            selectedCard,
            "×"
          );


          saveMark(
            selectedCard,
            "x"
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

            selectFirst();

            return;

          }


          setScore(
            selectedCard,
            Number(key)
          );


          return;

        }

      }
    );

  }


  /* =====================================================
     最初の未採点
  ===================================================== */

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


  /* =====================================================
     ツールバー
  ===================================================== */

  function setupToolbar() {

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

                selectFirst();

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

            selectFirst();

            return;

          }


          focusNext(
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
            `/teacher/marking/select?test=${encodeURIComponent(testId)}`;

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
              zoom + .1
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
              .5,
              zoom - .1
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


  /* =====================================================
     ツール処理
  ===================================================== */

  function handleTool(
    card
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


      saveMark(
        card,
        "circle"
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


      saveMark(
        card,
        "double_circle"
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
        value ===
        null
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


  /* =====================================================
     記号描画
  ===================================================== */

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
      );


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
      symbol === "○"
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
      symbol === "×"
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
      symbol === "△"
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
      symbol === "◎"
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


  /* =====================================================
     mark_objects保存
  ===================================================== */

  async function saveMark(
    card,
    objectType
  ) {

    const session =
      await getSession();


    if (!session) {

      return;

    }


    const answerId =
      card.dataset.answerId;


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


    const {
      error
    } =
      await supabaseClient
        .from(
          "mark_objects"
        )
        .insert({

          answer_sheet_id:
            answerId,

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

          x:
            0,

          y:
            0,

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
        "記号保存エラー:",
        error
      );

    }

  }


  /* =====================================================
     テキスト
  ===================================================== */

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


    if (!canvas) {

      return;

    }


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
      );


    context.fillStyle =
      color;


    context.font =
      `${size}px Arial`;


    context.fillText(
      text,
      10,
      Math.max(
        size,
        20
      )
    );


    saveTextMark(
      card,
      text,
      color,
      size
    );

  }


  async function saveTextMark(
    card,
    text,
    color,
    size
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

          x:
            10,

          y:
            size,

          points:
            null,

          created_by:
            session.user.id

        });


    if (error) {

      console.error(
        error
      );

    }

  }


  /* =====================================================
     ペン
  ===================================================== */

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

        if (!drawing) {

          return;

        }


        drawing =
          false;


        canvas.style.pointerEvents =
          "none";


        await savePenMark(
          card,
          points
        );

      };

  }


  async function savePenMark(
    card,
    points
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
            "pen",

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

          points:

            points,

          created_by:
            session.user.id

        });


    if (error) {

      console.error(
        error
      );

    }

  }


  /* =====================================================
     保存済み記号
  ===================================================== */

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
      ) ||
      42;


    context.strokeStyle =
      color;


    context.fillStyle =
      color;


    context.lineWidth =
      Number(
        mark.stroke_width
      ) ||
      3;


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


  /* =====================================================
     模範解答
  ===================================================== */

  async function loadModelAnswer() {

    /*
      現在はpage_no=999を
      模範解答として使用。
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "test_pages"
        )
        .select(
          "image_path"
        )
        .eq(
          "test_id",
          testId
        )
        .eq(
          "page_no",
          999
        )
        .maybeSingle();


    if (error) {

      console.error(
        error
      );


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
      data:
        signed,
      error:
        signedError
    } =
      await supabaseClient
        .storage
        .from(
          "model-answers"
        )
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
        src="${escapeHtml(
          signed.signedUrl
        )}"
        alt="模範解答"
      >

    `;

  }


  /* =====================================================
     ズーム
  ===================================================== */

  function applyZoom() {

    document.getElementById(
      "zoomValue"
    ).textContent =
      `${Math.round(
        zoom * 100
      )}%`;


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


  /* =====================================================
     進捗
  ===================================================== */

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
      `${done} / ${total}`;

  }


  /* =====================================================
     HTML escape
  ===================================================== */

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


  initialize();

})();
