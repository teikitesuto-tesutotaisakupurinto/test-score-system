
"use strict";

/* =========================================================
   模範解答

   ・テスト単位で管理
   ・PDF / 画像を登録
   ・複数ページ対応
   ・既存ファイルをクリア可能
   ・生徒答案とは完全に分離
========================================================= */

let DB = null;

let testId = null;

let currentTest = null;

let modelPages = [];


/* =========================================================
   DOM
========================================================= */

const messageElement =
  document.getElementById(
    "message"
  );

const pageList =
  document.getElementById(
    "pageList"
  );

const pageCount =
  document.getElementById(
    "pageCount"
  );

const fileInput =
  document.getElementById(
    "modelAnswerFiles"
  );

const uploadButton =
  document.getElementById(
    "uploadButton"
  );

const clearButton =
  document.getElementById(
    "clearButton"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

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

    await loadTest();

    await loadModelPages();

    renderPages();


  } catch (error) {

    console.error(
      "model-answer:",
      error
    );


    showMessage(
      error.message ||
      "模範解答を読み込めませんでした。",
      true
    );

  }

}


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
        elementId,
        href
      ]
    ) => {

      const element =
        document.getElementById(
          elementId
        );


      if (element) {

        element.href =
          href;

      }

    }
  );

}


/* =========================================================
   TEST
========================================================= */

async function loadTest() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "tests"
      )
      .select(
        `
        id,
        name,
        subject,
        grade,
        class_name
        `
      )
      .eq(
        "id",
        testId
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


  currentTest =
    data;


  const element =
    document.getElementById(
      "testInformation"
    );


  if (element) {

    element.innerHTML = `

      <strong>
        ${escapeHtml(
          data.name
        )}
      </strong>

      <br>

      ${escapeHtml(
        [
          data.subject,
          data.grade,
          data.class_name
        ]
          .filter(Boolean)
          .join(" / ")
      )}

    `;

  }

}


/* =========================================================
   LOAD
========================================================= */

async function loadModelPages() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "test_model_pages"
      )
      .select(
        `
        id,
        test_id,
        page_no,
        file_path,
        original_name,
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
      );


  if (error) {

    /*
     * 既存DBでテーブルが無い場合にも
     * 画面自体は開けるようにする。
     */

    console.warn(
      "test_model_pages:",
      error
    );


    modelPages =
      [];

    return;

  }


  modelPages =
    data || [];

}


/* =========================================================
   UPLOAD
========================================================= */

uploadButton?.addEventListener(
  "click",
  uploadModelAnswer
);


async function uploadModelAnswer() {

  const files =
    [
      ...(fileInput?.files || [])
    ];


  if (!files.length) {

    showMessage(
      "模範解答ファイルを選択してください。",
      true
    );

    return;

  }


  uploadButton.disabled =
    true;


  try {

    let nextPage =
      modelPages.length
        ? Math.max(
            ...modelPages.map(
              page =>
                Number(
                  page.page_no
                ) || 0
            )
          ) + 1
        : 1;


    for (
      const file
      of files
    ) {

      const parsed =
        await parseFile(
          file
        );


      for (
        const page
        of parsed
      ) {

        const path =
          [
            testId,
            "model",
            crypto.randomUUID(),
            `${String(
              nextPage
            ).padStart(
              3,
              "0"
            )}.png`
          ].join(
            "/"
          );


        const {
          error:
            uploadError
        } =
          await DB
            .storage
            .from(
              "test-files"
            )
            .upload(
              path,
              page.blob,
              {
                contentType:
                  "image/png",
                upsert:
                  false
              }
            );


        if (uploadError) {

          throw uploadError;

        }


        const {
          data,
          error
        } =
          await DB
            .from(
              "test_model_pages"
            )
            .insert({

              test_id:
                testId,

              page_no:
                nextPage,

              file_path:
                path,

              original_name:
                file.name,

              width_px:
                page.width ||
                null,

              height_px:
                page.height ||
                null

            })
            .select()
            .single();


        if (error) {

          await DB
            .storage
            .from(
              "test-files"
            )
            .remove([
              path
            ]);


          throw error;

        }


        modelPages.push(
          data
        );


        nextPage++;

      }

    }


    modelPages.sort(
      (
        a,
        b
      ) =>
        Number(
          a.page_no
        ) -
        Number(
          b.page_no
        )
    );


    fileInput.value =
      "";


    renderPages();


    showMessage(
      "模範解答を登録しました。"
    );


  } catch (error) {

    console.error(
      "model upload:",
      error
    );


    showMessage(
      error.message ||
      "模範解答の登録に失敗しました。",
      true
    );

  } finally {

    uploadButton.disabled =
      false;

  }

}


/* =========================================================
   CLEAR
========================================================= */

clearButton?.addEventListener(
  "click",
  clearModelAnswer
);


async function clearModelAnswer() {

  if (!modelPages.length) {

    return;

  }


  if (
    !window.confirm(
      "登録済みの模範解答をすべて削除しますか？"
    )
  ) {

    return;

  }


  clearButton.disabled =
    true;


  try {

    for (
      const page
      of modelPages
    ) {

      if (
        page.file_path
      ) {

        await DB
          .storage
          .from(
            "test-files"
          )
          .remove([
            page.file_path
          ]);

      }

    }


    const {
      error
    } =
      await DB
        .from(
          "test_model_pages"
        )
        .delete()
        .eq(
          "test_id",
          testId
        );


    if (error) {

      throw error;

    }


    modelPages =
      [];


    renderPages();


    showMessage(
      "模範解答を削除しました。"
    );


  } catch (error) {

    console.error(
      "model clear:",
      error
    );


    showMessage(
      error.message ||
      "模範解答を削除できませんでした。",
      true
    );

  } finally {

    clearButton.disabled =
      false;

  }

}


/* =========================================================
   RENDER
========================================================= */

function renderPages() {

  if (pageCount) {

    pageCount.textContent =
      `${modelPages.length}ページ`;

  }


  if (!pageList) {

    return;

  }


  if (!modelPages.length) {

    pageList.innerHTML = `

      <div class="empty">
        模範解答は登録されていません。
      </div>

    `;

    return;

  }


  pageList.innerHTML =
    "";


  modelPages.forEach(
    page => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "model-page";


      item.innerHTML = `

        <div
          class="model-page-title"
        >
          模範解答 ${page.page_no}ページ
        </div>

        <div
          class="model-page-name"
        >
          ${escapeHtml(
            page.original_name ||
            ""
          )}
        </div>

      `;


      pageList.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   PARSE
========================================================= */

async function parseFile(
  file
) {

  if (
    window.TEST_SCORE_FILES?.parseFile
  ) {

    return await window.TEST_SCORE_FILES
      .parseFile(
        file
      );

  }


  throw new Error(
    "ファイル解析ライブラリが読み込まれていません。"
  );

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  error = false
) {

  if (!messageElement) {

    return;

  }


  messageElement.textContent =
    text;


  messageElement.style.color =
    error
      ? "#b42318"
      : "#16834b";

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
