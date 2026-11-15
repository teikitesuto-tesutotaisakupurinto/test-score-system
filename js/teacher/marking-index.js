
/* =========================================================
   テスト成績システム
   採点答案一覧

   役割:
     tests
       ↓
     answer_sheets
       ↓
     answer_sheet_pages
       ↓
     採点画面

   注意:
     answer_sheets.status = matched は
     「生徒紐付け済み」を意味するだけであり、
     「採点済み」とは判定しない。

   採点完了判定・成績計算完了判定は
   採点データの実構造確認後に行う。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     DOM
  ======================================================= */

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

  const answerGrid =
    document.getElementById(
      "answerGrid"
    );


  /* =======================================================
     INIT
  ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      /*
       * ログイン確認
       */

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


      /*
       * 先生名
       */

      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      /*
       * イベント
       */

      setupEvents();


      /*
       * テスト一覧
       */

      await loadTests();


    } catch (error) {

      console.error(
        "marking-index initialize:",
        error
      );


      showStatus(
        error.message ||
        "採点画面の初期化に失敗しました。",
        true
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
      "change",
      async () => {

        await loadAnswers();

      }
    );


    refreshButton?.addEventListener(
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

  }


  /* =======================================================
     TESTS
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


      const parts = [
        test.name,
        test.subject,
        test.grade
      ]
        .filter(
          value =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        );


      option.textContent =
        parts.join(
          " / "
        );


      testSelect.appendChild(
        option
      );

    }

  }


  /* =======================================================
     ANSWERS
  ======================================================= */

  async function loadAnswers() {

    const testId =
      testSelect?.value ||
      "";


    if (!testId) {

      clearAnswers();


      showStatus(
        "テストを選択してください。"
      );


      return;

    }


    setLoading();


    try {

      /*
       * ----------------------------------------------------
       * answer_sheets
       * ----------------------------------------------------
       */

      const {
        data: answers,
        error: answerError
      } =
        await supabaseClient
          .from(
            "answer_sheets"
          )
          .select(`
            id,
            test_id,
            student_id,
            original_file_path,
            rendered_file_path,
            page_count,
            qr_value,
            status,
            uploaded_by,
            uploaded_at,
            created_at,
            updated_at
          `)
          .eq(
            "test_id",
            testId
          )
          .order(
            "uploaded_at",
            {
              ascending:
                false
            }
          );


      if (answerError) {

        throw new Error(
          `答案一覧の取得に失敗しました: ${answerError.message}`
        );

      }


      /*
       * 答案が本当に0件なのか確認。
       */

      if (
        !answers ||
        !answers.length
      ) {

        clearAnswers();


        showStatus(
          "このテストには登録済みの答案がありません。"
        );


        return;

      }


      /*
       * ----------------------------------------------------
       * 生徒
       * ----------------------------------------------------
       *
       * student_idが存在する答案だけ取得。
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


      let students =
        [];


      if (studentIds.length) {

        const {
          data,
          error
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


        if (error) {

          throw new Error(
            `生徒情報の取得に失敗しました: ${error.message}`
          );

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
       * ----------------------------------------------------
       * answer_sheet_pages
       * ----------------------------------------------------
       */

      const answerIds =
        answers.map(
          answer =>
            answer.id
        );


      const {
        data: pages,
        error: pageError
      } =
        await supabaseClient
          .from(
            "answer_sheet_pages"
          )
          .select(`
            answer_sheet_id,
            page_no,
            file_path,
            file_type,
            original_name,
            width_px,
            height_px
          `)
          .in(
            "answer_sheet_id",
            answerIds
          )
          .order(
            "page_no",
            {
              ascending:
                true
            }
          );


      if (pageError) {

        throw new Error(
          `答案ページの取得に失敗しました: ${pageError.message}`
        );

      }


      /*
       * 答案IDごとのページ数
       */

      const pageMap =
        new Map();


      for (
        const page
        of pages || []
      ) {

        if (
          !pageMap.has(
            page.answer_sheet_id
          )
        ) {

          pageMap.set(
            page.answer_sheet_id,
            []
          );

        }


        pageMap
          .get(
            page.answer_sheet_id
          )
          .push(
            page
          );

      }


      /*
       * カード生成
       */

      renderAnswers(
        answers,
        studentMap,
        pageMap
      );


      showStatus(
        `${answers.length}件の答案を表示しています。`
      );


    } catch (error) {

      console.error(
        "loadAnswers:",
        error
      );


      clearAnswers();


      showStatus(
        error.message ||
        "答案の取得に失敗しました。",
        true
      );

    }

  }


  /* =======================================================
     RENDER
  ======================================================= */

  function renderAnswers(
    answers,
    studentMap,
    pageMap
  ) {

    answerGrid.innerHTML =
      "";


    for (
      const answer
      of answers
    ) {

      const student =
        answer.student_id
          ? studentMap.get(
              answer.student_id
            )
          : null;


      const pages =
        pageMap.get(
          answer.id
        ) ||
        [];


      answerGrid.appendChild(
        createAnswerCard(
          answer,
          student,
          pages
        )
      );

    }

  }


  /* =======================================================
     CARD
  ======================================================= */

  function createAnswerCard(
    answer,
    student,
    pages
  ) {

    const card =
      document.createElement(
        "article"
      );


    card.className =
      "answer-card";


    /*
     * 生徒名
     */

    const title =
      document.createElement(
        "div"
      );


    title.className =
      "answer-card-title";


    if (student) {

      title.textContent =
        `${student.student_no || ""} ${student.name || ""}`.trim();

    } else {

      title.textContent =
        "未紐付け答案";

    }


    /*
     * メタ情報
     */

    const meta =
      document.createElement(
        "div"
      );


    meta.className =
      "answer-card-meta";


    const statusText =
      getAnswerStatusText(
        answer
      );


    const actualPageCount =
      pages.length;


    const registeredPageCount =
      Number(
        answer.page_count ||
        0
      );


    const pageCount =
      actualPageCount ||
      registeredPageCount;


    const lines = [];


    lines.push(
      `答案ID: ${answer.id}`
    );


    lines.push(
      `ページ数: ${pageCount}`
    );


    if (
      answer.qr_value
    ) {

      lines.push(
        `QR: ${answer.qr_value}`
      );

    }


    lines.push(
      `状態: ${statusText}`
    );


    if (
      answer.uploaded_at
    ) {

      lines.push(
        `登録日時: ${formatDate(answer.uploaded_at)}`
      );

    }


    meta.textContent =
      lines.join(
        "\n"
      );


    /*
     * actions
     */

    const actions =
      document.createElement(
        "div"
      );


    actions.className =
      "answer-card-actions";


    /*
     * 詳細
     */

    const detail =
      document.createElement(
        "a"
      );


    detail.className =
      "btn btn-primary";


    detail.textContent =
      "詳細";


    /*
     * 現在のRenderルート:
     *
     * /teacher/marking/mark
     *
     * answer_idを渡す。
     */

    detail.href =
      `/teacher/marking/mark?answer_id=${encodeURIComponent(
        answer.id
      )}`;


    /*
     * 採点
     */

    const marking =
      document.createElement(
        "a"
      );


    marking.className =
      "btn";


    marking.textContent =
      "採点する";


    marking.style.marginTop =
      "8px";


    marking.href =
      `/teacher/marking/mark?answer_id=${encodeURIComponent(
        answer.id
      )}`;


    actions.appendChild(
      detail
    );


    actions.appendChild(
      marking
    );


    card.appendChild(
      title
    );


    card.appendChild(
      meta
    );


    card.appendChild(
      actions
    );


    return card;

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function getAnswerStatusText(
    answer
  ) {

    /*
     * 重要:
     *
     * answer_sheets.status = matched
     * は生徒紐付け状態。
     *
     * 採点済みとは判定しない。
     */

    switch (
      String(
        answer.status ||
        ""
      ).toLowerCase()
    ) {

      case "matched":

        return "生徒紐付け済み・採点前";

      case "unmatched":

        return "未紐付け";

      case "processing":

        return "処理中";

      case "error":

        return "エラー";

      default:

        return (
          answer.status ||
          "未処理"
        );

    }

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearAnswers() {

    answerGrid.innerHTML = `

      <div class="empty">
        テストを選択してください。
      </div>

    `;

  }


  /* =======================================================
     LOADING
  ======================================================= */

  function setLoading() {

    answerGrid.innerHTML = `

      <div class="empty">
        答案を読み込んでいます...
      </div>

    `;


    showStatus(
      "答案を取得しています..."
    );

  }


  /* =======================================================
     STATUS MESSAGE
  ======================================================= */

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


  /* =======================================================
     DATE
  ======================================================= */

  function formatDate(
    value
  ) {

    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return String(
        value
      );

    }


    return date.toLocaleString(
      "ja-JP"
    );

  }


})();
