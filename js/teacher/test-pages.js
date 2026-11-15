
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙アップロード・枠設定

   URL
   ---------------------------------------------------------
   /teacher/tests/pages?test=UUID

   処理
   ---------------------------------------------------------
   ① URLからtest ID取得
   ② 解答用紙をアップロード
   ③ test_pagesへ保存
   ④ 解答用紙を表示
   ⑤ 画面上で枠をドラッグ
   ⑥ 原画像座標へ変換
   ⑦ layout_boxesへ保存

   重要
   ---------------------------------------------------------
   枠は「解答用紙」にだけ設定する。

   生徒答案には枠を設定しない。

   生徒答案アップロード時に
   layout_boxesを自動適用して
   answer_regionsを作成する。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let profile = null;

  let selectedTestId = null;

  let tests = [];

  let pages = [];

  let boxes = [];

  let selectedBox = null;

  let drawing = false;

  let drawingPage = null;

  let drawingLayer = null;

  let temporaryBox = null;


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
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

  const deleteButton =
    document.getElementById(
      "deleteButton"
    );

  const backButton =
    document.getElementById(
      "backButton"
    );

  const viewer =
    document.getElementById(
      "viewer"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const panel =
    document.getElementById(
      "panel"
    );

  const labelInput =
    document.getElementById(
      "label"
    );

  const pointsInput =
    document.getElementById(
      "points"
    );

  const questionIdInput =
    document.getElementById(
      "questionId"
    );

  const applyButton =
    document.getElementById(
      "applyButton"
    );

  const closeButton =
    document.getElementById(
      "closeButton"
    );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  async function initialize() {

    try {

      profile =
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
        最重要：
        /teacher/tests/pages?test=UUID
      */

      const urlTestId =
        new URLSearchParams(
          window.location.search
        ).get("test");


      /*
        グローバル値も確認
      */

      selectedTestId =
        urlTestId ||
        window.__TEST_ID__ ||
        null;


      setupEvents();

      await loadTests();


      /*
        URLのtestを初期選択
      */

      if (selectedTestId) {

        const exists =
          tests.some(
            test =>
              test.id ===
              selectedTestId
          );


        if (exists) {

          testSelect.value =
            selectedTestId;

          await loadTestPages();

        } else {

          setStatus(
            "指定されたテストが見つかりません。"
          );

        }

      } else {

        setStatus(
          "テストIDが指定されていません。"
        );

      }

    } catch (error) {

      console.error(
        "test-pages initialize:",
        error
      );


      showError(
        error.message ||
        "解答用紙設定画面を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     TESTS
  ======================================================= */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          created_at
        `)
        .order(
          "created_at",
          {
            ascending:
              false
          }
        );


    if (error) {
      throw error;
    }


    tests =
      data || [];


    if (!testSelect) {
      return;
    }


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        tests
          .map(
            test => `

              <option
                value="${escapeHtml(
                  test.id
                )}"
              >

                ${escapeHtml(
                  test.name
                )}

                ${
                  test.subject
                    ? ` / ${escapeHtml(
                        test.subject
                      )}`
                    : ""
                }

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
      "change",
      async () => {

        selectedTestId =
          testSelect.value ||
          null;


        selectedBox =
          null;


        closePanel();


        await loadTestPages();

      }
    );


    uploadButton?.addEventListener(
      "click",
      uploadAnswerSheet
    );


    saveButton?.addEventListener(
      "click",
      saveBoxes
    );


    deleteButton?.addEventListener(
      "click",
      deleteSelectedBox
    );


    applyButton?.addEventListener(
      "click",
      applySelectedBox
    );


    closeButton?.addEventListener(
      "click",
      closePanel
    );


    backButton?.addEventListener(
      "click",
      () => {

        if (selectedTestId) {

          window.location.href =
            `/teacher/tests/edit?id=${encodeURIComponent(
              selectedTestId
            )}`;

        } else {

          window.location.href =
            "/teacher/tests";

        }

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

  }


  /* =======================================================
     LOAD TEST PAGES
  ======================================================= */

  async function loadTestPages() {

    viewer.innerHTML =
      "";


    pages =
      [];

    boxes =
      [];

    selectedBox =
      null;


    closePanel();


    if (!selectedTestId) {

      setStatus(
        "テストを選択してください。"
      );

      return;

    }


    setStatus(
      "解答用紙を読み込んでいます..."
    );


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
          file_path,
          file_type,
          original_name,
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


    if (pageError) {
      throw pageError;
    }


    pages =
      pageData || [];


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
          source_page_id,
          question_id,
          box_type,
          label,
          points,
          x,
          y,
          width,
          height,
          created_at
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .order(
          "created_at",
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


    await renderPages();


    if (!pages.length) {

      setStatus(
        "解答用紙がありません。PDFまたは画像を登録してください。"
      );

    } else {

      setStatus(
        "解答用紙上をドラッグして解答欄を設定してください。"
      );

    }

  }


  /* =======================================================
     UPLOAD ANSWER SHEET
  ======================================================= */

  async function uploadAnswerSheet() {

    if (!selectedTestId) {

      alert(
        "テストを選択してください。"
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


    try {

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
        既存のページを削除
      */

      const {
        error:
          deleteError
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


      if (deleteError) {
        throw deleteError;
      }


      /*
        既存の枠も削除。

        解答用紙を入れ替えると
        以前の座標が合わなくなるため。
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


      let pageNo = 1;


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

              file_path:
                path,

              file_type:
                "image/png",

              original_name:
                file.name,

              width_px:
                page.width,

              height_px:
                page.height

            });


        if (insertError) {
          throw insertError;
        }


        pageNo++;

      }


      answerFile.value =
        "";


      await loadTestPages();


      setStatus(
        "解答用紙を登録しました。ドラッグして解答欄を設定してください。"
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

    }

  }


  /* =======================================================
     RENDER PAGES
  ======================================================= */

  async function renderPages() {

    viewer.innerHTML =
      "";


    for (
      const page
      of pages
    ) {

      await renderPage(
        page
      );

    }

  }


  async function renderPage(
    page
  ) {

    const wrapper =
      document.createElement(
        "div"
      );


    wrapper.className =
      "page";


    wrapper.dataset.pageId =
      page.id;


    const canvas =
      document.createElement(
        "canvas"
      );


    const layer =
      document.createElement(
        "div"
      );


    layer.className =
      "layer";


    wrapper.appendChild(
      canvas
    );

    wrapper.appendChild(
      layer
    );


    viewer.appendChild(
      wrapper
    );


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
          page.file_path,
          3600
        );


    if (error) {

      console.error(
        "createSignedUrl:",
        error
      );

      return;

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      原画像サイズをそのままCanvasへ。
    */

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
      wrapper,
      layer,
      page
    );


    /*
      既存枠
    */

    boxes
      .filter(
        box =>
          box.source_page_id ===
          page.id
      )
      .forEach(
        box => {

          renderBox(
            wrapper,
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
    wrapper,
    layer,
    page
  ) {

    layer.addEventListener(
      "mousedown",
      event => {

        if (
          event.target !==
          layer
        ) {

          return;

        }


        drawing =
          true;


        drawingPage =
          page;


        drawingLayer =
          layer;


        const rect =
          layer.getBoundingClientRect();


        const point =
          getLayerPoint(
            event,
            rect
          );


        temporaryBox =
          document.createElement(
            "div"
          );


        temporaryBox.className =
          "box";


        temporaryBox.style.left =
          `${point.x / rect.width * 100}%`;


        temporaryBox.style.top =
          `${point.y / rect.height * 100}%`;


        temporaryBox.style.width =
          "0%";


        temporaryBox.style.height =
          "0%";


        layer.appendChild(
          temporaryBox
        );

      }
    );


    layer.addEventListener(
      "mousemove",
      event => {

        if (
          !drawing ||
          !temporaryBox ||
          drawingPage !== page
        ) {

          return;

        }


        const rect =
          layer.getBoundingClientRect();


        const point =
          getLayerPoint(
            event,
            rect
          );


        const start =
          getTemporaryStart(
            temporaryBox,
            rect
          );


        const x =
          Math.min(
            start.x,
            point.x
          );


        const y =
          Math.min(
            start.y,
            point.y
          );


        const width =
          Math.abs(
            point.x -
            start.x
          );


        const height =
          Math.abs(
            point.y -
            start.y
          );


        temporaryBox.style.left =
          `${x / rect.width * 100}%`;


        temporaryBox.style.top =
          `${y / rect.height * 100}%`;


        temporaryBox.style.width =
          `${width / rect.width * 100}%`;


        temporaryBox.style.height =
          `${height / rect.height * 100}%`;

      }
    );


    layer.addEventListener(
      "mouseup",
      event => {

        if (
          !drawing ||
          !temporaryBox
        ) {

          return;

        }


        drawing =
          false;


        const rect =
          layer.getBoundingClientRect();


        const start =
          getTemporaryStart(
            temporaryBox,
            rect
          );


        const point =
          getLayerPoint(
            event,
            rect
          );


        const x =
          Math.min(
            start.x,
            point.x
          );


        const y =
          Math.min(
            start.y,
            point.y
          );


        const width =
          Math.abs(
            point.x -
            start.x
          );


        const height =
          Math.abs(
            point.y -
            start.y
          );


        temporaryBox.remove();


        temporaryBox =
          null;


        drawingPage =
          null;


        drawingLayer =
          null;


        if (
          width < 10 ||
          height < 10
        ) {

          return;

        }


        /*
          表示座標
          ↓
          原画像座標
        */

        const canvas =
          wrapper.querySelector(
            "canvas"
          );


        const displayRect =
          canvas.getBoundingClientRect();


        const scaleX =
          canvas.width /
          displayRect.width;


        const scaleY =
          canvas.height /
          displayRect.height;


        const box = {

          id:
            crypto.randomUUID(),

          test_id:
            selectedTestId,

          source_page_id:
            page.id,

          question_id:
            null,

          box_type:
            "answer",

          label:
            `問${boxes.length + 1}`,

          points:
            0,

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
            scaleY

        };


        boxes.push(
          box
        );


        renderBox(
          wrapper,
          layer,
          page,
          box
        );


        selectBox(
          box
        );

      }
    );


    layer.addEventListener(
      "mouseleave",
      () => {

        if (
          !drawing
        ) {

          return;

        }

      }
    );

  }


  /* =======================================================
     RENDER BOX
  ======================================================= */

  function renderBox(
    wrapper,
    layer,
    page,
    box
  ) {

    const element =
      document.createElement(
        "div"
      );


    element.className =
      "box";


    element.dataset.boxId =
      box.id;


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
      "box-label";


    label.textContent =
      `${box.label || "設問"} ${
        Number(box.points) || 0
      }点`;


    element.appendChild(
      label
    );


    const resize =
      document.createElement(
        "div"
      );


    resize.className =
      "resize";


    element.appendChild(
      resize
    );


    layer.appendChild(
      element
    );


    enableBoxInteraction(
      element,
      resize,
      wrapper,
      page,
      box
    );

  }


  /* =======================================================
     MOVE / RESIZE
  ======================================================= */

  function enableBoxInteraction(
    element,
    resize,
    wrapper,
    page,
    box
  ) {

    let moving =
      false;

    let resizing =
      false;

    let startClientX =
      0;

    let startClientY =
      0;

    let original = null;


    element.addEventListener(
      "mousedown",
      event => {

        event.stopPropagation();


        selectBox(
          box
        );


        moving =
          event.target !==
          resize;


        resizing =
          event.target ===
          resize;


        startClientX =
          event.clientX;


        startClientY =
          event.clientY;


        original = {

          x:
            Number(box.x),

          y:
            Number(box.y),

          width:
            Number(box.width),

          height:
            Number(box.height)

        };

      }
    );


    const move =
      event => {

        if (
          !moving &&
          !resizing
        ) {

          return;

        }


        const canvas =
          wrapper.querySelector(
            "canvas"
          );


        const rect =
          canvas.getBoundingClientRect();


        const scaleX =
          canvas.width /
          rect.width;


        const scaleY =
          canvas.height /
          rect.height;


        const dx =
          (
            event.clientX -
            startClientX
          ) *
          scaleX;


        const dy =
          (
            event.clientY -
            startClientY
          ) *
          scaleY;


        if (moving) {

          box.x =
            clamp(
              original.x + dx,
              0,
              canvas.width -
                box.width
            );


          box.y =
            clamp(
              original.y + dy,
              0,
              canvas.height -
                box.height
            );

        }


        if (resizing) {

          box.width =
            clamp(
              original.width + dx,
              10,
              canvas.width -
                box.x
            );


          box.height =
            clamp(
              original.height + dy,
              10,
              canvas.height -
                box.y
            );

        }


        updateBoxElement(
          element,
          page,
          box
        );

      };


    const stop =
      () => {

        moving =
          false;

        resizing =
          false;

      };


    document.addEventListener(
      "mousemove",
      move
    );


    document.addEventListener(
      "mouseup",
      stop
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

    const width =
      Number(
        page.width_px
      );


    const height =
      Number(
        page.height_px
      );


    element.style.left =
      `${
        Number(box.x) /
        width *
        100
      }%`;


    element.style.top =
      `${
        Number(box.y) /
        height *
        100
      }%`;


    element.style.width =
      `${
        Number(box.width) /
        width *
        100
      }%`;


    element.style.height =
      `${
        Number(box.height) /
        height *
        100
      }%`;

  }


  /* =======================================================
     SELECT BOX
  ======================================================= */

  function selectBox(
    box
  ) {

    selectedBox =
      box;


    document
      .querySelectorAll(
        ".box"
      )
      .forEach(
        element => {

          element.classList.toggle(
            "selected",
            element.dataset.boxId ===
              box.id
          );

        }
      );


    if (!panel) {
      return;
    }


    panel.hidden =
      false;


    labelInput.value =
      box.label ||
      "";


    pointsInput.value =
      box.points ??
      0;


    questionIdInput.value =
      box.question_id ||
      "";

  }


  /* =======================================================
     APPLY
  ======================================================= */

  function applySelectedBox() {

    if (!selectedBox) {
      return;
    }


    selectedBox.label =
      labelInput.value.trim() ||
      "設問";


    const points =
      Number(
        pointsInput.value
      );


    selectedBox.points =
      Number.isFinite(points)
        ? points
        : 0;


    selectedBox.question_id =
      questionIdInput.value.trim() ||
      null;


    document
      .querySelectorAll(
        ".box"
      )
      .forEach(
        element => {

          if (
            element.dataset.boxId !==
            selectedBox.id
          ) {

            return;

          }


          const label =
            element.querySelector(
              ".box-label"
            );


          if (label) {

            label.textContent =
              `${selectedBox.label} ${
                selectedBox.points
              }点`;

          }

        }
      );

  }


  /* =======================================================
     DELETE
  ======================================================= */

  function deleteSelectedBox() {

    if (!selectedBox) {

      return;

    }


    boxes =
      boxes.filter(
        box =>
          box.id !==
          selectedBox.id
      );


    document
      .querySelectorAll(
        ".box"
      )
      .forEach(
        element => {

          if (
            element.dataset.boxId ===
            selectedBox.id
          ) {

            element.remove();

          }

        }
      );


    selectedBox =
      null;


    closePanel();

  }


  /* =======================================================
     SAVE
  ======================================================= */

  async function saveBoxes() {

    if (!selectedTestId) {

      alert(
        "テストを選択してください。"
      );

      return;

    }


    /*
      保存前に現在の枠を反映
    */

    applySelectedBox();


    /*
      配点チェック
    */

    const invalid =
      boxes.find(
        box =>
          !Number.isFinite(
            Number(box.points)
          ) ||
          Number(box.points) < 0
      );


    if (invalid) {

      alert(
        `${invalid.label || "設問"}の配点が正しくありません。`
      );

      return;

    }


    try {

      saveButton.disabled =
        true;


      setStatus(
        "解答欄を保存しています..."
      );


      /*
        既存枠を削除
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


      if (boxes.length) {

        const rows =
          boxes.map(
            box => ({

              id:
                crypto.randomUUID(),

              test_id:
                selectedTestId,

              source_page_id:
                box.source_page_id,

              question_id:
                box.question_id ||
                null,

              box_type:
                "answer",

              label:
                box.label ||
                "設問",

              points:
                Number(
                  box.points
                ) || 0,

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


      await loadTestPages();


      setStatus(
        "解答欄を保存しました。"
      );


      alert(
        "解答欄を保存しました。"
      );


    } catch (error) {

      console.error(
        "saveBoxes:",
        error
      );


      showError(
        error.message ||
        "解答欄の保存に失敗しました。"
      );

    } finally {

      saveButton.disabled =
        false;

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
     PDF
  ======================================================= */

  let pdfPromise =
    null;


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
      let i = 1;
      i <= pdf.numPages;
      i++
    ) {

      const page =
        await pdf.getPage(
          i
        );


      const base =
        page.getViewport({
          scale:1
        });


      /*
        最大3500px程度。
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
     HELPERS
  ======================================================= */

  function getLayerPoint(
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


  function getTemporaryStart(
    element,
    rect
  ) {

    return {

      x:
        parseFloat(
          element.style.left
        ) /
        100 *
        rect.width,

      y:
        parseFloat(
          element.style.top
        ) /
        100 *
        rect.height

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


  function closePanel() {

    if (panel) {

      panel.hidden =
        true;

    }

  }


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


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
