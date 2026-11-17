"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定

   ・PDF / 画像
   ・test-files Storage
   ・test_pages
   ・layout_boxes
   ・ドラッグで枠作成
   ・枠移動
   ・枠リサイズ
   ・枠削除
   ・枠保存
========================================================= */


let selectedTestId = null;

let pages = [];

let boxes = [];

let selectedBoxId = null;

let drawing = false;

let drawingPointerId = null;

let drawStart = null;

let drawPage = null;

let drawLayer = null;

let drawPreview = null;

let dragMode = null;

let dragPointerId = null;

let dragBoxId = null;

let dragStart = null;

let dragOriginal = null;


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

const backButton =
  document.getElementById(
    "backButton"
  );

const boxPanel =
  document.getElementById(
    "boxPanel"
  );

const boxRole =
  document.getElementById(
    "boxRole"
  );

const parentInfo =
  document.getElementById(
    "parentInfo"
  );

const applyButton =
  document.getElementById(
    "applyButton"
  );

const deleteSelectedButton =
  document.getElementById(
    "deleteSelectedButton"
  );

const closePanelButton =
  document.getElementById(
    "closePanelButton"
  );


/* =========================================================
   ROLE
========================================================= */

const ROLE_INFO = {

  answer: {
    label: "解答欄",
    boxType: "answer"
  },

  qr: {
    label: "QR",
    boxType: "qr"
  },

  name: {
    label: "氏名",
    boxType: "name"
  },

  student_no: {
    label: "生徒番号",
    boxType: "student_no"
  },

  other: {
    label: "その他",
    boxType: "other"
  }

};


const ALLOWED_BOX_TYPES = [
  "answer",
  "qr",
  "name",
  "student_no",
  "other"
];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


    const params =
      new URLSearchParams(
        location.search
      );


    selectedTestId =
      params.get(
        "test"
      );


    setupEvents();


    updateRoleHelp();


    if (!selectedTestId) {

      setStatus(
        "テストIDが指定されていません。",
        true
      );

      return;

    }


    await loadLayout();


  } catch (error) {

    console.error(
      "test-pages initialize:",
      error
    );


    setStatus(
      error.message ||
      "解答用紙・枠設定を読み込めませんでした。",
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


  deleteSelectedButton?.addEventListener(
    "click",
    deleteSelectedBox
  );


  closePanelButton?.addEventListener(
    "click",
    closeBoxPanel
  );


  boxRole?.addEventListener(
    "change",
    updateRoleHelp
  );


  backButton?.addEventListener(
    "click",
    () => {

      location.href =
        "/teacher/tests";

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


  document.addEventListener(
    "keydown",
    handleKeyboard
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
    data: pageData,
    error: pageError
  } =
    await supabaseClient
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
        selectedTestId
      )
      .order(
        "page_no",
        {
          ascending: true
        }
      );


  if (pageError) {

    throw pageError;

  }


  pages =
    pageData || [];


  const {
    data: boxData,
    error: boxError
  } =
    await supabaseClient
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
        selectedTestId
      )
      .order(
        "page_no",
        {
          ascending: true
        }
      )
      .order(
        "sort_order",
        {
          ascending: true
        }
      );


  if (boxError) {

    throw boxError;

  }


  boxes =
    (
      boxData ||
      []
    ).filter(
      box =>
        ALLOWED_BOX_TYPES.includes(
          normalizeBoxType(
            box.box_type
          )
        )
    );


  normalizeBoxes();


  await renderAllPages();


  setStatus(
    pages.length
      ? "解答欄を選択して、答案上をドラッグしてください。"
      : "解答用紙を登録してください。"
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


      box.x =
        Number(
          box.x
        ) || 0;


      box.y =
        Number(
          box.y
        ) || 0;


      box.width =
        Number(
          box.width
        ) || 10;


      box.height =
        Number(
          box.height
        ) || 10;


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
   SELECTED BOX
========================================================= */

function getSelectedBox() {

  if (!selectedBoxId) {

    return null;

  }


  return boxes.find(
    box =>
      box.id ===
      selectedBoxId
  ) || null;

}


/* =========================================================
   UPLOAD
========================================================= */

async function uploadAnswerSheet() {

  const file =
    answerFile?.files?.[0];


  if (!file) {

    setStatus(
      "解答用紙ファイルを選択してください。",
      true
    );

    return;

  }


  if (!selectedTestId) {

    setStatus(
      "テストIDがありません。",
      true
    );

    return;

  }


  uploadButton.disabled =
    true;


  try {

    setStatus(
      "解答用紙を解析しています..."
    );


    const parsed =
      await parseFile(
        file
      );


    if (!parsed.length) {

      throw new Error(
        "解答用紙のページを取得できませんでした。"
      );

    }


    const startPage =
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
      let index = 0;
      index <
      parsed.length;
      index++
    ) {

      const page =
        parsed[index];


      const pageNo =
        startPage +
        index;


      const path =
        [
          selectedTestId,
          "answer-sheet",
          crypto.randomUUID(),
          `page-${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}.png`
        ].join(
          "/"
        );


      setStatus(
        `解答用紙を保存しています... ${
          index + 1
        } / ${
          parsed.length
        }`
      );


      const {
        error:
          uploadError
      } =
        await supabaseClient
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

              cacheControl:
                "3600",

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
        await supabaseClient
          .from(
            "test_pages"
          )
          .insert({

            test_id:
              selectedTestId,

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
              file.name

          })
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
          .single();


      if (error) {

        await supabaseClient
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
      `${parsed.length}ページの解答用紙を登録しました。`
    );


  } catch (error) {

    console.error(
      "uploadAnswerSheet:",
      error
    );


    setStatus(
      error.message ||
      "解答用紙の登録に失敗しました。",
      true
    );

  } finally {

    uploadButton.disabled =
      false;

  }

}


/* =========================================================
   FILE PARSER
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


  const extension =
    getExtension(
      file.name
    );


  if (
    extension ===
    "pdf"
  ) {

    if (
      window.TEST_SCORE_PDF
        ?.pdfToPages
    ) {

      return await window.TEST_SCORE_PDF
        .pdfToPages(
          file,
          2
        );

    }


    throw new Error(
      "PDF処理エンジンが読み込まれていません。"
    );

  }


  if (
    [
      "jpg",
      "jpeg",
      "png",
      "webp"
    ].includes(
      extension
    )
  ) {

    const image =
      await loadImage(
        URL.createObjectURL(
          file
        )
      );


    const blob =
      await imageToPng(
        image
      );


    return [

      {

        pageNo:
          1,

        name:
          file.name,

        blob,

        width:
          image.naturalWidth,

        height:
          image.naturalHeight

      }

    ];

  }


  throw new Error(
    "PDF、JPG、JPEG、PNG、WEBPのみ対応しています。"
  );

}


/* =========================================================
   RENDER ALL
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

        <br><br>

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
   RENDER PAGE
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


  layer.dataset.pageNo =
    String(
      page.page_no
    );


  wrapper.appendChild(
    layer
  );


  viewer.appendChild(
    wrapper
  );


  setupDrawing(
    layer,
    page
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

    throw new Error(
      `ページ${page.page_no}の画像を取得できませんでした。`
    );

  }


  const image =
    await loadImage(
      data.signedUrl
    );


  image.style.display =
    "block";


  image.style.width =
    "100%";


  image.style.height =
    "auto";


  image.draggable =
    false;


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


      if (
        event.button !==
          0 &&
        event.pointerType !==
          "touch"
      ) {

        return;

      }


      event.preventDefault();


      drawing =
        true;


      drawingPointerId =
        event.pointerId;


      drawPage =
        page;


      drawLayer =
        layer;


      const rect =
        layer.getBoundingClientRect();


      drawStart =
        getPoint(
          event,
          rect
        );


      drawPreview =
        document.createElement(
          "div"
        );


      drawPreview.className =
        "drag-preview";


      layer.appendChild(
        drawPreview
      );


      try {

        layer.setPointerCapture(
          event.pointerId
        );

      } catch (_) {}

    }
  );


  layer.addEventListener(
    "pointermove",
    event => {

      if (
        !drawing ||
        event.pointerId !==
          drawingPointerId
      ) {

        return;

      }


      event.preventDefault();


      updateDrawPreview(
        event
      );

    }
  );


  layer.addEventListener(
    "pointerup",
    event => {

      if (
        !drawing ||
        event.pointerId !==
          drawingPointerId
      ) {

        return;

      }


      event.preventDefault();


      finishDrawing(
        event
      );

    }
  );


  layer.addEventListener(
    "pointercancel",
    event => {

      if (
        event.pointerId ===
        drawingPointerId
      ) {

        cancelDrawing();

      }

    }
  );

}


/* =========================================================
   DRAW PREVIEW
========================================================= */

function updateDrawPreview(
  event
) {

  if (
    !drawPreview ||
    !drawLayer ||
    !drawStart
  ) {

    return;

  }


  const rect =
    drawLayer.getBoundingClientRect();


  const current =
    getPoint(
      event,
      rect
    );


  const left =
    Math.min(
      drawStart.x,
      current.x
    );


  const top =
    Math.min(
      drawStart.y,
      current.y
    );


  const width =
    Math.abs(
      current.x -
      drawStart.x
    );


  const height =
    Math.abs(
      current.y -
      drawStart.y
    );


  drawPreview.style.left =
    `${left}px`;


  drawPreview.style.top =
    `${top}px`;


  drawPreview.style.width =
    `${width}px`;


  drawPreview.style.height =
    `${height}px`;

}


/* =========================================================
   FINISH DRAWING
========================================================= */

async function finishDrawing(
  event
) {

  /*
   * finishDrawing()の中で
   * drawPageをnullにする前に
   * 必要な値を全部退避する。
   */

  const layer =
    drawLayer;


  const page =
    drawPage;


  const start =
    drawStart;


  if (
    !layer ||
    !page ||
    !start
  ) {

    cancelDrawing();

    return;

  }


  const rect =
    layer.getBoundingClientRect();


  const end =
    getPoint(
      event,
      rect
    );


  const left =
    Math.min(
      start.x,
      end.x
    );


  const top =
    Math.min(
      start.y,
      end.y
    );


  const width =
    Math.abs(
      end.x -
      start.x
    );


  const height =
    Math.abs(
      end.y -
      start.y
    );


  /*
   * ここで一度だけ描画状態を解除。
   * page/layerはローカル変数に残っている。
   */

  cancelDrawing();


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


  const role =
    boxRole?.value ||
    "answer";


  const info =
    ROLE_INFO[
      role
    ] ||
    ROLE_INFO.answer;


  const box = {

    id:
      crypto.randomUUID(),

    test_id:
      selectedTestId,

    page_no:
      Number(
        page.page_no
      ),

    box_type:
      info.boxType,

    label:
      info.label,

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
      info.boxType ===
        "answer"
        ? 0
        : null,

    sort_order:
      boxes.length

  };


  boxes.push(
    box
  );


  selectedBoxId =
    box.id;


  await renderAllPages();


  setStatus(
    `${box.label}を追加しました。`
  );

}


/* =========================================================
   CANCEL DRAWING
========================================================= */

function cancelDrawing() {

  drawing =
    false;


  drawingPointerId =
    null;


  drawStart =
    null;


  drawPage =
    null;


  if (
    drawLayer
  ) {

    drawLayer
      .removeEventListener(
        "pointermove",
        updateDrawPreview
      );

  }


  drawPreview?.remove();


  drawPreview =
    null;


  drawLayer =
    null;

}


/* =========================================================
   BOX RENDER
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


  element.dataset.boxId =
    box.id;


  if (
    selectedBoxId ===
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


      selectedBoxId =
        box.id;


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

  dragMode =
    "move";


  dragPointerId =
    event.pointerId;


  dragBoxId =
    box.id;


  dragStart = {

    x:
      event.clientX,

    y:
      event.clientY

  };


  dragOriginal = {

    x:
      Number(
        box.x
      ) || 0,

    y:
      Number(
        box.y
      ) || 0

  };


  try {

    layer.setPointerCapture(
      event.pointerId
    );

  } catch (_) {}

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

  dragMode =
    "resize";


  dragPointerId =
    event.pointerId;


  dragBoxId =
    box.id;


  dragStart = {

    x:
      event.clientX,

    y:
      event.clientY

  };


  dragOriginal = {

    width:
      Number(
        box.width
      ) || 10,

    height:
      Number(
        box.height
      ) || 10

  };


  try {

    layer.setPointerCapture(
      event.pointerId
    );

  } catch (_) {}

}


/* =========================================================
   GLOBAL POINTER MOVE
========================================================= */

document.addEventListener(
  "pointermove",
  event => {

    if (
      !dragMode ||
      event.pointerId !==
        dragPointerId
    ) {

      return;

    }


    const box =
      boxes.find(
        item =>
          item.id ===
          dragBoxId
      );


    if (!box) {

      return;

    }


    const page =
      pages.find(
        item =>
          Number(
            item.page_no
          ) ===
          Number(
            box.page_no
          )
      );


    if (!page) {

      return;

    }


    const layer =
      document.querySelector(
        `.page-layer[data-page-no="${CSS.escape(
          String(
            box.page_no
          )
        )}"]`
      );


    if (!layer) {

      return;

    }


    const scale =
      getPageScale(
        layer,
        page
      );


    const dx =
      (
        event.clientX -
        dragStart.x
      ) /
      scale;


    const dy =
      (
        event.clientY -
        dragStart.y
      ) /
      scale;


    if (
      dragMode ===
      "move"
    ) {

      box.x =
        Math.max(
          0,
          dragOriginal.x +
          dx
        );


      box.y =
        Math.max(
          0,
          dragOriginal.y +
          dy
        );

    } else {

      box.width =
        Math.max(
          5,
          dragOriginal.width +
          dx
        );


      box.height =
        Math.max(
          5,
          dragOriginal.height +
          dy
        );

    }


    renderBoxLayer(
      page
    );

  }
);


/* =========================================================
   GLOBAL POINTER UP
========================================================= */

document.addEventListener(
  "pointerup",
  event => {

    if (
      dragPointerId ===
      event.pointerId
    ) {

      dragMode =
        null;

      dragPointerId =
        null;

      dragBoxId =
        null;

      dragStart =
        null;

      dragOriginal =
        null;

    }

  }
);


/* =========================================================
   RENDER BOX LAYER
========================================================= */

function renderBoxLayer(
  page
) {

  const layer =
    document.querySelector(
      `.page-layer[data-page-no="${CSS.escape(
        String(
          page.page_no
        )
      )}"]`
    );


  if (!layer) {

    return;

  }


  layer
    .querySelectorAll(
      ".layout-box"
    )
    .forEach(
      element =>
        element.remove()
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

}


/* =========================================================
   APPLY
========================================================= */

function applySelectedBox() {

  const box =
    getSelectedBox();


  if (!box) {

    setStatus(
      "選択されている枠がありません。",
      true
    );

    return;

  }


  const role =
    boxRole?.value ||
    "answer";


  const info =
    ROLE_INFO[
      role
    ] ||
    ROLE_INFO.answer;


  box.box_type =
    info.boxType;


  box.label =
    info.label;


  box.points =
    info.boxType ===
      "answer"
      ? Number(
          box.points
        ) || 0
      : null;


  renderAllPages();


  setStatus(
    `${box.label}に変更しました。`
  );

}


/* =========================================================
   DELETE
========================================================= */

function deleteSelectedBox() {

  if (!selectedBoxId) {

    return;

  }


  boxes =
    boxes.filter(
      box =>
        box.id !==
        selectedBoxId
    );


  selectedBoxId =
    null;


  renderAllPages();


  setStatus(
    "枠を削除しました。保存するとDBにも反映されます。"
  );

}


/* =========================================================
   SAVE
========================================================= */

async function saveBoxes() {

  if (!selectedTestId) {

    return;

  }


  saveButton.disabled =
    true;


  try {

    setStatus(
      "枠設定を保存しています..."
    );


    const {
      data: existing,
      error: existingError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(
          "id"
        )
        .eq(
          "test_id",
          selectedTestId
        );


    if (existingError) {

      throw existingError;

    }


    const currentIds =
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


    for (
      const oldBox
      of (
        existing ||
        []
      )
    ) {

      if (
        !currentIds.has(
          oldBox.id
        )
      ) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "layout_boxes"
            )
            .delete()
            .eq(
              "id",
              oldBox.id
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
          selectedTestId,

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
          await supabaseClient
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
          await supabaseClient
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


    await loadLayout();


    setStatus(
      "枠設定を保存しました。"
    );


  } catch (error) {

    console.error(
      "saveBoxes:",
      error
    );


    setStatus(
      error.message ||
      "枠設定の保存に失敗しました。",
      true
    );

  } finally {

    saveButton.disabled =
      false;

  }

}


/* =========================================================
   ROLE HELP
========================================================= */

function updateRoleHelp() {

  const role =
    boxRole?.value ||
    "answer";


  const info =
    ROLE_INFO[
      role
    ] ||
    ROLE_INFO.answer;


  if (parentInfo) {

    parentInfo.textContent =
      `${info.label}を作成します。`;

  }

}


/* =========================================================
   PANEL
========================================================= */

function closeBoxPanel() {

  boxPanel?.classList.remove(
    "open"
  );

}


/* =========================================================
   KEYBOARD
========================================================= */

function handleKeyboard(
  event
) {

  const target =
    event.target;


  if (
    target instanceof
      HTMLInputElement ||
    target instanceof
      HTMLTextAreaElement ||
    target instanceof
      HTMLSelectElement
  ) {

    return;

  }


  if (
    event.key ===
    "Escape"
  ) {

    cancelDrawing();


    dragMode =
      null;


    selectedBoxId =
      null;


    renderAllPages();

  }


  if (
    event.key ===
    "Delete"
  ) {

    deleteSelectedBox();

  }

}


/* =========================================================
   GEOMETRY
========================================================= */

function getPoint(
  event,
  rect
) {

  return {

    x:
      Math.max(
        0,
        Math.min(
          rect.width,
          event.clientX -
          rect.left
        )
      ),

    y:
      Math.max(
        0,
        Math.min(
          rect.height,
          event.clientY -
          rect.top
        )
      )

  };

}


function getPageScale(
  layer,
  page
) {

  const sourceWidth =
    Number(
      page.width_px
    ) ||
    layer.clientWidth;


  if (
    !sourceWidth
  ) {

    return 1;

  }


  return (
    layer.clientWidth /
    sourceWidth
  );

}


/* =========================================================
   IMAGE
========================================================= */

function loadImage(
  src
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        () =>
          resolve(
            image
          );


      image.onerror =
        () =>
          reject(
            new Error(
              "画像を読み込めませんでした。"
            )
          );


      image.src =
        src;

    }
  );

}


function imageToPng(
  image
) {

  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    image.naturalWidth;


  canvas.height =
    image.naturalHeight;


  const context =
    canvas.getContext(
      "2d"
    );


  context.fillStyle =
    "#fff";


  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  context.drawImage(
    image,
    0,
    0
  );


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
                "PNG変換に失敗しました。"
              )
            );

            return;

          }


          resolve(
            blob
          );

        },
        "image/png"
      );

    }
  );

}


/* =========================================================
   UTIL
========================================================= */

function getExtension(
  value
) {

  const name =
    String(
      value ||
      ""
    )
      .split("?")[0]
      .toLowerCase();


  const index =
    name.lastIndexOf(
      "."
    );


  return index >= 0
    ? name.slice(
        index + 1
      )
    : "";

}


function normalizeBoxType(
  value
) {

  const type =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  return ALLOWED_BOX_TYPES.includes(
    type
  )
    ? type
    : "other";

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


function setStatus(
  message,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    message;


  statusElement.classList.toggle(
    "error",
    error
  );

}
