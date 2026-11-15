
/* =========================================================
   テスト成績システム
   結果総括表 完全版

   機能

   ・テスト選択
   ・生徒番号
   ・氏名
   ・各設問点
   ・合計点
   ・平均点
   ・得点率
   ・順位
   ・CSV
   ・印刷
   ・成績公開
   ・公開停止

   公開

   tests.results_published = true

   生徒は公開済みテストのみ閲覧可能。
========================================================= */


(function () {

  "use strict";


  /* =====================================================
     状態
  ===================================================== */

  let tests = [];

  let selectedTestId =
    null;

  let testData =
    null;

  let questionResults =
    [];

  let answerSheets =
    [];

  let scores =
    [];

  let students =
    [];

  let resultRows =
    [];


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
      profile.role !==
        "teacher" &&
      profile.role !==
        "admin"
    ) {

      location.replace(
        "/student/dashboard"
      );

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


      if (select) {

        select.value =
          testId;

      }


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
          max_score,
          status,
          results_published,
          results_published_at
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
        "テスト一覧:",
        error
      );


      showError(
        "テスト一覧を取得できませんでした。"
      );


      return;

    }


    tests =
      data || [];


    const select =
      document.getElementById(
        "testSelect"
      );


    if (!select) {

      return;

    }


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

                ${
                  test.results_published
                    ? "（公開済み）"
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
     テスト選択
  ===================================================== */

  document
    .getElementById(
      "testSelect"
    )
    ?.addEventListener(
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
      data:
        studentData,
      error:
        studentError
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
            ascending:
              true
          }
        );


    if (studentError) {

      console.error(
        "生徒:",
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
      data:
        answerData,
      error:
        answerError
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
        "答案:",
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
      data:
        questionData,
      error:
        questionError
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


    if (questionError) {

      console.error(
        "解答欄:",
        questionError
      );


      return;

    }


    questionResults =
      questionData || [];


    /*
      scores
    */

    scores =
      [];


    const answerIds =
      answerSheets.map(
        answer =>
          answer.id
      );


    if (
      answerIds.length
    ) {

      const {
        data:
          scoreData,
        error:
          scoreError
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
          "採点:",
          scoreError
        );


        return;

      }


      scores =
        scoreData || [];

    }


    /*
      結果作成
    */

    buildResultRows();


    renderTestInformation();

    renderSummaryCards();

    renderSummaryTable();

    renderPublishState();

  }


  /* =====================================================
     結果行作成
  ===================================================== */

  function buildResultRows() {

    /*
      生徒 → 最新答案
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


        const existing =
          answerByStudent.get(
            answer.student_id
          );


        if (
          !existing
        ) {

          answerByStudent.set(
            answer.student_id,
            answer
          );

          return;

        }


        if (
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


    const rows =
      [];


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


            if (
              answer
            ) {

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
      順位計算
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
                numeric:
                  true
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
      生徒番号順
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
            numeric:
              true
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


    if (!element) {

      return;

    }


    element.style.display =
      "block";


    const publishText =
      testData.results_published

        ? `

          <span
            style="
              display:inline-block;
              margin-left:10px;
              padding:3px 8px;
              border-radius:3px;
              background:#e8f5e9;
              color:#26743b;
              font-size:12px;
            "
          >
            公開済み
          </span>

        `

        : `

          <span
            style="
              display:inline-block;
              margin-left:10px;
              padding:3px 8px;
              border-radius:3px;
              background:#f3f4f6;
              color:#666;
              font-size:12px;
            "
          >
            非公開
          </span>

        `;


    element.innerHTML = `

      <strong>

        ${escapeHtml(
          testData.name
        )}

      </strong>

      ${publishText}

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

      ${
        testData.results_published_at
          ? `

            <br>

            公開日時：
            ${formatDate(
              testData.results_published_at
            )}

          `
          : ""
      }

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


    if (!element) {

      return;

    }


    element.style.display =
      "block";


    element.innerHTML = `

      <div
        class="summary-card-grid"
      >

        <div>

          <div
            class="summary-card-label"
          >
            受験者数
          </div>

          <div
            class="summary-card-value"
          >
            ${count}
          </div>

        </div>


        <div>

          <div
            class="summary-card-label"
          >
            平均点
          </div>

          <div
            class="summary-card-value"
          >
            ${average.toFixed(1)}
          </div>

        </div>


        <div>

          <div
            class="summary-card-label"
          >
            最高点
          </div>

          <div
            class="summary-card-value"
          >
            ${highest}
          </div>

        </div>


        <div>

          <div
            class="summary-card-label"
          >
            最低点
          </div>

          <div
            class="summary-card-value"
          >
            ${lowest}
          </div>

        </div>


        <div>

          <div
            class="summary-card-label"
          >
            設問数
          </div>

          <div
            class="summary-card-value"
          >
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


    const table =
      document.getElementById(
        "summaryTable"
      );


    if (
      !card ||
      !table
    ) {

      return;

    }


    card.style.display =
      "block";


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

                    ${
                      question.points ??
                      "-"
                    }点

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

                ? row.total /
                  questionResults.length

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

                <td class="rank">

                  ${
                    row.rank ??
                    "-"
                  }

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


                <td class="total">

                  ${
                    row.answerSheetId
                      ? row.total
                      : "-"
                  }

                </td>


                <td class="center">

                  ${
                    averagePoint === null
                      ? "-"
                      : averagePoint.toFixed(1)
                  }

                </td>


                <td class="center">

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
     公開状態
  ===================================================== */

  function renderPublishState() {

    const publishButton =
      document.getElementById(
        "publishButton"
      );


    const unpublishButton =
      document.getElementById(
        "unpublishButton"
      );


    if (
      !publishButton ||
      !unpublishButton
    ) {

      return;

    }


    if (
      testData?.results_published
    ) {

      publishButton.disabled =
        true;


      publishButton.textContent =
        "公開済み";


      unpublishButton.disabled =
        false;

    } else {

      publishButton.disabled =
        false;


      publishButton.textContent =
        "成績・答案を公開";


      unpublishButton.disabled =
        true;

    }

  }


  /* =====================================================
     公開
  ===================================================== */

  async function publishResults() {

    if (!selectedTestId) {

      alert(
        "テストを選択してください。"
      );


      return;

    }


    if (
      testData?.results_published
    ) {

      return;

    }


    const ok =
      confirm(
        "このテストの成績と採点済み答案を生徒へ公開します。\n\n公開後、生徒は自分の採点前答案と採点済み答案を閲覧できます。\n\n公開しますか？"
      );


    if (!ok) {

      return;

    }


    const session =
      await getSession();


    if (!session) {

      location.replace(
        "/login"
      );

      return;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .update({

          results_published:
            true,

          results_published_at:
            new Date()
              .toISOString(),

          results_published_by:
            session.user.id

        })
        .eq(
          "id",
          selectedTestId
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
        .single();


    if (error) {

      console.error(
        "公開:",
        error
      );


      alert(
        error.message ||
        "公開できませんでした。"
      );


      return;

    }


    testData =
      data;


    renderTestInformation();

    renderPublishState();


    /*
      SELECTの表示も更新
    */

    const option =
      document.querySelector(
        `#testSelect option[value="${CSS.escape(
          selectedTestId
        )}"]`
      );


    if (option) {

      option.textContent =
        `${testData.name}（公開済み）`;

    }


    alert(
      "成績と答案を公開しました。"
    );

  }


  /* =====================================================
     公開停止
  ===================================================== */

  async function unpublishResults() {

    if (!selectedTestId) {

      return;

    }


    const ok =
      confirm(
        "このテストの生徒向け公開を停止します。\n\n生徒から成績・採点済み答案が見えなくなります。\n\n停止しますか？"
      );


    if (!ok) {

      return;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .update({

          results_published:
            false

        })
        .eq(
          "id",
          selectedTestId
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
        .single();


    if (error) {

      console.error(
        "公開停止:",
        error
      );


      alert(
        error.message ||
        "公開を停止できませんでした。"
      );


      return;

    }


    testData =
      data;


    renderTestInformation();

    renderPublishState();


    const option =
      document.querySelector(
        `#testSelect option[value="${CSS.escape(
          selectedTestId
        )}"]`
      );


    if (option) {

      option.textContent =
        testData.name;

    }


    alert(
      "公開を停止しました。"
    );

  }


  /* =====================================================
     公開ボタン
  ===================================================== */

  document
    .getElementById(
      "publishButton"
    )
    ?.addEventListener(
      "click",
      publishResults
    );


  document
    .getElementById(
      "unpublishButton"
    )
    ?.addEventListener(
      "click",
      unpublishResults
    );


  /* =====================================================
     CSV
  ===================================================== */

  document
    .getElementById(
      "exportCsvButton"
    )
    ?.addEventListener(
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


    const rows =
      [];


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
        testData?.name
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
    ?.addEventListener(
      "click",
      () => {

        window.print();

      }
    );


  /* =====================================================
     クリア
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


    const publishButton =
      document.getElementById(
        "publishButton"
      );


    const unpublishButton =
      document.getElementById(
        "unpublishButton"
      );


    if (publishButton) {

      publishButton.disabled =
        true;

    }


    if (unpublishButton) {

      unpublishButton.disabled =
        true;

    }

  }


  /* =====================================================
     エラー
  ===================================================== */

  function showError(
    message
  ) {

    const element =
      document.getElementById(
        "summaryTableCard"
      );


    if (!element) {

      return;

    }


    element.style.display =
      "block";


    element.innerHTML = `

      <div
        style="
          color:#c62828;
          padding:20px;
        "
      >

        ${escapeHtml(
          message
        )}

      </div>

    `;

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
     HTML escape
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
     START
  ===================================================== */

  initialize();

})();
