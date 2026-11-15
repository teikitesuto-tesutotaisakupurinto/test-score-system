
(function () {

  "use strict";


  let tests = [];

  let selectedTestId = null;

  let testData = null;

  let questionResults = [];

  let answerSheets = [];

  let scores = [];

  let students = [];

  let resultRows = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    const profile =
      await getProfile();


    if (!profile) {

      location.replace(
        "/login"
      );

      return;

    }


    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {

      location.replace(
        "/student/dashboard"
      );

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name ||
      "先生";


    await loadTests();


    const params =
      new URLSearchParams(
        location.search
      );


    const testId =
      params.get(
        "test"
      );


    if (testId) {

      const select =
        document.getElementById(
          "testSelect"
        );


      select.value =
        testId;


      await loadResult(
        testId
      );

    }

  }


  /* =====================================================
     テスト
  ===================================================== */

  async function loadTests() {

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
          status
        `)
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      console.error(
        error
      );


      return;

    }


    tests =
      data || [];


    const select =
      document.getElementById(
        "testSelect"
      );


    select.innerHTML = `

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
                  test.name
                )}

                ${
                  test.subject
                    ? ` / ${escapeHtml(
                        test.subject
                      )}`
                    : ""
                }

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =====================================================
     テスト変更
  ===================================================== */

  document
    .getElementById(
      "testSelect"
    )
    .addEventListener(
      "change",
      async event => {

        const testId =
          event.target.value;


        if (!testId) {

          clearResult();

          return;

        }


        await loadResult(
          testId
        );

      }
    );


  /* =====================================================
     結果取得
  ===================================================== */

  async function loadResult(
    testId
  ) {

    selectedTestId =
      testId;


    testData =
      tests.find(
        test =>
          test.id ===
          testId
      );


    if (!testData) {

      return;

    }


    /*
      生徒
    */

    const {
      data: studentData,
      error: studentError
    } =
      await supabaseClient
        .from(
          "students"
        )
        .select(`
          id,
          student_no,
          name,
          active
        `)
        .eq(
          "active",
          true
        )
        .order(
          "student_no",
          {
            ascending:true
          }
        );


    if (studentError) {

      console.error(
        studentError
      );


      return;

    }


    students =
      studentData || [];


    /*
      答案
    */

    const {
      data: answerData,
      error: answerError
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
        .neq(
          "status",
          "unmatched"
        );


    if (answerError) {

      console.error(
        answerError
      );


      return;

    }


    answerSheets =
      answerData || [];


    /*
      解答欄
    */

    const {
      data: questionData,
      error: questionError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(`
          id,
          page_no,
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
          "y",
          {
            ascending:true
          }
        )
        .order(
          "x",
          {
            ascending:true
          }
        );


    if (questionError) {

      console.error(
        questionError
      );


      return;

    }


    questionResults =
      questionData || [];


    /*
      scores
    */

    const answerIds =
      answerSheets.map(
        answer =>
          answer.id
      );


    scores =
      [];


    if (
      answerIds.length
    ) {

      const {
        data: scoreData,
        error: scoreError
      } =
        await supabaseClient
          .from(
            "scores"
          )
          .select(`
            id,
            answer_sheet_id,
            layout_box_id,
            score,
            status
          `)
          .in(
            "answer_sheet_id",
            answerIds
          )
          .eq(
            "status",
            "marked"
          );


      if (scoreError) {

        console.error(
          scoreError
        );


        return;

      }


      scores =
        scoreData || [];

    }


    buildResultRows();


    renderTestInformation();

    renderSummaryCards();

    renderSummaryTable();

  }


  /* =====================================================
     結果行
  ===================================================== */

  function buildResultRows() {

    /*
      生徒 → 答案
    */

    const answerByStudent =
      new Map();


    answerSheets.forEach(
      answer => {

        if (
          !answer.student_id
        ) {

          return;

        }


        /*
          同一生徒に複数答案がある場合、
          最新答案を使用する。
        */

        const existing =
          answerByStudent.get(
            answer.student_id
          );


        if (
          !existing ||
          new Date(
            answer.created_at
          ) >
          new Date(
            existing.created_at
          )
        ) {

          answerByStudent.set(
            answer.student_id,
            answer
          );

        }

      }
    );


    /*
      答案＋設問 → 点数
    */

    const scoreMap =
      new Map();


    scores.forEach(
      score => {

        scoreMap.set(
          `${score.answer_sheet_id}__${score.layout_box_id}`,
          Number(
            score.score
          ) || 0
        );

      }
    );


    const rows = [];


    students.forEach(
      student => {

        const answer =
          answerByStudent.get(
            student.id
          );


        const questionScores =
          {};


        let total =
          0;


        questionResults.forEach(
          question => {

            let value =
              null;


            if (answer) {

              const key =
                `${answer.id}__${question.id}`;


              if (
                scoreMap.has(
                  key
                )
              ) {

                value =
                  scoreMap.get(
                    key
                  );


                total +=
                  value;

              }

            }


            questionScores[
              question.id
            ] =
              value;

          }
        );


        rows.push({

          studentId:
            student.id,

          studentNo:
            student.student_no,

          name:
            student.name,

          answerSheetId:
            answer?.id ||
            null,

          questionScores,

          total,

          rank:
            null

        });

      }
    );


    /*
      受験者だけ順位計算
    */

    const ranked =
      rows
        .filter(
          row =>
            row.answerSheetId
        )
        .sort(
          (
            a,
            b
          ) => {

            if (
              b.total !==
              a.total
            ) {

              return (
                b.total -
                a.total
              );

            }


            return String(
              a.studentNo ||
              ""
            ).localeCompare(
              String(
                b.studentNo ||
                ""
              ),
              undefined,
              {
                numeric:true
              }
            );

          }
        );


    let lastScore =
      null;


    let lastRank =
      0;


    ranked.forEach(
      (
        row,
        index
      ) => {

        if (
          lastScore ===
          null ||
          row.total !==
          lastScore
        ) {

          lastRank =
            index + 1;

        }


        row.rank =
          lastRank;


        lastScore =
          row.total;

      }
    );


    /*
      表示は生徒番号順
    */

    rows.sort(
      (
        a,
        b
      ) =>
        String(
          a.studentNo ||
          ""
        ).localeCompare(
          String(
            b.studentNo ||
            ""
          ),
          undefined,
          {
            numeric:true
          }
        )
    );


    resultRows =
      rows;

  }


  /* =====================================================
     テスト情報
  ===================================================== */

  function renderTestInformation() {

    const element =
      document.getElementById(
        "testInformation"
      );


    element.style.display =
      "block";


    element.innerHTML = `

      <strong>
        ${escapeHtml(
          testData.name
        )}
      </strong>

      <br>

      教科：
      ${escapeHtml(
        testData.subject ||
        "-"
      )}

      ／

      学年：
      ${escapeHtml(
        testData.grade ||
        "-"
      )}

      ／

      クラス：
      ${escapeHtml(
        testData.class_name ||
        "-"
      )}

      ／

      満点：
      ${testData.max_score ?? "-"}

    `;

  }


  /* =====================================================
     集計カード
  ===================================================== */

  function renderSummaryCards() {

    const completed =
      resultRows.filter(
        row =>
          row.answerSheetId
      );


    const values =
      completed.map(
        row =>
          row.total
      );


    const count =
      values.length;


    const average =
      count
        ? values.reduce(
            (
              sum,
              value
            ) =>
              sum + value,
            0
          ) /
          count
        : 0;


    const highest =
      count
        ? Math.max(
            ...values
          )
        : 0;


    const lowest =
      count
        ? Math.min(
            ...values
          )
        : 0;


    const element =
      document.getElementById(
        "summaryCards"
      );


    element.style.display =
      "block";


    element.innerHTML = `

      <div class="summary-card-grid">


        <div>

          <div class="summary-card-label">
            受験者数
          </div>

          <div class="summary-card-value">
            ${count}
          </div>

        </div>


        <div>

          <div class="summary-card-label">
            平均点
          </div>

          <div class="summary-card-value">
            ${average.toFixed(1)}
          </div>

        </div>


        <div>

          <div class="summary-card-label">
            最高点
          </div>

          <div class="summary-card-value">
            ${highest}
          </div>

        </div>


        <div>

          <div class="summary-card-label">
            最低点
          </div>

          <div class="summary-card-value">
            ${lowest}
          </div>

        </div>


        <div>

          <div class="summary-card-label">
            設問数
          </div>

          <div class="summary-card-value">
            ${questionResults.length}
          </div>

        </div>


      </div>

    `;

  }


  /* =====================================================
     総括表
  ===================================================== */

  function renderSummaryTable() {

    const card =
      document.getElementById(
        "summaryTableCard"
      );


    card.style.display =
      "block";


    const table =
      document.getElementById(
        "summaryTable"
      );


    const thead =
      table.querySelector(
        "thead"
      );


    const tbody =
      table.querySelector(
        "tbody"
      );


    /*
      満点
    */

    const maxTotal =
      questionResults.reduce(
        (
          sum,
          question
        ) =>
          sum +
          (
            Number(
              question.points
            ) || 0
          ),
        0
      );


    /*
      ヘッダー
    */

    thead.innerHTML = `

      <tr>

        <th>
          順位
        </th>

        <th>
          生徒番号
        </th>

        <th>
          氏名
        </th>

        ${
          questionResults
            .map(
              (
                question,
                index
              ) => `

                <th>

                  ${escapeHtml(
                    question.label ||
                    `問${index + 1}`
                  )}

                  <br>

                  <span
                    style="
                      font-size:11px;
                      font-weight:normal;
                    "
                  >

                    ${question.points ?? "-"}点

                  </span>

                </th>

              `
            )
            .join("")
        }

        <th>
          合計
        </th>

        <th>
          平均点
        </th>

        <th>
          得点率
        </th>

      </tr>

    `;


    /*
      本文
    */

    tbody.innerHTML =
      resultRows
        .map(
          row => {

            const averagePoint =
              row.answerSheetId &&
              questionResults.length
                ? (
                    row.total /
                    questionResults.length
                  )
                : null;


            const percentage =
              row.answerSheetId &&
              maxTotal > 0

                ? (
                    row.total /
                    maxTotal
                  ) *
                  100

                : null;


            return `

              <tr>

                <td
                  class="rank"
                >
                  ${row.rank ?? "-"}
                </td>


                <td>
                  ${escapeHtml(
                    row.studentNo ||
                    ""
                  )}
                </td>


                <td>
                  ${escapeHtml(
                    row.name ||
                    ""
                  )}
                </td>


                ${
                  questionResults
                    .map(
                      question => {

                        const value =
                          row.questionScores[
                            question.id
                          ];


                        return `

                          <td
                            class="center"
                          >

                            ${
                              value === null ||
                              value === undefined

                                ? "-"

                                : value

                            }

                          </td>

                        `;

                      }
                    )
                    .join("")
                }


                <td
                  class="total"
                >

                  ${
                    row.answerSheetId
                      ? row.total
                      : "-"
                  }

                </td>


                <td
                  class="center"
                >

                  ${
                    averagePoint === null
                      ? "-"
                      : averagePoint.toFixed(1)
                  }

                </td>


                <td
                  class="center"
                >

                  ${
                    percentage === null
                      ? "-"
                      : `${percentage.toFixed(1)}%`
                  }

                </td>

              </tr>

            `;

          }
        )
        .join("");

  }


  /* =====================================================
     CSV
  ===================================================== */

  document
    .getElementById(
      "exportCsvButton"
    )
    .addEventListener(
      "click",
      exportCsv
    );


  function exportCsv() {

    if (
      !resultRows.length
    ) {

      return;

    }


    const maxTotal =
      questionResults.reduce(
        (
          sum,
          question
        ) =>
          sum +
          (
            Number(
              question.points
            ) || 0
          ),
        0
      );


    const rows = [];


    rows.push([

      "順位",

      "生徒番号",

      "氏名",

      ...questionResults.map(
        (
          question,
          index
        ) =>
          question.label ||
          `問${index + 1}`
      ),

      "合計",

      "平均点",

      "得点率"

    ]);


    resultRows.forEach(
      row => {

        const averagePoint =
          row.answerSheetId &&
          questionResults.length

            ? row.total /
              questionResults.length

            : "";


        const percentage =
          row.answerSheetId &&
          maxTotal > 0

            ? (
                row.total /
                maxTotal
              ) *
              100

            : "";


        rows.push([

          row.rank ??
            "",

          row.studentNo ||
            "",

          row.name ||
            "",

          ...questionResults.map(
            question =>
              row.questionScores[
                question.id
              ] ?? ""
          ),

          row.answerSheetId
            ? row.total
            : "",

          averagePoint === ""
            ? ""
            : averagePoint.toFixed(1),

          percentage === ""
            ? ""
            : `${percentage.toFixed(1)}%`

        ]);

      }
    );


    const csv =
      rows
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(
                    value
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
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
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
      `${sanitizeFilename(
        testData.name
      )}-結果総括表.csv`;


    link.click();


    URL.revokeObjectURL(
      url
    );

  }


  /* =====================================================
     印刷
  ===================================================== */

  document
    .getElementById(
      "printButton"
    )
    .addEventListener(
      "click",
      () => {

        window.print();

      }
    );


  /* =====================================================
     リセット
  ===================================================== */

  function clearResult() {

    selectedTestId =
      null;

    testData =
      null;

    questionResults =
      [];

    answerSheets =
      [];

    scores =
      [];

    resultRows =
      [];


    document.getElementById(
      "testInformation"
    ).style.display =
      "none";


    document.getElementById(
      "summaryCards"
    ).style.display =
      "none";


    document.getElementById(
      "summaryTableCard"
    ).style.display =
      "none";

  }


  /* =====================================================
     Logout
  ===================================================== */

  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  /* =====================================================
     ファイル名
  ===================================================== */

  function sanitizeFilename(
    value
  ) {

    return String(
      value || ""
    )
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      )
      .trim() ||
      "results";

  }


  /* =====================================================
     Escape
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


    return String(value)
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


  initialize();

})();
