
/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   最終採点仕様
   ---------------------------------------------------------
   answer_regions
       ↓
   設問ごとの自動クロップ画像
       ↓
   採点

   L
     → ○
     → 配点満点

   K
     → ×
     → 0点

   数字キー
     → 複数桁
     → 部分点

   配点超過
     → 警告
     → 保存不可

   保存
     → scores
     → mark_objects

   注意
   ---------------------------------------------------------
   layout_boxesは採点画面に枠として描画しない。
   元答案画像もこの画面では変更しない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let answerSheetId = null;

  let testId = null;

  let student = null;

  let regions = [];

  let boxes = [];

  let scores = [];

  let marks = [];

  let selectedRegion = null;

  let numericBuffer = "";

  let selectedMarkType = null;

  let saving = false;


  /* =======================================================
     DOM
  ======================================================= */

  const answerSelect =
    document.getElementById("answerSelect");

  const questionList =
    document.getElementById("questionList");

  const answerViewer =
    document.getElementById("answerViewer");

  const statusElement =
    document.getElementById("status");

  const saveButton =
    document.getElementById("saveButton");


  /* =======================================================
     INIT
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();

      if (!profile) {
        return;
      }


      const teacherName =
        document.getElementById("teacherName");

      if (teacherName) {

        teacherName.textContent =
          profile.name || "先生";

      }


      setupEvents();

      await loadAnswers();


      /*
        URLから答案を直接指定
      */

      const params =
        new URLSearchParams(
          window.location.search
        );

      const requestedAnswer =
        params.get("answer");


      if (requestedAnswer) {

        answerSelect.value =
          requestedAnswer;

        answerSheetId =
          requestedAnswer;

        await loadAnswer();

      }

    } catch (error) {

      console.error(
        "marking initialize:",
        error
      );

      showError(
        error.message ||
        "採点画面を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    answerSelect?.addEventListener(
      "change",
      async () => {

        answerSheetId =
          answerSelect.value || null;

        numericBuffer = "";

        selectedMarkType = null;

        selectedRegion = null;

        if (!answerSheetId) {

          clearScreen();

          return;

        }

        await loadAnswer();

      }
    );


    saveButton?.addEventListener(
      "click",
      saveCurrent
    );


    document.addEventListener(
      "keydown",
      handleKeyboard
    );


    document
      .getElementById("logoutButton")
      ?.addEventListener(
        "click",
        logout
      );

  }


  /* =======================================================
     ANSWER LIST
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
          test_id,
          student_id,
          status,
          created_at
        `)
        .in(
          "status",
          [
            "uploaded",
            "marked"
          ]
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {
      throw error;
    }


    const answers =
      data || [];


    const studentIds =
      [
        ...new Set(
          answers
            .map(
              item => item.student_id
            )
            .filter(Boolean)
        )
      ];


    let studentMap =
      new Map();


    if (studentIds.length) {

      const {
        data: studentData,
        error: studentError
      } =
        await supabaseClient
          .from("students")
          .select(`
            id,
            student_no,
            name
          `)
          .in(
            "id",
            studentIds
          );


      if (studentError) {
        throw studentError;
      }


      studentMap =
        new Map(
          (studentData || [])
            .map(
              student => [
                student.id,
                student
              ]
            )
        );

    }


    answerSelect.innerHTML = `

      <option value="">
        答案を選択してください
      </option>

      ${
        answers
          .map(
            answer => {

              const s =
                studentMap.get(
                  answer.student_id
                );


              const label =
                s
                  ? `${s.student_no} / ${s.name}`
                  : `未紐付け / ${answer.id}`;


              return `

                <option
                  value="${escapeHtml(answer.id)}"
                >
                  ${escapeHtml(label)}
                </option>

              `;

            }
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     LOAD ANSWER
  ======================================================= */

  async function loadAnswer() {

    setStatus(
      "答案を読み込んでいます..."
    );


    const {
      data: answer,
      error: answerError
    } =
      await supabaseClient
        .from("answer_sheets")
        .select(`
          id,
          test_id,
          student_id,
          status
        `)
        .eq(
          "id",
          answerSheetId
        )
        .single();


    if (answerError) {
      throw answerError;
    }


    if (!answer.student_id) {

      throw new Error(
        "この答案は生徒に紐付いていません。"
      );

    }


    testId =
      answer.test_id;


    const {
      data: studentData,
      error: studentError
    } =
      await supabaseClient
        .from("students")
        .select(`
          id,
          student_no,
          name
        `)
        .eq(
          "id",
          answer.student_id
        )
        .single();


    if (studentError) {
      throw studentError;
    }


    student =
      studentData;


    /*
      answer_regions
    */

    const {
      data: regionData,
      error: regionError
    } =
      await supabaseClient
        .from("answer_regions")
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          page_no,
          image_path,
          x,
          y,
          width,
          height
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (regionError) {
      throw regionError;
    }


    regions =
      regionData || [];


    /*
      layout_boxes
    */

    const {
      data: boxData,
      error: boxError
    } =
      await supabaseClient
        .from("layout_boxes")
        .select(`
          id,
          question_id,
          source_page_id,
          label,
          points,
          x,
          y,
          width,
          height
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


    if (boxError) {
      throw boxError;
    }


    boxes =
      boxData || [];


    /*
      scores
    */

    const {
      data: scoreData,
      error: scoreError
    } =
      await supabaseClient
        .from("scores")
        .select(`
          id,
          layout_box_id,
          question_id,
          score,
          status,
          marked_at
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (scoreError) {
      throw scoreError;
    }


    scores =
      scoreData || [];


    /*
      mark_objects
    */

    const {
      data: markData,
      error: markError
    } =
      await supabaseClient
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
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (markError) {
      throw markError;
    }


    marks =
      markData || [];


    renderQuestionList();


    if (regions.length) {

      await selectRegion(
        regions[0]
      );

    } else {

      renderEmpty(
        "自動クロップされた解答欄がありません。"
      );

    }


    setStatus(
      `${student.student_no} / ${student.name} の採点`
    );

  }


  /* =======================================================
     QUESTION LIST
  ======================================================= */

  function renderQuestionList() {

    if (!questionList) {
      return;
    }


    if (!regions.length) {

      questionList.innerHTML = `

        <div class="empty">
          解答欄がありません。
        </div>

      `;

      return;

    }


    questionList.innerHTML =
      regions
        .map(
          region => {

            const box =
              findBox(
                region.layout_box_id
              );


            const score =
              findScore(
                region.layout_box_id
              );


            const selected =
              selectedRegion?.id ===
              region.id;


            return `

              <div
                class="question-item ${
                  selected
                    ? "selected"
                    : ""
                }"
                data-region-id="${escapeHtml(
                  region.id
                )}"
              >

                <div class="question-title">

                  ${escapeHtml(
                    box?.label ||
                    "設問"
                  )}

                </div>


                <div class="question-score">

                  配点：
                  ${Number(
                    box?.points
                  ) || 0}点

                </div>


                <div class="question-status">

                  ${
                    score
                      ? `得点：${score.score}点`
                      : "未採点"
                  }

                </div>

              </div>

            `;

          }
        )
        .join("");


    questionList
      .querySelectorAll(
        "[data-region-id]"
      )
      .forEach(
        element => {

          element.addEventListener(
            "click",
            async () => {

              const region =
                regions.find(
                  item =>
                    item.id ===
                    element.dataset.regionId
                );


              if (region) {

                await selectRegion(
                  region
                );

              }

            }
          );

        }
      );

  }


  /* =======================================================
     REGION
  ======================================================= */

  async function selectRegion(
    region
  ) {

    selectedRegion =
      region;

    numericBuffer =
      "";

    selectedMarkType =
      null;


    renderQuestionList();


    await renderRegion(
      region
    );

  }


  /* =======================================================
     REGION VIEW
  ======================================================= */

  async function renderRegion(
    region
  ) {

    answerViewer.innerHTML =
      "";


    const box =
      findBox(
        region.layout_box_id
      );


    const score =
      findScore(
        region.layout_box_id
      );


    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      "answer-card";


    wrapper.innerHTML = `

      <div class="answer-header">

        <div class="answer-header-title">

          ${escapeHtml(
            box?.label ||
            "設問"
          )}

        </div>


        <div class="answer-header-meta">

          配点：
          ${Number(
            box?.points
          ) || 0}点

          ${
            score
              ? ` / 現在：${score.score}点`
              : ""
          }

        </div>

      </div>

    `;


    /*
      クロップ画像
    */

    const imageWrap =
      document.createElement(
        "div"
      );


    imageWrap.className =
      "region-image-wrap";


    const image =
      document.createElement(
        "img"
      );


    image.className =
      "region-image";


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
          region.image_path,
          3600
        );


    if (error) {
      throw error;
    }


    image.src =
      data.signedUrl;


    imageWrap.appendChild(
      image
    );


    wrapper.appendChild(
      imageWrap
    );


    /*
      Warning
    */

    const warning =
      document.createElement(
        "div"
      );


    warning.id =
      "scoreWarning";

    warning.className =
      "warning";


    wrapper.appendChild(
      warning
    );


    /*
      Mark buttons
    */

    const toolbar =
      document.createElement(
        "div"
      );


    toolbar.className =
      "mark-toolbar";


    toolbar.innerHTML = `

      <button
        type="button"
        class="mark-button"
        data-mark="circle"
      >
        ○
      </button>

      <button
        type="button"
        class="mark-button"
        data-mark="x"
      >
        ×
      </button>

      <button
        type="button"
        class="mark-button"
        data-mark="triangle"
      >
        △
      </button>

      <button
        type="button"
        class="mark-button"
        data-mark="double_circle"
      >
        ◎
      </button>

      <button
        type="button"
        class="mark-button"
        data-mark="text"
      >
        文字
      </button>

      <button
        type="button"
        class="mark-button"
        data-mark="pen"
      >
        ペン
      </button>

    `;


    wrapper.appendChild(
      toolbar
    );


    /*
      Score
    */

    const scoreArea =
      document.createElement(
        "div"
      );


    scoreArea.className =
      "score-area";


    scoreArea.innerHTML = `

      <label>
        点数
      </label>

      <input
        id="scoreInput"
        class="score-input"
        type="number"
        step="0.1"
        min="0"
        value="${
          score?.score ??
          ""
        }"
      >

      <button
        id="setScoreButton"
        class="btn btn-primary"
        type="button"
      >
        点数設定
      </button>

      <button
        id="clearScoreButton"
        class="btn"
        type="button"
      >
        点数クリア
      </button>

    `;


    wrapper.appendChild(
      scoreArea
    );


    answerViewer.appendChild(
      wrapper
    );


    /*
      Mark selection
    */

    toolbar
      .querySelectorAll(
        "[data-mark]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              selectedMarkType =
                button.dataset.mark;


              toolbar
                .querySelectorAll(
                  ".mark-button"
                )
                .forEach(
                  item => {

                    item.classList.toggle(
                      "active",
                      item === button
                    );

                  }
                );

            }
          );

        }
      );


    document.getElementById(
      "setScoreButton"
    )?.addEventListener(
      "click",
      setScoreFromInput
    );


    document.getElementById(
      "clearScoreButton"
    )?.addEventListener(
      "click",
      clearCurrentScore
    );


    /*
      クロップ画像クリック
      → 選択中の採点記号を配置
    */

    image.addEventListener(
      "click",
      event => {

        if (
          !selectedMarkType
        ) {
          return;
        }


        createMarkAtImage(
          event,
          image,
          selectedMarkType
        );

      }
    );

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyboard(
    event
  ) {

    if (!selectedRegion) {
      return;
    }


    if (
      event.target instanceof
      HTMLInputElement ||
      event.target instanceof
      HTMLTextAreaElement ||
      event.target instanceof
      HTMLSelectElement
    ) {
      return;
    }


    const key =
      event.key;


    /*
      L = ○ + 満点
    */

    if (
      key === "l" ||
      key === "L"
    ) {

      event.preventDefault();


      setScoreValue(
        getMaxPoints()
      );


      replaceQuestionMarks(
        "circle"
      );


      return;

    }


    /*
      K = × + 0
    */

    if (
      key === "k" ||
      key === "K"
    ) {

      event.preventDefault();


      setScoreValue(
        0
      );


      replaceQuestionMarks(
        "x"
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


      numericBuffer +=
        key;


      const input =
        document.getElementById(
          "scoreInput"
        );


      if (input) {

        input.value =
          numericBuffer;

      }


      validateLiveScore();


      return;

    }


    /*
      Backspace
    */

    if (
      key === "Backspace"
    ) {

      if (
        numericBuffer.length
      ) {

        numericBuffer =
          numericBuffer.slice(
            0,
            -1
          );


        const input =
          document.getElementById(
            "scoreInput"
          );


        if (input) {

          input.value =
            numericBuffer;

        }


        validateLiveScore();

      }


      return;

    }


    /*
      Enter
    */

    if (
      key === "Enter"
    ) {

      if (
        numericBuffer.length
      ) {

        setScoreValue(
          Number(
            numericBuffer
          )
        );


        numericBuffer =
          "";

      }


      return;

    }


    /*
      Escape
    */

    if (
      key === "Escape"
    ) {

      numericBuffer =
        "";

      selectedMarkType =
        null;


      document
        .querySelectorAll(
          ".mark-button"
        )
        .forEach(
          button =>
            button.classList.remove(
              "active"
            )
        );

    }

  }


  /* =======================================================
     SCORE
  ======================================================= */

  function getMaxPoints() {

    const box =
      getSelectedBox();


    return Number(
      box?.points
    ) || 0;

  }


  function validateScore(
    value
  ) {

    const max =
      getMaxPoints();


    if (
      !Number.isFinite(
        value
      )
    ) {

      return {

        ok:false,

        message:
          "点数を入力してください。"

      };

    }


    if (
      value < 0
    ) {

      return {

        ok:false,

        message:
          "0点未満にはできません。"

      };

    }


    if (
      value > max
    ) {

      return {

        ok:false,

        message:
          `設定配点 ${max}点を超えています。保存できません。`

      };

    }


    return {

      ok:true,

      value

    };

  }


  function validateLiveScore() {

    const input =
      document.getElementById(
        "scoreInput"
      );


    const warning =
      document.getElementById(
        "scoreWarning"
      );


    if (
      !input ||
      !warning
    ) {
      return;
    }


    const value =
      Number(
        input.value
      );


    if (
      Number.isFinite(
        value
      ) &&
      value >
        getMaxPoints()
    ) {

      warning.textContent =
        `設定配点 ${getMaxPoints()}点を超えています。`;

      warning.classList.add(
        "show"
      );

    } else {

      warning.classList.remove(
        "show"
      );

    }

  }


  function setScoreFromInput() {

    const input =
      document.getElementById(
        "scoreInput"
      );


    if (!input) {
      return;
    }


    setScoreValue(
      Number(
        input.value
      )
    );

  }


  function setScoreValue(
    value
  ) {

    const result =
      validateScore(
        Number(value)
      );


    const warning =
      document.getElementById(
        "scoreWarning"
      );


    if (!result.ok) {

      if (warning) {

        warning.textContent =
          result.message;

        warning.classList.add(
          "show"
        );

      }


      return false;

    }


    if (warning) {

      warning.classList.remove(
        "show"
      );

    }


    const existing =
      findScore(
        selectedRegion.layout_box_id
      );


    if (existing) {

      existing.score =
        result.value;

      existing.status =
        "marked";

    } else {

      scores.push({

        id:
          crypto.randomUUID(),

        answer_sheet_id:
          answerSheetId,

        layout_box_id:
          selectedRegion.layout_box_id,

        question_id:
          getSelectedBox()?.question_id ||
          null,

        score:
          result.value,

        status:
          "marked"

      });

    }


    renderQuestionList();


    return true;

  }


  /* =======================================================
     MARK
  ======================================================= */

  function replaceQuestionMarks(
    type
  ) {

    if (!selectedRegion) {
      return;
    }


    marks =
      marks.filter(
        mark =>
          mark.layout_box_id !==
          selectedRegion.layout_box_id
      );


    const box =
      getSelectedBox();


    const width =
      Number(
        selectedRegion.width
      ) || 100;


    const height =
      Number(
        selectedRegion.height
      ) || 100;


    marks.push({

      id:
        crypto.randomUUID(),

      answer_sheet_id:
        answerSheetId,

      layout_box_id:
        selectedRegion.layout_box_id,

      question_id:
        box?.question_id ||
        null,

      object_type:
        type,

      text_value:
        null,

      color:
        "#d00000",

      font_size:
        Math.max(
          24,
          Math.min(
            100,
            height * .18
          )
        ),

      stroke_width:
        4,

      /*
        answer_regions内の座標
      */

      x:
        width / 2,

      y:
        height / 2,

      width:
        Math.min(
          width * .2,
          100
        ),

      height:
        Math.min(
          height * .2,
          100
        ),

      points:
        null

    });


    renderRegion(
      selectedRegion
    );

  }


  function createMarkAtImage(
    event,
    image,
    type
  ) {

    const rect =
      image.getBoundingClientRect();


    const scaleX =
      image.naturalWidth /
      rect.width;


    const scaleY =
      image.naturalHeight /
      rect.height;


    const x =
      (
        event.clientX -
        rect.left
      ) *
      scaleX;


    const y =
      (
        event.clientY -
        rect.top
      ) *
      scaleY;


    const box =
      getSelectedBox();


    marks.push({

      id:
        crypto.randomUUID(),

      answer_sheet_id:
        answerSheetId,

      layout_box_id:
        selectedRegion.layout_box_id,

      question_id:
        box?.question_id ||
        null,

      object_type:
        type,

      text_value:
        null,

      color:
        "#d00000",

      font_size:
        Math.max(
          24,
          image.naturalHeight * .08
        ),

      stroke_width:
        4,

      x,
      y,

      width:
        50,

      height:
        50,

      points:
        null

    });


    renderRegion(
      selectedRegion
    );

  }


  /* =======================================================
     CLEAR SCORE
  ======================================================= */

  function clearCurrentScore() {

    if (!selectedRegion) {
      return;
    }


    scores =
      scores.filter(
        score =>
          score.layout_box_id !==
          selectedRegion.layout_box_id
      );


    renderQuestionList();


    renderRegion(
      selectedRegion
    );

  }


  /* =======================================================
     SAVE
  ======================================================= */

  async function saveCurrent() {

    if (saving) {
      return;
    }


    if (!selectedRegion) {

      alert(
        "設問を選択してください。"
      );

      return;

    }


    const score =
      findScore(
        selectedRegion.layout_box_id
      );


    if (!score) {

      alert(
        "点数を設定してください。"
      );

      return;

    }


    const validation =
      validateScore(
        Number(
          score.score
        )
      );


    if (!validation.ok) {

      alert(
        validation.message
      );

      return;

    }


    saving =
      true;


    saveButton.disabled =
      true;


    try {

      const box =
        getSelectedBox();


      /*
        DB側にも超過防止がある。
      */

      const {
        error:
          scoreError
      } =
        await supabaseClient
          .from("scores")
          .upsert({

            id:
              score.id,

            answer_sheet_id:
              answerSheetId,

            layout_box_id:
              box.id,

            question_id:
              box.question_id ||
              null,

            score:
              validation.value,

            status:
              "marked",

            marked_at:
              new Date().toISOString()

          });


      if (scoreError) {
        throw scoreError;
      }


      /*
        この設問の記号を置き換え
      */

      const {
        error:
          deleteError
      } =
        await supabaseClient
          .from("mark_objects")
          .delete()
          .eq(
            "answer_sheet_id",
            answerSheetId
          )
          .eq(
            "layout_box_id",
            box.id
          );


      if (deleteError) {
        throw deleteError;
      }


      const questionMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            box.id
        );


      if (questionMarks.length) {

        const rows =
          questionMarks.map(
            mark => ({

              id:
                mark.id,

              answer_sheet_id:
                answerSheetId,

              layout_box_id:
                box.id,

              question_id:
                box.question_id ||
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
                mark.font_size ||
                42,

              stroke_width:
                mark.stroke_width ||
                4,

              /*
                answer_regions内座標
              */

              x:
                mark.x,

              y:
                mark.y,

              width:
                mark.width,

              height:
                mark.height,

              points:
                mark.points ||
                null

            })
          );


        const {
          error:
            markError
        } =
          await supabaseClient
            .from("mark_objects")
            .insert(
              rows
            );


        if (markError) {
          throw markError;
        }

      }


      /*
        全設問が採点済みか確認
      */

      const allMarked =
        regions.every(
          region =>
            scores.some(
              item =>
                item.layout_box_id ===
                  region.layout_box_id &&
                item.status ===
                  "marked"
            )
        );


      /*
        全設問完了ならmarked。
        未完了ならuploadedのまま。
      */

      const {
        error:
          answerError
      } =
        await supabaseClient
          .from("answer_sheets")
          .update({

            status:
              allMarked
                ? "marked"
                : "uploaded"

          })
          .eq(
            "id",
            answerSheetId
          );


      if (answerError) {
        throw answerError;
      }


      alert(
        "採点を保存しました。"
      );


      await loadAnswer();

    } catch (error) {

      console.error(
        "採点保存:",
        error
      );


      alert(
        error.message ||
        "採点を保存できませんでした。"
      );

    } finally {

      saving =
        false;

      saveButton.disabled =
        false;

    }

  }


  /* =======================================================
     FIND
  ======================================================= */

  function findBox(
    id
  ) {

    return boxes.find(
      box =>
        box.id === id
    ) || null;

  }


  function findScore(
    id
  ) {

    return scores.find(
      score =>
        score.layout_box_id === id
    ) || null;

  }


  function getSelectedBox() {

    return selectedRegion
      ? findBox(
          selectedRegion.layout_box_id
        )
      : null;

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearScreen() {

    regions = [];

    boxes = [];

    scores = [];

    marks = [];

    selectedRegion = null;

    student = null;

    answerViewer.innerHTML = `

      <div class="empty">
        答案を選択してください。
      </div>

    `;

    questionList.innerHTML = `

      <div class="empty">
        答案を選択してください。
      </div>

    `;

  }


  function renderEmpty(
    message
  ) {

    answerViewer.innerHTML = `

      <div class="empty">
        ${escapeHtml(message)}
      </div>

    `;

  }


  function showError(
    message
  ) {

    setStatus(
      message
    );

    renderEmpty(
      message
    );

  }


  function setStatus(
    message
  ) {

    if (statusElement) {

      statusElement.textContent =
        message;

    }

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

  }


  initialize();

})();
