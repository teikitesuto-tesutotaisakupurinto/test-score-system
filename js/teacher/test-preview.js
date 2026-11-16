
"use strict";

/* =========================================================
   テスト確認
========================================================= */

const previewParams =
  new URLSearchParams(
    location.search
  );

const previewTestId =
  previewParams.get("test") ||
  previewParams.get("id");


let previewTest =
  null;


/* =========================================================
   INIT
========================================================= */

async function initializePreview() {

  try {

    const profile =
      await getProfile();


    if (!profile) {

      location.replace(
        "/login"
      );

      return;

    }


    if (
      profile.role !== "teacher" &&
      profile.role !== "admin"
    ) {

      location.replace(
        "/student/dashboard"
      );

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name ||
      "先生";


    if (!previewTestId) {

      throw new Error(
        "テストが指定されていません。"
      );

    }


    setLinks();


    await loadTest();


    await loadPages();


    await loadBoxes();


  } catch (error) {

    console.error(
      "test-preview:",
      error
    );


    showError(
      error.message ||
      "テスト確認を読み込めませんでした。"
    );

  }

}


/* =========================================================
   LINKS
========================================================= */

function setLinks() {

  const id =
    encodeURIComponent(
      previewTestId
    );


  setHref(
    "pagesLink",
    `/teacher/tests/pages?test=${id}`
  );


  setHref(
    "layoutLink",
    `/teacher/tests/layout?test=${id}`
  );


  setHref(
    "pointsLink",
    `/teacher/tests/points?test=${id}`
  );


  setHref(
    "modelAnswerLink",
    `/teacher/tests/model-answer?test=${id}`
  );


  setHref(
    "previewLink",
    `/teacher/tests/preview?test=${id}`
  );


  setHref(
    "markingLink",
    `/teacher/marking?test=${id}`
  );

}


function setHref(
  id,
  href
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.href =
      href;

  }

}


/* =========================================================
   TEST
========================================================= */

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
        status,
        results_published,
        results_published_at
      `)
      .eq(
        "id",
        previewTestId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "テストが見つかりません。"
    );

  }


  previewTest =
    data;


  const information =
    document.getElementById(
      "testInformation"
    );


  if (!information) {

    return;

  }


  information.innerHTML = `

    <strong>
      ${escapeHtml(
        data.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      data.subject ||
      "-"
    )}

    ／

    学年：
    ${escapeHtml(
      data.grade ||
      "-"
    )}

    ／

    クラス：
    ${escapeHtml(
      data.class_name ||
      "-"
    )}

    ／

    満点：
    ${formatNumber(
      data.max_score
    )}

    ／

    状態：
    ${escapeHtml(
      data.status ||
      "-"
    )}

    ／

    結果：
    ${
      data.results_published
        ? "公開済み"
        : "未確定"
    }

  `;

}


/* =========================================================
   PAGES
========================================================= */

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
        "page_no",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  const container =
    document.getElementById(
      "pagePreview"
    );


  if (!container) {

    return;

  }


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


  container.innerHTML =
    "";


  for (
    const page
    of data
  ) {

    await renderPage(
      container,
      page
    );

  }

}


/* =========================================================
   PAGE
========================================================= */

async function renderPage(
  container,
  page
) {

  const card =
    document.createElement(
      "div"
    );


  card.className =
    "page-card";


  const title =
    document.createElement(
      "div"
    );


  title.className =
    "page-title";


  title.textContent =
    `${page.page_no}ページ`;


  const imageArea =
    document.createElement(
      "div"
    );


  imageArea.className =
    "page-image";


  imageArea.textContent =
    "読み込み中...";


  card.append(
    title,
    imageArea
  );


  container.appendChild(
    card
  );


  if (!page.image_path) {

    imageArea.textContent =
      "画像なし";

    return;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "test-files"
        )
        .createSignedUrl(
          page.image_path,
          3600
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      /*
       * 旧データでmodel-answersに
       * 入っている場合にも対応。
       */

      const fallback =
        await supabaseClient
          .storage
          .from(
            "model-answers"
          )
          .createSignedUrl(
            page.image_path,
            3600
          );


      if (
        fallback.error ||
        !fallback.data?.signedUrl
      ) {

        throw new Error(
          "画像URLを取得できませんでした。"
        );

      }


      renderImage(
        imageArea,
        fallback.data.signedUrl
      );


      return;

    }


    renderImage(
      imageArea,
      data.signedUrl
    );


  } catch (error) {

    imageArea.textContent =
      error.message ||
      "画像を表示できません。";

  }

}


/* =========================================================
   IMAGE
========================================================= */

function renderImage(
  target,
  url
) {

  target.innerHTML = `

    <img
      src="${escapeHtml(
        url
      )}"
      alt="解答用紙"
    >

  `;

}


/* =========================================================
   BOXES
========================================================= */

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
        height,
        points,
        sort_order
      `)
      .eq(
        "test_id",
        previewTestId
      )
      .order(
        "page_no",
        {
          ascending:true
        }
      )
      .order(
        "sort_order",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  const container =
    document.getElementById(
      "boxPreview"
    );


  if (!container) {

    return;

  }


  if (!data?.length) {

    container.innerHTML = `

      <div class="empty">
        枠が設定されていません。
      </div>

    `;

    return;

  }


  const labels = {

    answer:
      "解答欄",

    qr:
      "QRコード",

    student_no:
      "生徒番号",

    name:
      "氏名",

    major:
      "大問",

    minor:
      "小問",

    subtotal:
      "小計",

    total:
      "合計",

    other:
      "その他"

  };


  const counts =
    {};


  data.forEach(
    box => {

      const type =
        box.box_type ||
        "other";


      counts[type] =
        (
          counts[type] ||
          0
        ) + 1;

    }
  );


  container.innerHTML = `

    <table class="box-table">

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

        ${
          Object.entries(
            counts
          )
            .map(
              (
                [
                  type,
                  count
                ]
              ) => `

                <tr>

                  <td>
                    ${escapeHtml(
                      labels[type] ||
                      type
                    )}
                  </td>

                  <td>
                    ${count}
                  </td>

                </tr>

              `
            )
            .join("")
        }

      </tbody>

    </table>

  `;

}


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  const information =
    document.getElementById(
      "testInformation"
    );


  if (information) {

    information.innerHTML = `

      <div
        style="
          color:#b42318;
        "
      >

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }

}


/* =========================================================
   NUMBER
========================================================= */

function formatNumber(
  value
) {

  const n =
    Number(
      value
    );


  if (
    !Number.isFinite(
      n
    )
  ) {

    return "-";

  }


  return Number.isInteger(
    n
  )
    ? String(n)
    : n.toFixed(1);

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


/* =========================================================
   LOGOUT
========================================================= */

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


initializePreview();
