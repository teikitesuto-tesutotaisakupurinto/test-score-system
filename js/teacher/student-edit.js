/* =========================================================
   生徒編集
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

const studentId =
  params.get("id");


async function initializeStudentEdit() {

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


  if (!studentId) {

    alert(
      "生徒が指定されていません。"
    );

    window.location.href =
      "/teacher/students";

    return;

  }


  await loadStudent();

}


async function loadStudent() {

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
        "id",
        studentId
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    showError(
      "生徒情報の取得に失敗しました。"
    );

    return;

  }


  if (!data) {

    showError(
      "指定された生徒が見つかりません。"
    );

    return;

  }


  document.getElementById(
    "studentNo"
  ).value =
    data.student_no;


  document.getElementById(
    "studentName"
  ).value =
    data.name;


  document.getElementById(
    "studentGrade"
  ).value =
    data.grade || "";


  document.getElementById(
    "studentClass"
  ).value =
    data.class_name || "";


  document.getElementById(
    "studentActive"
  ).value =
    data.active
      ? "true"
      : "false";


  document.getElementById(
    "loading"
  ).style.display =
    "none";


  document.getElementById(
    "editArea"
  ).style.display =
    "block";

}


function showError(
  message
) {

  const loading =
    document.getElementById(
      "loading"
    );

  loading.innerHTML = `

    <div
      style="
        color:#c62828;
      "
    >
      ${escapeHtml(message)}
    </div>

    <br>

    <a
      href="/teacher/students"
      class="btn"
    >
      生徒一覧へ戻る
    </a>

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


/*
  保存
*/

document
  .getElementById(
    "saveButton"
  )
  .addEventListener(
    "click",
    async () => {

      const name =
        document.getElementById(
          "studentName"
        ).value.trim();


      const grade =
        document.getElementById(
          "studentGrade"
        ).value.trim();


      const className =
        document.getElementById(
          "studentClass"
        ).value.trim();


      const active =
        document.getElementById(
          "studentActive"
        ).value === "true";


      const message =
        document.getElementById(
          "editMessage"
        );


      const button =
        document.getElementById(
          "saveButton"
        );


      message.textContent = "";


      if (!name) {

        message.textContent =
          "氏名を入力してください。";

        return;

      }


      button.disabled = true;

      button.textContent =
        "保存中...";


      try {

        const {
          error
        } =
          await supabaseClient
            .from("students")
            .update({

              name,

              grade:
                grade || null,

              class_name:
                className || null,

              active

            })
            .eq(
              "id",
              studentId
            );


        if (error) {

          throw error;

        }


        alert(
          "生徒情報を保存しました。"
        );


        window.location.href =
          "/teacher/students";


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "保存に失敗しました。";


        button.disabled = false;

        button.textContent =
          "保存する";

      }

    }
  );


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


initializeStudentEdit();
