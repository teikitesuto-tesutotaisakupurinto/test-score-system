/* =========================================================
   生徒一覧
========================================================= */

let allStudents = [];


async function loadStudents() {

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
        active,
        created_at
      `)
      .order(
        "student_no",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(error);

    document.getElementById(
      "studentRows"
    ).innerHTML = `

      <tr>

        <td
          colspan="6"
          style="
            text-align:center;
            color:#c62828;
          "
        >
          生徒情報を取得できませんでした。
        </td>

      </tr>

    `;

    return;

  }


  allStudents =
    data || [];


  createFilters();

  renderStudents();


}


function createFilters() {

  const grades =
    [
      ...new Set(
        allStudents
          .map(
            student =>
              student.grade
          )
          .filter(Boolean)
      )
    ]
    .sort();


  const classes =
    [
      ...new Set(
        allStudents
          .map(
            student =>
              student.class_name
          )
          .filter(Boolean)
      )
    ]
    .sort();


  const gradeFilter =
    document.getElementById(
      "gradeFilter"
    );


  const classFilter =
    document.getElementById(
      "classFilter"
    );


  gradeFilter.innerHTML = `

    <option value="">
      全学年
    </option>

    ${
      grades
        .map(
          grade => `

            <option
              value="${escapeHtml(grade)}"
            >
              ${escapeHtml(grade)}
            </option>

          `
        )
        .join("")
    }

  `;


  classFilter.innerHTML = `

    <option value="">
      全クラス
    </option>

    ${
      classes
        .map(
          className => `

            <option
              value="${escapeHtml(className)}"
            >
              ${escapeHtml(className)}
            </option>

          `
        )
        .join("")
    }

  `;

}


function renderStudents() {

  const keyword =
    document.getElementById(
      "studentSearch"
    ).value
      .trim()
      .toLowerCase();


  const grade =
    document.getElementById(
      "gradeFilter"
    ).value;


  const className =
    document.getElementById(
      "classFilter"
    ).value;


  const filtered =
    allStudents.filter(
      student => {

        const searchTarget =
          `${student.student_no || ""} ${student.name || ""}`
            .toLowerCase();


        if (
          keyword &&
          !searchTarget.includes(
            keyword
          )
        ) {

          return false;

        }


        if (
          grade &&
          student.grade !== grade
        ) {

          return false;

        }


        if (
          className &&
          student.class_name !== className
        ) {

          return false;

        }


        return true;

      }
    );


  const tbody =
    document.getElementById(
      "studentRows"
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
          該当する生徒がいません。
        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    filtered
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
                  ? `<span style="color:#16834b;">在籍</span>`
                  : `<span style="color:#c62828;">無効</span>`
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


/*
  検索
*/

document
  .getElementById(
    "studentSearch"
  )
  .addEventListener(
    "input",
    renderStudents
  );


/*
  学年
*/

document
  .getElementById(
    "gradeFilter"
  )
  .addEventListener(
    "change",
    renderStudents
  );


/*
  クラス
*/

document
  .getElementById(
    "classFilter"
  )
  .addEventListener(
    "change",
    renderStudents
  );


/*
  ログアウト
*/

document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


/*
  HTMLエスケープ
*/

function escapeHtml(value) {

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


/*
  開始
*/

loadStudents();
