
"use strict";

/* =========================================================
   結果総括表

   ・生徒ごとに最新答案を使用
   ・answer枠だけを集計
   ・QR / 氏名 / 小計 / 合計は除外
   ・marked済みscoreだけ集計
   ・順位は合計点降順
   ・results_publishedはこの画面では変更しない
========================================================= */

let DB = null;

let testId = null;

let currentTest = null;

let students = [];

let boxes = [];

let scores = [];

let rows = [];


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "testSelect"
  );


const resultBody =
  document.getElementById(
    "resultBody"
  );


const statusElement =
  document.getElementById(
    "status"
  );


const summaryCards =
  document.getElementById(
    "summaryCards"
  );


const summaryCardGrid =
  document.getElementById(
    "summaryCardGrid"
  );


const summaryTableCard =
  document.getElementById(
    "summaryTableCard"
  );


const testInformation =
  document.getElementById(
    "testInformation"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


    setupEvents();


    await loadTests();


  } catch (error) {

    console.error(
      "results-summary:",
      error
    );


    showError(
      error.message ||
      "成績集計を読み込めませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    async () => {

      testId =
        testSelect.value ||
        null;


      await loadResults();

    }
  );


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


  document.getElementById("printButton")?.addEventListener("click", () => window.print());
  document.getElementById("downloadPdfButton")?.addEventListener("click", downloadTeacherSummaryPdf);


  document
    .getElementById(
      "exportCsvButton"
    )
    ?.addEventListener(
      "click",
      exportCsv
    );

}


async function downloadTeacherSummaryPdf() {
  const button = document.getElementById("downloadPdfButton");
  if (!rows.length || !currentTest) {
    setStatus("PDFにする集計結果がありません。", true);
    return;
  }
  if (typeof window.html2pdf !== "function") {
    setStatus("PDF作成ライブラリを読み込めませんでした。", true);
    return;
  }
  if (button) {
    button.disabled = true;
    button.textContent = "PDFを作成しています...";
  }
  const report = buildTeacherSummaryReport();
  document.body.appendChild(report);
  try {
    const filename = String(currentTest.name || "結果総括表").replace(/[\\/:*?"<>|]/g, "_") + "_結果総括表.pdf";
    await window.html2pdf().set({
      margin: [8, 8, 10, 8],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"], avoid: [".report-stats", ".report-table tr"] }
    }).from(report).save();
  } catch (error) {
    console.error("teacher summary pdf:", error);
    setStatus("結果総括表PDFを作成できませんでした。", true);
  } finally {
    report.remove();
    if (button) {
      button.disabled = false;
      button.textContent = "正式な結果総括表PDF";
    }
  }
}

function buildTeacherSummaryReport() {
  const report = document.createElement("article");
  report.style.cssText = "width:1120px;padding:34px 42px;background:#fff;color:#1f2933;font-family:'Noto Sans JP',Arial,sans-serif;box-sizing:border-box;";
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const average = rows.length ? total / rows.length : 0;
  const high = rows.length ? Math.max(...rows.map(row => row.total)) : 0;
  const low = rows.length ? Math.min(...rows.map(row => row.total)) : 0;
  const variance = rows.length ? rows.reduce((sum, row) => sum + Math.pow(row.total - average, 2), 0) / rows.length : 0;
  const sd = Math.sqrt(variance);
  const averageRate = rows[0]?.maxScore > 0 ? average / rows[0].maxScore * 100 : 0;
  const safe = value => escapeHtml(value ?? "—");
  const questionHeads = boxes.map((box, index) => `<th>${safe(box.label || `設問${index + 1}`)}</th>`).join("");
  const standardHeads = "<th>全体偏差値</th><th>市区町村偏差値</th><th>学校偏差値</th>";
  const body = rows.map(row => `<tr><td>${safe(row.student.student_no)}</td><td class="name">${safe(row.student.name)}</td>${row.questionScores.map(score => `<td class="num">${formatNumber(score)}</td>`).join("")}<td class="num strong">${formatNumber(row.total)} / ${formatNumber(row.maxScore)}</td><td class="num">${row.percentage.toFixed(1)}%</td><td class="num">${row.standardScoreOverall == null ? "—" : formatNumber(row.standardScoreOverall)}</td><td class="num">${row.standardScoreMunicipality == null ? "—" : formatNumber(row.standardScoreMunicipality)}</td><td class="num">${row.standardScoreSchool == null ? "—" : formatNumber(row.standardScoreSchool)}</td><td class="num">${row.rank}</td></tr>`).join("");
  const issued = new Date().toLocaleDateString("ja-JP");
  report.innerHTML = `
    <style>
      .formal-summary *{box-sizing:border-box}
      .formal-summary .eyebrow{font-size:10px;letter-spacing:2px;color:#62717e}
      .formal-summary h1{font-size:25px;text-align:center;margin:4px 0 5px;padding-bottom:12px;border-bottom:3px double #263746}
      .formal-summary .meta{display:flex;justify-content:space-between;font-size:11px;color:#586672;margin:10px 0 16px}
      .formal-summary .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:14px 0 18px}
      .formal-summary .stat{border:1px solid #cbd4dc;padding:10px;text-align:center;background:#f7f9fb}
      .formal-summary .stat.best{background:#eaf4fc;border:2px solid #2875a8}
      .formal-summary .stat-label{font-size:10px;color:#5e6b75}
      .formal-summary .stat-value{font-size:20px;font-weight:800;margin-top:4px}
      .formal-summary .best-word{font-size:10px;font-weight:900;letter-spacing:2px;color:#1769aa}
      .formal-summary table{width:100%;border-collapse:collapse}
      .formal-summary th,.formal-summary td{border:1px solid #cbd4dc;padding:5px 6px;font-size:9px}
      .formal-summary th{background:#edf1f5;text-align:center}
      .formal-summary td.num{text-align:right;white-space:nowrap}
      .formal-summary td.name{text-align:left;white-space:nowrap}
      .formal-summary td.strong{font-weight:800}
      .formal-summary .foot{font-size:9px;color:#6b7780;margin-top:12px;text-align:right}
    </style>
    <div class="formal-summary">
      <div class="eyebrow">ACADEMIC PERFORMANCE SUMMARY</div>
      <h1>テスト結果総括表</h1>
      <div class="meta"><span>テスト：${safe(currentTest.name)}</span><span>教科：${safe(currentTest.subject)}　学年：${safe(currentTest.grade)}　クラス：${safe(currentTest.class_name)}</span><span>発行日：${issued}</span></div>
      <div class="stats">
        <div class="stat best"><div class="best-word">BEST</div><div class="stat-label">平均点</div><div class="stat-value">${formatNumber(average)}点</div></div>
        <div class="stat"><div class="stat-label">受験者数</div><div class="stat-value">${rows.length}名</div></div>
        <div class="stat"><div class="stat-label">最高点</div><div class="stat-value">${formatNumber(high)}点</div></div>
        <div class="stat"><div class="stat-label">最低点</div><div class="stat-value">${formatNumber(low)}点</div></div>
        <div class="stat"><div class="stat-label">標準偏差</div><div class="stat-value">${sd.toFixed(2)}</div></div>
      </div>
      <table class="report-table">
        <thead><tr><th>生徒番号</th><th>氏名</th>${questionHeads}<th>合計点</th><th>得点率</th>${standardHeads}<th>順位</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="foot">平均得点率：${averageRate.toFixed(1)}%　／　この総括表は公開操作とは独立して作成された集計資料です。</div>
    </div>
  `;
  return report;
}

/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

  const {
    data,
    error
  } =
    await DB
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
        results_published_at,
        created_at
        `
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


  const tests =
    data || [];


  testSelect.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      tests
        .map(
          test => `

            <option
              value="${escapeHtml(
                test.id
              )}"
            >

              ${escapeHtml(
                [
                  test.name,
                  test.subject,
                  test.grade,
                  test.class_name
                ]
                  .filter(Boolean)
                  .join(" / ")
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  const params =
    new URLSearchParams(
      location.search
    );


  const requested =
    params.get(
      "test"
    );


  if (
    requested &&
    tests.some(
      test =>
        test.id ===
        requested
    )
  ) {

    testId =
      requested;


    testSelect.value =
      requested;


    await loadResults();

  }

}


/* =========================================================
   LOAD RESULTS
========================================================= */

async function loadResults() {

  clearResults();


  if (!testId) {

    setStatus(
      "テストを選択してください。"
    );

    return;

  }


  try {

    setStatus(
      "成績を集計しています..."
    );


    await loadTest();


    await loadBoxes();


    const answerSheets =
      await loadAnswerSheets();


    if (!answerSheets.length) {

      renderEmpty(
        "生徒に紐付いた答案がありません。"
      );

      return;

    }


    await loadStudents(
      answerSheets
    );


    await loadScores(
      answerSheets
    );


    buildRows(
      answerSheets
    );


    renderInformation();

    renderSummary();

    renderTable();


    const total =
      rows.length;


    const marked =
      rows.filter(
        row =>
          row.answer.status ===
            "marked" ||
          row.answer.status ===
            "published"
      ).length;


    if (
      currentTest.results_published
    ) {

      setStatus(
        `結果確定・公開済み：${total}名`
      );

    } else if (
      marked ===
      total
    ) {

      setStatus(
        `全${total}名の結果を集計済み。採点済みです。公開は先生が公開設定画面で操作してください。`
      );

    } else {

      setStatus(
        `${total}名中 ${marked}名が採点完了。結果はまだ確定していません。`
      );

    }


  } catch (error) {

    console.error(
      "loadResults:",
      error
    );


    showError(
      error.message ||
      "成績を取得できませんでした。"
    );

  }

}


/* =========================================================
   TEST
========================================================= */

async function loadTest() {

  const {
    data,
    error
  } =
    await DB
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


  currentTest =
    data;

}


/* =========================================================
   BOXES
========================================================= */

async function loadBoxes() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "layout_boxes"
      )
      .select(
        `
        id,
        label,
        points,
        question_id,
        box_type,
        page_no,
        sort_order
        `
      )
      .eq(
        "test_id",
        testId
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
          String(
            box.box_type ||
            ""
          )
            .trim()
            .toLowerCase() ===
          "answer"
      )
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


/* =========================================================
   ANSWERS
========================================================= */

async function loadAnswerSheets() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        student_id,
        status,
        uploaded_at,
        created_at
        `
      )
      .eq(
        "test_id",
        testId
      )
      .not(
        "student_id",
        "is",
        null
      )
      .in(
        "status",
        [
          "matched",
          "uploaded",
          "marking",
          "marked",
          "published"
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


  /*
   * 同じ生徒に複数答案がある場合は
   * 最新の1件だけを使用。
   */

  const latest =
    new Map();


  (
    data ||
    []
  ).forEach(
    answer => {

      if (
        !latest.has(
          answer.student_id
        )
      ) {

        latest.set(
          answer.student_id,
          answer
        );

      }

    }
  );


  return [
    ...latest.values()
  ];

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents(
  answerSheets
) {

  const ids =
    [
      ...new Set(
        answerSheets
          .map(
            answer =>
              answer.student_id
          )
          .filter(Boolean)
      )
    ];


  if (!ids.length) {

    students =
      [];

    return;

  }


  const {
    data,
    error
  } =
    await DB
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        municipality,
        school_name
        `
      )
      .in(
        "id",
        ids
      );


  if (error) {

    throw error;

  }


  students =
    data || [];

}


/* =========================================================
   SCORES
========================================================= */

async function loadScores(
  answerSheets
) {

  const ids =
    answerSheets.map(
      answer =>
        answer.id
    );


  if (!ids.length) {

    scores =
      [];

    return;

  }


  scores =
    [];


  const chunkSize =
    300;


  for (
    let start = 0;
    start <
    ids.length;
    start +=
      chunkSize
  ) {

    const chunk =
      ids.slice(
        start,
        start +
          chunkSize
      );


    const {
      data,
      error
    } =
      await DB
        .from(
          "scores"
        )
        .select(
          `
          answer_sheet_id,
          layout_box_id,
          score,
          status
          `
        )
        .in(
          "answer_sheet_id",
          chunk
        );


    if (error) {

      throw error;

    }


    scores.push(
      ...(data || [])
    );

  }

}


/* =========================================================
   BUILD ROWS
========================================================= */

function buildRows(
  answerSheets
) {

  const studentMap =
    new Map(
      students.map(
        student => [
          student.id,
          student
        ]
      )
    );


  const scoreMap =
    new Map();


  scores.forEach(
    score => {

      if (
        score.status !==
        "marked"
      ) {

        return;

      }


      scoreMap.set(
        `${score.answer_sheet_id}:${score.layout_box_id}`,
        Number(
          score.score
        ) || 0
      );

    }
  );


  const maxScore =
    boxes.reduce(
      (
        total,
        box
      ) =>
        total +
        (
          Number(
            box.points
          ) || 0
        ),
      0
    );


  rows =
    answerSheets
      .map(
        answer => {

          const student =
            studentMap.get(
              answer.student_id
            );


          if (!student) {

            return null;

          }


          const questionScores =
            boxes.map(
              box =>
                scoreMap.get(
                  `${answer.id}:${box.id}`
                ) ??
                0
            );


          const total =
            questionScores.reduce(
              (
                sum,
                value
              ) =>
                sum +
                Number(
                  value
                ),
              0
            );


          const average =
            boxes.length
              ? total /
                boxes.length
              : 0;


          const percentage =
            maxScore > 0
              ? total /
                maxScore *
                100
              : 0;


          return {

            student,

            answer,

            questionScores,

            total,

            average,

            maxScore,

            percentage,

            rank:0

          };

        }
      )
      .filter(Boolean);


  rows.sort(
    (
      a,
      b
    ) =>
      b.total -
      a.total
  );

  assignStandardScores();


  let previousScore =
    null;

  let previousRank =
    0;


  rows.forEach(
    (
      row,
      index
    ) => {

      if (
        previousScore !== null &&
        previousScore ===
          row.total
      ) {

        row.rank =
          previousRank;

      } else {

        row.rank =
          index + 1;

        previousRank =
          row.rank;

        previousScore =
          row.total;

      }

    }
  );

}


/* =========================================================
   INFORMATION
========================================================= */

function renderInformation() {

  if (!testInformation) {

    return;

  }


  testInformation.style.display =
    "block";


  testInformation.innerHTML = `

    <strong>
      ${escapeHtml(
        currentTest.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      currentTest.subject ||
      "-"
    )}

    ／

    学年：
    ${escapeHtml(
      currentTest.grade ||
      "-"
    )}

    ／

    クラス：
    ${escapeHtml(
      currentTest.class_name ||
      "-"
    )}

    ／

    満点：
    ${formatNumber(
      currentTest.max_score ||
      rows[0]?.maxScore ||
      0
    )}

    <br>

    結果状態：
    ${
      currentTest.results_published
        ? "公開済み"
        : "未確定"
    }

  `;

}


function assignStandardScores() {
  const scoreFor = group => {
    if (!group.length) return new Map();
    const mean = group.reduce((sum, row) => sum + row.total, 0) / group.length;
    const variance = group.reduce((sum, row) => sum + Math.pow(row.total - mean, 2), 0) / group.length;
    const deviation = Math.sqrt(variance);
    return new Map(group.map(row => [row, deviation > 0 ? Math.round((50 + 10 * (row.total - mean) / deviation) * 10) / 10 : 50]));
  };
  const eligibleRows = rows.filter(row => ["marked", "published"].includes(row.answer.status));
  const overall = scoreFor(eligibleRows);
  rows.forEach(row => { row.standardScoreOverall = overall.get(row) ?? null; });
  for (const [field, output] of [["municipality", "standardScoreMunicipality"], ["school_name", "standardScoreSchool"]]) {
    const groups = new Map();
    eligibleRows.forEach(row => {
      const key = String(row.student[field] || "").trim();
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    rows.forEach(row => {
      const key = String(row.student[field] || "").trim();
      const isEligible = ["marked", "published"].includes(row.answer.status);
      const groupScores = key && isEligible ? scoreFor(groups.get(key) || []) : null;
      row[output] = groupScores ? groupScores.get(row) ?? null : null;
    });
  }
}

/* =========================================================
   SUMMARY CARDS
========================================================= */

function renderSummary() {

  if (
    !summaryCards ||
    !summaryCardGrid
  ) {

    return;

  }


  if (!rows.length) {

    summaryCards.style.display =
      "none";

    return;

  }


  const total =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        row.total,
      0
    );


  const average =
    total /
    rows.length;


  const maxScore =
    rows[0].maxScore;


  const averageRate =
    maxScore > 0
      ? average /
        maxScore *
        100
      : 0;


  const highest =
    Math.max(
      ...rows.map(
        row =>
          row.total
      )
    );

  const lowest =
    Math.min(...rows.map(row => row.total));

  const variance =
    rows.reduce((sum, row) => sum + Math.pow(row.total - average, 2), 0) / rows.length;

  const standardDeviation = Math.sqrt(variance);


  summaryCardGrid.innerHTML = `

    <div class="summary-card">

      <div class="summary-label">
        受験者
      </div>

      <div class="summary-value">
        ${rows.length}人
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        平均点
      </div>

      <div class="summary-value">
        ${formatNumber(
          average
        )}点
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        最高点
      </div>

      <div class="summary-value">
        ${formatNumber(
          highest
        )}点
      </div>

    </div>


    <div class="summary-card">

      <div class="summary-label">
        平均得点率
      </div>

      <div class="summary-value">
        ${averageRate.toFixed(
          1
        )}%
      </div>

    </div>

    <div class="summary-card">
      <div class="summary-label">最低点</div>
      <div class="summary-value">${formatNumber(lowest)}点</div>
    </div>

    <div class="summary-card">
      <div class="summary-label">標準偏差</div>
      <div class="summary-value">${standardDeviation.toFixed(2)}</div>
    </div>

  `;


  summaryCards.style.display =
    "block";

}


/* =========================================================
   TABLE
========================================================= */

function renderTable() {

  if (!summaryTableCard) {

    return;

  }


  const table =
    document.getElementById(
      "summaryTable"
    );


  const thead =
    table?.querySelector(
      "thead"
    );


  if (!table || !thead) {

    return;

  }


  thead.innerHTML = `

    <tr>

      <th>
        生徒番号
      </th>

      <th>
        氏名
      </th>

      ${
        boxes
          .map(
            (
              box,
              index
            ) => `

              <th>
                ${escapeHtml(
                  box.label ||
                  `問${index + 1}`
                )}
              </th>

            `
          )
          .join("")
      }

      <th>
        合計
      </th>

      <th>
        平均
      </th>

      <th>得点率</th>
      <th>全体偏差値</th>
      <th>市区町村偏差値</th>
      <th>学校偏差値</th>
      <th>順位</th>

    </tr>

  `;


  resultBody.innerHTML =
    rows
      .map(
        row => `

          <tr>

            <td>
              ${escapeHtml(
                row.student.student_no ||
                ""
              )}
            </td>

            <td>
              ${escapeHtml(
                row.student.name ||
                ""
              )}
            </td>

            ${
              row.questionScores
                .map(
                  score => `

                    <td>
                      ${formatNumber(
                        score
                      )}
                    </td>

                  `
                )
                .join("")
            }

            <td>
              ${formatNumber(
                row.total
              )}
              /
              ${formatNumber(
                row.maxScore
              )}
            </td>

            <td>
              ${row.average.toFixed(
                2
              )}
            </td>

            <td>${row.percentage.toFixed(1)}%</td>
            <td>${formatNumber(row.standardScoreOverall)}</td>
            <td>${row.standardScoreMunicipality == null ? "—" : formatNumber(row.standardScoreMunicipality)}</td>
            <td>${row.standardScoreSchool == null ? "—" : formatNumber(row.standardScoreSchool)}</td>
            <td>${row.rank}</td>

          </tr>

        `
      )
      .join("");


  summaryTableCard.style.display =
    "block";

}


/* =========================================================
   CSV
========================================================= */

function exportCsv() {

  if (!rows.length) {

    return;

  }


  const header = [

    "生徒番号",

    "氏名",

    ...boxes.map(
      (
        box,
        index
      ) =>
        box.label ||
        `問${index + 1}`
    ),

    "合計",

    "平均",

    "得点率",
    "全体偏差値",
    "市区町村偏差値",
    "学校偏差値",
    "順位"

  ];


  const lines = [
    header
  ];


  rows.forEach(
    row => {

      lines.push([

        row.student.student_no ||
        "",

        row.student.name ||
        "",

        ...row.questionScores,

        `${row.total}/${row.maxScore}`,

        row.average.toFixed(
          2
        ),

        `${row.percentage.toFixed(1)}%`,
        row.standardScoreOverall,
        row.standardScoreMunicipality ?? "",
        row.standardScoreSchool ?? "",
        row.rank

      ]);

    }
  );


  const csv =
    lines
      .map(
        line =>
          line
            .map(
              value =>
                `"${String(
                  value ??
                  ""
                ).replaceAll(
                  '"',
                  '""'
                )}"`
            )
            .join(",")
      )
      .join("\r\n");


  const blob =
    new Blob(
      [
        "\uFEFF",
        csv
      ],
      {
        type:
          "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `${currentTest?.name || "成績"}_総括表.csv`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  URL.revokeObjectURL(
    url
  );

}


/* =========================================================
   CLEAR
========================================================= */

function clearResults() {

  currentTest =
    null;

  students =
    [];

  boxes =
    [];

  scores =
    [];

  rows =
    [];


  if (resultBody) {

    resultBody.innerHTML =
      "";

  }


  summaryCards &&
    (
      summaryCards.style.display =
        "none"
    );


  summaryTableCard &&
    (
      summaryTableCard.style.display =
        "none"
    );


  testInformation &&
    (
      testInformation.style.display =
        "none"
    );

}


/* =========================================================
   EMPTY / ERROR
========================================================= */

function renderEmpty(
  text
) {

  if (!resultBody) {

    return;

  }


  resultBody.innerHTML = `

    <tr>

      <td
        colspan="${
          Math.max(
            7 +
            boxes.length,
            1
          )
        }"
        style="
          text-align:center;
          padding:40px;
          color:#777;
        "
      >

        ${escapeHtml(
          text
        )}

      </td>

    </tr>

  `;


  summaryTableCard &&
    (
      summaryTableCard.style.display =
        "block"
    );

}


function showError(
  text
) {

  setStatus(
    text,
    true
  );


  renderEmpty(
    text
  );

}


function setStatus(
  text,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


/* =========================================================
   NUMBER
========================================================= */

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


/* =========================================================
   ESCAPE
========================================================= */

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
