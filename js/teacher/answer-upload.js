
/* =========================================================
   テスト成績システム
   答案アップロード 完成版

   対応:
   JPG / JPEG / PNG / WEBP / GIF / BMP
   PDF
   ZIP

   処理:

   ファイル
      ↓
   ページ化
      ↓
   test_pages / layout_boxes 読み込み
      ↓
   QR枠があればQR枠を優先
      ↓
   QR読み取り
      ↓
   QRあり = 新しい答案
      ↓
   QRなし = 直前の答案の続き
      ↓
   生徒特定
      ↓
   answer_sheets
      ↓
   Storage
      ↓
   answer_sheet_pages
      ↓
   全処理成功
      ↓
   完了

   source_page_id は使用しない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let tests = [];

  let selectedFiles = [];

  let currentTestId = "";

  let testPages = [];

  let layoutBoxes = [];

  let students = [];


  /* =======================================================
     DOM
  ======================================================= */

  function el(id) {
    return document.getElementById(id);
  }


  const teacherName =
    el("teacherName");

  const testElement =
    el("test");

  const answerTypeElement =
    el("answerType");

  const filesElement =
    el("files");

  const fileListElement =
    el("fileList");

  const uploadButton =
    el("uploadButton");

  const clearButton =
    el("clearButton");

  const messageElement =
    el("message");

  const processingArea =
    el("processingArea");

  const processingTitle =
    el("processingTitle");

  const progressBar =
    el("progressBar");

  const progressText =
    el("progressText");

  const processingLog =
    el("processingLog");

  const uploadList =
    el("uploadList");


  /* =======================================================
     INIT
  ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      const profile =
        await getProfile();


      if (!profile) {

        location.replace(
          "/login"
        );

        return;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        location.replace(
          "/student/dashboard"
        );

        return;

      }


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      setupEvents();

      await loadTests();


    } catch (error) {

      console.error(
        "initialize:",
        error
      );


      showMessage(
        error.message ||
        "初期化に失敗しました。",
        true
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    filesElement?.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );


        /*
         * 同じファイルを再選択可能にする。
         */

        event.target.value =
          "";

      }
    );


    testElement?.addEventListener(
      "change",
      async () => {

        currentTestId =
          testElement.value ||
          "";


        testPages =
          [];

        layoutBoxes =
          [];


        if (!currentTestId) {

          showMessage(
            "テストを選択してください。"
          );

          return;

        }


        try {

          showMessage(
            "解答用紙・枠設定を読み込んでいます..."
          );


          await loadTestLayout(
            currentTestId
          );


          showMessage(
            "テストを選択しました。"
          );


        } catch (error) {

          console.error(
            "layout:",
            error
          );


          showMessage(
            error.message ||
            "解答用紙設定の読み込みに失敗しました。",
            true
          );

        }

      }
    );


    uploadButton?.addEventListener(
      "click",
      uploadAnswers
    );


    clearButton?.addEventListener(
      "click",
      clearAll
    );


    el("logoutButton")
      ?.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          if (
            typeof logout ===
            "function"
          ) {

            await logout();

          }

        }
      );

  }


  /* =======================================================
     TESTS
  ======================================================= */

  async function loadTests() {

    if (!testElement) {

      throw new Error(
        "テスト選択欄がありません。"
      );

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("tests")
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


    testElement.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

    `;


    for (
      const test
      of tests
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        test.id;


      const parts = [
        test.name,
        test.subject,
        test.grade
      ]
        .filter(
          value =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        );


      option.textContent =
        parts.join(
          " / "
        );


      testElement.appendChild(
        option
      );

    }

  }


  /* =======================================================
     TEST LAYOUT
  ======================================================= */

  async function loadTestLayout(
    testId
  ) {

    /*
     * test_pages
     */

    const {
      data: pages,
      error: pageError
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
          testId
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


    /*
     * layout_boxes
     *
     * source_page_idは絶対に使わない。
     */

    const {
      data: boxes,
      error: boxError
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
          subtotal_group
        `)
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
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


    testPages =
      pages || [];


    layoutBoxes =
      boxes || [];


    addLog(
      `解答用紙 ${testPages.length}ページ`
    );


    addLog(
      `設定枠 ${layoutBoxes.length}個`
    );

  }


  /* =======================================================
     FILES
  ======================================================= */

  function addFiles(
    files
  ) {

    const allowed =
      new Set([
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "pdf",
        "zip"
      ]);


    for (
      const file
      of Array.from(
        files || []
      )
    ) {

      const extension =
        getExtension(
          file.name
        );


      if (
        !allowed.has(
          extension
        )
      ) {

        showMessage(
          `${file.name} は対応していない形式です。`,
          true
        );

        continue;

      }


      const duplicate =
        selectedFiles.some(
          existing =>
            existing.name ===
              file.name &&
            existing.size ===
              file.size &&
            existing.lastModified ===
              file.lastModified
        );


      if (!duplicate) {

        selectedFiles.push(
          file
        );

      }

    }


    renderFiles();

  }


  function renderFiles() {

    if (!fileListElement) {

      return;

    }


    if (!selectedFiles.length) {

      fileListElement.hidden =
        true;

      fileListElement.innerHTML =
        "";

      return;

    }


    fileListElement.hidden =
      false;


    fileListElement.innerHTML =
      "";


    for (
      let index = 0;
      index < selectedFiles.length;
      index++
    ) {

      const file =
        selectedFiles[index];


      const row =
        document.createElement(
          "div"
        );


      row.style.padding =
        "9px 0";


      row.style.borderBottom =
        "1px solid #d0d6dc";


      const line =
        document.createElement(
          "div"
        );


      line.style.display =
        "flex";


      line.style.alignItems =
        "center";


      line.style.justifyContent =
        "space-between";


      line.style.gap =
        "10px";


      const name =
        document.createElement(
          "span"
        );


      name.textContent =
        `${file.name} (${formatBytes(file.size)})`;


      const remove =
        document.createElement(
          "button"
        );


      remove.type =
        "button";


      remove.className =
        "btn";


      remove.textContent =
        "削除";


      remove.addEventListener(
        "click",
        () => {

          selectedFiles.splice(
            index,
            1
          );


          renderFiles();

        }
      );


      line.appendChild(
        name
      );


      line.appendChild(
        remove
      );


      row.appendChild(
        line
      );


      fileListElement.appendChild(
        row
      );

    }

  }


  /* =======================================================
     UPLOAD
  ======================================================= */

  async function uploadAnswers() {

    currentTestId =
      testElement?.value ||
      "";


    if (!currentTestId) {

      showMessage(
        "テストを選択してください。",
        true
      );

      return;

    }


    if (!selectedFiles.length) {

      showMessage(
        "答案ファイルを選択してください。",
        true
      );

      return;

    }


    /*
     * テストの枠設定を
     * 必ず最新状態にする。
     */

    await loadTestLayout(
      currentTestId
    );


    setBusy(
      true
    );


    startProcessing();


    try {

      const total =
        selectedFiles.length;


      for (
        let index = 0;
        index < total;
        index++
      ) {

        const file =
          selectedFiles[index];


        updateProgress(
          Math.round(
            index /
            total *
            100
          ),
          `${index + 1}/${total} ファイルを処理中`
        );


        addLog(
          `開始: ${file.name}`
        );


        if (
          answerTypeElement?.value ===
          "model"
        ) {

          await processModelAnswer(
            currentTestId,
            file
          );

        } else {

          await processStudentAnswer(
            currentTestId,
            file
          );

        }


        addLog(
          `完了: ${file.name}`
        );

      }


      updateProgress(
        100,
        "すべての処理が完了しました"
      );


      showMessage(
        `${total}件の答案処理が完了しました。`
      );


      selectedFiles =
        [];


      renderFiles();


    } catch (error) {

      console.error(
        "UPLOAD ERROR:",
        error
      );


      addLog(
        `エラー: ${error.message}`,
        true
      );


      showMessage(
        error.message ||
        "答案処理に失敗しました。",
        true
      );

    } finally {

      setBusy(
        false
      );

    }

  }


  /* =======================================================
     STUDENT ANSWER
  ======================================================= */

  async function processStudentAnswer(
    testId,
    file
  ) {

    addLog(
      "ファイルをページ化しています..."
    );


    const pages =
      await parseFile(
        file
      );


    if (!pages.length) {

      throw new Error(
        `${file.name}: ページを取得できませんでした。`
      );

    }


    addLog(
      `${pages.length}ページを取得しました。`
    );


    /*
     * ページごとにQRを読む。
     */

    const groups =
      await groupPagesByQr(
        pages
      );


    addLog(
      `${groups.length}答案に分割しました。`
    );


    /*
     * 答案ごとに保存。
     */

    for (
      let index = 0;
      index < groups.length;
      index++
    ) {

      const group =
        groups[index];


      addLog(
        `答案 ${index + 1}/${groups.length} を処理中`
      );


      await saveAnswerGroup(
        testId,
        group
      );

    }

  }


  /* =======================================================
     FILE PARSER
  ======================================================= */

  async function parseFile(
    file
  ) {

    /*
     * 既存parserがあるなら優先。
     */

    if (
      window.TEST_SCORE_FILES &&
      typeof
        window.TEST_SCORE_FILES.parseFile ===
        "function"
    ) {

      const parsed =
        await window.TEST_SCORE_FILES.parseFile(
          file
        );


      return normalizePages(
        parsed
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

      return parsePdf(
        file
      );

    }


    if (
      extension ===
      "zip"
    ) {

      return parseZip(
        file
      );

    }


    return [
      await parseImage(
        file
      )
    ];

  }


  /* =======================================================
     NORMALIZE PAGES
  ======================================================= */

  function normalizePages(
    pages
  ) {

    if (
      !Array.isArray(
        pages
      )
    ) {

      return [];

    }


    return pages.map(
      page => ({

        blob:
          page.blob,

        name:
          page.name ||
          "page",

        fileType:
          page.fileType ||
          page.type ||
          "image/png",

        width:
          Number(
            page.width ||
            page.width_px ||
            0
          ),

        height:
          Number(
            page.height ||
            page.height_px ||
            0
          )

      })
    );

  }


  /* =======================================================
     PDF
  ======================================================= */

  async function parsePdf(
    file
  ) {

    if (
      typeof pdfjsLib ===
      "undefined"
    ) {

      throw new Error(
        "PDF処理ライブラリが読み込まれていません。"
      );

    }


    const buffer =
      await file.arrayBuffer();


    const pdf =
      await pdfjsLib
        .getDocument({
          data:
            buffer
        })
        .promise;


    const pages =
      [];


    for (
      let number = 1;
      number <=
      pdf.numPages;
      number++
    ) {

      addLog(
        `PDF ${number}/${pdf.numPages} ページを画像化`
      );


      const pdfPage =
        await pdf.getPage(
          number
        );


      const base =
        pdfPage.getViewport({
          scale:
            1
        });


      /*
       * QR読み取り・枠座標用に
       * 十分な解像度を確保。
       */

      const scale =
        Math.min(
          3,
          Math.max(
            1,
            3000 /
            Math.max(
              base.width,
              base.height
            )
          )
        );


      const viewport =
        pdfPage.getViewport({
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


      await pdfPage
        .render({

          canvasContext:
            canvas.getContext(
              "2d"
            ),

          viewport

        })
        .promise;


      const blob =
        await canvasToBlob(
          canvas
        );


      pages.push({

        blob,

        name:
          `${file.name} - page ${number}`,

        fileType:
          "image/png",

        width:
          canvas.width,

        height:
          canvas.height

      });

    }


    return pages;

  }


  /* =======================================================
     ZIP
  ======================================================= */

  async function parseZip(
    file
  ) {

    if (
      typeof JSZip ===
      "undefined"
    ) {

      throw new Error(
        "ZIP処理ライブラリが読み込まれていません。"
      );

    }


    const zip =
      await JSZip.loadAsync(
        file
      );


    const entries =
      Object.values(
        zip.files
      )
        .filter(
          entry =>
            !entry.dir
        )
        .sort(
          (
            a,
            b
          ) =>
            a.name.localeCompare(
              b.name,
              undefined,
              {
                numeric:
                  true
              }
            )
        );


    const pages =
      [];


    for (
      const entry
      of entries
    ) {

      const extension =
        getExtension(
          entry.name
        );


      if (
        extension ===
        "pdf"
      ) {

        const blob =
          await entry.async(
            "blob"
          );


        const pdfFile =
          new File(
            [
              blob
            ],
            entry.name,
            {
              type:
                "application/pdf"
            }
          );


        pages.push(
          ...await parsePdf(
            pdfFile
          )
        );


        continue;

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

        const blob =
          await entry.async(
            "blob"
          );


        const imageFile =
          new File(
            [
              blob
            ],
            entry.name
          );


        pages.push(
          await parseImage(
            imageFile
          )
        );

      }

    }


    return pages;

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  async function parseImage(
    file
  ) {

    const image =
      await loadImage(
        file
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


    const blob =
      await canvasToBlob(
        canvas
      );


    return {

      blob,

      name:
        file.name,

      fileType:
        "image/png",

      width:
        canvas.width,

      height:
        canvas.height

    };

  }


  /* =======================================================
     QR GROUP
  ======================================================= */

  async function groupPagesByQr(
    pages
  ) {

    const groups =
      [];


    let currentGroup =
      null;


    for (
      let index = 0;
      index < pages.length;
      index++
    ) {

      const page =
        pages[index];


      const pageNo =
        index + 1;


      updateProgress(
        Math.round(
          index /
          pages.length *
          100
        ),
        `QR読み取り ${pageNo}/${pages.length}`
      );


      addLog(
        `ページ${pageNo}: QRを探索しています...`
      );


      /*
       * QR枠を取得。
       */

      const qr =
        await readQrForPage(
          page,
          pageNo
        );


      if (qr) {

        addLog(
          `ページ${pageNo}: QR検出「${qr}」`
        );


        /*
         * QRあり
         * = 新しい答案
         */

        currentGroup = {

          qrValue:
            qr,

          pages:
            []

        };


        groups.push(
          currentGroup
        );

      } else {

        addLog(
          `ページ${pageNo}: QRなし`
        );

      }


      /*
       * 最初のページにQRがない
       */

      if (!currentGroup) {

        currentGroup = {

          qrValue:
            null,

          pages:
            []

        };


        groups.push(
          currentGroup
        );


        addLog(
          `ページ${pageNo}: 未紐付け答案として開始`
        );

      }


      /*
       * 現在の答案に追加
       */

      currentGroup.pages.push(
        page
      );

    }


    return groups;

  }


  /* =======================================================
     QR PAGE
  ======================================================= */

  async function readQrForPage(
    page,
    pageNo
  ) {

    /*
     * まず、そのページのQR枠。
     */

    const qrBoxes =
      layoutBoxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            pageNo
          ) &&
          (
            String(
              box.box_type ||
              ""
            ).toLowerCase() ===
            "qr" ||
            String(
              box.box_role ||
              ""
            ).toLowerCase() ===
            "qr"
          )
      );


    /*
     * QR枠あり
     */

    for (
      const box
      of qrBoxes
    ) {

      addLog(
        `ページ${pageNo}: QR枠を使用`
      );


      const cropped =
        await cropBlobByBox(
          page,
          box,
          pageNo
        );


      const qr =
        await decodeQrBlob(
          cropped
        );


      if (qr) {

        return normalizeQr(
          qr
        );

      }

    }


    /*
     * QR枠で読めなかった場合、
     * ページ全体を探索。
     */

    addLog(
      `ページ${pageNo}: ページ全体からQR探索`
    );


    const fullQr =
      await decodeQrBlob(
        page.blob
      );


    return fullQr
      ? normalizeQr(
          fullQr
        )
      : null;

  }


  /* =======================================================
     CROP QR BOX
  ======================================================= */

  async function cropBlobByBox(
    page,
    box,
    pageNo
  ) {

    const image =
      await loadImage(
        page.blob
      );


    /*
     * 解答用紙登録時のサイズ。
     */

    const layoutPage =
      testPages.find(
        item =>
          Number(
            item.page_no
          ) ===
          Number(
            pageNo
          )
      );


    let sourceWidth =
      Number(
        layoutPage?.width_px ||
        0
      );


    let sourceHeight =
      Number(
        layoutPage?.height_px ||
        0
      );


    /*
     * 登録サイズがない場合は
     * 現在画像サイズをそのまま使う。
     */

    if (
      sourceWidth <= 0 ||
      sourceHeight <= 0
    ) {

      sourceWidth =
        page.width;


      sourceHeight =
        page.height;

    }


    /*
     * 登録座標
     * →
     * 現在画像座標
     */

    const scaleX =
      image.naturalWidth /
      sourceWidth;


    const scaleY =
      image.naturalHeight /
      sourceHeight;


    const x =
      Math.max(
        0,
        Math.round(
          Number(
            box.x
          ) *
          scaleX
        )
      );


    const y =
      Math.max(
        0,
        Math.round(
          Number(
            box.y
          ) *
          scaleY
        )
      );


    const width =
      Math.max(
        1,
        Math.round(
          Number(
            box.width
          ) *
          scaleX
        )
      );


    const height =
      Math.max(
        1,
        Math.round(
          Number(
            box.height
          ) *
          scaleY
        )
      );


    const safeWidth =
      Math.max(
        1,
        Math.min(
          width,
          image.naturalWidth -
          x
        )
      );


    const safeHeight =
      Math.max(
        1,
        Math.min(
          height,
          image.naturalHeight -
          y
        )
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    /*
     * QRは少し拡大してから読む。
     */

    const outputScale =
      2;


    canvas.width =
      safeWidth *
      outputScale;


    canvas.height =
      safeHeight *
      outputScale;


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

      x,
      y,
      safeWidth,
      safeHeight,

      0,
      0,
      canvas.width,
      canvas.height
    );


    return canvasToBlob(
      canvas
    );

  }


  /* =======================================================
     QR DECODE
  ======================================================= */

  async function decodeQrBlob(
    blob
  ) {

    if (
      typeof jsQR ===
      "undefined"
    ) {

      throw new Error(
        "QR読み取りライブラリが読み込まれていません。"
      );

    }


    const image =
      await loadImage(
        blob
      );


    /*
     * 複数サイズで試す。
     */

    const sizes = [
      3000,
      2400,
      1800,
      1200
    ];


    for (
      const maxSize
      of sizes
    ) {

      const result =
        await decodeQrAtSize(
          image,
          maxSize
        );


      if (result) {

        return result;

      }

    }


    return null;

  }


  async function decodeQrAtSize(
    image,
    maxSize
  ) {

    let width =
      image.naturalWidth;


    let height =
      image.naturalHeight;


    if (
      width > maxSize ||
      height > maxSize
    ) {

      const ratio =
        Math.min(
          maxSize / width,
          maxSize / height
        );


      width =
        Math.round(
          width *
          ratio
        );


      height =
        Math.round(
          height *
          ratio
        );

    }


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;


    canvas.height =
      height;


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
      width,
      height
    );


    let imageData =
      context.getImageData(
        0,
        0,
        width,
        height
      );


    /*
     * 通常
     */

    let result =
      jsQR(
        imageData.data,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (
      result?.data
    ) {

      return result.data;

    }


    /*
     * 二値化
     */

    const thresholded =
      new Uint8ClampedArray(
        imageData.data
      );


    for (
      let i = 0;
      i < thresholded.length;
      i += 4
    ) {

      const gray =
        Math.round(
          thresholded[i] * 0.299 +
          thresholded[i + 1] * 0.587 +
          thresholded[i + 2] * 0.114
        );


      const value =
        gray < 160
          ? 0
          : 255;


      thresholded[i] =
        value;

      thresholded[i + 1] =
        value;

      thresholded[i + 2] =
        value;

      thresholded[i + 3] =
        255;

    }


    result =
      jsQR(
        thresholded,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (
      result?.data
    ) {

      return result.data;

    }


    /*
     * 反転
     */

    const inverted =
      new Uint8ClampedArray(
        imageData.data
      );


    for (
      let i = 0;
      i < inverted.length;
      i += 4
    ) {

      inverted[i] =
        255 -
        inverted[i];

      inverted[i + 1] =
        255 -
        inverted[i + 1];

      inverted[i + 2] =
        255 -
        inverted[i + 2];

    }


    result =
      jsQR(
        inverted,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    return result?.data ||
      null;

  }


  /* =======================================================
     NORMALIZE QR
  ======================================================= */

  function normalizeQr(
    value
  ) {

    const text =
      String(
        value ||
        ""
      ).trim();


    /*
     * JSON
     */

    try {

      const json =
        JSON.parse(
          text
        );


      for (
        const key
        of [
          "student_no",
          "studentNo",
          "student_id",
          "studentId",
          "id"
        ]
      ) {

        if (
          json[key] !==
            undefined &&
          json[key] !==
            null
        ) {

          return String(
            json[key]
          ).trim();

        }

      }

    } catch (_) {}


    /*
     * URL
     */

    try {

      const url =
        new URL(
          text
        );


      for (
        const key
        of [
          "student_no",
          "studentNo",
          "student_id",
          "studentId",
          "student"
        ]
      ) {

        const value =
          url.searchParams.get(
            key
          );


        if (value) {

          return value.trim();

        }

      }

    } catch (_) {}


    return text;

  }


  /* =======================================================
     SAVE ANSWER GROUP
  ======================================================= */

  async function saveAnswerGroup(
    testId,
    group
  ) {

    addLog(
      group.qrValue
        ? `QR: ${group.qrValue}`
        : "QRなし: 未紐付け答案"
    );


    /*
     * 生徒特定
     */

    const student =
      group.qrValue
        ? await findStudentByQr(
            group.qrValue
          )
        : null;


    if (student) {

      addLog(
        `生徒特定: ${student.student_no || ""} ${student.name || ""}`
      );

    } else if (
      group.qrValue
    ) {

      addLog(
        "QRは読めましたが生徒を特定できませんでした。",
        true
      );

    }


    /*
     * answer_sheets
     *
     * 先に作成する。
     */

    const answer =
      await createAnswerSheet(
        testId,
        student,
        group.qrValue
      );


    addLog(
      `答案ID作成: ${answer.id}`
    );


    const uploadedPaths =
      [];


    try {

      /*
       * 全ページStorage保存
       */

      for (
        let index = 0;
        index < group.pages.length;
        index++
      ) {

        const page =
          group.pages[index];


        const pageNo =
          index + 1;


        addLog(
          `ページ ${pageNo}/${group.pages.length} をStorageへ保存`
        );


        const path =
          `${testId}/${answer.id}/page-${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}.png`;


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
              page.blob,
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

          throw uploadError;

        }


        uploadedPaths.push(
          path
        );


        /*
         * answer_sheet_pages
         */

        await saveAnswerPage({

          answerSheetId:
            answer.id,

          pageNo,

          storagePath:
            path,

          originalName:
            page.name ||
            "page",

          fileType:
            "image/png",

          width:
            page.width,

          height:
            page.height

        });


        /*
         * 1ページ目のfile_path
         */

        if (
          pageNo ===
          1
        ) {

          const {
            error:
              updateError
          } =
            await supabaseClient
              .from(
                "answer_sheets"
              )
              .update({

                file_path:
                  path

              })
              .eq(
                "id",
                answer.id
              );


          if (updateError) {

            throw updateError;

          }

        }

      }


      /*
       * 生徒情報を確定。
       */

      if (student) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "answer_sheets"
            )
            .update({

              student_id:
                student.id,

              qr_token:
                group.qrValue,

              status:
                "matched"

            })
            .eq(
              "id",
              answer.id
            );


        if (error) {

          throw error;

        }

      }


      addLog(
        `答案 ${answer.id} の全${group.pages.length}ページを登録完了`
      );


    } catch (error) {

      /*
       * 途中失敗時はStorageとDBを
       * 可能な範囲でロールバック。
       */

      if (
        uploadedPaths.length
      ) {

        await supabaseClient
          .storage
          .from(
            "answer-files"
          )
          .remove(
            uploadedPaths
          );

      }


      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .delete()
        .eq(
          "answer_sheet_id",
          answer.id
        );


      await supabaseClient
        .from(
          "answer_sheets"
        )
        .delete()
        .eq(
          "id",
          answer.id
        );


      throw error;

    }

  }


  /* =======================================================
     ANSWER SHEET
  ======================================================= */

  async function createAnswerSheet(
    testId,
    student,
    qrValue
  ) {

    const status =
      student
        ? "matched"
        : "unmatched";


    /*
     * 現在のanswer_sheetsに合わせる。
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .insert({

          test_id:
            testId,

          student_id:
            student?.id ||
            null,

          qr_token:
            qrValue ||
            null,

          file_path:
            null,

          status

        })
        .select(
          "id"
        )
        .single();


    if (error) {

      throw error;

    }


    return data;

  }


  /* =======================================================
     ANSWER PAGE
  ======================================================= */

  async function saveAnswerPage({
    answerSheetId,
    pageNo,
    storagePath,
    originalName,
    fileType,
    width,
    height
  }) {

    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .upsert(
          {

            answer_sheet_id:
              answerSheetId,

            page_no:
              pageNo,

            file_path:
              storagePath,

            file_type:
              fileType,

            original_name:
              originalName,

            width_px:
              width,

            height_px:
              height

          },
          {
            onConflict:
              "answer_sheet_id,page_no"
          }
        );


    if (error) {

      throw error;

    }

  }


  /* =======================================================
     STUDENT
  ======================================================= */

  async function findStudentByQr(
    qrValue
  ) {

    if (!qrValue) {

      return null;

    }


    let studentNo =
      null;


    /*
     * STUDENT:424990
     */

    const upper =
      qrValue.toUpperCase();


    if (
      upper.startsWith(
        "STUDENT:"
      )
    ) {

      studentNo =
        qrValue
          .substring(
            8
          )
          .trim();

    }


    /*
     * JSON
     */

    if (!studentNo) {

      try {

        const json =
          JSON.parse(
            qrValue
          );


        studentNo =
          json.student_no ||
          json.studentNo ||
          json.student_id ||
          json.studentId ||
          null;

      } catch (_) {}

    }


    /*
     * URL
     */

    if (!studentNo) {

      try {

        const url =
          new URL(
            qrValue
          );


        studentNo =
          url.searchParams.get(
            "student_no"
          ) ||
          url.searchParams.get(
            "studentNo"
          ) ||
          url.searchParams.get(
            "student_id"
          ) ||
          url.searchParams.get(
            "studentId"
          );

      } catch (_) {}

    }


    /*
     * 生徒番号
     */

    if (studentNo) {

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "students"
          )
          .select(
            `
            id,
            student_no,
            name
            `
          )
          .eq(
            "student_no",
            String(
              studentNo
            ).trim()
          )
          .eq(
            "active",
            true
          )
          .maybeSingle();


      if (error) {

        throw error;

      }


      if (data) {

        return data;

      }

    }


    /*
     * UUID
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "students"
        )
        .select(
          `
          id,
          student_no,
          name
          `
        )
        .eq(
          "id",
          qrValue
        )
        .eq(
          "active",
          true
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    return data || null;

  }


  /* =======================================================
     MODEL ANSWER
  ======================================================= */

  async function processModelAnswer(
    testId,
    file
  ) {

    addLog(
      `${file.name}: 模範解答をページ化しています。`
    );


    const pages =
      await parseFile(
        file
      );


    if (!pages.length) {

      throw new Error(
        `${file.name}: ページがありません。`
      );

    }


    for (
      let index = 0;
      index < pages.length;
      index++
    ) {

      const page =
        pages[index];


      const pageNo =
        index + 1;


      const path =
        `${testId}/model-answer/page-${String(
          pageNo
        ).padStart(
          3,
          "0"
        )}.png`;


      const {
        error
      } =
        await supabaseClient
          .storage
          .from(
            "model-answers"
          )
          .upload(
            path,
            page.blob,
            {

              contentType:
                "image/png",

              upsert:
                true

            }
          );


      if (error) {

        throw error;

      }


      addLog(
        `模範解答ページ${pageNo}を保存しました。`
      );

    }

  }


  /* =======================================================
     UI PROCESS
  ======================================================= */

  function startProcessing() {

    if (processingArea) {

      processingArea.hidden =
        false;

    }


    if (processingTitle) {

      processingTitle.textContent =
        "答案を処理しています";

    }


    if (processingLog) {

      processingLog.innerHTML =
        "";

    }


    updateProgress(
      0,
      "開始しています..."
    );

  }


  function updateProgress(
    value,
    text
  ) {

    if (progressBar) {

      progressBar.style.width =
        `${Math.max(
          0,
          Math.min(
            100,
            value
          )
        )}%`;

    }


    if (progressText) {

      progressText.textContent =
        text ||
        "";

    }

  }


  function addLog(
    text,
    error = false
  ) {

    if (!processingLog) {

      return;

    }


    const line =
      document.createElement(
        "div"
      );


    line.textContent =
      text;


    line.style.padding =
      "3px 0";


    if (error) {

      line.style.color =
        "#b42318";

    }


    processingLog.appendChild(
      line
    );


    processingLog.scrollTop =
      processingLog.scrollHeight;

  }


  function setBusy(
    busy
  ) {

    if (uploadButton) {

      uploadButton.disabled =
        busy;

    }


    if (clearButton) {

      clearButton.disabled =
        busy;

    }


    if (filesElement) {

      filesElement.disabled =
        busy;

    }


    if (testElement) {

      testElement.disabled =
        busy;

    }


    if (answerTypeElement) {

      answerTypeElement.disabled =
        busy;

    }


    if (uploadButton) {

      uploadButton.textContent =
        busy
          ? "処理中..."
          : "アップロード開始";

    }

  }


  function showMessage(
    text,
    error = false
  ) {

    if (!messageElement) {

      return;

    }


    messageElement.textContent =
      text;


    messageElement.className =
      error
        ? "small error"
        : "small";

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearAll() {

    selectedFiles =
      [];


    renderFiles();


    if (filesElement) {

      filesElement.value =
        "";

    }


    if (processingArea) {

      processingArea.hidden =
        true;

    }


    if (processingLog) {

      processingLog.innerHTML =
        "";

    }


    if (uploadList) {

      uploadList.innerHTML =
        "";

      uploadList.hidden =
        true;

    }


    showMessage(
      ""
    );


    updateProgress(
      0,
      "待機中"
    );

  }


  /* =======================================================
     HELPERS
  ======================================================= */

  function getExtension(
    name
  ) {

    const parts =
      String(
        name ||
        ""
      )
        .toLowerCase()
        .split(
          "."
        );


    return parts.length > 1
      ? parts.pop()
      : "";

  }


  function formatBytes(
    bytes
  ) {

    if (
      bytes <
      1024
    ) {

      return `${bytes} B`;

    }


    if (
      bytes <
      1024 * 1024
    ) {

      return `${(
        bytes /
        1024
      ).toFixed(
        1
      )} KB`;

    }


    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(
      1
    )} MB`;

  }

})();
