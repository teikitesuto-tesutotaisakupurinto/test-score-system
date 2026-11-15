(function () {

  "use strict";


  let selectedTestId = null;

  let pages = [];

  let boxes = [];

  let selectedBox = null;


  const testSelect =
    document.getElementById(
      "testSelect"
    );

  const viewer =
    document.getElementById(
      "viewer"
    );

  const status =
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


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    const profile =
      await requireTeacher();


    if (!profile) {
      return;
    }


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name ||
      "先生";


    await loadTests();

    setupEvents();

  }


  /* =====================================================
     テスト
  ===================================================== */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
        .select(`
          id,
          name
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {
      throw error;
    }


    testSelect.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        (data || [])
          .map(
            test => `

              <option
                value="${escapeHtml(test.id)}"
              >
                ${escapeHtml(test.name)}
              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =====================================================
     イベント
  ===================================================== */

  function setupEvents() {

    testSelect.addEventListener(
      "change",
      async () => {

        selectedTestId =
          testSelect.value ||
          null;

        selectedBox =
          null;

        panel.hidden =
          true;

        await loadTemplate();

      }
    );


    document.getElementById(
      "saveButton"
    ).addEventListener(
      "click",
      saveBoxes
    );


    document.getElementById(
      "deleteButton"
    ).addEventListener(
      "click",
      deleteSelected
    );


    document.getElementById(
      "applyButton"
    ).addEventListener(
      "click",
      applyBox
    );


    document.getElementById(
      "closeButton"
    ).addEventListener(
      "click",
      () => {

        panel.hidden =
          true;

        selectedBox =
          null;

      }
    );


    document.getElementById(
      "logoutButton"
    ).addEventListener(
      "click",
      logout
    );

  }


  /* =====================================================
     解答用紙読み込み
  ===================================================== */

  async function loadTemplate() {

    viewer.innerHTML =
      "";

    boxes =
      [];

    pages =
      [];


    if (!selectedTestId) {

      status.textContent =
        "解答用紙を登録したテストを選択してください。";

      return;

    }


    const {
      data:
        pageData,
      error:
        pageError
    } =
      await supabaseClient
        .from("test_pages")
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
            ascending: true
          }
        );


    if (pageError) {
      throw pageError;
    }


    pages =
      pageData || [];


    if (!pages.length) {

      status.textContent =
        "先に解答用紙を登録してください。";

      return;

    }


    const {
      data:
        boxData,
      error:
        boxError
    } =
      await supabaseClient
        .from("layout_boxes")
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
          height
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


    await renderPages();


    status.textContent =
      "解答用紙上をドラッグして解答欄を設定してください。";

  }


  /* =====================================================
     ページ表示
  ===================================================== */

  async function renderPages() {

    viewer.innerHTML =
      "";


    for (
      const page
      of pages
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
        "box-layer";


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
        .from("answer-files")
        .createSignedUrl(
          page.file_path,
          3600
        );


      if (error) {
        continue;
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


      setupNewBoxDrawing(
        wrapper,
        layer,
        page
      );


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

  }


  /* =====================================================
     新規枠
  ===================================================== */

  function setupNewBoxDrawing(
    wrapper,
    layer,
    page
  ) {

    let drawing =
      false;

    let startX =
      0;

    let startY =
      0;

    let temporary =
      null;


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


        const rect =
          layer.getBoundingClientRect();


        startX =
          event.clientX -
          rect.left;

        startY =
          event.clientY -
          rect.top;


        temporary =
          document.createElement(
            "div"
          );


        temporary.className =
          "box";


        temporary.style.left =
          `${startX / rect.width * 100}%`;

        temporary.style.top =
          `${startY / rect.height * 100}%`;

        temporary.style.width =
          "0%";

        temporary.style.height =
          "0%";


        layer.appendChild(
          temporary
        );

      }
    );


    layer.addEventListener(
      "mousemove",
      event => {

        if (
          !drawing ||
          !temporary
        ) {
          return;
        }


        const rect =
          layer.getBoundingClientRect();


        const currentX =
          event.clientX -
          rect.left;

        const currentY =
          event.clientY -
          rect.top;


        const x =
          Math.min(
            startX,
            currentX
          );

        const y =
          Math.min(
            startY,
            currentY
          );

        const width =
          Math.abs(
            currentX -
            startX
          );

        const height =
          Math.abs(
            currentY -
            startY
          );


        temporary.style.left =
          `${x / rect.width * 100}%`;

        temporary.style.top =
          `${y / rect.height * 100}%`;

        temporary.style.width =
          `${width / rect.width * 100}%`;

        temporary.style.height =
          `${height / rect.height * 100}%`;

      }
    );


    layer.addEventListener(
      "mouseup",
      event => {

        if (
          !drawing ||
          !temporary
        ) {
          return;
        }


        drawing =
          false;


        const rect =
          layer.getBoundingClientRect();


        const x =
          parseFloat(
            temporary.style.left
          ) /
          100 *
          page.width_px;


        const y =
          parseFloat(
            temporary.style.top
          ) /
          100 *
          page.height_px;


        const width =
          parseFloat(
            temporary.style.width
          ) /
          100 *
          page.width_px;


        const height =
          parseFloat(
            temporary.style.height
          ) /
          100 *
          page.height_px;


        temporary.remove();


        if (
          width < 10 ||
          height < 10
        ) {
          return;
        }


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

          x,
          y,
          width,
          height

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


  /* =====================================================
     枠表示
  ===================================================== */

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


    updateElement(
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
        box.points || 0
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


    enableMoveResize(
      element,
      resize,
      wrapper,
      page,
      box
    );

  }


  /* =====================================================
     移動・リサイズ
  ===================================================== */

  function enableMoveResize(
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

    let startX =
      0;

    let startY =
      0;

    let original;


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


        startX =
          event.clientX;

        startY =
          event.clientY;


        original = {

          x:
            box.x,

          y:
            box.y,

          width:
            box.width,

          height:
            box.height

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


        const displayWidth =
          canvas.getBoundingClientRect()
            .width;


        const scale =
          page.width_px /
          displayWidth;


        const dx =
          (
            event.clientX -
            startX
          ) *
          scale;


        const dy =
          (
            event.clientY -
            startY
          ) *
          scale;


        if (moving) {

          box.x =
            clamp(
              original.x + dx,
              0,
              page.width_px -
                box.width
            );


          box.y =
            clamp(
              original.y + dy,
              0,
              page.height_px -
                box.height
            );

        }


        if (resizing) {

          box.width =
            clamp(
              original.width + dx,
              10,
              page.width_px -
                box.x
            );


          box.height =
            clamp(
              original.height + dy,
              10,
              page.height_px -
                box.y
            );

        }


        updateElement(
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


  /* =====================================================
     表示更新
  ===================================================== */

  function updateElement(
    element,
    page,
    box
  ) {

    element.style.left =
      `${box.x / page.width_px * 100}%`;

    element.style.top =
      `${box.y / page.height_px * 100}%`;

    element.style.width =
      `${box.width / page.width_px * 100}%`;

    element.style.height =
      `${box.height / page.height_px * 100}%`;

  }


  /* =====================================================
     Select
  ===================================================== */

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


  /* =====================================================
     Apply
  ===================================================== */

  function applyBox() {

    if (!selectedBox) {
      return;
    }


    selectedBox.label =
      labelInput.value.trim() ||
      "設問";


    selectedBox.points =
      Number(
        pointsInput.value
      ) || 0;


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


  /* =====================================================
     Delete
  ===================================================== */

  function deleteSelected() {

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

    panel.hidden =
      true;

  }


  /* =====================================================
     Save
  ===================================================== */

  async function saveBoxes() {

    if (!selectedTestId) {

      alert(
        "テストを選択してください。"
      );

      return;

    }


    /*
      既存枠を削除
    */

    const {
      error:
        deleteError
    } =
      await supabaseClient
        .from("layout_boxes")
        .delete()
        .eq(
          "test_id",
          selectedTestId
        );


    if (deleteError) {
      throw deleteError;
    }


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
            box.label,

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


    if (rows.length) {

      const {
        error
      } =
        await supabaseClient
          .from("layout_boxes")
          .insert(
            rows
          );


      if (error) {
        throw error;
      }

    }


    await loadTemplate();


    alert(
      "解答用紙の解答欄を保存しました。"
    );

  }


  /* =====================================================
     Helpers
  ===================================================== */

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
          reject;

        image.src =
          src;

      }
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


  function escapeHtml(
    value
  ) {

    return String(
      value ??
      ""
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


  initialize();

})();
