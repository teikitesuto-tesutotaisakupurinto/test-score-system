
/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   採点画面

   答案:
     answer_sheets
        ↓
     answer_sheet_pages
        ↓
     answer-files

   設問:
     layout_boxes
        ↓
     page_no
        ↓
     x / y / width / height

   重要:
     answer_regionsは必須にしない。
     source_page_idは使用しない。
     student-answersは使用しない。

   採点前:
     matched / uploaded

   採点中:
     marking

   全設問採点完了:
     この画面では「全設問採点完了」と表示するだけ。
     answer_sheetsを勝手に公開状態にはしない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let answerSheetId = null;

  let testId = null;

  let answerSheet = null;

  let student = null;

  let answerPages = [];

  let boxes = [];

  let regions = [];

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
     INIT
  ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {

        return;

      }


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      setupEvents();


      await loadAnswers();


      /*
       * URL:
       *
       * /teacher/marking/mark?answer=UUID
       */

      const params =
        new URLSearchParams(
          window.location.search
        );


      const requestedAnswer =
        params.get(
          "answer"
        );


      if (requestedAnswer) {

        answerSheetId =
          requestedAnswer;


        answerSelect.value =
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
          answerSelect.value ||
          null;


        resetSelection();


        if (!answerSheetId) {

          clearScreen();

          return;

        }


        try {

          await loadAnswer();

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "答案を読み込めませんでした。"
          );

        }

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
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          if (
            typeof logout ===
            "function"
          ) {

            await logout();

          }

        }
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
        .order(
          "uploaded_at",
          {
            ascending:
              false
          }
        );


    if (error) {

      throw new Error(
        `答案一覧の取得に失敗しました: ${error.message}`
      );

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
            studentIds
          );


      if (studentError) {

        throw new Error(
          `生徒情報の取得に失敗しました: ${studentError.message}`
        );

      }


      studentMap =
        new Map(
          (
            studentData ||
            []
          ).map(
            item => [
              item.id,
              item
            ]
          )
        );

    }


    answerSelect.innerHTML = `

      <option value="">
        答案を選択してください
      </option>

    `;


    for (
      const answer
      of answers
    ) {

      const s =
        studentMap.get(
          answer.student_id
        );


      const studentText =
        s
          ? `${s.student_no || ""} / ${s.name || ""}`
          : "未紐付け";


      const statusText =
        answer.status ===
          "marked"
          ? "採点完了"
          : answer.status ===
              "marking"
            ? "採点中"
            : "採点前";


      const option =
        document.createElement(
          "option"
        );


      option.value =
        answer.id;


      option.textContent =
        `${studentText} / ${statusText}`;


      answerSelect.appendChild(
        option
      );

    }

  }


  /* =======================================================
     LOAD ANSWER
  ======================================================= */

  async function loadAnswer() {

    if (!answerSheetId) {

      return;

    }


    setStatus(
      "答案を読み込んでいます..."
    );


    /*
     * =====================================================
     * answer_sheets
     * =====================================================
     */

    const {
      data: answer,
      error: answerError
    } =
      await supabaseClient
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
          uploaded_at
          `
        )
        .eq(
          "id",
          answerSheetId
        )
        .single();


    if (answerError) {

      throw new Error(
        `答案本体を取得できません: ${answerError.message}`
      );

    }


    answerSheet =
      answer;


    testId =
      answer.test_id;


    /*
     * =====================================================
     * 生徒
     * =====================================================
     */

    student =
      null;


    if (answer.student_id) {

      const {
        data,
        error
      } =
        await supabaseClient
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
          .eq(
            "id",
            answer.student_id
          )
          .single();


      if (error) {

        throw new Error(
          `生徒情報を取得できません: ${error.message}`
        );

      }


      student =
        data;

    }


    /*
     * =====================================================
     * answer_sheet_pages
     *
     * ここが答案画像の正規ルート。
     * =====================================================
     */

    const {
      data: pageData,
      error: pageError
    } =
      await supabaseClient
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
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (pageError) {

      throw new Error(
        `答案ページを取得できません: ${pageError.message}`
      );

    }


    answerPages =
      pageData || [];


    if (!answerPages.length) {

      throw new Error(
        "この答案には答案ページが登録されていません。"
      );

    }


    /*
     * =====================================================
     * layout_boxes
     *
     * 現在のDB列だけ。
     *
     * source_page_idは使わない。
     * =====================================================
     */

    const {
      data: boxData,
      error: boxError
    } =
      await supabaseClient
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
          created_at,
          points
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
          "created_at",
          {
            ascending:
              true
          }
        );


    if (boxError) {

      throw new Error(
        `枠設定を取得できません: ${boxError.message}`
      );

    }


    boxes =
      boxData || [];


    /*
     * =====================================================
     * 採点対象をlayout_boxesから直接作る
     *
     * QR / 氏名 / 生徒番号 / その他
     * は採点しない。
     * =====================================================
     */

    regions =
      boxes
        .filter(
          isScoringBox
        )
        .map(
          box => ({

            id:
              `layout-${box.id}`,

            answer_sheet_id:
              answerSheetId,

            layout_box_id:
              box.id,

            page_no:
              Number(
                box.page_no
              ),

            x:
              Number(
                box.x
              ),

            y:
              Number(
                box.y
              ),

            width:
              Number(
                box.width
              ),

            height:
              Number(
                box.height
              )

          })
        );


    /*
     * =====================================================
     * scores
     * =====================================================
     */

    const {
      data: scoreData,
      error: scoreError
    } =
      await supabaseClient
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
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (scoreError) {

      throw new Error(
        `採点データを取得できません: ${scoreError.message}`
      );

    }


    scores =
      scoreData || [];


    /*
     * =====================================================
     * mark_objects
     * =====================================================
     */

    const {
      data: markData,
      error: markError
    } =
      await supabaseClient
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
          stroke_width,
          x,
          y,
          width,
          height,
          points,
          created_at
          `
        )
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (markError) {

      throw new Error(
        `採点記号を取得できません: ${markError.message}`
      );

    }


    marks =
      markData || [];


    /*
     * =====================================================
     * QUESTION LIST
     * =====================================================
     */

    renderQuestionList();


    if (!regions.length) {

      renderEmpty(
        "このテストには採点対象の小問枠がありません。"
      );


      setStatus(
        buildStatusText()
      );


      return;

    }


    /*
     * 最初の設問を表示
     */

    await selectRegion(
      regions[0]
    );


    setStatus(
      buildStatusText()
    );

  }


  /* =======================================================
     SCORING BOX
  ======================================================= */

  function isScoringBox(
    box
  ) {

    const type =
      String(
        box.box_type ||
        ""
      )
        .trim()
        .toLowerCase();


    /*
     * 現在のlayout_boxesでは
     * answerが解答欄。
     */

    return (
      type === "answer" ||
      type === "question" ||
      type === "minor"
    );

  }


  /* =======================================================
     QUESTION LIST
  ======================================================= */

  function renderQuestionList() {

    if (!questionList) {

      return;

    }


    questionList.innerHTML =
      "";


    if (!regions.length) {

      questionList.innerHTML = `

        <div class="empty">
          採点対象の設問がありません。
        </div>

      `;

      return;

    }


    regions.forEach(
      region => {

        const box =
          findBox(
            region.layout_box_id
          );


        const score =
          findScore(
            region.layout_box_id
          );


        const item =
          document.createElement(
            "div"
          );


        item.className =
          "question-item";


        if (
          selectedRegion?.id ===
          region.id
        ) {

          item.classList.add(
            "selected"
          );

        }


        const title =
          document.createElement(
            "div"
          );


        title.className =
          "question-title";


        title.textContent =
          box?.label ||
          "設問";


        const scoreLine =
          document.createElement(
            "div"
          );


        scoreLine.className =
          "question-score";


        scoreLine.textContent =
          `配点: ${
            Number(
              box?.points
            ) || 0
          }点`;


        const statusLine =
          document.createElement(
            "div"
          );


        statusLine.className =
          "question-status";


        statusLine.textContent =
          score
            ? `得点: ${score.score}点`
            : "未採点";


        item.appendChild(
          title
        );


        item.appendChild(
          scoreLine
        );


        item.appendChild(
          statusLine
        );


        item.addEventListener(
          "click",
          async () => {

            await selectRegion(
              region
            );

          }
        );


        questionList.appendChild(
          item
        );

      }
    );

  }


  /* =======================================================
     SELECT REGION
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
     RENDER REGION
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


    if (!box) {

      renderEmpty(
        "設問枠が見つかりません。"
      );

      return;

    }


    const score =
      findScore(
        region.layout_box_id
      );


    const card =
      document.createElement(
        "div"
      );


    card.className =
      "answer-card";


    /*
     * Header
     */

    const header =
      document.createElement(
        "div"
      );


    header.className =
      "answer-header";


    const title =
      document.createElement(
        "div"
      );


    title.className =
      "answer-header-title";


    title.textContent =
      box.label ||
      "設問";


    const meta =
      document.createElement(
        "div"
      );


    meta.className =
      "answer-header-meta";


    meta.textContent =
      `配点: ${
        Number(
          box.points
        ) || 0
      }点`;


    if (score) {

      meta.textContent +=
        ` / 現在: ${score.score}点`;

    }


    header.appendChild(
      title
    );


    header.appendChild(
      meta
    );


    card.appendChild(
      header
    );


    /*
     * Image
     */

    const imageWrap =
      document.createElement(
        "div"
      );


    imageWrap.className =
      "region-image-wrap";


    try {

      const image =
        await createRegionImage(
          region
        );


      image.className =
        "region-image";


      imageWrap.appendChild(
        image
      );


      card.appendChild(
        imageWrap
      );


    } catch (error) {

      imageWrap.innerHTML = `

        <div class="empty">

          答案画像を表示できません。

          <br><br>

          ${escapeHtml(
            error.message
          )}

        </div>

      `;


      card.appendChild(
        imageWrap
      );


      answerViewer.appendChild(
        card
      );


      return;

    }


    /*
     * Warning
     */

    const warning =
      document.createElement(
        "div"
      );


    warning.id =
      "scoreWarning";


    warning.className =
      "warning";


    card.appendChild(
      warning
    );


    /*
     * Mark toolbar
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


    card.appendChild(
      toolbar
    );


    /*
     * Score area
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


    card.appendChild(
      scoreArea
    );


    answerViewer.appendChild(
      card
    );


    /*
     * Mark buttons
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
                      item ===
                        button
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
     * 画像への採点記号
     */

    const image =
      imageWrap.querySelector(
        "img"
      );


    if (image) {

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

  }


  /* =======================================================
     CREATE REGION IMAGE
  ======================================================= */

  async function createRegionImage(
    region
  ) {

    const page =
      answerPages.find(
        item =>
          Number(
            item.page_no
          ) ===
          Number(
            region.page_no
          )
      );


    if (!page) {

      throw new Error(
        `答案ページ ${region.page_no} が見つかりません。`
      );

    }


    if (!page.file_path) {

      throw new Error(
        "答案ページのStorageパスがありません。"
      );

    }


    /*
     * answer-files
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "answer-files"
        )
        .createSignedUrl(
          page.file_path,
          600
        );


    if (error) {

      throw new Error(
        `答案画像の取得に失敗しました: ${error.message}`
      );

    }


    const source =
      await loadImage(
        data.signedUrl
      );


    /*
     * 登録時の画像サイズ。
     */

    const sourceWidth =
      Number(
        page.width_px
      ) ||
      source.naturalWidth;


    const sourceHeight =
      Number(
        page.height_px
      ) ||
      source.naturalHeight;


    /*
     * layout座標
     * → 実画像座標
     */

    const scaleX =
      source.naturalWidth /
      sourceWidth;


    const scaleY =
      source.naturalHeight /
      sourceHeight;


    const x =
      Number(
        region.x
      );


    const y =
      Number(
        region.y
      );


    const width =
      Number(
        region.width
      );


    const height =
      Number(
        region.height
      );


    /*
     * 少しだけ余白。
     */

    const padding =
      12;


    const sx =
      Math.max(
        0,
        Math.floor(
          x *
            scaleX -
          padding
        )
      );


    const sy =
      Math.max(
        0,
        Math.floor(
          y *
            scaleY -
          padding
        )
      );


    const sw =
      Math.min(
        source.naturalWidth -
          sx,
        Math.ceil(
          width *
            scaleX +
          padding *
            2
        )
      );


    const sh =
      Math.min(
        source.naturalHeight -
          sy,
        Math.ceil(
          height *
            scaleY +
          padding *
            2
        )
      );


    if (
      sw <= 0 ||
      sh <= 0
    ) {

      throw new Error(
        "設問枠の座標が画像範囲外です。"
      );

    }


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      sw;


    canvas.height =
      sh;


    canvas
      .getContext(
        "2d"
      )
      .drawImage(
        source,

        sx,
        sy,
        sw,
        sh,

        0,
        0,
        sw,
        sh
      );


    const blob =
      await canvasToBlob(
        canvas
      );


    const image =
      document.createElement(
        "img"
      );


    image.src =
      URL.createObjectURL(
        blob
      );


    image.alt =
      "答案";


    return image;

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
     * L
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
     * K
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
     * 数字
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
     * Backspace
     */

    if (
      key ===
      "Backspace"
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


    /*
     * Escape
     */

    if (
      key ===
      "Escape"
    ) {

      numericBuffer =
        "";

      selectedMarkType =
        null;

    }

  }


  /* =======================================================
     SCORE VALIDATION
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

        ok:
          false,

        message:
          "点数を入力してください。"

      };

    }


    if (
      value < 0
    ) {

      return {

        ok:
          false,

        message:
          "0点未満にはできません。"

      };

    }


    if (
      value > max
    ) {

      return {

        ok:
          false,

        message:
          `配点 ${max}点を超えています。`

      };

    }


    return {

      ok:
        true,

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
        `配点 ${getMaxPoints()}点を超えています。`;


      warning.classList.add(
        "show"
      );

    } else {

      warning.classList.remove(
        "show"
      );

    }

  }


  /* =======================================================
     SET SCORE
  ======================================================= */

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
        Number(
          value
        )
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
     MARK OBJECT
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
        box.id,

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
          24,
          Math.min(
            100,
            height *
              0.18
          )
        ),

      stroke_width:
        4,

      x:
        width / 2,

      y:
        height / 2,

      width:
        Math.min(
          width *
            0.2,
          100
        ),

      height:
        Math.min(
          height *
            0.2,
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
        box.id,

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
        42,

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


    const box =
      getSelectedBox();


    if (!box) {

      alert(
        "設問枠が見つかりません。"
      );

      return;

    }


    const score =
      findScore(
        box.id
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


    if (saveButton) {

      saveButton.disabled =
        true;

    }


    try {

      /*
       * 既存scoreを探す。
       */

      const {
        data: existing,
        error: existingError
      } =
        await supabaseClient
          .from(
            "scores"
          )
          .select(
            "id"
          )
          .eq(
            "answer_sheet_id",
            answerSheetId
          )
          .eq(
            "layout_box_id",
            box.id
          )
          .maybeSingle();


      if (existingError) {

        throw new Error(
          `既存採点の確認に失敗しました: ${existingError.message}`
        );

      }


      /*
       * update / insert
       */

      if (existing?.id) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "scores"
            )
            .update({

              question_id:
                box.question_id ||
                null,

              score:
                validation.value,

              status:
                "marked",

              marked_at:
                new Date().toISOString()

            })
            .eq(
              "id",
              existing.id
            );


        if (error) {

          throw new Error(
            `採点更新に失敗しました: ${error.message}`
          );

        }


        score.id =
          existing.id;

      } else {

        const {
          data,
          error
        } =
          await supabaseClient
            .from(
              "scores"
            )
            .insert({

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

            })
            .select(
              "id"
            )
            .single();


        if (error) {

          throw new Error(
            `採点登録に失敗しました: ${error.message}`
          );

        }


        score.id =
          data.id;

      }


      /*
       * ---------------------------------------------------
       * mark_objects
       * ---------------------------------------------------
       */

      const {
        error:
          deleteError
      } =
        await supabaseClient
          .from(
            "mark_objects"
          )
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

        throw new Error(
          `採点記号の更新に失敗しました: ${deleteError.message}`
        );

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

          throw new Error(
            `採点記号の保存に失敗しました: ${markError.message}`
          );

        }

      }


      /*
       * ---------------------------------------------------
       * 採点完了確認
       * ---------------------------------------------------
       *
       * ここでは公開しない。
       */

      const allMarked =
        await isAllQuestionsMarked();


      /*
       * 全問採点済みなら
       * statusはmarkingまで。
       *
       * markedへの最終確定は
       * 成績処理側で行う。
       */

      const {
        error:
          answerStatusError
      } =
        await supabaseClient
          .from(
            "answer_sheets"
          )
          .update({

            status:
              allMarked
                ? "marking"
                : "marking"

          })
          .eq(
            "id",
            answerSheetId
          );


      if (answerStatusError) {

        throw new Error(
          `答案状態の更新に失敗しました: ${answerStatusError.message}`
        );

      }


      /*
       * 最新状態を取得。
       */

      await loadAnswer();


      if (allMarked) {

        setStatus(
          `${getStudentText()} - 全設問の採点完了。成績計算待ちです。`
        );

      } else {

        setStatus(
          `${getStudentText()} - 採点を保存しました。`
        );

      }


    } catch (error) {

      console.error(
        "saveCurrent:",
        error
      );


      alert(
        error.message ||
        "採点を保存できませんでした。"
      );

    } finally {

      saving =
        false;


      if (saveButton) {

        saveButton.disabled =
          false;

      }

    }

  }


  /* =======================================================
     ALL MARKED
  ======================================================= */

  async function isAllQuestionsMarked() {

    if (!regions.length) {

      return false;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "scores"
        )
        .select(
          `
          layout_box_id,
          status
          `
        )
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (error) {

      throw new Error(
        `採点完了確認に失敗しました: ${error.message}`
      );

    }


    const marked =
      new Set(
        (
          data ||
          []
        )
          .filter(
            item =>
              item.status ===
              "marked"
          )
          .map(
            item =>
              item.layout_box_id
          )
      );


    return regions.every(
      region =>
        marked.has(
          region.layout_box_id
        )
    );

  }


  /* =======================================================
     STATUS TEXT
  ======================================================= */

  function buildStatusText() {

    const studentText =
      getStudentText();


    const status =
      answerSheet?.status ||
      "uploaded";


    if (
      status ===
      "matched"
    ) {

      return `${studentText} - 生徒紐付け済み・採点前`;

    }


    if (
      status ===
      "uploaded"
    ) {

      return `${studentText} - 採点前`;

    }


    if (
      status ===
      "marking"
    ) {

      return `${studentText} - 採点中`;

    }


    if (
      status ===
      "marked"
    ) {

      return `${studentText} - 採点完了・成績処理待ち`;

    }


    return `${studentText} - ${status}`;

  }


  function getStudentText() {

    if (!student) {

      return "未紐付け答案";

    }


    return `${student.student_no || ""} / ${student.name || ""}`.trim();

  }


  /* =======================================================
     FIND
  ======================================================= */

  function findBox(
    id
  ) {

    return boxes.find(
      box =>
        box.id ===
        id
    ) || null;

  }


  function findScore(
    id
  ) {

    return scores.find(
      score =>
        score.layout_box_id ===
        id
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
     RESET
  ======================================================= */

  function resetSelection() {

    selectedRegion =
      null;

    numericBuffer =
      "";

    selectedMarkType =
      null;

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearScreen() {

    answerSheet =
      null;

    student =
      null;

    answerPages =
      [];

    boxes =
      [];

    regions =
      [];

    scores =
      [];

    marks =
      [];

    selectedRegion =
      null;


    questionList.innerHTML = `

      <div class="empty">
        答案を選択してください。
      </div>

    `;


    answerViewer.innerHTML = `

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
        ${escapeHtml(
          message
        )}
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


  /* =======================================================
     BLOB
  ======================================================= */

  function canvasToBlob(
    canvas
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        canvas.toBlob(
          blob => {

            if (!blob) {

              reject(
                new Error(
                  "画像変換に失敗しました。"
                )
              );

              return;

            }


            resolve(
              blob
            );

          },
          "image/png"
        );

      }
    );

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  function loadImage(
    source
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
                "答案画像を読み込めませんでした。"
              )
            );


        image.src =
          source;

      }
    );

  }


  /* =======================================================
     ESCAPE
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


})();
