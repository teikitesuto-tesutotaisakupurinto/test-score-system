
/* =========================================================
   テスト成績システム
   js/teacher/test-pages.js

   解答用紙レイアウト設定 最終版

   対応する枠
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
    └─ 小問

   小問を大問の中へ置くと
   parent_box_id を自動設定。

   大問番号・小問番号
   ---------------------------------------------------------
   大問1
     問1
     問2
     問3

   大問2
     問1
     問2

   自動計算。

   小計
   ---------------------------------------------------------
   subtotal_group

   合計
   ---------------------------------------------------------
   box_role = total

   QR
   ---------------------------------------------------------
   box_role = qr

   DB
   ---------------------------------------------------------
   test_pages
     image_path

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
     question_id
     points
     parent_box_id
     major_no
     minor_no
     box_role
     sort_order
     subtotal_group

   source_page_id は使用しない。
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
     ROLE
  ======================================================= */

  const BOX_ROLES = {

    major: {
      label: "大問",
      defaultBoxType: "question"
    },

    minor: {
      label: "小問",
      defaultBoxType: "answer"
    },

    qr: {
      label: "QR",
      defaultBoxType: "qr"
    },

    subtotal: {
      label: "小計",
      defaultBoxType: "subtotal"
    },

    total: {
      label: "合計",
      defaultBoxType: "total"
    },

    name: {
      label: "氏名",
      defaultBoxType: "name"
    },

    student_no: {
      label: "生徒番号",
      defaultBoxType: "student_no"
    },

    instruction: {
      label: "説明",
      defaultBoxType: "instruction"
    },

    other: {
      label: "その他",
      defaultBoxType: "other"
    }

  };


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

      const urlTestId =
        new URLSearchParams(
          window.location.search
        ).get(
          "test"
        );


      selectedTestId =
        urlTestId ||
        window.__TEST_ID__ ||
        null;


      setupRoleControls();

      setupEvents();


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
     ROLE CONTROL
  ======================================================= */

  function setupRoleControls() {

    if (!panel) {
      return;
    }


    /*
      既に存在する場合は作らない。
    */

    if (
      document.getElementById(
        "boxRole"
      )
    ) {

      return;

    }


    const roleLabel =
      document.createElement(
        "label"
      );


    roleLabel.textContent =
      "枠種類";


    const roleSelect =
      document.createElement(
        "select"
      );


    roleSelect.id =
      "boxRole";


    roleSelect.style.width =
      "100%";


    roleSelect.style.height =
      "36px";


    roleSelect.style.boxSizing =
      "border-box";


    roleSelect.style.padding =
      "0 8px";


    roleSelect.innerHTML =

      Object.entries(
        BOX_ROLES
      )
        .map(
          (
            [
              value,
              role
            ]
          ) => `

            <option
              value="${value}"
            >
              ${role.label}
            </option>

          `
        )
        .join("");


    /*
      既存labelの前へ追加。
    */

    panel.insertBefore(
      roleLabel,
      panel.firstChild
    );


    panel.insertBefore(
      roleSelect,
      roleLabel.nextSibling
    );


    /*
      補助説明
    */

    const help =
      document.createElement(
        "div"
      );


    help.id =
      "boxRoleHelp";


    help.style.marginTop =
      "6px";


    help.style.fontSize =
      "11px";


    help.style.color =
      "#666";


    help.textContent =
      "小問は大問の内側に置くと、その大問へ自動登録されます。";


    panel.insertBefore(
      help,
      roleSelect.nextSibling
    );

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
     LOAD PAGES / BOXES
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
          question_id,
          points,
          parent_box_id,
          major_no,
          minor_no,
          box_role,
          sort_order,
          subtotal_group,
          created_at
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
            nullsFirst:
              false
          }
        );


    if (boxError) {
      throw boxError;
    }


    boxes =
      boxData || [];


    /*
      古いデータへの互換。

      box_roleがnullならbox_typeから推定。
    */

    boxes.forEach(
      box => {

        if (!box.box_role) {

          box.box_role =
            inferRoleFromBox(
              box
            );

        }

      }
    );


    await renderPages();


    if (!pages.length) {

      setStatus(
        "解答用紙がありません。PDFまたは画像を登録してください。"
      );

      return;

    }


    setStatus(
      "枠をドラッグして設定してください。"
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
        古いtest_pages
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
        解答用紙を変更するので
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


      await loadTestPages();


      setStatus(
        "解答用紙を登録しました。"
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


    /*
      ページ番号表示
    */

    const pageLabel =
      document.createElement(
        "div"
      );


    pageLabel.textContent =
      `ページ ${page.page_no}`;


    pageLabel.style.position =
      "absolute";


    pageLabel.style.top =
      "8px";


    pageLabel.style.left =
      "8px";


    pageLabel.style.zIndex =
      "5";


    pageLabel.style.padding =
      "4px 7px";


    pageLabel.style.background =
      "rgba(0,0,0,.65)";


    pageLabel.style.color =
      "#fff";


    pageLabel.style.fontSize =
      "11px";


    wrapper.style.position =
      "relative";


    wrapper.appendChild(
      canvas
    );


    wrapper.appendChild(
      layer
    );


    wrapper.appendChild(
      pageLabel
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
      wrapper,
      layer,
      page
    );


    /*
      page_noで枠を取得
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
     DRAWING
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
          `${(
            drawingStart.x /
            rect.width
          ) * 100}%`;


        temporaryBox.style.top =
          `${(
            drawingStart.y /
            rect.height
          ) * 100}%`;


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
          `${(
            x /
            rect.width
          ) * 100}%`;


        temporaryBox.style.top =
          `${(
            y /
            rect.height
          ) * 100}%`;


        temporaryBox.style.width =
          `${(
            width /
            rect.width
          ) * 100}%`;


        temporaryBox.style.height =
          `${(
            height /
            rect.height
          ) * 100}%`;

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


        const role =
          getCurrentRole();


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
            BOX_ROLES[
              role
            ]?.defaultBoxType ||
            "answer",

          box_role:
            role,

          label:
            createDefaultLabel(
              role
            ),

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
            scaleY,

          question_id:
            null,

          parent_box_id:
            null,

          major_no:
            null,

          minor_no:
            null,

          sort_order:
            boxes.length,

          subtotal_group:
            null

        };


        /*
          大問番号・小問番号・親を
          自動計算。
        */

        assignHierarchy(
          box
        );


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
     CURRENT ROLE
  ======================================================= */

  function getCurrentRole() {

    const roleSelect =
      document.getElementById(
        "boxRole"
      );


    return (
      roleSelect?.value ||
      "minor"
    );

  }


  /* =======================================================
     DEFAULT LABEL
  ======================================================= */

  function createDefaultLabel(
    role
  ) {

    if (
      role ===
      "major"
    ) {

      return `大問${getNextMajorNumber()}`;

    }


    if (
      role ===
      "minor"
    ) {

      return "小問";

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

      box.major_no =
        getNextMajorNumber();


      box.minor_no =
        null;


      box.parent_box_id =
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
          parent.major_no ||
          getMajorNumber(
            parent
          );


        box.minor_no =
          getNextMinorNumber(
            parent.id
          );

      } else {

        /*
          大問の外に置いた小問。

          大問がない場合でも
          大問番号を持たせる。
        */

        box.parent_box_id =
          null;

        box.major_no =
          getNextMajorNumber();

        box.minor_no =
          1;

      }


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

        box.major_no =
          parent.major_no;


        box.subtotal_group =
          parent.major_no;

      } else {

        box.subtotal_group =
          getNextSubtotalGroup();

      }


      return;

    }


    /*
      その他は親なし。
    */

    box.parent_box_id =
      null;

  }


  /* =======================================================
     FIND CONTAINING MAJOR
  ======================================================= */

  function findContainingMajor(
    box
  ) {

    const candidates =
      boxes
        .filter(
          candidate =>

            candidate.box_role ===
              "major" &&

            Number(
              candidate.page_no
            ) ===
            Number(
              box.page_no
            ) &&

            isPointInsideBox(
              getBoxCenter(
                box
              ),
              candidate
            )
        );


    if (!candidates.length) {

      return null;

    }


    /*
      複数の大問が重なっていた場合は
      最も小さい大問を親とする。
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
     POINT INSIDE
  ======================================================= */

  function isPointInsideBox(
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
     CENTER
  ======================================================= */

  function getBoxCenter(
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
     MAJOR NUMBER
  ======================================================= */

  function getNextMajorNumber() {

    const numbers =
      boxes
        .filter(
          box =>
            box.box_role ===
            "major"
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


  function getMajorNumber(
    box
  ) {

    return (
      Number(
        box.major_no
      ) ||
      getNextMajorNumber()
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


  /* =======================================================
     SUBTOTAL GROUP
  ======================================================= */

  function getNextSubtotalGroup() {

    const groups =
      boxes
        .map(
          box =>
            Number(
              box.subtotal_group
            ) || 0
        );


    return (
      Math.max(
        0,
        ...groups
      ) +
      1
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


    const role =
      box.box_role ||
      inferRoleFromBox(
        box
      );


    element.dataset.role =
      role;


    /*
      roleごとの表示
    */

    if (
      role ===
      "major"
    ) {

      element.style.border =
        "3px solid #2468a8";

      element.style.background =
        "rgba(36,104,168,.08)";

    }


    else if (
      role ===
      "minor"
    ) {

      element.style.border =
        "2px solid #d00000";

      element.style.background =
        "rgba(208,0,0,.06)";

    }


    else if (
      role ===
      "qr"
    ) {

      element.style.border =
        "3px dashed #333";

      element.style.background =
        "rgba(0,0,0,.06)";

    }


    else if (
      role ===
      "subtotal"
    ) {

      element.style.border =
        "2px dashed #555";

      element.style.background =
        "rgba(0,0,0,.04)";

    }


    else if (
      role ===
      "total"
    ) {

      element.style.border =
        "3px double #333";

      element.style.background =
        "rgba(0,0,0,.05)";

    }


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
      createBoxDisplayLabel(
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
     DISPLAY LABEL
  ======================================================= */

  function createBoxDisplayLabel(
    box
  ) {

    const role =
      box.box_role ||
      inferRoleFromBox(
        box
      );


    if (
      role ===
      "major"
    ) {

      return `大問${box.major_no || "?"}`;

    }


    if (
      role ===
      "minor"
    ) {

      const major =
        box.major_no
          ? `大問${box.major_no} `
          : "";


      const minor =
        box.minor_no
          ? `問${box.minor_no}`
          : "小問";


      return `${major}${minor} ${
        Number(
          box.points
        ) || 0
      }点`;

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

      return `小計${
        box.subtotal_group || ""
      }`;

    }


    if (
      role ===
      "total"
    ) {

      return "合計";

    }


    return box.label ||
      BOX_ROLES[
        role
      ]?.label ||
      "その他";

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

    let original =
      null;


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
              original.x +
                dx,
              0,
              canvas.width -
                box.width
            );


          box.y =
            clamp(
              original.y +
                dy,
              0,
              canvas.height -
                box.height
            );

        }


        if (resizing) {

          box.width =
            clamp(
              original.width +
                dx,
              10,
              canvas.width -
                box.x
            );


          box.height =
            clamp(
              original.height +
                dy,
              10,
              canvas.height -
                box.y
            );

        }


        /*
          小問を移動したら
          親大問を再計算。
        */

        if (
          box.box_role ===
          "minor"
        ) {

          updateParentForMinor(
            box
          );

        }


        updateBoxElement(
          element,
          page,
          box
        );


        updateAllBoxLabels();

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
     UPDATE PARENT
  ======================================================= */

  function updateParentForMinor(
    box
  ) {

    const parent =
      findContainingMajor(
        box
      );


    if (parent) {

      box.parent_box_id =
        parent.id;

      box.major_no =
        parent.major_no ||
        getMajorNumber(
          parent
        );


      box.minor_no =
        getNextMinorNumberIgnoringSelf(
          parent.id,
          box.id
        );

    } else {

      box.parent_box_id =
        null;

    }

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
     SELECT
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


    const roleSelect =
      document.getElementById(
        "boxRole"
      );


    if (roleSelect) {

      roleSelect.value =
        box.box_role ||
        inferRoleFromBox(
          box
        );

    }


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


    const role =
      getCurrentRole();


    selectedBox.box_role =
      role;


    selectedBox.box_type =
      BOX_ROLES[
        role
      ]?.defaultBoxType ||
      "other";


    /*
      大問・QR・小計・合計などは
      配点を持たせない。
    */

    if (
      [
        "major",
        "qr",
        "subtotal",
        "total",
        "name",
        "student_no",
        "instruction",
        "other"
      ].includes(
        role
      )
    ) {

      if (
        role !==
        "other"
      ) {

        selectedBox.points =
          0;

      }

    } else {

      const points =
        Number(
          pointsInput?.value
        );


      if (
        !Number.isFinite(
          points
        ) ||
        points < 0
      ) {

        throw new Error(
          "配点は0以上の数値を入力してください。"
        );

      }


      selectedBox.points =
        points;

    }


    selectedBox.label =
      labelInput?.value.trim() ||
      createDefaultLabel(
        role
      );


    selectedBox.question_id =
      questionIdInput?.value.trim() ||
      null;


    /*
      大問なら番号を再設定
    */

    if (
      role ===
      "major"
    ) {

      if (
        !selectedBox.major_no
      ) {

        selectedBox.major_no =
          getNextMajorNumber();

      }


      selectedBox.parent_box_id =
        null;


      selectedBox.minor_no =
        null;

    }


    /*
      小問なら親を自動判定
    */

    if (
      role ===
      "minor"
    ) {

      updateParentForMinor(
        selectedBox
      );

    }


    /*
      小計
    */

    if (
      role ===
      "subtotal"
    ) {

      const parent =
        findContainingMajor(
          selectedBox
        );


      if (parent) {

        selectedBox.major_no =
          parent.major_no;

        selectedBox.subtotal_group =
          parent.major_no;

      } else if (
        !selectedBox.subtotal_group
      ) {

        selectedBox.subtotal_group =
          getNextSubtotalGroup();

      }

    }


    /*
      その他の親関係
    */

    if (
      role !==
        "minor" &&
      role !==
        "major"
    ) {

      if (
        role !==
          "subtotal"
      ) {

        selectedBox.parent_box_id =
          null;

      }

    }


    updateAllBoxLabels();

  }


  /* =======================================================
     UPDATE LABELS
  ======================================================= */

  function updateAllBoxLabels() {

    boxes.forEach(
      box => {

        const element =
          document.querySelector(
            `[data-box-id="${CSS.escape(
              box.id
            )}"]`
          );


        if (!element) {
          return;
        }


        const label =
          element.querySelector(
            ".box-label"
          );


        if (label) {

          label.textContent =
            createBoxDisplayLabel(
              box
            );

        }


        element.dataset.role =
          box.box_role ||
          "other";

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


    /*
      親大問を削除した場合、
      子小問も親なしにする。
    */

    boxes
      .filter(
        box =>
          box.parent_box_id ===
          selectedBox.id
      )
      .forEach(
        child => {

          child.parent_box_id =
            null;

        }
      );


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


    updateAllBoxLabels();

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
        選択中の設定を反映
      */

      applySelectedBox();


      /*
        全小問の親を再計算。
      */

      boxes
        .filter(
          box =>
            box.box_role ===
            "minor"
        )
        .forEach(
          box => {

            updateParentForMinor(
              box
            );

          }
        );


      /*
        大問番号を再計算。
      */

      renumberMajors();


      /*
        小問番号を大問ごとに再計算。
      */

      renumberMinors();


      /*
        小計グループ
      */

      assignSubtotalGroups();


      /*
        並び順
      */

      boxes.forEach(
        (
          box,
          index
        ) => {

          box.sort_order =
            index;

        }
      );


      /*
        チェック
      */

      validateBoxes();


      saveButton.disabled =
        true;


      setStatus(
        "枠を保存しています..."
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

        parent_box_idは
        同じinsert内のIDを参照する。
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

              box_type:
                box.box_type ||
                "other",

              label:
                box.label ||
                null,

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

              question_id:
                box.question_id ||
                null,

              points:
                Number(
                  box.points
                ) || 0,

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
                box.sort_order,

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


      await loadTestPages();


      setStatus(
        "枠設定を保存しました。"
      );


      alert(
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
        box,
        index
      ) => {

        box.major_no =
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
      大問の外にある小問。

      親がない場合は
      独立した大問番号を与える。
    */

    const orphanMinors =
      boxes
        .filter(
          box =>
            box.box_role ===
              "minor" &&
            !box.parent_box_id
        )
        .sort(
          compareBoxes
        );


    orphanMinors.forEach(
      (
        child,
        index
      ) => {

        child.major_no =
          majors.length +
          index +
          1;

        child.minor_no =
          1;

      }
    );

  }


  /* =======================================================
     SUBTOTAL GROUPS
  ======================================================= */

  function assignSubtotalGroups() {

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

            subtotal.major_no =
              parent.major_no;

            subtotal.subtotal_group =
              parent.major_no;

          } else if (
            !subtotal.subtotal_group
          ) {

            subtotal.subtotal_group =
              getNextSubtotalGroup();

          }

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
            `${box.label || "枠"}のページ番号が不正です。`
          );

        }


        if (
          Number(box.width) <= 0 ||
          Number(box.height) <= 0
        ) {

          throw new Error(
            `${box.label || "枠"}のサイズが不正です。`
          );

        }


        if (
          Number(box.points) < 0
        ) {

          throw new Error(
            `${box.label || "枠"}の配点が不正です。`
          );

        }


        /*
          親は必ず同じテスト。
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
              `${box.label || "小問"}の親大問が見つかりません。`
            );

          }


          if (
            parent.box_role !==
            "major"
          ) {

            throw new Error(
              `${box.label || "小問"}の親が大問ではありません。`
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
              `${box.label || "小問"}と親大問のページが違います。`
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

  function inferRoleFromBox(
    box
  ) {

    if (
      box.box_role &&
      BOX_ROLES[
        box.box_role
      ]
    ) {

      return box.box_role;

    }


    if (
      box.box_type ===
      "qr"
    ) {

      return "qr";

    }


    if (
      box.box_type ===
      "subtotal"
    ) {

      return "subtotal";

    }


    if (
      box.box_type ===
      "total"
    ) {

      return "total";

    }


    if (
      box.box_type ===
      "question"
    ) {

      return "major";

    }


    return "minor";

  }


  /* =======================================================
     PDF / IMAGE
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
