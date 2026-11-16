
"use strict";

/* =====================================================
   テスト成績システム
   js/teacher/test-layout.js

   解答用紙 枠設定

   枠の種類
   -----------------------------------------------------
   answer       解答欄
   qr           QRコード
   student_no   生徒番号
   name         氏名

   question_id
   -----------------------------------------------------
   NULLでも採点対象。
   採点側ではbox_type=answerを使用する。

   配点
   -----------------------------------------------------
   layout_boxes.points
===================================================== */


const layoutParams =
  new URLSearchParams(
    window.location.search
  );


const layoutTestId =
  layoutParams.get(
    "test"
  ) ||
  layoutParams.get(
    "id"
  );


const DB =
  window.supabaseClient ||
  window.SB;


if (!DB) {

  throw new Error(
    "Supabase Clientが初期化されていません。"
  );

}


let layoutTest =
  null;

let pages =
  [];

let boxes =
  [];

let selectedBox =
  null;

let currentPage =
  1;

let currentMode =
  "answer";

let dragState =
  null;

let imageScale =
  1;


/* =====================================================
   DOM
===================================================== */

const statusElement =
  document.getElementById(
    "status"
  );

const canvasWrap =
  document.getElementById(
    "canvasWrap"
  );

const questionList =
  document.getElementById(
    "questionList"
  );

const boxList =
  document.getElementById(
    "boxList"
  );

const totalElement =
  document.getElementById(
    "total"
  );


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  initializeLayout
);


async function initializeLayout() {

  try {

    if (!layoutTestId) {

      throw new Error(
        "テストIDがありません。"
      );

    }


    if (
      typeof window.requireRole ===
      "function"
    ) {

      const auth =
        await window.requireRole(
          "teacher"
        );


      if (!auth) {

        return;

      }

    }


    setupLayoutEvents();


    await loadLayoutTest();


    await loadPages();


    await loadBoxes();


    renderEverything();


    setStatus(
      "解答欄を設定できます。"
    );


  } catch (error) {

    console.error(
      "test-layout:",
      error
    );


    setStatus(
      error.message ||
      "枠設定を読み込めませんでした。",
      true
    );

  }

}


/* =====================================================
   EVENTS
===================================================== */

function setupLayoutEvents() {

  document
    .getElementById(
      "questionMode"
    )
    ?.addEventListener(
      "click",
      () => {

        setMode(
          "answer"
        );

      }
    );


  document
    .getElementById(
      "qrMode"
    )
    ?.addEventListener(
      "click",
      () => {

        setMode(
          "qr"
        );

      }
    );


  document
    .getElementById(
      "nameMode"
    )
    ?.addEventListener(
      "click",
      () => {

        setMode(
          "name"
        );

      }
    );


  document
    .getElementById(
      "saveButton"
    )
    ?.addEventListener(
      "click",
      saveBoxes
    );


  document
    .getElementById(
      "nextPoints"
    )
    ?.addEventListener(
      "click",
      () => {

        location.href =
          `/teacher/tests/points?test=${encodeURIComponent(
            layoutTestId
          )}`;

      }
    );


  document
    .getElementById(
      "addQuestion"
    )
    ?.addEventListener(
      "click",
      addQuestion
    );


  document
    .getElementById(
      "file"
    )
    ?.addEventListener(
      "change",
      handleFile
    );


  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        if (
          typeof window.logout ===
          "function"
        ) {

          await window.logout();

          return;

        }


        await DB.auth.signOut();


        location.replace(
          "/login"
        );

      }
    );

}


/* =====================================================
   TEST
===================================================== */

async function loadLayoutTest() {

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
        layoutTestId
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


  layoutTest =
    data;


  const pointsLink =
    document.getElementById(
      "pointsLink"
    );


  if (pointsLink) {

    pointsLink.href =
      `/teacher/tests/points?test=${encodeURIComponent(
        layoutTestId
      )}`;

  }

}


/* =====================================================
   PAGES
===================================================== */

async function loadPages() {

  const {
    data,
    error
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
        file_path,
        width_px,
        height_px
        `
      )
      .eq(
        "test_id",
        layoutTestId
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

    return;

  }


  currentPage =
    Number(
      pages[0].page_no
    ) || 1;

}


/* =====================================================
   BOXES
===================================================== */

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
        layoutTestId
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


  boxes =
    data || [];

}


/* =====================================================
   MODE
===================================================== */

function setMode(
  mode
) {

  currentMode =
    mode;


  document
    .getElementById(
      "questionMode"
    )
    ?.classList.toggle(
      "btn-primary",
      mode ===
        "answer"
    );


  document
    .getElementById(
      "qrMode"
    )
    ?.classList.toggle(
      "btn-primary",
      mode ===
        "qr"
    );


  document
    .getElementById(
      "nameMode"
    )
    ?.classList.toggle(
      "btn-primary",
      mode ===
        "name"
    );


  setStatus(
    `${modeLabel(
      mode
    )}枠を設定します。`
  );

}


/* =====================================================
   FILE
===================================================== */

async function handleFile(
  event
) {

  const file =
    event.target.files?.[0];


  if (!file) {

    return;

  }


  /*
   * 新しい解答用紙をアップロードする処理は
   * 現在のtest-pages.js側で管理する。
   *
   * ここでは既存ページ表示を優先。
   */

  setStatus(
    "解答用紙を登録する場合は、解答用紙ページ設定を使用してください。"
  );

}


/* =====================================================
   RENDER
===================================================== */

async function renderEverything() {

  renderQuestionList();

  renderBoxList();

  renderTotal();

  await renderPages();

}


/* =====================================================
   PAGES RENDER
===================================================== */

async function renderPages() {

  canvasWrap.innerHTML =
    "";


  if (!pages.length) {

    canvasWrap.innerHTML = `

      <div class="empty">

        解答用紙ページがありません。

        <br><br>

        先に解答用紙を登録してください。

      </div>

    `;

    return;

  }


  for (
    const page
    of pages
  ) {

    const pageElement =
      document.createElement(
        "div"
      );


    pageElement.className =
      "layout-page";


    pageElement.dataset.pageNo =
      String(
        page.page_no
      );


    const image =
      await createPageImage(
        page
      );


    pageElement.appendChild(
      image
    );


    const layer =
      document.createElement(
        "div"
      );


    layer.className =
      "layout-layer";


    layer.dataset.pageNo =
      String(
        page.page_no
      );


    pageElement.appendChild(
      layer
    );


    canvasWrap.appendChild(
      pageElement
    );


    renderPageBoxes(
      layer,
      page
    );


    setupPagePointer(
      layer,
      page
    );

  }

}


/* =====================================================
   PAGE IMAGE
===================================================== */

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
        page.file_path,
        900
      );


  if (error) {

    throw error;

  }


  if (!data?.signedUrl) {

    throw new Error(
      "解答用紙画像URLを取得できませんでした。"
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


/* =====================================================
   BOX RENDER
===================================================== */

function renderPageBoxes(
  layer,
  page
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


  pageBoxes.forEach(
    box => {

      const element =
        createBoxElement(
          box,
          page
        );


      layer.appendChild(
        element
      );

    }
  );

}


/* =====================================================
   BOX ELEMENT
===================================================== */

function createBoxElement(
  box,
  page
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
    selectedBox?.id ===
    box.id
  ) {

    element.classList.add(
      "selected"
    );

  }


  /*
   * DB座標を画面座標へ。
   */

  const scale =
    getPageScale(
      page,
      element
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
    [
      box.label ||
      modeLabel(
        box.box_type
      ),

      box.points !== null &&
      box.points !== undefined
        ? `${box.points}点`
        : ""

    ]
      .filter(Boolean)
      .join(
        " / "
      );


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


      selectBox(
        box
      );


      if (
        event.target ===
        handle
      ) {

        beginResize(
          event,
          box,
          element,
          page
        );

      } else {

        beginMove(
          event,
          box,
          element,
          page
        );

      }

    }
  );


  return element;

}


/* =====================================================
   PAGE SCALE
===================================================== */

function getPageScale(
  page,
  element
) {

  const pageElement =
    element.closest(
      ".layout-page"
    );


  if (!pageElement) {

    return 1;

  }


  const width =
    pageElement.clientWidth;


  const sourceWidth =
    Number(
      page.width_px
    ) || 0;


  if (
    !sourceWidth ||
    !width
  ) {

    return 1;

  }


  return width /
    sourceWidth;

}


/* =====================================================
   SELECT
===================================================== */

function selectBox(
  box
) {

  selectedBox =
    box;


  renderEverything();

}


/* =====================================================
   POINTER
===================================================== */

function setupPagePointer(
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


      beginCreate(
        event,
        layer,
        page
      );

    }
  );

}


/* =====================================================
   CREATE
===================================================== */

function beginCreate(
  event,
  layer,
  page
) {

  const rect =
    layer.getBoundingClientRect();


  const startX =
    event.clientX -
    rect.left;


  const startY =
    event.clientY -
    rect.top;


  const preview =
    document.createElement(
      "div"
    );


  preview.className =
    "drag-preview";


  layer.appendChild(
    preview
  );


  const move =
    moveEvent => {

      const x =
        moveEvent.clientX -
        rect.left;


      const y =
        moveEvent.clientY -
        rect.top;


      const left =
        Math.min(
          startX,
          x
        );


      const top =
        Math.min(
          startY,
          y
        );


      const width =
        Math.abs(
          x -
          startX
        );


      const height =
        Math.abs(
          y -
          startY
        );


      preview.style.left =
        `${left}px`;


      preview.style.top =
        `${top}px`;


      preview.style.width =
        `${width}px`;


      preview.style.height =
        `${height}px`;

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


      const x =
        upEvent.clientX -
        rect.left;


      const y =
        upEvent.clientY -
        rect.top;


      const left =
        Math.min(
          startX,
          x
        );


      const top =
        Math.min(
          startY,
          y
        );


      const width =
        Math.abs(
          x -
          startX
        );


      const height =
        Math.abs(
          y -
          startY
        );


      preview.remove();


      if (
        width <
        10 ||
        height <
        10
      ) {

        return;

      }


      const scale =
        getPageScale(
          page,
          layer
        );


      const box = {

        id:
          crypto.randomUUID(),

        test_id:
          layoutTestId,

        page_no:
          Number(
            page.page_no
          ) || 1,

        box_type:
          currentMode,

        label:
          defaultLabel(
            currentMode,
            boxes
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
          currentMode ===
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


      renderEverything();

    };


  document.addEventListener(
    "pointermove",
    move
  );


  document.addEventListener(
    "pointerup",
    up,
    {
      once:true
    }
  );

}


/* =====================================================
   MOVE
===================================================== */

function beginMove(
  event,
  box,
  element,
  page
) {

  const startClientX =
    event.clientX;


  const startClientY =
    event.clientY;


  const startX =
    Number(
      box.x
    ) || 0;


  const startY =
    Number(
      box.y
    ) || 0;


  const scale =
    getPageScale(
      page,
      element
    );


  const move =
    moveEvent => {

      const dx =
        (
          moveEvent.clientX -
          startClientX
        ) /
        scale;


      const dy =
        (
          moveEvent.clientY -
          startClientY
        ) /
        scale;


      box.x =
        Math.max(
          0,
          startX +
          dx
        );


      box.y =
        Math.max(
          0,
          startY +
          dy
        );


      renderEverything();

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


/* =====================================================
   RESIZE
===================================================== */

function beginResize(
  event,
  box,
  element,
  page
) {

  const startClientX =
    event.clientX;


  const startClientY =
    event.clientY;


  const startWidth =
    Number(
      box.width
    ) || 1;


  const startHeight =
    Number(
      box.height
    ) || 1;


  const scale =
    getPageScale(
      page,
      element
    );


  const move =
    moveEvent => {

      const dx =
        (
          moveEvent.clientX -
          startClientX
        ) /
        scale;


      const dy =
        (
          moveEvent.clientY -
          startClientY
        ) /
        scale;


      box.width =
        Math.max(
          5,
          startWidth +
          dx
        );


      box.height =
        Math.max(
          5,
          startHeight +
          dy
        );


      renderEverything();

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


/* =====================================================
   ADD QUESTION
===================================================== */

function addQuestion() {

  const page =
    pages.find(
      item =>
        Number(
          item.page_no
        ) ===
        Number(
          currentPage
        )
    ) ||
    pages[0];


  if (!page) {

    setStatus(
      "解答用紙ページがありません。",
      true
    );

    return;

  }


  const box = {

    id:
      crypto.randomUUID(),

    test_id:
      layoutTestId,

    page_no:
      Number(
        page.page_no
      ) || 1,

    box_type:
      "answer",

    label:
      defaultLabel(
        "answer",
        boxes
      ),

    x:
      100,

    y:
      100,

    width:
      180,

    height:
      80,

    question_id:
      null,

    points:
      0,

    sort_order:
      boxes.length

  };


  boxes.push(
    box
  );


  selectedBox =
    box;


  renderEverything();


  setStatus(
    `${box.label}を追加しました。位置とサイズを調整してください。`
  );

}


/* =====================================================
   SAVE
===================================================== */

async function saveBoxes() {

  const answerBoxes =
    boxes.filter(
      box =>
        box.box_type ===
        "answer"
    );


  if (!answerBoxes.length) {

    setStatus(
      "解答欄がありません。",
      true
    );

    return;

  }


  setStatus(
    "枠設定を保存しています..."
  );


  /*
   * 現在のDBにある枠を取得。
   */

  const {
    data:
      existing,
    error:
      existingError
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
        layoutTestId
      );


  if (existingError) {

    throw existingError;

  }


  const currentIds =
    new Set(
      boxes
        .filter(
          box =>
            isRealId(
              box.id
            )
        )
        .map(
          box =>
            box.id
        )
    );


  /*
   * 画面から削除された枠を削除。
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
        await DB
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
   * 枠を保存。
   */

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
        layoutTestId,

      page_no:
        Number(
          box.page_no
        ) || 1,

      box_type:
        box.box_type,

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
        box.question_id ||
        null,

      points:
        box.points === null ||
        box.points === undefined
          ? null
          : Number(
              box.points
            ) || 0,

      sort_order:
        index

    };


    if (
      isRealId(
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


  /*
   * question_idは現在NULLでもOK。
   *
   * 保存後にquestion_idを
   * 自動生成しない。
   */

  await loadBoxes();


  renderEverything();


  setStatus(
    "枠設定を保存しました。"
  );

}


/* =====================================================
   QUESTION LIST
===================================================== */

function renderQuestionList() {

  if (!questionList) {

    return;

  }


  const answerBoxes =
    boxes.filter(
      box =>
        box.box_type ===
        "answer"
    );


  if (!answerBoxes.length) {

    questionList.innerHTML = `

      <div class="empty">
        解答欄がありません。
      </div>

    `;

    return;

  }


  questionList.innerHTML =
    "";


  answerBoxes.forEach(
    (
      box,
      index
    ) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "question-row";


      const label =
        document.createElement(
          "input"
        );


      label.type =
        "text";


      label.value =
        box.label ||
        `問${index + 1}`;


      label.addEventListener(
        "change",
        () => {

          box.label =
            label.value.trim() ||
            `問${index + 1}`;


          renderBoxList();

        }
      );


      const points =
        document.createElement(
          "input"
        );


      points.type =
        "number";


      points.min =
        "0";


      points.step =
        "0.1";


      points.value =
        Number(
          box.points
        ) || 0;


      points.addEventListener(
        "input",
        () => {

          box.points =
            Number(
              points.value
            ) || 0;


          renderTotal();

        }
      );


      const page =
        document.createElement(
          "input"
        );


      page.type =
        "number";


      page.min =
        "1";


      page.value =
        Number(
          box.page_no
        ) || 1;


      page.addEventListener(
        "change",
        () => {

          box.page_no =
            Number(
              page.value
            ) || 1;


          renderEverything();

        }
      );


      row.append(
        label,
        points,
        page
      );


      questionList.appendChild(
        row
      );

    }
  );

}


/* =====================================================
   BOX LIST
===================================================== */

function renderBoxList() {

  if (!boxList) {

    return;

  }


  if (!boxes.length) {

    boxList.innerHTML = `

      <div class="empty">
        枠がありません。
      </div>

    `;

    return;

  }


  boxList.innerHTML =
    "";


  boxes.forEach(
    box => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "box-row";


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
          modeLabel(
            box.box_type
          ),

          `P${box.page_no}`,

          `${formatNumber(
            box.width
          )}×${formatNumber(
            box.height
          )}`

        ].join(
          " / "
        );


      const type =
        document.createElement(
          "div"
        );


      type.textContent =
        modeLabel(
          box.box_type
        );


      const deleteButton =
        document.createElement(
          "button"
        );


      deleteButton.type =
        "button";


      deleteButton.className =
        "btn";


      deleteButton.textContent =
        "削除";


      deleteButton.addEventListener(
        "click",
        event => {

          event.stopPropagation();


          deleteBox(
            box
          );

        }
      );


      row.append(
        label,
        type,
        deleteButton
      );


      row.addEventListener(
        "click",
        () => {

          selectedBox =
            box;


          renderEverything();

        }
      );


      boxList.appendChild(
        row
      );

    }
  );

}


/* =====================================================
   DELETE
===================================================== */

function deleteBox(
  box
) {

  boxes =
    boxes.filter(
      item =>
        item !==
        box
    );


  if (
    selectedBox ===
    box
  ) {

    selectedBox =
      null;

  }


  renderEverything();


  setStatus(
    "枠を削除しました。保存するとDBにも反映されます。"
  );

}


/* =====================================================
   TOTAL
===================================================== */

function renderTotal() {

  if (!totalElement) {

    return;

  }


  const total =
    boxes
      .filter(
        box =>
          box.box_type ===
          "answer"
      )
      .reduce(
        (
          sum,
          box
        ) =>
          sum +
          (
            Number(
              box.points
            ) || 0
          ),
        0
      );


  totalElement.textContent =
    `合計配点：${formatNumber(
      total
    )}点`;

}


/* =====================================================
   DEFAULT LABEL
===================================================== */

function defaultLabel(
  mode,
  current
) {

  if (
    mode ===
    "qr"
  ) {

    return "QR";

  }


  if (
    mode ===
    "name"
  ) {

    return "氏名";

  }


  if (
    mode ===
    "student_no"
  ) {

    return "生徒番号";

  }


  if (
    mode ===
    "major"
  ) {

    return "大問";

  }


  if (
    mode ===
    "minor"
  ) {

    return "小問";

  }


  const count =
    current.filter(
      box =>
        box.box_type ===
        "answer"
    ).length;


  return `問${count + 1}`;

}


/* =====================================================
   MODE LABEL
===================================================== */

function modeLabel(
  mode
) {

  const labels = {

    answer:
      "解答欄",

    qr:
      "QR",

    name:
      "氏名",

    student_no:
      "生徒番号",

    major:
      "大問",

    minor:
      "小問",

    subtotal:
      "小計",

    total:
      "合計",

    instruction:
      "説明",

    other:
      "その他"

  };


  return labels[
    mode
  ] ||
  mode ||
  "その他";

}


/* =====================================================
   ID
===================================================== */

function isRealId(
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


/* =====================================================
   IMAGE
===================================================== */

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
              "解答用紙画像を読み込めませんでした。"
            )
          );

    }
  );

}


/* =====================================================
   STATUS
===================================================== */

function setStatus(
  message,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    message;


  statusElement.className =
    error
      ? "status error"
      : "status";

}


/* =====================================================
   NUMBER
===================================================== */

function formatNumber(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "0";

  }


  return Number.isInteger(
    number
  )
    ? String(
        number
      )
    : number.toFixed(
        1
      );

}
