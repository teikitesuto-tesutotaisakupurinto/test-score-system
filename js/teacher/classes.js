/* =========================================================
   クラス一覧
========================================================= */


async function initializeClasses() {

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


  await loadClasses();

}


async function loadClasses() {

  const {
    data: classes,
    error
  } =
    await supabaseClient
      .from("classes")
      .select(`
        id,
        name,
        grade
      `)
      .order(
        "grade",
        {
          ascending: true
        }
      )
      .order(
        "name",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(error);

    showClassError(
      "クラス情報を取得できませんでした。"
    );

    return;

  }


  const rows = [];


  for (
    const classItem
    of classes || []
  ) {

    const {
      count
    } =
      await supabaseClient
        .from("students")
        .select(
          "id",
          {
            count: "exact",
            head: true
          }
        )
        .eq(
          "class_id",
          classItem.id
        )
        .eq(
          "active",
          true
        );


    rows.push({

      ...classItem,

      studentCount:
        count || 0

    });

  }


  renderClasses(
    rows
  );

}


function renderClasses(
  classes
) {

  const tbody =
    document.getElementById(
      "classRows"
    );


  if (!classes.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="4"
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >
          クラスが登録されていません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    classes
      .map(
        classItem => `

          <tr>

            <td>
              ${escapeHtml(
                classItem.grade || ""
              )}
            </td>


            <td>
              ${escapeHtml(
                classItem.name
              )}
            </td>


            <td>
              ${classItem.studentCount}人
            </td>


            <td>

              <a
                href="/teacher/classes/students?id=${encodeURIComponent(classItem.id)}"
                class="btn"
              >
                生徒を見る
              </a>

            </td>

          </tr>

        `
      )
      .join("");

}


function showClassError(
  message
) {

  document.getElementById(
    "classRows"
  ).innerHTML = `

    <tr>

      <td
        colspan="4"
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


initializeClasses();
