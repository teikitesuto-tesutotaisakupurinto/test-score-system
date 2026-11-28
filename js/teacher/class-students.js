
"use strict";

/* =========================================================
   クラス所属生徒
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );


const classId =
  params.get("id") ||
  params.get("class");


let DB =
  null;

let currentClass =
  null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeClassStudents
);


async function initializeClassStudents() {

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


    if (!classId) {

      throw new Error(
        "クラスが指定されていません。"
      );

    }


    await loadClass();


  } catch (error) {

    console.error(
      "class-students:",
      error
    );


    showError(
      error.message ||
      "クラス情報を取得できませんでした。"
    );

  }

}


/* =========================================================
   CLASS
========================================================= */

async function loadClass() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "classes"
      )
      .select(
        `
        id,
        name,
        grade
        `
      )
      .eq(
        "id",
        classId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "指定されたクラスが見つかりません。"
    );

  }


  currentClass =
    data;


  const title =
    document.getElementById(
      "classTitle"
    );


  if (title) {

    title.textContent =
      [
        data.grade,
        data.name
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
          " "
        );

  }


  const information =
    document.getElementById(
      "classInformation"
    );


  if (information) {

    information.innerHTML = `

      <strong>
        ${escapeHtml(
          data.grade ||
          ""
        )}

        ${escapeHtml(
          data.name ||
          ""
        )}
      </strong>

      の所属生徒

    `;

  }


  await loadStudents();

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {
  const { data, error } = await DB
    .from("students")
    .select("id,student_no,name,grade,class_name,class_id,active")
    .or(`class_id.eq.${classId},and(class_id.is.null,grade.eq."${String(currentClass.grade || "").replace(/"/g, '\\"')}",class_name.eq."${String(currentClass.name || "").replace(/"/g, '\\"')}")`)
    .order("student_no", { ascending: true });
  if (error) throw error;
  renderStudents(data || []);
}


/* =========================================================
   RENDER
========================================================= */

function renderStudents(
  students
) {

  const tbody =
    document.getElementById(
      "studentRows"
    );


  if (!tbody) {

    return;

  }


  if (!students.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty"
        >

          このクラスに生徒が登録されていません。

          <br><br>

          <a
            href="/teacher/students/new"
            class="btn btn-primary"
          >
            生徒登録
          </a>

        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    "";


  students.forEach(
    student => {

      tbody.appendChild(
        createStudentRow(
          student
        )
      );

    }
  );

}


/* =========================================================
   ROW
========================================================= */

function createStudentRow(
  student
) {

  const row =
    document.createElement(
      "tr"
    );


  const number =
    document.createElement(
      "td"
    );


  number.innerHTML = `

    <strong>
      ${escapeHtml(
        student.student_no ||
        ""
      )}
    </strong>

  `;


  const name =
    document.createElement(
      "td"
    );


  name.textContent =
    student.name ||
    "";


  const grade =
    document.createElement(
      "td"
    );


  grade.textContent =
    student.grade ||
    currentClass?.grade ||
    "";


  const className =
    document.createElement(
      "td"
    );


  className.textContent =
    student.class_name ||
    currentClass?.name ||
    "";


  const status =
    document.createElement(
      "td"
    );


  const badge =
    document.createElement(
      "span"
    );


  badge.className =
    student.active
      ? "student-status active"
      : "student-status inactive";


  badge.textContent =
    student.active
      ? "在籍"
      : "無効";


  status.appendChild(
    badge
  );


  const actions =
    document.createElement(
      "td"
    );


  const edit =
    document.createElement(
      "a"
    );


  edit.href =
    `/teacher/students/edit?id=${encodeURIComponent(
      student.id
    )}`;


  edit.className =
    "btn";


  edit.textContent =
    "編集";


  actions.appendChild(
    edit
  );


  row.append(
    number,
    name,
    grade,
    className,
    status,
    actions
  );


  return row;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  const information =
    document.getElementById(
      "classInformation"
    );


  if (information) {

    information.innerHTML = `

      <span
        style="
          color:#b42318;
        "
      >

        ${escapeHtml(
          message
        )}

      </span>

    `;

  }


  const tbody =
    document.getElementById(
      "studentRows"
    );


  if (tbody) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty"
        >

          ${escapeHtml(
            message
          )}

        </td>

      </tr>

    `;

  }

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
