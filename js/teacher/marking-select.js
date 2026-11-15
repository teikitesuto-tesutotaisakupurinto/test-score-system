/* =========================================================
   デジタル採点
   採点対象選択
========================================================= */

let markingTests = [];

let selectedTest = null;

let answerSheets = [];

let layoutBoxes = [];


/* =========================================================
   初期化
========================================================= */

async function initializeMarkingSelect() {

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


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name ||
    "先生";


  const params =
    new URLSearchParams(
      location.search
    );


  const testId =
    params.get(
      "test"
    );


  await loadTests();


  if (testId) {

    const select =
      document.getElementById(
        "testSelect"
      );


    select.value =
      testId;


    await loadSelectedTest(
      testId
    );

  }

}


/* =========================================================
   テスト一覧
========================================================= */

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
        max_score,
        status
      `)
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {

    console.error(
      error
    );


    return;

  }


  markingTests =
    data || [];


  const select =
    document.getElementById(
      "testSelect"
    );


  select.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      markingTests
        .map(
          test => `

            <option
              value="${escapeHtml(test.id)}"
            >

              ${escapeHtml(
                test.name
              )}

              ${
                test.subject
                  ? ` / ${escapeHtml(test.subject)}`
                  : ""
              }

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   テスト選択
========================================================= */

document
  .getElementById(
    "testSelect"
  )
  .addEventListener(
    "change",
    async event => {

      await loadSelectedTest(
        event.target.value
      );

    }
  );


/* =========================================================
   選択テスト
========================================================= */

async function loadSelectedTest(
  testId
) {

  const summary =
    document.getElementById(
      "markingSummary"
    );


  if (!testId) {

    summary.style.display =
      "none";


    return;

  }


  selectedTest =
    markingTests.find(
      test =>
        test.id ===
        testId
    );


  if (!selectedTest) {

    return;

  }


  await loadAnswers(
    testId
  );


  await loadBoxes(
    testId
  );


  renderTestInformation();


  renderAnswers();


  renderQuestions();


  summary.style.display =
    "block";

}


/* =========================================================
   テスト情報
========================================================= */

function renderTestInformation() {

  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(
        selectedTest.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      selectedTest.subject ||
      "-"
    )}

    ／

    学年：
    ${escapeHtml(
      selectedTest.grade ||
      "-"
    )}

    ／

    クラス：
    ${escapeHtml(
      selectedTest.class_name ||
      "-"
    )}

    ／

    満点：
    ${selectedTest.max_score}

  `;

}


/* =========================================================
   答案
========================================================= */

async function loadAnswers(
  testId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .select(`
        id,
        student_id,
        status,
        students(
          student_no,
          name
        )
      `)
      .eq(
        "test_id",
        testId
      )
      .neq(
        "status",
        "unmatched"
      );


  if (error) {

    console.error(
      error
    );


    return;

  }


  answerSheets =
    data || [];

}


/* =========================================================
   解答欄
========================================================= */

async function loadBoxes(
  testId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "layout_boxes"
      )
      .select(`
        id,
        page_no,
        label,
        x,
        y,
        width,
        height,
        points
      `)
      .eq(
        "test_id",
        testId
      )
      .eq(
        "box_type",
        "answer"
      )
      .order(
        "page_no",
        {
          ascending:
            true
        }
      )
      .order(
        "y",
        {
          ascending:
            true
        }
      )
      .order(
        "x",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      error
    );


    return;

  }


  layoutBoxes =
    data || [];

}


/* =========================================================
   答案表示
========================================================= */

function renderAnswers() {

  const container =
    document.getElementById(
      "answerList"
    );


  if (!answerSheets.length) {

    container.innerHTML = `

      <div
        style="
          grid-column:1/-1;
          padding:25px;
          text-align:center;
          color:#777;
        "
      >
        紐付け済み答案がありません。
      </div>

    `;


    return;

  }


  container.innerHTML =
    answerSheets
      .map(
        answer => `

          <div
            class="card"
            style="
              margin:0;
              padding:10px;
            "
          >

            <strong>
              ${escapeHtml(
                answer.students?.student_no ||
                ""
              )}
            </strong>

            <br>

            ${escapeHtml(
              answer.students?.name ||
              "未紐付け"
            )}

            <br>

            <span
              style="
                color:#777;
                font-size:12px;
              "
            >
              ${escapeHtml(
                answer.status ||
                ""
              )}
            </span>

          </div>

        `
      )
      .join("");

}


/* =========================================================
   解答欄表示
========================================================= */

function renderQuestions() {

  const container =
    document.getElementById(
      "questionList"
    );


  if (!layoutBoxes.length) {

    container.innerHTML = `

      <div
        style="
          color:#c62828;
        "
      >
        解答欄が設定されていません。
      </div>

    `;


    updateSummary(
      0,
      0
    );


    return;

  }


  container.innerHTML =
    layoutBoxes
      .map(
        (
          box,
          index
        ) => `

          <div
            style="
              display:flex;
              align-items:center;
              gap:10px;
              padding:10px;
              border-bottom:
                1px solid #d0d6dc;
            "
          >

            <strong>

              ${escapeHtml(
                box.label ||
                `解答欄${index + 1}`
              )}

            </strong>


            <span>

              配点：
              ${
                box.points === null ||
                box.points === undefined

                  ? "未設定"

                  : `${box.points}点`

              }

            </span>


            <a
              href="/teacher/marking/mark?test=${encodeURIComponent(selectedTest.id)}&box=${encodeURIComponent(box.id)}"
              class="btn btn-primary"
              style="
                margin-left:auto;
              "
            >
              この解答欄を採点
            </a>

          </div>

        `
      )
      .join("");


  updateSummary(
    answerSheets.length,
    layoutBoxes.length
  );

}


/* =========================================================
   概要
========================================================= */

function updateSummary(
  answerCount,
  boxCount
) {

  document.getElementById(
    "summaryContent"
  ).innerHTML = `

    答案：
    <strong>
      ${answerCount}
    </strong>
    枚

    ／

    解答欄：
    <strong>
      ${boxCount}
    </strong>
    個

  `;


  const startButton =
    document.getElementById(
      "startMarkingButton"
    );


  if (
    selectedTest &&
    layoutBoxes.length
  ) {

    startButton.href =
      `/teacher/marking/mark?test=${encodeURIComponent(selectedTest.id)}&box=${encodeURIComponent(layoutBoxes[0].id)}`;


    startButton.style.display =
      "inline-block";

  } else {

    startButton.style.display =
      "none";

  }

}


/* =========================================================
   Logout
========================================================= */

document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


/* =========================================================
   HTML escape
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


  return String(value)
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

initializeMarkingSelect();
