/* =========================================================
   模範解答登録
========================================================= */

const params =
  new URLSearchParams(location.search);

const testId =
  params.get("id");


async function initialize() {

  const profile =
    await getProfile();

  if (!profile) {
    location.href = "/login";
    return;
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    location.href = "/student/dashboard";
    return;
  }

  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";

  if (!testId) {
    alert("テストが指定されていません。");
    location.href = "/teacher/tests";
    return;
  }

  setLinks();

  await loadTest();

  await loadModelAnswer();

}


function setLinks() {

  document.getElementById(
    "pagesLink"
  ).href =
    `/teacher/tests/pages?id=${encodeURIComponent(testId)}`;

  document.getElementById(
    "layoutLink"
  ).href =
    `/teacher/tests/layout?id=${encodeURIComponent(testId)}`;

  document.getElementById(
    "modelAnswerLink"
  ).href =
    `/teacher/tests/model-answer?id=${encodeURIComponent(testId)}`;

  document.getElementById(
    "previewLink"
  ).href =
    `/teacher/tests/preview?id=${encodeURIComponent(testId)}`;

}


async function loadTest() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("tests")
      .select(`
        id,
        name,
        subject,
        grade,
        class_name,
        max_score
      `)
      .eq("id", testId)
      .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) {
    alert("テストが見つかりません。");
    return;
  }

  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(data.name)}
    </strong>

    <br>

    教科：
    ${escapeHtml(data.subject || "")}

    ／

    学年：
    ${escapeHtml(data.grade || "")}

    ／

    満点：
    ${data.max_score}

  `;

}


async function loadModelAnswer() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("test_pages")
      .select(`
        image_path,
        page_no
      `)
      .eq("test_id", testId)
      .order("page_no")
      .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (!data?.length || !data[0].image_path) {
    return;
  }

  /*
    登録した解答用紙画像を
    模範解答表示として使用する。
  */

  const {
    data: signed,
    error: signedError
  } =
    await supabaseClient
      .storage
      .from("model-answers")
      .createSignedUrl(
        data[0].image_path,
        3600
      );

  if (signedError) {
    console.error(signedError);
    return;
  }

  document.getElementById(
    "modelAnswerPreview"
  ).innerHTML = `

    <img
      src="${signed.signedUrl}"
      style="
        max-width:100%;
        max-height:700px;
        object-fit:contain;
      "
    >

  `;

}


document
  .getElementById("uploadButton")
  .addEventListener(
    "click",
    async () => {

      const file =
        document.getElementById(
          "modelAnswerFile"
        ).files[0];

      const message =
        document.getElementById(
          "message"
        );

      if (!file) {
        message.textContent =
          "模範解答画像を選択してください。";
        message.style.color =
          "#c62828";
        return;
      }

      const button =
        document.getElementById(
          "uploadButton"
        );

      button.disabled = true;
      button.textContent = "登録中...";

      try {

        const extension =
          file.name
            .split(".")
            .pop()
            .toLowerCase();

        const path =
          `${testId}/model-answer-${crypto.randomUUID()}.${extension}`;

        const {
          error
        } =
          await supabaseClient
            .storage
            .from("model-answers")
            .upload(
              path,
              file,
              {
                upsert: false
              }
            );

        if (error) {
          throw error;
        }

        /*
          test_pagesに模範解答画像として登録
        */

        const {
          error: pageError
        } =
          await supabaseClient
            .from("test_pages")
            .insert({
              test_id: testId,
              page_no: 999,
              image_path: path
            });

        if (pageError) {
          throw pageError;
        }

        message.textContent =
          "模範解答を登録しました。";

        message.style.color =
          "#16834b";

        await loadModelAnswer();

      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "登録に失敗しました。";

        message.style.color =
          "#c62828";

      }

      button.disabled = false;
      button.textContent =
        "模範解答を登録";

    }
  );


document
  .getElementById("logoutButton")
  .addEventListener(
    "click",
    logout
  );


function escapeHtml(value) {

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


initialize();
