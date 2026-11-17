/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

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
    document.getElementById(
      "deleteSelectedButton"
    );

  const closePanelButton =
    document.getElementById(
      "closePanelButton"
    );

  const detectButton =
    document.getElementById(
      "detectButton"
    );

  const detectButtonTop =
    document.getElementById(
      "detectButtonTop"
    );


  /* =======================================================
     DB TYPES
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

    answer: {
      label: "解答欄",
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

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      const auth =
        await requireRole("teacher");


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
          window.location.search
        );


      selectedTestId =
        params.get("test") ||
        window.__TEST_ID__ ||
        null;


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


    detectButton?.addEventListener(
      "click",
      detectAllPages
    );


    detectButtonTop?.addEventListener(
      "click",
      detectAllPages
    );


    document
      .getElementById("logoutButton")
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


  /* =======================================================
     LOAD LAYOUT
  ======================================================= */

  async function loadLayout() {

    setStatus(
      "解答用紙と枠設定を読み込んでいます..."
    );


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

      throw new Error(
        `解答用紙の取得に失敗しました: ${pageError.message}`
      );

    }


    pages =
      pageData || [];


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

      throw new Error(
        `枠設定の取得に失敗しました: ${boxError.message}`
      );

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
      `解答用紙 ${pages.length}ページ、枠 ${boxes.length}個を読み込みました。`
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


        const info =
          ROLE_INFO[
            box.box_role
          ] ||
          ROLE_INFO.other;


        box.box_type =
          info.boxType;


        box.x =
          Number(box.x) || 0;


        box.y =
          Number(box.y) || 0;


        box.width =
          Number(box.width) || 10;


        box.height =
          Number(box.height) || 10;


        box.points =
          info.boxType === "answer"
            ? Number(box.points) || 0
            : null;


        box.question_id =
          null;

      }
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


  function selectBox(
    id
  ) {

    selectedBoxId =
      id;


    const box =
      getSelectedBox();


    if (
      box &&
      boxRole
    ) {

      boxRole.value =
        box.box_role;

    }


    updateAllLabels();

    updateRoleHelp();

    openBoxPanel();

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


  /* =======================================================
     CREATE PAGE IMAGE
  ======================================================= */

  async function createPageImage(
    page
  ) {

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


    image.alt =
      `解答用紙 ${page.page_no}ページ`;


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
          event.pointerType !== "touch"
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


  /* =======================================================
     FINISH DRAWING
  ======================================================= */

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
      width < 8 ||
      height < 8
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
        info.boxType === "answer"
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


    rebuildHierarchy();


    selectedBoxId =
      box.id;


    await renderAllPages();


    setStatus(
      `${automaticLabel(
        role,
        box
      )}を追加しました。`
    );

  }


  /* =======================================================
     CANCEL DRAWING
  ======================================================= */

  function cancelDrawing() {

    drawPreview?.remove();


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


    const scale =
      getPageScale(
        layer,
        page
      );


    element.style.left =
      `${Number(box.x) * scale}px`;


    element.style.top =
      `${Number(box.y) * scale}px`;


    element.style.width =
      `${Number(box.width) * scale}px`;


    element.style.height =
      `${Number(box.height) * scale}px`;


    applyRoleStyle(
      element,
      box.box_role
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
          resize
            ? "resize"
            : "move";


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
            Number(box.x),

          y:
            Number(box.y),

          width:
            Number(box.width),

          height:
            Number(box.height)

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
          dragBoxId !== box.id ||
          dragPointerId !==
          event.pointerId
        ) {

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


        updateBoxElement(
          element,
          page,
          box
        );

      }
    );


    element.addEventListener(
      "pointerup",
      finishBoxDrag
    );


    element.addEventListener(
      "pointercancel",
      finishBoxDrag
    );


    function finishBoxDrag(
      event
    ) {

      if (
        event.pointerId !==
        dragPointerId
      ) {

        return;

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


      rebuildHierarchy();


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

  }


  /* =======================================================
     UPDATE BOX ELEMENT
  ======================================================= */

  function updateBoxElement(
    element,
    page,
    box
  ) {

    const layer =
      element.parentElement;


    const scale =
      getPageScale(
        layer,
        page
      );


    element.style.left =
      `${Number(box.x) * scale}px`;


    element.style.top =
      `${Number(box.y) * scale}px`;


    element.style.width =
      `${Number(box.width) * scale}px`;


    element.style.height =
      `${Number(box.height) * scale}px`;

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
          await detectPage(
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
          "自動検出できる枠がありません。手動ドラッグで設定してください。"
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
     DETECT PAGE
  ======================================================= */

  async function detectPage(
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
     * OpenCV.jsが利用できる場合のみ
     * 輪郭検出を使用。
     *
     * OpenCVが無くても、
     * 手動ドラッグには影響しない。
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


    return [];

  }


  /* =======================================================
     OPENCV
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


        const approx =
          new cv.Mat();


        try {

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


          const ratio =
            rect.width /
            Math.max(
              1,
              rect.height
            );


          if (
            approx.rows < 4 ||
            approx.rows > 6
          ) {

            continue;

          }


          if (
            area <
            imageArea *
            0.0002
          ) {

            continue;

          }


          if (
            area >
            imageArea *
            0.35
          ) {

            continue;

          }


          if (
            ratio < 0.15 ||
            ratio > 8
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


          const duplicate =
            result.some(
              existing =>
                overlapRatio(
                  existing,
                  candidate
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

          approx.delete();

        }


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

      binary.delete();

      contours.delete();

      hierarchy.delete();

    }

  }


  /* =======================================================
     CANDIDATE
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
      ) ||
      1;


    const pageHeight =
      Number(
        page.height_px
      ) ||
      1;


    element.style.left =
      `${
        Number(candidate.x) /
        pageWidth *
        100
      }%`;


    element.style.top =
      `${
        Number(candidate.y) /
        pageHeight *
        100
      }%`;


    element.style.width =
      `${
        Number(candidate.width) /
        pageWidth *
        100
      }%`;


    element.style.height =
      `${
        Number(candidate.height) /
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


    candidates =
      candidates.filter(
        item =>
          item.id !==
          candidate.id
      );


    rebuildHierarchy();


    selectedBoxId =
      box.id;


    await renderAllPages();


    setStatus(
      `${automaticLabel(
        box.box_role,
        box
      )}として枠を作成しました。`
    );

  }


  /* =======================================================
     APPLY
  ======================================================= */

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


    box.box_role =
      role;


    box.box_type =
      info.boxType;


    box.label =
      info.label;


    box.points =
      info.boxType ===
      "answer"
        ? 0
        : null;


    box.question_id =
      null;


    if (
      role === "minor" ||
      role === "subtotal"
    ) {

      updateParent(
        box
      );

    } else {

      clearParent(
        box
      );

    }


    rebuildHierarchy();


    renderAllPages();


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


    const id =
      selectedBoxId;


    boxes =
      boxes.filter(
        box =>
          box.id !== id
      );


    boxes.forEach(
      box => {

        if (
          box.parent_box_id ===
          id
        ) {

          clearParent(
            box
          );

        }

      }
    );


    selectedBoxId =
      null;


    rebuildHierarchy();


    renderAllPages();


    setStatus(
      "選択枠を削除しました。保存するとDBにも反映されます。"
    );

  }
   /* =======================================================
   HIERARCHY
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
   FIND CONTAINING MAJOR
======================================================= */

function findContainingMajor(
  box
) {

  const center =
    getCenter(
      box
    );


  const majors =
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
      )
      .sort(
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


  return (
    majors[0] ||
    null
  );

}


/* =======================================================
   REBUILD HIERARCHY
======================================================= */

function rebuildHierarchy() {

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


  /*
   * 大問番号
   */

  majors.forEach(
    (
      major,
      index
    ) => {

      major.major_no =
        index + 1;

      clearParent(
        major
      );

    }
  );


  /*
   * 小問・小計の親を再判定
   */

  boxes
    .filter(
      box =>
        box.box_role ===
          "minor" ||
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


  /*
   * 小問番号
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
   * 大問外の小問
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
   * その他の独立枠
   */

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
        box.major_no ||
        "?"
      }`;


    case "minor":

      return (
        box.major_no &&
        box.minor_no
      )
        ? `問${box.major_no}-${box.minor_no}`
        : "小問";


    case "answer":

      return "解答欄";


    case "qr":

      return "QR";


    case "subtotal":

      return box.major_no
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


  saveButton.disabled =
    true;


  try {

    rebuildHierarchy();


    boxes.sort(
      compareBoxes
    );


    validateBoxes();


    setStatus(
      "枠設定を保存しています..."
    );


    /*
     * 現在のテストの枠を全削除。
     * test_pages は削除しない。
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
     * 再登録。
     *
     * 一時UUIDはDBへ送らない。
     */

    if (
      boxes.length
    ) {

      const rows =
        boxes.map(
          (
            box,
            index
          ) => {

            const info =
              ROLE_INFO[
                box.box_role
              ] ||
              ROLE_INFO.other;


            return {

              test_id:
                selectedTestId,

              page_no:
                Number(
                  box.page_no
                ) || 1,

              box_type:
                info.boxType,

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
                info.boxType ===
                  "answer"
                  ? Number(
                      box.points
                    ) || 0
                  : null,

              parent_box_id:
                isUuid(
                  box.parent_box_id
                )
                  ? box.parent_box_id
                  : null,

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
                index,

              subtotal_group:
                box.subtotal_group ||
                null

            };

          }
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


    /*
     * DBから再取得。
     *
     * これで「画面では出るが
     * 再読み込みすると消える」
     * 問題を防ぐ。
     */

    await loadLayout();


    setStatus(
      `枠設定を保存しました。${boxes.length}個の枠を登録しました。`
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


      if (
        !ROLE_INFO[
          box.box_role
        ]
      ) {

        throw new Error(
          `不明な枠種類です: ${box.box_role}`
        );

      }


      if (
        box.parent_box_id
      ) {

        const parent =
          boxes.find(
            item =>
              item.id ===
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


      if (
        box.box_role ===
          "qr" &&
        box.parent_box_id
      ) {

        throw new Error(
          "QR枠は大問に所属できません。"
        );

      }


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
    "answer";


  switch (
    role
  ) {

    case "major":

      parentInfo.textContent =
        "大問の範囲をドラッグしてください。";

      break;


    case "minor":

      parentInfo.textContent =
        "大問の内側に置いた小問は、その大問に自動所属します。";

      break;


    case "answer":

      parentInfo.textContent =
        "解答欄の範囲をドラッグしてください。";

      break;


    case "qr":

      parentInfo.textContent =
        "この範囲だけを答案アップロード時のQR読み取りに使用します。";

      break;


    case "subtotal":

      parentInfo.textContent =
        "大問の内側に置くと、その大問の小計になります。";

      break;


    case "total":

      parentInfo.textContent =
        "テスト全体の合計です。";

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
        "説明・指示の範囲です。";

      break;


    default:

      parentInfo.textContent =
        "その他の範囲です。";

      break;

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
   * 枠設定ツール自体は
   * 画面から消さない。
   *
   * 選択だけ解除。
   */

  selectedBoxId =
    null;


  updateAllLabels();

  updateRoleHelp();

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


    dragMode =
      null;


    dragPointerId =
      null;


    dragBoxId =
      null;


    selectedBoxId =
      null;


    updateAllLabels();

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
   STATUS
======================================================= */

function setStatus(
  message,
  isError = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    message;


  statusElement.style.color =
    isError
      ? "#b42318"
      : "";

}


function showError(
  message
) {

  setStatus(
    message,
    true
  );

}


/* =======================================================
   STYLE
======================================================= */

function applyRoleStyle(
  element,
  role
) {

  if (!element) {

    return;

  }


  element.style.border =
    "2px solid #666";


  element.style.background =
    "rgba(0,0,0,.04)";


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


    case "answer":

      element.style.border =
        "2px solid #1769aa";

      element.style.background =
        "rgba(23,105,170,.07)";

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
   UTIL
======================================================= */

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


})();
/* =======================================================
   FILE PARSER / UPLOAD
======================================================= */

async function parseInputFile(
  file
) {

  /*
   * 既存の共通ファイル解析エンジンを優先。
   */

  if (
    window.TEST_SCORE_FILES?.parseFile
  ) {

    const result =
      await window.TEST_SCORE_FILES
        .parseFile(
          file
        );


    return (
      result ||
      []
    ).map(
      page => ({

        pageNo:
          page.pageNo,

        name:
          page.name ||
          file.name,

        blob:
          page.blob,

        width:
          Number(
            page.width
          ) || 0,

        height:
          Number(
            page.height
          ) || 0

      })
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

    return convertPdfToBlobs(
      file
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
      await loadImageFromBlob(
        file
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
    "PDF、JPG、JPEG、PNG、WEBPのみ登録できます。"
  );

}


/* =======================================================
   PDF → BLOBS
======================================================= */

async function convertPdfToBlobs(
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
        scale:
          1
      });


    /*
     * A4程度の答案を
     * 十分な解像度で画像化。
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


    const context =
      canvas.getContext(
        "2d"
      );


    await page.render({

      canvasContext:
        context,

      viewport

    }).promise;


    const blob =
      await canvasToBlob(
        canvas,
        "image/png"
      );


    result.push({

      pageNo,

      name:
        file.name,

      blob,

      width:
        canvas.width,

      height:
        canvas.height

    });

  }


  return result;

}


/* =======================================================
   LOAD PDF.JS
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

          if (
            window.pdfjsLib
              .GlobalWorkerOptions
          ) {

            window.pdfjsLib
              .GlobalWorkerOptions
              .workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

          }


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
   IMAGE FROM BLOB
======================================================= */

function loadImageFromBlob(
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
              "画像を読み込めませんでした。"
            )
          );

        };


      image.src =
        url;

    }
  );

}


/* =======================================================
   IMAGE → PNG
======================================================= */

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
    "#ffffff";


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


  return canvasToBlob(
    canvas,
    "image/png"
  );

}


/* =======================================================
   CANVAS → BLOB
======================================================= */

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
        0.95
      );

    }
  );

}


/* =======================================================
   AUTO DETECTION HELPERS
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
   EXTENSION
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


/* =======================================================
   END
======================================================= */

})();
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


    /*
     * 1. ページ化
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
     * 既存の解答用紙を
     * 新しいファイルで置き換える。
     *
     * 既存ページ番号は1から振り直す。
     */

    const uploaded =
      [];


    for (
      let i = 0;
      i <
      pageImages.length;
      i++
    ) {

      const page =
        pageImages[i];


      const pageNo =
        i + 1;


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
        `解答用紙をStorageへ保存しています... ${pageNo}/${pageImages.length}`
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
          page.height

      });

    }


    /*
     * 2. Storage確認
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
            "test-files"
          )
          .createSignedUrl(
            item.path,
            300
          );


      if (
        error ||
        !data?.signedUrl
      ) {

        throw new Error(
          `ページ${item.pageNo}のStorage画像を確認できません。`
        );

      }

    }


    /*
     * 3. 既存test_pagesを削除
     *
     * layout_boxesより先に
     * test_pagesだけを削除する。
     */

    setStatus(
      "既存の解答用紙情報を更新しています..."
    );


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

      throw new Error(
        `既存の解答用紙情報を削除できません: ${
          pageDeleteError.message
        }`
      );

    }


    /*
     * 4. test_pages登録
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
     * 5. 画面側をリセット
     *
     * ここではlayout_boxesを
     * 削除しない。
     *
     * 新しい解答用紙なので
     * 枠だけは新しく設定する。
     */

    answerFile.value =
      "";


    selectedBoxId =
      null;


    boxes =
      [];


    candidates =
      [];


    /*
     * 6. DBから再読み込み
     */

    await loadLayout();


    /*
     * 7. 自動枠検出
     */

    setStatus(
      `解答用紙を登録しました（${insertedPages.length}ページ）。枠を自動検出しています...`
    );


    await detectAllPages();


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
