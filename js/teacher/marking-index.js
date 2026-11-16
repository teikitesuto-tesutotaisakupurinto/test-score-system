
"use strict";

/* =========================================================
   デジタル採点 起動

   旧仕様
   ---------------------------------------------------------
   テスト
     ↓
   答案選択
     ↓
   設問選択

   新仕様
   ---------------------------------------------------------
   テスト
     ↓
   採点開始
     ↓
   採点画面
     ↓
   同一設問を複数答案で串刺し採点
========================================================= */


let DB =
  null;


let tests =
  [];

let selectedTestId =
  null;


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "testSelect"
  );


const startButton =
  document.getElementById(
    "startButton"
  );


const statusElement =
  document.getElementById(
    "status"
  );


const testList =
  document.getElementById(
    "testList"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeMarkingIndex
);


async function initializeMarkingIndex() {

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
      "marking-index:",
      error
    );


    showError(
      error.message ||
      "採点画面を起動できませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    () => {

      selectedTestId =
        testSelect.value ||
        null;


      updateStartButton();


      renderStatus();

    }
  );


  startButton?.addEventListener(
    "click",
    startMarking
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
   LOAD TESTS
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
                  )
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  renderTestList();

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
    );


  if (!requested) {

    return;

  }


  if (
    !tests.some(
      test =>
        test.id ===
        requested
    )
  ) {

    return;

  }


  selectedTestId =
    requested;


  testSelect.value =
    requested;


  updateStartButton();


  renderStatus();


  /*
   * test指定で直接来た場合は
   * そのまま採点開始。
   *
   * 「テストを選択してください」の画面を
   * もう一度出さない。
   */

  startMarking();

}


/* =========================================================
   TEST LIST
========================================================= */

function renderTestList() {

  if (!testList) {

    return;

  }


  if (!tests.length) {

    testList.innerHTML = `

      <div
        style="
          padding:25px;
          background:#fff;
          border:1px solid #d0d6dc;
          color:#777;
        "
      >
        テストがありません。
      </div>

    `;

    return;

  }


  testList.innerHTML =
    tests
      .map(
        test => `

          <div class="test-row">


            <div class="test-row-info">


              <div class="test-row-name">

                ${escapeHtml(
                  test.name
                )}

              </div>


              <div class="test-row-meta">

                ${
                  [
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
                    .map(
                      value =>
                        escapeHtml(
                          value
                        )
                    )
                    .join(
                      " / "
                    )
                }

              </div>


            </div>


            <button
              type="button"
              class="btn"
              data-test-id="${escapeHtml(
                test.id
              )}"
            >
              このテストを採点
            </button>


          </div>

        `
      )
      .join("");


  testList
    .querySelectorAll(
      "[data-test-id]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectedTestId =
              button.dataset.testId;


            testSelect.value =
              selectedTestId;


            updateStartButton();


            startMarking();

          }
        );

      }
    );

}


/* =========================================================
   START
========================================================= */

function startMarking() {

  if (!selectedTestId) {

    showError(
      "テストを選択してください。"
    );

    return;

  }


  /*
   * 答案選択画面には行かない。
   */

  location.href =
    `/teacher/marking/mark?test=${encodeURIComponent(
      selectedTestId
    )}`;

}


/* =========================================================
   BUTTON
========================================================= */

function updateStartButton() {

  if (!startButton) {

    return;

  }


  startButton.disabled =
    !selectedTestId;

}


/* =========================================================
   STATUS
========================================================= */

function renderStatus() {

  if (!statusElement) {

    return;

  }


  if (!selectedTestId) {

    statusElement.textContent =
      "テストを選択してください。";

    statusElement.className =
      "marking-status";

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


  statusElement.textContent =
    [
      test.name,
      test.subject,
      test.grade
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
      ) +
      " を採点します。";


  statusElement.className =
    "marking-status";

}


/* =========================================================
   ERROR
========================================================= */

function showError(
  text
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.className =
    "marking-status error";

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
