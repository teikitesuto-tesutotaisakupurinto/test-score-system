
/* =========================================================
   テスト成績システム
   js/teacher/marking.js

   テスト単位採点

   答案選択:
     なし

   流れ:
     テスト選択
       ↓
     採点開始
       ↓
     問1の全答案
       ↓
     問2の全答案
       ↓
     ...
       ↓
     全設問完了

   答案画像:
     answer_sheet_pages
       ↓
     answer-files
       ↓
     signed URL
       ↓
     img
       ↓
     CSS crop

   Canvas / toBlob:
     答案表示には使用しない。

   重要:
     answer_sheets.status = matched
       = 生徒紐付け済み

     marking
       = 採点作業中

     marked
       = このファイルでは設定しない。

     成績・偏差値・順位が完了するまで
     公開しない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let testId = null;

  let test = null;

  let answers = [];

  let students = new Map();

  let pages = new Map();

  let boxes = [];

  let questions = [];

  let scores = [];

  let currentQuestionIndex = 0;

  let started = false;

  let saving = false;


  /* =======================================================
     DOM
  ======================================================= */

  const teacherName =
    document.getElementById(
      "teacherName"
    );

  const testSelect =
    document.getElementById(
      "testSelect"
    );

  const startButton =
    document.getElementById(
      "startButton"
    );

  const refreshButton =
    document.getElementById(
      "refreshButton"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const progressArea =
    document.getElementById(
      "progressArea"
    );

  const progressBar =
    document.getElementById(
      "progressBar"
    );

  const progressText =
    document.getElementById(
      "progressText"
    );

  const questionArea =
    document.getElementById(
      "questionArea"
    );

  const questionTitle =
    document.getElementById(
      "questionTitle"
    );

  const questionMeta =
    document.getElementById(
      "questionMeta"
    );

  const previousButton =
    document.getElementById(
      "previousButton"
    );

  const nextButton =
    document.getElementById(
      "nextButton"
    );

  const answerTableWrap =
    document.getElementById(
      "answerTableWrap"
    );

  const completeArea =
    document.getElementById(
      "completeArea"
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


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      setupEvents();


      await loadTests();


    } catch (error) {

      console.error(
        "marking initialize:",
        error
      );


      showStatus(
        error.message ||
        "採点画面を初期化できませんでした。",
        true
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
      "change",
      () => {

        testId =
          testSelect.value ||
          null;


        resetTestState();


        if (!testId) {

          showStatus(
            "テストを選択してください。"
          );

          return;

        }


        showStatus(
          "採点開始を押してください。"
        );

      }
    );


    startButton?.addEventListener(
      "click",
      startMarking
    );


    refreshButton?.addEventListener(
      "click",
      async () => {

        if (testId) {

          await loadTestData();

          if (started) {

            renderCurrentQuestion();

          }

        } else {

          await loadTests();

        }

      }
    );


    previousButton?.addEventListener(
      "click",
      async () => {

        if (
          currentQuestionIndex <= 0
        ) {

          return;

        }


        currentQuestionIndex--;

        await renderCurrentQuestion();

      }
    );


    nextButton?.addEventListener(
      "click",
      async () => {

        await nextQuestion();

      }
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
     TESTS
  ======================================================= */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name,
          created_at
          `
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {

      throw new Error(
        `テスト一覧の取得に失敗しました: ${error.message}`
      );

    }


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

    `;


    for (
      const item
      of data || []
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item.id;


      option.textContent =
        [
          item.name,
          item.subject,
          item.grade
        ]
          .filter(
            value =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== ""
          )
          .join(
            " / "
          );


      testSelect.appendChild(
        option
      );

    }

  }


  /* =======================================================
     START MARKING
  ======================================================= */

  async function startMarking() {

    if (!testId) {

      showStatus(
        "テストを選択してください。",
        true
      );

      return;

    }


    if (started) {

      currentQuestionIndex =
        0;

      await renderCurrentQuestion();

      return;

    }


    setBusy(
      true
    );


    try {

      showStatus(
        "テスト全体の採点データを読み込んでいます..."
      );


      await loadTestData();


      if (!answers.length) {

        throw new Error(
          "このテストには答案が登録されていません。"
        );

      }


      if (!questions.length) {

        throw new Error(
          "このテストには採点対象の設問がありません。"
        );

      }


      started =
        true;


      currentQuestionIndex =
        0;


      questionArea.classList.add(
        "show"
      );


      progressArea.classList.add(
        "show"
      );


      startButton.textContent =
        "採点中";


      await renderCurrentQuestion();


    } catch (error) {

      console.error(
        error
      );


      showStatus(
        error.message ||
        "採点を開始できませんでした。",
        true
      );


    } finally {

      setBusy(
        false
      );

    }

  }


  /* =======================================================
     LOAD TEST DATA
  ======================================================= */

  async function loadTestData() {

    /*
     * -----------------------------------------------------
     * TEST
     * -----------------------------------------------------
     */

    const {
      data: testData,
      error: testError
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name
          `
        )
        .eq(
          "id",
          testId
        )
        .single();


    if (testError) {

      throw new Error(
        `テスト情報の取得に失敗しました: ${testError.message}`
      );

    }


    test =
      testData;


    /*
     * -----------------------------------------------------
     * ANSWERS
     * -----------------------------------------------------
     */

    const {
      data: answerData,
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
          page_count,
          qr_value,
          status,
          uploaded_at
          `
        )
        .eq(
          "test_id",
          testId
        )
        .order(
          "uploaded_at",
          {
            ascending:
              true
          }
        );


    if (answerError) {

      throw new Error(
        `答案の取得に失敗しました: ${answerError.message}`
      );

    }


    answers =
      answerData || [];


    /*
     * -----------------------------------------------------
     * STUDENTS
     * -----------------------------------------------------
     */

    students =
      new Map();


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


      for (
        const student
        of studentData || []
      ) {

        students.set(
          student.id,
          student
        );

      }

    }


    /*
     * -----------------------------------------------------
     * ANSWER PAGES
     * -----------------------------------------------------
     */

    pages =
      new Map();


    const answerIds =
      answers.map(
        answer =>
          answer.id
      );


    if (answerIds.length) {

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
          .in(
            "answer_sheet_id",
            answerIds
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


      for (
        const page
        of pageData || []
      ) {

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

    }


    /*
     * -----------------------------------------------------
     * LAYOUT BOXES
     * -----------------------------------------------------
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
        `設問枠の取得に失敗しました: ${boxError.message}`
      );

    }


    boxes =
      boxData || [];


    /*
     * -----------------------------------------------------
     * QUESTIONS
     * -----------------------------------------------------
     *
     * answer + question_idあり
     *
     * QR/name/student_no/other除外
     */

    questions =
      boxes
        .filter(
          box =>
            String(
              box.box_type ||
              ""
            )
              .trim()
              .toLowerCase() ===
              "answer" &&
            Boolean(
              box.question_id
            )
        )
        .map(
          box => ({

            id:
              box.id,

            label:
              box.label ||
              "設問",

            pageNo:
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
              ),

            questionId:
              box.question_id,

            points:
              Number(
                box.points
              ) || 0

          })
        );


    /*
     * -----------------------------------------------------
     * SCORES
     * -----------------------------------------------------
     */

    scores =
      [];


    if (answerIds.length) {

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
          .in(
            "answer_sheet_id",
            answerIds
          );


      if (scoreError) {

        throw new Error(
          `採点結果の取得に失敗しました: ${scoreError.message}`
        );

      }


      scores =
        scoreData || [];

    }


    updateProgress();

  }


  /* =======================================================
     RENDER CURRENT QUESTION
  ======================================================= */

  async function renderCurrentQuestion() {

    if (!questions.length) {

      return;

    }


    const question =
      questions[
        currentQuestionIndex
      ];


    questionTitle.textContent =
      question.label;


    questionMeta.textContent =
      `配点 ${formatNumber(
        question.points
      )}点 / 問題 ${
        currentQuestionIndex + 1
      } / ${
        questions.length
      }`;


    previousButton.disabled =
      currentQuestionIndex <=
      0;


    nextButton.textContent =
      currentQuestionIndex >=
        questions.length - 1
        ? "採点完了確認"
        : "次の問題";


    updateProgress();


    answerTableWrap.innerHTML = `

      <div class="empty">
        答案を表示しています...
      </div>

    `;


    const table =
      document.createElement(
        "table"
      );


    table.className =
      "answer-table";


    table.innerHTML = `

      <thead>

        <tr>

          <th class="student-cell">
            生徒
          </th>

          <th class="answer-cell">
            答案
          </th>

          <th class="score-cell">
            得点
          </th>

          <th>
            状態
          </th>

        </tr>

      </thead>

      <tbody></tbody>

    `;


    const tbody =
      table.querySelector(
        "tbody"
      );


    /*
     * 同じ問題について
     * 全答案を表示。
     */

    for (
      const answer
      of answers
    ) {

      const row =
        await createAnswerRow(
          answer,
          question
        );


      tbody.appendChild(
        row
      );

    }


    answerTableWrap.innerHTML =
      "";


    answerTableWrap.appendChild(
      table
    );


    showStatus(
      `${test.name} / ${question.label} を採点中`
    );

  }


  /* =======================================================
     ANSWER ROW
  ======================================================= */

  async function createAnswerRow(
    answer,
    question
  ) {

    const row =
      document.createElement(
        "tr"
      );


    /*
     * STUDENT
     */

    const studentCell =
      document.createElement(
        "td"
      );


    studentCell.className =
      "student-cell";


    const student =
      students.get(
        answer.student_id
      );


    const studentNo =
      document.createElement(
        "div"
      );


    studentNo.className =
      "student-no";


    studentNo.textContent =
      student?.student_no ||
      "未紐付け";


    const studentName =
      document.createElement(
        "div"
      );


    studentName.className =
      "student-name";


    studentName.textContent =
      student?.name ||
      "";


    studentCell.appendChild(
      studentNo
    );


    studentCell.appendChild(
      studentName
    );


    /*
     * ANSWER IMAGE
     */

    const answerCell =
      document.createElement(
        "td"
      );


    answerCell.className =
      "answer-cell";


    try {

      const viewer =
        await createAnswerViewer(
          answer,
          question
        );


      answerCell.appendChild(
        viewer
      );


    } catch (error) {

      const missing =
        document.createElement(
          "div"
        );


      missing.className =
        "answer-missing";


      missing.textContent =
        error.message ||
        "答案画像を表示できません。";


      answerCell.appendChild(
        missing
      );

    }


    /*
     * SCORE
     */

    const scoreCell =
      document.createElement(
        "td"
      );


    scoreCell.className =
      "score-cell";


    const existingScore =
      findScore(
        answer.id,
        question.id
      );


    const input =
      document.createElement(
        "input"
      );


    input.type =
      "number";


    input.step =
      "0.1";


    input.min =
      "0";


    input.max =
      String(
        question.points
      );


    input.className =
      "score-input";


    input.value =
      existingScore
        ? existingScore.score
        : "";


    input.dataset.answerId =
      answer.id;


    input.dataset.questionId =
      question.id;


    const save =
      document.createElement(
        "button"
      );


    save.type =
      "button";


    save.className =
      "btn btn-primary score-save-button";


    save.textContent =
      "保存";


    const warning =
      document.createElement(
        "div"
      );


    warning.className =
      "warning";


    const state =
      document.createElement(
        "div"
      );


    state.className =
      "score-state";


    if (
      existingScore &&
      existingScore.status ===
        "marked"
    ) {

      state.textContent =
        "採点済み";


      state.classList.add(
        "marked"
      );

    } else {

      state.textContent =
        "未採点";

    }


    input.addEventListener(
      "input",
      () => {

        validateInput(
          input,
          warning,
          question.points
        );

      }
    );


    save.addEventListener(
      "click",
      async () => {

        await saveQuestionScore(
          answer,
          question,
          input,
          warning,
          state
        );

      }
    );


    scoreCell.appendChild(
      input
    );


    scoreCell.appendChild(
      document.createElement(
        "br"
      )
    );


    scoreCell.appendChild(
      save
    );


    scoreCell.appendChild(
      state
    );


    scoreCell.appendChild(
      warning
    );


    /*
     * STATUS
     */

    const statusCell =
      document.createElement(
        "td"
      );


    const current =
      findScore(
        answer.id,
        question.id
      );


    if (
      current &&
      current.status ===
        "marked"
    ) {

      statusCell.textContent =
        "採点済み";


      statusCell.className =
        "marked";

    } else {

      statusCell.textContent =
        "未採点";


      statusCell.className =
        "unmarked";

    }


    row.appendChild(
      studentCell
    );


    row.appendChild(
      answerCell
    );


    row.appendChild(
      scoreCell
    );


    row.appendChild(
      statusCell
    );


    return row;

  }


  /* =======================================================
     ANSWER VIEWER
  ======================================================= */

  async function createAnswerViewer(
    answer,
    question
  ) {

    const answerPages =
      pages.get(
        answer.id
      ) || [];


    const page =
      answerPages.find(
        item =>
          Number(
            item.page_no
          ) ===
          Number(
            question.pageNo
          )
      );


    if (!page) {

      throw new Error(
        `答案ページ ${question.pageNo} がありません。`
      );

    }


    if (!page.file_path) {

      throw new Error(
        "答案画像のStorageパスがありません。"
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
        `答案画像を取得できません: ${error.message}`
      );

    }


    if (!data?.signedUrl) {

      throw new Error(
        "答案画像URLを取得できません。"
      );

    }


    const viewer =
      document.createElement(
        "div"
      );


    viewer.className =
      "answer-viewer";


    /*
     * 画像
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


    await waitForImage(
      image
    );


    /*
     * ページ登録サイズ
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
     * 実画像倍率
     */

    const scaleX =
      image.naturalWidth /
      pageWidth;


    const scaleY =
      image.naturalHeight /
      pageHeight;


    const x =
      Number(
        question.x
      ) || 0;


    const y =
      Number(
        question.y
      ) || 0;


    const width =
      Math.max(
        1,
        Number(
          question.width
        ) || 1
      );


    const height =
      Math.max(
        1,
        Number(
          question.height
        ) || 1
      );


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
        500,
        Math.max(
          350,
          cropWidth
        )
      );


    const displayScale =
      displayWidth /
      cropWidth;


    const displayHeight =
      Math.max(
        150,
        cropHeight *
        displayScale
      );


    viewer.style.height =
      `${displayHeight}px`;


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


    viewer.appendChild(
      image
    );


    return viewer;

  }


  /* =======================================================
     SAVE SCORE
  ======================================================= */

  async function saveQuestionScore(
    answer,
    question,
    input,
    warning,
    state
  ) {

    if (saving) {

      return;

    }


    const value =
      Number(
        input.value
      );


    /*
     * 配点チェック
     */

    if (
      input.value === ""
    ) {

      warning.textContent =
        "点数を入力してください。";


      warning.classList.add(
        "show"
      );


      return;

    }


    if (
      !Number.isFinite(
        value
      )
    ) {

      warning.textContent =
        "点数が不正です。";


      warning.classList.add(
        "show"
      );


      return;

    }


    if (
      value < 0
    ) {

      warning.textContent =
        "0点未満にはできません。";


      warning.classList.add(
        "show"
      );


      return;

    }


    if (
      value >
      question.points
    ) {

      warning.textContent =
        `配点 ${question.points}点を超えています。`;


      warning.classList.add(
        "show"
      );


      return;

    }


    warning.classList.remove(
      "show"
    );


    saving =
      true;


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
            answer.id
          )
          .eq(
            "layout_box_id",
            question.id
          )
          .maybeSingle();


      if (existingError) {

        throw new Error(
          `既存採点確認に失敗しました: ${existingError.message}`
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
                question.questionId,

              score:
                value,

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

      }


      /*
       * INSERT
       */

      else {

        const {
          error
        } =
          await supabaseClient
            .from(
              "scores"
            )
            .insert({

              answer_sheet_id:
                answer.id,

              layout_box_id:
                question.id,

              question_id:
                question.questionId,

              score:
                value,

              status:
                "marked",

              marked_at:
                new Date().toISOString()

            });


        if (error) {

          throw new Error(
            `採点登録に失敗しました: ${error.message}`
          );

        }

      }


      /*
       * ローカル更新
       */

      const local =
        scores.find(
          item =>
            item.answer_sheet_id ===
              answer.id &&
            item.layout_box_id ===
              question.id
        );


      if (local) {

        local.score =
          value;

        local.status =
          "marked";

      } else {

        scores.push({

          id:
            existing?.id ||
            crypto.randomUUID(),

          answer_sheet_id:
            answer.id,

          layout_box_id:
            question.id,

          question_id:
            question.questionId,

          score:
            value,

          status:
            "marked"

        });

      }


      state.textContent =
        "採点済み";


      state.className =
        "score-state marked";


      showStatus(
        `${getStudentLabel(
          answer
        )} / ${question.label} を保存しました。`
      );


      updateProgress();


    } catch (error) {

      console.error(
        error
      );


      warning.textContent =
        error.message ||
        "採点を保存できませんでした。";


      warning.classList.add(
        "show"
      );


      state.textContent =
        "保存失敗";


      state.className =
        "score-state error";

    } finally {

      saving =
        false;

    }

  }


  /* =======================================================
     VALIDATE
  ======================================================= */

  function validateInput(
    input,
    warning,
    max
  ) {

    const value =
      Number(
        input.value
      );


    if (
      input.value === ""
    ) {

      warning.classList.remove(
        "show"
      );

      return;

    }


    if (
      !Number.isFinite(
        value
      ) ||
      value < 0 ||
      value > max
    ) {

      warning.textContent =
        `0〜${max}点で入力してください。`;


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
     NEXT QUESTION
  ======================================================= */

  async function nextQuestion() {

    /*
     * 現在問題の未採点確認
     */

    const current =
      questions[
        currentQuestionIndex
      ];


    const complete =
      isQuestionComplete(
        current
      );


    if (!complete) {

      const proceed =
        window.confirm(
          "この問題には未採点の答案があります。このまま次へ進みますか？"
        );


      if (!proceed) {

        return;

      }

    }


    if (
      currentQuestionIndex >=
      questions.length - 1
    ) {

      await finishMarkingCheck();

      return;

    }


    currentQuestionIndex++;


    await renderCurrentQuestion();

  }


  /* =======================================================
     QUESTION COMPLETE
  ======================================================= */

  function isQuestionComplete(
    question
  ) {

    if (!question) {

      return false;

    }


    return answers.every(
      answer => {

        const score =
          findScore(
            answer.id,
            question.id
          );


        return Boolean(
          score &&
          score.status ===
            "marked"
        );

      }
    );

  }


  /* =======================================================
     FINISH CHECK
  ======================================================= */

  async function finishMarkingCheck() {

    const allComplete =
      questions.every(
        question =>
          isQuestionComplete(
            question
          )
      );


    if (!allComplete) {

      const incomplete =
        questions.filter(
          question =>
            !isQuestionComplete(
              question
            )
        );


      showStatus(
        `未採点の設問があります。残り ${incomplete.length}問です。`,
        true
      );


      return;

    }


    /*
     * 全答案・全設問採点完了。
     *
     * ここでは公開しない。
     */

    completeArea.classList.add(
      "show"
    );


    showStatus(
      "全答案・全設問の採点が完了しました。成績処理待ちです。"
    );


    updateProgress(
      100
    );


    nextButton.disabled =
      true;

  }


  /* =======================================================
     PROGRESS
  ======================================================= */

  function updateProgress() {

    if (
      !answers.length ||
      !questions.length
    ) {

      return;

    }


    let marked =
      0;


    const total =
      answers.length *
      questions.length;


    for (
      const answer
      of answers
    ) {

      for (
        const question
        of questions
      ) {

        const score =
          findScore(
            answer.id,
            question.id
          );


        if (
          score &&
          score.status ===
            "marked"
        ) {

          marked++;

        }

      }

    }


    const percent =
      total > 0
        ? Math.round(
            marked /
            total *
            100
          )
        : 0;


    progressBar.style.width =
      `${percent}%`;


    progressText.textContent =
      `${marked} / ${total} 設問答案を採点済み (${percent}%)`;

  }


  /* =======================================================
     FIND SCORE
  ======================================================= */

  function findScore(
    answerId,
    questionId
  ) {

    return scores.find(
      score =>
        score.answer_sheet_id ===
          answerId &&
        score.layout_box_id ===
          questionId
    ) || null;

  }


  /* =======================================================
     STUDENT
  ======================================================= */

  function getStudentLabel(
    answer
  ) {

    const student =
      students.get(
        answer.student_id
      );


    if (!student) {

      return "未紐付け";

    }


    return `${student.student_no || ""} / ${student.name || ""}`.trim();

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
     STATUS
  ======================================================= */

  function showStatus(
    text,
    error = false
  ) {

    if (!statusElement) {

      return;

    }


    statusElement.textContent =
      text;


    statusElement.style.color =
      error
        ? "#b42318"
        : "#333";

  }


  /* =======================================================
     BUSY
  ======================================================= */

  function setBusy(
    busy
  ) {

    if (testSelect) {

      testSelect.disabled =
        busy;

    }


    if (startButton) {

      startButton.disabled =
        busy;

    }


    if (refreshButton) {

      refreshButton.disabled =
        busy;

    }

  }


  /* =======================================================
     RESET
  ======================================================= */

  function resetTestState() {

    test =
      null;

    answers =
      [];

    students =
      new Map();

    pages =
      new Map();

    boxes =
      [];

    questions =
      [];

    scores =
      [];

    currentQuestionIndex =
      0;

    started =
      false;


    questionArea?.classList.remove(
      "show"
    );


    completeArea?.classList.remove(
      "show"
    );


    progressArea?.classList.remove(
      "show"
    );


    answerTableWrap.innerHTML = `

      <div class="empty">
        テストを選択してください。
      </div>

    `;


    if (startButton) {

      startButton.textContent =
        "採点開始";

    }

  }


  /* =======================================================
     NUMBER
  ======================================================= */

  function formatNumber(
    value
  ) {

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


    return Number.isInteger(
      number
    )
      ? String(
          number
        )
      : number.toFixed(
          1
        );

  }


})();
