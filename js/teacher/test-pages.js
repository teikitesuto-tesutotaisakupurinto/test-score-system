
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙・枠設定

   box_type のDB制約
   ---------------------------------------------------------
   answer
   qr
   student_no
   name
   other

   枠の意味は box_role で管理
   ---------------------------------------------------------
   major       大問
   minor       小問
   qr          QR
   subtotal    小計
   total       合計
   name        氏名
   student_no  生徒番号
   instruction 説明
   other       その他

   親子関係
   ---------------------------------------------------------
   大問
    ├─ 小問
    ├─ 小問
    └─ 小計

   小問・小計は、
   その枠の中心が大問の内側にある場合だけ
   parent_box_id を設定する。

   大問が存在しない小問
   ---------------------------------------------------------
   parent_box_id = null
   major_no = null
   minor_no = null

   勝手に大問を生成しない。

   合計
   ---------------------------------------------------------
   parent_box_id = null

   QR
   ---------------------------------------------------------
   parent_box_id = null

   配点
   ---------------------------------------------------------
   この画面では設定しない。
   常に0で保存。

   設問ID
   ---------------------------------------------------------
   この画面では使用しない。
   常にnull。

   ページ
   ---------------------------------------------------------
   test_pages.image_path
   layout_boxes.page_no
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
     ROLE DEFINITION
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
      () => {

        /*
          新規作成前の種類変更。
          選択中なら既存枠にも反映可能。
        */

        updateRoleHelp();

      }
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


        /*
          DB CHECK制約に合わせて
          box_typeを正規化。
        */

        box.box_type =
          ROLE_INFO[
            box.box_role
          ]?.boxType ||
          "other";


        /*
          この画面では配点を設定しない。
        */

        box.points =
          0;

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

        /*
          既存枠上なら新規作成しない。
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
          ドラッグ開始直後に仮枠。
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


    const scaleX =
      canvas
        ? canvas.width /
          canvas.getBoundingClientRect()
            .width
        : 1;


    const scaleY =
      canvas
        ? canvas.height /
          canvas.getBoundingClientRect()
            .height
        : 1;


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
        DB CHECK制約に
        必ず合う値。
      */

      box_type:
        ROLE_INFO[
          role
        ]?.boxType ||
        "other",

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
        この画面では配点しない。
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
      親子関係。
    */

    assignHierarchy(
      box
    );


    /*
      ラベルは自動。
    */

    box.label =
      automaticLabel(
        role,
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


    renumberAll();


    updateAllLabels();

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

    element.style.border = "";
    element.style.background = "";


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


    element.style.border =
      "2px solid #666";

    element.style.background =
      "rgba(0,0,0,.03)";

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


        dragBoxId =
          box.id;


        dragPointerId =
          event.pointerId;


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
          event.pointerId !==
            dragPointerId ||
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


        /*
          小問・小計の親を再判定。
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
     UPDATE PARENT
  ======================================================= */

  function updateParent(
    box
  ) {

    /*
      小問・小計とも
      大問の中心を親として判定。
    */

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
        getMinorNumber(
          box,
          parent.id
        );

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
      入れ子があった場合は
      最も小さい大問。
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
     MINOR NUMBER
  ======================================================= */

  function getMinorNumber(
    box,
    parentId
  ) {

    const children =
      boxes
        .filter(
          candidate =>
            candidate.box_role ===
              "minor" &&
            candidate.parent_box_id ===
              parentId &&
            candidate.id !==
              box.id
        )
        .sort(
          compareBoxes
        );


    return (
      children.length +
      1
    );

  }


  /* =======================================================
     RENumber
  ======================================================= */

  function renumberAll() {

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

      }
    );


    /*
      小問
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
      大問の外にある小問は
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
      全枠の配点は0。
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
        box?.major_no || "?"
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
     APPLY ROLE
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
      "minor";


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
      配点は設定しない。
    */

    box.points =
      0;


    /*
      この画面では
      question_idを扱わない。
    */


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
      子小問・小計の親を解除。
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
            ? `大問${parent.major_no}の小問`
            : "大問の外にある小問";

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
            ? `大問${parent.major_no}の小計`
            : "大問の外にある小計";

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
      "この枠を設定します。";

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


      /*
        並び順
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
        保存
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
                CHECK制約:
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
                配点は後で設定
              */

              points:
                0,

              /*
                設問IDは使わない
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
            "枠サイズが不正です。"
          );

        }


        /*
          box_typeをチェック。
        */

        const allowed =
          [
            "answer",
            "qr",
            "student_no",
            "name",
            "other"
          ];


        if (
          !allowed.includes(
            ROLE_INFO[
              box.box_role
            ]?.boxType
          )
        ) {

          throw new Error(
            `${box.box_role}のbox_typeが不正です。`
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
              "親は大問でなければなりません。"
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
     CLOSE
  ======================================================= */

  function closeBoxPanel() {

    boxPanel?.classList.remove(
      "open"
    );

  }


  /* =======================================================
     OPEN
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
        Number(box.x) +
        Number(box.width) /
        2,

      y:
        Number(box.y) +
        Number(box.height) /
        2

    };

  }


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
     PDF → PAGES
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
     IMAGE → PAGE
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
        DB上の旧ページ削除
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
        ページを変更するため
        旧枠も削除。
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


      answerFile.value =
        "";


      selectedBoxId =
        null;


      await loadLayout();


      setStatus(
        "解答用紙を登録しました。枠種類を選択して設定してください。"
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
     CANVAS POSITION
  ======================================================= */

  function updateBoxElement(
    element,
    page,
    box
  ) {

    const width =
      Number(
        page.width_px
      );


    const height =
      Number(
        page.height_px
      );


    if (
      !width ||
      !height
    ) {

      return;

    }


    element.style.left =
      `${(
        Number(box.x) /
        width
      ) * 100}%`;


    element.style.top =
      `${(
        Number(box.y) /
        height
      ) * 100}%`;


    element.style.width =
      `${(
        Number(box.width) /
        width
      ) * 100}%`;


    element.style.height =
      `${(
        Number(box.height) /
        height
      ) * 100}%`;

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
