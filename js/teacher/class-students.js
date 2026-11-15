/* =========================================================
   クラス所属生徒
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

const classId =
  params.get("id");


async function initializeClassStudents() {

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


  if (!classId) {

    alert(
      "クラスが指定されていません。"
    );

    window.location.href =
      "/teacher/classes";

    return;

  }


  await loadClass();

}


async function loadClass() {

  const {
    data: classData,
    error: classError
  } =
    await supabaseClient
      .from("classes")
      .select(`
        id,
        name,
        grade
      `)
      .eq(
        "id",
        classId
      )
      .maybeSingle();


  if (classError) {

    console.error(classError);

    showError(
      "クラス情報を取得できませんでした。"
    );

    return;

  }


  if (!classData) {

    showError(
      "指定されたクラスが見つかりません。"
    );

    return;

  }


  document.getElementById(
    "classTitle"
  ).textContent =
    `${classData.grade || ""} ${classData.name}`;


  document.getElementById(
    "classInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(
        classData.grade || ""
      )}
      ${escapeHtml(
        classData.name
      )}
    </strong>

    の所属生徒

  `;


  await loadStudents();

}


async function loadStudents() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("students")
      .select(`
        id,
        student_no,
        name,
        grade,
        class_name,
        active
      `)
      .eq(
        "class_id",
        classId
      )
      .order(
        "student_no"
      );


  if (error) {

    console.error(error);

    showError(
      "生徒情報を取得できませんでした。"
    );

    return;

  }


  const tbody =
    document.getElementById(
      "studentRows"
    );


  if (!data || !data.length) {

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
          このクラスに生徒が登録されていません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    data
      .map(
        student => `

          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  student.student_no
                )}
              </strong>
            </td>

            <td>
              ${escapeHtml(
                student.name
              )}
            </td>

            <td>
              ${escapeHtml(
                student.grade || ""
              )}
            </td>

            <td>
              ${escapeHtml(
                student.class_name || ""
              )}
            </td>

            <td>
              ${
                student.active
                  ? "在籍"
                  : "無効"
              }
            </td>

            <td>

              <a
                href="/teacher/students/edit?id=${encodeURIComponent(student.id)}"
                class="btn"
              >
                編集
              </a>

            </td>

          </tr>

        `
      )
      .join("");

}


function showError(
  message
) {

  document.getElementById(
    "classInformation"
  ).innerHTML = `

    <span
      style="
        color:#c62828;
      "
    >
      ${escapeHtml(message)}
    </span>

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


initializeClassStudents();
