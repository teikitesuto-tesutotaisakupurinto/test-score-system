/* =========================================================
   答案処理状況
========================================================= */


async function initializeProcessing() {

  const profile =
    await getProfile();


  if (!profile) {

    location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    location.href =
      "/student/dashboard";

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  await loadProcessing();

}


async function loadProcessing() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("answer_sheets")
      .select(`
        id,
        qr_value,
        status,
        created_at,
        tests(
          name
        ),
        students(
          student_no,
          name
        )
      `)
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    console.error(error);

    return;

  }


  const list =
    data || [];


  const unmatched =
    list.filter(
      x =>
        x.status ===
        "unmatched"
    ).length;


  const matched =
    list.filter(
      x =>
        x.status ===
        "matched"
    ).length;


  const marking =
    list.filter(
      x =>
        x.status ===
        "marking"
    ).length;


  const marked =
    list.filter(
      x =>
        x.status ===
        "marked"
    ).length;


  const published =
    list.filter(
      x =>
        x.status ===
        "published"
    ).length;


  document.getElementById(
    "processingSummary"
  ).innerHTML = `

    全答案：
    <strong>
      ${list.length}
    </strong>
    件

    ／

    未紐付け：
    <strong style="color:#c62828;">
      ${unmatched}
    </strong>
    件

    ／

    紐付け済み：
    <strong style="color:#16834b;">
      ${matched}
    </strong>
    件

    ／

    採点中：
    ${marking}

    ／

    採点済み：
    ${marked}

    ／

    公開済み：
    ${published}

  `;


  const tbody =
    document.getElementById(
      "processingRows"
    );


  if (!list.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="5"
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >
          答案がありません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    list
      .map(
        answer => `

          <tr>

            <td>
              ${formatDate(
                answer.created_at
              )}
            </td>

            <td>
              ${escapeHtml(
                answer.tests?.name ||
                ""
              )}
            </td>

            <td>

              ${
                answer.students
                  ? `

                    ${escapeHtml(
                      answer.students.student_no
                    )}

                    -
                    ${escapeHtml(
                      answer.students.name
                    )}

                  `
                  : "未紐付け"
              }

            </td>

            <td>
              ${
                answer.qr_value
                  ? "読み取り済み"
                  : "未読取"
              }
            </td>

            <td>
              ${getStatus(
                answer.status
              )}
            </td>

          </tr>

        `
      )
      .join("");

}


function getStatus(
  status
) {

  const labels = {

    unmatched:
      `<span style="color:#c62828;">未紐付け</span>`,

    matched:
      `<span style="color:#1769aa;">紐付け済み</span>`,

    marking:
      `<span style="color:#d97706;">採点中</span>`,

    marked:
      `<span style="color:#16834b;">採点済み</span>`,

    published:
      `<span style="color:#16834b;">公開済み</span>`

  };


  return labels[status] ||
    escapeHtml(status || "");

}


function formatDate(
  value
) {

  if (!value) {
    return "";
  }


  return new Date(
    value
  ).toLocaleString(
    "ja-JP"
  );

}


document
  .getElementById(
    "reloadButton"
  )
  .addEventListener(
    "click",
    loadProcessing
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


initializeProcessing();
