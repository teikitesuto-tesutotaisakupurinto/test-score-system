/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定
   ---------------------------------------------------------
   ・PDF / 画像アップロード
   ・test-files Storage
   ・test_pages
   ・layout_boxes
   ・大問 / 小問 / 解答欄 / QR / 小計 / 合計
   ・氏名 / 生徒番号 / 説明 / その他
   ・手動ドラッグ
   ・移動
   ・リサイズ
   ・削除
   ・自動枠検出
   ・検出候補クリック
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
     LOAD
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


    /*
     * layout_boxes
     *
     * 階層用カラムが存在する環境に対応。
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

          <br><br>

          PDFまたは画像を登録してください。

        </div>

      `;

      return;

    }


    for (
      const page of pages
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
     IMAGE
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
     MANUAL DRAW
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


    if (
      role === "minor" ||
      role === "subtotal"
    ) {

      updateParent(
        box
      );

    }


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
          event.target === resize
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


        updateBoxElement(
          element,
          page,
          box
        );

      }
    );


    element.addEventListener(
      "pointerup",
      finishDrag
    );


    element.addEventListener(
      "pointercancel",
      finishDrag
    );


    function finishDrag(
      event
    ) {

      if (
        event.pointerId !==
        dragPointerId
      ) {

        return;

      }


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


      rebuildHierarchy();

      updateAllLabels();

    }

  }


  function updateBoxElement(
    element,
    page,
    box
  ) {

    const scale =
      getPageScale(
        element.parentElement,
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

  async function waitForOpenCV(timeoutMs = 10000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const library = window.cv;
      if (
        library &&
        typeof library.Mat === "function" &&
        typeof library.imread === "function"
      ) {
        return library;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }


  async function detectAllPages() {

    if (!pages.length) {
      setStatus(
        "先に解答用紙を登録してください。",
        true
      );
      return;
    }

    setStatus("自動検出エンジンを初期化しています...");
    const cvLibrary = await waitForOpenCV();

    if (!cvLibrary) {
      candidates = [];
      await renderAllPages();
      setStatus(
        "自動検出エンジンを初期化できませんでした。手動ドラッグで枠を設定してください。",
        true
      );
      return;
    }

    candidates = [];
    setStatus("枠を自動検出しています...");

    for (const page of pages) {
      try {
        const detected = await detectPage(page);
        candidates.push(...detected);
      } catch (error) {
        console.warn("detect page:", error);
      }
    }

    await renderAllPages();

    setStatus(
      candidates.length
        ? `自動検出 ${candidates.length}個。赤い候補をクリックしてください。`
        : "自動検出できる枠がありません。手動ドラッグで設定してください。"
    );
  }


  async function detectPage(
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
          600
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      throw new Error(
        `P${page.page_no}画像を取得できません。`
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
          contours.get(i);


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

        } finally {

          approx.delete();

        }


        contour.delete();

      }


    } finally {

      src.delete();

      gray.delete();

      binary.delete();

      contours.delete();

      hierarchy.delete();

    }


    return deduplicate(
      result
    ).slice(
      0,
      300
    );

  }


  function deduplicate(
    list
  ) {

    const result =
      [];


    for (
      const item of list
    ) {

      const duplicate =
        result.some(
          existing =>
            existing.pageNo ===
            item.pageNo &&
            overlap(
              existing,
              item
            ) > 0.7
        );


      if (!duplicate) {

        result.push(
          item
        );

      }

    }


    return result;

  }


  function overlap(
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
        a.x + a.width,
        b.x + b.width
      );


    const bottom =
      Math.min(
        a.y + a.height,
        b.y + b.height
      );


    if (
      right <= left ||
      bottom <= top
    ) {

      return 0;

    }


    const intersection =
      (
        right - left
      ) *
      (
        bottom - top
      );


    return (
      intersection /
      Math.min(
        a.width * a.height,
        b.width * b.height
      )
    );

  }


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
        candidate.x /
        pageWidth *
        100
      }%`;


    element.style.top =
      `${
        candidate.y /
        pageHeight *
        100
      }%`;


    element.style.width =
      `${
        candidate.width /
        pageWidth *
        100
      }%`;


    element.style.height =
      `${
        candidate.height /
        pageHeight *
        100
      }%`;


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

    const wasAnswerBox =
      box.box_type === "answer";

    box.box_role =
      role;


    box.box_type =
      info.boxType;


    box.label =
      info.label;


    box.points =
      info.boxType === "answer"
        ? (wasAnswerBox ? (Number(box.points) || 0) : 0)
        : null;

    box.question_id =
      role === "answer" && info.boxType === "answer"
        ? (box.question_id || null)
        : null;


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
          box.parent_box_id === id
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


  function findContainingMajor(
    box
  ) {

    const center =
      getCenter(
        box
      );


    return (
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
          ) =>
            (
              Number(a.width) *
              Number(a.height)
            ) -
            (
              Number(b.width) *
              Number(b.height)
            )
        )[0] ||
      null
    );

  }


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
        clearParent
      );

  }


  /* =======================================================
     LABEL
  ======================================================= */

  function automaticLabel(
    role,
    box
  ) {

    switch (role) {

      case "major":

        return `大問${box.major_no || "?"}`;


      case "minor":

        return box.major_no &&
          box.minor_no
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
      setStatus("テストIDがありません。", true);
      return;
    }
    if (saveButton) saveButton.disabled = true;
    try {
      rebuildHierarchy();
      validateBoxes();

      // 既存IDを維持してupsertする。親子枠の参照IDも維持され、
      // 保存失敗時に既存枠を先に消してしまう事故を防ぐ。
      const rows = boxes
        .slice()
        .sort(compareBoxes)
        .map((box, index) => {
          const info = ROLE_INFO[box.box_role] || ROLE_INFO.other;
          if (!isUuid(box.id)) {
            throw new Error("枠IDが不正です。画面を再読み込みしてからやり直してください。");
          }
          return {
            id: box.id,
            test_id: selectedTestId,
            page_no: Number(box.page_no) || 1,
            box_type: info.boxType,
            label: automaticLabel(box.box_role, box),
            x: Number(box.x) || 0,
            y: Number(box.y) || 0,
            width: Number(box.width) || 0,
            height: Number(box.height) || 0,
            question_id: box.box_role === 'answer' ? (box.question_id || null) : null,
            points: info.boxType === "answer" ? Number(box.points) || 0 : null,
            parent_box_id: isUuid(box.parent_box_id) ? box.parent_box_id : null,
            major_no: box.major_no || null,
            minor_no: box.minor_no || null,
            box_role: box.box_role || "other",
            sort_order: index,
            subtotal_group: Number.isInteger(Number(box.subtotal_group)) && box.subtotal_group !== null && box.subtotal_group !== '' ? Number(box.subtotal_group) : null
          };
        });

      setStatus("枠設定を保存しています...");
      if (rows.length) {
        const { error: upsertError } = await supabaseClient
          .from("layout_boxes")
          .upsert(rows, { onConflict: "id" });
        if (upsertError) throw upsertError;
      }

      // 新しい枠の保存がすべて成功してから、画面上で削除された枠だけを削除。
      const keepIds = new Set(rows.map(row => row.id));
      const removedIds = boxes
        .filter(box => isUuid(box.id) && !keepIds.has(box.id))
        .map(box => box.id);

      // boxes配列には現在の枠しかないため、DB上の既存枠との差分を再取得。
      const { data: persisted, error: persistedError } = await supabaseClient
        .from("layout_boxes")
        .select("id")
        .eq("test_id", selectedTestId);
      if (persistedError) throw persistedError;

      const desiredIds = new Set(rows.map(row => row.id));
      const staleIds = (persisted || [])
        .map(row => row.id)
        .filter(id => !desiredIds.has(id));

      for (const id of staleIds) {
        const { error: deleteError } = await supabaseClient
          .from("layout_boxes")
          .delete()
          .eq("id", id)
          .eq("test_id", selectedTestId);
        if (deleteError) {
          throw new Error("削除対象の枠を整理できませんでした。採点データが紐付いている可能性があります。既存データを保護するため削除を中止しました。");
        }
      }

      await loadLayout();
      setStatus(`枠設定を保存しました。${rows.length}個の枠を登録しました。`);
    } catch (error) {
      console.error("saveBoxes:", error);
      showError(error.message || "枠設定を保存できませんでした。");
    } finally {
      if (saveButton) saveButton.disabled = false;
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


          if (
            !parent ||
            parent.box_role !==
            "major"
          ) {

            throw new Error(
              "親大問が不正です。"
            );

          }

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


    const messages = {

      major:
        "大問の範囲をドラッグしてください。",

      minor:
        "大問の内側に置くと、その大問の小問になります。",

      answer:
        "解答欄の範囲をドラッグしてください。",

      qr:
        "この範囲だけを答案アップロード時のQR読み取りに使用します。",

      subtotal:
        "大問の内側に置くと、その大問の小計になります。",

      total:
        "テスト全体の合計です。",

      name:
        "氏名の読み取り範囲です。",

      student_no:
        "生徒番号の読み取り範囲です。",

      instruction:
        "説明・指示の範囲です。",

      other:
        "その他の範囲です。"

    };


    parentInfo.textContent =
      messages[role] ||
      messages.other;

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
     * 「閉じる」でツール自体を消す。
     * 再び枠を選択したら開く。
     */

    boxPanel.style.display =
      "none";

  }


  /* =======================================================
     STYLE
  ======================================================= */

  function applyRoleStyle(
    element,
    role
  ) {

    element.style.border =
      "2px solid #666";


    element.style.background =
      "rgba(0,0,0,.04)";


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

    }


    switch (role) {

      case "major":

        element.style.border =
          "3px solid #2468a8";

        break;


      case "minor":

        element.style.border =
          "2px solid #d00000";

        break;


      case "qr":

        element.style.border =
          "3px dashed #333";

        break;


      case "name":

      case "student_no":

        element.style.border =
          "2px solid #26734d";

        break;


      case "subtotal":

        element.style.border =
          "2px dashed #555";

        break;


      case "total":

        element.style.border =
          "3px double #333";

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

      dragMode =
        null;

      selectedBoxId =
        null;

      updateAllLabels();

    }

  }


  /* =======================================================
     GEOMETRY
  ======================================================= */

  function getPageScale(
    layer,
    page
  ) {

    const rect =
      layer.getBoundingClientRect();


    const sourceWidth =
      Number(
        page.width_px
      ) ||
      rect.width;


    if (
      !sourceWidth
    ) {

      return 1;

    }


    return (
      rect.width /
      sourceWidth
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
      point.x >= Number(box.x) &&
      point.y >= Number(box.y) &&
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


  function compareBoxes(
    a,
    b
  ) {

    const page =
      Number(a.page_no) -
      Number(b.page_no);


    if (page !== 0) {

      return page;

    }


    const y =
      Number(a.y) -
      Number(b.y);


    if (y !== 0) {

      return y;

    }


    return (
      Number(a.x) -
      Number(b.x)
    );

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
     FILE PARSER
  ======================================================= */

  async function fileToPages(
    file
  ) {

    const ext =
      getExtension(
        file.name
      );


    if (
      ext === "pdf"
    ) {

      return convertPdf(
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
        ext
      )
    ) {

      return [
        await convertImage(
          file
        )
      ];

    }


    throw new Error(
      "PDF、JPG、JPEG、PNG、WEBPのみ対応しています。"
    );

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
        .getContext("2d")
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

      setStatus(
        "テストIDが取得できません。",
        true
      );

      return;

    }


    const file =
      answerFile?.files?.[0];


    if (!file) {

      setStatus(
        "解答用紙ファイルを選択してください。",
        true
      );

      return;

    }


    uploadButton.disabled =
      true;


    try {

      const pageImages =
        await fileToPages(
          file
        );


      if (!pageImages.length) {

        throw new Error(
          "ページを取得できませんでした。"
        );

      }


      /*
       * 既存ページがある場合でも、
       * 新しいページ番号から追加。
       */

      let nextPageNo =
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
        const page
        of pageImages
      ) {

        const pageNo =
          nextPageNo++;


        const blob =
          await canvasToBlob(
            page.canvas,
            "image/png"
          );


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
          `解答用紙を保存しています... P${pageNo}`
        );


        const {
          error
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


        if (error) {

          throw error;

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
          inserted,
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
          .select();


      if (insertError) {

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


        throw insertError;

      }


      pages =
        [
          ...pages,
          ...(inserted || [])
        ];


      answerFile.value =
        "";


      candidates =
        [];


      await renderAllPages();


      /*
       * アップロード直後に自動検出。
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


  /* =======================================================
     UTIL
  ======================================================= */

  function getExtension(
    value
  ) {

    const clean =
      String(
        value || ""
      )
        .split("?")[0]
        .split("#")[0];


    const parts =
      clean.split(".");


    return (
      parts.length > 1
        ? parts.pop().toLowerCase()
        : ""
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

      case "answer": {
        const label = String(box.label || "").trim();
        if (/^大問/.test(label)) return "major";
        if (/^(?:小問|問)\s*\d/.test(label)) return "minor";
        return "answer";
      }

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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
