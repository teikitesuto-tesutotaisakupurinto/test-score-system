/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙登録 + 枠設定エディタ
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

    answer: {
      label: "解答欄",
      boxType: "answer"
    },

    qr: {
      label: "QR",
      boxType: "qr"
    },

    student_no: {
      label: "生徒番号",
      boxType: "student_no"
    },

    name: {
      label: "氏名",
      boxType: "name"
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


      const profile =
        auth.profile;


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile?.name ||
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
      () => {

        window.location.href =
          "/teacher/tests";

      }
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
      (boxData || [])
        .filter(
          box =>
            ALLOWED_BOX_TYPES.includes(
              normalizeBoxType(
                box.box_type
              )
            )
        );


    normalizeBoxes();

    await renderAllPages();


    if (pages.length) {

      setStatus(
        "解答用紙を読み込みました。枠を追加・調整できます。"
      );

    } else {

      setStatus(
        "解答用紙を登録してください。"
      );

    }

  }


  /* =======================================================
     NORMALIZE BOXES
  ======================================================= */

  function normalizeBoxes() {

    boxes.forEach(
      box => {

        box.box_type =
          normalizeBoxType(
            box.box_type
          );


        if (
          box.points === null ||
          box.points === undefined
        ) {

          box.points =
            box.box_type ===
              "answer"
              ? 0
              : null;

        }


        if (
          box.x === null ||
          box.x === undefined
        ) {

          box.x = 0;

        }


        if (
          box.y === null ||
          box.y === undefined
        ) {

          box.y = 0;

        }


        if (
          box.width === null ||
          box.width === undefined
        ) {

          box.width = 100;

        }


        if (
          box.height === null ||
          box.height === undefined
        ) {

          box.height = 100;

        }

      }
    );

  }


  /* =======================================================
     UPLOAD ANSWER SHEET
  ======================================================= */

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
        await parseInputFile(
          file
        );


      if (
        !parsed ||
        !parsed.length
      ) {

        throw new Error(
          "解答用紙からページを取得できませんでした。"
        );

      }


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


      let completed =
        0;


      for (
        const page
        of parsed
      ) {

        const pageNo =
          nextPageNo++;


        setStatus(
          `解答用紙を保存しています... ${
            completed + 1
          } / ${
            parsed.length
          }`
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


        const {
          error: uploadError
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

          throw new Error(
            `ページ${pageNo}のStorage保存に失敗しました: ${
              uploadError.message
            }`
          );

        }


        const {
          data: signedData,
          error: signedError
        } =
          await supabaseClient
            .storage
            .from(
              "test-files"
            )
            .createSignedUrl(
              path,
              300
            );


        if (
          signedError ||
          !signedData?.signedUrl
        ) {

          throw new Error(
            `ページ${pageNo}のStorage画像を確認できませんでした。`
          );

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
                Number(
                  page.width
                ) ||
                null,

              height_px:
                Number(
                  page.height
                ) ||
                null,

              original_name:
                page.name ||
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


          throw new Error(
            `ページ${pageNo}のDB登録に失敗しました: ${
              error.message
            }`
          );

        }


        pages.push(
          data
        );


        completed++;

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
        `${completed}ページの解答用紙を登録しました。`
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


  /* =======================================================
     INPUT PARSER
  ======================================================= */

  async function parseInputFile(
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

      return await parsePdf(
        file
      );

    }


    if (
      [
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp"
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
      "PDF・画像ファイルのみ登録できます。"
    );

  }


  /* =======================================================
     PDF
  ======================================================= */

  async function parsePdf(
    file
  ) {

    if (
      !window.TEST_SCORE_PDF
    ) {

      throw new Error(
        "PDF処理エンジンが読み込まれていません。"
      );

    }


    const result =
      await window.TEST_SCORE_PDF
        .pdfToPages(
          file,
          2
        );


    return (
      result || []
    ).map(
      page => ({

        pageNo:
          page.pageNo,

        name:
          file.name,

        blob:
          page.blob,

        width:
          page.width,

        height:
          page.height

      })
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


    setupDrawing(
      layer,
      page
    );

  }


  /* =======================================================
     CREATE PAGE IMAGE
  ======================================================= */

  async function createPageImage(
    page
  ) {

    if (
      !page.image_path
    ) {

      throw new Error(
        `P${page.page_no}の画像パスがありません。`
      );

    }


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
          1800
        );


    if (
      error ||
      !data?.signedUrl
    ) {

      throw new Error(
        `P${page.page_no}の画像を取得できませんでした。`
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
          event.button !==
          0
        ) {

          return;

        }


        beginDrawing(
          event,
          layer,
          page
        );

      }
    );

  }


  function beginDrawing(
    event,
    layer,
    page
  ) {

    if (
      drawing
    ) {

      return;

    }


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


    drawStart = {

      x:
        event.clientX -
        rect.left,

      y:
        event.clientY -
        rect.top

    };


    drawPreview =
      document.createElement(
        "div"
      );


    drawPreview.className =
      "drag-preview";


    drawPreview.style.left =
      `${drawStart.x}px`;


    drawPreview.style.top =
      `${drawStart.y}px`;


    layer.appendChild(
      drawPreview
    );


    try {

      layer.setPointerCapture(
        event.pointerId
      );

    } catch (_) {}


    layer.addEventListener(
      "pointermove",
      handleDrawingMove
    );


    layer.addEventListener(
      "pointerup",
      handleDrawingEnd,
      {
        once:
          true
      }
    );


    layer.addEventListener(
      "pointercancel",
      handleDrawingCancel,
      {
        once:
          true
      }
    );

  }


  function handleDrawingMove(
    event
  ) {

    if (
      !drawing ||
      event.pointerId !==
        drawingPointerId
    ) {

      return;

    }


    if (
      !drawPreview
    ) {

      return;

    }


    const rect =
      drawLayer.getBoundingClientRect();


    const x =
      event.clientX -
      rect.left;


    const y =
      event.clientY -
      rect.top;


    const left =
      Math.min(
        drawStart.x,
        x
      );


    const top =
      Math.min(
        drawStart.y,
        y
      );


    const width =
      Math.abs(
        x -
        drawStart.x
      );


    const height =
      Math.abs(
        y -
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


  async function handleDrawingEnd(
    event
  ) {

    if (
      !drawing ||
      event.pointerId !==
        drawingPointerId
    ) {

      return;

    }


    const rect =
      drawLayer.getBoundingClientRect();


    const x =
      event.clientX -
      rect.left;


    const y =
      event.clientY -
      rect.top;


    const left =
      Math.min(
        drawStart.x,
        x
      );


    const top =
      Math.min(
        drawStart.y,
        y
      );


    const width =
      Math.abs(
        x -
        drawStart.x
      );


    const height =
      Math.abs(
        y -
        drawStart.y
      );


    finishDrawing();


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
        drawLayer,
        drawPage
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
          drawPage.page_no
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


  function handleDrawingCancel() {

    finishDrawing();

  }


  function finishDrawing() {

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

      drawLayer.removeEventListener(
        "pointermove",
        handleDrawingMove
      );

    }


    drawPreview?.remove();


    drawPreview =
      null;

  }


  /* =======================================================
     BOX RENDER
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


        if (
          event.button !==
          0
        ) {

          return;

        }


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


  /* =======================================================
     MOVE
  ======================================================= */

  function beginMove(
    event,
    layer,
    page,
    box
  ) {

    cancelDrag();


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


    layer.addEventListener(
      "pointermove",
      handleDragMove
    );


    layer.addEventListener(
      "pointerup",
      handleDragEnd,
      {
        once:
          true
      }
    );


    layer.addEventListener(
      "pointercancel",
      handleDragCancel,
      {
        once:
          true
      }
    );

  }


  /* =======================================================
     RESIZE
  ======================================================= */

  function beginResize(
    event,
    layer,
    page,
    box
  ) {

    cancelDrag();


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


    layer.addEventListener(
      "pointermove",
      handleDragMove
    );


    layer.addEventListener(
      "pointerup",
      handleDragEnd,
      {
        once:
          true
      }
    );


    layer.addEventListener(
      "pointercancel",
      handleDragCancel,
      {
        once:
          true
      }
    );

  }


  function handleDragMove(
    event
  ) {

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


  function handleDragEnd() {

    cancelDrag();

  }


  function handleDragCancel() {

    cancelDrag();

  }


  function cancelDrag() {

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


    document
      .querySelectorAll(
        ".page-layer"
      )
      .forEach(
        layer => {

          layer.removeEventListener(
            "pointermove",
            handleDragMove
          );

        }
      );

  }


  /* =======================================================
     BOX LAYER
  ======================================================= */

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


  /* =======================================================
     APPLY SELECTED
  ======================================================= */

  function applySelectedBox() {

    if (!selectedBoxId) {

      setStatus(
        "選択されている枠がありません。",
        true
      );

      return;

    }


    const box =
      boxes.find(
        item =>
          item.id ===
          selectedBoxId
      );


    if (!box) {

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


    if (
      info.boxType !==
      "answer"
    ) {

      box.points =
        null;

    } else if (
      box.points ===
      null ||
      box.points ===
      undefined
    ) {

      box.points =
        0;

    }


    renderAllPages();


    updateRoleHelp();


    setStatus(
      `${box.label}として設定しました。`
    );

  }


  /* =======================================================
     DELETE SELECTED
  ======================================================= */

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
      "選択した枠を削除しました。保存するとDBにも反映されます。"
    );

  }


  /* =======================================================
     PANEL
  ======================================================= */

  function openBoxPanel() {

    boxPanel?.classList.add(
      "open"
    );

  }


  function closeBoxPanel() {

    boxPanel?.classList.remove(
      "open"
    );

  }


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


  /* =======================================================
     SAVE BOXES
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


        const boxType =
          normalizeBoxType(
            box.box_type
          );


        if (
          !ALLOWED_BOX_TYPES.includes(
            boxType
          )
        ) {

          continue;

        }


        const payload = {

          test_id:
            selectedTestId,

          page_no:
            Number(
              box.page_no
            ) || 1,

          box_type:
            boxType,

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
            boxType ===
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
              .single();


          if (error) {

            throw error;

          }


          box.id =
            data.id;

        }

      }


      await reloadBoxes();


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
     RELOAD BOXES
  ======================================================= */

  async function reloadBoxes() {

    const {
      data,
      error
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


    if (error) {

      throw error;

    }


    boxes =
      (
        data ||
        []
      )
        .filter(
          box =>
            ALLOWED_BOX_TYPES.includes(
              normalizeBoxType(
                box.box_type
              )
            )
        );


    normalizeBoxes();


    selectedBoxId =
      null;


    await renderAllPages();

  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyboard(
    event
  ) {

    if (
      event.key ===
      "Escape"
    ) {

      selectedBoxId =
        null;


      cancelDrag();


      renderAllPages();


      return;

    }


    if (
      event.key ===
      "Delete" ||
      event.key ===
      "Backspace"
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
        selectedBoxId
      ) {

        event.preventDefault();


        deleteSelectedBox();

      }

    }

  }


  /* =======================================================
     SCALE
  ======================================================= */

  function getPageScale(
    layer,
    page
  ) {

    const width =
      layer.clientWidth;


    const sourceWidth =
      Number(
        page.width_px
      ) ||
      width;


    if (
      !sourceWidth
    ) {

      return 1;

    }


    return width /
      sourceWidth;

  }


  /* =======================================================
     IMAGE
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


  async function imageToPng(
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
                  "画像をPNGに変換できませんでした。"
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


        const roleInfo =
          ROLE_INFO[
            box.box_role
          ];


        if (!roleInfo) {

          throw new Error(
            `不明な枠種類です: ${box.box_role}`
          );

        }


        if (
          !ALLOWED_BOX_TYPES.includes(
            roleInfo.boxType
          )
        ) {

          throw new Error(
            `box_type「${roleInfo.boxType}」はDB制約で使用できません。`
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

        }

        else {

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

        }

        else {

          parentInfo.textContent =
            "大問の内側に置いた小計だけ、その大問の小計になります。";

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


    boxPanel.style.display =
      "none";

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
     GEOMETRY
  ======================================================= */

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
     BLOB
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
          .95
        );

      }
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
            `ページ${item.pageNo}のStorage画像が確認できません。`
          );

        }

      }


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

        throw new Error(
          `既存の枠設定を削除できません: ${
            boxDeleteError.message
          }`
        );

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


      answerFile.value =
        "";


      selectedBoxId =
        null;


      boxes =
        [];


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
     START
  ======================================================= */

  initialize();

})();
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
