"use strict";

/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定エディタ
========================================================= */

let selectedTestId = null;

let pages = [];

let boxes = [];

let candidates = [];

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

let pdfPromise = null;


/* =======================================================
   DOM
======================================================= */

const viewer =
  document.getElementById("viewer");

const statusElement =
  document.getElementById("status");

const answerFile =
  document.getElementById("answerFile");

const uploadButton =
  document.getElementById("uploadButton");

const saveButton =
  document.getElementById("saveButton");

const backButton =
  document.getElementById("backButton");

const boxPanel =
  document.getElementById("boxPanel");

const boxRole =
  document.getElementById("boxRole");

const parentInfo =
  document.getElementById("parentInfo");

const applyButton =
  document.getElementById("applyButton");

const deleteSelectedButton =
  document.getElementById("deleteSelectedButton");

const closePanelButton =
  document.getElementById("closePanelButton");


/* =======================================================
   DB ALLOWED TYPES
======================================================= */

const ALLOWED_BOX_TYPES = [
  "answer",
  "qr",
  "student_no",
  "name",
  "other"
];


/* =======================================================
   ROLES
======================================================= */

const ROLE_INFO = {

  major: {
    label: "大問",
    boxType: "answer"
  },

  minor: {
    label: "小問",
    boxType: "answer"
  },

  qr: {
    label: "QR",
    boxType: "qr"
  },

  subtotal: {
    label: "小計",
    boxType: "answer"
  },

  total: {
    label: "合計",
    boxType: "answer"
  },

  name: {
    label: "氏名",
    boxType: "name"
  },

  student_no: {
    label: "生徒番号",
    boxType: "student_no"
  },

  instruction: {
    label: "説明",
    boxType: "other"
  },

  other: {
    label: "その他",
    boxType: "other"
  }

};


/* =======================================================
   INITIALIZE
======================================================= */

async function initialize() {

  try {

    const auth =
      await requireRole("teacher");


    if (!auth) {
      return;
    }


    const profile =
      auth.profile;


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        profile.name ||
        "先生";

    }


    selectedTestId =
      new URLSearchParams(
        window.location.search
      ).get("test") ||
      window.__TEST_ID__ ||
      null;


    setupEvents();


    /*
      枠設定を最初から表示
    */

    openBoxPanel();


    updateRoleHelp();


    if (!selectedTestId) {

      setStatus(
        "テストIDが指定されていません。"
      );

      return;

    }


    await loadLayout();


  } catch (error) {

    console.error(
      "test-pages initialize:",
      error
    );


    showError(
      error.message ||
      "解答用紙・枠設定画面を読み込めませんでした。"
    );

  }

}


/* =======================================================
   EVENTS
======================================================= */

function setupEvents() {

  uploadButton?.addEventListener(
    "click",
    uploadAnswerSheet
  );


  saveButton?.addEventListener(
    "click",
    saveBoxes
  );


  backButton?.addEventListener(
    "click",
    goBack
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
      logout
    );


  document.addEventListener(
    "keydown",
    handleKeyboard
  );

}


/* =======================================================
   LOAD
======================================================= */

async function loadLayout() {

  setStatus(
    "解答用紙を読み込んでいます..."
  );


  /*
    test_pages
  */

  const {
    data: pageData,
    error: pageError
  } =
    await supabaseClient
      .from("test_pages")
      .select(`
        id,
        test_id,
        page_no,
        image_path,
        width_px,
        height_px,
        original_name
      `)
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


  /*
    layout_boxes
  */

  const {
    data: boxData,
    error: boxError
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
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
        parent_box_id,
        major_no,
        minor_no,
        box_role,
        sort_order,
        subtotal_group
      `)
      .eq(
        "test_id",
        selectedTestId
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
    boxData || [];


  normalizeBoxes();

  rebuildHierarchy();

  await renderAllPages();


  if (!pages.length) {

    setStatus(
      "解答用紙を登録してください。"
    );

    return;

  }


  setStatus(
    "枠種類を選択して、解答用紙上をドラッグしてください。"
  );

}


/* =======================================================
   NORMALIZE
======================================================= */

function normalizeBoxes() {

  boxes.forEach(
    box => {

      if (
        !ROLE_INFO[
          box.box_role
        ]
      ) {

        box.box_role =
          inferRole(box);

      }


      box.box_type =
        ROLE_INFO[
          box.box_role
        ]?.boxType ||
        "other";


      /*
        配点は後で設定
      */

      box.points =
        0;


      /*
        設問IDはこの画面では使用しない
      */

      box.question_id =
        null;

    }
  );

}


/* =======================================================
   REBUILD HIERARCHY
======================================================= */

function rebuildHierarchy() {

  /*
    大問番号
  */

  const majors =
    boxes
      .filter(
        box =>
          box.box_role ===
          "major"
      )
      .sort(
        compareBoxes
      );


  majors.forEach(
    (
      major,
      index
    ) => {

      major.major_no =
        index + 1;

      major.parent_box_id =
        null;

      major.minor_no =
        null;

      major.subtotal_group =
        null;

    }
  );


  /*
    小問
  */

  boxes
    .filter(
      box =>
        box.box_role ===
        "minor"
    )
    .forEach(
      box => {

        updateParent(box);

      }
    );


  /*
    小計
  */

  boxes
    .filter(
      box =>
        box.box_role ===
        "subtotal"
    )
    .forEach(
      box => {

        updateParent(box);

      }
    );


  renumberAll();

}


/* =======================================================
   RENDER ALL
======================================================= */

async function renderAllPages() {

  if (!viewer) {
    return;
  }


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
    const page of pages
  ) {

    await renderPage(page);

  }

}


/* =======================================================
   RENDER PAGE
======================================================= */

async function renderPage(
  page
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "page";


  const canvas =
    document.createElement(
      "canvas"
    );


  const layer =
    document.createElement(
      "div"
    );


  layer.className =
    "page-layer";


  wrapper.appendChild(
    canvas
  );


  wrapper.appendChild(
    layer
  );


  viewer.appendChild(
    wrapper
  );


  if (!page.image_path) {

    throw new Error(
      `ページ${page.page_no}のimage_pathがありません。`
    );

  }


  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from("test-files")
      .createSignedUrl(
        page.image_path,
        3600
      );


  if (error) {
    throw error;
  }


  if (
    !data?.signedUrl
  ) {

    throw new Error(
      `ページ${page.page_no}の画像URLを取得できません。`
    );

  }


  const image =
    await loadImage(
      data.signedUrl
    );


  canvas.width =
    image.naturalWidth;


  canvas.height =
    image.naturalHeight;


  canvas
    .getContext("2d")
    .drawImage(
      image,
      0,
      0
    );


  /*
    新規枠
  */

  setupDrawing(
    layer,
    page
  );


  /*
    既存枠
  */

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
    .sort(
      compareBoxes
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


/* =======================================================
   DRAWING
======================================================= */

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
        event.button !== 0 &&
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


      try {

        layer.setPointerCapture(
          event.pointerId
        );

      } catch (_) {}


      /*
        ドラッグ開始直後から
        仮枠を表示
      */

      drawPreview =
        document.createElement(
          "div"
        );


      drawPreview.className =
        "drag-preview";


      layer.appendChild(
        drawPreview
      );


      updateDrawPreview(
        event
      );

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
        event.pointerId !==
        drawingPointerId
      ) {

        return;

      }


      cancelDrawing();

    }
  );

}


/* =======================================================
   DRAW PREVIEW
======================================================= */

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


  const x =
    Math.min(
      drawStart.x,
      current.x
    );


  const y =
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
    `${x}px`;


  drawPreview.style.top =
    `${y}px`;


  drawPreview.style.width =
    `${width}px`;


  drawPreview.style.height =
    `${height}px`;

}
/* =======================================================
   FINISH DRAWING
======================================================= */

async function finishDrawing(
  event
) {

  /*
    finishDrawing() の中で
    drawPage / drawLayer を消す前に
   ローカルへ退避する。
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
    先に描画状態を解除。
    必要な値は上で退避済み。
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


/* =======================================================
   CANCEL DRAWING
======================================================= */

function cancelDrawing() {

  drawing =
    false;


  drawingPointerId =
    null;


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


/* =======================================================
   AUTO DETECTION
======================================================= */

async function detectAllPages() {

  if (!pages.length) {

    setStatus(
      "先に解答用紙を登録してください。",
      true
    );

    return;

  }


  candidates =
    [];


  setStatus(
    "解答用紙の枠を自動検出しています..."
  );


  try {

    for (
      const page
      of pages
    ) {

      const detected =
        await detectPageCandidates(
          page
        );


      candidates.push(
        ...detected
      );

    }


    await renderAllPages();


    if (
      candidates.length
    ) {

      setStatus(
        `自動検出 ${candidates.length}個。赤い点線の候補をクリックしてください。`
      );

    } else {

      setStatus(
        "自動検出できる枠がありません。手動ドラッグで設定できます。"
      );

    }


  } catch (error) {

    console.error(
      "detectAllPages:",
      error
    );


    setStatus(
      error.message ||
      "枠の自動検出に失敗しました。",
      true
    );

  }

}


/* =======================================================
   PAGE DETECTION
======================================================= */

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

    throw new Error(
      `ページ${page.page_no}の画像を取得できません。`
    );

  }


  const image =
    await loadImage(
      data.signedUrl
    );


  /*
    検出用画像は大きすぎると
    ブラウザ負荷が高くなるため縮小。
  */

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
    Math.max(
      1,
      Math.round(
        image.naturalWidth *
        scale
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        image.naturalHeight *
        scale
      )
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
    OpenCV.js が読み込まれている場合
    輪郭検出を使用。
  */

  if (
    window.cv &&
    typeof window.cv.Mat ===
      "function"
  ) {

    return detectWithOpenCV(
      canvas,
      page,
      scale
    );

  }


  /*
    OpenCVが使えない場合は
    簡易検出。
  */

  return detectWithProjection(
    canvas,
    page,
    scale
  );

}


/* =======================================================
   OPENCV DETECTION
======================================================= */

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


  const binary =
    new cv.Mat();


  const contours =
    new cv.MatVector();


  const hierarchy =
    new cv.Mat();


  const result =
    [];


  try {

    cv.cvtColor(
      src,
      gray,
      cv.COLOR_RGBA2GRAY
    );


    cv.threshold(
      gray,
      binary,
      200,
      255,
      cv.THRESH_BINARY_INV
    );


    cv.findContours(
      binary,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );


    const imageArea =
      canvas.width *
      canvas.height;


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


      const approximation =
        new cv.Mat();


      try {

        cv.approxPolyDP(
          contour,
          approximation,
          perimeter *
            0.02,
          true
        );


        const rect =
          cv.boundingRect(
            contour
          );


        const area =
          rect.width *
          rect.height;


        const ratio =
          rect.width /
          Math.max(
            1,
            rect.height
          );


        /*
          極端に小さいもの、
          ページ全体、
          細長すぎるものを除外。
        */

        if (
          approximation.rows <
            4 ||
          approximation.rows >
            6
        ) {

          continue;

        }


        if (
          area <
          imageArea *
          0.00015
        ) {

          continue;

        }


        if (
          area >
          imageArea *
          0.40
        ) {

          continue;

        }


        if (
          ratio <
          0.12 ||
          ratio >
          8
        ) {

          continue;

        }


        const candidate = {

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

        };


        /*
          同じ枠の輪郭が
          複数検出されるので重複除去。
        */

        const duplicate =
          result.some(
            existing =>
              overlapRatio(
                candidate,
                existing
              ) >
              0.75
          );


        if (
          !duplicate
        ) {

          result.push(
            candidate
          );

        }

      } finally {

        approximation.delete();

      }


      contour.delete();

    }


    return result
      .sort(
        (
          a,
          b
        ) =>
          a.pageNo -
          b.pageNo ||
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

    binary.delete();

    contours.delete();

    hierarchy.delete();

  }

}


/* =======================================================
   SIMPLE DETECTION
======================================================= */

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


  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );


  const rowCount =
    new Uint32Array(
      canvas.height
    );


  const columnCount =
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


      const brightness =
        (
          imageData.data[index] +
          imageData.data[index + 1] +
          imageData.data[index + 2]
        ) /
        3;


      if (
        brightness <
        145
      ) {

        rowCount[y]++;

        columnCount[x]++;

      }

    }

  }


  const horizontal =
    findProjectionRuns(
      rowCount,
      canvas.width *
      0.15
    );


  const vertical =
    findProjectionRuns(
      columnCount,
      canvas.height *
      0.15
    );


  const result =
    [];


  /*
    横線と縦線の交点から
    矩形候補を作る。
  */

  for (
    let yi = 0;
    yi <
    horizontal.length;
    yi++
  ) {

    for (
      let yj = yi + 1;
      yj <
      Math.min(
        horizontal.length,
        yi + 10
      );
      yj++
    ) {

      const top =
        horizontal[yi];


      const bottom =
        horizontal[yj];


      const height =
        bottom -
        top;


      if (
        height <
        20
      ) {

        continue;

      }


      if (
        height >
        canvas.height *
        0.4
      ) {

        continue;

      }


      for (
        let xi = 0;
        xi <
        vertical.length;
        xi++
      ) {

        for (
          let xj = xi + 1;
          xj <
          Math.min(
            vertical.length,
            xi + 10
          );
          xj++
        ) {

          const left =
            vertical[xi];


          const right =
            vertical[xj];


          const width =
            right -
            left;


          if (
            width <
            30
          ) {

            continue;

          }


          if (
            width >
            canvas.width *
            0.8
          ) {

            continue;

          }


          const candidate = {

            id:
              crypto.randomUUID(),

            pageNo:
              Number(
                page.page_no
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
              scale

          };


          result.push(
            candidate
          );

        }

      }

    }

  }


  return deduplicateCandidates(
    result
  )
    .sort(
      (
        a,
        b
      ) =>
        a.pageNo -
        b.pageNo ||
        a.y -
        b.y ||
        a.x -
        b.x
    )
    .slice(
      0,
      200
    );

}


/* =======================================================
   PROJECTION RUNS
======================================================= */

function findProjectionRuns(
  values,
  threshold
) {

  const result =
    [];


  let start =
    -1;


  for (
    let index = 0;
    index <
    values.length;
    index++
  ) {

    if (
      values[index] >=
      threshold
    ) {

      if (
        start <
        0
      ) {

        start =
          index;

      }

      continue;

    }


    if (
      start >=
      0
    ) {

      if (
        index -
        start >=
        2
      ) {

        result.push(
          Math.round(
            (
              start +
              index
            ) /
            2
          )
        );

      }


      start =
        -1;

    }

  }


  if (
    start >=
    0
  ) {

    result.push(
      Math.round(
        (
          start +
          values.length
        ) /
        2
      )
    );

  }


  return result;

}


/* =======================================================
   CANDIDATE RENDER
======================================================= */

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
    "クリックして枠として登録";


  element.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();

      event.stopPropagation();


      acceptCandidate(
        candidate
      );

    }
  );


  layer.appendChild(
    element
  );

}


/* =======================================================
   ACCEPT CANDIDATE
======================================================= */

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
      Number(
        candidate.pageNo
      ),

    box_type:
      info.boxType,

    label:
      info.label,

    x:
      Number(
        candidate.x
      ),

    y:
      Number(
        candidate.y
      ),

    width:
      Number(
        candidate.width
      ),

    height:
      Number(
        candidate.height
      ),

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
  function applySelectedBox() {

    const box =
      getSelectedBox();


    if (!box) {

      setStatus(
        "選択されている枠がありません。"
      );

      return;

    }


    const role =
      boxRole?.value ||
      "other";


    const roleInfo =
      ROLE_INFO[
        role
      ] ||
      ROLE_INFO.other;


    box.box_role =
      role;


    box.box_type =
      roleInfo.boxType;


    box.label =
      automaticLabel(
        role,
        box
      );


    if (
      roleInfo.boxType ===
      "answer"
    ) {

      if (
        box.points ===
        null ||
        box.points ===
        undefined
      ) {

        box.points =
          0;

      }

    } else {

      box.points =
        null;

    }


    if (
      role ===
        "minor" ||
      role ===
        "subtotal"
    ) {

      updateParent(
        box
      );

    }


    if (
      role ===
      "major"
    ) {

      box.parent_box_id =
        null;

      box.minor_no =
        null;

      box.subtotal_group =
        null;

    }


    if (
      role ===
        "total" ||
      role ===
        "qr" ||
      role ===
        "name" ||
      role ===
        "student_no" ||
      role ===
        "instruction" ||
      role ===
        "other"
    ) {

      box.parent_box_id =
        null;

      box.minor_no =
        null;

      box.subtotal_group =
        null;

    }


    renumberAll();


    renderAllPages();


    setStatus(
      `${box.label}として設定しました。`
    );

  }


  /* =======================================================
     DELETE SELECTED
  ======================================================= */

  function deleteSelectedBox() {

    if (!selectedBoxId) {

      setStatus(
        "削除する枠を選択してください。"
      );

      return;

    }


    const targetId =
      selectedBoxId;


    boxes =
      boxes.filter(
        box =>
          box.id !==
          targetId
      );


    /*
      削除した大問に所属していた
      小問・小計の親を解除。
    */

    boxes.forEach(
      box => {

        if (
          box.parent_box_id ===
          targetId
        ) {

          box.parent_box_id =
            null;

          box.minor_no =
            null;

          box.subtotal_group =
            null;

        }

      }
    );


    selectedBoxId =
      null;


    renumberAll();


    renderAllPages();


    setStatus(
      "選択した枠を削除しました。保存するとDBにも反映されます。"
    );

  }


  /* =======================================================
     ROLE HELP
  ======================================================= */

  function updateRoleHelp() {

    if (!parentInfo) {

      return;

    }


    const selected =
      getSelectedBox();


    const role =
      selected?.box_role ||
      boxRole?.value ||
      "answer";


    const info =
      ROLE_INFO[
        role
      ] ||
      ROLE_INFO.answer;


    switch (
      role
    ) {

      case "major":

        parentInfo.textContent =
          "大問の範囲を作成します。";

        break;


      case "minor":

        parentInfo.textContent =
          "小問の範囲を作成します。大問の内側なら自動的にその大問へ所属します。";

        break;


      case "subtotal":

        parentInfo.textContent =
          "小計範囲を作成します。大問の内側ならその大問へ所属します。";

        break;


      case "total":

        parentInfo.textContent =
          "テスト全体の合計範囲です。";

        break;


      case "qr":

        parentInfo.textContent =
          "QR読み取り範囲です。答案アップロード時はこの範囲だけをQR解析します。";

        break;


      case "name":

        parentInfo.textContent =
          "氏名欄の範囲です。";

        break;


      case "student_no":

        parentInfo.textContent =
          "生徒番号欄の範囲です。";

        break;


      case "instruction":

        parentInfo.textContent =
          "説明・指示の範囲です。";

        break;


      default:

        parentInfo.textContent =
          `${info.label}の範囲を作成します。`;

        break;

    }

  }


  /* =======================================================
     PARENT
  ======================================================= */

  function updateParent(
    box
  ) {

    if (
      !box ||
      (
        box.box_role !==
          "minor" &&
        box.box_role !==
          "subtotal"
      )
    ) {

      return;

    }


    const majors =
      boxes
        .filter(
          candidate =>
            candidate.box_role ===
            "major" &&
            Number(
              candidate.page_no
            ) ===
            Number(
              box.page_no
            )
        )
        .sort(
          compareBoxes
        );


    const parent =
      majors.find(
        major =>
          isInside(
            box,
            major
          )
      );


    if (parent) {

      box.parent_box_id =
        parent.id;

      box.major_no =
        parent.major_no;

    } else {

      box.parent_box_id =
        null;

      box.major_no =
        null;

    }


    if (
      box.box_role ===
      "subtotal"
    ) {

      box.subtotal_group =
        parent
          ? parent.id
          : null;

    }

  }


  function findContainingMajor(
    box
  ) {

    if (!box) {

      return null;

    }


    return (
      boxes
        .filter(
          candidate =>
            candidate.box_role ===
            "major" &&
            Number(
              candidate.page_no
            ) ===
            Number(
              box.page_no
            )
        )
        .sort(
          compareBoxes
        )
        .find(
          major =>
            isInside(
              box,
              major
            )
        ) ||
      null
    );

  }


  function isInside(
    child,
    parent
  ) {

    const childLeft =
      Number(
        child.x
      );


    const childTop =
      Number(
        child.y
      );


    const childRight =
      childLeft +
      Number(
        child.width
      );


    const childBottom =
      childTop +
      Number(
        child.height
      );


    const parentLeft =
      Number(
        parent.x
      );


    const parentTop =
      Number(
        parent.y
      );


    const parentRight =
      parentLeft +
      Number(
        parent.width
      );


    const parentBottom =
      parentTop +
      Number(
        parent.height
      );


    return (
      childLeft >=
        parentLeft &&
      childTop >=
        parentTop &&
      childRight <=
        parentRight &&
      childBottom <=
        parentBottom
    );

  }


  /* =======================================================
     NUMBERING
  ======================================================= */

  function renumberAll() {

    const majors =
      boxes
        .filter(
          box =>
            box.box_role ===
            "major"
        )
        .sort(
          compareBoxes
        );


    majors.forEach(
      (
        major,
        index
      ) => {

        major.major_no =
          index + 1;

      }
    );


    majors.forEach(
      major => {

        const children =
          boxes
            .filter(
              box =>
                box.box_role ===
                  "minor" &&
                box.parent_box_id ===
                  major.id
            )
            .sort(
              compareBoxes
            );


        children.forEach(
          (
            child,
            index
          ) => {

            child.minor_no =
              index + 1;

            child.major_no =
              major.major_no;

          }
        );

      }
    );


    boxes
      .filter(
        box =>
          box.box_role ===
          "subtotal"
      )
      .forEach(
        box => {

          const parent =
            findContainingMajor(
              box
            );


          if (parent) {

            box.major_no =
              parent.major_no;

            box.subtotal_group =
              parent.id;

          }

        }
      );

  }


  /* =======================================================
     LABEL
  ======================================================= */

  function automaticLabel(
    role,
    box
  ) {

    switch (
      role
    ) {

      case "major":

        return `大問${box.major_no || ""}`;


      case "minor":

        if (
          box.major_no &&
          box.minor_no
        ) {

          return `${box.major_no}-${box.minor_no}`;

        }


        return "小問";


      case "subtotal":

        return box.major_no
          ? `大問${box.major_no} 小計`
          : "小計";


      case "total":

        return "合計";


      case "qr":

        return "QR";


      case "name":

        return "氏名";


      case "student_no":

        return "生徒番号";


      case "instruction":

        return "説明";


      default:

        return "その他";

    }

  }


  function updateAllLabels() {

    document
      .querySelectorAll(
        ".layout-box"
      )
      .forEach(
        element => {

          const id =
            element.dataset.boxId;


          const box =
            boxes.find(
              item =>
                item.id ===
                id
            );


          if (!box) {

            return;

          }


          const label =
            element.querySelector(
              ".layout-box-label"
            );


          if (label) {

            label.textContent =
              automaticLabel(
                box.box_role,
                box
              );

          }


          applyRoleStyle(
            element,
            box.box_role
          );

        }
      );

  }


  /* =======================================================
     PANEL
  ======================================================= */

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


    /*
      ツール自体は消さない。
      次に選択すると再表示できる。
    */

  }


  /* =======================================================
     SAVE
  ======================================================= */

  async function saveBoxes() {

    if (!selectedTestId) {

      setStatus(
        "テストIDがありません。",
        true
      );

      return;

    }


    try {

      saveButton.disabled =
        true;


      setStatus(
        "枠設定を保存しています..."
      );


      rebuildHierarchy();


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


      /*
        DBにあって画面から削除された枠を削除。
      */

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


      /*
        現在の枠を保存。
      */

      for (
        let index = 0;
        index <
        boxes.length;
        index++
      ) {

        const box =
          boxes[index];


        const role =
          ROLE_INFO[
            box.box_role
          ] ||
          ROLE_INFO.other;


        const payload = {

          test_id:
            selectedTestId,

          page_no:
            Number(
              box.page_no
            ) || 1,

          box_type:
            role.boxType,

          label:
            automaticLabel(
              box.box_role,
              box
            ),

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
            role.boxType ===
              "answer"
              ? Number(
                  box.points
                ) || 0
              : null,

          sort_order:
            index

        };


        /*
          既存UUID
        */

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
              .select(
                "id"
              )
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


  /* =======================================================
     KEYBOARD
  ======================================================= */

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


      return;

    }


    if (
      event.key ===
      "Delete"
    ) {

      if (
        selectedBoxId
      ) {

        event.preventDefault();


        deleteSelectedBox();

      }

    }

  }


  /* =======================================================
     BACK
  ======================================================= */

  function goBack() {

    if (
      selectedTestId
    ) {

      window.location.href =
        `/teacher/tests/edit?id=${encodeURIComponent(
          selectedTestId
        )}`;

      return;

    }


    window.location.href =
      "/teacher/tests";

  }


  /* =======================================================
     IMAGE
  ======================================================= */

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


  /* =======================================================
     GEOMETRY
  ======================================================= */

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

    const pageWidth =
      Number(
        page.width_px
      );


    if (
      !pageWidth
    ) {

      return 1;

    }


    const canvas =
      layer.parentElement
        ?.querySelector(
          "canvas"
        );


    if (!canvas) {

      return 1;

    }


    const rect =
      canvas.getBoundingClientRect();


    if (
      !rect.width
    ) {

      return 1;

    }


    return (
      canvas.width /
      rect.width
    );

  }


  /* =======================================================
     UTIL
  ======================================================= */

  function compareBoxes(
    a,
    b
  ) {

    const pageDiff =
      Number(
        a.page_no
      ) -
      Number(
        b.page_no
      );


    if (
      pageDiff !==
      0
    ) {

      return pageDiff;

    }


    const yDiff =
      Number(
        a.y
      ) -
      Number(
        b.y
      );


    if (
      yDiff !==
      0
    ) {

      return yDiff;

    }


    return (
      Number(
        a.x
      ) -
      Number(
        b.x
      )
    );

  }


  function inferRole(
    box
  ) {

    switch (
      box.box_type
    ) {

      case "qr":
        return "qr";

      case "name":
        return "name";

      case "student_no":
        return "student_no";

      case "answer":
        return "answer";

      default:
        return "other";

    }

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
    message
  ) {

    if (!statusElement) {

      return;

    }


    statusElement.textContent =
      message;

  }


  function showError(
    message
  ) {

    setStatus(
      message
    );

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();
          throw new Error(
            `box_type「${roleInfo.boxType}」はDB制約で使用できません。`
          );

        }


        /*
          親枠が指定されている場合
        */

        if (
          box.parent_box_id
        ) {

          const parent =
            boxes.find(
              candidate =>
                candidate.id ===
                box.parent_box_id
            );


          if (!parent) {

            throw new Error(
              "親大問が存在しません。"
            );

          }


          if (
            parent.box_role !==
            "major"
          ) {

            throw new Error(
              "親枠は大問でなければなりません。"
            );

          }


          if (
            Number(
              parent.page_no
            ) !==
            Number(
              box.page_no
            )
          ) {

            throw new Error(
              "親大問と子枠のページが違います。"
            );

          }

        }


        /*
          QRは独立
        */

        if (
          box.box_role ===
          "qr" &&
          box.parent_box_id
        ) {

          throw new Error(
            "QR枠は大問に所属できません。"
          );

        }


        /*
          合計は独立
        */

        if (
          box.box_role ===
          "total" &&
          box.parent_box_id
        ) {

          throw new Error(
            "合計枠は大問に所属できません。"
          );

        }

      }
    );

  }


  /* =======================================================
     BOX STYLE
  ======================================================= */

  function applyRoleStyle(
    element,
    role
  ) {

    if (!element) {

      return;

    }


    element.style.border =
      "";


    element.style.background =
      "";


    switch (
      role
    ) {

      case "major":

        element.style.border =
          "3px solid #2468a8";

        element.style.background =
          "rgba(36,104,168,.07)";

        break;


      case "minor":

        element.style.border =
          "2px solid #d00000";

        element.style.background =
          "rgba(208,0,0,.06)";

        break;


      case "qr":

        element.style.border =
          "3px dashed #333";

        element.style.background =
          "rgba(0,0,0,.06)";

        break;


      case "subtotal":

        element.style.border =
          "2px dashed #555";

        element.style.background =
          "rgba(0,0,0,.04)";

        break;


      case "total":

        element.style.border =
          "3px double #333";

        element.style.background =
          "rgba(0,0,0,.05)";

        break;


      case "name":

        element.style.border =
          "2px solid #26734d";

        element.style.background =
          "rgba(38,115,77,.06)";

        break;


      case "student_no":

        element.style.border =
          "2px solid #26734d";

        element.style.background =
          "rgba(38,115,77,.06)";

        break;


      default:

        element.style.border =
          "2px solid #666";

        element.style.background =
          "rgba(0,0,0,.03)";

        break;

    }


    if (
      selectedBoxId ===
      element.dataset.boxId
    ) {

      element.style.outline =
        "3px solid #111";

      element.style.outlineOffset =
        "1px";

    } else {

      element.style.outline =
        "";

      element.style.outlineOffset =
        "";

    }

  }


  /* =======================================================
     PANEL
  ======================================================= */

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


    /*
      「閉じる」は選択解除だけ。
      ツール自体は消さない。
    */

    selectedBoxId =
      null;


    document
      .querySelectorAll(
        ".layout-box"
      )
      .forEach(
        element => {

          applyRoleStyle(
            element,
            getBoxRoleFromElement(
              element
            )
          );

        }
      );

  }


  function getBoxRoleFromElement(
    element
  ) {

    const box =
      boxes.find(
        item =>
          item.id ===
          element.dataset.boxId
      );


    return (
      box?.box_role ||
      "other"
    );

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

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


      dragPointerId =
        null;


      dragBoxId =
        null;


      selectedBoxId =
        null;


      renderAllPages();

      return;

    }


    if (
      event.key ===
      "Delete"
    ) {

      if (
        selectedBoxId
      ) {

        event.preventDefault();

        deleteSelectedBox();

      }

    }

  }


  /* =======================================================
     BACK
  ======================================================= */

  function goBack() {

    if (
      selectedTestId
    ) {

      window.location.href =
        `/teacher/tests/edit?id=${encodeURIComponent(
          selectedTestId
        )}`;

      return;

    }


    window.location.href =
      "/teacher/tests";

  }


  /* =======================================================
     IMAGE
  ======================================================= */

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


  /* =======================================================
     GEOMETRY
  ======================================================= */

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


  function getCenter(
    box
  ) {

    return {

      x:
        Number(
          box.x
        ) +
        Number(
          box.width
        ) /
        2,

      y:
        Number(
          box.y
        ) +
        Number(
          box.height
        ) /
        2

    };

  }


  function pointInside(
    point,
    box
  ) {

    return (

      point.x >=
      Number(
        box.x
      ) &&

      point.y >=
      Number(
        box.y
      ) &&

      point.x <=
      Number(
        box.x
      ) +
      Number(
        box.width
      ) &&

      point.y <=
      Number(
        box.y
      ) +
      Number(
        box.height
      )

    );

  }


  function getPageScale(
    layer,
    page
  ) {

    const canvas =
      layer
        ?.parentElement
        ?.querySelector(
          "canvas"
        );


    if (!canvas) {

      return 1;

    }


    const rect =
      canvas.getBoundingClientRect();


    if (
      !rect.width
    ) {

      return 1;

    }


    return (
      canvas.width /
      rect.width
    );

  }


  /* =======================================================
     UTIL
  ======================================================= */

  function compareBoxes(
    a,
    b
  ) {

    const page =
      Number(
        a.page_no
      ) -
      Number(
        b.page_no
      );


    if (
      page !==
      0
    ) {

      return page;

    }


    const y =
      Number(
        a.y
      ) -
      Number(
        b.y
      );


    if (
      y !==
      0
    ) {

      return y;

    }


    return (
      Number(
        a.x
      ) -
      Number(
        b.x
      )
    );

  }


  function inferRole(
    box
  ) {

    switch (
      box.box_type
    ) {

      case "qr":

        return "qr";


      case "name":

        return "name";


      case "student_no":

        return "student_no";


      case "answer":

        return "answer";


      default:

        return "other";

    }

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
    message
  ) {

    if (
      statusElement
    ) {

      statusElement.textContent =
        message;

    }

  }


  function showError(
    message
  ) {

    setStatus(
      message
    );

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
      `${(
        width /
        pageWidth
      ) * 100}%`;


    element.style.height =
      `${(
        height /
        pageHeight
      ) * 100}%`;

  }


  /* =======================================================
     ROLE STYLE
  ======================================================= */

  function applyRoleStyle(
    element,
    role
  ) {

    element.style.border =
      "";


    element.style.background =
      "";


    switch (
      role
    ) {

      case "major":

        element.style.border =
          "3px solid #2468a8";

        element.style.background =
          "rgba(36,104,168,.07)";

        break;


      case "minor":

        element.style.border =
          "2px solid #d00000";

        element.style.background =
          "rgba(208,0,0,.06)";

        break;


      case "qr":

        element.style.border =
          "3px dashed #333";

        element.style.background =
          "rgba(0,0,0,.06)";

        break;


      case "subtotal":

        element.style.border =
          "2px dashed #555";

        element.style.background =
          "rgba(0,0,0,.04)";

        break;


      case "total":

        element.style.border =
          "3px double #333";

        element.style.background =
          "rgba(0,0,0,.05)";

        break;


      default:

        element.style.border =
          "2px solid #666";

        element.style.background =
          "rgba(0,0,0,.03)";

        break;

    }

  }


  /* =======================================================
     BOX INTERACTION
  ======================================================= */

  function setupBoxInteraction(
    element,
    resizeHandle,
    page,
    box
  ) {

    element.addEventListener(
      "pointerdown",
      event => {

        event.preventDefault();

        event.stopPropagation();


        selectBox(
          box.id
        );


        dragMode =
          event.target ===
          resizeHandle
            ? "resize"
            : "move";


        dragPointerId =
          event.pointerId;


        dragBoxId =
          box.id;


        const canvas =
          element.parentElement
            ?.parentElement
            ?.querySelector(
              "canvas"
            );


        if (!canvas) {

          return;

        }


        const rect =
          canvas.getBoundingClientRect();


        dragStart = {

          x:
            event.clientX,

          y:
            event.clientY,

          scaleX:
            canvas.width /
            rect.width,

          scaleY:
            canvas.height /
            rect.height

        };


        dragOriginal = {

          x:
            Number(
              box.x
            ),

          y:
            Number(
              box.y
            ),

          width:
            Number(
              box.width
            ),

          height:
            Number(
              box.height
            )

        };


        try {

          element.setPointerCapture(
            event.pointerId
          );

        } catch (_) {}

      }
    );


    element.addEventListener(
      "pointermove",
      event => {

        if (
          dragBoxId !==
            box.id ||
          dragPointerId !==
            event.pointerId ||
          !dragStart ||
          !dragOriginal
        ) {

          return;

        }


        event.preventDefault();


        const dx =
          (
            event.clientX -
            dragStart.x
          ) *
          dragStart.scaleX;


        const dy =
          (
            event.clientY -
            dragStart.y
          ) *
          dragStart.scaleY;


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

        }


        if (
          dragMode ===
          "resize"
        ) {

          box.width =
            Math.max(
              8,
              dragOriginal.width +
              dx
            );


          box.height =
            Math.max(
              8,
              dragOriginal.height +
              dy
            );

        }


        if (
          box.box_role ===
            "minor" ||
          box.box_role ===
            "subtotal"
        ) {

          updateParent(
            box
          );

        }


        updateBoxElement(
          element,
          page,
          box
        );


        updateAllLabels();

      }
    );


    element.addEventListener(
      "pointerup",
      event => {

        if (
          event.pointerId !==
          dragPointerId
        ) {

          return;

        }


        finishBoxDrag(
          box
        );

      }
    );


    element.addEventListener(
      "pointercancel",
      event => {

        if (
          event.pointerId !==
          dragPointerId
        ) {

          return;

        }


        finishBoxDrag(
          box
        );

      }
    );

  }


  /* =======================================================
     FINISH BOX DRAG
  ======================================================= */

  function finishBoxDrag(
    box
  ) {

    if (
      box.box_role ===
        "minor" ||
      box.box_role ===
        "subtotal"
    ) {

      updateParent(
        box
      );

    }


    renumberAll();


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


    updateAllLabels();

    updateRoleHelp();

  }


  /* =======================================================
     SELECT
  ======================================================= */

  function selectBox(
    boxId
  ) {

    selectedBoxId =
      boxId;


    document
      .querySelectorAll(
        ".layout-box"
      )
      .forEach(
        element => {

          const box =
            boxes.find(
              item =>
                item.id ===
                element.dataset.boxId
            );


          applyRoleStyle(
            element,
            box?.box_role ||
            "other"
          );


          element.classList.toggle(
            "selected",
            element.dataset.boxId ===
            boxId
          );

        }
      );


    openBoxPanel();


    const box =
      getSelectedBox();


    if (
      boxRole &&
      box
    ) {

      boxRole.value =
        box.box_role;

    }


    updateRoleHelp();

  }


  /* =======================================================
     APPLY SELECTED
  ======================================================= */

  function applySelectedBox() {

    const box =
      getSelectedBox();


    if (!box) {

      setStatus(
        "選択されている枠がありません。"
      );

      return;

    }


    const role =
      boxRole?.value ||
      box.box_role ||
      "other";


    const roleInfo =
      ROLE_INFO[
        role
      ];


    if (!roleInfo) {

      return;

    }


    box.box_role =
      role;


    box.box_type =
      roleInfo.boxType;


    box.points =
      roleInfo.boxType ===
        "answer"
        ? 0
        : null;


    box.question_id =
      null;


    if (
      role ===
      "major"
    ) {

      clearParent(
        box
      );

    }

    else if (
      role ===
        "minor" ||
      role ===
        "subtotal"
    ) {

      updateParent(
        box
      );

    }

    else {

      clearParent(
        box
      );

    }


    renumberAll();


    updateAllLabels();


    renderAllPages();


    updateRoleHelp();


    setStatus(
      `${automaticLabel(
        role,
        box
      )}として設定しました。`
    );

  }


  /* =======================================================
     DELETE
  ======================================================= */

  function deleteSelectedBox() {

    if (!selectedBoxId) {

      return;

    }


    const targetId =
      selectedBoxId;


    boxes
      .filter(
        box =>
          box.parent_box_id ===
          targetId
      )
      .forEach(
        child => {

          clearParent(
            child
          );

        }
      );


    boxes =
      boxes.filter(
        box =>
          box.id !==
          targetId
      );


    selectedBoxId =
      null;


    renumberAll();


    renderAllPages();


    setStatus(
      "選択した枠を削除しました。保存するとDBにも反映されます。"
    );

  }


  /* =======================================================
     CLEAR PARENT
  ======================================================= */

  function clearParent(
    box
  ) {

    box.parent_box_id =
      null;


    box.major_no =
      null;


    box.minor_no =
      null;


    box.subtotal_group =
      null;

  }


  /* =======================================================
     UPDATE PARENT
  ======================================================= */

  function updateParent(
    box
  ) {

    const parent =
      findContainingMajor(
        box
      );


    if (!parent) {

      clearParent(
        box
      );

      return;

    }


    box.parent_box_id =
      parent.id;


    box.major_no =
      parent.major_no;


    if (
      box.box_role ===
      "minor"
    ) {

      box.minor_no =
        null;

      box.subtotal_group =
        null;

    }


    if (
      box.box_role ===
      "subtotal"
    ) {

      box.minor_no =
        null;

      box.subtotal_group =
        parent.major_no;

    }

  }


  /* =======================================================
     FIND PARENT
  ======================================================= */

  function findContainingMajor(
    box
  ) {

    const center =
      getCenter(
        box
      );


    const candidates =
      boxes
        .filter(
          candidate =>

            candidate.id !==
            box.id &&

            candidate.box_role ===
            "major" &&

            Number(
              candidate.page_no
            ) ===
            Number(
              box.page_no
            ) &&

            pointInside(
              center,
              candidate
            )
        );


    if (
      !candidates.length
    ) {

      return null;

    }


    candidates.sort(
      (
        a,
        b
      ) => {

        const areaA =
          Number(a.width) *
          Number(a.height);


        const areaB =
          Number(b.width) *
          Number(b.height);


        return areaA -
          areaB;

      }
    );


    return candidates[0];

  }


  /* =======================================================
     RENUMBER
  ======================================================= */

  function renumberAll() {

    const majors =
      boxes
        .filter(
          box =>
            box.box_role ===
            "major"
        )
        .sort(
          compareBoxes
        );


    majors.forEach(
      (
        major,
        index
      ) => {

        major.major_no =
          index + 1;

        major.parent_box_id =
          null;

        major.minor_no =
          null;

        major.subtotal_group =
          null;

      }
    );


    majors.forEach(
      major => {

        const children =
          boxes
            .filter(
              box =>
                box.box_role ===
                  "minor" &&
                box.parent_box_id ===
                  major.id
            )
            .sort(
              compareBoxes
            );


        children.forEach(
          (
            child,
            index
          ) => {

            child.major_no =
              major.major_no;

            child.minor_no =
              index + 1;

          }
        );

      }
    );


    boxes
      .filter(
        box =>
          box.box_role ===
          "minor" &&
          !box.parent_box_id
      )
      .forEach(
        box => {

          box.major_no =
            null;

          box.minor_no =
            null;

        }
      );


    boxes
      .filter(
        box =>
          box.box_role ===
          "subtotal"
      )
      .forEach(
        subtotal => {

          const parent =
            findContainingMajor(
              subtotal
            );


          if (parent) {

            subtotal.parent_box_id =
              parent.id;

            subtotal.major_no =
              parent.major_no;

            subtotal.subtotal_group =
              parent.major_no;

          }

          else {

            clearParent(
              subtotal
            );

          }

        }
      );


    boxes
      .filter(
        box =>
          [
            "total",
            "qr",
            "name",
            "student_no",
            "instruction",
            "other"
          ].includes(
            box.box_role
          )
      )
      .forEach(
        box => {

          clearParent(
            box
          );

        }
      );

  }


  /* =======================================================
     LABEL
  ======================================================= */

  function automaticLabel(
    role,
    box
  ) {

    switch (
      role
    ) {

      case "major":

        return `大問${
          box?.major_no ||
          "?"
        }`;


      case "minor":

        return box?.major_no &&
          box?.minor_no
          ? `問${box.major_no}-${box.minor_no}`
          : "小問";


      case "qr":

        return "QR";


      case "subtotal":

        return box?.major_no
          ? `大問${box.major_no} 小計`
          : "小計";


      case "total":

        return "合計";


      case "name":

        return "氏名";


      case "student_no":

        return "生徒番号";


      case "instruction":

        return "説明";


      default:

        return "その他";

    }

  }


  /* =======================================================
     UPDATE LABELS
  ======================================================= */

  function updateAllLabels() {

    document
      .querySelectorAll(
        ".layout-box"
      )
      .forEach(
        element => {

          const box =
            boxes.find(
              item =>
                item.id ===
                element.dataset.boxId
            );


          if (!box) {

            return;

          }


          const label =
            element.querySelector(
              ".layout-box-label"
            );


          if (label) {

            label.textContent =
              automaticLabel(
                box.box_role,
                box
              );

          }


          applyRoleStyle(
            element,
            box.box_role
          );


          element.classList.toggle(
            "selected",
            selectedBoxId ===
            box.id
          );

        }
      );

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

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


      dragPointerId =
        null;


      dragBoxId =
        null;


      selectedBoxId =
        null;


      renderAllPages();


      return;

    }


    if (
      event.key ===
      "Delete"
    ) {

      if (
        selectedBoxId
      ) {

        event.preventDefault();


        deleteSelectedBox();

      }

    }

  }


  /* =======================================================
     PANEL
  ======================================================= */

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

    /*
      ツール自体は消さない。
      「閉じる」は選択解除。
    */

    selectedBoxId =
      null;


    updateAllLabels();

  }


  /* =======================================================
     BACK
  ======================================================= */

  function goBack() {

    if (
      selectedTestId
    ) {

      window.location.href =
        `/teacher/tests/edit?id=${encodeURIComponent(
          selectedTestId
        )}`;

      return;

    }


    window.location.href =
      "/teacher/tests";

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function setStatus(
    message
  ) {

    if (
      statusElement
    ) {

      statusElement.textContent =
        message;

    }

  }


  function showError(
    message
  ) {

    setStatus(
      message
    );

  }


  /* =======================================================
     GEOMETRY
  ======================================================= */

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


  function getCenter(
    box
  ) {

    return {

      x:
        Number(
          box.x
        ) +
        Number(
          box.width
        ) /
        2,

      y:
        Number(
          box.y
        ) +
        Number(
          box.height
        ) /
        2

    };

  }


  function pointInside(
    point,
    box
  ) {

    return (

      point.x >=
      Number(
        box.x
      ) &&

      point.y >=
      Number(
        box.y
      ) &&

      point.x <=
      Number(
        box.x
      ) +
      Number(
        box.width
      ) &&

      point.y <=
      Number(
        box.y
      ) +
      Number(
        box.height
      )

    );

  }


  function clamp(
    value,
    min,
    max
  ) {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );

  }


  /* =======================================================
     UTIL
  ======================================================= */

  function compareBoxes(
    a,
    b
  ) {

    const pageDiff =
      Number(
        a.page_no
      ) -
      Number(
        b.page_no
      );


    if (
      pageDiff !==
      0
    ) {

      return pageDiff;

    }


    const yDiff =
      Number(
        a.y
      ) -
      Number(
        b.y
      );


    if (
      yDiff !==
      0
    ) {

      return yDiff;

    }


    return (
      Number(
        a.x
      ) -
      Number(
        b.x
      )
    );

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
        showError(
          "解答用紙を選択してください。"
        );

        return;

    }


    const extension =
      getExtension(
        file.name
      );


    if (
      ![
        "pdf",
        "jpg",
        "jpeg",
        "png",
        "webp"
      ].includes(
        extension
      )
    ) {

      showError(
        "PDF、JPG、JPEG、PNG、WEBPのみ対応しています。"
      );

      return;

    }


    try {

      uploadButton.disabled =
        true;


      setStatus(
        "解答用紙を読み込んでいます..."
      );


      const pageImages =
        await fileToPages(
          file
        );


      if (
        !pageImages.length
      ) {

        throw new Error(
          "解答用紙のページを作成できませんでした。"
        );

      }


      /*
       * 既存ページ番号の続きから登録。
       */

      const nextPageNo =
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


      const uploaded =
        [];


      for (
        let index = 0;
        index <
        pageImages.length;
        index++
      ) {

        const page =
          pageImages[index];


        const pageNo =
          nextPageNo +
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


        const blob =
          await canvasToBlob(
            page.canvas,
            "image/png"
          );


        if (!blob) {

          throw new Error(
            `ページ${pageNo}のPNG変換に失敗しました。`
          );

        }


        setStatus(
          `解答用紙を保存しています... ${
            index + 1
          } / ${
            pageImages.length
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
              blob,
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

          throw new Error(
            `ページ${pageNo}のStorage保存に失敗しました: ${
              uploadError.message
            }`
          );

        }


        uploaded.push({

          pageNo,

          path,

          width:
            page.width,

          height:
            page.height,

          originalName:
            file.name

        });

      }


      /*
       * DB登録。
       */

      const rows =
        uploaded.map(
          item => ({

            test_id:
              selectedTestId,

            page_no:
              item.pageNo,

            image_path:
              item.path,

            width_px:
              item.width,

            height_px:
              item.height,

            original_name:
              item.originalName

          })
        );


      const {
        data:
          insertedPages,
        error:
          insertError
      } =
        await supabaseClient
          .from(
            "test_pages"
          )
          .insert(
            rows
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
          );


      if (insertError) {

        /*
         * DB登録に失敗したら、
         * 今回アップロードしたStorageだけ削除。
         */

        await supabaseClient
          .storage
          .from(
            "test-files"
          )
          .remove(
            uploaded.map(
              item =>
                item.path
            )
          );


        throw new Error(
          `解答用紙ページの登録に失敗しました: ${
            insertError.message
          }`
        );

      }


      /*
       * 画面へ反映。
       */

      pages =
        [
          ...pages,
          ...(
            insertedPages ||
            []
          )
        ]
          .sort(
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


      /*
       * 既存の候補を消す。
       */

      candidates =
        [];


      await renderAllPages();


      /*
       * アップロード直後に
       * 自動枠検出。
       */

      setStatus(
        "解答用紙を登録しました。枠を自動検出しています..."
      );


      await detectAllPages();


    } catch (error) {

      console.error(
        "uploadAnswerSheet:",
        error
      );


      showError(
        error.message ||
        "解答用紙の登録に失敗しました。"
      );

    } finally {

      uploadButton.disabled =
        false;

    }

  }


  /* =======================================================
     AUTO CANDIDATE HELPERS
  ======================================================= */

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
            Number(
              existing.pageNo
            ) ===
            Number(
              candidate.pageNo
            ) &&
            overlapRatio(
              existing,
              candidate
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
        Number(a.x),
        Number(b.x)
      );


    const top =
      Math.max(
        Number(a.y),
        Number(b.y)
      );


    const right =
      Math.min(
        Number(a.x) +
        Number(a.width),
        Number(b.x) +
        Number(b.width)
      );


    const bottom =
      Math.min(
        Number(a.y) +
        Number(a.height),
        Number(b.y) +
        Number(b.height)
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
      Number(a.width) *
      Number(a.height);


    const areaB =
      Number(b.width) *
      Number(b.height);


    if (
      areaA <=
      0 ||
      areaB <=
      0
    ) {

      return 0;

    }


    return (
      intersection /
      Math.min(
        areaA,
        areaB
      )
    );

  }


  /* =======================================================
     CANDIDATE RENDER
  ======================================================= */

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


    element.dataset.candidateId =
      candidate.id;


    const pageWidth =
      Number(
        page.width_px
      );


    const pageHeight =
      Number(
        page.height_px
      );


    if (
      !pageWidth ||
      !pageHeight
    ) {

      return;

    }


    element.style.left =
      `${
        Number(
          candidate.x
        ) /
        pageWidth *
        100
      }%`;


    element.style.top =
      `${
        Number(
          candidate.y
        ) /
        pageHeight *
        100
      }%`;


    element.style.width =
      `${
        Number(
          candidate.width
        ) /
        pageWidth *
        100
      }%`;


    element.style.height =
      `${
        Number(
          candidate.height
        ) /
        pageHeight *
        100
      }%`;


    element.title =
      "クリックして正式な枠として登録";


    element.addEventListener(
      "pointerdown",
      event => {

        event.preventDefault();

        event.stopPropagation();


        acceptCandidate(
          candidate
        );

      }
    );


    layer.appendChild(
      element
    );

  }


  /* =======================================================
     ACCEPT CANDIDATE
  ======================================================= */

  async function acceptCandidate(
    candidate
  ) {

    if (!candidate) {

      return;

    }


    const role =
      boxRole?.value ||
      "answer";


    const roleInfo =
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
          candidate.pageNo
        ),

      box_type:
        roleInfo.boxType,

      label:
        "",

      x:
        Number(
          candidate.x
        ),

      y:
        Number(
          candidate.y
        ),

      width:
        Number(
          candidate.width
        ),

      height:
        Number(
          candidate.height
        ),

      question_id:
        null,

      points:
        roleInfo.boxType ===
          "answer"
          ? 0
          : null,

      parent_box_id:
        null,

      major_no:
        null,

      minor_no:
        null,

      box_role:
        role,

      sort_order:
        boxes.length,

      subtotal_group:
        null

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


    if (
      role ===
        "minor" ||
      role ===
        "subtotal"
    ) {

      updateParent(
        box
      );

    }


    renumberAll();


    box.label =
      automaticLabel(
        box.box_role,
        box
      );


    await renderAllPages();


    selectBox(
      box.id
    );


    setStatus(
      `${box.label}を作成しました。`
    );

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
