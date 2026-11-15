/* =========================================================
   テスト成績システム
   デジタル採点 完全版

   採点単位
   answer_sheets
        ↓
   answer_regions
        ↓
   layout_box_id
        ↓
   scores
        ↓
   mark_objects


   キーボード
   L       → ○
   K       → ×
   数字    → 点数入力
   Enter   → 点数確定


   点数ルール
   --------------------------------
   配点 5点の場合

   0～4   → 保存可能
   5以上  → 警告・保存不可


   表示
   --------------------------------
   左   → 模範解答
   右   → 生徒答案2列


   採点後
   --------------------------------
   保存成功
      ↓
   次の未採点答案へ自動移動
========================================================= */


/* =========================================================
   IIFE
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     URL
  ======================================================= */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get("test");


  const boxId =
    params.get("box");


  /* =======================================================
     状態
  ======================================================= */

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


  /*
    数字キー入力中の点数
  */

  let scoreInputValue =
    "";


  /* =======================================================
     初期化
  ======================================================= */

  async function initialize() {

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

      await loadBox();

      await loadAnswers();

      await loadModelAnswer();

      setupToolbar();

      setupKeyboard();

      updateProgress();

    } catch (error) {

      console.error(
        "採点画面初期化:",
        error
      );


      alert(
        error.message ||
        "採点画面を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     テスト取得
  ======================================================= */

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


  /* =======================================================
     解答欄取得
  ======================================================= */

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


  /* =======================================================
     答案取得
  ======================================================= */

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


    const answerIds =
      answers.map(
        answer =>
          answer.id
      );


    /*
      答案なし
    */

    if (!answerIds.length) {

      renderAnswers();

      return;

    }


    /*
      現在の解答欄に対応する
      answer_regions
    */

    const {
      data:
        regions,
      error:
        regionError
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


  /* =======================================================
     答案表示
  ======================================================= */

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


    setupAnswerEvents();

  }


  /* =======================================================
     答案カード
  ======================================================= */

  function createAnswerCard(
    answer
  ) {

    return `

      <article
        class="answer-card"
        data-answer-id="${escapeHtml(
          answer.id
        )}"
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
                  切り出し未作成
                </div>

              `

          }

        </div>



        <div
          class="answer-score-bar"
        >

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


  /* =======================================================
     切り出し画像
  ======================================================= */

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
        "答案領域画像:",
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

        if (!canvas) {

          return;

        }


        canvas.width =
          image.clientWidth;


        canvas.height =
          image.clientHeight;

      };

  }


  /* =======================================================
     既存採点
  ======================================================= */

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
        "既存採点:",
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


  /* =======================================================
     既存記号
  ======================================================= */

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
        "既存記号:",
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


  /* =======================================================
     答案イベント
  ======================================================= */

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

              /*
                点数ボタンなら
                カードクリック処理をしない
              */

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
                  async event => {

                    event.stopPropagation();


                    selectCard(
                      card
                    );


                    const score =
                      Number(
                        button.dataset.score
                      );


                    await setScore(
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


  /* =======================================================
     点数保存
  ======================================================= */

  async function setScore(
    card,
    score
  ) {

    /*
      数値
    */

    score =
      Number(
        score
      );


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
      0未満禁止
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
      ユーザー指定:

      設定点数以上
      ↓
      警告
      ↓
      保存しない
    */

    if (
      Number.isFinite(max) &&
      score >= max
    ) {

      alert(
        `設定点数は ${max}点です。\n\n${max}点以上は設定できません。`
      );


      return false;

    }


    /*
      ログイン確認
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

            score:

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
        "採点保存:",
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
      入力欄クリア
    */

    clearScoreInput();


    /*
      即次へ
    */

    focusNext(
      card
    );


    return true;

  }


  /* =======================================================
     答案状態
  ======================================================= */

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


  /* =======================================================
     採点済み表示
  ======================================================= */

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


  /* =======================================================
     カード選択
  ======================================================= */

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


  /* =======================================================
     次の未採点
  ======================================================= */

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
      現在より後
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
      全部採点済み
    */

    alert(
      "この解答欄の採点が完了しました。"
    );

  }


  /* =======================================================
     最初の未採点
  ======================================================= */

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


  /* =======================================================
     ツールバー
  ======================================================= */

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

    document
      .getElementById(
        "scoreApply"
      )
      .addEventListener(
        "click",
        async () => {

          await applyScoreInput();

        }
      );


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
      終了
    */

    document
      .getElementById(
        "exitMarking"
      )
      .addEventListener(
        "click",
        () => {

          window.location.href =
            `/teacher/marking/select?test=${encodeURIComponent(testId)}`;

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


  /* =======================================================
     点数入力
  ======================================================= */

  async function applyScoreInput() {

    if (!selectedCard) {

      selectFirst();


      if (!selectedCard) {

        alert(
          "答案を選択してください。"
        );


        return;

      }

    }


    const input =
      document.getElementById(
        "scoreInput"
      );


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
        score
      );


    if (saved) {

      input.value =
        "";


      scoreInputValue =
        "";

    }

  }


  /* =======================================================
     点数入力欄クリア
  ======================================================= */

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


  /* =======================================================
     キーボード
  ======================================================= */

  function setupKeyboard() {

    document.addEventListener(
      "keydown",
      async event => {

        const tag =
          event.target.tagName;


        /*
          実際の入力欄を操作している場合
          ショートカットを奪わない
        */

        if (
          tag === "TEXTAREA" ||
          tag === "SELECT"
        ) {

          return;

        }


        /*
          テキスト入力欄は
          数字キー入力の対象外
        */

        if (
          tag === "INPUT" &&
          event.target.id !==
            "scoreInput"
        ) {

          return;

        }


        /*
          -------------------------------------------------
          L → ○
          -------------------------------------------------
        */

        if (
          event.key.toLowerCase() ===
          "l"
        ) {

          event.preventDefault();


          if (!selectedCard) {

            selectFirst();

          }


          if (
            selectedCard
          ) {

            drawSymbol(
              selectedCard,
              "○"
            );


            await saveMark(
              selectedCard,
              "circle"
            );

          }


          return;

        }


        /*
          -------------------------------------------------
          K → ×
          -------------------------------------------------
        */

        if (
          event.key.toLowerCase() ===
          "k"
        ) {

          event.preventDefault();


          if (!selectedCard) {

            selectFirst();

          }


          if (
            selectedCard
          ) {

            drawSymbol(
              selectedCard,
              "×"
            );


            await saveMark(
              selectedCard,
              "x"
            );


            /*
              × = 0点
            */

            await setScore(
              selectedCard,
              0
            );

          }


          return;

        }


        /*
          -------------------------------------------------
          数字キー
          -------------------------------------------------

          例:

          1
          2

          ↓

          12

          Enter

          ↓

          12点確定
        */

        if (
          /^[0-9]$/.test(
            event.key
          )
        ) {

          event.preventDefault();


          /*
            scoreInputへ追加
          */

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
            input.value === "0"
          ) {

            input.value =
              event.key;

          } else {

            input.value +=
              event.key;

          }


          scoreInputValue =
            input.value;


          /*
            数字入力だけでは
            まだ採点確定しない。

            Enterで確定。
          */

          return;

        }


        /*
          -------------------------------------------------
          Backspace
          -------------------------------------------------
        */

        if (
          event.key ===
          "Backspace"
        ) {

          /*
            scoreInputがフォーカスされていない
            ときだけ独自処理
          */

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
          -------------------------------------------------
          Enter → 点数確定
          -------------------------------------------------
        */

        if (
          event.key ===
          "Enter"
        ) {

          /*
            scoreInput自体に
            フォーカスがある場合も処理
          */

          if (
            document.activeElement?.id ===
            "scoreInput" ||
            scoreInputValue
          ) {

            event.preventDefault();


            await applyScoreInput();

          }

          return;

        }


        /*
          -------------------------------------------------
          Escape
          -------------------------------------------------
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
      scoreInput直接入力にも対応
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


  /* =======================================================
     ツール処理
  ======================================================= */

  function handleTool(
    card
  ) {

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


  /* =======================================================
     ○ × △ ◎
  ======================================================= */

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


  /* =======================================================
     mark_objects保存
  ======================================================= */

  async function saveMark(
    card,
    objectType
  ) {

    const session =
      await getSession();


    if (!session) {

      return;

    }


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


  /* =======================================================
     テキスト
  ======================================================= */

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


  /* =======================================================
     ペン
  ======================================================= */

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


    canvas.onpointerleave =
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


    if (
      !points ||
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
        "ペン保存:",
        error
      );

    }

  }


  /* =======================================================
     保存済み記号描画
  ======================================================= */

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
      描画
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


  /* =======================================================
     模範解答
  ======================================================= */

  async function loadModelAnswer() {

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
        "模範解答:",
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


  /* =======================================================
     ズーム
  ======================================================= */

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


  /* =======================================================
     進捗
  ======================================================= */

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


  /* =======================================================
     HTML escape
  ======================================================= */

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
