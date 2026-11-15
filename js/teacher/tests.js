/* =========================================================
   テスト一覧
========================================================= */

let allTests = [];


async function initializeTests() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    window.location.href =
      "/student/dashboard";

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  await loadTests();

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
        name,
        subject,
        grade,
        class_name,
        test_date,
        max_score,
        status,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(error);

    document.getElementById(
      "testRows"
    ).innerHTML = `

      <tr>

        <td
          colspan="7"
          style="
            text-align:center;
            color:#c62828;
          "
        >
          テスト情報を取得できませんでした。
        </td>

      </tr>

    `;

    return;

  }


  allTests =
    data || [];


  renderTests();

}


function renderTests() {

  const keyword =
    document.getElementById(
      "testSearch"
    ).value
      .trim()
      .toLowerCase();


  const status =
    document.getElementById(
      "statusFilter"
    ).value;


  const filtered =
    allTests.filter(
      test => {

        const target =
          `${test.name || ""} ${test.subject || ""}`
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
          test.status !== status
        ) {

          return false;

        }


        return true;

      }
    );


  const tbody =
    document.getElementById(
      "testRows"
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
        test => `

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
                test.subject || ""
              )}
            </td>

            <td>
              ${escapeHtml(
                test.grade || ""
              )}
            </td>

            <td>
              ${escapeHtml(
                test.test_date || ""
              )}
            </td>

            <td>
              ${test.max_score}
            </td>

            <td>
              ${getStatusLabel(
                test.status
              )}
            </td>

            <td>

              <a
                href="/teacher/tests/edit?id=${encodeURIComponent(test.id)}"
                class="btn"
              >
                編集
              </a>

              <a
                href="/teacher/tests/layout?id=${encodeURIComponent(test.id)}"
                class="btn"
              >
                解答登録
              </a>

              <a
                href="/teacher/tests/questions?id=${encodeURIComponent(test.id)}"
                class="btn"
              >
                問題
              </a>

            </td>

          </tr>

        `
      )
      .join("");

}


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


document
  .getElementById(
    "testSearch"
  )
  .addEventListener(
    "input",
    renderTests
  );


document
  .getElementById(
    "statusFilter"
  )
  .addEventListener(
    "change",
    renderTests
  );


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


initializeTests();
