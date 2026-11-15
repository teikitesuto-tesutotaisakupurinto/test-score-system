
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙アップロード・解答欄設定

   URL
   ---------------------------------------------------------
   /teacher/tests/pages?test=UUID

   重要
   ---------------------------------------------------------
   ・testSelect がHTMLに存在しなくても動作する
   ・URL ?test=UUID を最優先
   ・解答用紙にだけ枠を設定
   ・枠は原画像のピクセル座標で保存
   ・答案側には枠を設定しない
   ・答案アップロード時にこの枠を自動適用する

   対応
   ---------------------------------------------------------
   PDF
   JPG
   JPEG
   PNG
   WEBP
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let selectedTestId = null;

  let tests = [];

  let pages = [];

  let boxes = [];

  let selectedBox = null;

  let drawing = false;

  let drawingStart = null;

  let drawingPage = null;

  let drawingLayer = null;

  let temporaryBox = null;

  let pdfPromise = null;


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

  const teacherName =
    document.getElementById(
      "teacherName"
    );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  async function initialize() {

    try {

      /*
        Teacher認証
      */

      const profile =
        await requireTeacher();


      if (!profile) {

        return;

      }


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      /*
        URLからtest ID取得

        /teacher/tests/pages?test=UUID
      */

      const urlTestId =
        new URLSearchParams(
          window.location.search
        ).get(
          "test"
        );


      /*
        testSelectがある古い画面にも対応。
      */

      selectedTestId =
        urlTestId ||
        window.__TEST_ID__ ||
        (
          testSelect
            ? testSelect.value
            : null
        ) ||
        null;


      setupEvents();


      /*
        testSelectがある場合のみ
        テスト一覧を読み込む。
      */

      if (testSelect) {

        await loadTests();


        if (selectedTestId) {

          const exists =
            tests.some(
              test =>
                test.id ===
                selectedTestId
            );


          if (!exists) {

            setStatus(
              "指定されたテストが見つかりません。"
            );

            return;

          }


          /*
            ここがnullエラー対策。

            testSelectが存在する場合だけ
            valueを設定する。
          */

          testSelect.value =
            selectedTestId;

        }

      }


      if (!selectedTestId) {

        setStatus(
          "テストIDが指定されていません。"
        );

        return;

      }


      await loadTestPages();


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
     EVENTS
  ======================================================= */

  function setupEvents() {

    /*
      testSelectが存在する場合のみ。
    */

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
      goBack
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
     LOAD TESTS
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
     LOAD TEST PAGES
  ======================================================= */

  async function loadTestPages() {

    if (!viewer) {

      return;

    }


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
        "テストIDが指定されていません。"
      );

      return;

    }


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


    /*
      表示
    */

    await renderPages();


    if (!pages.length) {

      setStatus(
        "解答用紙がありません。PDFまたは画像を登録してください。"
      );

      return;

    }


    setStatus(
      "解答用紙上をドラッグして解答欄を設定してください。"
    );

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

      setStatus(
        "解答用紙を処理しています..."
      );


      /*
        ファイルをページ化
      */

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
        既存test_pages削除
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
        解答用紙を入れ替えるので
        古い枠も削除。
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


      /*
        Storageへ保存
      */

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


        /*
          DB
        */

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


      if (answerFile) {

        answerFile.value =
          "";

      }


      /*
        再読み込み
      */

      await loadTestPages();


      setStatus(
        "解答用紙を登録しました。枠を設定してください。"
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

    if (!viewer) {

      return;

    }


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


    /*
      Signed URL
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
          page.file_path,
          3600
        );


    if (error) {

      throw error;

    }


    if (
      !data?.signedUrl
    ) {

      throw new Error(
        "解答用紙画像URLを取得できませんでした。"
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      原画像サイズ
    */

    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    context.drawImage(
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

        /*
          既存枠をクリックした場合は
          新規枠を作らない。
        */

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


        drawingStart =
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
          `${
            drawingStart.x /
            rect.width *
            100
          }%`;


        temporaryBox.style.top =
          `${
            drawingStart.y /
            rect.height *
            100
          }%`;


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
          !drawingStart
        ) {

          return;

        }


        const rect =
          layer.getBoundingClientRect();


        const current =
          getLayerPoint(
            event,
            rect
          );


        const x =
          Math.min(
            drawingStart.x,
            current.x
          );


        const y =
          Math.min(
            drawingStart.y,
            current.y
          );


        const width =
          Math.abs(
            current.x -
            drawingStart.x
          );


        const height =
          Math.abs(
            current.y -
            drawingStart.y
          );


        temporaryBox.style.left =
          `${
            x /
            rect.width *
            100
          }%`;


        temporaryBox.style.top =
          `${
            y /
            rect.height *
            100
          }%`;


        temporaryBox.style.width =
          `${
            width /
            rect.width *
            100
          }%`;


        temporaryBox.style.height =
          `${
            height /
            rect.height *
            100
          }%`;

      }
    );


    layer.addEventListener(
      "mouseup",
      event => {

        if (
          !drawing ||
          !temporaryBox ||
          !drawingStart
        ) {

          return;

        }


        drawing =
          false;


        const rect =
          layer.getBoundingClientRect();


        const current =
          getLayerPoint(
            event,
            rect
          );


        const x =
          Math.min(
            drawingStart.x,
            current.x
          );


        const y =
          Math.min(
            drawingStart.y,
            current.y
          );


        const width =
          Math.abs(
            current.x -
            drawingStart.x
          );


        const height =
          Math.abs(
            current.y -
            drawingStart.y
          );


        temporaryBox.remove();


        temporaryBox =
          null;


        drawingPage =
          null;


        drawingLayer =
          null;


        drawingStart =
          null;


        if (
          width < 10 ||
          height < 10
        ) {

          return;

        }


        /*
          表示座標 → 原画像座標
        */

        const canvas =
          wrapper.querySelector(
            "canvas"
          );


        const canvasRect =
          canvas.getBoundingClientRect();


        const scaleX =
          canvas.width /
          canvasRect.width;


        const scaleY =
          canvas.height /
          canvasRect.height;


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
     UPDATE BOX
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
      `${
        Number(box.x) /
        pageWidth *
        100
      }%`;


    element.style.top =
      `${
        Number(box.y) /
        pageHeight *
        100
      }%`;


    element.style.width =
      `${
        Number(box.width) /
        pageWidth *
        100
      }%`;


    element.style.height =
      `${
        Number(box.height) /
        pageHeight *
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


    if (labelInput) {

      labelInput.value =
        box.label ||
        "";

    }


    if (pointsInput) {

      pointsInput.value =
        box.points ??
        0;

    }


    if (questionIdInput) {

      questionIdInput.value =
        box.question_id ||
        "";

    }

  }


  /* =======================================================
     APPLY
  ======================================================= */

  function applySelectedBox() {

    if (!selectedBox) {
      return;
    }


    selectedBox.label =
      labelInput?.value.trim() ||
      "設問";


    const points =
      Number(
        pointsInput?.value
      );


    if (
      !Number.isFinite(points) ||
      points < 0
    ) {

      throw new Error(
        "配点は0以上の数値を入力してください。"
      );

    }


    selectedBox.points =
      points;


    selectedBox.question_id =
      questionIdInput?.value.trim() ||
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
     SAVE BOXES
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
        選択中の設定も反映
      */

      applySelectedBox();


      /*
        全枠チェック
      */

      for (
        const box
        of boxes
      ) {

        if (
          !Number.isFinite(
            Number(box.x)
          ) ||
          !Number.isFinite(
            Number(box.y)
          ) ||
          !Number.isFinite(
            Number(box.width)
          ) ||
          !Number.isFinite(
            Number(box.height)
          )
        ) {

          throw new Error(
            `${box.label || "設問"}の座標が正しくありません。`
          );

        }


        if (
          Number(box.width) <= 0 ||
          Number(box.height) <= 0
        ) {

          throw new Error(
            `${box.label || "設問"}のサイズが正しくありません。`
          );

        }


        if (
          Number(box.points) < 0
        ) {

          throw new Error(
            `${box.label || "設問"}の配点が正しくありません。`
          );

        }

      }


      saveButton.disabled =
        true;


      setStatus(
        "解答欄を保存しています..."
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
        新しい枠保存
      */

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


      /*
        保存後にDBのUUIDを
        正しいものへ再取得。
      */

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
      ? parts.pop().toLowerCase()
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
