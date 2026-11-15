
/* =========================================================
   テスト成績システム
   生徒用 採点済み答案・成績表示

   条件
   ---------------------------------------------------------
   ・ログイン済み
   ・role = student
   ・students.auth_user_id = auth.uid()
   ・tests.results_published = true

   表示
   ---------------------------------------------------------
   ・テスト情報
   ・合計点
   ・満点
   ・得点率
   ・設問別点数
   ・採点前答案
   ・採点済み答案

   採点済み答案
   ---------------------------------------------------------
   元答案画像
       +
   mark_objects
       +
   scores
       ↓
   Canvas
       ↓
   採点済み答案画像
========================================================= */


(function () {

  "use strict";


  /* =====================================================
     URL
  ===================================================== */

  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


  /* =====================================================
     状態
  ===================================================== */

  let profile = null;

  let student = null;

  let test = null;

  let answer = null;

  let pages = [];

  let regions = [];

  let scores = [];

  let marks = [];

  let boxes = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    try {

      /*
        生徒認証

        roleだけではなく
        students.auth_user_idまで確認。
      */

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


      if (!testId) {

        location.replace(
          "/student/tests"
        );

        return;

      }


      await loadTest();


      await loadAnswer();


    } catch (error) {

      console.error(
        "生徒結果初期化:",
        error
      );


      showError(
        error.message ||
        "結果を表示できませんでした。"
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
        .from(
          "tests"
        )
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          max_score,
          results_published,
          results_published_at
        `)
        .eq(
          "id",
          testId
        )
        .eq(
          "results_published",
          true
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      alert(
        "このテストは公開されていません。"
      );


      location.replace(
        "/student/tests"
      );


      return;

    }


    test =
      data;


    renderTestInformation();

  }


  /* =====================================================
     テスト情報
  ===================================================== */

  function renderTestInformation() {

    const title =
      document.getElementById(
        "testName"
      );


    if (title) {

      title.textContent =
        test.name;

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
          .filter(
            Boolean
          )
          .join(
            " ／ "
          );

    }

  }


  /* =====================================================
     自分の答案
  ===================================================== */

  async function loadAnswer() {

    /*
      student_idはURLから受け取らない。

      requireStudent()で確定した
      自分自身のstudent.idを使用する。

      さらにRLSでも本人限定。
    */

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
          student_id,
          status,
          created_at
        `)
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
            ascending:
              false
          }
        )
        .limit(1)
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


    /*
      全データ取得
    */

    await Promise.all([

      loadPages(),

      loadRegions(),

      loadScores(),

      loadMarks(),

      loadBoxes()

    ]);


    /*
      表示
    */

    renderSummary();

    renderQuestionResults();

    setOriginalAnswerLink();

    await renderMarkedPages();

  }


  /* =====================================================
     ページ
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
        .select(`
          id,
          page_no,
          file_path,
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (error) {

      throw error;

    }


    pages =
      data || [];

  }


  /* =====================================================
     answer_regions
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
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          image_path,
          page_no,
          x,
          y,
          width,
          height
        `)
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
     scores
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
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status
        `)
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
     mark_objects
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
          points
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (error) {

      throw error;

    }


    marks =
      data || [];

  }


  /* =====================================================
     layout_boxes
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
        .select(`
          id,
          test_id,
          page_no,
          label,
          points,
          x,
          y,
          width,
          height,
          box_type
        `)
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
            ascending:
              true
          }
        )
        .order(
          "y",
          {
            ascending:
              true
          }
        )
        .order(
          "x",
          {
            ascending:
              true
          }
        );


    if (error) {

      throw error;

    }


    boxes =
      data || [];

  }


  /* =====================================================
     サマリー
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

        ? (
            total /
            max
          ) *
          100

        : 0;


    element.innerHTML = `

      <div
        class="result-summary-grid"
      >

        <div>

          <div class="result-label">
            得点
          </div>

          <div class="result-value">
            ${total}
          </div>

          <div class="result-sub">
            / ${max}点
          </div>

        </div>


        <div>

          <div class="result-label">
            得点率
          </div>

          <div class="result-value">
            ${percentage.toFixed(1)}%
          </div>

        </div>


        <div>

          <div class="result-label">
            採点済み
          </div>

          <div class="result-value">
            ${scores.length}
          </div>

          <div class="result-sub">
            / ${boxes.length}問
          </div>

        </div>


        <div>

          <div class="result-label">
            生徒番号
          </div>

          <div class="result-value">
            ${escapeHtml(
              student.student_no ||
              "-"
            )}
          </div>

        </div>

      </div>

    `;

  }


  /* =====================================================
     設問別結果
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

      container.innerHTML = `

        <div class="empty-state">

          設問情報がありません。

        </div>

      `;


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
              配点
            </th>

            <th>
              得点
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
                ) => {

                  const value =
                    scoreMap.has(
                      box.id
                    )

                      ? scoreMap.get(
                          box.id
                        )

                      : null;


                  return `

                    <tr>

                      <td>

                        ${escapeHtml(
                          box.label ||
                          `問${index + 1}`
                        )}

                      </td>


                      <td>

                        ${
                          box.points ??
                          "-"
                        }

                      </td>


                      <td
                        class="score"
                      >

                        ${
                          value === null
                            ? "-"
                            : value
                        }

                      </td>

                    </tr>

                  `;

                }
              )
              .join("")
          }

        </tbody>

      </table>

    `;

  }


  /* =====================================================
     採点前答案リンク
  ===================================================== */

  function setOriginalAnswerLink() {

    const link =
      document.getElementById(
        "originalAnswerLink"
      );


    if (!link) {

      return;

    }


    link.href =
      `/student/tests/answer?test=${encodeURIComponent(
        testId
      )}`;

  }


  /* =====================================================
     採点済み答案
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


    if (!pages.length) {

      container.innerHTML = `

        <div class="empty-state">

          答案ページがありません。

        </div>

      `;


      return;

    }


    for (
      const page
      of pages
    ) {

      try {

        const canvas =
          await createMarkedPageCanvas(
            page
          );


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
          `採点済み答案 ${page.page_no}ページ`;


        const image =
          document.createElement(
            "img"
          );


        image.src =
          canvas.toDataURL(
            "image/png"
          );


        image.alt =
          `採点済み答案 ${page.page_no}ページ`;


        image.loading =
          "lazy";


        wrapper.appendChild(
          title
        );


        wrapper.appendChild(
          image
        );


        container.appendChild(
          wrapper
        );


      } catch (error) {

        console.error(
          `ページ${page.page_no}:`,
          error
        );


        const errorElement =
          document.createElement(
            "div"
          );


        errorElement.className =
          "empty-state";


        errorElement.textContent =
          `${page.page_no}ページを表示できませんでした。`;


        container.appendChild(
          errorElement
        );

      }

    }

  }


  /* =====================================================
     採点済みCanvas
  ===================================================== */

  async function createMarkedPageCanvas(
    page
  ) {

    /*
      元答案画像
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
          3600
        );


    if (error) {

      throw error;

    }


    if (
      !data?.signedUrl
    ) {

      throw new Error(
        "答案画像URLを取得できませんでした。"
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      元画像と同じサイズ
    */

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    /*
      元画像
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      このページの問題
    */

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


    /*
      採点記号＋点数
    */

    for (
      const box
      of pageBoxes
    ) {

      const region =
        regions.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      const pageMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            box.id
        );


      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      drawMarks(
        context,
        box,
        region,
        pageMarks
      );


      if (score) {

        drawScore(
          context,
          box,
          score.score
        );

      }

    }


    return canvas;

  }


  /* =====================================================
     採点記号
  ===================================================== */

  function drawMarks(
    context,
    box,
    region,
    pageMarks
  ) {

    if (
      !pageMarks.length
    ) {

      return;

    }


    const regionWidth =
      Number(
        region?.width
      ) ||
      Number(
        box.width
      ) ||
      1;


    const regionHeight =
      Number(
        region?.height
      ) ||
      Number(
        box.height
      ) ||
      1;


    const boxWidth =
      Number(
        box.width
      ) ||
      regionWidth;


    const boxHeight =
      Number(
        box.height
      ) ||
      regionHeight;


    /*
      answer_region
      ↓
      layout_box
    */

    const scaleX =
      boxWidth /
      regionWidth;


    const scaleY =
      boxHeight /
      regionHeight;


    pageMarks.forEach(
      mark => {

        const localX =
          Number(
            mark.x
          ) || 0;


        const localY =
          Number(
            mark.y
          ) || 0;


        const x =
          (
            Number(
              box.x
            ) || 0
          ) +
          localX *
          scaleX;


        const y =
          (
            Number(
              box.y
            ) || 0
          ) +
          localY *
          scaleY;


        const originalSize =
          Number(
            mark.font_size
          ) || 42;


        const size =
          originalSize *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        const color =
          mark.color ||
          "#c62828";


        const strokeWidth =
          (
            Number(
              mark.stroke_width
            ) || 3
          ) *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        context.save();


        context.strokeStyle =
          color;


        context.fillStyle =
          color;


        context.lineWidth =
          Math.max(
            1,
            strokeWidth
          );


        context.lineCap =
          "round";


        context.lineJoin =
          "round";


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

        }


        /*
          ×
        */

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


        /*
          △
        */

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


        /*
          ◎
        */

        else if (
          mark.object_type ===
          "double_circle"
        ) {

          context.font =
            `bold ${size}px Arial`;


          context.textBaseline =
            "alphabetic";


          context.fillText(
            "◎",
            x,
            y
          );

        }


        /*
          テキスト
        */

        else if (
          mark.object_type ===
          "text"
        ) {

          context.font =
            `${size}px Arial`;


          context.textBaseline =
            "alphabetic";


          context.fillText(
            mark.text_value ||
            "",
            x,
            y
          );

        }


        /*
          ペン
        */

        else if (
          mark.object_type ===
          "pen"
        ) {

          const points =
            Array.isArray(
              mark.points
            )
              ? mark.points
              : [];


          if (
            points.length
          ) {

            context.beginPath();


            points.forEach(
              (
                point,
                index
              ) => {

                const px =
                  (
                    Number(
                      box.x
                    ) || 0
                  ) +
                  (
                    Number(
                      point.x
                    ) || 0
                  ) *
                  scaleX;


                const py =
                  (
                    Number(
                      box.y
                    ) || 0
                  ) +
                  (
                    Number(
                      point.y
                    ) || 0
                  ) *
                  scaleY;


                if (
                  index === 0
                ) {

                  context.moveTo(
                    px,
                    py
                  );

                } else {

                  context.lineTo(
                    px,
                    py
                  );

                }

              }
            );


            context.stroke();

          }

        }


        context.restore();

      }
    );

  }


  /* =====================================================
     点数
  ===================================================== */

  function drawScore(
    context,
    box,
    score
  ) {

    const boxX =
      Number(
        box.x
      ) || 0;


    const boxY =
      Number(
        box.y
      ) || 0;


    const boxWidth =
      Number(
        box.width
      ) || 100;


    const boxHeight =
      Number(
        box.height
      ) || 50;


    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          boxHeight * 0.25
        )
      );


    /*
      点数を解答欄右側へ
    */

    const x =
      boxX +
      boxWidth +
      Math.max(
        6,
        boxWidth * 0.03
      );


    const y =
      boxY +
      Math.max(
        22,
        boxHeight * 0.25
      );


    context.save();


    context.fillStyle =
      "#c62828";


    context.font =
      `bold ${fontSize}px Arial`;


    context.textBaseline =
      "middle";


    context.fillText(
      `${score}点`,
      x,
      y
    );


    context.restore();

  }


  /* =====================================================
     画像ロード
  ===================================================== */

  function loadImage(
    src
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const image =
          new Image();


        image.crossOrigin =
          "anonymous";


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
          src;

      }
    );

  }


  /* =====================================================
     答案なし
  ===================================================== */

  function renderNoAnswer() {

    const summary =
      document.getElementById(
        "resultSummary"
      );


    if (summary) {

      summary.innerHTML = `

        <div class="empty-state">

          このテストの答案はありません。

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


    const markedPages =
      document.getElementById(
        "markedPages"
      );


    if (markedPages) {

      markedPages.innerHTML =
        "";

    }

  }


  /* =====================================================
     エラー
  ===================================================== */

  function showError(
    message
  ) {

    const container =
      document.getElementById(
        "markedPages"
      );


    if (container) {

      container.innerHTML = `

        <div
          class="empty-state"
          style="color:#c62828;"
        >

          ${escapeHtml(
            message
          )}

        </div>

      `;

    } else {

      alert(
        message
      );

    }

  }


  /* =====================================================
     日付
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
     HTML Escape
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


    return String(
      value
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
     Logout
  ===================================================== */

  const logoutButton =
    document.getElementById(
      "logoutButton"
    );


  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      logout
    );

  }


  /* =====================================================
     START
  ===================================================== */

  initialize();

})();
