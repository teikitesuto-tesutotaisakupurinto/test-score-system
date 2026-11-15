/* =========================================================
   テスト確認
========================================================= */

const previewParams =
  new URLSearchParams(
    location.search
  );

const previewTestId =
  previewParams.get("id");


async function initializePreview() {

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


  if (!previewTestId) {

    alert(
      "テストが指定されていません。"
    );

    location.href =
      "/teacher/tests";

    return;

  }


  setLinks();

  await loadTest();

  await loadPages();

  await loadBoxes();

}


function setLinks() {

  document.getElementById(
    "pagesLink"
  ).href =
    `/teacher/tests/pages?id=${encodeURIComponent(previewTestId)}`;

  document.getElementById(
    "layoutLink"
  ).href =
    `/teacher/tests/layout?id=${encodeURIComponent(previewTestId)}`;

  document.getElementById(
    "modelAnswerLink"
  ).href =
    `/teacher/tests/model-answer?id=${encodeURIComponent(previewTestId)}`;

  document.getElementById(
    "previewLink"
  ).href =
    `/teacher/tests/preview?id=${encodeURIComponent(previewTestId)}`;

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
        previewTestId
      )
      .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  if (!data) {
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

    クラス：
    ${escapeHtml(data.class_name || "")}

    ／

    満点：
    ${data.max_score}

    ／

    状態：
    ${escapeHtml(data.status)}

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
        previewTestId
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
      "pagePreview"
    );


  if (!data?.length) {

    container.innerHTML = `

      <div
        style="
          grid-column:1/-1;
          text-align:center;
          color:#777;
          padding:30px;
        "
      >
        解答用紙が登録されていません。
      </div>

    `;

    return;
  }


  container.innerHTML = "";


  for (
    const page of data
  ) {

    const card =
      document.createElement(
        "div"
      );


    card.className =
      "card";


    card.style.margin =
      "0";


    card.innerHTML = `

      <strong>
        ${page.page_no}ページ
      </strong>

      <div
        style="
          margin-top:8px;
          height:300px;
          border:1px solid #d0d6dc;
          background:#f5f6f7;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
        "
      >
        読み込み中...
      </div>

    `;


    container.appendChild(
      card
    );


    if (
      !page.image_path
    ) {

      card
        .querySelector("div")
        .textContent =
        "画像なし";

      continue;

    }


    const {
      data: signed,
      error: signedError
    } =
      await supabaseClient
        .storage
        .from("model-answers")
        .createSignedUrl(
          page.image_path,
          3600
        );


    if (
      signedError ||
      !signed?.signedUrl
    ) {

      card
        .querySelector("div")
        .textContent =
        "画像を表示できません。";

      continue;

    }


    card
      .querySelector("div")
      .innerHTML = `

        <img
          src="${signed.signedUrl}"
          style="
            max-width:100%;
            max-height:100%;
            object-fit:contain;
          "
        >

      `;

  }

}


async function loadBoxes() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height
      `)
      .eq(
        "test_id",
        previewTestId
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
      "boxPreview"
    );


  if (!data?.length) {

    container.innerHTML = `
      <div style="color:#777;">
        枠が設定されていません。
      </div>
    `;

    return;

  }


  const counts = {};


  data.forEach(
    box => {

      const key =
        box.box_type;


      counts[key] =
        (counts[key] || 0) + 1;

    }
  );


  const labels = {

    answer:
      "解答欄",

    qr:
      "QRコードシール欄",

    student_no:
      "生徒番号欄",

    name:
      "氏名欄",

    other:
      "その他"

  };


  container.innerHTML = `

    <table class="table">

      <thead>

        <tr>

          <th>
            枠種類
          </th>

          <th>
            件数
          </th>

        </tr>

      </thead>

      <tbody>

        ${Object.entries(counts)
          .map(
            ([type,count]) => `

              <tr>

                <td>
                  ${escapeHtml(
                    labels[type] || type
                  )}
                </td>

                <td>
                  ${count}
                </td>

              </tr>

            `
          )
          .join("")}

      </tbody>

    </table>

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


initializePreview();
