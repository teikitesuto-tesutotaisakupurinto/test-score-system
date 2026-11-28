
"use strict";

/* =========================================================
   テスト公開状態

   重要
   ---------------------------------------------------------
   この画面から「採点が終わっただけ」で
   自動公開はしない。

   公開可能条件
   ---------------------------------------------------------
   1. テストが存在
   2. answer枠が存在
   3. 生徒紐付け答案が存在
   4. 全答案 × 全answer枠が marked
   5. 成績処理が完了している

   ただし現行DBに
   「成績処理完了」の専用フラグがない場合は
   teacherが明示的に公開する。

   生徒側は
   results_published = true
   のときだけ結果を表示する。
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;


/* =========================================================
   DOM
========================================================= */

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


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


    await loadTests();


    selectFromUrl();


  } catch (error) {

    console.error(
      "test-publish:",
      error
    );


    showError(
      error.message ||
      "公開状態を読み込めませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    async () => {

      selectedTestId =
        testSelect.value ||
        null;


      await updateStatus();

    }
  );


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

        await logout();

      }
    );

}


/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

  const {
    data,
    error
  } =
    await DB
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
        results_published_at
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


  tests =
    data || [];


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
                [
                  test.name,
                  test.subject,
                  test.grade,
                  test.class_name
                ]
                  .filter(Boolean)
                  .join(
                    " / "
                  )
              )}

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   URL
========================================================= */

function selectFromUrl() {

  const params =
    new URLSearchParams(
      location.search
    );


  const requested =
    params.get(
      "test"
    ) ||
    params.get(
      "id"
    );


  if (
    requested &&
    tests.some(
      test =>
        test.id ===
        requested
    )
  ) {

    selectedTestId =
      requested;


    testSelect.value =
      requested;


    updateStatus();

  }

}


/* =========================================================
   STATUS
========================================================= */

async function updateStatus() {

  if (!selectedTestId) {

    setStatus(
      "テストを選択してください。"
    );


    publishButton.disabled =
      true;


    unpublishButton.disabled =
      true;


    return;

  }


  const test =
    tests.find(
      item =>
        item.id ===
        selectedTestId
    );


  if (!test) {

    return;

  }


  try {

    setStatus(
      "公開条件を確認しています..."
    );


    const readiness =
      await checkReadiness();


    if (
      test.results_published
    ) {

      setStatus(
        `公開済みです。公開日時：${formatDate(
          test.results_published_at
        )}`
      );


      publishButton.disabled =
        true;


      unpublishButton.disabled =
        false;


      return;

    }


    if (
      readiness.ready
    ) {

      setStatus(
        "成績処理が完了しており、公開可能です。"
      );


      publishButton.disabled =
        false;


    } else {

      setStatus(
        readiness.message,
        true
      );


      publishButton.disabled =
        true;

    }


    unpublishButton.disabled =
      true;


  } catch (error) {

    showError(
      error.message ||
      "公開条件を確認できませんでした。"
    );

  }

}


/* =========================================================
   READINESS
========================================================= */

async function checkReadiness() {

  const {
    data:boxes,
    error:boxError
  } =
    await DB
      .from(
        "layout_boxes"
      )
      .select(
        "id,label,box_role"
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .eq(
        "box_type",
        "answer"
      );


  if (boxError) {

    throw boxError;

  }


  const excludedLabels = new Set(["QR", "氏名", "小計", "合計"]);
  const answerBoxIds = (boxes || [])
    .filter(box => {
      const role = String(box.box_role || "").trim();
      const label = String(box.label || "").trim();
      if (role) return role === "answer";
      return !excludedLabels.has(label) && !/^(大問|小問|問[0-9])/.test(label);
    })
    .map(box => box.id)
    .filter(Boolean);
  const answerBoxCount = answerBoxIds.length;


  if (!answerBoxCount) {

    return {

      ready:false,

      message:
        "採点対象の解答欄がありません。"

    };

  }


  const {
    data:answers,
    error:answerError
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        student_id,
        status
        `
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .not(
        "student_id",
        "is",
        null
      )
      .in(
        "status",
        [
          "matched",
          "marking",
          "marked",
          "published"
        ]
      );


  if (answerError) {

    throw answerError;

  }


  if (!answers?.length) {

    return {

      ready:false,

      message:
        "生徒に紐付いた答案がありません。"

    };

  }


  /*
   * 各答案のscore件数を取得。
   */

  const answerIds =
    answers.map(
      answer =>
        answer.id
    );


  const {
    data:scores,
    error:scoreError
  } =
    await DB
      .from(
        "scores"
      )
      .select(
        `
        answer_sheet_id,
        layout_box_id,
        status
        `
      )
      .in(
        "answer_sheet_id",
        answerIds
      )
      .in(
        "layout_box_id",
        answerBoxIds
      )
      .eq(
        "status",
        "marked"
      );


  if (scoreError) {

    throw scoreError;

  }


  const markedSet =
    new Set(
      (
        scores ||
        []
      ).map(
        score =>
          `${score.answer_sheet_id}:${score.layout_box_id}`
      )
    );


  const required =
    answerIds.length *
    answerBoxCount;


  const marked =
    markedSet.size;


  if (
    marked <
    required
  ) {

    return {

      ready:false,

      message:
        `未採点があります。${marked} / ${required}件が採点済みです。`

    };

  }


  /*
   * 全答案がmarkedになっているかも確認。
   */

  const incomplete =
    answers.filter(
      answer =>
        answer.status !==
        "marked"
    );


  if (incomplete.length) {

    return {

      ready:false,

      message:
        `${incomplete.length}件の答案がまだ確定状態ではありません。`

    };

  }


  return {

    ready:true,

    message:
      "公開可能"

  };

}


/* =========================================================
   PUBLISH
========================================================= */

async function publishTest() {

  if (!selectedTestId) {

    return;

  }


  const readiness =
    await checkReadiness();


  if (
    !readiness.ready
  ) {

    setStatus(
      readiness.message,
      true
    );

    return;

  }


  const confirmed =
    window.confirm(
      "このテストの成績を生徒へ公開しますか？"
    );


  if (!confirmed) {

    return;

  }


  publishButton.disabled =
    true;


  try {

    const { error } = await DB.rpc("set_test_publication", {
      p_test_id: selectedTestId,
      p_publish: true
    });

    if (error) throw error;


    const test =
      tests.find(
        item =>
          item.id ===
          selectedTestId
      );


    if (test) {

      test.results_published =
        true;

      test.results_published_at =
        new Date().toISOString();

    }


    await updateStatus();


  } catch (error) {

    console.error(
      "publish:",
      error
    );


    showError(
      error.message ||
      "公開に失敗しました。"
    );


  } finally {

    publishButton.disabled =
      false;

  }

}


/* =========================================================
   UNPUBLISH
========================================================= */

async function unpublishTest() {

  if (!selectedTestId) {

    return;

  }


  const confirmed =
    window.confirm(
      "公開を停止しますか？生徒画面から結果が見えなくなります。"
    );


  if (!confirmed) {

    return;

  }


  unpublishButton.disabled =
    true;


  try {

    const { error } = await DB.rpc("set_test_publication", {
      p_test_id: selectedTestId,
      p_publish: false
    });

    if (error) throw error;


    const test =
      tests.find(
        item =>
          item.id ===
          selectedTestId
      );


    if (test) {

      test.results_published =
        false;

      test.results_published_at =
        null;

    }


    await updateStatus();


  } catch (error) {

    console.error(
      "unpublish:",
      error
    );


    showError(
      error.message ||
      "公開停止に失敗しました。"
    );


  } finally {

    unpublishButton.disabled =
      false;

  }

}


/* =========================================================
   UI
========================================================= */

function setStatus(
  text,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


function showError(
  text
) {

  setStatus(
    text,
    true
  );

}


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
