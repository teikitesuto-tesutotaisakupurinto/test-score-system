
(function () {

  "use strict";


  let testId = null;

  let students = [];

  let boxes = [];

  let scores = [];


  const testSelect =
    document.getElementById(
      "testSelect"
    );

  const resultBody =
    document.getElementById(
      "resultBody"
    );


  async function initialize() {

    const profile =
      await requireTeacher();

    if (!profile) return;


    const name =
      document.getElementById(
        "teacherName"
      );

    if (name) {

      name.textContent =
        profile.name ||
        "先生";

    }


    await loadTests();

    setupEvents();

  }


  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select(
          "id,name"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) throw error;


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        (data || [])
          .map(
            test => `
              <option value="${escapeHtml(
                test.id
              )}">
                ${escapeHtml(
                  test.name
                )}
              </option>
            `
          )
          .join("")
      }

    `;

  }


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

  }


  async function loadResults() {

    if (!testId) {

      resultBody.innerHTML = "";

      return;

    }


    const {
      data:
        boxData,
      error:
        boxError
    } =
      await supabaseClient
        .from("layout_boxes")
        .select(`
          id,
          label,
          points,
          question_id
        `)
        .eq(
          "test_id",
          testId
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (boxError) throw boxError;


    boxes =
      boxData || [];


    const {
      data:
        answerData,
      error:
        answerError
    } =
      await supabaseClient
        .from("answer_sheets")
        .select(`
          id,
          student_id,
          status
        `)
        .eq(
          "test_id",
          testId
        )
        .not(
          "student_id",
          "is",
          null
        );


    if (answerError) throw answerError;


    const answerSheets =
      answerData || [];


    const studentIds =
      [
        ...new Set(
          answerSheets
            .map(
              a => a.student_id
            )
        )
      ];


    const {
      data:
        studentData,
      error:
        studentError
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


    if (studentError) throw studentError;


    students =
      studentData || [];


    const {
      data:
        scoreData,
      error:
        scoreError
    } =
      await supabaseClient
        .from("scores")
        .select(`
          answer_sheet_id,
          layout_box_id,
          score,
          status
        `)
        .in(
          "answer_sheet_id",
          answerSheets.map(
            a => a.id
          )
        );


    if (scoreError) throw scoreError;


    scores =
      scoreData || [];


    const studentMap =
      new Map(
        students.map(
          s => [
            s.id,
            s
          ]
        )
      );


    const scoreMap =
      new Map();


    scores.forEach(
      score => {

        scoreMap.set(
          `${score.answer_sheet_id}:${score.layout_box_id}`,
          Number(
            score.score
          ) || 0
        );

      }
    );


    const rows = [];


    answerSheets.forEach(
      answer => {

        const student =
          studentMap.get(
            answer.student_id
          );


        if (!student) return;


        /*
          同じ生徒に複数答案がある場合、
          最新答案を優先する。
        */

        const existing =
          rows.find(
            row =>
              row.student.id ===
              student.id
          );


        if (existing) return;


        const questionScores =
          boxes.map(
            box => {

              return scoreMap.get(
                `${answer.id}:${box.id}`
              ) ?? 0;

            }
          );


        const total =
          questionScores.reduce(
            (
              sum,
              value
            ) =>
              sum +
              value,
            0
          );


        const average =
          boxes.length
            ? total /
              boxes.length
            : 0;


        rows.push({

          student,

          answer,

          questionScores,

          total,

          average

        });

      }
    );


    /*
      順位

      合計点の降順。

      同点は同順位。
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

  }


  function renderResults(
    rows
  ) {

    if (!rows.length) {

      resultBody.innerHTML = `

        <tr>
          <td colspan="${
            5 + boxes.length
          }">
            結果がありません。
          </td>
        </tr>

      `;

      return;

    }


    resultBody.innerHTML =
      rows.map(
        row => `

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

            ${
              row.questionScores
                .map(
                  score => `
                    <td>
                      ${score}
                    </td>
                  `
                )
                .join("")
            }

            <td>
              ${row.total}
            </td>

            <td>
              ${row.average.toFixed(2)}
            </td>

            <td>
              ${row.rank}
            </td>

          </tr>

        `
      )
      .join("");

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


  initialize();

})();
