
"use strict";

/* =========================================================
   解答用紙登録 + 枠設定

   流れ
   ---------------------------------------------------------
   PDF / 画像
      ↓
   test_pagesへ登録
      ↓
   answer枠を設定
      ↓
   layout_boxes
      ↓
   配点設定
      ↓
   採点

   採点対象
   ---------------------------------------------------------
   box_type = answer

   QR / 氏名 / 生徒番号 / その他
   ---------------------------------------------------------
   採点対象外
========================================================= */

let DB = null;

let testId = null;

let pages = [];

let boxes = [];

let selectedBox = null;

let currentRole = "answer";

let drawing = false;

let drawPage = null;

let drawLayer = null;

let drawStart = null;

let drawPreview = null;

let moving = null;


/* =========================================================
   DOM
========================================================= */

const viewer =
  document.getElementById(
    "viewer"
  );

const statusElement =
  document.getElementById(
    "status"
  );

const answerFile =
  document.getElementById(
    "answerFile"
  );

const uploadButton =
  document.getElementById(
    "uploadButton"
  );

const saveButton =
  document.getElementById(
    "saveButton"
  );

const boxRole =
  document.getElementById(
    "boxRole"
  );

const boxPanel =
  document.getElementById(
    "boxPanel"
  );

const applyButton =
  document.getElementById(
    "applyButton"
  );

const deleteButton =
  document.getElementById(
    "deleteSelectedButton"
  );

const closePanelButton =
  document.getElementById(
    "closePanelButton"
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


    const params =
      new URLSearchParams(
        location.search
      );


    testId =
      params.get(
        "test"
      ) ||
      params.get(
        "id"
      );


    setupEvents();


    if (!testId) {

      setStatus(
        "テストIDが指定されていません。",
        true
      );

      return;

    }


    await loadLayout();


  } catch (error) {

    console.error(
      "test-pages:",
      error
    );


    setStatus(
      error.message ||
      "解答用紙設定を読み込めませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  uploadButton?.addEventListener(
    "click",
    uploadAnswerSheet
  );


  saveButton?.addEventListener(
    "click",
    saveBoxes
  );


  applyButton?.addEventListener(
    "click",
    applySelectedBox
  );


  deleteButton?.addEventListener(
    "click",
    deleteSelectedBox
  );


  closePanelButton?.addEventListener(
    "click",
    closeBoxPanel
  );


  boxRole?.addEventListener(
    "change",
    () => {

      currentRole =
        boxRole.value ||
        "answer";

      updateRoleHelp();

    }
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
   LOAD
========================================================= */

async function loadLayout() {

  setStatus(
    "解答用紙を読み込んでいます..."
  );


  const {
    data:pageData,
    error:pageError
  } =
    await DB
      .from(
        "test_pages"
      )
      .select(
        `
        id,
        test_id,
        page_no,
        image_path,
        width_px,
        height_px,
        original_name
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


  if (pageError) {

    throw pageError;

  }


  pages =
    pageData || [];


  const {
    data:boxData,
    error:boxError
  } =
    await DB
      .from(
        "layout_boxes"
      )
      .select(
        `
        id,
        test_id,
        page_no,
        box_type,
        label,
        x,
        y,
        width,
        height,
        question_id,
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
      );


  if (boxError) {

    throw boxError;

  }


  boxes =
    boxData || [];


  normalizeBoxes();


  await renderAllPages();


  setStatus(
    pages.length
      ? "解答欄を選択して、解答用紙上をドラッグしてください。"
      : "先に解答用紙を登録してください。"
  );

}


/* =========================================================
   NORMALIZE
========================================================= */

function normalizeBoxes() {

  boxes.forEach(
    box => {

      box.box_type =
        normalizeBoxType(
          box.box_type
        );


      if (
        box.points ===
          null ||
        box.points ===
          undefined
      ) {

        box.points =
          box.box_type ===
            "answer"
            ? 0
            : null;

      }

    }
  );

}


/* =========================================================
   UPLOAD
========================================================= */

async function uploadAnswerSheet() {

  const files =
    [
      ...(answerFile?.files || [])
    ];


  if (!files.length) {

    setStatus(
      "解答用紙ファイルを選択してください。",
      true
    );

    return;

  }


  uploadButton.disabled =
    true;


  try {

    for (
      const file
      of files
    ) {

      const parsed =
        await parseFile(
          file
        );


      if (!parsed.length) {

        continue;

      }


      /*
       * 既存ページ番号の続きから登録。
       */

      let pageNo =
        pages.length
          ? Math.max(
              ...pages.map(
                page =>
                  Number(
                    page.page_no
                  ) || 0
              )
            ) + 1
          : 1;


      for (
        const page
        of parsed
      ) {

        const blob =
          page.blob;


        const path =
          [
            testId,
            "test-pages",
            crypto.randomUUID(),
            `${String(
              pageNo
            ).padStart(
              3,
              "0"
            )}.png`
          ].join(
            "/"
          );


        const {
          error:uploadError
        } =
          await DB
            .storage
            .from(
              "test-files"
            )
            .upload(
              path,
              blob,
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
              "test_pages"
            )
            .insert({

              test_id:
                testId,

              page_no:
                pageNo,

              image_path:
                path,

              width_px:
                page.width ||
                null,

              height_px:
                page.height ||
                null,

              original_name:
                page.name ||
                file.name

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


        pages.push(
          data
        );


        pageNo++;

      }

    }


    pages.sort(
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


    answerFile.value =
      "";


    await renderAllPages();


    setStatus(
      `${pages.length}ページの解答用紙を登録しました。`
    );


  } catch (error) {

    console.error(
      "upload:",
      error
    );


    setStatus(
      error.message ||
      "解答用紙登録に失敗しました。",
      true
    );

  } finally {

    uploadButton.disabled =
      false;

  }

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
   RENDER
========================================================= */

async function renderAllPages() {

  viewer.innerHTML =
    "";


  if (!pages.length) {

    viewer.innerHTML = `

      <div class="empty-view">

        <strong>
          解答用紙がありません
        </strong>

        PDFまたは画像を登録してください。

      </div>

    `;

    return;

  }


  for (
    const page
    of pages
  ) {

    await renderPage(
      page
    );

  }

}


/* =========================================================
   PAGE
========================================================= */

async function renderPage(
  page
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "page";


  wrapper.dataset.pageNo =
    String(
      page.page_no
    );


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

        renderBox(
          layer,
          page,
          box
        );

      }
    );


  setupDrawing(
    layer,
    page
  );

}


/* =========================================================
   IMAGE
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

    throw new Error(
      `P${page.page_no}の画像を取得できませんでした。`
    );

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    data.signedUrl;


  image.alt =
    `解答用紙 ${page.page_no}ページ`;


  await waitImage(
    image
  );


  return image;

}


/* =========================================================
   DRAWING
========================================================= */

function setupDrawing(
  layer,
  page
) {

  layer.addEventListener(
    "pointerdown",
    event => {

      if (
        event.target !==
        layer
      ) {

        return;

      }


      beginDrawing(
        event,
        layer,
        page
      );

    }
  );

}


/* =========================================================
   BEGIN DRAW
========================================================= */

function beginDrawing(
  event,
  layer,
  page
) {

  drawing =
    true;


  drawPage =
    page;


  drawLayer =
    layer;


  const rect =
    layer.getBoundingClientRect();


  drawStart = {

    x:
      event.clientX -
      rect.left,

    y:
      event.clientY -
      rect.top

  };


  drawPreview =
    document.createElement(
      "div"
    );


  drawPreview.className =
    "drag-preview";


  layer.appendChild(
    drawPreview
  );


  const move =
    moveEvent => {

      if (!drawing) {

        return;

      }


      const x =
        moveEvent.clientX -
        rect.left;


      const y =
        moveEvent.clientY -
        rect.top;


      const left =
        Math.min(
          drawStart.x,
          x
        );


      const top =
        Math.min(
          drawStart.y,
          y
        );


      drawPreview.style.left =
        `${left}px`;


      drawPreview.style.top =
        `${top}px`;


      drawPreview.style.width =
        `${Math.abs(
          x -
          drawStart.x
        )}px`;


      drawPreview.style.height =
        `${Math.abs(
          y -
          drawStart.y
        )}px`;

    };


  const up =
    upEvent => {

      document.removeEventListener(
        "pointermove",
        move
      );


      document.removeEventListener(
        "pointerup",
        up
      );


      if (!drawing) {

        return;

      }


      drawing =
        false;


      const x =
        upEvent.clientX -
        rect.left;


      const y =
        upEvent.clientY -
        rect.top;


      const left =
        Math.min(
          drawStart.x,
          x
        );


      const top =
        Math.min(
          drawStart.y,
          y
        );


      const width =
        Math.abs(
          x -
          drawStart.x
        );


      const height =
        Math.abs(
          y -
          drawStart.y
        );


      drawPreview?.remove();


      if (
        width <
        8 ||
        height <
        8
      ) {

        return;

      }


      const scale =
        getPageScale(
          layer,
          page
        );


      const box = {

        id:
          crypto.randomUUID(),

        test_id:
          testId,

        page_no:
          Number(
            page.page_no
          ),

        box_type:
          roleToBoxType(
            currentRole
          ),

        label:
          defaultLabel(
            currentRole
          ),

        x:
          left /
          scale,

        y:
          top /
          scale,

        width:
          width /
          scale,

        height:
          height /
          scale,

        question_id:
          null,

        points:
          currentRole ===
            "answer"
            ? 0
            : null,

        sort_order:
          boxes.length

      };


      boxes.push(
        box
      );


      selectedBox =
        box;


      await renderAllPages();


      setStatus(
        `${box.label}を追加しました。`
      );

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
   BOX
========================================================= */

function renderBox(
  layer,
  page,
  box
) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "layout-box";


  if (
    selectedBox?.id ===
    box.id
  ) {

    element.classList.add(
      "selected"
    );

  }


  const scale =
    getPageScale(
      layer,
      page
    );


  element.style.left =
    `${Number(
      box.x
    ) * scale}px`;


  element.style.top =
    `${Number(
      box.y
    ) * scale}px`;


  element.style.width =
    `${Number(
      box.width
    ) * scale}px`;


  element.style.height =
    `${Number(
      box.height
    ) * scale}px`;


  const label =
    document.createElement(
      "div"
    );


  label.className =
    "layout-box-label";


  label.textContent =
    box.label ||
    box.box_type;


  element.appendChild(
    label
  );


  const handle =
    document.createElement(
      "div"
    );


  handle.className =
    "resize-handle";


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
          layer,
          page,
          box
        );

      } else {

        beginMove(
          event,
          layer,
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
  layer,
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


  const scale =
    getPageScale(
      layer,
      page
    );


  const move =
    moveEvent => {

      box.x =
        Math.max(
          0,
          originalX +
          (
            moveEvent.clientX -
            startX
          ) /
          scale
        );


      box.y =
        Math.max(
          0,
          originalY +
          (
            moveEvent.clientY -
            startY
          ) /
          scale
        );


      renderAllPages();

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
  layer,
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
    ) || 10;


  const originalHeight =
    Number(
      box.height
    ) || 10;


  const scale =
    getPageScale(
      layer,
      page
    );


  const move =
    moveEvent => {

      box.width =
        Math.max(
          5,
          originalWidth +
          (
            moveEvent.clientX -
            startX
          ) /
          scale
        );


      box.height =
        Math.max(
          5,
          originalHeight +
          (
            moveEvent.clientY -
            startY
          ) /
          scale
        );


      renderAllPages();

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

async function saveBoxes() {

  saveButton.disabled =
    true;


  try {

    const {
      data:existing,
      error:existingError
    } =
      await DB
        .from(
          "layout_boxes"
        )
        .select(
          "id"
        )
        .eq(
          "test_id",
          testId
        );


    if (existingError) {

      throw existingError;

    }


    const keepIds =
      new Set(
        boxes
          .filter(
            box =>
              isUuid(
                box.id
              )
          )
          .map(
            box =>
              box.id
          )
      );


    /*
     * 画面から削除された枠をDBから削除。
     */

    for (
      const old
      of (
        existing ||
        []
      )
    ) {

      if (
        !keepIds.has(
          old.id
        )
      ) {

        const {
          error
        } =
          await DB
            .from(
              "layout_boxes"
            )
            .delete()
            .eq(
              "id",
              old.id
            );


        if (error) {

          throw error;

        }

      }

    }


    for (
      let index = 0;
      index <
      boxes.length;
      index++
    ) {

      const box =
        boxes[index];


      const payload = {

        test_id:
          testId,

        page_no:
          Number(
            box.page_no
          ) || 1,

        box_type:
          normalizeBoxType(
            box.box_type
          ),

        label:
          box.label ||
          null,

        x:
          Number(
            box.x
          ) || 0,

        y:
          Number(
            box.y
          ) || 0,

        width:
          Number(
            box.width
          ) || 0,

        height:
          Number(
            box.height
          ) || 0,

        question_id:
          null,

        points:
          box.box_type ===
            "answer"
            ? Number(
                box.points
              ) || 0
            : null,

        sort_order:
          index

      };


      if (
        isUuid(
          box.id
        )
      ) {

        const {
          error
        } =
          await DB
            .from(
              "layout_boxes"
            )
            .update(
              payload
            )
            .eq(
              "id",
              box.id
            );


        if (error) {

          throw error;

        }

      } else {

        const {
          data,
          error
        } =
          await DB
            .from(
              "layout_boxes"
            )
            .insert(
              payload
            )
            .select()
            .single();


        if (error) {

          throw error;

        }


        box.id =
          data.id;

      }

    }


    setStatus(
      "枠設定を保存しました。配点設定へ進めます。"
    );


  } catch (error) {

    console.error(
      "save boxes:",
      error
    );


    setStatus(
      error.message ||
      "枠設定を保存できませんでした。",
      true
    );

  } finally {

    saveButton.disabled =
      false;

  }

}


/* =========================================================
   APPLY
========================================================= */

function applySelectedBox() {

  if (!selectedBox) {

    setStatus(
      "選択されている枠がありません。",
      true
    );

    return;

  }


  const role =
    boxRole.value ||
    "answer";


  selectedBox.box_type =
    roleToBoxType(
      role
    );


  selectedBox.label =
    defaultLabel(
      role
    );


  selectedBox.points =
    selectedBox.box_type ===
      "answer"
      ? (
          Number(
            selectedBox.points
          ) || 0
        )
      : null;


  renderAllPages();


  updateRoleHelp();

}


/* =========================================================
   DELETE
========================================================= */

function deleteSelectedBox() {

  if (!selectedBox) {

    return;

  }


  boxes =
    boxes.filter(
      box =>
        box !==
        selectedBox
    );


  selectedBox =
    null;


  renderAllPages();


  setStatus(
    "選択した枠を削除しました。保存するとDBにも反映されます。"
  );

}


/* =========================================================
   PANEL
========================================================= */

function openBoxPanel() {

  boxPanel?.classList.add(
    "open"
  );

}


function closeBoxPanel() {

  boxPanel?.classList.remove(
    "open"
  );

}


function updateRoleHelp() {

  currentRole =
    boxRole?.value ||
    "answer";


  const text = {

    answer:
      "採点対象の解答欄",

    qr:
      "答案識別用QR",

    name:
      "氏名欄",

    student_no:
      "生徒番号欄",

    major:
      "大問（採点対象にはしない）",

    minor:
      "小問",

    subtotal:
      "小計",

    total:
      "合計",

    instruction:
      "説明欄",

    other:
      "その他"

  }[currentRole];


  const element =
    document.getElementById(
      "parentInfo"
    );


  if (element) {

    element.textContent =
      text ||
      "";

  }

}


/* =========================================================
   UTIL
========================================================= */

function getPageScale(
  layer,
  page
) {

  const width =
    layer.clientWidth;


  const source =
    Number(
      page.width_px
    ) ||
    width;


  return source > 0
    ? width /
      source
    : 1;

}


function roleToBoxType(
  role
) {

  if (
    role ===
    "qr"
  ) {

    return "qr";

  }


  if (
    role ===
    "name"
  ) {

    return "name";

  }


  if (
    role ===
    "student_no"
  ) {

    return "student_no";

  }


  if (
    role ===
    "other" ||
    role ===
    "instruction"
  ) {

    return "other";

  }


  return "answer";

}


function normalizeBoxType(
  type
) {

  return [

    "answer",
    "qr",
    "student_no",
    "name",
    "other"

  ].includes(
    type
  )
    ? type
    : "other";

}


function defaultLabel(
  role
) {

  if (
    role ===
    "qr"
  ) {

    return "QR";

  }


  if (
    role ===
    "name"
  ) {

    return "氏名";

  }


  if (
    role ===
    "student_no"
  ) {

    return "生徒番号";

  }


  if (
    role ===
    "major"
  ) {

    return "大問";

  }


  if (
    role ===
    "minor"
  ) {

    return "小問";

  }


  if (
    role ===
    "subtotal"
  ) {

    return "小計";

  }


  if (
    role ===
    "total"
  ) {

    return "合計";

  }


  if (
    role ===
    "instruction"
  ) {

    return "説明";

  }


  if (
    role ===
    "other"
  ) {

    return "その他";

  }


  const count =
    boxes.filter(
      box =>
        box.box_type ===
        "answer"
    ).length;


  return `問${count + 1}`;

}


function isUuid(
  value
) {

  return (
    typeof value ===
      "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        value
      )
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
        reject;

    }
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
