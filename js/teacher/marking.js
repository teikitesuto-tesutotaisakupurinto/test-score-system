
/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   採点画面 完全版

   答案画像:
     answer_sheets
        ↓
     answer_sheet_pages
        ↓
     answer-files
        ↓
     signed URL
        ↓
     <img>
        ↓
     CSS crop

   Canvas / toBlob は答案表示には使用しない。

   設問:
     layout_boxes

   採点対象:
     box_type = answer
     AND
     question_id が存在するもの

   使用しない:
     source_page_id
     student-answers
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
       * 詳細:
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


        if (answerSelect) {

          answerSelect.value =
            requestedAnswer;

        }


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

    if (!answerSelect) {

      return;

    }


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
        getAnswerStatusText(
          answer.status
        );


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
        `答案本体の取得に失敗しました: ${answerError.message}`
      );

    }


    answerSheet =
      answer;


    testId =
      answer.test_id;


    /*
     * =====================================================
     * STUDENT
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
          `生徒情報の取得に失敗しました: ${error.message}`
        );

      }


      student =
        data;

    }


    /*
     * =====================================================
     * ANSWER SHEET PAGES
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
        `答案ページの取得に失敗しました: ${pageError.message}`
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
     * LAYOUT BOXES
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
        `枠設定の取得に失敗しました: ${boxError.message}`
      );

    }


    boxes =
      boxData || [];


    /*
     * =====================================================
     * 採点対象
     *
     * answer + question_idあり
     *
     * QR / name / student_no / other
     * 大問 / 小計 / 合計などは除外
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
     * SCORES
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
        `採点データの取得に失敗しました: ${scoreError.message}`
      );

    }


    scores =
      scoreData || [];


    /*
     * =====================================================
     * MARK OBJECTS
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
        `採点記号の取得に失敗しました: ${markError.message}`
      );

    }


    marks =
      markData || [];


    renderQuestionList();


    if (!regions.length) {

      renderEmpty(
        "このテストには採点対象の設問枠がありません。"
      );


      setStatus(
        buildStatusText()
      );


      return;

    }


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
        box?.box_type ||
        ""
      )
        .trim()
        .toLowerCase();


    /*
     * answerだけ。
     *
     * question_idがないものは
     * 大問・小計・合計等の可能性があるため除外。
     */

    if (
      type !==
      "answer"
    ) {

      return false;

    }


    return Boolean(
      box.question_id
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
            formatPoints(
              box?.points
            )
          }点`;


        const statusLine =
          document.createElement(
            "div"
          );


        statusLine.className =
          "question-status";


        statusLine.textContent =
          score &&
          score.status ===
            "marked"
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

    if (!answerViewer) {

      return;

    }


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
        box.id
      );


    const card =
      document.createElement(
        "div"
      );


    card.className =
      "answer-card";


    /*
     * HEADER
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
      `配点: ${formatPoints(
        box.points
      )}点`;


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
     * IMAGE
     *
     * Canvasを使わない。
     */

    const imageWrap =
      document.createElement(
        "div"
      );


    imageWrap.className =
      "region-image-wrap";


    try {

      const viewer =
        await createRegionViewer(
          region
        );


      imageWrap.appendChild(
        viewer
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

    }


    card.appendChild(
      imageWrap
    );


    /*
     * WARNING
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
     * MARK TOOLBAR
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
     * SCORE
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
     * MARK BUTTONS
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


    document
      .getElementById(
        "setScoreButton"
      )
      ?.addEventListener(
        "click",
        setScoreFromInput
      );


    document
      .getElementById(
        "clearScoreButton"
      )
      ?.addEventListener(
        "click",
        clearCurrentScore
      );


    /*
     * crop viewer内クリック
     */

    const cropViewer =
      imageWrap.querySelector(
        ".answer-crop-viewer"
      );


    cropViewer?.addEventListener(
      "click",
      event => {

        if (!selectedMarkType) {

          return;

        }


        createMarkAtViewer(
          event,
          cropViewer,
          selectedMarkType
        );

      }
    );

  }


  /* =======================================================
     CREATE REGION VIEWER
     
     Canvasなし。
     signed URLの画像を直接表示。
  ======================================================= */

  async function createRegionViewer(
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
        `答案画像URLの取得に失敗しました: ${error.message}`
      );

    }


    if (!data?.signedUrl) {

      throw new Error(
        "答案画像URLを取得できませんでした。"
      );

    }


    /*
     * crop container
     */

    const viewer =
      document.createElement(
        "div"
      );


    viewer.className =
      "answer-crop-viewer";


    viewer.style.position =
      "relative";


    viewer.style.overflow =
      "hidden";


    viewer.style.background =
      "#fff";


    viewer.style.margin =
      "0 auto";


    viewer.style.cursor =
      "crosshair";


    viewer.style.border =
      "1px solid #d5dbe0";


    /*
     * 元画像
     */

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


    image.style.position =
      "absolute";


    image.style.maxWidth =
      "none";


    image.style.maxHeight =
      "none";


    image.style.margin =
      "0";


    /*
     * ロード待ち
     */

    await waitForImage(
      image
    );


    /*
     * 登録画像サイズ
     */

    const pageWidth =
      Number(
        page.width_px
      ) ||
      image.naturalWidth;


    const pageHeight =
      Number(
        page.height_px
      ) ||
      image.naturalHeight;


    /*
     * 座標
     */

    const x =
      Number(
        region.x
      ) || 0;


    const y =
      Number(
        region.y
      ) || 0;


    const width =
      Math.max(
        1,
        Number(
          region.width
        ) || 1
      );


    const height =
      Math.max(
        1,
        Number(
          region.height
        ) || 1
      );


    /*
     * 実画像への倍率
     */

    const scaleX =
      image.naturalWidth /
      pageWidth;


    const scaleY =
      image.naturalHeight /
      pageHeight;


    const cropWidth =
      width *
      scaleX;


    const cropHeight =
      height *
      scaleY;


    /*
     * 表示幅
     */

    const displayWidth =
      Math.min(
        900,
        Math.max(
          400,
          cropWidth
        )
      );


    const displayScale =
      displayWidth /
      cropWidth;


    const displayHeight =
      cropHeight *
      displayScale;


    viewer.style.width =
      `${displayWidth}px`;


    viewer.style.height =
      `${Math.max(
        100,
        displayHeight
      )}px`;


    /*
     * 画像全体を表示倍率で配置
     */

    image.style.width =
      `${image.naturalWidth *
        displayScale}px`;


    image.style.height =
      `${image.naturalHeight *
        displayScale}px`;


    image.style.left =
      `${-x *
        scaleX *
        displayScale}px`;


    image.style.top =
      `${-y *
        scaleY *
        displayScale}px`;


    /*
     * データ保持
     *
     * 採点記号の座標計算用。
     */

    viewer.dataset.cropX =
      String(x);

    viewer.dataset.cropY =
      String(y);

    viewer.dataset.cropWidth =
      String(width);

    viewer.dataset.cropHeight =
      String(height);

    viewer.dataset.scaleX =
      String(scaleX);

    viewer.dataset.scaleY =
      String(scaleY);

    viewer.dataset.displayScale =
      String(displayScale);


    viewer.appendChild(
      image
    );


    return viewer;

  }


  /* =======================================================
     IMAGE WAIT
  ======================================================= */

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
          image.naturalWidth > 0
        ) {

          resolve();

          return;

        }


        image.onload =
          () =>
            resolve();


        image.onerror =
          () =>
            reject(
              new Error(
                "答案画像を読み込めませんでした。"
              )
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

      event.preventDefault();


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


      return;

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


  function createMarkAtViewer(
    event,
    viewer,
    type
  ) {

    const rect =
      viewer.getBoundingClientRect();


    const cropX =
      Number(
        viewer.dataset.cropX
      ) || 0;


    const cropY =
      Number(
        viewer.dataset.cropY
      ) || 0;


    const scaleX =
      Number(
        viewer.dataset.scaleX
      ) || 1;


    const scaleY =
      Number(
        viewer.dataset.scaleY
      ) || 1;


    const displayScale =
      Number(
        viewer.dataset.displayScale
      ) || 1;


    /*
     * viewer上の座標
     */

    const viewerX =
      event.clientX -
      rect.left;


    const viewerY =
      event.clientY -
      rect.top;


    /*
     * 実画像座標。
     *
     * crop領域左上からの位置。
     */

    const x =
      viewerX /
        displayScale /
        scaleX +
      cropX;


    const y =
      viewerY /
        displayScale /
        scaleY +
      cropY;


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
       * 既存score
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
       * UPDATE
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

      }


      /*
       * INSERT
       */

      else {

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
       * MARK OBJECTS
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
       * ここでは公開状態へ変更しない。
       *
       * 全問完了でも成績・偏差値・順位が
       * 完了していないため。
       */

      const allMarked =
        await isAllQuestionsMarked();


      /*
       * 採点途中なら marking。
       *
       * 全問終わっていても、ここでは
       * marked にしない。
       */

      const {
        error:
          statusError
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
            answerSheetId
          );


      if (statusError) {

        throw new Error(
          `答案状態の更新に失敗しました: ${statusError.message}`
        );

      }


      await loadAnswer();


      if (allMarked) {

        setStatus(
          `${getStudentText()} - 全設問の採点完了。成績処理待ちです。`
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
     STATUS
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


  function getAnswerStatusText(
    status
  ) {

    switch (
      String(
        status ||
        ""
      ).toLowerCase()
    ) {

      case "matched":
        return "採点前";

      case "uploaded":
        return "採点前";

      case "marking":
        return "採点中";

      case "marked":
        return "採点完了";

      default:
        return status || "未処理";

    }

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
     POINTS
  ======================================================= */

  function formatPoints(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return "0";

    }


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


    return String(
      number
    );

  }


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
     CLEAR
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


  function createMarkAtViewer(
    event,
    viewer,
    type
  ) {

    const rect =
      viewer.getBoundingClientRect();


    const cropX =
      Number(
        viewer.dataset.cropX
      ) || 0;


    const cropY =
      Number(
        viewer.dataset.cropY
      ) || 0;


    const scaleX =
      Number(
        viewer.dataset.scaleX
      ) || 1;


    const scaleY =
      Number(
        viewer.dataset.scaleY
      ) || 1;


    const displayScale =
      Number(
        viewer.dataset.displayScale
      ) || 1;


    const viewerX =
      event.clientX -
      rect.left;


    const viewerY =
      event.clientY -
      rect.top;


    const x =
      cropX +
      viewerX /
        displayScale /
        scaleX;


    const y =
      cropY +
      viewerY /
        displayScale /
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


  /* =======================================================
     ERROR
  ======================================================= */

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


  function setStatus(
    message
  ) {

    if (statusElement) {

      statusElement.textContent =
        message;

    }

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
