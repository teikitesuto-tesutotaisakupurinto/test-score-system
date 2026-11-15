
/* =========================================================
   テスト成績システム
   結果総括表 完全版

   機能
   ---------------------------------------------------------
   ・テスト選択
   ・生徒番号
   ・氏名
   ・各設問点
   ・合計点
   ・平均点
   ・得点率
   ・順位
   ・CSV出力
   ・印刷
   ・成績・答案公開
   ・公開停止

   公開状態
   ---------------------------------------------------------
   tests.results_published

   true
     ↓
   生徒が閲覧可能

   false
     ↓
   生徒から非公開


   先生権限
   ---------------------------------------------------------
   現在のDB Policy:

   tests_teacher_all
   my_role() = teacher / admin

   そのため、
   tests UPDATE はSupabase RLS側で許可される。


   生徒側
   ---------------------------------------------------------
   student_published_tests_select
   results_published = true

   により公開済みテストのみ取得可能。
========================================================= */


/* =========================================================
   IIFE
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     状態
  ======================================================= */

  let tests = [];

  let selectedTestId = null;

  let testData = null;

  let questionResults = [];

  let answerSheets = [];

  let scores = [];

  let students = [];

  let resultRows = [];


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const teacherName =
    document.getElementById(
      "teacherName"
    );


  const publishButton =
    document.getElementById(
      "publishButton"
    );


  const unpublishButton =
    document.getElementById(
      "unpublishButton"
    );


  const exportCsvButton =
    document.getElementById(
      "exportCsvButton"
    );


  const printButton =
    document.getElementById(
      "printButton"
    );


  const logoutButton =
    document.getElementById(
      "logoutButton"
    );


  /* =======================================================
     初期化
  ======================================================= */

  async function initialize() {

    try {

      /*
        ログイン確認
      */

      const session =
        await getSession();


      if (!session) {

        location.replace(
          "/login"
        );

        return;

      }


      /*
        プロフィール
      */

      const profile =
        await getProfile();


      if (!profile) {

        location.replace(
          "/login"
        );

        return;

      }


      /*
        先生 / 管理者のみ
      */

      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        location.replace(
          "/student/dashboard"
        );

        return;

      }


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      /*
        テスト一覧
      */

      await loadTests();


      /*
        URLからtestを取得
      */

      const params =
        new URLSearchParams(
          window.location.search
        );


      const urlTestId =
        params.get(
          "test"
        );


      if (urlTestId) {

        selectedTestId =
          urlTestId;


        if (testSelect) {

          testSelect.value =
            urlTestId;

        }


        await loadResult(
          urlTestId
        );

      }

    } catch (error) {

      console.error(
        "結果総括表初期化:",
        error
      );


      showError(
        error.message ||
        "結果総括表を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     テスト一覧
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
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          max_score,
          status,
          results_published,
          results_published_at,
          results_published_by
        `)
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data || [];


    if (!testSelect) {

      return;

    }


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


  /* =======================================================
     テスト変更
  ======================================================= */

  if (testSelect) {

    testSelect.addEventListener(
      "change",
      async event => {

        const testId =
          event.target.value;


        if (!testId) {

          clearResult();

          return;

        }


        try {

          await loadResult(
            testId
          );

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "結果を取得できませんでした。"
          );

        }

      }
    );

  }


  /* =======================================================
     結果読み込み
  ======================================================= */

  async function loadResult(
    testId
  ) {

    selectedTestId =
      testId;


    /*
      テスト情報
    */

    testData =
      tests.find(
        test =>
          test.id ===
          testId
      );


    /*
      URLから直接開いた場合など、
      一覧に存在しなければ再取得
    */

    if (!testData) {

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
            results_published_at,
            results_published_by
          `)
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
          "指定されたテストが見つかりません。"
        );

      }


      testData =
        data;

    }


    /*
      生徒
    */

    await loadStudents();


    /*
      答案
    */

    await loadAnswerSheets();


    /*
      解答欄
    */

    await loadQuestions();


    /*
      採点
    */

    await loadScores();


    /*
      結果作成
    */

    buildResultRows();


    /*
      表示
    */

    renderTestInformation();

    renderSummaryCards();

    renderSummaryTable();

    renderPublishState();

  }


  /* =======================================================
     生徒取得
  ======================================================= */

  async function loadStudents() {

    const {
      data,
      error
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


    if (error) {

      throw error;

    }


    students =
      data || [];

  }


  /* =======================================================
     答案取得
  ======================================================= */

  async function loadAnswerSheets() {

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
          selectedTestId
        )
        .neq(
          "status",
          "unmatched"
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


    answerSheets =
      data || [];

  }


  /* =======================================================
     解答欄
  ======================================================= */

  async function loadQuestions() {

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
          selectedTestId
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


    questionResults =
      data || [];

  }


  /* =======================================================
     scores
  ======================================================= */

  async function loadScores() {

    scores =
      [];


    const answerIds =
      answerSheets.map(
        answer =>
          answer.id
      );


    if (!answerIds.length) {

      return;

    }


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
          status,
          marked_by,
          marked_at
        `)
        .in(
          "answer_sheet_id",
          answerIds
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
     結果行作成
  ======================================================= */

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


        if (!existing) {

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
      答案＋設問
      ↓
      点数
    */

    const scoreMap =
      new Map();


    scores.forEach(
      score => {

        const key =
          `${score.answer_sheet_id}__${score.layout_box_id}`;


        scoreMap.set(
          key,
          Number(
            score.score
          ) || 0
        );

      }
    );


    const rows =
      [];


    /*
      全生徒
    */

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

            /*
              合計点降順
            */

            if (
              b.total !==
              a.total
            ) {

              return (
                b.total -
                a.total
              );

            }


            /*
              同点なら生徒番号順
            */

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


    /*
      同順位
      例:
        100 → 1位
        100 → 1位
        90  → 3位
    */

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
      生徒番号順に戻す
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


  /* =======================================================
     テスト情報
  ======================================================= */

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


    const publishBadge =
      testData?.results_published

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
          testData?.name ||
          ""
        )}

      </strong>

      ${publishBadge}

      <br>

      教科：

      ${escapeHtml(
        testData?.subject ||
        "-"
      )}

      ／

      学年：

      ${escapeHtml(
        testData?.grade ||
        "-"
      )}

      ／

      クラス：

      ${escapeHtml(
        testData?.class_name ||
        "-"
      )}

      ／

      満点：

      ${
        testData?.max_score ??
        "-"
      }

      ${
        testData?.results_published_at
          ? `

            <br>

            公開日時：

            ${escapeHtml(
              formatDate(
                testData.results_published_at
              )
            )}

          `
          : ""
      }

    `;

  }


  /* =======================================================
     集計カード
  ======================================================= */

  function renderSummaryCards() {

    const element =
      document.getElementById(
        "summaryCards"
      );


    if (!element) {

      return;

    }


    const completed =
      resultRows.filter(
        row =>
          row.answerSheetId
      );


    const values =
      completed.map(
        row =>
          Number(
            row.total
          ) || 0
      );


    const count =
      values.length;


    const average =
      count > 0

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
      count > 0
        ? Math.max(
            ...values
          )
        : 0;


    const lowest =
      count > 0
        ? Math.min(
            ...values
          )
        : 0;


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


  /* =======================================================
     結果総括表
  ======================================================= */

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
      テスト全体の満点
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

            /*
              平均点

              「各設問の平均」ではなく、
              テストの設問数に対する
              1設問あたりの平均点。
            */

            const averagePoint =
              row.answerSheetId &&
              questionResults.length > 0

                ? row.total /
                  questionResults.length

                : null;


            /*
              得点率
            */

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


  /* =======================================================
     公開状態
  ======================================================= */

  function renderPublishState() {

    if (
      !publishButton ||
      !unpublishButton
    ) {

      return;

    }


    /*
      公開済み
    */

    if (
      testData?.results_published ===
      true
    ) {

      publishButton.disabled =
        true;


      publishButton.textContent =
        "公開済み";


      unpublishButton.disabled =
        false;


      return;

    }


    /*
      非公開
    */

    publishButton.disabled =
      false;


    publishButton.textContent =
      "成績・答案を公開";


    unpublishButton.disabled =
      true;

  }


  /* =======================================================
     公開
  ======================================================= */

  async function publishResults() {

    if (!selectedTestId) {

      alert(
        "テストを選択してください。"
      );


      return;

    }


    if (
      testData?.results_published ===
      true
    ) {

      return;

    }


    /*
      採点済み答案があるか確認
    */

    const markedCount =
      scores.length;


    const message =
      markedCount > 0

        ? `このテストを生徒へ公開します。

採点済み設問数：
${markedCount}件

公開後、生徒は自分の
・採点前答案
・採点済み答案
・成績
を閲覧できます。

公開しますか？`

        : `このテストを生徒へ公開します。

現在、採点済み設問がありません。

公開しますか？`;


    if (
      !confirm(
        message
      )
    ) {

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


    /*
      UPDATE

      現在のPolicy:
      tests_teacher_all
      ALL
      my_role() = teacher/admin

      なので先生権限で更新可能。
    */

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
          status,
          results_published,
          results_published_at,
          results_published_by
        `)
        .single();


    if (error) {

      console.error(
        "成績公開:",
        error
      );


      alert(
        error.message ||
        "成績・答案を公開できませんでした。"
      );


      return;

    }


    testData =
      data;


    /*
      tests配列も更新
    */

    tests =
      tests.map(
        test =>
          test.id ===
          data.id

            ? {
                ...test,
                ...data
              }

            : test
      );


    /*
      表示更新
    */

    renderTestInformation();

    renderPublishState();

    updateTestSelectOption();


    alert(
      "成績・答案を公開しました。"
    );

  }


  /* =======================================================
     公開停止
  ======================================================= */

  async function unpublishResults() {

    if (!selectedTestId) {

      return;

    }


    if (
      testData?.results_published !==
      true
    ) {

      return;

    }


    const ok =
      confirm(
        "このテストの公開を停止します。\n\n生徒から成績と採点済み答案が見えなくなります。\n\n停止しますか？"
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
          status,
          results_published,
          results_published_at,
          results_published_by
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


    /*
      配列更新
    */

    tests =
      tests.map(
        test =>
          test.id ===
          data.id

            ? {
                ...test,
                ...data
              }

            : test
      );


    renderTestInformation();

    renderPublishState();

    updateTestSelectOption();


    alert(
      "公開を停止しました。"
    );

  }


  /* =======================================================
     SELECT表示更新
  ======================================================= */

  function updateTestSelectOption() {

    if (!testSelect) {

      return;

    }


    const option =
      Array.from(
        testSelect.options
      ).find(
        item =>
          item.value ===
          selectedTestId
      );


    if (!option) {

      return;

    }


    option.textContent =

      testData?.results_published

        ? `${testData.name}（公開済み）`

        : testData?.name ||
          "";

  }


  /* =======================================================
     公開ボタン
  ======================================================= */

  if (publishButton) {

    publishButton.addEventListener(
      "click",
      async () => {

        try {

          await publishResults();

        } catch (error) {

          console.error(
            error
          );


          alert(
            error.message ||
            "公開処理に失敗しました。"
          );

        }

      }
    );

  }


  /* =======================================================
     公開停止ボタン
  ======================================================= */

  if (unpublishButton) {

    unpublishButton.addEventListener(
      "click",
      async () => {

        try {

          await unpublishResults();

        } catch (error) {

          console.error(
            error
          );


          alert(
            error.message ||
            "公開停止処理に失敗しました。"
          );

        }

      }
    );

  }


  /* =======================================================
     CSV
  ======================================================= */

  if (exportCsvButton) {

    exportCsvButton.addEventListener(
      "click",
      exportCsv
    );

  }


  function exportCsv() {

    if (
      !resultRows.length
    ) {

      alert(
        "出力する結果がありません。"
      );


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


    /*
      ヘッダー
    */

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


    /*
      データ
    */

    resultRows.forEach(
      row => {

        const averagePoint =
          row.answerSheetId &&
          questionResults.length > 0

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


    /*
      CSV
    */

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
        .join(
          "\r\n"
        );


    const blob =
      new Blob(
        [
          "\uFEFF",
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


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
      url
    );

  }


  /* =======================================================
     印刷
  ======================================================= */

  if (printButton) {

    printButton.addEventListener(
      "click",
      () => {

        if (!testData) {

          alert(
            "テストを選択してください。"
          );


          return;

        }


        window.print();

      }
    );

  }


  /* =======================================================
     Logout
  ======================================================= */

  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      async () => {

        try {

          await logout();

        } catch (error) {

          console.error(
            "Logout:",
            error
          );

        }

      }
    );

  }


  /* =======================================================
     クリア
  ======================================================= */

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


    const testInformation =
      document.getElementById(
        "testInformation"
      );


    if (testInformation) {

      testInformation.style.display =
        "none";

      testInformation.innerHTML =
        "";

    }


    const summaryCards =
      document.getElementById(
        "summaryCards"
      );


    if (summaryCards) {

      summaryCards.style.display =
        "none";

      summaryCards.innerHTML =
        "";

    }


    const summaryTableCard =
      document.getElementById(
        "summaryTableCard"
      );


    if (summaryTableCard) {

      summaryTableCard.style.display =
        "none";

    }


    if (publishButton) {

      publishButton.disabled =
        true;

      publishButton.textContent =
        "成績・答案を公開";

    }


    if (unpublishButton) {

      unpublishButton.disabled =
        true;

    }

  }


  /* =======================================================
     エラー表示
  ======================================================= */

  function showError(
    message
  ) {

    const card =
      document.getElementById(
        "summaryTableCard"
      );


    if (!card) {

      alert(
        message
      );


      return;

    }


    card.style.display =
      "block";


    card.innerHTML = `

      <div
        style="
          padding:20px;
          color:#c62828;
        "
      >

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  /* =======================================================
     日付
  ======================================================= */

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
      "ja-JP",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit"

      }
    );

  }


  /* =======================================================
     ファイル名
  ======================================================= */

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


  /* =======================================================
     HTML Escape
  ======================================================= */

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
