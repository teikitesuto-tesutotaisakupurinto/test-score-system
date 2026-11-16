
"use strict";

/* =========================================================
   生徒一覧

   ・生徒一覧取得
   ・検索
   ・学年絞り込み
   ・クラス絞り込み
   ・編集画面への遷移
========================================================= */


let DB =
  null;


let allStudents =
  [];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeStudents
);


async function initializeStudents() {

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


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


    setupEvents();


    await loadStudents();


  } catch (error) {

    console.error(
      "students:",
      error
    );


    renderError(
      error.message ||
      "生徒情報を取得できませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  document
    .getElementById(
      "studentSearch"
    )
    ?.addEventListener(
      "input",
      renderStudents
    );


  document
    .getElementById(
      "gradeFilter"
    )
    ?.addEventListener(
      "change",
      renderStudents
    );


  document
    .getElementById(
      "classFilter"
    )
    ?.addEventListener(
      "change",
      renderStudents
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

async function loadStudents() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        grade,
        class_name,
        active,
        created_at
        `
      )
      .order(
        "student_no",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  allStudents =
    data ||
    [];


  createFilters();

  renderStudents();

}


/* =========================================================
   FILTERS
========================================================= */

function createFilters() {

  const gradeFilter =
    document.getElementById(
      "gradeFilter"
    );


  const classFilter =
    document.getElementById(
      "classFilter"
    );


  if (
    !gradeFilter ||
    !classFilter
  ) {

    return;

  }


  const grades =
    [
      ...new Set(
        allStudents
          .map(
            student =>
              student.grade
          )
          .filter(
            value =>
              value !== null &&
              value !== undefined &&
              String(
                value
              ).trim() !== ""
          )
      )
    ]
      .sort(
        compareValues
      );


  const classes =
    [
      ...new Set(
        allStudents
          .map(
            student =>
              student.class_name
          )
          .filter(
            value =>
              value !== null &&
              value !== undefined &&
              String(
                value
              ).trim() !== ""
          )
      )
    ]
      .sort(
        compareValues
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
              value="${escapeHtml(
                grade
              )}"
            >

              ${escapeHtml(
                grade
              )}

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
              value="${escapeHtml(
                className
              )}"
            >

              ${escapeHtml(
                className
              )}

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   RENDER
========================================================= */

function renderStudents() {

  const tbody =
    document.getElementById(
      "studentRows"
    );


  if (!tbody) {

    return;

  }


  const searchElement =
    document.getElementById(
      "studentSearch"
    );


  const gradeElement =
    document.getElementById(
      "gradeFilter"
    );


  const classElement =
    document.getElementById(
      "classFilter"
    );


  const keyword =
    (
      searchElement?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const grade =
    gradeElement?.value ||
    "";


  const className =
    classElement?.value ||
    "";


  const filtered =
    allStudents.filter(
      student => {

        const searchTarget =
          [
            student.student_no,
            student.name
          ]
            .filter(
              value =>
                value !== null &&
                value !== undefined
            )
            .join(
              " "
            )
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
          student.grade !==
            grade
        ) {

          return false;

        }


        if (
          className &&
          student.class_name !==
            className
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
        createStudentRow
      )
      .join(
        ""
      );

}


/* =========================================================
   ROW
========================================================= */

function createStudentRow(
  student
) {

  const status =
    student.active
      ? `
        <span
          style="
            color:#16834b;
            font-weight:700;
          "
        >
          在籍
        </span>
      `
      : `
        <span
          style="
            color:#c62828;
            font-weight:700;
          "
        >
          無効
        </span>
      `;


  return `

    <tr>


      <td>

        <strong>
          ${escapeHtml(
            student.student_no ||
            ""
          )}
        </strong>

      </td>


      <td>

        ${escapeHtml(
          student.name ||
          ""
        )}

      </td>


      <td>

        ${escapeHtml(
          student.grade ||
          ""
        )}

      </td>


      <td>

        ${escapeHtml(
          student.class_name ||
          ""
        )}

      </td>


      <td>

        ${status}

      </td>


      <td>

        <a
          href="/teacher/students/edit?id=${encodeURIComponent(
            student.id
          )}"
          class="btn"
        >
          編集
        </a>

      </td>


    </tr>

  `;

}


/* =========================================================
   SORT
========================================================= */

function compareValues(
  a,
  b
) {

  return String(
    a
  ).localeCompare(
    String(
      b
    ),
    "ja",
    {
      numeric:true
    }
  );

}


/* =========================================================
   ERROR
========================================================= */

function renderError(
  errorMessage
) {

  const tbody =
    document.getElementById(
      "studentRows"
    );


  if (!tbody) {

    return;

  }


  tbody.innerHTML = `

    <tr>

      <td
        colspan="6"
        style="
          text-align:center;
          padding:30px;
          color:#c62828;
        "
      >

        ${escapeHtml(
          errorMessage
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
