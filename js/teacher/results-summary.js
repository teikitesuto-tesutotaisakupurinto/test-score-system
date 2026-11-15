(function () {

  "use strict";


  let tests = [];

  let selectedTestId = null;

  let studentResults = [];

  let questionResults = [];


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

      document.getElementById(
        "testSelect"
      ).value =
        testId;


      await loadResult(
        testId
      );

    }

  }


  /* =====================================================
     テスト一覧
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
          max_score
        `)
        .order(
          "created_at",
          {
            ascending:
              false
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
                value="${escapeHtml(test.id)}"
              >

                ${escapeHtml(
                  test.name
                )}

                ${
                  test.subject
                    ? ` / ${escapeHtml(test.subject)}`
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


    const test =
      tests.find(
        item =>
          item.id ===
          testId
      );


    if (!test) {

      return;

    }


    /*
      生徒別
    */

    const {
      data:
        students,
      error:
        studentError
    } =
      await supabaseClient
        .from(
          "test_score_summary"
        )
        .select("*")
        .eq(
          "test_id",
          testId
        )
        .order(
          "student_no",
          {
            ascending:
              true
          }
        );


    if (studentError) {

      console.error(
        studentError
      );


      return;

    }


    studentResults =
      students || [];


    /*
      設問別
    */

    const {
      data:
        questions,
      error:
        questionError
    } =
      await supabaseClient
        .from(
          "question_score_summary"
        )
        .select("*")
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
        );


    if (questionError) {

      console.error(
        questionError
      );


      return;

    }


    questionResults =
      questions || [];


    renderTestInformation(
      test
    );


    renderSummaryCards(
      test
    );


    renderSummaryTable();

  }


  /* =====================================================
     テスト情報
  ===================================================== */

  function renderTestInformation(
    test
  ) {

    const element =
      document.getElementById(
        "testInformation"
      );


    element.style.display =
      "block";


    element.innerHTML = `

      <strong>
        ${escapeHtml(
          test.name
        )}
      </strong>

      <br>

      教科：
      ${escapeHtml(
        test.subject ||
        "-"
      )}

      ／

      学年：
      ${escapeHtml(
        test.grade ||
        "-"
      )}

      ／

      クラス：
      ${escapeHtml(
        test.class_name ||
        "-"
      )}

      ／

      満点：
      ${test.max_score}

    `;

  }


  /* =====================================================
     集計カード
  ===================================================== */

  function renderSummaryCards(
    test
  ) {

    const scores =
      studentResults
        .map(
          item =>
            Number(
              item.total_score
            )
        )
        .filter(
          Number.isFinite
        );


    const count =
      scores.length;


    const average =
      count
        ? scores.reduce(
            (
              sum,
              value
            ) =>
              sum + value,
            0
          ) / count
        : 0;


    const max =
      count
        ? Math.max(
            ...scores
          )
        : 0;


    const min =
      count
        ? Math.min(
            ...scores
          )
        : 0;


    const element =
      document.getElementById(
        "summaryCards"
      );


    element.style.display =
      "block";


    element.innerHTML = `

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap:12px;
        "
      >

        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            受験者数
          </div>

          <strong>
            ${count}
          </strong>
          人

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            平均点
          </div>

          <strong>
            ${average.toFixed(1)}
          </strong>
          点

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            最高点
          </div>

          <strong>
            ${max}
          </strong>
          点

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            最低点
          </div>

          <strong>
            ${min}
          </strong>
          点

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
      設問列
    */

    const questionColumns =
      questionResults.map(
        question => ({

          id:
            question.layout_box_id,

          label:
            question.label ||
            "解答欄",

          points:
            question.max_points

        })
      );


    thead.innerHTML = `

      <tr>

        <th
          style="
            border:1px solid #cdd3d9;
            padding:8px;
            background:#f2f4f6;
            white-space:nowrap;
          "
        >
          番号
        </th>


        <th
          style="
            border:1px solid #cdd3d9;
            padding:8px;
            background:#f2f4f6;
            white-space:nowrap;
          "
        >
          氏名
        </th>


        ${
          questionColumns
            .map(
              question => `

                <th
                  style="
                    border:1px solid #cdd3d9;
                    padding:8px;
                    background:#f2f4f6;
                    white-space:nowrap;
                  "
                >

                  ${escapeHtml(
                    question.label
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


        <th
          style="
            border:1px solid #cdd3d9;
            padding:8px;
            background:#f2f4f6;
            white-space:nowrap;
          "
        >
          合計
        </th>

      </tr>

    `;


    tbody.innerHTML =
      studentResults
        .map(
          student => `

            <tr>

              <td
                style="
                  border:1px solid #cdd3d9;
                  padding:8px;
                "
              >
                ${escapeHtml(
                  student.student_no ||
                  ""
                )}
              </td>


              <td
                style="
                  border:1px solid #cdd3d9;
                  padding:8px;
                  white-space:nowrap;
                "
              >
                ${escapeHtml(
                  student.student_name ||
                  ""
                )}
              </td>


              ${
                questionColumns
                  .map(
                    () => `

                      <td
                        style="
                          border:1px solid #cdd3d9;
                          padding:8px;
                          text-align:center;
                        "
                      >
                        -
                      </td>

                    `
                  )
                  .join("")
              }


              <td
                style="
                  border:1px solid #cdd3d9;
                  padding:8px;
                  text-align:center;
                  font-weight:700;
                "
              >
                ${student.total_score}
              </td>

            </tr>

          `
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
      () => {

        exportCsv();

      }
    );


  function exportCsv() {

    if (
      !studentResults.length
    ) {

      return;

    }


    const rows = [];


    rows.push([
      "生徒番号",
      "氏名",
      "合計点",
      "採点済み設問数"
    ]);


    studentResults.forEach(
      student => {

        rows.push([

          student.student_no ||
            "",

          student.student_name ||
            "",

          student.total_score ??
            0,

          student.marked_count ??
            0

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
                  `"${String(value)
                    .replaceAll(
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
      "結果総括表.csv";


    link.click();


    URL.revokeObjectURL(
      url
    );

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
