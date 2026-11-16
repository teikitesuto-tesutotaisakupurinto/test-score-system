
/* =========================================================
   テスト成績システム
   js/teacher/test-publish.js

   成績・答案 公開 / 非公開

   公開条件
   ---------------------------------------------------------
   1. テストが存在する
   2. 採点対象のanswer枠が存在する
   3. 生徒紐付け済み答案が存在する
   4. 全答案 × 全採点対象枠の採点が完了している

   question_id
   ---------------------------------------------------------
   NULLでも問題ない。

   注意
   ---------------------------------------------------------
   採点完了だけで成績処理が完了したとはみなさない。

   このファイルでは
   「成績処理完了フラグ」がDBに存在しないため、
   採点完了後に勝手に公開はしない。

   公開処理は成績処理側から
   results_published=true に更新する。

   Teacher / Adminのみ操作可能。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let profile =
    null;

  let tests =
    [];

  let selectedTest =
    null;

  let initialTestId =
    null;


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const statusElement =
    document.getElementById(
      "status"
    );


  const publishButton =
    document.getElementById(
      "publishButton"
    );


  const unpublishButton =
    document.getElementById(
      "unpublishButton"
    );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  async function initialize() {

    try {

      /*
       * 旧 requireTeacher() は使用しない。
       */

      const result =
        await requireRole(
          "teacher"
        );


      if (!result) {

        return;

      }


      profile =
        result.profile;


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      initialTestId =
        window.__INITIAL_TEST_ID__ ||
        new URLSearchParams(
          window.location.search
        ).get(
          "test"
        ) ||
        null;


      setupEvents();


      await loadTests();


      if (
        initialTestId
      ) {

        const found =
          tests.find(
            test =>
              test.id ===
              initialTestId
          );


        if (found) {

          testSelect.value =
            initialTestId;


          selectedTest =
            found;


          await renderStatus();

        } else {

          showStatus(
            "指定されたテストが見つかりません。",
            "error"
          );

        }

      } else {

        renderStatus();

      }

    } catch (error) {

      console.error(
        "test-publish initialize:",
        error
      );


      showStatus(
        error.message ||
        "公開設定画面を読み込めませんでした。",
        "error"
      );

    }

  }


  /* =======================================================
     LOAD TESTS
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
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name,
          results_published,
          results_published_at,
          created_at
          `
        )
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
      data ||
      [];


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

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
      "change",
      async () => {

        selectedTest =
          tests.find(
            test =>
              test.id ===
              testSelect.value
          ) ||
          null;


        await renderStatus();

      }
    );


    /*
     * 手動公開ボタンは、
     * 成績処理完了確認後のみ使用可能。
     */

    publishButton?.addEventListener(
      "click",
      publishTest
    );


    unpublishButton?.addEventListener(
      "click",
      unpublishTest
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


  /* =======================================================
     STATUS
  ======================================================= */

  async function renderStatus() {

    if (!selectedTest) {

      statusElement.className =
        "status";


      statusElement.textContent =
        "テストを選択してください。";


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        true;


      return;

    }


    /*
     * 既に公開中
     */

    if (
      selectedTest.results_published ===
      true
    ) {

      statusElement.className =
        "status public";


      statusElement.innerHTML = `

        <strong>
          公開中
        </strong>

        <br>

        公開日時：
        ${escapeHtml(
          formatDate(
            selectedTest.results_published_at
          )
        )}

      `;


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        false;


      return;

    }


    /*
     * 公開可能条件を確認。
     */

    const completion =
      await checkMarkingCompletion(
        selectedTest.id
      );


    if (!completion.ok) {

      statusElement.className =
        "status private";


      statusElement.innerHTML = `

        <strong>
          非公開
        </strong>

        <br>

        ${escapeHtml(
          completion.message
        )}

      `;


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        true;


      return;

    }


    /*
     * 採点完了しているが、
     * 成績処理完了は別管理。
     */

    statusElement.className =
      "status private";


    statusElement.innerHTML = `

      <strong>
        非公開
      </strong>

      <br>

      全答案の採点は完了しています。

      <br>

      成績・偏差値・順位の処理が完了するまで
      公開できません。

    `;


    /*
     * 成績処理側から公開する仕様。
     */

    publishButton.disabled =
      true;


    unpublishButton.disabled =
      true;

  }


  /* =======================================================
     MARKING COMPLETION
  ======================================================= */

  async function checkMarkingCompletion(
    testId
  ) {

    /*
     * 採点対象枠
     */

    const {
      data: boxData,
      error: boxError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(
          `
          id,
          box_type,
          label
          `
        )
        .eq(
          "test_id",
          testId
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


    const questionBoxes =
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


            return !excludedLabels.has(
              label
            );

          }
        );


    if (!questionBoxes.length) {

      return {

        ok:false,

        message:
          "採点対象の解答欄がありません。"

      };

    }


    /*
     * 生徒紐付け済み答案
     */

    const {
      data: answerData,
      error: answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(
          `
          id,
          student_id
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
        );


    if (answerError) {

      throw answerError;

    }


    const answers =
      answerData ||
      [];


    if (!answers.length) {

      return {

        ok:false,

        message:
          "生徒に紐付いた答案がありません。"

      };

    }


    /*
     * 採点結果
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
          answerIds
        );


    if (scoreError) {

      throw scoreError;

    }


    const scoreSet =
      new Set();


    (scoreData || [])
      .forEach(
        score => {

          if (
            score.status ===
            "marked"
          ) {

            scoreSet.add(
              `${score.answer_sheet_id}:${score.layout_box_id}`
            );

          }

        }
      );


    const totalRequired =
      answers.length *
      questionBoxes.length;


    const totalMarked =
      scoreSet.size;


    if (
      totalMarked <
      totalRequired
    ) {

      return {

        ok:false,

        message:
          `採点未完了です。${totalMarked} / ${totalRequired} 件`

      };

    }


    return {

      ok:true,

      totalRequired,

      totalMarked

    };

  }


  /* =======================================================
     PUBLISH
     -------------------------------------------------------
     現在は成績処理完了フラグがDBにないため、
     この画面から自動公開しない。
  ======================================================= */

  async function publishTest() {

    if (!selectedTest) {

      return;

    }


    /*
     * 安全のため公開禁止。
     *
     * 成績処理完了後に
     * 成績処理側からUPDATEする。
     */

    showStatus(
      "成績・偏差値・順位の処理が完了するまで公開できません。",
      "error"
    );

  }


  /* =======================================================
     UNPUBLISH
  ======================================================= */

  async function unpublishTest() {

    if (!selectedTest) {

      return;

    }


    const confirmed =
      window.confirm(
        `「${selectedTest.name}」を非公開に戻しますか？`
      );


    if (!confirmed) {

      return;

    }


    setButtonsDisabled(
      true
    );


    try {

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
              false,

            results_published_at:
              null

          })
          .eq(
            "id",
            selectedTest.id
          )
          .select(
            `
            id,
            name,
            subject,
            grade,
            class_name,
            results_published,
            results_published_at,
            created_at
            `
          )
          .single();


      if (error) {

        throw error;

      }


      selectedTest =
        data;


      tests =
        tests.map(
          test =>
            test.id ===
            data.id
              ? data
              : test
        );


      await renderStatus();


    } catch (error) {

      console.error(
        "unpublish:",
        error
      );


      showStatus(
        error.message ||
        "非公開への変更に失敗しました。",
        "error"
      );


    } finally {

      await renderStatus();

    }

  }


  /* =======================================================
     BUTTONS
  ======================================================= */

  function setButtonsDisabled(
    disabled
  ) {

    if (!selectedTest) {

      publishButton.disabled =
        true;

      unpublishButton.disabled =
        true;

      return;

    }


    publishButton.disabled =
      disabled ||
      selectedTest.results_published ===
        true;


    unpublishButton.disabled =
      disabled ||
      selectedTest.results_published !==
        true;

  }


  /* =======================================================
     STATUS MESSAGE
  ======================================================= */

  function showStatus(
    message,
    type
  ) {

    statusElement.className =
      "status";


    if (
      type ===
      "error"
    ) {

      statusElement.classList.add(
        "private"
      );

    }


    statusElement.textContent =
      message;

  }


  /* =======================================================
     DATE
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
     ESCAPE
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
