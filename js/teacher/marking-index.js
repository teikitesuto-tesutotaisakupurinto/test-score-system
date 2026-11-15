
/* =========================================================
   テスト成績システム
   採点答案選択

   流れ
   ---------------------------------------------------------
   テスト選択
      ↓
   answer_sheets
      ↓
   student_id
      ↓
   answer_regions存在確認
      ↓
   採点画面
      ↓
   /teacher/marking/mark.html?answer=ANSWER_ID

   注意
   ---------------------------------------------------------
   ・未紐付け答案は採点対象にしない
   ・answer_regionsがない答案は採点対象にしない
   ・元答案画像には何も描画しない
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     State
  ======================================================= */

  let profile = null;

  let selectedTestId = null;

  let answers = [];

  let regionCounts = new Map();


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const refreshButton =
    document.getElementById(
      "refreshButton"
    );


  const answerGrid =
    document.getElementById(
      "answerGrid"
    );


  const statusElement =
    document.getElementById(
      "status"
    );


  /* =======================================================
     Initialize
  ======================================================= */

  async function initialize() {

    try {

      profile =
        await requireTeacher();


      if (!profile) {

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

      setupEvents();

    } catch (error) {

      console.error(
        "marking-index initialize:",
        error
      );


      showError(
        error.message ||
        "採点一覧を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     Tests
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
          created_at
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

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     Events
  ======================================================= */

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


    refreshButton.addEventListener(
      "click",
      async () => {

        await loadAnswers();

      }
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


  /* =======================================================
     Answers
  ======================================================= */

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


    statusElement.textContent =
      "答案を読み込んでいます...";


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
            ascending:
              false
          }
        );


    if (answerError) {

      throw answerError;

    }


    answers =
      answerData || [];


    if (!answers.length) {

      statusElement.textContent =
        "採点対象の答案はありません。";


      renderEmpty(
        "採点対象の答案はありません。"
      );


      return;

    }


    /*
      生徒
    */

    const studentIds =
      [
        ...new Set(
          answers
            .map(
              answer =>
                answer.student_id
            )
            .filter(
              Boolean
            )
        )
      ];


    let students =
      [];


    if (
      studentIds.length
    ) {

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
            name
          `)
          .in(
            "id",
            studentIds
          );


      if (error) {

        throw error;

      }


      students =
        data || [];

    }


    const studentMap =
      new Map(
        students.map(
          student => [
            student.id,
            student
          ]
        )
      );


    /*
      answer_regions件数
    */

    const answerIds =
      answers.map(
        answer =>
          answer.id
      );


    regionCounts =
      new Map();


    if (
      answerIds.length
    ) {

      const {
        data:
          regions,
        error:
          regionError
      } =
        await supabaseClient
          .from(
            "answer_regions"
          )
          .select(`
            answer_sheet_id
          `)
          .in(
            "answer_sheet_id",
            answerIds
          );


      if (regionError) {

        throw regionError;

      }


      (
        regions ||
        []
      ).forEach(
        region => {

          regionCounts.set(

            region.answer_sheet_id,

            (
              regionCounts.get(
                region.answer_sheet_id
              ) ||
              0
            ) + 1

          );

        }
      );

    }


    /*
      表示
    */

    renderAnswers(
      studentMap
    );


    statusElement.textContent =
      `${answers.length}件の答案があります。`;

  }


  /* =======================================================
     Render
  ======================================================= */

  function renderAnswers(
    studentMap
  ) {

    answerGrid.innerHTML =
      "";


    if (!answers.length) {

      renderEmpty(
        "採点対象の答案はありません。"
      );


      return;

    }


    answers.forEach(
      answer => {

        const student =
          studentMap.get(
            answer.student_id
          );


        const regionCount =
          regionCounts.get(
            answer.id
          ) ||
          0;


        const card =
          document.createElement(
            "article"
          );


        card.className =
          "answer-card";


        const title =
          document.createElement(
            "div"
          );


        title.className =
          "answer-card-title";


        title.textContent =
          student

            ? `${student.student_no} / ${student.name}`

            : "生徒未紐付け";


        card.appendChild(
          title
        );


        const meta =
          document.createElement(
            "div"
          );


        meta.className =
          "answer-card-meta";


        meta.innerHTML = `

          状態：
          ${escapeHtml(
            getStatusText(
              answer.status
            )
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

        `;


        card.appendChild(
          meta
        );


        const actions =
          document.createElement(
            "div"
          );


        actions.className =
          "answer-card-actions";


        /*
          採点対象条件
        */

        const canMark =
          Boolean(
            student
          ) &&
          regionCount > 0;


        if (canMark) {

          const link =
            document.createElement(
              "a"
            );


          link.className =
            "btn btn-primary";


          link.href =
            `/teacher/marking/mark.html?answer=${encodeURIComponent(
              answer.id
            )}`;


          link.textContent =
            answer.status ===
              "marked"

              ? "採点を再開"

              : "採点開始";


          actions.appendChild(
            link
          );

        } else {

          const disabled =
            document.createElement(
              "div"
            );


          disabled.style.color =
            "#777";


          disabled.style.fontSize =
            "12px";


          disabled.textContent =
            !student

              ? "生徒未紐付け"

              : "解答欄が作成されていません";


          actions.appendChild(
            disabled
          );

        }


        card.appendChild(
          actions
        );


        answerGrid.appendChild(
          card
        );

      }
    );

  }


  /* =======================================================
     Status
  ======================================================= */

  function getStatusText(
    status
  ) {

    switch (
      status
    ) {

      case "uploaded":
        return "未採点";

      case "marked":
        return "採点済み";

      case "unmatched":
        return "未紐付け";

      default:
        return status || "-";

    }

  }


  /* =======================================================
     Empty
  ======================================================= */

  function renderEmpty(
    message
  ) {

    answerGrid.innerHTML = `

      <div class="empty">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  /* =======================================================
     Error
  ======================================================= */

  function showError(
    message
  ) {

    statusElement.textContent =
      message;


    renderEmpty(
      message
    );

  }


  /* =======================================================
     Date
  ======================================================= */

  function formatDate(
    value
  ) {

    if (!value) {

      return "-";

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

      return "-";

    }


    return date.toLocaleString(
      "ja-JP"
    );

  }


  /* =======================================================
     Escape
  ======================================================= */

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
