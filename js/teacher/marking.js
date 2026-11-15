
"use strict";

/* =========================================================
   テスト成績システム
   テスト単位採点
========================================================= */

(function () {

  let DB = null;

  let testId = null;
  let test = null;

  let answers = [];
  let students = new Map();
  let pages = new Map();

  let questions = [];
  let scores = [];

  let questionIndex = 0;
  let saving = false;


  /* =======================================================
     DOM
  ======================================================= */

  const status =
    document.getElementById("status");

  const teacherName =
    document.getElementById("teacherName");

  const tableWrap =
    document.getElementById("answerTableWrap");

  const questionTitle =
    document.getElementById("questionTitle");

  const questionMeta =
    document.getElementById("questionMeta");

  const previousButton =
    document.getElementById("previousButton");

  const nextButton =
    document.getElementById("nextButton");

  const refreshButton =
    document.getElementById("refreshButton");

  const progress =
    document.getElementById("progress");

  const progressBar =
    document.getElementById("progressBar");

  const progressText =
    document.getElementById("progressText");

  const complete =
    document.getElementById("complete");


  /* =======================================================
     START
  ======================================================= */

  async function start() {

    try {

      setStatus(
        "採点画面を起動しています..."
      );


      /*
       * Supabase
       */

      DB =
        window.SB ||
        window.supabaseClient;


      if (!DB) {

        throw new Error(
          "Supabase接続がありません。config.jsを確認してください。"
        );

      }


      /*
       * URL
       */

      const params =
        new URLSearchParams(
          location.search
        );


      testId =
        params.get("test");


      if (!testId) {

        throw new Error(
          "テストIDがありません。採点一覧から採点開始してください。"
        );

      }


      /*
       * 認証
       */

      if (
        typeof window.requireRole ===
        "function"
      ) {

        const result =
          await window.requireRole(
            "teacher"
          );


        if (result) {

          const profile =
            result.profile ||
            result;


          if (teacherName) {

            teacherName.textContent =
              profile.name ||
              "先生";

          }

        }

      }


      setupEvents();


      await loadTest();


    } catch (error) {

      console.error(
        error
      );


      fatal(
        error.message ||
        "採点画面を起動できませんでした。"
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    previousButton?.addEventListener(
      "click",
      async () => {

        if (
          questionIndex <= 0
        ) {

          return;

        }

        questionIndex--;

        await renderQuestion();

      }
    );


    nextButton?.addEventListener(
      "click",
      async () => {

        await nextQuestion();

      }
    );


    refreshButton?.addEventListener(
      "click",
      async () => {

        await loadTest();

      }
    );


    document
      .getElementById("logoutButton")
      ?.addEventListener(
        "click",
        async () => {

          if (
            typeof window.logout ===
            "function"
          ) {

            await window.logout();

          } else if (
            typeof window.signOut ===
            "function"
          ) {

            await window.signOut();

          }

        }
      );

  }


  /* =======================================================
     LOAD TEST
  ======================================================= */

  async function loadTest() {

    setStatus(
      "テストを読み込んでいます..."
    );


    const testResult =
      await DB
        .from("tests")
        .select(`
          id,
          name,
          subject,
          grade,
          class_name
        `)
        .eq(
          "id",
          testId
        )
        .maybeSingle();


    if (testResult.error) {

      throw new Error(
        testResult.error.message
      );

    }


    if (!testResult.data) {

      throw new Error(
        "テストが見つかりません。"
      );

    }


    test =
      testResult.data;


    setStatus(
      "答案を読み込んでいます..."
    );


    const answerResult =
      await DB
        .from("answer_sheets")
        .select(`
          id,
          test_id,
          student_id,
          page_count,
          qr_value,
          status,
          uploaded_at
        `)
        .eq(
          "test_id",
          testId
        )
        .order(
          "uploaded_at",
          {
            ascending: true
          }
        );


    if (answerResult.error) {

      throw new Error(
        answerResult.error.message
      );

    }


    answers =
      answerResult.data ||
      [];


    if (!answers.length) {

      throw new Error(
        "このテストには答案がありません。"
      );

    }


    setStatus(
      "生徒情報を読み込んでいます..."
    );


    await loadStudents();


    setStatus(
      "答案ページを読み込んでいます..."
    );


    await loadPages();


    setStatus(
      "採点問題を読み込んでいます..."
    );


    await loadQuestions();


    setStatus(
      "採点結果を読み込んでいます..."
    );


    await loadScores();


    questionIndex =
      0;


    progress?.classList.add(
      "show"
    );


    await renderQuestion();


    setStatus(
      `${test.name} / ${answers.length}答案 / ${questions.length}問`
    );

  }


  /* =======================================================
     STUDENTS
  ======================================================= */

  async function loadStudents() {

    students =
      new Map();


    const ids =
      [
        ...new Set(
          answers
            .map(
              answer =>
                answer.student_id
            )
            .filter(Boolean)
        )
      ];


    if (!ids.length) {

      return;

    }


    const result =
      await DB
        .from("students")
        .select(`
          id,
          student_no,
          name
        `)
        .in(
          "id",
          ids
        );


    if (result.error) {

      throw new Error(
        result.error.message
      );

    }


    for (
      const student
      of result.data ||
      []
    ) {

      students.set(
        student.id,
        student
      );

    }

  }


  /* =======================================================
     PAGES
  ======================================================= */

  async function loadPages() {

    pages =
      new Map();


    const ids =
      answers.map(
        answer =>
          answer.id
      );


    const result =
      await DB
        .from("answer_sheet_pages")
        .select(`
          answer_sheet_id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
        `)
        .in(
          "answer_sheet_id",
          ids
        )
        .order(
          "page_no",
          {
            ascending: true
          }
        );


    if (result.error) {

      throw new Error(
        result.error.message
      );

    }


    for (
      const page
      of result.data ||
      []
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


  /* =======================================================
     QUESTIONS
  ======================================================= */

  async function loadQuestions() {

    const result =
      await DB
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
          question_id,
          points,
          created_at
        `)
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending: true
          }
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        );


    if (result.error) {

      throw new Error(
        result.error.message
      );

    }


    questions =
      (
        result.data ||
        []
      )
      .filter(
        box => {

          const type =
            String(
              box.box_type ||
              ""
            )
              .trim()
              .toLowerCase();


          return (
            type === "answer" &&
            box.question_id
          );

        }
      )
      .map(
        box => ({

          id:
            box.id,

          label:
            box.label ||
            "設問",

          questionId:
            box.question_id,

          pageNo:
            Number(
              box.page_no
            ),

          x:
            Number(
              box.x
            ) || 0,

          y:
            Number(
              box.y
            ) || 0,

          width:
            Number(
              box.width
            ) || 1,

          height:
            Number(
              box.height
            ) || 1,

          points:
            Number(
              box.points
            ) || 0

        })
      );


    if (!questions.length) {

      throw new Error(
        "採点対象の設問がありません。"
      );

    }

  }


  /* =======================================================
     SCORES
  ======================================================= */

  async function loadScores() {

    scores =
      [];


    const ids =
      answers.map(
        answer =>
          answer.id
      );


    const result =
      await DB
        .from("scores")
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status,
          marked_at
        `)
        .in(
          "answer_sheet_id",
          ids
        );


    if (result.error) {

      throw new Error(
        result.error.message
      );

    }


    scores =
      result.data ||
      [];

  }


  /* =======================================================
     QUESTION
  ======================================================= */

  async function renderQuestion() {

    const question =
      questions[
        questionIndex
      ];


    if (!question) {

      return;

    }


    questionTitle.textContent =
      question.label;


    questionMeta.textContent =
      `${test.name} / 配点 ${format(
        question.points
      )}点 / 問題 ${
        questionIndex + 1
      } / ${
        questions.length
      }`;


    previousButton.disabled =
      questionIndex <= 0;


    nextButton.disabled =
      false;


    nextButton.textContent =
      questionIndex >=
      questions.length - 1
        ? "採点完了確認"
        : "次の問題";


    answerTableWrap.innerHTML =
      "";


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
     * 全答案を一気に作る。
     */

    const rows =
      await Promise.all(
        answers.map(
          answer =>
            createRow(
              answer,
              question
            )
        )
      );


    rows.forEach(
      row =>
        tbody.appendChild(
          row
        )
    );


    answerTableWrap.appendChild(
      table
    );


    updateProgress();

  }


  /* =======================================================
     ROW
  ======================================================= */

  async function createRow(
    answer,
    question
  ) {

    const row =
      document.createElement(
        "tr"
      );


    /* ---------------------------------------------------
       Student
    --------------------------------------------------- */

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


    const no =
      document.createElement(
        "div"
      );


    no.className =
      "student-no";


    no.textContent =
      student?.student_no ||
      "未紐付け";


    const name =
      document.createElement(
        "div"
      );


    name.className =
      "student-name";


    name.textContent =
      student?.name ||
      "";


    studentCell.append(
      no,
      name
    );


    /* ---------------------------------------------------
       Answer
    --------------------------------------------------- */

    const answerCell =
      document.createElement(
        "td"
      );


    answerCell.className =
      "answer-cell";


    try {

      answerCell.appendChild(
        await createViewer(
          answer,
          question
        )
      );

    } catch (error) {

      const errorBox =
        document.createElement(
          "div"
        );


      errorBox.className =
        "answer-error";


      errorBox.textContent =
        error.message ||
        "答案画像を表示できません。";


      answerCell.appendChild(
        errorBox
      );

    }


    /* ---------------------------------------------------
       Score
    --------------------------------------------------- */

    const scoreCell =
      document.createElement(
        "td"
      );


    scoreCell.className =
      "score-cell";


    const existing =
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
      existing
        ? existing.score
        : "";


    const save =
      document.createElement(
        "button"
      );


    save.type =
      "button";


    save.className =
      "btn btn-primary score-save";


    save.textContent =
      "保存";


    const state =
      document.createElement(
        "div"
      );


    state.className =
      "score-state";


    state.textContent =
      existing &&
      existing.status ===
      "marked"
        ? "採点済み"
        : "未採点";


    if (
      existing &&
      existing.status ===
      "marked"
    ) {

      state.classList.add(
        "marked"
      );

    }


    const warning =
      document.createElement(
        "div"
      );


    warning.className =
      "warning";


    input.addEventListener(
      "input",
      () => {

        validate(
          input,
          warning,
          question.points
        );

      }
    );


    save.addEventListener(
      "click",
      async () => {

        await saveScore(
          answer,
          question,
          input,
          warning,
          state
        );

      }
    );


    scoreCell.append(
      input,
      document.createElement("br"),
      save,
      state,
      warning
    );


    /* ---------------------------------------------------
       Status
    --------------------------------------------------- */

    const statusCell =
      document.createElement(
        "td"
      );


    if (
      existing &&
      existing.status ===
      "marked"
    ) {

      statusCell.textContent =
        "採点済み";


      statusCell.style.color =
        "#1769aa";

    } else {

      statusCell.textContent =
        "未採点";


      statusCell.style.color =
        "#b42318";

    }


    row.append(
      studentCell,
      answerCell,
      scoreCell,
      statusCell
    );


    return row;

  }


  /* =======================================================
     VIEWER
  ======================================================= */

  async function createViewer(
    answer,
    question
  ) {

    const list =
      pages.get(
        answer.id
      ) ||
      [];


    const page =
      list.find(
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


    const result =
      await DB
        .storage
        .from(
          "answer-files"
        )
        .createSignedUrl(
          page.file_path,
          600
        );


    if (result.error) {

      throw new Error(
        result.error.message
      );

    }


    if (
      !result.data?.signedUrl
    ) {

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


    const image =
      document.createElement(
        "img"
      );


    image.src =
      result.data.signedUrl;


    image.alt =
      "答案";


    await waitImage(
      image
    );


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


    viewer.style.height =
      `${Math.max(
        150,
        cropHeight *
        displayScale
      )}px`;


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

  async function saveScore(
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


    if (
      input.value === ""
    ) {

      showWarning(
        warning,
        "点数を入力してください。"
      );

      return;

    }


    if (
      !Number.isFinite(
        value
      ) ||
      value < 0 ||
      value > question.points
    ) {

      showWarning(
        warning,
        `0〜${question.points}点で入力してください。`
      );

      return;

    }


    saving =
      true;


    try {

      const existing =
        findScore(
          answer.id,
          question.id
        );


      if (existing) {

        const result =
          await DB
            .from("scores")
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


        if (result.error) {

          throw new Error(
            result.error.message
          );

        }


        existing.score =
          value;


        existing.status =
          "marked";

      } else {

        const result =
          await DB
            .from("scores")
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

            })
            .select(
              "id"
            )
            .single();


        if (result.error) {

          throw new Error(
            result.error.message
          );

        }


        scores.push({

          id:
            result.data.id,

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


      warning.classList.remove(
        "show"
      );


      updateProgress();


    } catch (error) {

      console.error(
        error
      );


      state.textContent =
        "保存失敗";


      state.className =
        "score-state error";


      showWarning(
        warning,
        error.message ||
        "保存できませんでした。"
      );

    } finally {

      saving =
        false;

    }

  }


  /* =======================================================
     NEXT
  ======================================================= */

  async function nextQuestion() {

    const question =
      questions[
        questionIndex
      ];


    const complete =
      isQuestionComplete(
        question
      );


    if (!complete) {

      const ok =
        window.confirm(
          "未採点の答案があります。このまま次へ進みますか？"
        );


      if (!ok) {

        return;

      }

    }


    if (
      questionIndex >=
      questions.length - 1
    ) {

      finish();

      return;

    }


    questionIndex++;


    await renderQuestion();

  }


  /* =======================================================
     FINISH
  ======================================================= */

  function finish() {

    const completeAll =
      questions.every(
        question =>
          isQuestionComplete(
            question
          )
      );


    if (!completeAll) {

      showStatus(
        "まだ未採点の答案があります。",
        true
      );

      return;

    }


    complete?.classList.add(
      "show"
    );


    showStatus(
      "全答案・全設問の採点が完了しました。成績処理待ちです。"
    );


    nextButton.disabled =
      true;

  }


  /* =======================================================
     COMPLETE
  ======================================================= */

  function isQuestionComplete(
    question
  ) {

    return answers.every(
      answer => {

        const score =
          findScore(
            answer.id,
            question.id
          );


        return (
          score &&
          score.status ===
          "marked"
        );

      }
    );

  }


  /* =======================================================
     PROGRESS
  ======================================================= */

  function updateProgress() {

    const total =
      answers.length *
      questions.length;


    let done =
      0;


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

          done++;

        }

      }

    }


    const percent =
      total
        ? Math.round(
            done /
            total *
            100
          )
        : 0;


    if (progressBar) {

      progressBar.style.width =
        `${percent}%`;

    }


    if (progressText) {

      progressText.textContent =
        `${done} / ${total} 設問答案を採点済み (${percent}%)`;

    }

  }


  /* =======================================================
     FIND
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
    ) ||
    null;

  }


  /* =======================================================
     VALIDATE
  ======================================================= */

  function validate(
    input,
    warning,
    max
  ) {

    if (
      input.value === ""
    ) {

      warning.classList.remove(
        "show"
      );

      return;

    }


    const value =
      Number(
        input.value
      );


    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > max
    ) {

      showWarning(
        warning,
        `0〜${max}点で入力してください。`
      );

      return;

    }


    warning.classList.remove(
      "show"
    );

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  function waitImage(
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
          resolve;


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

  function setStatus(
    message,
    error = false
  ) {

    if (!status) {

      return;

    }


    status.textContent =
      message;


    status.style.color =
      error
        ? "#b42318"
        : "#333";

  }


  function showWarning(
    element,
    message
  ) {

    element.textContent =
      message;

    element.classList.add(
      "show"
    );

  }


  function fatal(
    message
  ) {

    setStatus(
      message,
      true
    );


    if (answerTableWrap) {

      answerTableWrap.innerHTML = `

        <div class="empty">

          ${escapeHtml(
            message
          )}

          <br><br>

          <a
            href="/teacher/marking"
            class="btn"
          >
            採点一覧へ戻る
          </a>

        </div>

      `;

    }

  }


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


  function format(
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


  /* =======================================================
     START
  ======================================================= */

  start();

})();
