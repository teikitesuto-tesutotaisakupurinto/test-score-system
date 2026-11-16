
"use strict";

/* =========================================================
   生徒用 成績結果

   公開条件
   ---------------------------------------------------------
   tests.results_published = true

   未確定
   ---------------------------------------------------------
   ・点数を表示しない
   ・採点済み答案を表示しない
   ・答案選択UIを表示しない

   確定後
   ---------------------------------------------------------
   ・合計点
   ・満点
   ・得点率
   ・設問別点数
   ・採点済み答案
========================================================= */

(function () {

  "use strict";


  const params =
    new URLSearchParams(
      location.search
    );


  const testId =
    params.get(
      "test"
    );


  let profile =
    null;

  let student =
    null;

  let test =
    null;

  let answer =
    null;

  let pages =
    [];

  let regions =
    [];

  let scores =
    [];

  let marks =
    [];

  let boxes =
    [];


  /* =====================================================
     INIT
  ===================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      if (!testId) {

        location.replace(
          "/student/tests"
        );

        return;

      }


      const auth =
        await requireStudent();


      if (!auth) {

        return;

      }


      profile =
        auth.profile;


      student =
        auth.student;


      const studentName =
        document.getElementById(
          "studentName"
        );


      if (studentName) {

        studentName.textContent =
          student.name ||
          profile.name ||
          "生徒";

      }


      await loadTest();


      /*
       * 非公開ならここで終了。
       */

      if (
        !test.results_published
      ) {

        renderWaiting();

        return;

      }


      await loadAnswer();


    } catch (error) {

      console.error(
        "student result:",
        error
      );


      showError(
        error.message ||
        "結果を表示できませんでした。"
      );

    }

  }


  /* =====================================================
     TEST
  ===================================================== */

  async function loadTest() {

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
          max_score,
          results_published,
          results_published_at
          `
        )
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


    test =
      data;


    renderTestInformation();

  }


  /* =====================================================
     TEST INFORMATION
  ===================================================== */

  function renderTestInformation() {

    const title =
      document.getElementById(
        "testName"
      );


    if (title) {

      title.textContent =
        test.name ||
        "";

    }


    const meta =
      document.getElementById(
        "testMeta"
      );


    if (meta) {

      meta.textContent =
        [
          test.subject
            ? `教科：${test.subject}`
            : "",

          test.grade
            ? `学年：${test.grade}`
            : "",

          test.class_name
            ? `クラス：${test.class_name}`
            : "",

          test.results_published_at
            ? `公開：${formatDate(
                test.results_published_at
              )}`
            : ""
        ]
          .filter(Boolean)
          .join(
            " ／ "
          );

    }

  }


  /* =====================================================
     WAITING
  ===================================================== */

  function renderWaiting() {

    const summary =
      document.getElementById(
        "resultSummary"
      );


    if (summary) {

      summary.innerHTML = `

        <div class="result-waiting">

          このテストの結果はまだ確定していません。

          <br><br>

          採点・成績処理が完了すると、
          自動的に結果が公開されます。

        </div>

      `;

    }


    const questionResults =
      document.getElementById(
        "questionResults"
      );


    if (questionResults) {

      questionResults.innerHTML =
        "";

    }


    const answerStatus =
      document.getElementById(
        "answerStatus"
      );


    if (answerStatus) {

      answerStatus.textContent =
        "結果確定前のため、答案・点数は表示されません。";

    }


    document
      .getElementById(
        "studentAnswerActions"
      )
      ?.classList.add(
        "hidden-before-publish"
      );


    document
      .getElementById(
        "markedAnswerCard"
      )
      ?.classList.add(
        "hidden-before-publish"
      );

  }


  /* =====================================================
     ANSWER
  ===================================================== */

  async function loadAnswer() {

    /*
     * 生徒IDはURLから受け取らない。
     */

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
          student_id,
          status,
          created_at
          `
        )
        .eq(
          "test_id",
          testId
        )
        .eq(
          "student_id",
          student.id
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(
          1
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      renderNoAnswer();

      return;

    }


    answer =
      data;


    await Promise.all([

      loadPages(),

      loadRegions(),

      loadScores(),

      loadMarks(),

      loadBoxes()

    ]);


    renderSummary();

    renderQuestionResults();

    setOriginalAnswerLink();

    await renderMarkedPages();

  }


  /* =====================================================
     PAGES
  ===================================================== */

  async function loadPages() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(
          `
          id,
          page_no,
          file_path,
          original_name,
          width_px,
          height_px
          `
        )
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    pages =
      data || [];

  }


  /* =====================================================
     REGIONS
  ===================================================== */

  async function loadRegions() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .select(
          `
          id,
          answer_sheet_id,
          layout_box_id,
          image_path,
          page_no,
          x,
          y,
          width,
          height
          `
        )
        .eq(
          "answer_sheet_id",
          answer.id
        );


    if (error) {

      throw error;

    }


    regions =
      data || [];

  }


  /* =====================================================
     SCORES
  ===================================================== */

  async function loadScores() {

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
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status
          `
        )
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .eq(
          "status",
          "marked"
        );


    if (error) {

      throw error;

    }


    scores =
      data || [];

  }


  /* =====================================================
     MARKS
  ===================================================== */

  async function loadMarks() {

    const {
      data,
      error
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
          points
          `
        )
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      /*
       * 採点記号が無くても
       * 点数結果は表示できる。
       */

      console.warn(
        "mark_objects:",
        error
      );


      marks =
        [];

      return;

    }


    marks =
      data || [];

  }


  /* =====================================================
     BOXES
  ===================================================== */

  async function loadBoxes() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(
          `
          id,
          page_no,
          label,
          points,
          x,
          y,
          width,
          height,
          box_type,
          sort_order
          `
        )
        .eq(
          "test_id",
          testId
        )
        .eq(
          "box_type",
          "answer"
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        )
        .order(
          "sort_order",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    const excluded =
      new Set([
        "QR",
        "氏名",
        "合計",
        "小計"
      ]);


    boxes =
      (data || [])
        .filter(
          box =>
            !excluded.has(
              String(
                box.label ||
                ""
              ).trim()
            )
        );

  }


  /* =====================================================
     SUMMARY
  ===================================================== */

  function renderSummary() {

    const element =
      document.getElementById(
        "resultSummary"
      );


    if (!element) {

      return;

    }


    const total =
      scores.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (
            Number(
              item.score
            ) || 0
          ),
        0
      );


    const max =
      boxes.reduce(
        (
          sum,
          box
        ) =>
          sum +
          (
            Number(
              box.points
            ) || 0
          ),
        0
      );


    const percentage =
      max > 0
        ? total /
          max *
          100
        : 0;


    element.innerHTML = `

      <div class="result-score-grid">


        <div class="result-score-card">

          <div class="result-score-label">
            合計点
          </div>

          <div class="result-score-value">
            ${formatNumber(
              total
            )}
          </div>

          <div class="result-score-sub">
            / ${formatNumber(
              max
            )}点
          </div>

        </div>


        <div class="result-score-card">

          <div class="result-score-label">
            得点率
          </div>

          <div class="result-score-value">
            ${percentage.toFixed(
              1
            )}%
          </div>

        </div>


      </div>

    `;

  }


  /* =====================================================
     QUESTION RESULTS
  ===================================================== */

  function renderQuestionResults() {

    const container =
      document.getElementById(
        "questionResults"
      );


    if (!container) {

      return;

    }


    if (!boxes.length) {

      container.textContent =
        "設問結果がありません。";

      return;

    }


    const scoreMap =
      new Map();


    scores.forEach(
      score => {

        scoreMap.set(
          score.layout_box_id,
          Number(
            score.score
          ) || 0
        );

      }
    );


    container.innerHTML = `

      <table
        class="question-results-table"
      >

        <thead>

          <tr>

            <th>
              設問
            </th>

            <th>
              得点
            </th>

            <th>
              配点
            </th>

          </tr>

        </thead>


        <tbody>

          ${
            boxes
              .map(
                (
                  box,
                  index
                ) => `

                  <tr>

                    <td>
                      ${escapeHtml(
                        box.label ||
                        `問${index + 1}`
                      )}
                    </td>

                    <td class="score">
                      ${formatNumber(
                        scoreMap.get(
                          box.id
                        ) ??
                        0
                      )}
                    </td>

                    <td>
                      ${formatNumber(
                        box.points
                      )}
                    </td>

                  </tr>

                `
              )
              .join("")
          }

        </tbody>

      </table>

    `;

  }


  /* =====================================================
     ORIGINAL ANSWER
  ===================================================== */

  function setOriginalAnswerLink() {

    const link =
      document.getElementById(
        "originalAnswerLink"
      );


    if (!link || !pages.length) {

      return;

    }


    const first =
      pages[0];


    if (!first.file_path) {

      return;

    }


    /*
     * 元答案を直接公開URLにはしない。
     *
     * result.html側で表示するため、
     * リンク自体は使用しない。
     */

    link.style.display =
      "none";

  }


  /* =====================================================
     MARKED PAGES
  ===================================================== */

  async function renderMarkedPages() {

    const container =
      document.getElementById(
        "markedPages"
      );


    if (!container) {

      return;

    }


    container.innerHTML =
      "";


    const card =
      document.getElementById(
        "markedAnswerCard"
      );


    card?.classList.remove(
      "hidden-before-publish"
    );


    for (
      const page
      of pages
    ) {

      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "student-answer-page";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "student-answer-page-title";


      title.textContent =
        `${page.page_no}ページ`;


      const image =
        await createMarkedPage(
          page
        );


      wrapper.append(
        title,
        image
      );


      container.appendChild(
        wrapper
      );

    }

  }


  /* =====================================================
     MARKED PAGE
  ===================================================== */

  async function createMarkedPage(
    page
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.style.position =
      "relative";


    wrapper.style.width =
      "100%";


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
          900
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      wrapper.textContent =
        "答案画像を取得できませんでした。";

      return wrapper;

    }


    const image =
      document.createElement(
        "img"
      );


    image.src =
      data.signedUrl;


    image.alt =
      `${page.page_no}ページ`;


    image.style.display =
      "block";


    image.style.width =
      "100%";


    image.style.height =
      "auto";


    await waitForImage(
      image
    );


    wrapper.appendChild(
      image
    );


    /*
     * 採点記号をCanvasに描画。
     */

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    canvas.style.position =
      "absolute";


    canvas.style.left =
      "0";


    canvas.style.top =
      "0";


    canvas.style.width =
      "100%";


    canvas.style.height =
      "100%";


    canvas.style.pointerEvents =
      "none";


    wrapper.appendChild(
      canvas
    );


    drawPageMarks(
      canvas,
      page
    );


    return wrapper;

  }


  /* =====================================================
     DRAW MARKS
  ===================================================== */

  function drawPageMarks(
    canvas,
    page
  ) {

    const context =
      canvas.getContext(
        "2d"
      );


    if (!context) {

      return;

    }


    const pageBoxes =
      boxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            page.page_no
          )
      );


    pageBoxes.forEach(
      box => {

        const boxMarks =
          marks.filter(
            mark =>
              mark.layout_box_id ===
              box.id
          );


        boxMarks.forEach(
          mark => {

            drawMark(
              context,
              mark,
              box
            );

          }
        );


        const score =
          scores.find(
            item =>
              item.layout_box_id ===
              box.id
          );


        if (score) {

          drawScore(
            context,
            box,
            score.score
          );

        }

      }
    );

  }


  /* =====================================================
     DRAW MARK
  ===================================================== */

  function drawMark(
    context,
    mark,
    box
  ) {

    const x =
      (
        Number(
          box.x
        ) || 0
      ) +
      (
        Number(
          mark.x
        ) || 0
      );


    const y =
      (
        Number(
          box.y
        ) || 0
      ) +
      (
        Number(
          mark.y
        ) || 0
      );


    const size =
      Number(
        mark.font_size
      ) || 42;


    const color =
      mark.color ||
      "#c62828";


    context.save();


    context.strokeStyle =
      color;


    context.fillStyle =
      color;


    context.lineWidth =
      Math.max(
        2,
        Number(
          mark.stroke_width
        ) || 3
      );


    context.lineCap =
      "round";


    context.lineJoin =
      "round";


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

    }


    else if (
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

    }


    else if (
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

    }


    else if (
      mark.object_type ===
      "double_circle"
    ) {

      context.font =
        `bold ${size}px Arial`;


      context.textBaseline =
        "middle";


      context.fillText(
        "◎",
        x,
        y
      );

    }


    else if (
      mark.object_type ===
      "text"
    ) {

      context.font =
        `${size}px Arial`;


      context.textBaseline =
        "middle";


      context.fillText(
        mark.text_value ||
        "",
        x,
        y
      );

    }


    context.restore();

  }


  /* =====================================================
     SCORE
  ===================================================== */

  function drawScore(
    context,
    box,
    value
  ) {

    const x =
      (
        Number(
          box.x
        ) || 0
      ) +
      (
        Number(
          box.width
        ) || 100
      ) +
      10;


    const y =
      (
        Number(
          box.y
        ) || 0
      ) +
      25;


    context.save();


    context.fillStyle =
      "#c62828";


    context.font =
      "bold 28px Arial";


    context.textBaseline =
      "middle";


    context.fillText(
      `${formatNumber(
        value
      )}点`,
      x,
      y
    );


    context.restore();

  }


  /* =====================================================
     NO ANSWER
  ===================================================== */

  function renderNoAnswer() {

    const status =
      document.getElementById(
        "answerStatus"
      );


    if (status) {

      status.textContent =
        "このテストの答案はありません。";

    }

  }


  /* =====================================================
     ERROR
  ===================================================== */

  function showError(
    message
  ) {

    const status =
      document.getElementById(
        "answerStatus"
      );


    if (status) {

      status.textContent =
        message;

    } else {

      alert(
        message
      );

    }

  }


  /* =====================================================
     IMAGE
  ===================================================== */

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
          image.naturalWidth
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
                "画像を読み込めませんでした。"
              )
            );

      }
    );

  }


  /* =====================================================
     DATE
  ===================================================== */

  function formatDate(
    value
  ) {

    if (!value) {

      return "";

    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "";

    }


    return date.toLocaleString(
      "ja-JP"
    );

  }


  /* =====================================================
     NUMBER
  ===================================================== */

  function formatNumber(
    value
  ) {

    const n =
      Number(
        value
      );


    if (
      !Number.isFinite(
        n
      )
    ) {

      return "0";

    }


    return Number.isInteger(
      n
    )
      ? String(n)
      : n.toFixed(1);

  }


  /* =====================================================
     ESCAPE
  ===================================================== */

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


  /* =====================================================
     LOGOUT
  ===================================================== */

  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        await logout();

      }
    );


})();
