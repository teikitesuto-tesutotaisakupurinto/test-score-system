
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙レイアウトエディタ

   DB
   ---------------------------------------------------------
   test_pages
     id
     test_id
     page_no
     image_path
     width_px
     height_px
     original_name

   layout_boxes
     id
     test_id
     page_no
     box_type
     label
     x
     y
     width
     height
     points
     parent_box_id
     major_no
     minor_no
     box_role
     sort_order
     subtotal_group

   この画面では
   ---------------------------------------------------------
   配点 → 設定しない
   設問ID → 設定しない

   枠種類
   ---------------------------------------------------------
   major
   minor
   qr
   subtotal
   total
   name
   student_no
   instruction
   other
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let selectedTestId = null;

  let pages = [];

  let boxes = [];

  let selectedBoxId = null;

  let activePointerId = null;

  let drawing = false;

  let drawStart = null;

  let drawPage = null;

  let drawLayer = null;

  let drawPreview = null;

  let dragMode = null;

  let dragBoxId = null;

  let dragStart = null;

  let dragOriginal = null;

  let pdfPromise = null;


  /* =======================================================
     DOM
  ======================================================= */

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


  /* =======================================================
     ROLES
  ======================================================= */

  const ROLE_INFO = {

    major: {
      label: "大問",
      type: "question"
    },

    minor: {
      label: "小問",
      type: "answer"
    },

    qr: {
      label: "QR",
      type: "qr"
    },

    subtotal: {
      label: "小計",
      type: "subtotal"
    },

    total: {
      label: "合計",
      type: "total"
    },

    name: {
      label: "氏名",
      type: "name"
    },

    student_no: {
      label: "生徒番号",
      type: "student_no"
    },

    instruction: {
      label: "説明",
      type: "instruction"
    },

    other: {
      label: "その他",
      type: "other"
    }

  };


  /* =======================================================
     INIT
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {
        return;
      }


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
        ).get(
          "test"
        ) ||
        window.__TEST_ID__ ||
        null;


      setupEvents();


      if (!selectedTestId) {

        setStatus(
          "テストIDが指定されていません。"
        );

        return;

      }


      openBoxPanel();


      await loadLayout();


    } catch (error) {

      console.error(
        "test-pages:",
        error
      );


      showError(
        error.message ||
        "枠設定画面を読み込めませんでした。"
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
     LOAD LAYOUT
  ======================================================= */

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


    const {
      data: boxData,
      error: boxError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
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
        );


    if (boxError) {
      throw boxError;
    }


    boxes =
      boxData || [];


    normalizeBoxes();


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
          !box.box_role
        ) {

          box.box_role =
            inferRole(
              box
            );

        }


        if (
          !box.box_type
        ) {

          box.box_type =
            ROLE_INFO[
              box.box_role
            ]?.type ||
            "other";

        }

      }
    );

  }


  /* =======================================================
     RENDER ALL PAGES
  ======================================================= */

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
        .from(
          "answer-files"
        )
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
        `ページ${page.page_no}の画像が見つかりません。`
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
      ドラッグによる新規枠
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
          Number(box.page_no) ===
          Number(page.page_no)
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

        /*
          既存枠を押した場合は
          新規枠を作らない。
        */

        if (
          event.target !== layer
        ) {

          return;

        }


        if (
          event.button !== 0 &&
          event.pointerType !== "touch"
        ) {

          return;

        }


        event.preventDefault();


        activePointerId =
          event.pointerId;


        layer.setPointerCapture(
          event.pointerId
        );


        const rect =
          layer.getBoundingClientRect();


        drawStart =
          getPoint(
            event,
            rect
          );


        drawPage =
          page;


        drawLayer =
          layer;


        drawing =
          true;


        /*
          ドラッグ開始直後から
          仮枠を表示。
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
            activePointerId
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
            activePointerId
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
          activePointerId
        ) {

          return;

        }


        cancelDrawing();

      }
    );

  }


  /* =======================================================
     UPDATE DRAW PREVIEW
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
      `${(
        x /
        rect.width
      ) * 100}%`;


    drawPreview.style.top =
      `${(
        y /
        rect.height
      ) * 100}%`;


    drawPreview.style.width =
      `${(
        width /
        rect.width
      ) * 100}%`;


    drawPreview.style.height =
      `${(
        height /
        rect.height
      ) * 100}%`;

  }


  /* =======================================================
     FINISH DRAWING
  ======================================================= */

  function finishDrawing(
    event
  ) {

    if (
      !drawing ||
      !drawLayer ||
      !drawPage ||
      !drawStart
    ) {

      cancelDrawing();

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


    if (drawPreview) {

      drawPreview.remove();

    }


    const page =
      drawPage;


    const layer =
      drawLayer;


    const canvas =
      layer.parentElement
        ?.querySelector(
          "canvas"
        );


    /*
      画面上の座標から
      原画像座標へ変換。
    */

    if (!canvas) {

      cancelDrawing();

      return;

    }


    const canvasRect =
      canvas.getBoundingClientRect();


    const scaleX =
      canvas.width /
      canvasRect.width;


    const scaleY =
      canvas.height /
      canvasRect.height;


    drawing =
      false;


    activePointerId =
      null;


    drawStart =
      null;


    drawPage =
      null;


    drawLayer =
      null;


    drawPreview =
      null;


    if (
      width < 8 ||
      height < 8
    ) {

      return;

    }


    const role =
      boxRole?.value ||
      "minor";


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
        ROLE_INFO[
          role
        ]?.type ||
        "other",

      label:
        automaticLabel(
          role
        ),

      x:
        x *
        scaleX,

      y:
        y *
        scaleY,

      width:
        width *
        scaleX,

      height:
        height *
        scaleY,

      points:
        0,

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


    /*
      親子関係を自動判定。
    */

    assignHierarchy(
      box
    );


    boxes.push(
      box
    );


    renderBox(
      layer,
      page,
      box
    );


    selectBox(
      box.id
    );


    updateRoleHelp();

  }


  /* =======================================================
     CANCEL DRAWING
  ======================================================= */

  function cancelDrawing() {

    if (drawPreview) {

      drawPreview.remove();

    }


    drawing =
      false;

    activePointerId =
      null;

    drawStart =
      null;

    drawPage =
      null;

    drawLayer =
      null;

    drawPreview =
      null;

  }


  /* =======================================================
     RENDER BOX
  ======================================================= */

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


    applyRoleStyle(
      element,
      box.box_role
    );


    updateBoxElement(
      element,
      page,
      box
    );


    const label =
      document.createElement(
        "div"
      );


    label.className =
      "layout-box-label";


    label.textContent =
      automaticLabel(
        box.box_role,
        box
      );


    element.appendChild(
      label
    );


    const resize =
      document.createElement(
        "div"
      );


    resize.className =
      "resize-handle";


    element.appendChild(
      resize
    );


    layer.appendChild(
      element
    );


    setupBoxPointerEvents(
      element,
      resize,
      page,
      box
    );

  }


  /* =======================================================
     ROLE STYLE
  ======================================================= */

  function applyRoleStyle(
    element,
    role
  ) {

    /*
      大問
    */

    if (
      role ===
      "major"
    ) {

      element.style.border =
        "3px solid #2468a8";

      element.style.background =
        "rgba(36,104,168,.07)";

      return;

    }


    /*
      小問
    */

    if (
      role ===
      "minor"
    ) {

      element.style.border =
        "2px solid #d00000";

      element.style.background =
        "rgba(208,0,0,.06)";

      return;

    }


    /*
      QR
    */

    if (
      role ===
      "qr"
    ) {

      element.style.border =
        "3px dashed #333";

      element.style.background =
        "rgba(0,0,0,.06)";

      return;

    }


    /*
      小計
    */

    if (
      role ===
      "subtotal"
    ) {

      element.style.border =
        "2px dashed #555";

      element.style.background =
        "rgba(0,0,0,.04)";

      return;

    }


    /*
      合計
    */

    if (
      role ===
      "total"
    ) {

      element.style.border =
        "3px double #333";

      element.style.background =
        "rgba(0,0,0,.05)";

      return;

    }


    /*
      その他
    */

    element.style.border =
      "2px solid #666";

    element.style.background =
      "rgba(0,0,0,.03)";

  }


  /* =======================================================
     BOX POINTER EVENTS
  ======================================================= */

  function setupBoxPointerEvents(
    element,
    resizeHandle,
    page,
    box
  ) {

    element.addEventListener(
      "pointerdown",
      event => {

        event.stopPropagation();

        event.preventDefault();


        selectBox(
          box.id
        );


        const mode =
          event.target ===
          resizeHandle
            ? "resize"
            : "move";


        dragMode =
          mode;


        dragBoxId =
          box.id;


        activePointerId =
          event.pointerId;


        element.setPointerCapture(
          event.pointerId
        );


        const canvas =
          element
            .parentElement
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

      }
    );


    element.addEventListener(
      "pointermove",
      event => {

        if (
          dragBoxId !==
          box.id ||
          !dragStart ||
          !dragOriginal ||
          event.pointerId !==
            activePointerId
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


        /*
          小問を移動したら
          親大問を再判定。
        */

        if (
          box.box_role ===
          "minor"
        ) {

          updateParent(
            box
          );

        }


        updatePageBoxElement(
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
          activePointerId
        ) {

          return;

        }


        event.preventDefault();


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
          activePointerId
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
      "minor"
    ) {

      updateParent(
        box
      );

      renumberMinors();

    }


    dragMode =
      null;

    dragBoxId =
      null;

    activePointerId =
      null;

    dragStart =
      null;

    dragOriginal =
      null;


    updateAllLabels();

    updateRoleHelp();

  }


  /* =======================================================
     SELECT BOX
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

          element.classList.toggle(
            "selected",
            element.dataset.boxId ===
              boxId
          );

        }
      );


    openBoxPanel();

    updateRoleHelp();

  }


  /* =======================================================
     OPEN PANEL
  ======================================================= */

  function openBoxPanel() {

    boxPanel?.classList.add(
      "open"
    );

    updateRoleHelp();

  }


  /* =======================================================
     CLOSE PANEL
  ======================================================= */

  function closeBoxPanel() {

    boxPanel?.classList.remove(
      "open"
    );

  }


  /* =======================================================
     APPLY SELECTED BOX
  ======================================================= */

  function applySelectedBox() {

    if (!selectedBoxId) {

      return;

    }


    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


    const role =
      boxRole?.value ||
      box.box_role ||
      "minor";


    box.box_role =
      role;


    box.box_type =
      ROLE_INFO[
        role
      ]?.type ||
      "other";


    /*
      表示名は入力しない。

      常に自動生成。
    */

    if (
      role ===
      "major"
    ) {

      box.parent_box_id =
        null;

      box.minor_no =
        null;

      if (
        !box.major_no
      ) {

        box.major_no =
          getNextMajorNumber(
            box.id
          );

      }

    }


    else if (
      role ===
      "minor"
    ) {

      updateParent(
        box
      );

    }


    else {

      box.parent_box_id =
        null;

      box.major_no =
        null;

      box.minor_no =
        null;

    }


    if (
      role ===
      "subtotal"
    ) {

      const parent =
        findContainingMajor(
          box
        );


      if (parent) {

        box.subtotal_group =
          parent.major_no;

      } else {

        box.subtotal_group =
          null;

      }

    } else {

      box.subtotal_group =
        null;

    }


    renumberMajors();

    renumberMinors();


    updateAllLabels();

    updateRoleHelp();

  }


  /* =======================================================
     DELETE SELECTED
  ======================================================= */

  function deleteSelectedBox() {

    if (!selectedBoxId) {

      return;

    }


    const targetId =
      selectedBoxId;


    /*
      子小問の親を解除
    */

    boxes
      .filter(
        box =>
          box.parent_box_id ===
          targetId
      )
      .forEach(
        child => {

          child.parent_box_id =
            null;

          child.major_no =
            null;

          child.minor_no =
            null;

        }
      );


    boxes =
      boxes.filter(
        box =>
          box.id !==
          targetId
      );


    document
      .querySelectorAll(
        ".layout-box"
      )
      .forEach(
        element => {

          if (
            element.dataset.boxId ===
            targetId
          ) {

            element.remove();

          }

        }
      );


    selectedBoxId =
      null;


    renumberMajors();

    renumberMinors();


    closeBoxPanel();


    updateAllLabels();

  }


  /* =======================================================
     ASSIGN HIERARCHY
  ======================================================= */

  function assignHierarchy(
    box
  ) {

    if (
      box.box_role ===
      "major"
    ) {

      box.parent_box_id =
        null;

      box.major_no =
        getNextMajorNumber();

      box.minor_no =
        null;

      return;

    }


    if (
      box.box_role ===
      "minor"
    ) {

      const parent =
        findContainingMajor(
          box
        );


      /*
        大問が実際に存在するときだけ
        親子関係を作る。
      */

      if (parent) {

        box.parent_box_id =
          parent.id;

        box.major_no =
          parent.major_no;

        box.minor_no =
          getNextMinorNumber(
            parent.id
          );

      } else {

        /*
          大問を勝手に作らない。
        */

        box.parent_box_id =
          null;

        box.major_no =
          null;

        box.minor_no =
          null;

      }


      return;

    }


    if (
      box.box_role ===
      "subtotal"
    ) {

      const parent =
        findContainingMajor(
          box
        );


      if (parent) {

        box.subtotal_group =
          parent.major_no;

      } else {

        box.subtotal_group =
          null;

      }


      return;

    }


    box.parent_box_id =
      null;

    box.major_no =
      null;

    box.minor_no =
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

      /*
        大問がなければ
        勝手に大問を作らない。
      */

      box.parent_box_id =
        null;

      box.major_no =
        null;

      box.minor_no =
        null;

      return;

    }


    box.parent_box_id =
      parent.id;

    box.major_no =
      parent.major_no;

    box.minor_no =
      getNextMinorNumberIgnoringSelf(
        parent.id,
        box.id
      );

  }


  /* =======================================================
     FIND CONTAINING MAJOR
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


    if (!candidates.length) {

      return null;

    }


    /*
      大問が重なっている場合は
      最小の大問を優先。
    */

    candidates.sort(
      (
        a,
        b
      ) =>
        (
          Number(a.width) *
          Number(a.height)
        ) -
        (
          Number(b.width) *
          Number(b.height)
        )
    );


    return candidates[0];

  }


  /* =======================================================
     GET CENTER
  ======================================================= */

  function getCenter(
    box
  ) {

    return {

      x:
        Number(box.x) +
        Number(box.width) /
        2,

      y:
        Number(box.y) +
        Number(box.height) /
        2

    };

  }


  /* =======================================================
     POINT INSIDE
  ======================================================= */

  function pointInside(
    point,
    box
  ) {

    return (

      point.x >=
        Number(box.x) &&

      point.y >=
        Number(box.y) &&

      point.x <=
        Number(box.x) +
        Number(box.width) &&

      point.y <=
        Number(box.y) +
        Number(box.height)

    );

  }


  /* =======================================================
     MAJOR NUMBER
  ======================================================= */

  function getNextMajorNumber(
    ignoreId = null
  ) {

    const numbers =
      boxes
        .filter(
          box =>
            box.box_role ===
              "major" &&
            box.id !==
              ignoreId
        )
        .map(
          box =>
            Number(
              box.major_no
            ) || 0
        );


    return (
      Math.max(
        0,
        ...numbers
      ) +
      1
    );

  }


  /* =======================================================
     MINOR NUMBER
  ======================================================= */

  function getNextMinorNumber(
    parentId
  ) {

    const numbers =
      boxes
        .filter(
          box =>
            box.box_role ===
              "minor" &&
            box.parent_box_id ===
              parentId
        )
        .map(
          box =>
            Number(
              box.minor_no
            ) || 0
        );


    return (
      Math.max(
        0,
        ...numbers
      ) +
      1
    );

  }


  function getNextMinorNumberIgnoringSelf(
    parentId,
    selfId
  ) {

    const numbers =
      boxes
        .filter(
          box =>
            box.box_role ===
              "minor" &&
            box.parent_box_id ===
              parentId &&
            box.id !==
              selfId
        )
        .map(
          box =>
            Number(
              box.minor_no
            ) || 0
        );


    return (
      Math.max(
        0,
        ...numbers
      ) +
      1
    );

  }


  /* =======================================================
     RENUMBER MAJORS
  ======================================================= */

  function renumberMajors() {

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

  }


  /* =======================================================
     RENUMBER MINORS
  ======================================================= */

  function renumberMinors() {

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


    /*
      大問が存在しない小問は
      大問番号を持たない。
    */

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

  }


  /* =======================================================
     AUTOMATIC LABEL
  ======================================================= */

  function automaticLabel(
    role,
    box = null
  ) {

    switch (
      role
    ) {

      case "major":

        return `大問${
          box?.major_no ||
          getNextMajorNumber()
        }`;


      case "minor":

        if (
          box?.minor_no
        ) {

          return `問${box.minor_no}`;

        }

        return "小問";


      case "qr":
        return "QR";


      case "subtotal":
        return "小計";


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
     UPDATE ALL LABELS
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

        }
      );

  }


  /* =======================================================
     UPDATE ELEMENT
  ======================================================= */

  function updatePageBoxElement(
    element,
    page,
    box
  ) {

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
      `${(
        Number(box.x) /
        pageWidth
      ) * 100}%`;


    element.style.top =
      `${(
        Number(box.y) /
        pageHeight
      ) * 100}%`;


    element.style.width =
      `${(
        Number(box.width) /
        pageWidth
      ) * 100}%`;


    element.style.height =
      `${(
        Number(box.height) /
        pageHeight
      ) * 100}%`;

  }


  function updateBoxElement(
    element,
    page,
    box
  ) {

    updatePageBoxElement(
      element,
      page,
      box
    );

  }


  /* =======================================================
     SELECTED BOX
  ======================================================= */

  function getSelectedBox() {

    if (!selectedBoxId) {
      return null;
    }


    return (
      boxes.find(
        box =>
          box.id ===
          selectedBoxId
      ) ||
      null
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
      "minor";


    if (
      role ===
      "major"
    ) {

      parentInfo.textContent =
        "大問の範囲です。";

      return;

    }


    if (
      role ===
      "minor"
    ) {

      if (selected) {

        const parent =
          findContainingMajor(
            selected
          );


        if (parent) {

          parentInfo.textContent =
            `大問${parent.major_no}の小問として登録されます。`;

        } else {

          parentInfo.textContent =
            "大問の外にあるため、大問には登録されません。";

        }

      } else {

        parentInfo.textContent =
          "大問の内側にドラッグすると、その大問の小問になります。";

      }

      return;

    }


    if (
      role ===
      "qr"
    ) {

      parentInfo.textContent =
        "この範囲をQR読み取り範囲として使用します。";

      return;

    }


    if (
      role ===
      "subtotal"
    ) {

      parentInfo.textContent =
        "対応する小問の点数から小計を計算します。";

      return;

    }


    if (
      role ===
      "total"
    ) {

      parentInfo.textContent =
        "小計などから合計点を計算します。";

      return;

    }


    if (
      role ===
      "name"
    ) {

      parentInfo.textContent =
        "氏名読み取り範囲です。";

      return;

    }


    if (
      role ===
      "student_no"
    ) {

      parentInfo.textContent =
        "生徒番号読み取り範囲です。";

      return;

    }


    parentInfo.textContent =
      "この範囲を登録します。";

  }


  /* =======================================================
     SAVE
  ======================================================= */

  async function saveBoxes() {

    if (!selectedTestId) {

      alert(
        "テストIDがありません。"
      );

      return;

    }


    try {

      renumberMajors();

      renumberMinors();


      /*
        sort_order
      */

      boxes
        .sort(
          compareBoxes
        )
        .forEach(
          (
            box,
            index
          ) => {

            box.sort_order =
              index;

          }
        );


      validateBoxes();


      saveButton.disabled =
        true;


      setStatus(
        "枠設定を保存しています..."
      );


      const {
        error:
          deleteError
      } =
        await supabaseClient
          .from(
            "layout_boxes"
          )
          .delete()
          .eq(
            "test_id",
            selectedTestId
          );


      if (deleteError) {
        throw deleteError;
      }


      if (boxes.length) {

        const rows =
          boxes.map(
            box => ({

              id:
                box.id,

              test_id:
                selectedTestId,

              page_no:
                Number(
                  box.page_no
                ),

              box_type:
                box.box_type ||
                "other",

              label:
                automaticLabel(
                  box.box_role,
                  box
                ),

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
                ),

              /*
                この画面では
                配点設定しない。
              */

              points:
                0,

              /*
                設問IDも使用しない。
              */

              question_id:
                null,

              parent_box_id:
                box.parent_box_id ||
                null,

              major_no:
                box.major_no ||
                null,

              minor_no:
                box.minor_no ||
                null,

              box_role:
                box.box_role ||
                "other",

              sort_order:
                Number(
                  box.sort_order
                ) || 0,

              subtotal_group:
                box.subtotal_group ||
                null

            })
          );


        const {
          error:
            insertError
        } =
          await supabaseClient
            .from(
              "layout_boxes"
            )
            .insert(
              rows
            );


        if (insertError) {
          throw insertError;
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


      showError(
        error.message ||
        "枠設定の保存に失敗しました。"
      );

    } finally {

      saveButton.disabled =
        false;

    }

  }


  /* =======================================================
     VALIDATE
  ======================================================= */

  function validateBoxes() {

    const ids =
      new Set();


    boxes.forEach(
      box => {

        if (
          ids.has(
            box.id
          )
        ) {

          throw new Error(
            "枠IDが重複しています。"
          );

        }


        ids.add(
          box.id
        );


        if (
          !Number.isInteger(
            Number(
              box.page_no
            )
          )
        ) {

          throw new Error(
            "ページ番号が不正です。"
          );

        }


        if (
          Number(box.width) <= 0 ||
          Number(box.height) <= 0
        ) {

          throw new Error(
            "枠のサイズが不正です。"
          );

        }


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
              "親大問が見つかりません。"
            );

          }


          if (
            parent.box_role !==
            "major"
          ) {

            throw new Error(
              "小問の親が大問ではありません。"
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
              "小問と大問のページが一致していません。"
            );

          }

        }

      }
    );

  }


  /* =======================================================
     SORT
  ======================================================= */

  function compareBoxes(
    a,
    b
  ) {

    if (
      Number(a.page_no) !==
      Number(b.page_no)
    ) {

      return (
        Number(a.page_no) -
        Number(b.page_no)
      );

    }


    if (
      Number(a.y) !==
      Number(b.y)
    ) {

      return (
        Number(a.y) -
        Number(b.y)
      );

    }


    return (
      Number(a.x) -
      Number(b.x)
    );

  }


  /* =======================================================
     INFER ROLE
  ======================================================= */

  function inferRole(
    box
  ) {

    if (
      ROLE_INFO[
        box.box_role
      ]
    ) {

      return box.box_role;

    }


    switch (
      box.box_type
    ) {

      case "question":
        return "major";

      case "answer":
        return "minor";

      case "qr":
        return "qr";

      case "subtotal":
        return "subtotal";

      case "total":
        return "total";

      case "name":
        return "name";

      case "student_no":
        return "student_no";

      case "instruction":
        return "instruction";

      default:
        return "other";

    }

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyboard(
    event
  ) {

    /*
      入力欄ではDeleteを横取りしない。
    */

    const tag =
      event.target?.tagName;


    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    ) {

      return;

    }


    if (
      event.key ===
      "Delete"
    ) {

      if (selectedBoxId) {

        event.preventDefault();

        deleteSelectedBox();

      }

    }


    if (
      event.key ===
      "Escape"
    ) {

      cancelDrawing();

      closeBoxPanel();

    }

  }


  /* =======================================================
     BACK
  ======================================================= */

  function goBack() {

    if (selectedTestId) {

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
     PDF
  ======================================================= */

  function loadPdfJs() {

    if (pdfPromise) {
      return pdfPromise;
    }


    pdfPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          if (
            window.pdfjsLib
          ) {

            resolve(
              window.pdfjsLib
            );

            return;

          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";


          script.onload =
            () => {

              if (
                !window.pdfjsLib
              ) {

                reject(
                  new Error(
                    "PDF.jsを読み込めませんでした。"
                  )
                );

                return;

              }


              window.pdfjsLib
                .GlobalWorkerOptions
                .workerSrc =
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


              resolve(
                window.pdfjsLib
              );

            };


          script.onerror =
            () =>
              reject(
                new Error(
                  "PDF.jsの読み込みに失敗しました。"
                )
              );


          document.head.appendChild(
            script
          );

        }
      );


    return pdfPromise;

  }


  /* =======================================================
     FILE → PAGES
  ======================================================= */

  async function fileToPages(
    file
  ) {

    const extension =
      getExtension(
        file.name
      );


    if (
      extension ===
      "pdf"
    ) {

      return convertPdf(
        file
      );

    }


    return [
      await convertImage(
        file
      )
    ];

  }


  async function convertPdf(
    file
  ) {

    const pdfjs =
      await loadPdfJs();


    const buffer =
      await file.arrayBuffer();


    const pdf =
      await pdfjs
        .getDocument({
          data:
            buffer
        })
        .promise;


    const result =
      [];


    for (
      let pageNo = 1;
      pageNo <= pdf.numPages;
      pageNo++
    ) {

      const page =
        await pdf.getPage(
          pageNo
        );


      const base =
        page.getViewport({
          scale: 1
        });


      const scale =
        Math.min(
          3,
          Math.max(
            1,
            3500 /
            Math.max(
              base.width,
              base.height
            )
          )
        );


      const viewport =
        page.getViewport({
          scale
        });


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        Math.ceil(
          viewport.width
        );


      canvas.height =
        Math.ceil(
          viewport.height
        );


      await page.render({

        canvasContext:
          canvas.getContext(
            "2d"
          ),

        viewport

      }).promise;


      result.push({

        canvas,

        width:
          canvas.width,

        height:
          canvas.height

      });

    }


    return result;

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  async function convertImage(
    file
  ) {

    const url =
      URL.createObjectURL(
        file
      );


    try {

      const image =
        await loadImage(
          url
        );


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        image.naturalWidth;


      canvas.height =
        image.naturalHeight;


      canvas
        .getContext(
          "2d"
        )
        .drawImage(
          image,
          0,
          0
        );


      return {

        canvas,

        width:
          canvas.width,

        height:
          canvas.height

      };

    } finally {

      URL.revokeObjectURL(
        url
      );

    }

  }


  /* =======================================================
     UPLOAD ANSWER SHEET
  ======================================================= */

  async function uploadAnswerSheet() {

    if (!selectedTestId) {

      alert(
        "テストIDがありません。"
      );

      return;

    }


    const file =
      answerFile?.files?.[0];


    if (!file) {

      alert(
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

      alert(
        "PDF、JPG、JPEG、PNG、WEBPに対応しています。"
      );

      return;

    }


    try {

      uploadButton.disabled =
        true;


      setStatus(
        "解答用紙を処理しています..."
      );


      const pageImages =
        await fileToPages(
          file
        );


      if (!pageImages.length) {

        throw new Error(
          "解答用紙のページを取得できませんでした。"
        );

      }


      /*
        DBの古いページ削除
      */

      const {
        error:
          pageDeleteError
      } =
        await supabaseClient
          .from(
            "test_pages"
          )
          .delete()
          .eq(
            "test_id",
            selectedTestId
          );


      if (pageDeleteError) {
        throw pageDeleteError;
      }


      /*
        古い枠削除
      */

      const {
        error:
          boxDeleteError
      } =
        await supabaseClient
          .from(
            "layout_boxes"
          )
          .delete()
          .eq(
            "test_id",
            selectedTestId
          );


      if (boxDeleteError) {
        throw boxDeleteError;
      }


      let pageNo =
        1;


      for (
        const page
        of pageImages
      ) {

        const path =
          [
            selectedTestId,
            "answer-sheet",
            `page-${String(
              pageNo
            ).padStart(
              3,
              "0"
            )}.png`
          ].join("/");


        const blob =
          await canvasToBlob(
            page.canvas,
            "image/png"
          );


        const {
          error:
            uploadError
        } =
          await supabaseClient
            .storage
            .from(
              "answer-files"
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


        const {
          error:
            insertError
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
                page.width,

              height_px:
                page.height,

              original_name:
                file.name

            });


        if (insertError) {
          throw insertError;
        }


        pageNo++;

      }


      if (answerFile) {
        answerFile.value =
          "";
      }


      selectedBoxId =
        null;


      await loadLayout();


      setStatus(
        "解答用紙を登録しました。枠種類を選択して枠を設定してください。"
      );


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
     HELPERS
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


  function canvasToBlob(
    canvas,
    type
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
                  "画像を作成できませんでした。"
                )
              );

              return;

            }


            resolve(
              blob
            );

          },
          type,
          .95
        );

      }
    );

  }


  function getExtension(
    value
  ) {

    const clean =
      String(
        value ||
        ""
      )
        .split("?")[0]
        .split("#")[0];


    const parts =
      clean.split(".");


    return parts.length > 1
      ? parts
          .pop()
          .toLowerCase()
      : "";

  }


  function showError(
    message
  ) {

    setStatus(
      message
    );

  }


  function setStatus(
    message
  ) {

    if (statusElement) {

      statusElement.textContent =
        message;

    }

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
