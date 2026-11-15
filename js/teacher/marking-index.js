
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


      testSelect.addEventListener(
        "change",
        async () => {

          currentTestId =
            testSelect.value ||
            "";

          await loadMarkingTable();

        }
      );


      refreshButton.addEventListener(
        "click",
        loadMarkingTable
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
        error
      );

      showStatus(
        error.message ||
        "初期化に失敗しました。",
        true
      );

    }

  }


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
          .filter(Boolean)
          .join(
            " / "
          );


      testSelect.appendChild(
        option
      );

    }

  }


  async function loadMarkingTable() {

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


    try {

      /*
       * -----------------------------------------------
       * 答案
       * -----------------------------------------------
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
            page_count,
            qr_value,
            status,
            uploaded_at
          `)
          .eq(
            "test_id",
            currentTestId
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


      if (!answers?.length) {

        tableWrap.innerHTML = `

          <div class="empty">
            このテストには答案がありません。
          </div>

        `;

        showStatus(
          "答案がありません。"
        );

        return;

      }


      /*
       * -----------------------------------------------
       * 生徒
       * -----------------------------------------------
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


      if (studentIds.length) {

        const {
          data,
          error
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


        if (error) {

          throw error;

        }


        studentMap =
          new Map(
            (data || [])
              .map(
                student => [
                  student.id,
                  student
                ]
              )
          );

      }


      /*
       * -----------------------------------------------
       * 枠
       * -----------------------------------------------
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
              ascending:true
            }
          )
          .order(
            "created_at",
            {
              ascending:true
            }
          );


      if (boxError) {

        throw boxError;

      }


      /*
       * 採点対象だけ
       */

      const questionBoxes =
        (boxes || [])
          .filter(
            box =>
              String(
                box.box_type ||
                ""
              ).toLowerCase() ===
              "answer" &&
              Boolean(
                box.question_id
              )
          );


      /*
       * -----------------------------------------------
       * scores
       * -----------------------------------------------
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

        throw scoreError;

      }


      const scores =
        scoreData || [];


      const scoreMap =
        new Map();


      for (
        const score
        of scores
      ) {

        scoreMap.set(
          `${score.answer_sheet_id}:${score.layout_box_id}`,
          score
        );

      }


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
        error
      );


      tableWrap.innerHTML = `

        <div class="empty">
          ${escapeHtml(
            error.message ||
            "答案の取得に失敗しました。"
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


  function renderTable(
    answers,
    studentMap,
    questionBoxes,
    scoreMap
  ) {

    /*
     * 問題列
     */

    const questionColumns =
      questionBoxes.map(
        box => {

          const label =
            box.label ||
            "設問";


          return `

            <th>
              ${escapeHtml(label)}
              <br>
              <span style="font-weight:400">
                ${Number(
                  box.points
                ) || 0}点
              </span>
            </th>

          `;

        }
      ).join("");


    const rows =
      answers.map(
        answer => {

          const student =
            studentMap.get(
              answer.student_id
            );


          let markedCount =
            0;


          let totalScore =
            0;


          for (
            const box
            of questionBoxes
          ) {

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
                ) || 0;

            }

          }


          const totalQuestions =
            questionBoxes.length;


          const allMarked =
            totalQuestions > 0 &&
            markedCount ===
              totalQuestions;


          const cells =
            questionBoxes.map(
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

                  return `

                    <td class="question-marked">
                      ${escapeHtml(
                        String(
                          score.score
                        )
                      )}
                    </td>

                  `;

                }


                return `

                  <td class="question-unmarked">
                    未採点
                  </td>

                `;

              }
            ).join("");


          const status =
            allMarked
              ? "全設問採点済み"
              : `採点中 ${markedCount}/${totalQuestions}`;


          return `

            <tr>

              <td>

                <div class="student-name">
                  ${escapeHtml(
                    student
                      ? student.student_no
                      : "未紐付け"
                  )}
                </div>

              </td>


              <td>

                ${escapeHtml(
                  student
                    ? student.name
                    : "-"
                )}

              </td>


              ${cells}


              <td class="total-score">
                ${totalScore}点
              </td>


              <td>
                ${escapeHtml(status)}
              </td>


              <td>

                <a
                  class="btn btn-primary detail-button"
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
      ).join("");


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

            ${questionColumns}

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


  function showStatus(
    text,
    error = false
  ) {

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
