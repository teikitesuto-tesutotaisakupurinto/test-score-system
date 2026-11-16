
"use strict";

/* =========================================================
   テスト確認

   ・解答用紙ページ
   ・設定済み解答枠
   ・配点
   を確認するだけ。

   採点処理は実行しない。
========================================================= */

let DB = null;

let testId = null;

let test = null;

let pages = [];

let boxes = [];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializePreview
);


async function initializePreview() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    const params =
      new URLSearchParams(
        location.search
      );


    testId =
      params.get("test") ||
      params.get("id");


    if (!testId) {

      throw new Error(
        "テストIDがありません。"
      );

    }


    setLinks();

    await loadData();

    await renderPreview();


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
   EVENTS
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


/* =========================================================
   LINKS
========================================================= */

function setLinks() {

  const id =
    encodeURIComponent(
      testId
    );


  const links = {

    pagesLink:
      `/teacher/tests/pages?test=${id}`,

    layoutLink:
      `/teacher/tests/pages?test=${id}`,

    modelAnswerLink:
      `/teacher/tests/model-answer?test=${id}`,

    previewLink:
      `/teacher/tests/preview?test=${id}`

  };


  Object.entries(
    links
  ).forEach(
    (
      [
        key,
        href
      ]
    ) => {

      const element =
        document.getElementById(
          key
        );


      if (element) {

        element.href =
          href;

      }

    }
  );

}


/* =========================================================
   LOAD
========================================================= */

async function loadData() {

  const [
    testResult,
    pageResult,
    boxResult
  ] =
    await Promise.all([

      DB
        .from(
          "tests"
        )
        .select(
          `
          id,
          name,
          subject,
          grade,
          class_name,
          max_score
          `
        )
        .eq(
          "id",
          testId
        )
        .maybeSingle(),

      DB
        .from(
          "test_pages"
        )
        .select(
          `
          id,
          page_no,
          image_path,
          width_px,
          height_px
          `
        )
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        ),

      DB
        .from(
          "layout_boxes"
        )
        .select(
          `
          id,
          page_no,
          box_type,
          label,
          x,
          y,
          width,
          height,
          points,
          sort_order
          `
        )
        .eq(
          "test_id",
          testId
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
        )

    ]);


  if (testResult.error) {

    throw testResult.error;

  }


  if (pageResult.error) {

    throw pageResult.error;

  }


  if (boxResult.error) {

    throw boxResult.error;

  }


  if (!testResult.data) {

    throw new Error(
      "テストが見つかりません。"
    );

  }


  test =
    testResult.data;


  pages =
    pageResult.data ||
    [];


  boxes =
    boxResult.data ||
    [];


  renderInformation();

}


/* =========================================================
   INFORMATION
========================================================= */

function renderInformation() {

  const element =
    document.getElementById(
      "testInformation"
    );


  if (!element) {

    return;

  }


  element.innerHTML = `

    <strong>
      ${escapeHtml(
        test.name
      )}
    </strong>

    <br>

    ${escapeHtml(
      [
        test.subject,
        test.grade,
        test.class_name
      ]
        .filter(Boolean)
        .join(" / ")
    )}

    <br>

    満点：
    ${formatNumber(
      test.max_score
    )}点

  `;

}


/* =========================================================
   RENDER
========================================================= */

async function renderPreview() {

  const pagePreview =
    document.getElementById(
      "pagePreview"
    );


  const boxPreview =
    document.getElementById(
      "boxPreview"
    );


  if (pagePreview) {

    pagePreview.innerHTML =
      "";

  }


  if (boxPreview) {

    boxPreview.innerHTML =
      "";

  }


  if (!pages.length) {

    pagePreview.innerHTML = `

      <div class="empty">
        解答用紙ページが登録されていません。
      </div>

    `;

    return;

  }


  for (
    const page
    of pages
  ) {

    await renderPage(
      page,
      pagePreview
    );

  }


  renderBoxSummary(
    boxPreview
  );

}


/* =========================================================
   PAGE
========================================================= */

async function renderPage(
  page,
  container
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.style.cssText = `
    position:relative;
    width:100%;
    max-width:1000px;
    margin:0 auto 25px;
    background:#fff;
    border:1px solid #d0d6dc;
  `;


  const {
    data,
    error
  } =
    await DB
      .storage
      .from(
        "test-files"
      )
      .createSignedUrl(
        page.image_path,
        1800
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    wrapper.innerHTML = `
      <div class="empty">
        P${page.page_no}の画像を取得できません。
      </div>
    `;


    container.appendChild(
      wrapper
    );


    return;

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    `解答用紙 ${page.page_no}ページ`;


  image.style.cssText = `
    display:block;
    width:100%;
    height:auto;
  `;


  await waitImage(
    image
  );


  wrapper.appendChild(
    image
  );


  const layer =
    document.createElement(
      "div"
    );


  layer.style.cssText = `
    position:absolute;
    inset:0;
    pointer-events:none;
  `;


  const sourceWidth =
    Number(
      page.width_px
    ) ||
    image.naturalWidth;


  const sourceHeight =
    Number(
      page.height_px
    ) ||
    image.naturalHeight;


  boxes
    .filter(
      box =>
        Number(
          box.page_no
        ) ===
        Number(
          page.page_no
        )
    )
    .forEach(
      box => {

        const element =
          document.createElement(
            "div"
          );


        const isAnswer =
          box.box_type ===
          "answer";


        element.style.cssText = `

          position:absolute;

          left:${
            Number(
              box.x
            ) /
            sourceWidth *
            100
          }%;

          top:${
            Number(
              box.y
            ) /
            sourceHeight *
            100
          }%;

          width:${
            Number(
              box.width
            ) /
            sourceWidth *
            100
          }%;

          height:${
            Number(
              box.height
            ) /
            sourceHeight *
            100
          }%;

          border:
            2px solid
            ${isAnswer
              ? "#1769aa"
              : "#888"};

          background:
            ${isAnswer
              ? "rgba(23,105,170,.08)"
              : "rgba(100,100,100,.04)"};

        `;


        const label =
          document.createElement(
            "span"
          );


        label.textContent =
          box.label ||
          box.box_type;


        label.style.cssText = `

          position:absolute;

          top:-22px;

          left:0;

          padding:2px 5px;

          background:#222;

          color:#fff;

          font-size:10px;

          white-space:nowrap;

        `;


        element.appendChild(
          label
        );


        layer.appendChild(
          element
        );

      }
    );


  wrapper.appendChild(
    layer
  );


  container.appendChild(
    wrapper
  );

}


/* =========================================================
   BOX SUMMARY
========================================================= */

function renderBoxSummary(
  container
) {

  if (!container) {

    return;

  }


  const answerBoxes =
    boxes.filter(
      box =>
        box.box_type ===
        "answer"
    );


  if (!answerBoxes.length) {

    container.innerHTML = `

      <div class="empty">
        採点対象の解答欄がありません。
      </div>

    `;

    return;

  }


  container.innerHTML = `

    <table
      class="table"
    >

      <thead>

        <tr>

          <th>
            設問
          </th>

          <th>
            ページ
          </th>

          <th>
            配点
          </th>

        </tr>

      </thead>

      <tbody>

        ${
          answerBoxes
            .map(
              (
                box,
                index
              ) => `

                <tr>

                  <td>
                    ${escapeHtml(
                      box.label ||
                      `問${index + 1}`
                    )}
                  </td>

                  <td>
                    ${Number(
                      box.page_no
                    ) || 1}
                  </td>

                  <td>
                    ${formatNumber(
                      box.points
                    )}点
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
   HELPERS
========================================================= */

function waitImage(
  image
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        image.complete &&
        image.naturalWidth
      ) {

        resolve();

        return;

      }


      image.onload =
        resolve;


      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );

    }
  );

}


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

    return "0";

  }


  return Number.isInteger(
    n
  )
    ? String(n)
    : n.toFixed(
        1
      );

}


function showError(
  text
) {

  const element =
    document.getElementById(
      "testInformation"
    );


  if (element) {

    element.innerHTML = `

      <div
        style="
          color:#b42318;
        "
      >

        ${escapeHtml(
          text
        )}

      </div>

    `;

  }

}


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
