
"use strict";

/* =========================================================
   答案クロップ

   流れ
   ---------------------------------------------------------
   テスト選択
      ↓
   生徒答案一覧
      ↓
   答案選択
      ↓
   layout_boxes の answer 枠を表示
      ↓
   元答案からクロップ
      ↓
   answer_regions に保存

   注意
   ---------------------------------------------------------
   ・QR / 氏名 / 大問 / 小計 / 合計はクロップ対象外
   ・answer枠だけを採用
   ・生徒名はクロップ設定画面では表示してよい
   ・採点画面では表示しない
========================================================= */

let DB = null;

let tests = [];

let selectedTestId = null;

let answers = [];

let selectedAnswer = null;

let pages = [];

let boxes = [];

let regions = [];

let selectedBox = null;

let dragState = null;


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "testSelect"
  );

const answerSelect =
  document.getElementById(
    "answerSelect"
  );

const loadButton =
  document.getElementById(
    "loadButton"
  );

const saveButton =
  document.getElementById(
    "saveButton"
  );

const deleteButton =
  document.getElementById(
    "deleteButton"
  );

const viewer =
  document.getElementById(
    "viewer"
  );

const regionList =
  document.getElementById(
    "regionList"
  );

const statusElement =
  document.getElementById(
    "status"
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


    setupEvents();


    await loadTests();


    selectTestFromUrl();


  } catch (error) {

    console.error(
      "answers-regions:",
      error
    );


    setStatus(
      error.message ||
      "答案クロップ画面を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    async () => {

      selectedTestId =
        testSelect.value ||
        null;


      selectedAnswer =
        null;

      pages =
        [];

      boxes =
        [];

      regions =
        [];

      selectedBox =
        null;


      resetAnswerSelect();


      if (!selectedTestId) {

        return;

      }


      await loadAnswers();

    }
  );


  answerSelect?.addEventListener(
    "change",
    () => {

      const answerId =
        answerSelect.value;


      selectedAnswer =
        answers.find(
          answer =>
            answer.id ===
            answerId
        ) ||
        null;


      loadSelectedAnswer();

    }
  );


  loadButton?.addEventListener(
    "click",
    loadSelectedAnswer
  );


  saveButton?.addEventListener(
    "click",
    saveRegions
  );


  deleteButton?.addEventListener(
    "click",
    deleteSelected
  );


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

}


/* =========================================================
   URL
========================================================= */

function selectTestFromUrl() {

  const params =
    new URLSearchParams(
      location.search
    );


  const requested =
    params.get(
      "test"
    );


  if (!requested) {

    return;

  }


  if (
    !tests.some(
      test =>
        test.id ===
        requested
    )
  ) {

    return;

  }


  selectedTestId =
    requested;


  testSelect.value =
    requested;


  loadAnswers();

}


/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

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
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    throw error;

  }


  tests =
    data || [];


  testSelect.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      tests
        .map(
          test => `

            <option
              value="${escapeHtml(
                test.id
              )}"
            >

              ${escapeHtml(
                [
                  test.name,
                  test.subject,
                  test.grade,
                  test.class_name
                ]
                  .filter(Boolean)
                  .join(" / ")
              )}

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   ANSWERS
========================================================= */

async function loadAnswers() {

  if (!selectedTestId) {

    return;

  }


  setStatus(
    "答案一覧を読み込んでいます..."
  );


  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        student_id,
        status,
        qr_value,
        created_at,
        students(
          student_no,
          name
        )
        `
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .not(
        "student_id",
        "is",
        null
      )
      .in(
        "status",
        [
          "uploaded",
          "marking",
          "marked"
        ]
      )
      .order(
        "created_at",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  answers =
    data || [];


  answerSelect.disabled =
    false;


  answerSelect.innerHTML = `

    <option value="">
      答案を選択してください
    </option>

    ${
      answers
        .map(
          (
            answer,
            index
          ) => `

            <option
              value="${escapeHtml(
                answer.id
              )}"
            >

              答案 ${String(
                index + 1
              ).padStart(
                3,
                "0"
              )}

              ${
                answer.students?.student_no
                  ? ` / ${escapeHtml(
                      answer.students.student_no
                    )}`
                  : ""
              }

              ${
                answer.students?.name
                  ? ` / ${escapeHtml(
                      answer.students.name
                    )}`
                  : ""
              }

            </option>

          `
        )
        .join("")
    }

  `;


  setStatus(
    `${answers.length}件の答案があります。`
  );

}


/* =========================================================
   LOAD ANSWER
========================================================= */

async function loadSelectedAnswer() {

  if (!selectedAnswer) {

    return;

  }


  setStatus(
    "答案と解答欄を読み込んでいます..."
  );


  pages =
    [];

  boxes =
    [];

  regions =
    [];

  selectedBox =
    null;


  await loadPages();

  await loadBoxes();

  await loadRegions();


  await renderViewer();

  renderRegionList();


  saveButton.disabled =
    false;

  deleteButton.disabled =
    false;


  setStatus(
    "青い枠を確認してください。保存すると答案クロップを生成します。"
  );

}


/* =========================================================
   PAGES
========================================================= */

async function loadPages() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheet_pages"
      )
      .select(
        `
        id,
        answer_sheet_id,
        page_no,
        file_path,
        width_px,
        height_px
        `
      )
      .eq(
        "answer_sheet_id",
        selectedAnswer.id
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


  pages =
    data || [];


  if (!pages.length) {

    throw new Error(
      "答案ページがありません。"
    );

  }

}


/* =========================================================
   BOXES
========================================================= */

async function loadBoxes() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "layout_boxes"
      )
      .select(
        `
        id,
        page_no,
        box_type,
        label,
        points,
        x,
        y,
        width,
        height,
        sort_order
        `
      )
      .eq(
        "test_id",
        selectedTestId
      )
      .eq(
        "box_type",
        "answer"
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


  const excluded =
    new Set([
      "QR",
      "氏名",
      "合計",
      "小計"
    ]);


  boxes =
    (data || [])
      .filter(
        box =>
          !excluded.has(
            String(
              box.label ||
              ""
            ).trim()
          )
      );

}


/* =========================================================
   REGIONS
========================================================= */

async function loadRegions() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_regions"
      )
      .select(
        `
        id,
        answer_sheet_id,
        layout_box_id,
        page_no,
        image_path,
        x,
        y,
        width,
        height
        `
      )
      .eq(
        "answer_sheet_id",
        selectedAnswer.id
      );


  if (error) {

    throw error;

  }


  regions =
    data || [];

}


/* =========================================================
   VIEWER
========================================================= */

async function renderViewer() {

  viewer.innerHTML =
    "";


  for (
    const page
    of pages
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      "page";


    const image =
      await createPageImage(
        page
      );


    wrapper.appendChild(
      image
    );


    const layer =
      document.createElement(
        "div"
      );


    layer.className =
      "page-layer";


    wrapper.appendChild(
      layer
    );


    viewer.appendChild(
      wrapper
    );


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

          const region =
            regions.find(
              item =>
                item.layout_box_id ===
                box.id
            );


          renderBox(
            layer,
            page,
            box,
            region
          );

        }
      );

  }

}


/* =========================================================
   PAGE IMAGE
========================================================= */

async function createPageImage(
  page
) {

  const {
    data,
    error
  } =
    await DB
      .storage
      .from(
        "answer-files"
      )
      .createSignedUrl(
        page.file_path,
        1800
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    throw new Error(
      "答案画像を取得できませんでした。"
    );

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    `答案 ${page.page_no}ページ`;


  await waitImage(
    image
  );


  return image;

}


/* =========================================================
   BOX
========================================================= */

function renderBox(
  layer,
  page,
  box,
  region
) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "region-box";


  element.dataset.boxId =
    box.id;


  const sourceWidth =
    Number(
      page.width_px
    ) ||
    1;


  const sourceHeight =
    Number(
      page.height_px
    ) ||
    1;


  const x =
    region
      ? Number(
          region.x
        )
      : Number(
          box.x
        );


  const y =
    region
      ? Number(
          region.y
        )
      : Number(
          box.y
        );


  const width =
    region
      ? Number(
          region.width
        )
      : Number(
          box.width
        );


  const height =
    region
      ? Number(
          region.height
        )
      : Number(
          box.height
        );


  element.style.left =
    `${x / sourceWidth * 100}%`;


  element.style.top =
    `${y / sourceHeight * 100}%`;


  element.style.width =
    `${width / sourceWidth * 100}%`;


  element.style.height =
    `${height / sourceHeight * 100}%`;


  if (
    selectedBox?.id ===
    box.id
  ) {

    element.classList.add(
      "selected"
    );

  }


  const label =
    document.createElement(
      "div"
    );


  label.className =
    "region-label";


  label.textContent =
    box.label ||
    "解答欄";


  element.appendChild(
    label
  );


  const handle =
    document.createElement(
      "div"
    );


  handle.className =
    "region-handle";


  element.appendChild(
    handle
  );


  element.addEventListener(
    "pointerdown",
    event => {

      event.stopPropagation();


      selectedBox =
        box;


      if (
        event.target ===
        handle
      ) {

        beginResize(
          event,
          element,
          page,
          box
        );

      } else {

        beginMove(
          event,
          element,
          page,
          box
        );

      }

    }
  );


  layer.appendChild(
    element
  );

}


/* =========================================================
   MOVE
========================================================= */

function beginMove(
  event,
  element,
  page,
  box
) {

  const startX =
    event.clientX;


  const startY =
    event.clientY;


  const originalX =
    Number(
      box.x
    ) || 0;


  const originalY =
    Number(
      box.y
    ) || 0;


  const rect =
    element
      .parentElement
      .getBoundingClientRect();


  const scaleX =
    Number(
      page.width_px
    ) /
    rect.width;


  const scaleY =
    Number(
      page.height_px
    ) /
    rect.height;


  const move =
    moveEvent => {

      box.x =
        Math.max(
          0,
          originalX +
          (
            moveEvent.clientX -
            startX
          ) *
          scaleX
        );


      box.y =
        Math.max(
          0,
          originalY +
          (
            moveEvent.clientY -
            startY
          ) *
          scaleY
        );


      renderViewer();

    };


  const up =
    () => {

      document.removeEventListener(
        "pointermove",
        move
      );

      document.removeEventListener(
        "pointerup",
        up
      );

      renderRegionList();

    };


  document.addEventListener(
    "pointermove",
    move
  );


  document.addEventListener(
    "pointerup",
    up
  );

}


/* =========================================================
   RESIZE
========================================================= */

function beginResize(
  event,
  element,
  page,
  box
) {

  const startX =
    event.clientX;


  const startY =
    event.clientY;


  const originalWidth =
    Number(
      box.width
    ) || 1;


  const originalHeight =
    Number(
      box.height
    ) || 1;


  const rect =
    element
      .parentElement
      .getBoundingClientRect();


  const scaleX =
    Number(
      page.width_px
    ) /
    rect.width;


  const scaleY =
    Number(
      page.height_px
    ) /
    rect.height;


  const move =
    moveEvent => {

      box.width =
        Math.max(
          5,
          originalWidth +
          (
            moveEvent.clientX -
            startX
          ) *
          scaleX
        );


      box.height =
        Math.max(
          5,
          originalHeight +
          (
            moveEvent.clientY -
            startY
          ) *
          scaleY
        );


      renderViewer();

    };


  const up =
    () => {

      document.removeEventListener(
        "pointermove",
        move
      );

      document.removeEventListener(
        "pointerup",
        up
      );

      renderRegionList();

    };


  document.addEventListener(
    "pointermove",
    move
  );


  document.addEventListener(
    "pointerup",
    up
  );

}


/* =========================================================
   SAVE
========================================================= */

async function saveRegions() {

  if (!selectedAnswer) {

    return;

  }


  setStatus(
    "答案クロップを生成しています..."
  );


  saveButton.disabled =
    true;


  try {

    /*
     * 既存regionsを削除。
     */

    const {
      error:
        deleteError
    } =
      await DB
        .from(
          "answer_regions"
        )
        .delete()
        .eq(
          "answer_sheet_id",
          selectedAnswer.id
        );


    if (deleteError) {

      throw deleteError;

    }


    regions =
      [];


    for (
      const page
      of pages
    ) {

      const pageBoxes =
        boxes.filter(
          box =>
            Number(
              box.page_no
            ) ===
            Number(
              page.page_no
            )
        );


      if (!pageBoxes.length) {

        continue;

      }


      const {
        data:
          sourceBlob,
        error:
          downloadError
      } =
        await DB
          .storage
          .from(
            "answer-files"
          )
          .download(
            page.file_path
          );


      if (downloadError) {

        throw downloadError;

      }


      const image =
        await blobToImage(
          sourceBlob
        );


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


      for (
        const box
        of pageBoxes
      ) {

        const x =
          clamp(
            Number(
              box.x
            ) || 0,
            0,
            sourceWidth
          );


        const y =
          clamp(
            Number(
              box.y
            ) || 0,
            0,
            sourceHeight
          );


        const width =
          clamp(
            Number(
              box.width
            ) || 0,
            1,
            sourceWidth -
              x
          );


        const height =
          clamp(
            Number(
              box.height
            ) || 0,
            1,
            sourceHeight -
              y
          );


        const cropCanvas =
          document.createElement(
            "canvas"
          );


        cropCanvas.width =
          Math.max(
            1,
            Math.round(
              width *
              image.naturalWidth /
              sourceWidth
            )
          );


        cropCanvas.height =
          Math.max(
            1,
            Math.round(
              height *
              image.naturalHeight /
              sourceHeight
            )
          );


        const context =
          cropCanvas.getContext(
            "2d"
          );


        const sx =
          x *
          image.naturalWidth /
          sourceWidth;


        const sy =
          y *
          image.naturalHeight /
          sourceHeight;


        const sw =
          width *
          image.naturalWidth /
          sourceWidth;


        const sh =
          height *
          image.naturalHeight /
          sourceHeight;


        context.drawImage(
          image,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );


        const blob =
          await canvasToBlob(
            cropCanvas
          );


        const path =
          [
            selectedTestId,
            selectedAnswer.id,
            `${box.id}.png`
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
              "student-answers"
            )
            .upload(
              path,
              blob,
              {
                contentType:
                  "image/png",
                upsert:
                  true
              }
            );


        if (uploadError) {

          throw uploadError;

        }


        const region = {

          answer_sheet_id:
            selectedAnswer.id,

          layout_box_id:
            box.id,

          page_no:
            page.page_no,

          image_path:
            path,

          x,

          y,

          width,

          height

        };


        const {
          data,
          error:
            regionError
        } =
          await DB
            .from(
              "answer_regions"
            )
            .insert(
              region
            )
            .select()
            .single();


        if (regionError) {

          throw regionError;

        }


        regions.push(
          data
        );

      }

    }


    setStatus(
      `${regions.length}個の答案クロップを保存しました。`
    );


    renderRegionList();


  } catch (error) {

    console.error(
      "save regions:",
      error
    );


    setStatus(
      error.message ||
      "答案クロップの保存に失敗しました。",
      true
    );

  } finally {

    saveButton.disabled =
      false;

  }

}


/* =========================================================
   DELETE
========================================================= */

async function deleteSelected() {

  if (!selectedBox || !selectedAnswer) {

    setStatus(
      "削除する解答欄を選択してください。",
      true
    );

    return;

  }


  const region =
    regions.find(
      item =>
        item.layout_box_id ===
        selectedBox.id
    );


  if (!region) {

    selectedBox =
      null;


    await renderViewer();

    return;

  }


  try {

    const {
      error
    } =
      await DB
        .from(
          "answer_regions"
        )
        .delete()
        .eq(
          "id",
          region.id
        );


    if (error) {

      throw error;

    }


    if (
      region.image_path
    ) {

      await DB
        .storage
        .from(
          "student-answers"
        )
        .remove([
          region.image_path
        ]);

    }


    regions =
      regions.filter(
        item =>
          item.id !==
          region.id
      );


    selectedBox =
      null;


    await renderViewer();

    renderRegionList();


    setStatus(
      "選択したクロップを削除しました。"
    );


  } catch (error) {

    setStatus(
      error.message ||
      "クロップ削除に失敗しました。",
      true
    );

  }

}


/* =========================================================
   LIST
========================================================= */

function renderRegionList() {

  if (!regionList) {

    return;

  }


  if (!boxes.length) {

    regionList.innerHTML = `

      <div class="empty">
        解答欄がありません。
      </div>

    `;

    return;

  }


  regionList.innerHTML =
    "";


  boxes.forEach(
    box => {

      const region =
        regions.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      const row =
        document.createElement(
          "div"
        );


      row.className =
        "region-row";


      if (
        selectedBox?.id ===
        box.id
      ) {

        row.classList.add(
          "selected"
        );

      }


      const label =
        document.createElement(
          "div"
        );


      label.textContent =
        [
          box.label ||
          "解答欄",
          `P${box.page_no}`
        ].join(
          " / "
        );


      const state =
        document.createElement(
          "div"
        );


      state.textContent =
        region
          ? "クロップ済み"
          : "未作成";


      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "btn";


      button.textContent =
        "選択";


      button.addEventListener(
        "click",
        async () => {

          selectedBox =
            box;


          await renderViewer();

          renderRegionList();

        }
      );


      row.append(
        label,
        state,
        button
      );


      regionList.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   RESET
========================================================= */

function resetAnswerSelect() {

  answerSelect.innerHTML = `

    <option value="">
      答案を選択してください
    </option>

  `;


  answerSelect.disabled =
    true;


  loadButton.disabled =
    true;


  saveButton.disabled =
    true;


  deleteButton.disabled =
    true;


  viewer.innerHTML = `

    <div class="empty">
      答案を表示してください。
    </div>

  `;


  regionList.innerHTML = `

    <div class="empty">
      答案を表示するとクロップ一覧が表示されます。
    </div>

  `;

}


/* =========================================================
   IMAGE
========================================================= */

function blobToImage(
  blob
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const url =
        URL.createObjectURL(
          blob
        );


      const image =
        new Image();


      image.onload =
        () => {

          URL.revokeObjectURL(
            url
          );


          resolve(
            image
          );

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            url
          );


          reject(
            new Error(
              "答案画像を読み込めませんでした。"
            )
          );

        };


      image.src =
        url;

    }
  );

}


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


function canvasToBlob(
  canvas
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      canvas.toBlob(
        blob => {

          if (!blob) {

            reject(
              new Error(
                "クロップ画像を作成できませんでした。"
              )
            );

            return;

          }


          resolve(
            blob
          );

        },
        "image/png",
        1
      );

    }
  );

}


/* =========================================================
   UTIL
========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );

}


function setStatus(
  text,
  error = false
) {

  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "status error"
      : "status";

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
