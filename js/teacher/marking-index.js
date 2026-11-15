
(function () {

  "use strict";


  let currentTestId = "";


  const teacherName =
    document.getElementById(
      "teacherName"
    );

  const testSelect =
    document.getElementById(
      "testSelect"
    );

  const refreshButton =
    document.getElementById(
      "refreshButton"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const tableWrap =
    document.getElementById(
      "markingTableWrap"
    );


  /* =====================================================
     INIT
  ===================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

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


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      testSelect?.addEventListener(
        "change",
        async () => {

          currentTestId =
            testSelect.value ||
            "";

          await loadAnswers();

        }
      );


      refreshButton?.addEventListener(
        "click",
        loadAnswers
      );


      document
        .getElementById(
          "logoutButton"
        )
        ?.addEventListener(
          "click",
          async event => {

            event.preventDefault();

            if (
              typeof logout ===
              "function"
            ) {

              await logout();

            }

          }
        );


      await loadTests();


    } catch (error) {

      console.error(
        "marking index initialize:",
        error
      );


      showStatus(
        error.message ||
        "採点画面の初期化に失敗しました。",
        true
      );

    }

  }


  /* =====================================================
     TESTS
  ===================================================== */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw new Error(
        `テスト一覧の取得に失敗しました: ${error.message}`
      );

    }


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

    `;


    for (
      const test
      of data || []
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        test.id;


      option.textContent =
        [
          test.name,
          test.subject,
          test.grade
        ]
          .filter(
            value =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== ""
          )
          .join(
            " / "
          );


      testSelect.appendChild(
        option
      );

    }

  }


  /* =====================================================
     ANSWERS
  ===================================================== */

  async function loadAnswers() {

    if (!currentTestId) {

      tableWrap.innerHTML = `

        <div class="empty">
          テストを選択してください。
        </div>

      `;


      showStatus(
        "テストを選択してください。"
      );


      return;

    }


    tableWrap.innerHTML = `

      <div class="empty">
        答案を読み込んでいます...
      </div>

    `;


    showStatus(
      "答案を取得しています..."
    );


    try {

      /*
       * =================================================
       * ANSWER SHEETS
       * =================================================
       */

      const {
        data: answers,
        error: answerError
      } =
        await supabaseClient
          .from("answer_sheets")
          .select(`
            id,
            test_id,
            student_id,
            original_file_path,
            rendered_file_path,
            page_count,
            qr_value,
            status,
            uploaded_at,
            created_at
          `)
          .eq(
            "test_id",
            currentTestId
          )
          .order(
            "uploaded_at",
            {
              ascending: false
            }
          );


      if (answerError) {

        throw new Error(
          `答案取得エラー: ${answerError.message}`
        );

      }


      console.log(
        "marking answers:",
        answers
      );


      if (
        !answers ||
        !answers.length
      ) {

        tableWrap.innerHTML = `

          <div class="empty">
            このテストには答案が登録されていません。
          </div>

        `;


        showStatus(
          "答案がありません。"
        );


        return;

      }


      /*
       * =================================================
       * STUDENTS
       * =================================================
       */

      const studentIds =
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


      let studentMap =
        new Map();


      if (
        studentIds.length
      ) {

        const {
          data: studentData,
          error: studentError
        } =
          await supabaseClient
            .from("students")
            .select(`
              id,
              student_no,
              name
            `)
            .in(
              "id",
              studentIds
            );


        if (studentError) {

          throw new Error(
            `生徒情報取得エラー: ${studentError.message}`
          );

        }


        studentMap =
          new Map(
            (
              studentData ||
              []
            ).map(
              student => [
                student.id,
                student
              ]
            )
          );

      }


      /*
       * =================================================
       * LAYOUT BOXES
       * =================================================
       */

      const {
        data: boxes,
        error: boxError
      } =
        await supabaseClient
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
            points
          `)
          .eq(
            "test_id",
            currentTestId
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


      if (boxError) {

        throw new Error(
          `枠設定取得エラー: ${boxError.message}`
        );

      }


      /*
       * 採点対象
       */

      const questionBoxes =
        (
          boxes ||
          []
        )
          .filter(
            box =>
              String(
                box.box_type ||
                ""
              )
                .trim()
                .toLowerCase() ===
                "answer" &&
              Boolean(
                box.question_id
              )
          );


      /*
       * =================================================
       * SCORES
       * =================================================
       */

      const answerIds =
        answers.map(
          answer =>
            answer.id
        );


      const {
        data: scoreData,
        error: scoreError
      } =
        await supabaseClient
          .from("scores")
          .select(`
            id,
            answer_sheet_id,
            layout_box_id,
            question_id,
            score,
            status
          `)
          .in(
            "answer_sheet_id",
            answerIds
          );


      if (scoreError) {

        throw new Error(
          `採点データ取得エラー: ${scoreError.message}`
        );

      }


      const scoreMap =
        new Map();


      for (
        const score
        of scoreData ||
        []
      ) {

        scoreMap.set(
          `${score.answer_sheet_id}:${score.layout_box_id}`,
          score
        );

      }


      /*
       * =================================================
       * TABLE
       * =================================================
       */

      renderTable(
        answers,
        studentMap,
        questionBoxes,
        scoreMap
      );


      showStatus(
        `${answers.length}件の答案を表示しています。`
      );


    } catch (error) {

      console.error(
        "loadAnswers:",
        error
      );


      tableWrap.innerHTML = `

        <div class="empty">

          答案の取得に失敗しました。

          <br><br>

          ${escapeHtml(
            error.message
          )}

        </div>

      `;


      showStatus(
        error.message ||
        "答案の取得に失敗しました。",
        true
      );

    }

  }


  /* =====================================================
     TABLE
  ===================================================== */

  function renderTable(
    answers,
    studentMap,
    questionBoxes,
    scoreMap
  ) {

    const questionHeaders =
      questionBoxes
        .map(
          box => `

            <th>

              ${escapeHtml(
                box.label ||
                "設問"
              )}

              <br>

              <span
                style="
                  font-weight:400;
                "
              >
                ${formatPoints(
                  box.points
                )}点
              </span>

            </th>

          `
        )
        .join("");


    const rows =
      answers
        .map(
          answer => {

            const student =
              studentMap.get(
                answer.student_id
              );


            let markedCount =
              0;


            let totalScore =
              0;


            const cells =
              questionBoxes
                .map(
                  box => {

                    const score =
                      scoreMap.get(
                        `${answer.id}:${box.id}`
                      );


                    if (
                      score &&
                      score.status ===
                        "marked"
                    ) {

                      markedCount +=
                        1;


                      totalScore +=
                        Number(
                          score.score
                        ) ||
                        0;


                      return `

                        <td
                          class="score-cell marked"
                        >
                          ${escapeHtml(
                            String(
                              score.score
                            )
                          )}
                        </td>

                      `;

                    }


                    return `

                      <td
                        class="score-cell unmarked"
                      >
                        未採点
                      </td>

                    `;

                  }
                )
                .join("");


            const totalQuestions =
              questionBoxes.length;


            const status =
              totalQuestions > 0 &&
              markedCount ===
                totalQuestions
                ? "全設問採点済み"
                : `採点中 ${markedCount}/${totalQuestions}`;


            return `

              <tr>

                <td>

                  <div class="student-no">

                    ${escapeHtml(
                      student?.student_no ||
                      "未紐付け"
                    )}

                  </div>

                </td>


                <td>

                  ${escapeHtml(
                    student?.name ||
                    "-"
                  )}

                </td>


                ${cells}


                <td class="total-cell">

                  ${formatNumber(
                    totalScore
                  )}点

                </td>


                <td>

                  ${escapeHtml(
                    status
                  )}

                </td>


                <td>

                  <a
                    class="btn btn-primary detail-link"
                    href="/teacher/marking/mark?answer=${encodeURIComponent(
                      answer.id
                    )}"
                  >
                    詳細
                  </a>

                </td>

              </tr>

            `;

          }
        )
        .join("");


    tableWrap.innerHTML = `

      <table class="marking-table">

        <thead>

          <tr>

            <th>
              生徒番号
            </th>

            <th>
              生徒名
            </th>

            ${questionHeaders}

            <th>
              合計
            </th>

            <th>
              状態
            </th>

            <th>
              操作
            </th>

          </tr>

        </thead>


        <tbody>

          ${rows}

        </tbody>

      </table>

    `;

  }


  /* =====================================================
     HELPERS
  ===================================================== */

  function formatPoints(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return "0";

    }


    const number =
      Number(
        value
      );


    return Number.isFinite(
      number
    )
      ? String(
          number
        )
      : "0";

  }


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


  function showStatus(
    text,
    error = false
  ) {

    if (!statusElement) {

      return;

    }


    statusElement.textContent =
      text;


    statusElement.style.color =
      error
        ? "#b42318"
        : "#333";

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


})();
