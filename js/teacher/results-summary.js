
(function () {

  "use strict";


  /* =====================================================
     STATE
  ===================================================== */

  let testId = null;

  let students = [];

  let boxes = [];

  let scores = [];


  /* =====================================================
     DOM
  ===================================================== */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const resultBody =
    document.getElementById(
      "resultBody"
    );


  /* =====================================================
     INIT
  ===================================================== */

  async function initialize() {

    try {

      /*
       * 現在のauth.jsに合わせる。
       */

      const result =
        await requireRole(
          "teacher"
        );


      if (!result) {

        return;

      }


      const name =
        document.getElementById(
          "teacherName"
        );


      if (name) {

        name.textContent =
          result.profile?.name ||
          "先生";

      }


      await loadTests();


      setupEvents();


    } catch (error) {

      console.error(
        "results-summary initialize:",
        error
      );


      showError(
        error.message ||
        "成績集計を読み込めませんでした。"
      );

    }

  }


  /* =====================================================
     TEST LIST
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
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name
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


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        (data || [])
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
                  test.grade
                    ? ` / ${escapeHtml(
                        test.grade
                      )}`
                    : ""
                }

              </option>

            `
          )
          .join("")
      }

    `;


    /*
     * URL ?test=UUID に対応。
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const requestedTest =
      params.get(
        "test"
      );


    if (
      requestedTest
    ) {

      const exists =
        (data || [])
          .some(
            test =>
              test.id ===
              requestedTest
          );


      if (exists) {

        testSelect.value =
          requestedTest;


        testId =
          requestedTest;


        await loadResults();

      }

    }

  }


  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {

    testSelect.addEventListener(
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

          if (
            typeof window.logout ===
            "function"
          ) {

            await window.logout();

          }

        }
      );

  }


  /* =====================================================
     LOAD RESULTS
  ===================================================== */

  async function loadResults() {

    if (!testId) {

      resultBody.innerHTML =
        "";

      return;

    }


    try {

      /*
       * ---------------------------------------------------
       * 採点対象枠
       * ---------------------------------------------------
       *
       * question_id は使わない。
       *
       * answer枠を対象にする。
       */

      const {
        data:
          boxData,
        error:
          boxError
      } =
        await supabaseClient
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


      if (boxError) {

        throw boxError;

      }


      const excludedLabels =
        new Set([
          "QR",
          "氏名",
          "合計",
          "小計"
        ]);


      boxes =
        (boxData || [])
          .filter(
            box => {

              const type =
                String(
                  box.box_type ||
                  ""
                )
                .trim()
                .toLowerCase();


              /*
               * answer枠だけ。
               */

              if (
                type !==
                "answer"
              ) {

                return false;

              }


              const label =
                String(
                  box.label ||
                  ""
                ).trim();


              /*
               * 集計枠は除外。
               */

              if (
                excludedLabels.has(
                  label
                )
              ) {

                return false;

              }


              return true;

            }
          );


      /*
       * ---------------------------------------------------
       * 答案
       * ---------------------------------------------------
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
          .order(
            "uploaded_at",
            {
              ascending:false
            }
          );


      if (answerError) {

        throw answerError;

      }


      const answerSheets =
        answerData ||
        [];


      if (!answerSheets.length) {

        renderEmpty(
          "生徒に紐付いた答案がありません。"
        );

        return;

      }


      /*
       * ---------------------------------------------------
       * STUDENTS
       * ---------------------------------------------------
       */

      const studentIds =
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


      students =
        [];


      if (
        studentIds.length
      ) {

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

          throw studentError;

        }


        students =
          studentData ||
          [];

      }


      /*
       * ---------------------------------------------------
       * SCORES
       * ---------------------------------------------------
       */

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
            answerSheets.map(
              answer =>
                answer.id
            )
          );


      if (scoreError) {

        throw scoreError;

      }


      scores =
        scoreData ||
        [];


      /*
       * ---------------------------------------------------
       * MAP
       * ---------------------------------------------------
       */

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

          /*
           * 採点済みだけ結果として使用。
           */

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


      /*
       * ---------------------------------------------------
       * 最新答案を生徒ごとに使用
       * ---------------------------------------------------
       */

      const latestAnswerMap =
        new Map();


      answerSheets.forEach(
        answer => {

          if (
            !latestAnswerMap.has(
              answer.student_id
            )
          ) {

            latestAnswerMap.set(
              answer.student_id,
              answer
            );

          }

        }
      );


      /*
       * ---------------------------------------------------
       * ROWS
       * ---------------------------------------------------
       */

      const rows =
        [];


      latestAnswerMap.forEach(
        answer => {

          const student =
            studentMap.get(
              answer.student_id
            );


          if (!student) {

            return;

          }


          /*
           * 各設問の得点
           */

          const questionScores =
            boxes.map(
              box => {

                return (
                  scoreMap.get(
                    `${answer.id}:${box.id}`
                  ) ??
                  0
                );

              }
            );


          /*
           * 合計
           */

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


          /*
           * 設問平均
           */

          const average =
            boxes.length
              ? total /
                boxes.length
              : 0;


          /*
           * 配点合計
           */

          const maxScore =
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


          /*
           * 得点率
           */

          const percentage =
            maxScore > 0
              ? total /
                maxScore *
                100
              : 0;


          rows.push({

            student,

            answer,

            questionScores,

            total,

            average,

            maxScore,

            percentage,

            rank:
              null

          });

        }
      );


      /*
       * ---------------------------------------------------
       * RANK
       * ---------------------------------------------------
       *
       * 合計点の降順。
       * 同点は同順位。
       */

      rows.sort(
        (
          a,
          b
        ) =>
          b.total -
          a.total
      );


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
            previousScore !==
              null &&
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


      renderResults(
        rows
      );


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


  /* =====================================================
     RENDER
  ===================================================== */

  function renderResults(
    rows
  ) {

    if (!rows.length) {

      renderEmpty(
        "結果がありません。"
      );

      return;

    }


    resultBody.innerHTML =
      rows
        .map(
          row => {

            const questionCells =
              row.questionScores
                .map(
                  score => `

                    <td>
                      ${escapeHtml(
                        formatNumber(
                          score
                        )
                      )}
                    </td>

                  `
                )
                .join("");


            return `

              <tr>

                <td>
                  ${escapeHtml(
                    row.student.student_no
                  )}
                </td>


                <td>
                  ${escapeHtml(
                    row.student.name
                  )}
                </td>


                ${questionCells}


                <td>
                  ${escapeHtml(
                    formatNumber(
                      row.total
                    )
                  )}
                  /
                  ${escapeHtml(
                    formatNumber(
                      row.maxScore
                    )
                  )}
                </td>


                <td>
                  ${escapeHtml(
                    row.average.toFixed(
                      2
                    )
                  )}
                </td>


                <td>
                  ${escapeHtml(
                    row.percentage.toFixed(
                      1
                    )
                  )}%
                </td>


                <td>
                  ${escapeHtml(
                    String(
                      row.rank
                    )
                  )}
                </td>

              </tr>

            `;

          }
        )
        .join("");

  }


  /* =====================================================
     EMPTY
  ===================================================== */

  function renderEmpty(
    message
  ) {

    resultBody.innerHTML = `

      <tr>

        <td
          colspan="${
            7 +
            boxes.length
          }"
          style="
            text-align:center;
            padding:40px;
          "
        >

          ${escapeHtml(
            message
          )}

        </td>

      </tr>

    `;

  }


  /* =====================================================
     ERROR
  ===================================================== */

  function showError(
    message
  ) {

    renderEmpty(
      message
    );

  }


  /* =====================================================
     FORMAT
  ===================================================== */

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
     START
  ===================================================== */

  initialize();

})();
