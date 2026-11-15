/* =========================================================
   解答用紙ページ登録
========================================================= */

const testParams =
  new URLSearchParams(
    window.location.search
  );

const testId =
  testParams.get("id");


let currentTest = null;


async function initializeTestPages() {

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


  if (!testId) {

    alert(
      "テストが指定されていません。"
    );

    window.location.href =
      "/teacher/tests";

    return;

  }


  setLinks();


  await loadTest();

  await loadPages();

}


function setLinks() {

  document.getElementById(
    "testEditLink"
  ).href =
    `/teacher/tests/edit?id=${encodeURIComponent(testId)}`;


  document.getElementById(
    "pagesLink"
  ).href =
    `/teacher/tests/pages?id=${encodeURIComponent(testId)}`;


  document.getElementById(
    "layoutLink"
  ).href =
    `/teacher/tests/layout?id=${encodeURIComponent(testId)}`;


  document.getElementById(
    "questionsLink"
  ).href =
    `/teacher/tests/questions?id=${encodeURIComponent(testId)}`;

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
        test_date,
        max_score,
        status
      `)
      .eq(
        "id",
        testId
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    document.getElementById(
      "testInformation"
    ).textContent =
      "テスト情報を取得できませんでした。";

    return;

  }


  if (!data) {

    document.getElementById(
      "testInformation"
    ).textContent =
      "指定されたテストがありません。";

    return;

  }


  currentTest =
    data;


  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(
        data.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      data.subject || ""
    )}

    ／

    学年：
    ${escapeHtml(
      data.grade || ""
    )}

    ／

    満点：
    ${data.max_score}

  `;

}


async function loadPages() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("test_pages")
      .select(`
        id,
        page_no,
        image_path,
        width_px,
        height_px
      `)
      .eq(
        "test_id",
        testId
      )
      .order(
        "page_no"
      );


  if (error) {

    console.error(error);

    return;

  }


  const container =
    document.getElementById(
      "pageList"
    );


  if (!data || !data.length) {

    container.innerHTML = `

      <div
        style="
          grid-column:1/-1;
          text-align:center;
          color:#777;
          padding:30px;
        "
      >
        まだページが登録されていません。
      </div>

    `;

    return;

  }


  container.innerHTML =
    data
      .map(
        page => `

          <div
            class="card"
            style="
              margin:0;
              padding:10px;
            "
          >

            <div
              style="
                font-weight:bold;
                margin-bottom:8px;
              "
            >
              ${page.page_no}ページ
            </div>


            <div
              style="
                height:220px;
                border:1px solid #d0d6dc;
                background:#f5f6f7;
                display:flex;
                align-items:center;
                justify-content:center;
                overflow:hidden;
              "
            >

              ${
                page.image_path
                  ? `

                    <img
                      src="${escapeHtml(page.image_path)}"
                      style="
                        max-width:100%;
                        max-height:100%;
                        object-fit:contain;
                      "
                    >

                  `
                  :
                  "画像なし"
              }

            </div>

          </div>

        `
      )
      .join("");

}


document
  .getElementById(
    "addPageButton"
  )
  .addEventListener(
    "click",
    async () => {

      const file =
        document.getElementById(
          "pageFile"
        ).files[0];


      const message =
        document.getElementById(
          "message"
        );


      if (!file) {

        message.textContent =
          "ページ画像を選択してください。";

        message.style.color =
          "#c62828";

        return;

      }


      try {

        const {
          data: pages,
          error: pagesError
        } =
          await supabaseClient
            .from("test_pages")
            .select(
              "page_no"
            )
            .eq(
              "test_id",
              testId
            )
            .order(
              "page_no",
              {
                ascending:false
              }
            )
            .limit(1);


        if (pagesError) {

          throw pagesError;

        }


        const nextPage =
          pages?.length
            ? pages[0].page_no + 1
            : 1;


        const filePath =
          `${testId}/page-${String(nextPage).padStart(3,"0")}-${crypto.randomUUID()}.${getExtension(file.name)}`;


        const {
          error: uploadError
        } =
          await supabaseClient
            .storage
            .from("model-answers")
            .upload(
              filePath,
              file,
              {
                upsert:false
              }
            );


        if (uploadError) {

          throw uploadError;

        }


        const {
          error: insertError
        } =
          await supabaseClient
            .from("test_pages")
            .insert({

              test_id:
                testId,

              page_no:
                nextPage,

              image_path:
                filePath

            });


        if (insertError) {

          throw insertError;

        }


        message.textContent =
          `${nextPage}ページを登録しました。`;

        message.style.color =
          "#16834b";


        document.getElementById(
          "pageFile"
        ).value =
          "";


        await loadPages();


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "ページ登録に失敗しました。";

        message.style.color =
          "#c62828";

      }

    }
  );


document
  .getElementById(
    "saveButton"
  )
  .addEventListener(
    "click",
    () => {

      alert(
        "現在のページ設定は保存済みです。"
      );

    }
  );


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


function getExtension(
  filename
) {

  const parts =
    filename.split(".");


  if (
    parts.length < 2
  ) {

    return "png";

  }


  return parts
    .pop()
    .toLowerCase();

}


function escapeHtml(
  value
) {

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


initializeTestPages();
