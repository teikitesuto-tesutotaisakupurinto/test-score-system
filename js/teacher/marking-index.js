
(function () {

  "use strict";


  let selectedTestId = null;

  let answers = [];

  let regionCounts = new Map();


  const testSelect =
    document.getElementById(
      "testSelect"
    );

  const answerGrid =
    document.getElementById(
      "answerGrid"
    );

  const statusElement =
    document.getElementById(
      "status"
    );


  async function initialize() {

    const profile =
      await requireTeacher();


    if (!profile) {
      return;
    }


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name ||
      "先生";


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

      ${
        (data || [])
          .map(
            test => `

              <option
                value="${escapeHtml(test.id)}"
              >
                ${escapeHtml(test.name)}
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

        selectedTestId =
          testSelect.value ||
          null;

        await loadAnswers();

      }
    );


    document
      .getElementById(
        "refreshButton"
      )
      ?.addEventListener(
        "click",
        loadAnswers
      );


    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        logout
      );

  }


  async function loadAnswers() {

    answerGrid.innerHTML =
      "";


    if (!selectedTestId) {

      statusElement.textContent =
        "テストを選択してください。";

      renderEmpty(
        "テストを選択してください。"
      );

      return;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("answer_sheets")
        .select(`
          id,
          test_id,
          student_id,
          status,
          created_at
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .in(
          "status",
          [
            "uploaded",
            "marked"
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


    answers =
      data || [];


    if (!answers.length) {

      statusElement.textContent =
        "採点対象の答案はありません。";

      renderEmpty(
        "採点対象の答案はありません。"
      );

      return;

    }


    const studentIds =
      [
        ...new Set(
          answers
            .map(
              a => a.student_id
            )
            .filter(Boolean)
        )
      ];


    let studentMap =
      new Map();


    if (studentIds.length) {

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


      if (studentError) {
        throw studentError;
      }


      studentMap =
        new Map(
          (studentData || [])
            .map(
              student => [
                student.id,
                student
              ]
            )
        );

    }


    const answerIds =
      answers.map(
        a => a.id
      );


    regionCounts =
      new Map();


    if (answerIds.length) {

      const {
        data:
          regionData,
        error:
          regionError
      } =
        await supabaseClient
          .from("answer_regions")
          .select(
            "answer_sheet_id"
          )
          .in(
            "answer_sheet_id",
            answerIds
          );


      if (regionError) {
        throw regionError;
      }


      (regionData || [])
        .forEach(
          region => {

            const id =
              region.answer_sheet_id;


            regionCounts.set(
              id,
              (
                regionCounts.get(id) ||
                0
              ) + 1
            );

          }
        );

    }


    renderAnswers(
      studentMap
    );


    statusElement.textContent =
      `${answers.length}件の答案があります。`;

  }


  function renderAnswers(
    studentMap
  ) {

    answerGrid.innerHTML =
      "";


    answers.forEach(
      answer => {

        const student =
          studentMap.get(
            answer.student_id
          );


        const regionCount =
          regionCounts.get(
            answer.id
          ) || 0;


        const card =
          document.createElement(
            "article"
          );


        card.className =
          "answer-card";


        card.innerHTML = `

          <div
            class="answer-card-title"
          >
            ${escapeHtml(
              student
                ? `${student.student_no} / ${student.name}`
                : "生徒未紐付け"
            )}
          </div>


          <div
            class="answer-card-meta"
          >

            状態：
            ${escapeHtml(
              answer.status ===
                "marked"
                ? "採点済み"
                : "未採点"
            )}

            <br>

            解答欄：
            ${regionCount}件

            <br>

            登録：
            ${escapeHtml(
              formatDate(
                answer.created_at
              )
            )}

          </div>

        `;


        const action =
          document.createElement(
            "div"
          );


        action.className =
          "answer-card-actions";


        if (
          student &&
          regionCount > 0
        ) {

          const link =
            document.createElement(
              "a"
            );


          link.className =
            "btn btn-primary";


          /*
            Clean URL
          */

          link.href =
            `/teacher/marking/mark?answer=${encodeURIComponent(
              answer.id
            )}`;


          link.textContent =
            answer.status ===
              "marked"
              ? "採点を再開"
              : "採点開始";


          action.appendChild(
            link
          );

        } else {

          action.textContent =
            student
              ? "解答欄がありません"
              : "生徒未紐付け";

        }


        card.appendChild(
          action
        );


        answerGrid.appendChild(
          card
        );

      }
    );

  }


  function renderEmpty(
    message
  ) {

    answerGrid.innerHTML = `

      <div class="empty">

        ${escapeHtml(message)}

      </div>

    `;

  }


  function formatDate(
    value
  ) {

    if (!value) {
      return "-";
    }


    const date =
      new Date(value);


    return Number.isNaN(
      date.getTime()
    )
      ? "-"
      : date.toLocaleString(
          "ja-JP"
        );

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

  }


  initialize();

})();
