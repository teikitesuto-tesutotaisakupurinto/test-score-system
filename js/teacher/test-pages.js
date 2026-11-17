
"use strict";

/* =========================================================
   解答用紙登録 + 枠設定

   ・test-files
   ・test_pages
   ・layout_boxes
   ・手動ドラッグ
   ・自動枠検出
   ・検出候補クリック
========================================================= */

let selectedTestId = null;

let pages = [];

let boxes = [];

let candidates = [];

let selectedBoxId = null;

let drawing = false;

let drawLayer = null;

let drawPage = null;

let drawStart = null;

let drawPreview = null;

let dragMode = null;

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

    openBoxPanel();

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
      "test-pages:",
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
      ? "解答用紙上をドラッグして枠を作成できます。アップロード後は自動検出候補も表示します。"
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


  candidates
    .filter(
      candidate =>
        Number(
          candidate.pageNo
        ) ===
        Number(
          page.page_no
        )
    )
    .forEach(
      candidate => {

        renderCandidate(
          layer,
          page,
          candidate
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
   MANUAL DRAW
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


      drawing =
        true;


      drawLayer =
        layer;


      drawPage =
        page;


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

      if (!drawing) {

        return;

      }


      updateDrawPreview(
        event
      );

    }
  );


  layer.addEventListener(
    "pointerup",
    event => {

      if (!drawing) {

        return;

      }


      finishDrawing(
        event
      );

    }
  );


  layer.addEventListener(
    "pointercancel",
    cancelDrawing
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


  drawPreview.style.left =
    `${left}px`;


  drawPreview.style.top =
    `${top}px`;


  drawPreview.style.width =
    `${Math.abs(
      current.x -
      drawStart.x
    )}px`;


  drawPreview.style.height =
    `${Math.abs(
      current.y -
      drawStart.y
    )}px`;

}


/* =========================================================
   FINISH DRAW
========================================================= */

async function finishDrawing(
  event
) {

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
   CANCEL DRAW
========================================================= */

function cancelDrawing() {

  drawing =
    false;


  drawStart =
    null;


  drawPage =
    null;


  drawLayer =
    null;


  drawPreview?.remove();


  drawPreview =
    null;

}


/* =========================================================
   AUTO DETECTION
========================================================= */

async function detectAllPages() {

  candidates =
    [];


  if (!pages.length) {

    return;

  }


  setStatus(
    "解答用紙の枠を自動検出しています..."
  );


  for (
    const page
    of pages
  ) {

    try {

      const detected =
        await detectPageCandidates(
          page
        );


      candidates.push(
        ...detected
      );

    } catch (error) {

      console.warn(
        "auto detect:",
        error
      );

    }

  }


  await renderAllPages();


  setStatus(
    candidates.length
      ? `自動検出 ${candidates.length}個。候補をクリックすると枠として追加できます。`
      : "自動検出できる枠がありません。手動ドラッグで設定できます。"
  );

}


/* =========================================================
   DETECT PAGE
========================================================= */

async function detectPageCandidates(
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
        600
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    return [];

  }


  const image =
    await loadImage(
      data.signedUrl
    );


  const maxWidth =
    1800;


  const scale =
    Math.min(
      1,
      maxWidth /
      image.naturalWidth
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.round(
      image.naturalWidth *
      scale
    );


  canvas.height =
    Math.round(
      image.naturalHeight *
      scale
    );


  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
   * OpenCVが利用可能なら輪郭検出。
   */

  if (
    window.cv
  ) {

    return detectWithOpenCV(
      canvas,
      page,
      scale
    );

  }


  /*
   * OpenCVがまだ無い場合は
   * 単純な投影検出。
   */

  return detectWithProjection(
    canvas,
    page,
    scale
  );

}


/* =========================================================
   OPENCV
========================================================= */

function detectWithOpenCV(
  canvas,
  page,
  scale
) {

  const src =
    cv.imread(
      canvas
    );


  const gray =
    new cv.Mat();


  const threshold =
    new cv.Mat();


  const contours =
    new cv.MatVector();


  const hierarchy =
    new cv.Mat();


  try {

    cv.cvtColor(
      src,
      gray,
      cv.COLOR_RGBA2GRAY
    );


    cv.threshold(
      gray,
      threshold,
      205,
      255,
      cv.THRESH_BINARY_INV
    );


    cv.findContours(
      threshold,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );


    const result =
      [];


    for (
      let i = 0;
      i <
      contours.size();
      i++
    ) {

      const contour =
        contours.get(
          i
        );


      const perimeter =
        cv.arcLength(
          contour,
          true
        );


      const approx =
        new cv.Mat();


      cv.approxPolyDP(
        contour,
        approx,
        perimeter *
          0.025,
        true
      );


      const rect =
        cv.boundingRect(
          contour
        );


      const area =
        rect.width *
        rect.height;


      const imageArea =
        canvas.width *
        canvas.height;


      const ratio =
        rect.width /
        Math.max(
          1,
          rect.height
        );


      if (
        approx.rows >= 4 &&
        approx.rows <= 6 &&
        area >
          imageArea *
          0.0002 &&
        area <
          imageArea *
          0.35 &&
        ratio >
          0.15 &&
        ratio <
          8
      ) {

        const duplicate =
          result.some(
            candidate =>
              overlapRatio(
                candidate,
                {
                  x:
                    rect.x /
                    scale,

                  y:
                    rect.y /
                    scale,

                  width:
                    rect.width /
                    scale,

                  height:
                    rect.height /
                    scale
                }
              ) >
              0.75
          );


        if (!duplicate) {

          result.push({

            id:
              crypto.randomUUID(),

            pageNo:
              Number(
                page.page_no
              ),

            x:
              rect.x /
              scale,

            y:
              rect.y /
              scale,

            width:
              rect.width /
              scale,

            height:
              rect.height /
              scale

          });

        }

      }


      approx.delete();

      contour.delete();

    }


    return result
      .sort(
        (
          a,
          b
        ) =>
          a.y -
          b.y ||
          a.x -
          b.x
      )
      .slice(
        0,
        300
      );

  } finally {

    src.delete();

    gray.delete();

    threshold.delete();

    contours.delete();

    hierarchy.delete();

  }

}


/* =========================================================
   SIMPLE DETECTION
========================================================= */

function detectWithProjection(
  canvas,
  page,
  scale
) {

  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  const data =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );


  const rows =
    new Uint32Array(
      canvas.height
    );


  const cols =
    new Uint32Array(
      canvas.width
    );


  for (
    let y = 0;
    y <
    canvas.height;
    y++
  ) {

    for (
      let x = 0;
      x <
      canvas.width;
      x++
    ) {

      const index =
        (
          y *
          canvas.width +
          x
        ) *
        4;


      const gray =
        (
          data.data[index] +
          data.data[index + 1] +
          data.data[index + 2]
        ) /
        3;


      if (
        gray <
        150
      ) {

        rows[y]++;

        cols[x]++;

      }

    }

  }


  const horizontal =
    findRuns(
      rows,
      canvas.width *
      0.18
    );


  const vertical =
    findRuns(
      cols,
      canvas.height *
      0.18
    );


  const result =
    [];


  for (
    let yi = 0;
    yi <
    horizontal.length;
    yi++
  ) {

    for (
      let xi = 0;
      xi <
      vertical.length;
      xi++
    ) {

      for (
        let yj = yi + 1;
        yj <
        Math.min(
          yi + 8,
          horizontal.length
        );
        yj++
      ) {

        for (
          let xj = xi + 1;
          xj <
          Math.min(
            xi + 8,
            vertical.length
          );
          xj++
        ) {

          const x =
            vertical[xi];


          const right =
            vertical[xj];


          const y =
            horizontal[yi];


          const bottom =
            horizontal[yj];


          const width =
            right -
            x;


          const height =
            bottom -
            y;


          if (
            width <
            30 ||
            height <
            20
          ) {

            continue;

          }


          if (
            width >
            canvas.width *
            0.9 ||
            height >
            canvas.height *
            0.4
          ) {

            continue;

          }


          result.push({

            id:
              crypto.randomUUID(),

            pageNo:
              Number(
                page.page_no
              ),

            x:
              x /
              scale,

            y:
              y /
              scale,

            width:
              width /
              scale,

            height:
              height /
              scale

          });

        }

      }

    }

  }


  return deduplicateCandidates(
    result
  ).slice(
    0,
    200
  );

}


function findRuns(
  values,
  threshold
) {

  const runs =
    [];


  let start =
    -1;


  for (
    let i = 0;
    i <
    values.length;
    i++
  ) {

    if (
      values[i] >=
      threshold
    ) {

      if (
        start <
        0
      ) {

        start =
          i;

      }

    } else if (
      start >=
      0
    ) {

      if (
        i -
        start >=
        2
      ) {

        runs.push(
          Math.round(
            (
              start +
              i
            ) /
            2
          )
        );

      }


      start =
        -1;

    }

  }


  return runs;

}


/* =========================================================
   CANDIDATE
========================================================= */

function renderCandidate(
  layer,
  page,
  candidate
) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "auto-box-candidate";


  const scale =
    getPageScale(
      layer,
      page
    );


  element.style.left =
    `${candidate.x * scale}px`;


  element.style.top =
    `${candidate.y * scale}px`;


  element.style.width =
    `${candidate.width * scale}px`;


  element.style.height =
    `${candidate.height * scale}px`;


  element.title =
    "クリックして枠として追加";


  element.addEventListener(
    "pointerdown",
    event => {

      event.stopPropagation();

      event.preventDefault();


      acceptCandidate(
        candidate
      );

    }
  );


  layer.appendChild(
    element
  );

}


/* =========================================================
   ACCEPT CANDIDATE
========================================================= */

async function acceptCandidate(
  candidate
) {

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
      candidate.pageNo,

    box_type:
      info.boxType,

    label:
      info.label,

    x:
      candidate.x,

    y:
      candidate.y,

    width:
      candidate.width,

    height:
      candidate.height,

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


  candidates =
    candidates.filter(
      item =>
        item.id !==
        candidate.id
    );


  await renderAllPages();


  setStatus(
    `${box.label}として枠を作成しました。`
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


    const ids =
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
        !ids.has(
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
          ),

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
          normalizeBoxType(
            box.box_type
          ) ===
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
      "枠設定を保存できませんでした。",
      true
    );

  } finally {

    saveButton.disabled =
      false;

  }

}


/* =========================================================
   SELECTED
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
    `${box.label}に設定しました。`
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
   ROLE
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
      `${info.label}として新しい枠を作成します。`;

  }

}


/* =========================================================
   PANEL
========================================================= */

function openBoxPanel() {

  if (!boxPanel) {

    return;

  }


  boxPanel.classList.add(
    "open"
  );


  boxPanel.style.display =
    "block";

}


function closeBoxPanel() {

  if (!boxPanel) {

    return;

  }


  boxPanel.classList.remove(
    "open"
  );

}


/* =========================================================
   KEYBOARD
========================================================= */

function handleKeyboard(
  event
) {

  if (
    event.target instanceof
      HTMLInputElement ||
    event.target instanceof
      HTMLTextAreaElement ||
    event.target instanceof
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


  if (!sourceWidth) {

    return 1;

  }


  return (
    layer.clientWidth /
    sourceWidth
  );

}


/* =========================================================
   MOVE / RESIZE
========================================================= */

function beginMove(
  event,
  box
) {

  dragMode =
    "move";


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

}


function beginResize(
  event,
  box
) {

  dragMode =
    "resize";


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

}


document.addEventListener(
  "pointermove",
  event => {

    if (!dragMode) {

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
            page.page_no
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


document.addEventListener(
  "pointerup",
  () => {

    dragMode =
      null;

    dragBoxId =
      null;

    dragStart =
      null;

    dragOriginal =
      null;

  }
);


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
          box
        );

      } else {

        beginMove(
          event,
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
   BOX LAYER
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
      box =>
        renderBox(
          layer,
          page,
          box
        )
    );

}


/* =========================================================
   CANDIDATE DEDUPE
========================================================= */

function deduplicateCandidates(
  list
) {

  const result =
    [];


  for (
    const candidate
    of list
  ) {

    const duplicate =
      result.some(
        existing =>
          overlapRatio(
            candidate,
            existing
          ) >
          0.70
      );


    if (!duplicate) {

      result.push(
        candidate
      );

    }

  }


  return result;

}


function overlapRatio(
  a,
  b
) {

  const left =
    Math.max(
      a.x,
      b.x
    );


  const top =
    Math.max(
      a.y,
      b.y
    );


  const right =
    Math.min(
      a.x +
      a.width,
      b.x +
      b.width
    );


  const bottom =
    Math.min(
      a.y +
      a.height,
      b.y +
      b.height
    );


  if (
    right <=
    left ||
    bottom <=
    top
  ) {

    return 0;

  }


  const intersection =
    (
      right -
      left
    ) *
    (
      bottom -
      top
    );


  const areaA =
    a.width *
    a.height;


  const areaB =
    b.width *
    b.height;


  return (
    intersection /
    Math.min(
      areaA,
      areaB
    )
  );

}


/* =========================================================
   LOAD IMAGE
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


/* =========================================================
   UTIL
========================================================= */

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


function getExtension(
  value
) {

  const text =
    String(
      value ||
      ""
    )
      .split("?")[0]
      .toLowerCase();


  const index =
    text.lastIndexOf(
      "."
    );


  return index >= 0
    ? text.slice(
        index + 1
      )
    : "";

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
  text,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.classList.toggle(
    "error",
    error
  );

}
