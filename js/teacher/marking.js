
/* =========================================================
   テスト成績システム
   採点 完全版

   採点対象
   ---------------------------------------------------------
   answer_regions

   解答用紙のlayout_boxesは
   ここでは描画しない。

   answer_regionsに自動クロップされた
   生徒答案画像だけを表示。


   キー操作
   ---------------------------------------------------------
   L
     → ○
     → 配点満点

   K
     → ×
     → 0点

   数字
     → 点数入力
     → 複数桁対応

   Enter
     → 現在の点数を確定候補

   Backspace
     → 数字入力削除

   Escape
     → 数字入力解除


   配点制限
   ---------------------------------------------------------
   score < 0
     → 保存不可

   score > points
     → 警告
     → 保存不可

   score = points
     → 保存可能

   score < points
     → 部分点として保存可能


   DB
   ---------------------------------------------------------
   scores
   mark_objects


   最終返却
   ---------------------------------------------------------
   mark_objects
      +
   scores
      ↓
   元答案画像へ焼き込み

   このファイルでは
   元答案画像そのものを書き換えない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     State
  ======================================================= */

  let currentAnswerSheetId = null;

  let currentTestId = null;

  let currentStudent = null;

  let currentAnswerPages = [];

  let regions = [];

  let boxes = [];

  let scores = [];

  let marks = [];

  let selectedRegion = null;

  let numericInput = "";

  let activeMarkType = null;


  /* =======================================================
     DOM
  ======================================================= */

  const answerSelect =
    document.getElementById(
      "answerSelect"
    );

  const questionList =
    document.getElementById(
      "questionList"
    );

  const answerViewer =
    document.getElementById(
      "answerViewer"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const saveButton =
    document.getElementById(
      "saveButton"
    );


  /* =======================================================
     Initialize
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {

        return;

      }


      document.getElementById(
        "teacherName"
      ).textContent =
        profile.name ||
        "先生";


      await loadAnswers();

      setupEvents();

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
     Answers
  ======================================================= */

  async function loadAnswers() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
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
            ascending:
              false
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
              item =>
                item.student_id
            )
            .filter(
              Boolean
            )
        )
      ];


    let studentMap =
      new Map();


    if (
      studentIds.length
    ) {

      const {
        data:
          studentData,
        error:
          studentError
      } =
        await supabaseClient
          .from(
            "students"
          )
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
          (
            studentData ||
            []
          ).map(
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

              const student =
                studentMap.get(
                  answer.student_id
                );


              const label =

                student

                  ? `${student.student_no} / ${student.name}`

                  : answer.id;


              return `

                <option
                  value="${escapeHtml(
                    answer.id
                  )}"
                >

                  ${escapeHtml(
                    label
                  )}

                </option>

              `;

            }
          )
          .join("")
      }

    `;


    window.__markingAnswers =
      answers;


    window.__markingStudents =
      studentMap;

  }


  /* =======================================================
     Events
  ======================================================= */

  function setupEvents() {

    answerSelect.addEventListener(
      "change",
      async () => {

        currentAnswerSheetId =
          answerSelect.value ||
          null;


        if (!currentAnswerSheetId) {

          clearScreen();

          return;

        }


        await loadAnswer();

      }
    );


    saveButton.addEventListener(
      "click",
      saveCurrentMark
    );


    document.addEventListener(
      "keydown",
      handleKeyboard
    );


    document.getElementById(
      "logoutButton"
    ).addEventListener(
      "click",
      logout
    );

  }


  /* =======================================================
     Load Answer
  ======================================================= */

  async function loadAnswer() {

    setStatus(
      "答案を読み込んでいます..."
    );


    const {
      data:
        answer,
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          test_id,
          student_id,
          status
        `)
        .eq(
          "id",
          currentAnswerSheetId
        )
        .single();


    if (answerError) {

      throw answerError;

    }


    currentTestId =
      answer.test_id;


    /*
      Student
    */

    const {
      data:
        student,
      error:
        studentError
    } =
      await supabaseClient
        .from(
          "students"
        )
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


    currentStudent =
      student;


    /*
      Pages
    */

    const {
      data:
        pageData,
      error:
        pageError
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          page_no,
          file_path,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (pageError) {

      throw pageError;

    }


    currentAnswerPages =
      pageData || [];


    /*
      Regions
    */

    const {
      data:
        regionData,
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
          page_no,
          x,
          y,
          width,
          height,
          image_path
        `)
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (regionError) {

      throw regionError;

    }


    regions =
      regionData || [];


    /*
      Layout boxes

      表示・配点情報のみ使用。
      枠線は描画しない。
    */

    const {
      data:
        boxData,
      error:
        boxError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
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
          currentTestId
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (boxError) {

      throw boxError;

    }


    boxes =
      boxData || [];


    /*
      Scores
    */

    const {
      data:
        scoreData,
      error:
        scoreError
    } =
      await supabaseClient
        .from(
          "scores"
        )
        .select(`
          id,
          layout_box_id,
          question_id,
          score,
          status
        `)
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
        );


    if (scoreError) {

      throw scoreError;

    }


    scores =
      scoreData || [];


    /*
      Marks
    */

    const {
      data:
        markData,
      error:
        markError
    } =
      await supabaseClient
        .from(
          "mark_objects"
        )
        .select(`
          id,
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
          currentAnswerSheetId
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (markError) {

      throw markError;

    }


    marks =
      markData || [];


    /*
      Render
    */

    renderQuestionList();


    if (
      regions.length
    ) {

      selectRegion(
        regions[0]
      );

    } else {

      renderEmptyViewer(
        "この答案には自動クロップされた解答欄がありません。"
      );

    }


    setStatus(
      `${currentStudent?.student_no || ""} / ${
        currentStudent?.name || ""
      } の採点`
    );

  }


  /* =======================================================
     Question List
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


            const label =
              box?.label ||
              "設問";


            const points =
              Number(
                box?.points
              ) || 0;


            const value =
              score?.score;


            const isSelected =
              selectedRegion?.id ===
              region.id;


            return `

              <div
                class="question-item ${
                  isSelected
                    ? "selected"
                    : ""
                }"
                data-region-id="${escapeHtml(
                  region.id
                )}"
              >

                <div
                  class="question-title"
                >
                  ${escapeHtml(
                    label
                  )}
                </div>


                <div
                  class="question-score"
                >
                  配点：
                  ${points}点
                </div>


                <div
                  class="question-status"
                >

                  ${
                    value !== undefined &&
                    value !== null

                      ? `得点：${value}点`

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
            () => {

              const region =
                regions.find(
                  item =>
                    item.id ===
                    element.dataset.regionId
                );


              if (region) {

                selectRegion(
                  region
                );

              }

            }
          );

        }
      );

  }


  /* =======================================================
     Select Region
  ======================================================= */

  async function selectRegion(
    region
  ) {

    selectedRegion =
      region;


    numericInput =
      "";


    activeMarkType =
      null;


    renderQuestionList();


    await renderRegion(
      region
    );

  }


  /* =======================================================
     Render Region
  ======================================================= */

  async function renderRegion(
    region
  ) {

    if (!answerViewer) {

      return;

    }


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


    /*
      Header
    */

    const header =
      document.createElement(
        "div"
      );


    header.className =
      "answer-header";


    header.innerHTML = `

      <div
        class="answer-header-title"
      >
        ${escapeHtml(
          box?.label ||
          "設問"
        )}
      </div>

      <div
        class="answer-header-meta"
      >
        配点：${
          Number(
            box?.points
          ) || 0
        }点
        ${
          score
            ? ` / 現在：${score.score}点`
            : ""
        }
      </div>

    `;


    wrapper.appendChild(
      header
    );


    /*
      Image
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


    image.alt =
      box?.label ||
      "解答欄";


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


    warning.className =
      "warning";


    warning.id =
      "scoreWarning";


    wrapper.appendChild(
      warning
    );


    /*
      Mark toolbar
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
        max="${
          Number(
            box?.points
          ) || 0
        }"
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
      Mark events
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

              activeMarkType =
                button.dataset.mark;


              toolbar
                .querySelectorAll(
                  ".mark-button"
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


              numericInput =
                "";

            }
          );

        }
      );


    /*
      Score
    */

    document.getElementById(
      "setScoreButton"
    )
      ?.addEventListener(
        "click",
        () => {

          setScoreFromInput();

        }
      );


    document.getElementById(
      "clearScoreButton"
    )
      ?.addEventListener(
        "click",
        () => {

          clearCurrentScore();

        }
      );


    /*
      Image click
    */

    image.addEventListener(
      "click",
      event => {

        if (
          !activeMarkType
        ) {

          return;

        }


        createMarkAtImagePosition(
          event,
          image,
          activeMarkType
        );

      }
    );

  }


  /* =======================================================
     Keyboard
  ======================================================= */

  function handleKeyboard(
    event
  ) {

    if (!selectedRegion) {

      return;

    }


    /*
      input内では独自処理しない。
    */

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
      L
      */

    if (
      key === "l" ||
      key === "L"
    ) {

      event.preventDefault();


      setFullScore();


      return;

    }


    /*
      K
      */

    if (
      key === "k" ||
      key === "K"
    ) {

      event.preventDefault();


      setZeroScore();


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


      numericInput +=
        key;


      showNumericPreview();


      return;

    }


    /*
      Backspace
    */

    if (
      key === "Backspace"
    ) {

      if (
        numericInput.length
      ) {

        numericInput =
          numericInput.slice(
            0,
            -1
          );


        showNumericPreview();

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
        numericInput.length
      ) {

        setScore(
          Number(
            numericInput
          )
        );


        numericInput =
          "";

      }

    }


    /*
      Escape
    */

    if (
      key === "Escape"
    ) {

      numericInput =
        "";

      activeMarkType =
        null;

      clearMarkButtonState();

    }

  }


  /* =======================================================
     L = Full Score
  ======================================================= */

  function setFullScore() {

    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


    setScore(
      Number(
        box.points
      ) || 0
    );


    createMark(
      "circle"
    );

  }


  /* =======================================================
     K = Zero
  ======================================================= */

  function setZeroScore() {

    setScore(
      0
    );


    createMark(
      "x"
    );

  }


  /* =======================================================
     Numeric Preview
  ======================================================= */

  function showNumericPreview() {

    const input =
      document.getElementById(
        "scoreInput"
      );


    if (input) {

      input.value =
        numericInput;

    }

  }


  /* =======================================================
     Score Input
  ======================================================= */

  function setScoreFromInput() {

    const input =
      document.getElementById(
        "scoreInput"
      );


    if (!input) {

      return;

    }


    const value =
      Number(
        input.value
      );


    setScore(
      value
    );

  }


  /* =======================================================
     Score Validation
  ======================================================= */

  function validateScore(
    score
  ) {

    const box =
      getSelectedBox();


    if (!box) {

      return {

        ok:false,

        message:
          "設問が選択されていません。"

      };

    }


    const max =
      Number(
        box.points
      ) || 0;


    const value =
      Number(
        score
      );


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


    /*
      ここが重要。

      設定配点以上は禁止。
    */

    if (
      value > max
    ) {

      return {

        ok:false,

        message:
          `設定配点 ${max}点を超えています。${max}点以下で設定してください。`

      };

    }


    return {

      ok:true,

      value,

      max

    };

  }


  /* =======================================================
     Set Score
  ======================================================= */

  function setScore(
    score
  ) {

    const result =
      validateScore(
        score
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


    let existing =
      findScore(
        selectedRegion.layout_box_id
      );


    if (!existing) {

      existing = {

        id:
          crypto.randomUUID(),

        answer_sheet_id:
          currentAnswerSheetId,

        layout_box_id:
          selectedRegion.layout_box_id,

        question_id:
          getSelectedBox()?.question_id ||
          null,

        score:
          result.value,

        status:
          "marked"

      };


      scores.push(
        existing
      );

    } else {

      existing.score =
        result.value;


      existing.status =
        "marked";

    }


    renderQuestionList();


    renderRegion(
      selectedRegion
    );


    return true;

  }


  /* =======================================================
     Full / Zero mark
  ======================================================= */

  function createMark(
    type
  ) {

    if (!selectedRegion) {

      return;

    }


    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


    /*
      markはregion画像内の
      中央付近へ置く。

      元答案座標への変換は
      answer_regions.x/yを使用する。
    */

    const regionWidth =
      Number(
        selectedRegion.width
      ) || 100;


    const regionHeight =
      Number(
        selectedRegion.height
      ) || 100;


    const mark = {

      id:
        crypto.randomUUID(),

      answer_sheet_id:
        currentAnswerSheetId,

      layout_box_id:
        selectedRegion.layout_box_id,

      question_id:
        box.question_id ||
        null,

      object_type:
        type,

      text_value:
        null,

      color:
        "#d00000",

      font_size:
        Math.max(
          30,
          Math.min(
            100,
            regionHeight *
              0.18
          )
        ),

      stroke_width:
        4,

      x:
        regionWidth *
          0.5,

      y:
        regionHeight *
          0.5,

      width:
        Math.min(
          regionWidth *
            0.2,
          100
        ),

      height:
        Math.min(
          regionHeight *
            0.2,
          100
        ),

      points:
        null

    };


    marks.push(
      mark
    );


    renderRegion(
      selectedRegion
    );

  }


  /* =======================================================
     Mark by image click
  ======================================================= */

  function createMarkAtImagePosition(
    event,
    image,
    type
  ) {

    if (!selectedRegion) {

      return;

    }


    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


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


    const mark = {

      id:
        crypto.randomUUID(),

      answer_sheet_id:
        currentAnswerSheetId,

      layout_box_id:
        selectedRegion.layout_box_id,

      question_id:
        box.question_id ||
        null,

      object_type:
        type,

      text_value:
        null,

      color:
        "#d00000",

      font_size:
        Math.max(
          30,
          Math.min(
            100,
            image.naturalHeight *
              0.08
          )
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

    };


    marks.push(
      mark
    );


    renderRegion(
      selectedRegion
    );

  }


  /* =======================================================
     Clear Score
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
     Save Current
  ======================================================= */

  async function saveCurrentMark() {

    if (!selectedRegion) {

      alert(
        "設問を選択してください。"
      );

      return;

    }


    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


    const score =
      findScore(
        selectedRegion.layout_box_id
      );


    /*
      点数未設定なら保存不可。
    */

    if (!score) {

      alert(
        "点数を設定してください。"
      );

      return;

    }


    const validation =
      validateScore(
        score.score
      );


    if (!validation.ok) {

      alert(
        validation.message
      );

      return;

    }


    /*
      既存score
    */

    const {
      error:
        scoreError
    } =
      await supabaseClient
        .from(
          "scores"
        )
        .upsert({

          id:
            score.id,

          answer_sheet_id:
            currentAnswerSheetId,

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
            new Date()
              .toISOString()

        });


    if (scoreError) {

      throw scoreError;

    }


    /*
      この設問の既存markを削除。

      その後現在メモリのmarkを保存。
    */

    const {
      error:
        deleteMarkError
    } =
      await supabaseClient
        .from(
          "mark_objects"
        )
        .delete()
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
        )
        .eq(
          "layout_box_id",
          box.id
        );


    if (deleteMarkError) {

      throw deleteMarkError;

    }


    const questionMarks =
      marks.filter(
        mark =>
          mark.layout_box_id ===
          box.id
      );


    if (
      questionMarks.length
    ) {

      const rows =
        questionMarks.map(
          mark => ({

            id:
              mark.id,

            answer_sheet_id:
              currentAnswerSheetId,

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
          .from(
            "mark_objects"
          )
          .insert(
            rows
          );


      if (markError) {

        throw markError;

      }

    }


    /*
      answer_sheetsをmarkedへ。
    */

    const {
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .update({

          status:
            "marked"

        })
        .eq(
          "id",
          currentAnswerSheetId
        );


    if (answerError) {

      throw answerError;

    }


    /*
      再読み込み
    */

    await loadAnswer();


    alert(
      "採点を保存しました。"
    );

  }


  /* =======================================================
     Find Box
  ======================================================= */

  function findBox(
    layoutBoxId
  ) {

    return boxes.find(
      box =>
        box.id ===
        layoutBoxId
    ) || null;

  }


  /* =======================================================
     Find Score
  ======================================================= */

  function findScore(
    layoutBoxId
  ) {

    return scores.find(
      score =>
        score.layout_box_id ===
        layoutBoxId
    ) || null;

  }


  /* =======================================================
     Selected Box
  ======================================================= */

  function getSelectedBox() {

    if (!selectedRegion) {

      return null;

    }


    return findBox(
      selectedRegion.layout_box_id
    );

  }


  /* =======================================================
     Mark Button
  ======================================================= */

  function clearMarkButtonState() {

    document
      .querySelectorAll(
        ".mark-button"
      )
      .forEach(
        button => {

          button.classList.remove(
            "active"
          );

        }
      );

  }


  /* =======================================================
     Empty
  ======================================================= */

  function renderEmptyViewer(
    message
  ) {

    if (!answerViewer) {

      return;

    }


    answerViewer.innerHTML = `

      <div class="empty">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  function clearScreen() {

    currentAnswerSheetId =
      null;

    currentTestId =
      null;

    currentStudent =
      null;

    currentAnswerPages =
      [];

    regions =
      [];

    boxes =
      [];

    scores =
      [];

    marks =
      [];

    selectedRegion =
      null;

    numericInput =
      "";

    activeMarkType =
      null;


    questionList.innerHTML = `

      <div class="empty">
        答案を選択してください。
      </div>

    `;


    renderEmptyViewer(
      "答案を選択してください。"
    );

  }


  /* =======================================================
     Error
  ======================================================= */

  function showError(
    message
  ) {

    setStatus(
      message
    );


    renderEmptyViewer(
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


  /* =======================================================
     Escape
  ======================================================= */

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
