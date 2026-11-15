/* =========================================================
   採点対象選択
========================================================= */

const selectParams =
  new URLSearchParams(location.search);

const selectTestId =
  selectParams.get("test");


let selectedTest = null;
let answerSheets = [];
let layoutBoxes = [];


async function initializeMarkingSelect() {

  const profile =
    await getProfile();

  if (!profile) {
    location.href = "/login";
    return;
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    location.href = "/student/dashboard";
    return;
  }

  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  if (!selectTestId) {

    alert(
      "テストが指定されていません。"
    );

    location.href =
      "/teacher/marking";

    return;

  }


  await loadTest();

  await loadAnswers();

  await loadLayoutBoxes();

  renderAnswers();

  renderQuestions();

}


async function loadTest() {

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
        max_score,
        status
      `)
      .eq(
        "id",
        selectTestId
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    return;

  }


  if (!data) {

    alert(
      "テストが見つかりません。"
    );

    location.href =
      "/teacher/marking";

    return;

  }


  selectedTest =
    data;


  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(data.name)}
    </strong>

    <br>

    教科：
    ${escapeHtml(data.subject || "")}

    ／

    学年：
    ${escapeHtml(data.grade || "")}

    ／

    クラス：
    ${escapeHtml(data.class_name || "")}

    ／

    満点：
    ${data.max_score}

  `;

}


async function loadAnswers() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("answer_sheets")
      .select(`
        id,
        student_id,
        status,
        created_at,
        students(
          id,
          student_no,
          name
        )
      `)
      .eq(
        "test_id",
        selectTestId
      )
      .neq(
        "status",
        "unmatched"
      )
      .order(
        "created_at"
      );


  if (error) {

    console.error(error);

    return;

  }


  answerSheets =
    data || [];

}


async function loadLayoutBoxes() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        id,
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height,
        points
      `)
      .eq(
        "test_id",
        selectTestId
      )
      .eq(
        "box_type",
        "answer"
      )
      .order(
        "page_no"
      );


  if (error) {

    console.error(error);

    return;

  }


  layoutBoxes =
    data || [];

}


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
          text-align:center;
          color:#777;
          padding:30px;
        "
      >
        採点対象の答案がありません。
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
              border:1px solid #d0d6dc;
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
              ${getAnswerStatus(
                answer.status
              )}
            </span>

          </div>

        `
      )
      .join("");

}


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

    return;

  }


  container.innerHTML =
    layoutBoxes
      .map(
        (box, index) => `

          <div
            style="
              display:flex;
              align-items:center;
              gap:10px;
              padding:10px;
              border-bottom:1px solid #d0d6dc;
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
              href="/teacher/marking/mark?test=${encodeURIComponent(selectTestId)}&box=${encodeURIComponent(box.id)}"
              class="btn btn-primary"
              style="margin-left:auto;"
            >
              この問題を採点
            </a>

          </div>

        `
      )
      .join("");

}


function getAnswerStatus(
  status
) {

  const labels = {

    matched:
      "未採点",

    marking:
      "採点中",

    marked:
      "採点済み",

    published:
      "公開済み"

  };


  return labels[status] ||
    status ||
    "";

}


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


initializeMarkingSelect();
