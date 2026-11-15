/* =========================================================
   テスト成績システム
   先生ダッシュボード
========================================================= */

async function loadTeacherDashboard() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.href =
      "/login";

    return;

  }


  /*
    roleチェック
  */

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    window.location.href =
      "/student/dashboard";

    return;

  }


  /*
    先生名
  */

  const teacherName =
    document.getElementById(
      "teacherName"
    );


  if (teacherName) {

    teacherName.textContent =
      profile.name || "先生";

  }


  /*
    生徒数
  */

  const {
    count: studentCount,
    error: studentError
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
        "active",
        true
      );


  if (studentError) {

    console.error(
      "生徒数取得エラー:",
      studentError
    );

  }


  document.getElementById(
    "studentCount"
  ).textContent =
    studentCount ?? 0;


  /*
    テスト数
  */

  const {
    count: testCount,
    error: testError
  } =
    await supabaseClient
      .from("tests")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      );


  if (testError) {

    console.error(
      "テスト数取得エラー:",
      testError
    );

  }


  document.getElementById(
    "testCount"
  ).textContent =
    testCount ?? 0;


  /*
    未採点数
  */

  const {
    count: unmarkedCount,
    error: unmarkedError
  } =
    await supabaseClient
      .from("scores")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "status",
        "unmarked"
      );


  if (unmarkedError) {

    console.error(
      "未採点数取得エラー:",
      unmarkedError
    );

  }


  document.getElementById(
    "unmarkedCount"
  ).textContent =
    unmarkedCount ?? 0;


  /*
    公開済みテスト数
  */

  const {
    count: publishedCount,
    error: publishedError
  } =
    await supabaseClient
      .from("tests")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "status",
        "published"
      );


  if (publishedError) {

    console.error(
      "公開済みテスト数取得エラー:",
      publishedError
    );

  }


  document.getElementById(
    "publishedCount"
  ).textContent =
    publishedCount ?? 0;

}


/*
  ログアウト
*/

const logoutButton =
  document.getElementById(
    "logoutButton"
  );


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    async () => {

      await logout();

    }
  );

}


/*
  ページ読み込み時
*/

loadTeacherDashboard();
