
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定エディタ 完全版

   ---------------------------------------------------------
   test_pages
   ---------------------------------------------------------
   id
   test_id
   page_no
   image_path
   width_px
   height_px
   created_at
   file_path
   file_type
   original_name

   ---------------------------------------------------------
   layout_boxes
   ---------------------------------------------------------
   id
   test_id
   page_no
   box_type
   label
   x
   y
   width
   height
   question_id
   created_at
   points
   parent_box_id
   major_no
   minor_no
   box_role
   sort_order
   subtotal_group

   ---------------------------------------------------------
   box_type CHECK制約
   ---------------------------------------------------------
   answer
   qr
   student_no
   name
   other

   ---------------------------------------------------------
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

   ---------------------------------------------------------
   ルール
   ---------------------------------------------------------
   ・大問 → box_type=answer
   ・小問 → box_type=answer
   ・QR → box_type=qr
   ・小計 → box_type=answer
   ・合計 → box_type=answer
   ・氏名 → box_type=name
   ・生徒番号 → box_type=student_no
   ・説明 → box_type=other
   ・その他 → box_type=other

   ・この画面では配点を設定しない
   ・pointsは0で保存
   ・question_idは使用しない
   ・question_idはnullで保存

   ---------------------------------------------------------
   親子関係
   ---------------------------------------------------------

   大問1
      ├ 問1
      ├ 問2
      └ 小計

   小問・小計を大問の内側に置いた場合だけ
   parent_box_idを設定。

   大問がない小問は
   major_no=null
   minor_no=null
   parent_box_id=null

   勝手に大問を生成しない。

   合計は独立。

   QRも独立。

   ---------------------------------------------------------
   操作
   ---------------------------------------------------------

   ・枠種類を選択
   ・解答用紙をドラッグ
   ・ドラッグ中は赤い仮枠をリアルタイム表示
   ・既存枠クリックで選択
   ・枠ドラッグで移動
   ・右下ハンドルでリサイズ
   ・Deleteキーで削除
   ・保存
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


  /*
    新規枠ドラッグ
  */

  let drawing = false;

  let drawingPointerId = null;

  let drawStart = null;

  let drawPage = null;

  let drawLayer = null;

  let drawPreview = null;


  /*
    既存枠移動・リサイズ
  */

  let dragMode = null;

  let dragPointerId = null;

  let dragBoxId = null;

  let dragStart = null;

  let dragOriginal = null;


  /*
    PDF.js
  */

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

      label:
        "大問",

      boxType:
        "answer"

    },

    minor: {

      label:
        "小問",

      boxType:
        "answer"

    },

    qr: {

      label:
        "QR",

      boxType:
        "qr"

    },

    subtotal: {

      label:
        "小計",

      boxType:
        "answer"

    },

    total: {

      label:
        "合計",

      boxType:
        "answer"

    },

    name: {

      label:
        "氏名",

      boxType:
        "name"

    },

    student_no: {

      label:
        "生徒番号",

      boxType:
        "student_no"

    },

    instruction: {

      label:
        "説明",

      boxType:
        "other"

    },

    other: {

      label:
        "その他",

      boxType:
        "other"

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


      /*
        URL:
        /teacher/tests/pages?test=UUID
      */

      selectedTestId =
        new URLSearchParams(
          window.location.search
        ).get(
          "test"
        ) ||
        window.__TEST_ID__ ||
        null;


      setupEvents();


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
      =====================================================
      test_pages
      =====================================================
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
      =====================================================
      layout_boxes
      =====================================================
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


    await renderAllPages();


    if (!pages.length) {

      setStatus(
        "先に解答用紙を登録してください。"
      );

      return;

    }


    setStatus(
      "枠種類を選択して、解答用紙上をドラッグしてください。"
    );

  }


  /* =======================================================
     NORMALIZE BOXES
  ======================================================= */

  function normalizeBoxes() {

    boxes.forEach(
      box => {

        /*
          古いデータにも対応
        */

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


        /*
          DB CHECK制約に
          必ず合わせる。
        */

        box.box_type =
          ROLE_INFO[
            box.box_role
          ]?.boxType ||
          "other";


        /*
          配点設定は後。

          この画面では常に0。
        */

        box.points =
          0;


        /*
          設問IDは使わない。
        */

      }
    );

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


    /*
      Storage
    */

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
     NEW BOX DRAWING
  ======================================================= */

  function setupDrawing(
    layer,
    page
  ) {

    layer.addEventListener(
      "pointerdown",
      event => {

        /*
          既存枠上なら
          新規枠を作らない。
        */

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


        layer.setPointerCapture(
          event.pointerId
        );


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


    /*
      表示座標 → 原画像座標
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


    /*
      状態を解除
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


    const role =
      boxRole?.value ||
      "minor";


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

      /*
        CHECK制約に合う値だけ。
      */

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

      /*
        配点は後設定。
      */

      points:
        0,

      /*
        設問IDは使用しない。
      */

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
      親大問判定
    */

    assignHierarchy(
      box
    );


    /*
      自動番号
    */

    renumberAll();


    /*
      ラベル
    */

    box.label =
      automaticLabel(
        box.box_role,
        box
      );


    boxes.push(
      box
    );


    /*
      push後にもう一度番号を整理
    */

    renumberAll();


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

  }


  /* =======================================================
     CANCEL
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
     STYLE
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
     MOVE / RESIZE
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


        element.setPointerCapture(
          event.pointerId
        );

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
          小問・小計の親を
          リアルタイム再判定。
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
     FINISH MOVE / RESIZE
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
     SELECTED
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
     APPLY
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


    /*
      CHECK制約対応。
    */

    box.box_type =
      ROLE_INFO[
        role
      ].boxType;


    /*
      この画面では配点なし。
    */

    box.points =
      0;


    /*
      大問
    */

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


    /*
      小問
    */

    else if (
      role ===
      "minor"
    ) {

      updateParent(
        box
      );

    }


    /*
      小計
    */

    else if (
      role ===
      "subtotal"
    ) {

      updateParent(
        box
      );

    }


    /*
      合計
      QR
      氏名
      生徒番号
      説明
      その他
    */

    else {

      box.parent_box_id =
        null;

      box.major_no =
        null;

      box.minor_no =
        null;

      box.subtotal_group =
        null;

    }


    renumberAll();


    updateAllLabels();

    updateRoleHelp();

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
      子枠の親を解除。
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

          child.subtotal_group =
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


    renumberAll();


    closeBoxPanel();


    updateAllLabels();

  }


  /* =======================================================
     HIERARCHY
  ======================================================= */

  function assignHierarchy(
    box
  ) {

    /*
      大問
    */

    if (
      box.box_role ===
      "major"
    ) {

      box.parent_box_id =
        null;

      box.major_no =
        null;

      box.minor_no =
        null;

      box.subtotal_group =
        null;

      return;

    }


    /*
      小問
    */

    if (
      box.box_role ===
      "minor"
    ) {

      const parent =
        findContainingMajor(
          box
        );


      if (parent) {

        box.parent_box_id =
          parent.id;

        box.major_no =
          parent.major_no;

        box.minor_no =
          null;

      } else {

        /*
          大問がなければ
          大問を作らない。
        */

        box.parent_box_id =
          null;

        box.major_no =
          null;

        box.minor_no =
          null;

      }


      box.subtotal_group =
        null;

      return;

    }


    /*
      小計
    */

    if (
      box.box_role ===
      "subtotal"
    ) {

      const parent =
        findContainingMajor(
          box
        );


      if (parent) {

        box.parent_box_id =
          parent.id;

        box.major_no =
          parent.major_no;

        box.subtotal_group =
          parent.major_no;

      } else {

        box.parent_box_id =
          null;

        box.major_no =
          null;

        box.subtotal_group =
          null;

      }


      box.minor_no =
        null;

      return;

    }


    /*
      その他は独立
    */

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

      box.parent_box_id =
        null;

      box.major_no =
        null;


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

        box.subtotal_group =
          null;

      }


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
      一番小さい大問を
      最も具体的な親として採用。
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
      大問ごとの小問
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
      大問外の小問は
      番号なし。
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
      この画面では
      配点を設定しない。
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

    if (
      role ===
      "major"
    ) {

      return `大問${
        box?.major_no ||
        "?"
      }`;

    }


    if (
      role ===
      "minor"
    ) {

      return box?.minor_no
        ? `問${box.minor_no}`
        : "小問";

    }


    if (
      role ===
      "qr"
    ) {

      return "QR";

    }


    if (
      role ===
      "subtotal"
    ) {

      if (
        box?.major_no
      ) {

        return `大問${box.major_no} 小計`;

      }

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
      "instruction"
    ) {

      return "説明";

    }


    return "その他";

  }


  /* =======================================================
     LABEL UPDATE
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


    if (
      role ===
      "major"
    ) {

      parentInfo.textContent =
        "大問の範囲を設定します。";

      return;

    }


    if (
      role ===
      "minor"
    ) {

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
          "大問の内側に置いた場合だけ、その大問の小問になります。";

      }

      return;

    }


    if (
      role ===
      "subtotal"
    ) {

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

      return;

    }


    if (
      role ===
      "total"
    ) {

      parentInfo.textContent =
        "全体の合計です。大問には所属しません。";

      return;

    }


    if (
      role ===
      "qr"
    ) {

      parentInfo.textContent =
        "生徒特定用QRコードの読み取り範囲です。";

      return;

    }


    if (
      role ===
      "name"
    ) {

      parentInfo.textContent =
        "氏名の読み取り範囲です。";

      return;

    }


    if (
      role ===
      "student_no"
    ) {

      parentInfo.textContent =
        "生徒番号の読み取り範囲です。";

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

      renumberAll();


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
        新規保存
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
                CHECK制約対応
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
                後の配点設定で設定する。
              */

              points:
                0,

              /*
                この画面では使わない。
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


    const allowedBoxTypes =
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
          !allowedBoxTypes.includes(
            type
          )
        ) {

          throw new Error(
            `box_type「${type}」は使用できません。`
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
              "小問・小計の親は大問でなければなりません。"
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
          大問
        */

        if (
          box.box_role ===
          "major"
        ) {

          if (
            box.parent_box_id
          ) {

            throw new Error(
              "大問に親枠は設定できません。"
            );

          }

        }


        /*
          合計
        */

        if (
          box.box_role ===
          "total"
        ) {

          if (
            box.parent_box_id
          ) {

            throw new Error(
              "合計は大問に所属できません。"
            );

          }

        }


        /*
          QR
        */

        if (
          box.box_role ===
          "qr"
        ) {

          if (
            box.parent_box_id
          ) {

            throw new Error(
              "QRは大問に所属できません。"
            );

          }

        }

      }
    );

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
      tag ===
        "INPUT" ||
      tag ===
        "TEXTAREA" ||
      tag ===
        "SELECT"
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

      case "qr":
        return "qr";

      case "student_no":
        return "student_no";

      case "name":
        return "name";

      case "answer":

        /*
          古いanswerデータは
          大問/小問を判定できないため
          小問として扱う。
        */

        return "minor";

      default:
        return "other";

    }

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
     OPEN PANEL
  ======================================================= */

  function openBoxPanel() {

    boxPanel?.classList.add(
      "open"
    );

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
     HELPERS
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


  function getPoint(
    event,
    rect
  ) {

    return {

      x:
        clamp(
          event.clientX -
            rect.left,
          0,
          rect.width
        ),

      y:
        clamp(
          event.clientY -
            rect.top,
          0,
          rect.height
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


  function compareBoxes(
    a,
    b
  ) {

    if (
      Number(
        a.page_no
      ) !==
      Number(
        b.page_no
      )
    ) {

      return (
        Number(
          a.page_no
        ) -
        Number(
          b.page_no
        )
      );

    }


    if (
      Number(
        a.y
      ) !==
      Number(
        b.y
      )
    ) {

      return (
        Number(
          a.y
        ) -
        Number(
          b.y
        )
      );

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


    return (
      parts.length > 1
        ? parts
            .pop()
            .toLowerCase()
        : ""
    );

  }


  /* =======================================================
     PDF.js
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


      /*
        解像度を大きくしすぎない。
      */

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
     
     重要
     -------------------------------------------------------
     Storage保存
       ↓
     Storage確認
       ↓
     DB test_pages更新
       ↓
     画面再読込

     以前のようにDBだけ残って
     Object not foundになる状態を防ぐ。
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
        !Array.isArray(
          pageImages
        ) ||
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


        if (!blob) {

          throw new Error(
            `ページ${pageNo}の画像作成に失敗しました。`
          );

        }


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

          console.error(
            "Storage upload:",
            uploadError
          );


          throw new Error(
            `ページ${pageNo}のStorage保存に失敗しました: ${
              uploadError.message ||
              "不明なエラー"
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

      setStatus(
        "保存した解答用紙を確認しています..."
      );


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
        4. DBの旧test_pages削除
        ===================================================
      */

      setStatus(
        "既存の解答用紙情報を更新しています..."
      );


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
        7. DB確認
        ===================================================
      */

      const {
        data:
          verifyPages,
        error:
          verifyError
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
            height_px
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


      if (verifyError) {

        throw new Error(
          `登録結果を確認できません: ${
            verifyError.message
          }`
        );

      }


      if (
        !verifyPages ||
        verifyPages.length === 0
      ) {

        throw new Error(
          "test_pagesに解答用紙が登録されていません。"
        );

      }


      /*
        ===================================================
        8. 入力リセット
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
        9. 再読込
        ===================================================
      */

      setStatus(
        "解答用紙を表示しています..."
      );


      await loadLayout();


      setStatus(
        `解答用紙を登録しました（${verifyPages.length}ページ）。`
      );


    } catch (error) {

      console.error(
        "================================"
      );

      console.error(
        "解答用紙登録エラー"
      );

      console.error(
        error
      );

      console.error(
        "================================"
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
     START
  ======================================================= */

  initialize();

})();
