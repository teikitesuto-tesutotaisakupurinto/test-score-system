
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定

   box_type のDB制約
   ---------------------------------------------------------
   answer
   qr
   student_no
   name
   other

   box_role
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

   この画面では
   ---------------------------------------------------------
   ・配点を設定しない
   ・question_idを設定しない
   ・表示名を入力しない
   ・大問/小問は自動採番
   ・小問が大問内にある場合だけ親大問を設定
   ・小計が大問内にある場合だけ親大問を設定
   ・合計は独立
   ・QRは独立

   test_pages
   ---------------------------------------------------------
   image_pathを使用

   layout_boxes
   ---------------------------------------------------------
   page_noでtest_pagesと対応
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


  /* 新規枠作成 */

  let drawing = false;

  let drawingPointerId = null;

  let drawStart = null;

  let drawPage = null;

  let drawLayer = null;

  let drawPreview = null;


  /* 既存枠移動・リサイズ */

  let dragMode = null;

  let dragPointerId = null;

  let dragBoxId = null;

  let dragStart = null;

  let dragOriginal = null;


  /* PDF */

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
     ROLE
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


      /*
        イベント登録
      */

      setupEvents();


      /*
        枠設定パネルは
        最初から表示する。
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


    /*
      test_pages
    */

    const {
      data:
        pageData,
      error:
        pageError
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
            ascending:
              true
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
      data:
        boxData,
      error:
        boxError
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
        )
        .order(
          "sort_order",
          {
            ascending:
              true
          }
        );


    if (boxError) {

      throw boxError;

    }


    boxes =
      boxData || [];


    normalizeBoxes();


    /*
      既存データの親子関係を
      座標から再確認。
    */

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
            inferRole(
              box
            );

        }


        box.box_type =
          ROLE_INFO[
            box.box_role
          ]?.boxType ||
          "other";


        /*
          配点は後の画面で設定。
        */

        box.points =
          0;

      }
    );

  }


  /* =======================================================
     REBUILD HIERARCHY
  ======================================================= */

  function rebuildHierarchy() {

    /*
      まず大問番号
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

          updateParent(
            box
          );

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

          updateParent(
            box
          );

        }
      );


    renumberAll();

  }


  /* =======================================================
     RENDER ALL PAGES
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
        `ページ${page.page_no}の画像を取得できません。`
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
      .getContext(
        "2d"
      )
      .drawImage(
        image,
        0,
        0
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
     NEW BOX DRAWING
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


    const layer =
      drawLayer;


    const page =
      drawPage;


    const canvas =
      layer.parentElement
        ?.querySelector(
          "canvas"
        );


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


    const role =
      boxRole?.value ||
      "minor";


    /*
      状態解除
    */

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


    drawPreview =
      null;


    if (
      width < 8 ||
      height < 8
    ) {

      return;

    }


    const roleInfo =
      ROLE_INFO[
        role
      ] ||
      ROLE_INFO.other;


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
        roleInfo.boxType,

      label:
        "",

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
      まず追加。
      その後に親と番号を決める。
    */

    boxes.push(
      box
    );


    if (
      role ===
      "major"
    ) {

      renumberAll();

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

      renumberAll();

    }

    else {

      clearParent(
        box
      );

    }


    box.label =
      automaticLabel(
        box.box_role,
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


    updateAllLabels();

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


    drawingPointerId =
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


    setupBoxInteraction(
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
     BOX MOVE / RESIZE
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


        else if (
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
          小問・小計は
          移動中にも親判定。
        */

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
     GET SELECTED BOX
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
     APPLY SELECTED ROLE
  ======================================================= */

  function applySelectedBox() {

    const box =
      getSelectedBox();


    if (!box) {

      return;

    }


    const role =
      boxRole?.value ||
      box.box_role ||
      "other";


    if (
      !ROLE_INFO[
        role
      ]
    ) {

      return;

    }


    box.box_role =
      role;


    box.box_type =
      ROLE_INFO[
        role
      ].boxType;


    /*
      配点は後で設定。
    */

    box.points =
      0;


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

    updateRoleHelp();

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


    /*
      大問がない
      または外に出た
    */

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
     FIND PARENT MAJOR
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
      複数の大問に入っている場合、
      一番小さい大問を親にする。
    */

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


        return (
          areaA -
          areaB
        );

      }
    );


    return candidates[0];

  }


  /* =======================================================
     RENUMBER ALL
  ======================================================= */

  function renumberAll() {

    /*
      大問
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
      小問を親ごとに採番
    */

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
      大問外の小問
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

          } else {

            subtotal.parent_box_id =
              null;

            subtotal.major_no =
              null;

            subtotal.subtotal_group =
              null;

          }

        }
      );


    /*
      合計は必ず独立
    */

    boxes
      .filter(
        box =>
          box.box_role ===
          "total"
      )
      .forEach(
        total => {

          clearParent(
            total
          );

        }
      );


    /*
      QRも独立
    */

    boxes
      .filter(
        box =>
          box.box_role ===
          "qr"
      )
      .forEach(
        qr => {

          clearParent(
            qr
          );

        }
      );


    /*
      氏名・生徒番号・説明・その他も独立
    */

    boxes
      .filter(
        box =>
          [
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


    /*
      配点はこの画面では0
    */

    boxes.forEach(
      box => {

        box.points =
          0;

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

        return box?.minor_no
          ? `問${box.minor_no}`
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

        }
      );

  }


  /* =======================================================
     UPDATE BOX ELEMENT
  ======================================================= */

  function updateBoxElement(
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
        Number(
          box.x
        ) /
        pageWidth
      ) * 100}%`;


    element.style.top =
      `${(
        Number(
          box.y
        ) /
        pageHeight
      ) * 100}%`;


    element.style.width =
      `${(
        Number(
          box.width
        ) /
        pageWidth
      ) * 100}%`;


    element.style.height =
      `${(
        Number(
          box.height
        ) /
        pageHeight
      ) * 100}%`;

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


    /*
      子枠の親を解除
    */

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


    renumberAll();


    closeBoxPanel();


    updateAllLabels();

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

      /*
        保存前に必ず構造を再構築
      */

      rebuildHierarchy();


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


      /*
        既存枠削除
      */

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


      /*
        新規枠
      */

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

              /*
                CHECK制約
                answer / qr / student_no /
                name / other
              */

              box_type:
                ROLE_INFO[
                  box.box_role
                ]?.boxType ||
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
                配点は後設定
              */

              points:
                0,

              /*
                設問IDは使用しない
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


    const allowedTypes =
      [
        "answer",
        "qr",
        "student_no",
        "name",
        "other"
      ];


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
          Number(
            box.width
          ) <= 0 ||
          Number(
            box.height
          ) <= 0
        ) {

          throw new Error(
            "枠サイズが不正です。"
          );

        }


        const type =
          ROLE_INFO[
            box.box_role
          ]?.boxType ||
          "other";


        if (
          !allowedTypes.includes(
            type
          )
        ) {

          throw new Error(
            `box_type「${type}」はDB制約で使用できません。`
          );

        }


        /*
          親がある場合
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
          合計は独立
        */

        if (
          box.box_role ===
            "total" &&
          box.parent_box_id
        ) {

          throw new Error(
            "合計は大問に所属できません。"
          );

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
            "QRは大問に所属できません。"
          );

        }

      }
    );

  }


  /* =======================================================
     ROLE HELP
  ======================================================= */

  function updateRoleHelp() {

    if (!parentInfo) {

      return;

    }


    const box =
      getSelectedBox();


    const role =
      box?.box_role ||
      boxRole?.value ||
      "minor";


    switch (
      role
    ) {

      case "major":

        parentInfo.textContent =
          "大問の範囲をドラッグしてください。";

        break;


      case "minor":

        if (box) {

          const parent =
            findContainingMajor(
              box
            );


          parentInfo.textContent =
            parent
              ? `大問${parent.major_no}の小問です。`
              : "大問の外にある小問です。";

        } else {

          parentInfo.textContent =
            "大問の内側に置いた小問だけ、その大問に登録されます。";

        }

        break;


      case "subtotal":

        if (box) {

          const parent =
            findContainingMajor(
              box
            );


          parentInfo.textContent =
            parent
              ? `大問${parent.major_no}の小計です。`
              : "大問の外にある小計です。";

        } else {

          parentInfo.textContent =
            "大問の内側に置くと、その大問の小計になります。";

        }

        break;


      case "total":

        parentInfo.textContent =
          "全体の合計です。大問には所属しません。";

        break;


      case "qr":

        parentInfo.textContent =
          "生徒特定用QRコードの読み取り範囲です。";

        break;


      case "name":

        parentInfo.textContent =
          "氏名の読み取り範囲です。";

        break;


      case "student_no":

        parentInfo.textContent =
          "生徒番号の読み取り範囲です。";

        break;


      case "instruction":

        parentInfo.textContent =
          "説明・指示などの範囲です。";

        break;


      default:

        parentInfo.textContent =
          "その他の範囲です。";

        break;

    }

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyboard(
    event
  ) {

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

      if (
        selectedBoxId
      ) {

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
            () => {

              reject(
                new Error(
                  "PDF.jsの読み込みに失敗しました。"
                )
              );

            };


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


  /* =======================================================
     PDF
  ======================================================= */

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
      pageNo <=
        pdf.numPages;
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

      showError(
        "テストIDが取得できません。"
      );

      return;

    }


    if (!answerFile) {

      showError(
        "解答用紙入力欄が見つかりません。"
      );

      return;

    }


    const file =
      answerFile.files?.[0];


    if (!file) {

      showError(
        "解答用紙を選択してください。"
      );

      return;

    }


    const extension =
      getExtension(
        file.name
      );


    const allowed =
      [
        "pdf",
        "jpg",
        "jpeg",
        "png",
        "webp"
      ];


    if (
      !allowed.includes(
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


      /*
        ===================================================
        1. ページ化
        ===================================================
      */

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
        ===================================================
        2. Storage保存
        ===================================================
      */

      const uploaded =
        [];


      for (
        let i = 0;
        i < pageImages.length;
        i++
      ) {

        const page =
          pageImages[i];


        const pageNo =
          i + 1;


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


        setStatus(
          `解答用紙を保存しています... ${pageNo}/${pageImages.length}`
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

                cacheControl:
                  "3600",

                upsert:
                  true
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
            page.height

        });

      }


      /*
        ===================================================
        3. Storage確認
        ===================================================
      */

      for (
        const item
        of uploaded
      ) {

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
              item.path,
              300
            );


        if (error) {

          throw new Error(
            `ページ${item.pageNo}をStorageから確認できません: ${
              error.message
            }`
          );

        }


        if (
          !data?.signedUrl
        ) {

          throw new Error(
            `ページ${item.pageNo}の画像URLを取得できません。`
          );

        }

      }


      /*
        ===================================================
        4. DBの旧ページ削除
        ===================================================
      */

      const {
        error:
          oldPageDeleteError
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


      if (oldPageDeleteError) {

        throw new Error(
          `既存の解答用紙情報を削除できません: ${
            oldPageDeleteError.message
          }`
        );

      }


      /*
        ===================================================
        5. 旧枠削除
        ===================================================
      */

      const {
        error:
          oldBoxDeleteError
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


      if (oldBoxDeleteError) {

        throw new Error(
          `既存の枠設定を削除できません: ${
            oldBoxDeleteError.message
          }`
        );

      }


      /*
        ===================================================
        6. test_pages登録
        ===================================================
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
              file.name

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
          .select(`
            id,
            test_id,
            page_no,
            image_path,
            width_px,
            height_px,
            original_name
          `);


      if (insertError) {

        throw new Error(
          `解答用紙ページの登録に失敗しました: ${
            insertError.message
          }`
        );

      }


      if (
        !insertedPages ||
        insertedPages.length !==
          uploaded.length
      ) {

        throw new Error(
          "解答用紙ページの登録件数が一致しません。"
        );

      }


      /*
        ===================================================
        7. ファイル入力をリセット
        ===================================================
      */

      answerFile.value =
        "";


      selectedBoxId =
        null;


      boxes =
        [];


      /*
        ===================================================
        8. 再読込
        ===================================================
      */

      await loadLayout();


      setStatus(
        `解答用紙を登録しました（${insertedPages.length}ページ）。`
      );


    } catch (error) {

      console.error(
        "解答用紙登録エラー:",
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
     PDF / IMAGE HELPERS
  ======================================================= */

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


    return (
      parts.length > 1
        ? parts
            .pop()
            .toLowerCase()
        : ""
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


  /* =======================================================
     PDF.JS
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
     PDF
  ======================================================= */

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
      pageNo <=
        pdf.numPages;
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
     STATUS
  ======================================================= */

  function setStatus(
    message
  ) {

    if (statusElement) {

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
