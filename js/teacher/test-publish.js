
"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/test-publish.js

   公開状態確認

   公開処理はここでは行わない。

   正式な流れ
   ---------------------------------------------------------
   採点
      ↓
   全答案・全設問完了
      ↓
   成績処理
      ↓
   結果確定
      ↓
   tests.results_published = true
      ↓
   生徒へ自動公開

   この画面
   ---------------------------------------------------------
   ・現在の状態を確認
   ・公開済み日時を確認
   ・未確定なら理由を表示
========================================================= */


let DB =
  null;

let tests =
  [];

let selectedTest =
  null;


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


const information =
  document.getElementById(
    "testInformation"
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


    const result =
      await requireRole(
        "teacher"
      );


    if (!result) {

      return;

    }


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        result.profile?.name ||
        "先生";

    }


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


    await loadTests();


    const params =
      new URLSearchParams(
        location.search
      );


    const requestedTest =
      params.get(
        "test"
      ) ||
      params.get(
        "id"
      );


    if (
      requestedTest
    ) {

      const found =
        tests.find(
          test =>
            test.id ===
            requestedTest
        );


      if (found) {

        selectedTest =
          found;


        testSelect.value =
          found.id;


        await renderStatus();

        return;

      }

    }


    renderStatus();


  } catch (error) {

    console.error(
      "test-publish:",
      error
    );


    showStatus(
      error.message ||
      "公開状態を取得できませんでした。",
      "error"
    );

  }

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
        results_published_at,
        created_at
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
    data ||
    [];


  if (!testSelect) {

    return;

  }


  testSelect.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

  `;


  tests.forEach(
    test => {

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
          test.grade,
          test.class_name
        ]
          .filter(
            value =>
              value !== null &&
              value !== undefined &&
              String(
                value
              ).trim() !== ""
          )
          .join(
            " / "
          );


      testSelect.appendChild(
        option
      );

    }
  );

}


/* =========================================================
   STATUS
========================================================= */

async function renderStatus() {

  if (!selectedTest) {

    hideInformation();


    showStatus(
      "テストを選択してください。"
    );


    return;

  }


  renderInformation();


  /*
   * すでに公開済み
   */

  if (
    selectedTest.results_published ===
    true
  ) {

    showStatus(
      `
        <div class="status-title">
          結果確定・公開済み
        </div>

        公開日時：
        ${escapeHtml(
          formatDate(
            selectedTest.results_published_at
          )
        )}
      `,
      "public"
    );


    setInformation(
      "processingStatus",
      "完了"
    );


    setInformation(
      "publishedStatus",
      "公開済み"
    );


    return;

  }


  /*
   * 未公開。
   *
   * ここでは公開処理を行わない。
   */

  showStatus(
    `
      <div class="status-title">
        未確定・非公開
      </div>

      成績処理が完了するまで、
      生徒には点数・答案を表示しません。

      <br>

      全採点終了後、成績処理が完了すると
      自動的に公開されます。
    `,
    "processing"
  );


  setInformation(
    "processingStatus",
    "処理中または未確定"
  );


  setInformation(
    "publishedStatus",
    "非公開"
  );

}


/* =========================================================
   INFORMATION
========================================================= */

function renderInformation() {

  if (!information) {

    return;

  }


  information.style.display =
    "grid";


  setInformation(
    "testName",
    selectedTest.name ||
    "-"
  );


  setInformation(
    "testSubject",
    selectedTest.subject ||
    "-"
  );


  setInformation(
    "processingStatus",
    "確認中..."
  );


  setInformation(
    "publishedStatus",
    "確認中..."
  );

}


function hideInformation() {

  if (information) {

    information.style.display =
      "none";

  }

}


function setInformation(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


/* =========================================================
   STATUS
========================================================= */

function showStatus(
  message,
  type = ""
) {

  if (!statusElement) {

    return;

  }


  statusElement.className =
    `status ${
      type || ""
    }`;


  statusElement.innerHTML =
    message;

}


/* =========================================================
   DATE
========================================================= */

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


/* =========================================================
   ESCAPE
========================================================= */

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
