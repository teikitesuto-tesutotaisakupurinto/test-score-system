
"use strict";

/* =========================================================
   生徒用 成績・採点済み答案

   公開条件
   ---------------------------------------------------------
   tests.results_published = true

   表示
   ---------------------------------------------------------
   ・テスト情報
   ・合計点
   ・満点
   ・得点率
   ・設問別点数
   ・採点済み答案

   生徒本人
   ---------------------------------------------------------
   requireStudent()
   ↓
   students.id
========================================================= */


(function () {

  let student = null;

  let test = null;

  let answer = null;

  let pages = [];

  let scores = [];

  let marks = [];

  let boxes = [];

  let standardStats = null;


  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


  async function downloadStudentReportPdf() {
    const button = document.getElementById("downloadPdfButton");
    if (!test || !student) return;
    if (typeof window.html2pdf !== "function") {
      showError("成績表PDFの作成ライブラリを読み込めませんでした。ページを再読み込みしてください。");
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = "成績表を作成しています...";
    }
    const report = buildStudentReportElement();
    document.body.appendChild(report);
    try {
      const safeName = String(test.name || "成績表").replace(/[\\/:*?"<>|]/g, "_");
      await window.html2pdf().set({
        margin: [9, 10, 10, 10],
        filename: safeName + "_成績表.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".report-summary", ".report-table tr"] }
      }).from(report).save();
    } catch (error) {
      console.error("student report pdf:", error);
      showError("成績表PDFを作成できませんでした。");
    } finally {
      report.remove();
      if (button) {
        button.disabled = false;
        button.textContent = "成績表PDFダウンロード";
      }
    }
  }

  function buildStudentReportElement() {
    const report = document.createElement("article");
    report.className = "formal-student-report";
    report.style.cssText = "width:794px;padding:42px 48px;background:#fff;color:#1f2933;font-family:'Noto Sans JP',Arial,sans-serif;box-sizing:border-box;";
    const scoreMap = new Map(scores.map(row => [row.layout_box_id, Number(row.score) || 0]));
    const total = scores.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    const max = boxes.reduce((sum, box) => sum + (Number(box.points) || 0), 0);
    const rate = max > 0 ? total / max * 100 : 0;
    const date = value => {
      if (!value) return "—";
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("ja-JP");
    };
    const fmt = value => formatNumber(value);
    const safe = value => escapeHtml(value ?? "—");
    const questionRows = boxes.map((box, index) => {
      const score = scoreMap.get(box.id) ?? 0;
      return `<tr><td>${safe(box.label || `設問 ${index + 1}`)}</td><td class="num">${fmt(score)} 点</td><td class="num">${fmt(box.points)} 点</td><td class="num">${Number(box.points) > 0 ? (score / Number(box.points) * 100).toFixed(1) + "%" : "—"}</td></tr>`;
    }).join("");
    const studentNumber = student.student_no ? `<span>生徒番号：${safe(student.student_no)}</span>` : "";
    const className = [test.grade, test.class_name].filter(Boolean).join("・");
    const standardScoreRows = [
      ["全体偏差値", standardStats?.overall_standard_score],
      ["市区町村別偏差値", standardStats?.municipality_standard_score],
      ["学校別偏差値", standardStats?.school_standard_score]
    ].map(([label, value]) => `<tr><th>${label}</th><td>${value == null ? "—" : fmt(value)}</td></tr>`).join("");
    report.innerHTML = `
      <style>
        .formal-student-report *{box-sizing:border-box}
        .formal-student-report .report-kicker{font-size:11px;letter-spacing:2px;color:#5d6b78;margin-bottom:8px}
        .formal-student-report h1{font-size:27px;letter-spacing:3px;text-align:center;margin:0 0 8px;padding-bottom:15px;border-bottom:3px double #263746}
        .formal-student-report .report-date{text-align:right;font-size:11px;color:#66717b;margin:12px 0 20px}
        .formal-student-report .report-meta{width:100%;border-collapse:collapse;margin-bottom:18px}
        .formal-student-report .report-meta th,.formal-student-report .report-meta td{border:1px solid #cbd3da;padding:9px 11px;font-size:12px}
        .formal-student-report .report-meta th{width:17%;background:#f1f4f7;text-align:left;font-weight:600}
        .formal-student-report .report-summary{display:flex;gap:12px;margin:18px 0 24px}
        .formal-student-report .report-score{flex:1;border:1px solid #aebbc6;padding:15px;text-align:center;background:#f7fafc}
        .formal-student-report .report-score.primary{background:#edf5fb;border:2px solid #2d6d9f}
        .formal-student-report .report-label{font-size:11px;color:#52616d}
        .formal-student-report .report-value{font-size:28px;font-weight:800;margin-top:5px;color:#1e3445}
        .formal-student-report .report-value small{font-size:12px;font-weight:500}
        .formal-student-report h2{font-size:15px;margin:22px 0 9px;padding:8px 10px;background:#eaf0f5;border-left:4px solid #476b86}
        .formal-student-report .report-table{width:100%;border-collapse:collapse}
        .formal-student-report .report-table th,.formal-student-report .report-table td{border:1px solid #cbd3da;padding:7px 9px;font-size:11px}
        .formal-student-report .report-table th{background:#f1f4f7}
        .formal-student-report .report-table .num{text-align:right;white-space:nowrap}
        .formal-student-report .report-note{font-size:10px;color:#687580;line-height:1.7;margin-top:20px;border-top:1px solid #d7dee4;padding-top:10px}
        .formal-student-report .report-footer{text-align:center;font-size:10px;color:#77828c;margin-top:25px}
      </style>
      <div class="report-kicker">INDIVIDUAL ACADEMIC RECORD</div>
      <h1>成 績 表</h1>
      <div class="report-date">発行日：${date(new Date().toISOString())}</div>
      <table class="report-meta">
        <tr><th>氏名</th><td>${safe(student.name || "生徒")}</td><th>生徒情報</th><td>${studentNumber || "—"}</td></tr>
        <tr><th>テスト名</th><td colspan="3">${safe(test.name)}</td></tr>
        <tr><th>教科</th><td>${safe(test.subject)}</td><th>実施日</th><td>${date(test.test_date)}</td></tr>
        <tr><th>学年・クラス</th><td colspan="3">${safe(className || "—")}</td></tr>
      </table>
      <div class="report-summary">
        <div class="report-score primary"><div class="report-label">総合得点</div><div class="report-value">${fmt(total)}<small> / ${fmt(max)} 点</small></div></div>
        <div class="report-score"><div class="report-label">得点率</div><div class="report-value">${rate.toFixed(1)}<small> %</small></div></div>
      </div>
      <h2>偏差値</h2>
      <table class="report-table"><tbody>${standardScoreRows}</tbody></table>
      <h2>設問別成績</h2>
      <table class="report-table">
        <thead><tr><th>設問</th><th>得点</th><th>配点</th><th>得点率</th></tr></thead>
        <tbody>${questionRows || '<tr><td colspan="4">設問別データはありません。</td></tr>'}</tbody>
        <tfoot><tr><th>合計</th><th class="num">${fmt(total)} 点</th><th class="num">${fmt(max)} 点</th><th class="num">${rate.toFixed(1)}%</th></tr></tfoot>
      </table>
      <div class="report-note">本成績表は、公開された採点結果に基づいて作成されています。表示内容に不明点がある場合は、担当の先生に確認してください。</div>
      <div class="report-footer">— END OF REPORT —</div>
    `;
    return report;
  }

  /* =======================================================
     INIT
  ======================================================= */

  async function initialize() {

    try {

      const auth =
        await requireStudent();


      if (!auth) {

        return;

      }


      student =
        auth.student;


      document.getElementById(
        "studentName"
      ).textContent =
        student.name ||
        auth.profile?.name ||
        "生徒";


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

      document.getElementById("downloadPdfButton")?.addEventListener("click", downloadStudentReportPdf);


      if (!testId) {

        location.replace(
          "/student/tests"
        );

        return;

      }


      const published =
        await loadTest();


      if (!published) {

        return;

      }


      await loadAnswer();
      await loadPreviousComparison();
      await loadStandardScores();


    } catch (error) {

      console.error(
        "student result:",
        error
      );


      showError(
        error.message ||
        "成績を表示できませんでした。"
      );

    }

  }


  /* =======================================================
     TEST
  ======================================================= */

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
          test_date,
          max_score,
          results_published,
          results_published_at
          `
        )
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

      showError(
        "このテストの成績はまだ公開されていません。"
      );


      return false;

    }


    test =
      data;

    setText(
      "testName",
      test.name ||
      ""
    );


    setText(
      "testMeta",
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
        )
    );


    return true;

  }


  /* =======================================================
     ANSWER
  ======================================================= */

  async function loadAnswer() {

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
        .in(
          "status",
          [
            "marked",
            "published"
          ]
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

      showNoResult();

      return;

    }


    answer =
      data;


    await Promise.all([

      loadPages(),

      loadScores(),

      loadMarks(),

      loadBoxes()

    ]);


    renderSummary();

    renderQuestionResults();

    renderOriginalLink();

    await renderMarkedPages();

  }


  /* =======================================================
     PAGES
  ======================================================= */

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
          file_type,
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


  /* =======================================================
     SCORES
  ======================================================= */

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


  /* =======================================================
     MARKS
  ======================================================= */

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
          font_family,
          stroke_width,
          x,
          y,
          width,
          height
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

      throw error;

    }


    marks =
      data || [];

  }


  /* =======================================================
     BOXES
  ======================================================= */

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
          box_role,
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


    boxes =
      (data || [])
        .filter(
          box =>
            !["major", "minor"].includes(box.box_role) &&
            ![
              "QR",
              "氏名",
              "小計",
              "合計"
            ].includes(
              String(
                box.label ||
                ""
              ).trim()
            )
        );

  }


  /* =======================================================
     SUMMARY
  ======================================================= */

  function renderSummary() {

    const element =
      document.getElementById(
        "resultSummary"
      );


    if (!element) {

      return;

    }


    const scoreMap =
      new Map(
        scores.map(
          score => [
            score.layout_box_id,
            Number(
              score.score
            ) || 0
          ]
        )
      );


    const total =
      scores.reduce(
        (
          sum,
          score
        ) =>
          sum +
          (
            Number(
              score.score
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
        <div class="result-score-card"><div class="result-score-label">総合得点</div><div class="result-score-value">${formatNumber(total)}点</div><div class="result-score-sub">満点 ${formatNumber(max)}点</div></div>
        <div class="result-score-card"><div class="result-score-label">得点率</div><div class="result-score-value">${percentage.toFixed(1)}%</div></div>
        <div class="result-score-card"><div class="result-score-label">全体偏差値</div><div class="result-score-value">${standardStats?.overall_standard_score == null ? "—" : formatNumber(standardStats.overall_standard_score)}</div></div>
        <div class="result-score-card"><div class="result-score-label">市区町村別偏差値</div><div class="result-score-value">${standardStats?.municipality_standard_score == null ? "—" : formatNumber(standardStats.municipality_standard_score)}</div></div>
        <div class="result-score-card"><div class="result-score-label">学校別偏差値</div><div class="result-score-value">${standardStats?.school_standard_score == null ? "—" : formatNumber(standardStats.school_standard_score)}</div></div>
      </div>
    `;

  }


  async function loadStandardScores() {
    try {
      const { data, error } = await supabaseClient.rpc("get_student_test_standard_scores", { p_test_id: testId });
      if (error) throw error;
      standardStats = Array.isArray(data) ? (data[0] || null) : data;
      renderSummary();
    } catch (error) {
      standardStats = null;
      console.warn("standard score RPC:", error);
      renderSummary();
    }
  }

  /* =======================================================
     QUESTION RESULTS
  ======================================================= */

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
          設問別結果はありません。
        </div>

      `;

      return;

    }


    container.innerHTML = `

      <table
        style="
          width:100%;
          border-collapse:collapse;
        "
      >

        <thead>

          <tr>

            <th
              style="
                padding:8px;
                border-bottom:1px solid #ddd;
                text-align:left;
              "
            >
              設問
            </th>

            <th
              style="
                padding:8px;
                border-bottom:1px solid #ddd;
                text-align:right;
              "
            >
              得点
            </th>

            <th
              style="
                padding:8px;
                border-bottom:1px solid #ddd;
                text-align:right;
              "
            >
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
                ) => {

                  const score =
                    findScore(
                      box.id
                    );


                  return `

                    <tr>

                      <td
                        style="
                          padding:8px;
                          border-bottom:1px solid #eee;
                        "
                      >

                        ${escapeHtml(
                          box.label ||
                          `問${index + 1}`
                        )}

                      </td>

                      <td
                        style="
                          padding:8px;
                          border-bottom:1px solid #eee;
                          text-align:right;
                        "
                      >

                        ${formatNumber(
                          score
                        )}

                      </td>

                      <td
                        style="
                          padding:8px;
                          border-bottom:1px solid #eee;
                          text-align:right;
                        "
                      >

                        ${formatNumber(
                          box.points
                        )}

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


    document.getElementById(
      "questionResultsCard"
    )?.style &&
      (
        document.getElementById(
          "questionResultsCard"
        ).style.display =
          "block"
      );

  }


  /* =======================================================
     SCORE
  ======================================================= */

  function findScore(
    boxId
  ) {

    const score =
      scores.find(
        item =>
          item.layout_box_id ===
          boxId
      );


    return score
      ? Number(
          score.score
        ) || 0
      : 0;

  }


  /* =======================================================
     ORIGINAL ANSWER
  ======================================================= */

  function renderOriginalLink() {

    const link =
      document.getElementById(
        "originalAnswerLink"
      );


    if (!link) {

      return;

    }


    link.href =
      `/student/tests/answer.html?test=${encodeURIComponent(
        testId
      )}`;


    link.style.display =
      "inline-block";

  }


  /* =======================================================
     MARKED PAGES
  ======================================================= */

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
          採点済み答案がありません。
        </div>

      `;

      return;

    }


    for (
      const page
      of pages
    ) {

      const wrapper =
        document.createElement(
          "section"
        );


      wrapper.style.cssText = `
        position:relative;
        margin-bottom:20px;
        background:#fff;
      `;


      const title =
        document.createElement(
          "div"
        );


      title.textContent =
        `採点済み答案 ${page.page_no}ページ`;


      title.style.cssText = `
        padding:7px 9px;
        background:#f5f6f7;
        border-bottom:1px solid #ddd;
        font-size:12px;
        font-weight:700;
      `;


      wrapper.appendChild(
        title
      );


      const canvas =
        await createMarkedCanvas(
          page
        );


      canvas.style.cssText = `
        display:block;
        width:100%;
        height:auto;
      `;


      wrapper.appendChild(
        canvas
      );


      container.appendChild(
        wrapper
      );

    }

  }


  /* =======================================================
     CANVAS
  ======================================================= */

  async function createMarkedCanvas(
    page
  ) {

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "test-files"
        )
        .createSignedUrl(
          page.file_path,
          3600
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      throw new Error(
        "答案画像を取得できませんでした。"
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


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


    context.drawImage(
      image,
      0,
      0
    );


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

        const pageMarks =
          marks.filter(
            mark =>
              mark.layout_box_id ===
              box.id
          );


        pageMarks.forEach(
          mark => {

            drawMark(
              context,
              mark
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


    return canvas;

  }


  /* =======================================================
     MARK
  ======================================================= */

  function drawMark(
    context,
    mark
  ) {

    const x =
      Number(
        mark.x
      ) || 0;


    const y =
      Number(
        mark.y
      ) || 0;


    const size =
      Number(
        mark.font_size
      ) || 36;


    context.save();


    context.fillStyle =
      mark.color ||
      "#d00000";


    context.strokeStyle =
      mark.color ||
      "#d00000";


    context.lineWidth =
      Number(
        mark.stroke_width
      ) || 3;


    context.font =
      `bold ${size}px ${mark.font_family || "sans-serif"}`;


    context.textBaseline =
      "middle";


    let value =
      "";


    switch (
      mark.object_type
    ) {

      case "circle":

        value =
          "○";

        break;


      case "x":

        value =
          "×";

        break;


      case "triangle":

        value =
          "△";

        break;


      case "double_circle":

        value =
          "◎";

        break;


      case "text":

        value =
          mark.text_value ||
          "";

        break;


      case "pen":

        value =
          "／";

        break;

    }


    if (value) {

      context.fillText(
        value,
        x,
        y
      );

    }


    context.restore();

  }


  /* =======================================================
     SCORE
  ======================================================= */

  function drawScore(
    context,
    box,
    score
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
        ) || 0
      ) +
      8;


    const y =
      (
        Number(
          box.y
        ) || 0
      ) +
      (
        Number(
          box.height
        ) || 0
      ) /
      2;


    context.save();


    context.fillStyle =
      "#d00000";


    context.font =
      "bold 28px sans-serif";


    context.textBaseline =
      "middle";


    context.fillText(
      `${formatNumber(
        score
      )}点`,
      x,
      y
    );


    context.restore();

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  function loadImage(
    url
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
          url;

      }
    );

  }


  /* =======================================================
     EMPTY
  ======================================================= */

  function showNoResult() {

    const summary =
      document.getElementById(
        "resultSummary"
      );


    if (summary) {

      summary.innerHTML = `

        <div class="empty-state">

          採点結果がまだ確定していません。

        </div>

      `;

    }


    const pages =
      document.getElementById(
        "markedPages"
      );


    if (pages) {

      pages.innerHTML =
        "";

    }

  }


  /* =======================================================
     ERROR
  ======================================================= */

  function showError(
    message
  ) {

    const element =
      document.getElementById(
        "resultSummary"
      );


    if (element) {

      element.innerHTML = `

        <div
          class="empty-state"
          style="color:#b42318;"
        >

          ${escapeHtml(
            message
          )}

        </div>

      `;

      return;

    }

  }


  /* =======================================================
     HELPERS
  ======================================================= */

  function setText(
    id,
    value
  ) {

    const element =
      document.getElementById(
        id
      );


    if (element) {

      element.textContent =
        value;

    }

  }


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


  function formatDate(
    value
  ) {

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
     PREVIOUS TEST COMPARISON
  ======================================================= */
  async function loadPreviousComparison() {
    const container = document.getElementById("previousComparison");
    if (!container || !answer || !test?.test_date || !test?.subject) return;

    const { data: previousTests, error: testsError } = await supabaseClient
      .from("tests")
      .select("id,name,test_date,subject,grade")
      .eq("subject", test.subject)
      .eq("grade", test.grade)
      .eq("results_published", true)
      .lt("test_date", test.test_date)
      .order("test_date", { ascending: false })
      .limit(1);

    if (testsError) throw testsError;
    const previous = previousTests?.[0];
    if (!previous) return;

    const { data: previousAnswer, error: answerError } = await supabaseClient
      .from("answer_sheets")
      .select("id")
      .eq("test_id", previous.id)
      .eq("student_id", student.id)
      .in("status", ["marked", "published"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (answerError) throw answerError;
    if (!previousAnswer) return;

    const { data: previousScores, error: scoresError } = await supabaseClient
      .from("scores")
      .select("score,status")
      .eq("answer_sheet_id", previousAnswer.id)
      .eq("status", "marked");

    if (scoresError) throw scoresError;

    const { data: previousBoxes, error: boxesError } = await supabaseClient
      .from("layout_boxes")
      .select("points,label")
      .eq("test_id", previous.id)
      .eq("box_type", "answer");

    if (boxesError) throw boxesError;

    const previousTotal = (previousScores || []).reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    const previousMax = (previousBoxes || []).filter(row => !["QR","氏名","小計","合計"].includes(String(row.label || "").trim())).reduce((sum, row) => sum + (Number(row.points) || 0), 0);
    const currentTotal = scores.reduce((sum, row) => sum + (Number(row.score) || 0), 0);
    const currentMax = boxes.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
    const difference = currentTotal - previousTotal;
    const sign = difference > 0 ? "+" : "";
    container.style.display = "";
    container.innerHTML = `
      <div class="student-result-card-title">前回テストとの比較</div>
      <p>${escapeHtml(previous.name || "前回テスト")}（${escapeHtml(previous.test_date || "")}）との比較</p>
      <div class="previous-comparison-grid">
        <div class="previous-comparison-item"><div class="previous-comparison-label">今回の得点</div><div class="previous-comparison-value">${formatNumber(currentTotal)} / ${formatNumber(currentMax)}点</div></div>
        <div class="previous-comparison-item"><div class="previous-comparison-label">前回の得点</div><div class="previous-comparison-value">${formatNumber(previousTotal)} / ${formatNumber(previousMax)}点</div></div>
        <div class="previous-comparison-item"><div class="previous-comparison-label">前回比</div><div class="previous-comparison-value">${sign}${formatNumber(difference)}点</div></div>
      </div>`;
  }

  initialize();

})();
