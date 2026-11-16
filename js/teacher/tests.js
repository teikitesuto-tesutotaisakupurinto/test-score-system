
/* =========================================================
   テスト一覧
   js/teacher/tests.js
========================================================= */

"use strict";


let allTests = [];


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeTests() {

  try {

    const profile =
      await getProfile();


    if (!profile) {

      window.location.href =
        "/login";

      return;

    }


    /*
     * 先生・管理者のみ。
     */

    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {

      /*
       * 現在の学生トップ。
       */

      window.location.href =
        "/student/index.html";

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


    setupEvents();


    await loadTests();


  } catch (error) {

    console.error(
      "initializeTests:",
      error
    );


    showError(
      error.message ||
      "テスト一覧を読み込めませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  document
    .getElementById(
      "testSearch"
    )
    ?.addEventListener(
      "input",
      renderTests
    );


  document
    .getElementById(
      "statusFilter"
    )
    ?.addEventListener(
      "change",
      renderTests
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


/* =========================================================
   LOAD TESTS
========================================================= */

async function loadTests() {

  const tbody =
    document.getElementById(
      "testRows"
    );


  if (tbody) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="
            text-align:center;
            padding:30px;
          "
        >
          読み込み中...
        </td>

      </tr>

    `;

  }


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
        test_date,
        max_score,
        status,
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

    console.error(
      "loadTests:",
      error
    );


    showError(
      `テスト情報を取得できませんでした: ${error.message}`
    );


    return;

  }


  allTests =
    data ||
    [];


  renderTests();

}


/* =========================================================
   RENDER
========================================================= */

function renderTests() {

  const tbody =
    document.getElementById(
      "testRows"
    );


  if (!tbody) {

    return;

  }


  const searchElement =
    document.getElementById(
      "testSearch"
    );


  const statusElement =
    document.getElementById(
      "statusFilter"
    );


  const keyword =
    searchElement
      ? searchElement.value
          .trim()
          .toLowerCase()
      : "";


  const status =
    statusElement
      ? statusElement.value
      : "";


  const filtered =
    allTests.filter(
      test => {

        const target =
          [
            test.name,
            test.subject,
            test.grade,
            test.class_name
          ]
            .filter(
              value =>
                value !== null &&
                value !== undefined
            )
            .join(" ")
            .toLowerCase();


        if (
          keyword &&
          !target.includes(
            keyword
          )
        ) {

          return false;

        }


        if (
          status &&
          test.status !==
            status
        ) {

          return false;

        }


        return true;

      }
    );


  if (!filtered.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >
          該当するテストがありません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    filtered
      .map(
        test =>
          renderTestRow(
            test
          )
      )
      .join("");

}


/* =========================================================
   TEST ROW
========================================================= */

function renderTestRow(
  test
) {

  const encoded =
    encodeURIComponent(
      test.id
    );


  /*
   * 現在の実ファイル構成
   *
   * 編集
   *   /teacher/tests/edit
   *
   * 枠設定
   *   /teacher/tests/layout
   *
   * 配点
   *   /teacher/tests/points
   *
   * 採点
   *   /teacher/marking
   *
   * 問題ページは存在しないため
   * /teacher/tests/questions は使用しない。
   */

  return `

    <tr>

      <td>

        <strong>
          ${escapeHtml(
            test.name
          )}
        </strong>

      </td>


      <td>
        ${escapeHtml(
          test.subject ||
          ""
        )}
      </td>


      <td>
        ${escapeHtml(
          test.grade ||
          ""
        )}
      </td>


      <td>
        ${escapeHtml(
          test.test_date ||
          ""
        )}
      </td>


      <td>
        ${formatNumber(
          test.max_score
        )}
      </td>


      <td>
        ${getStatusLabel(
          test.status
        )}
      </td>


      <td>

        <div
          style="
            display:flex;
            flex-wrap:wrap;
            gap:6px;
          "
        >

          <a
            href="/teacher/tests/edit?id=${encoded}"
            class="btn"
          >
            編集
          </a>


          <a
            href="/teacher/tests/layout?id=${encoded}"
            class="btn"
          >
            枠設定
          </a>


          <a
            href="/teacher/tests/points?id=${encoded}"
            class="btn"
          >
            配点
          </a>


          <a
            href="/teacher/marking?test=${encoded}"
            class="btn btn-primary"
          >
            採点
          </a>

        </div>

      </td>

    </tr>

  `;

}


/* =========================================================
   STATUS
========================================================= */

function getStatusLabel(
  status
) {

  const labels = {

    draft:
      "下書き",

    open:
      "実施前",

    marking:
      "採点中",

    completed:
      "採点完了",

    published:
      "公開済み"

  };


  return escapeHtml(
    labels[status] ||
    status ||
    ""
  );

}


/* =========================================================
   FORMAT
========================================================= */

function formatNumber(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "";

  }


  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "";

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


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  const tbody =
    document.getElementById(
      "testRows"
    );


  if (tbody) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="7"
          style="
            text-align:center;
            padding:30px;
            color:#c62828;
          "
        >

          ${escapeHtml(
            message
          )}

        </td>

      </tr>

    `;

  }


  console.error(
    message
  );

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }


  return String(
    value
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


/* =========================================================
   START
========================================================= */

initializeTests();
