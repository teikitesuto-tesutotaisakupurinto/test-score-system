/* =========================================================
   生徒登録
========================================================= */


async function initializeStudentNew() {

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

}


initializeStudentNew();


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
  登録
*/

document
  .getElementById(
    "studentForm"
  )
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


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


      const message =
        document.getElementById(
          "formMessage"
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
        "登録中...";


      try {

        /*
          student_noはSQL側の
          BEFORE INSERT TRIGGERで
          ランダム6桁が発行される
        */

        const {
          data,
          error
        } =
          await supabaseClient
            .from("students")
            .insert({

              name,

              grade:
                grade || null,

              class_name:
                className || null

            })
            .select(
              "id,student_no,name,grade,class_name"
            )
            .single();


        if (error) {

          throw error;

        }


        /*
          登録完了
        */

        alert(
          `生徒を登録しました。\n\n生徒番号：${data.student_no}`
        );


        window.location.href =
          "/teacher/students";

      } catch (error) {

        console.error(error);


        message.textContent =
          error.message ||
          "生徒登録に失敗しました。";


        button.disabled = false;

        button.textContent =
          "登録する";

      }

    }
  );
