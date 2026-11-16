
"use strict";

/* =========================================================
   テスト一覧
========================================================= */

let DB = null;

let allTests = [];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeTests
);


async function initializeTests() {

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

        await logout();

      }
    );

}


/* =========================================================
   LOAD
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
        test_date,
        max_score,
        status,
        results_published,
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


  allTests =
    data || [];


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


  const keyword =
    (
      document.getElementById(
        "testSearch"
      )?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const status =
    document.getElementById(
      "statusFilter"
    )?.value ||
    "";


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
            .filter(Boolean)
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
        renderTestRow
      )
      .join("");

}


/* =========================================================
   ROW
========================================================= */

function renderTestRow(
  test
) {

  const id =
    encodeURIComponent(
      test.id
    );


  const status =
    test.results_published
      ? "published"
      : (
          test.status ||
          "draft"
        );


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
        ${escapeHtml(
          getStatusLabel(
            status
          )
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
            href="/teacher/tests/edit?id=${id}"
            class="btn"
          >
            編集
          </a>


          <a
            href="/teacher/tests/pages?test=${id}"
            class="btn"
          >
            解答用紙
          </a>


          <a
            href="/teacher/tests/layout?test=${id}"
            class="btn"
          >
            枠設定
          </a>


          <a
            href="/teacher/tests/points?test=${id}"
            class="btn"
          >
            配点
          </a>


          <a
            href="/teacher/tests/model-answer?test=${id}"
            class="btn"
          >
            模範解答
          </a>


          <a
            href="/teacher/marking?test=${id}"
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


  return (
    labels[
      status
    ] ||
    status ||
    ""
  );

}


/* =========================================================
   NUMBER
========================================================= */

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


  if (!tbody) {

    return;

  }


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
