

/* =======================================================
   権限確認
======================================================= */

const profile =
  await getProfile();


if (!profile) {

  location.replace(
    "/login"
  );

  return;

}


/*
 * teacher / adminのみ利用可能。
 *
 * studentは正しい学生トップへ。
 */

if (
  profile.role !== "teacher" &&
  profile.role !== "admin"
) {

  location.replace(
    "/student/index.html"
  );

  return;

}


if (teacherName) {

  teacherName.textContent =
    profile.name ||
    "先生";

}


setupEvents();

await loadTests();
