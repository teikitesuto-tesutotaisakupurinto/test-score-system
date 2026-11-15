/* =========================================================
   紐付け済み答案
========================================================= */

let matchedAnswers = [];
let matchedTests = [];


async function initializeMatchedAnswers() {

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

  await loadTests();
  await loadAnswers();

}


async function loadTests() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select(`
        id,
        name
      `)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);
    return;
  }

  matchedTests =
    data || [];


  const select =
    document.getElementById(
      "testFilter"
    );


  select.innerHTML = `

    <option value="">
      全テスト
    </option>

    ${
      matchedTests
        .map(
          test => `
            <option value="${test.id}">
              ${escapeHtml(test.name)}
            </option>
          `
        )
        .join("")
    }

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
        test_id,
        student_id,
        qr_value,
        status,
        created_at,
        tests(
          id,
          name,
          subject
        ),
        students(
          id,
          student_no,
          name,
          grade,
          class_name
        )
      `)
      .neq(
        "status",
        "unmatched"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    showError(
      "答案を取得できませんでした。"
    );

    return;

  }


  matchedAnswers =
    data || [];


  renderAnswers();

}


function renderAnswers() {

  const testId =
    document.getElementById(
      "testFilter"
    ).value;


  const keyword =
    document.getElementById(
      "studentSearch"
    ).value
      .trim()
      .toLowerCase();


  const filtered =
    matchedAnswers.filter(
      answer => {

        if (
          testId &&
          answer.test_id !== testId
        ) {

          return false;

        }


        const student =
          answer.students;


        const target =
          `${student?.student_no || ""} ${student?.name || ""}`
            .toLowerCase();


        if (
          keyword &&
          !target.includes(keyword)
        ) {

          return false;

        }


        return true;

      }
    );


  const tbody =
    document.getElementById(
      "answerRows"
    );


  if (!filtered.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >
          紐付け済み答案がありません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    filtered
      .map(
        answer => `

          <tr>

            <td>
              ${escapeHtml(
                answer.tests?.name || ""
              )}
            </td>

            <td>
              <strong>
                ${escapeHtml(
                  answer.students?.student_no || ""
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                answer.students?.name || ""
              )}
            </td>

            <td>
              ${
                answer.qr_value?.startsWith(
                  "MANUAL:"
                )
                  ? "手動"
                  : "QR"
              }
            </td>

            <td>
              ${getStatusLabel(
                answer.status
              )}
            </td>

            <td>

              <a
                class="btn"
                href="/teacher/answers/detail?id=${encodeURIComponent(answer.id)}"
              >
                答案確認
              </a>

              <a
                class="btn btn-primary"
                href="/teacher/marking/select?test=${encodeURIComponent(answer.test_id)}"
              >
                採点
              </a>

            </td>

          </tr>

        `
      )
      .join("");

}


function getStatusLabel(status) {

  const labels = {

    matched:
      "紐付け済み",

    marking:
      "採点中",

    marked:
      "採点済み",

    published:
      "公開済み"

  };


  return escapeHtml(
    labels[status] ||
    status ||
    ""
  );

}


function showError(message) {

  document.getElementById(
    "answerRows"
  ).innerHTML = `

    <tr>

      <td
        colspan="6"
        style="
          text-align:center;
          color:#c62828;
        "
      >
        ${escapeHtml(message)}
      </td>

    </tr>

  `;

}


document
  .getElementById(
    "testFilter"
  )
  .addEventListener(
    "change",
    renderAnswers
  );


document
  .getElementById(
    "studentSearch"
  )
  .addEventListener(
    "input",
    renderAnswers
  );


document
  .getElementById(
    "reloadButton"
  )
  .addEventListener(
    "click",
    async () => {

      await loadTests();
      await loadAnswers();

    }
  );


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


initializeMatchedAnswers();
