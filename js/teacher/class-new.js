/* =========================================================
   クラス作成
========================================================= */


async function initializeClassNew() {

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


initializeClassNew();


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


document
  .getElementById(
    "classForm"
  )
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const grade =
        document.getElementById(
          "grade"
        ).value.trim();


      const name =
        document.getElementById(
          "className"
        ).value.trim();


      const message =
        document.getElementById(
          "message"
        );


      const button =
        document.getElementById(
          "saveButton"
        );


      message.textContent = "";


      if (!grade) {

        message.textContent =
          "学年を入力してください。";

        message.style.color =
          "#c62828";

        return;

      }


      if (!name) {

        message.textContent =
          "クラス名を入力してください。";

        message.style.color =
          "#c62828";

        return;

      }


      button.disabled =
        true;

      button.textContent =
        "作成中...";


      try {

        const {
          error
        } =
          await supabaseClient
            .from("classes")
            .insert({

              grade,

              name

            });


        if (error) {

          /*
            unique(name, grade)
            による重複もここで検知
          */

          if (
            error.code ===
            "23505"
          ) {

            throw new Error(
              "同じ学年・クラス名のクラスが既に登録されています。"
            );

          }


          throw error;

        }


        alert(
          "クラスを作成しました。"
        );


        window.location.href =
          "/teacher/classes";


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "クラス作成に失敗しました。";

        message.style.color =
          "#c62828";


        button.disabled =
          false;

        button.textContent =
          "作成する";

      }

    }
  );
