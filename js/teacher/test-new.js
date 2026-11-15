/* =========================================================
   テスト作成
========================================================= */


async function initializeTestNew() {

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


initializeTestNew();


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
    "testForm"
  )
  .addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const name =
        document.getElementById(
          "testName"
        ).value.trim();


      const subject =
        document.getElementById(
          "subject"
        ).value.trim();


      const grade =
        document.getElementById(
          "grade"
        ).value.trim();


      const className =
        document.getElementById(
          "className"
        ).value.trim();


      const testDate =
        document.getElementById(
          "testDate"
        ).value;


      const maxScore =
        Number(
          document.getElementById(
            "maxScore"
          ).value
        );


      const message =
        document.getElementById(
          "message"
        );


      const button =
        document.getElementById(
          "saveButton"
        );


      message.textContent = "";


      if (!name) {

        message.textContent =
          "テスト名を入力してください。";

        message.style.color =
          "#c62828";

        return;

      }


      if (
        Number.isNaN(
          maxScore
        ) ||
        maxScore < 0
      ) {

        message.textContent =
          "満点を正しく入力してください。";

        message.style.color =
          "#c62828";

        return;

      }


      button.disabled =
        true;

      button.textContent =
        "作成中...";


      try {

        const session =
          await getSession();


        if (!session) {

          throw new Error(
            "ログイン情報がありません。"
          );

        }


        const {
          data,
          error
        } =
          await supabaseClient
            .from("tests")
            .insert({

              name,

              subject:
                subject || null,

              grade:
                grade || null,

              class_name:
                className || null,

              test_date:
                testDate || null,

              max_score:
                maxScore,

              status:
                "draft",

              created_by:
                session.user.id

            })
            .select()
            .single();


        if (error) {

          throw error;

        }


        /*
          テスト作成後は
          解答用紙のページ・枠設定へ
        */

        window.location.href =
          `/teacher/tests/pages?id=${encodeURIComponent(data.id)}`;


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "テスト作成に失敗しました。";

        message.style.color =
          "#c62828";


        button.disabled =
          false;

        button.textContent =
          "テストを作成";

      }

    }
  );
