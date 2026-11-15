
/* =========================================================
   テスト成績システム
   答案アップロード 完全版

   DB:
     answer_sheets
       id
       test_id
       student_id
       original_file_path
       rendered_file_path
       page_count
       qr_value
       status
       uploaded_by
       uploaded_at
       created_at
       updated_at

     answer_sheet_pages
       answer_sheet_id
       page_no
       file_path
       file_type
       original_name
       width_px
       height_px

     test_pages
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
       created_at
       points

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


  /* =======================================================
     DOM
  ======================================================= */

  const $ = id =>
    document.getElementById(id);


  const teacherName =
    $("teacherName");

  const testElement =
    $("test");

  const answerTypeElement =
    $("answerType");

  const filesElement =
    $("files");

  const fileListElement =
    $("fileList");

  const uploadButton =
    $("uploadButton");

  const clearButton =
    $("clearButton");

  const messageElement =
    $("message");

  const processingArea =
    $("processingArea");

  const processingTitle =
    $("processingTitle");

  const progressBar =
    $("progressBar");

  const progressText =
    $("progressText");

  const processingLog =
    $("processingLog");


  /* =======================================================
     START
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

        testPages = [];

        layoutBoxes = [];


        if (!currentTestId) {

          showMessage(
            "テストを選択してください。"
          );

          return;

        }


        try {

          startProcessing();

          updateProgress(
            0,
            "解答用紙設定を読み込んでいます..."
          );


          await loadTestLayout(
            currentTestId
          );


          updateProgress(
            100,
            "解答用紙設定を読み込みました。"
          );


          showMessage(
            "テストを選択しました。"
          );


        } catch (error) {

          console.error(
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


    $("logoutButton")
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
        "テスト選択欄が見つかりません。"
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
            ascending: false
          }
        );


    if (error) {

      throw new Error(
        `テスト一覧の取得に失敗しました: ${error.message}`
      );

    }


    tests =
      data || [];


    testElement.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

    `;


    tests.forEach(
      test => {

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
    );

  }


  /* =======================================================
     TEST LAYOUT
  ======================================================= */

  async function loadTestLayout(
    testId
  ) {

    if (!testId) {

      return;

    }


    addLog(
      "解答用紙を取得しています..."
    );


    /*
     * test_pages
     *
     * 実在する列だけ。
     */

    const {
      data: pages,
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
          created_at,
          file_path,
          file_type,
          original_name
        `)
        .eq(
          "test_id",
          testId
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


    testPages =
      pages || [];


    addLog(
      `解答用紙: ${testPages.length}ページ`
    );


    /*
     * layout_boxes
     *
     * 実在する列だけ。
     */

    const {
      data: boxes,
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
          created_at,
          points
        `)
        .eq(
          "test_id",
          testId
        )
        .order(
          "page_no",
          {
            ascending: true
          }
        );


    if (boxError) {

      throw new Error(
        `枠設定の取得に失敗しました: ${boxError.message}`
      );

    }


    layoutBoxes =
      boxes || [];


    const qrCount =
      layoutBoxes.filter(
        box =>
          String(
            box.box_type ||
            ""
          ).toLowerCase() ===
          "qr"
      ).length;


    addLog(
      `枠設定: ${layoutBoxes.length}個`
    );


    addLog(
      `QR枠: ${qrCount}個`
    );

  }


  /* =======================================================
     FILE SELECT
  ======================================================= */

  function addFiles(
    fileList
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
        fileList || []
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
          oldFile =>
            oldFile.name ===
              file.name &&
            oldFile.size ===
              file.size &&
            oldFile.lastModified ===
              file.lastModified
        );


      if (!duplicate) {

        selectedFiles.push(
          file
        );

      }

    }


    renderFileList();

  }


  function renderFileList() {

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


    selectedFiles.forEach(
      (
        file,
        index
      ) => {

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


            renderFileList();

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
    );

  }


  /* =======================================================
     UPLOAD
  ======================================================= */

  async function uploadAnswers() {

    const testId =
      testElement?.value ||
      "";


    if (!testId) {

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


    currentTestId =
      testId;


    setBusy(
      true
    );


    startProcessing();


    try {

      addLog(
        "最新の解答用紙設定を読み込んでいます..."
      );


      await loadTestLayout(
        testId
      );


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
            testId,
            file
          );

        } else {

          await processStudentAnswer(
            testId,
            file
          );

        }


        addLog(
          `完了: ${file.name}`
        );

      }


      updateProgress(
        100,
        "すべての処理が完了しました。"
      );


      if (processingTitle) {

        processingTitle.textContent =
          "処理完了";

      }


      showMessage(
        `${total}件の答案処理が完了しました。`
      );


      selectedFiles = [];

      renderFileList();


    } catch (error) {

      console.error(
        "ANSWER UPLOAD ERROR:",
        error
      );


      addLog(
        `エラー: ${error.message}`,
        true
      );


      if (processingTitle) {

        processingTitle.textContent =
          "処理失敗";

      }


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
      `${file.name}: ページ化を開始`
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
      `${pages.length}ページ取得`
    );


    const groups =
      await groupPagesByQr(
        pages
      );


    if (!groups.length) {

      throw new Error(
        `${file.name}: 答案グループを作成できませんでした。`
      );

    }


    addLog(
      `${groups.length}答案に分割`
    );


    for (
      let index = 0;
      index < groups.length;
      index++
    ) {

      addLog(
        `答案 ${index + 1}/${groups.length} を登録`
      );


      await saveAnswerGroup(
        testId,
        groupSafe(
          groups[index]
        ),
        file
      );

    }

  }


  function groupSafe(
    group
  ) {

    return {

      qrValue:
        group.qrValue ||
        null,

      pages:
        Array.isArray(
          group.pages
        )
          ? group.pages
          : []

    };

  }


  /* =======================================================
     PARSER
  ======================================================= */

  async function parseFile(
    file
  ) {

    /*
     * 既存パーサーがある場合。
     */

    if (
      window.TEST_SCORE_FILES &&
      typeof window.TEST_SCORE_FILES.parseFile ===
        "function"
    ) {

      addLog(
        "既存ファイル解析機能を使用"
      );


      const parsed =
        await window.TEST_SCORE_FILES.parseFile(
          file
        );


      const normalized =
        normalizePages(
          parsed
        );


      if (normalized.length) {

        return normalized;

      }

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


  function normalizePages(
    pages
  ) {

    if (!Array.isArray(pages)) {

      return [];

    }


    return pages
      .filter(
        page =>
          page &&
          page.blob
      )
      .map(
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


    addLog(
      `${file.name}: PDF読み込み`
    );


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


    addLog(
      `PDFページ数: ${pdf.numPages}`
    );


    for (
      let pageNo = 1;
      pageNo <=
      pdf.numPages;
      pageNo++
    ) {

      updateProgress(
        Math.round(
          pageNo /
          pdf.numPages *
          25
        ),
        `PDF ${pageNo}/${pdf.numPages} を画像化`
      );


      const pdfPage =
        await pdf.getPage(
          pageNo
        );


      const base =
        pdfPage.getViewport({
          scale:
            1
        });


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


      pages.push({

        blob:
          await canvasToBlob(
            canvas
          ),

        name:
          `${file.name} - page ${pageNo}`,

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


    addLog(
      `${file.name}: ZIP展開`
    );


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
            [blob],
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
            [blob],
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


    return {

      blob:
        await canvasToBlob(
          canvas
        ),

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

    const groups = [];

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
        25 +
        Math.round(
          index /
          pages.length *
          35
        ),
        `QR読み取り ${pageNo}/${pages.length}`
      );


      addLog(
        `ページ${pageNo}: QR読み取り開始`
      );


      const qr =
        await readQrForPage(
          page,
          pageNo
        );


      if (qr) {

        addLog(
          `ページ${pageNo}: QR = ${qr}`
        );


        /*
         * QRあり
         * → 新しい答案
         */

        currentGroup = {

          qrValue:
            qr,

          pages: []

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

          pages: []

        };


        groups.push(
          currentGroup
        );


        addLog(
          `ページ${pageNo}: 未紐付け答案として開始`
        );

      }


      /*
       * 直前答案へ追加
       */

      currentGroup.pages.push(
        page
      );

    }


    return groups;

  }


  /* =======================================================
     QR READ
  ======================================================= */

  async function readQrForPage(
    page,
    pageNo
  ) {

    /*
     * QR枠
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
          String(
            box.box_type ||
            ""
          )
            .trim()
            .toLowerCase() ===
          "qr"
      );


    /*
     * QR枠があれば最優先。
     */

    for (
      let index = 0;
      index < qrBoxes.length;
      index++
    ) {

      addLog(
        `ページ${pageNo}: QR枠 ${index + 1}/${qrBoxes.length}`
      );


      const candidates =
        await createQrCandidates(
          page,
          qrBoxes[index],
          pageNo
        );


      for (
        const candidate
        of candidates
      ) {

        const qr =
          await decodeQr(
            candidate
          );


        if (qr) {

          return normalizeQr(
            qr
          );

        }

      }

    }


    /*
     * QR枠で読めなければ
     * ページ全体。
     */

    addLog(
      `ページ${pageNo}: ページ全体QR探索`
    );


    const fullQr =
      await decodeQr(
        page.blob
      );


    return fullQr
      ? normalizeQr(
          fullQr
        )
      : null;

  }


  /* =======================================================
     QR CANDIDATES
  ======================================================= */

  async function createQrCandidates(
    page,
    box,
    pageNo
  ) {

    const image =
      await loadImage(
        page.blob
      );


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


    const sourceWidth =
      Number(
        layoutPage?.width_px
      ) ||
      Number(
        page.width
      ) ||
      image.naturalWidth;


    const sourceHeight =
      Number(
        layoutPage?.height_px
      ) ||
      Number(
        page.height
      ) ||
      image.naturalHeight;


    const scaleX =
      image.naturalWidth /
      sourceWidth;


    const scaleY =
      image.naturalHeight /
      sourceHeight;


    const bx =
      Number(
        box.x
      ) *
      scaleX;


    const by =
      Number(
        box.y
      ) *
      scaleY;


    const bw =
      Number(
        box.width
      ) *
      scaleX;


    const bh =
      Number(
        box.height
      ) *
      scaleY;


    /*
     * 少し広げた候補を複数作る。
     */

    const margins = [
      0,
      0.05,
      0.10,
      0.18
    ];


    const candidates =
      [];


    for (
      const margin
      of margins
    ) {

      const x =
        Math.max(
          0,
          Math.floor(
            bx -
            bw *
            margin
          )
        );


      const y =
        Math.max(
          0,
          Math.floor(
            by -
            bh *
            margin
          )
        );


      const right =
        Math.min(
          image.naturalWidth,
          Math.ceil(
            bx +
            bw *
            (1 + margin)
          )
        );


      const bottom =
        Math.min(
          image.naturalHeight,
          Math.ceil(
            by +
            bh *
            (1 + margin)
          )
        );


      const width =
        Math.max(
          1,
          right - x
        );


      const height =
        Math.max(
          1,
          bottom - y
        );


      /*
       * QR読み取り用に2倍。
       */

      const scale =
        2;


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        Math.max(
          1,
          Math.round(
            width *
            scale
          )
        );


      canvas.height =
        Math.max(
          1,
          Math.round(
            height *
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


      context.imageSmoothingEnabled =
        false;


      context.drawImage(
        image,

        x,
        y,
        width,
        height,

        0,
        0,
        canvas.width,
        canvas.height
      );


      candidates.push(
        await canvasToBlob(
          canvas
        )
      );

    }


    return candidates;

  }


  /* =======================================================
     QR DECODE
  ======================================================= */

  async function decodeQr(
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


    const sizes = [
      3200,
      2800,
      2400,
      2000,
      1600,
      1200,
      900
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
        Math.max(
          1,
          Math.round(
            width *
            ratio
          )
        );


      height =
        Math.max(
          1,
          Math.round(
            height *
            ratio
          )
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


    /*
     * ① 通常
     */

    const original =
      context.getImageData(
        0,
        0,
        width,
        height
      );


    let result =
      jsQR(
        original.data,
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
     * ② 白黒
     */

    const threshold =
      new Uint8ClampedArray(
        original.data
      );


    for (
      let i = 0;
      i < threshold.length;
      i += 4
    ) {

      const gray =
        Math.round(
          threshold[i] *
            0.299 +
          threshold[i + 1] *
            0.587 +
          threshold[i + 2] *
            0.114
        );


      const value =
        gray < 140
          ? 0
          : 255;


      threshold[i] =
        value;

      threshold[i + 1] =
        value;

      threshold[i + 2] =
        value;

      threshold[i + 3] =
        255;

    }


    result =
      jsQR(
        threshold,
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
     * ③ 反転
     */

    const inverted =
      new Uint8ClampedArray(
        threshold
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
     QR NORMALIZE
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


      const candidate =
        json.student_no ||
        json.studentNo ||
        json.student_id ||
        json.studentId ||
        json.id;


      if (candidate) {

        return String(
          candidate
        ).trim();

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


      const candidate =
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


      if (candidate) {

        return candidate.trim();

      }

    } catch (_) {}


    return text;

  }


  /* =======================================================
     STUDENT FIND
  ======================================================= */

  async function findStudentByQr(
    qrValue
  ) {

    if (!qrValue) {

      return null;

    }


    let studentNo =
      null;


    const upper =
      qrValue.toUpperCase();


    /*
     * STUDENT:424990
     */

    if (
      upper.startsWith(
        "STUDENT:"
      )
    ) {

      studentNo =
        qrValue
          .substring(
            "STUDENT:".length
          )
          .trim();

    }


    /*
     * 数字だけ
     */

    if (
      !studentNo &&
      /^\d+$/.test(
        qrValue.trim()
      )
    ) {

      studentNo =
        qrValue.trim();

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
     * MANUAL: は生徒番号とは
     * 解釈しない。
     *
     * MANUAL:180841
     * はそのままQR値として保存し、
     * 生徒は未特定にする。
     */

    if (
      !studentNo &&
      upper.startsWith(
        "MANUAL:"
      )
    ) {

      return null;

    }


    /*
     * 生徒番号で検索
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

        throw new Error(
          `生徒検索に失敗しました: ${error.message}`
        );

      }


      return data || null;

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

      throw new Error(
        `生徒検索に失敗しました: ${error.message}`
      );

    }


    return data || null;

  }


  /* =======================================================
     SAVE ANSWER GROUP
  ======================================================= */

  async function saveAnswerGroup(
    testId,
    group,
    originalFile
  ) {

    if (
      !group.pages.length
    ) {

      throw new Error(
        "答案ページがありません。"
      );

    }


    /*
     * QRから生徒特定
     */

    const student =
      group.qrValue
        ? await findStudentByQr(
            group.qrValue
          )
        : null;


    if (group.qrValue) {

      addLog(
        `QR値: ${group.qrValue}`
      );

    } else {

      addLog(
        "QRなし"
      );

    }


    if (student) {

      addLog(
        `生徒: ${student.student_no} ${student.name}`
      );

    } else if (
      group.qrValue
    ) {

      addLog(
        "QRは読み取りましたが、生徒は特定できませんでした。",
        true
      );

    }


    /*
     * 答案IDを先に生成。
     */

    const answerId =
      crypto.randomUUID();


    const uploadedPaths =
      [];


    try {

      /*
       * ① 全ページStorage保存
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


        const path =
          `${testId}/${answerId}/page-${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}.png`;


        addLog(
          `Storage保存 ${pageNo}/${group.pages.length}`
        );


        const {
          error
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


        if (error) {

          throw new Error(
            `Storage保存失敗: ${error.message}`
          );

        }


        uploadedPaths.push(
          path
        );

      }


      /*
       * ② answer_sheets
       *
       * 全情報を最初から登録。
       */

      const firstPath =
        uploadedPaths[0];


      const {
        data: answer,
        error: answerError
      } =
        await supabaseClient
          .from(
            "answer_sheets"
          )
          .insert({

            id:
              answerId,

            test_id:
              testId,

            student_id:
              student?.id ||
              null,

            original_file_path:
              originalFile?.name ||
              null,

            rendered_file_path:
              firstPath,

            page_count:
              group.pages.length,

            qr_value:
              group.qrValue ||
              null,

            status:
              student
                ? "matched"
                : "unmatched",

            uploaded_by:
              await getCurrentUserId()

          })
          .select(
            `
            id,
            test_id,
            student_id,
            original_file_path,
            rendered_file_path,
            page_count,
            qr_value,
            status,
            uploaded_by,
            uploaded_at
            `
          )
          .single();


      if (answerError) {

        throw new Error(
          `答案本体の登録に失敗しました: ${answerError.message}`
        );

      }


      /*
       * ③ answer_sheet_pages
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


        const path =
          uploadedPaths[index];


        addLog(
          `ページDB登録 ${pageNo}/${group.pages.length}`
        );


        const {
          error
        } =
          await supabaseClient
            .from(
              "answer_sheet_pages"
            )
            .insert({

              answer_sheet_id:
                answer.id,

              page_no:
                pageNo,

              file_path:
                path,

              file_type:
                "image/png",

              original_name:
                page.name ||
                originalFile?.name ||
                "page",

              width_px:
                page.width,

              height_px:
                page.height

            });


        if (error) {

          throw new Error(
            `答案ページ${pageNo}の登録に失敗しました: ${error.message}`
          );

        }

      }


      /*
       * ④ 登録結果を再取得して確認
       *
       * ここが重要。
       * DBに本当に存在することを確認してから
       * 完了にする。
       */

      const {
        data: verifyAnswer,
        error: verifyAnswerError
      } =
        await supabaseClient
          .from(
            "answer_sheets"
          )
          .select(
            `
            id,
            test_id,
            student_id,
            original_file_path,
            rendered_file_path,
            page_count,
            qr_value,
            status
            `
          )
          .eq(
            "id",
            answer.id
          )
          .single();


      if (verifyAnswerError) {

        throw new Error(
          `答案登録確認に失敗しました: ${verifyAnswerError.message}`
        );

      }


      if (
        !verifyAnswer ||
        Number(
          verifyAnswer.page_count
        ) !==
        group.pages.length
      ) {

        throw new Error(
          "答案ページ数の登録確認に失敗しました。"
        );

      }


      const {
        data: verifyPages,
        error: verifyPagesError
      } =
        await supabaseClient
          .from(
            "answer_sheet_pages"
          )
          .select(
            `
            answer_sheet_id,
            page_no,
            file_path,
            file_type,
            original_name,
            width_px,
            height_px
            `
          )
          .eq(
            "answer_sheet_id",
            answer.id
          )
          .order(
            "page_no",
            {
              ascending:
                true
            }
          );


      if (verifyPagesError) {

        throw new Error(
          `答案ページ登録確認に失敗しました: ${verifyPagesError.message}`
        );

      }


      if (
        !verifyPages ||
        verifyPages.length !==
          group.pages.length
      ) {

        throw new Error(
          `答案ページが全て登録されていません。登録数=${verifyPages?.length || 0} / 必要数=${group.pages.length}`
        );

      }


      /*
       * ⑤ Storage存在確認
       */

      for (
        const path
        of uploadedPaths
      ) {

        const {
          data: storageFile,
          error: storageError
        } =
          await findStorageFile(
            path
          );


        if (storageError) {

          throw new Error(
            `Storage確認に失敗しました: ${storageError}`
          );

        }


        if (!storageFile) {

          throw new Error(
            `Storageに答案ページが存在しません: ${path}`
          );

        }

      }


      addLog(
        `答案登録確認完了: ${answer.id}`
      );


      addLog(
        `ページ数: ${verifyPages.length}`
      );


      if (student) {

        addLog(
          `紐付け: ${student.student_no} ${student.name}`
        );

      } else {

        addLog(
          "状態: 未紐付け"
        );

      }


      return answer;


    } catch (error) {

      /*
       * ロールバック
       */

      addLog(
        "登録途中でエラーが発生しました。ロールバックします。",
        true
      );


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
          answerId
        );


      await supabaseClient
        .from(
          "answer_sheets"
        )
        .delete()
        .eq(
          "id",
          answerId
        );


      throw error;

    }

  }


  /* =======================================================
     CURRENT USER ID
  ======================================================= */

  async function getCurrentUserId() {

    /*
     * auth.jsのgetSessionを優先。
     */

    if (
      typeof getSession ===
      "function"
    ) {

      const session =
        await getSession();


      if (
        session?.user?.id
      ) {

        return session.user.id;

      }

    }


    /*
     * Supabase直接取得。
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (error) {

      throw new Error(
        `ログインセッション取得失敗: ${error.message}`
      );

    }


    if (
      !data?.session?.user?.id
    ) {

      return null;

    }


    return data.session.user.id;

  }


  /* =======================================================
     STORAGE VERIFY
  ======================================================= */

  async function findStorageFile(
    path
  ) {

    const parts =
      path.split(
        "/"
      );


    const fileName =
      parts.pop();


    const folder =
      parts.join(
        "/"
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
        .list(
          folder,
          {
            search:
              fileName,

            limit:
              20
          }
        );


    if (error) {

      return {

        data:
          null,

        error:
          error.message

      };

    }


    const found =
      (
        data || []
      ).find(
        item =>
          item.name ===
          fileName
      );


    return {

      data:
        found ||
        null,

      error:
        null

    };

  }


  /* =======================================================
     MODEL ANSWER
  ======================================================= */

  async function processModelAnswer(
    testId,
    file
  ) {

    addLog(
      `${file.name}: 模範解答を解析しています。`
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


    const uploaded =
      [];


    try {

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


        addLog(
          `模範解答 ${pageNo}/${pages.length} 保存`
        );


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

                cacheControl:
                  "3600",

                upsert:
                  true
              }
            );


        if (error) {

          throw new Error(
            `模範解答Storage保存失敗: ${error.message}`
          );

        }


        uploaded.push(
          path
        );

      }


    } catch (error) {

      if (uploaded.length) {

        await supabaseClient
          .storage
          .from(
            "model-answers"
          )
          .remove(
            uploaded
          );

      }


      throw error;

    }

  }


  /* =======================================================
     PROCESS UI
  ======================================================= */

  function startProcessing() {

    if (processingArea) {

      processingArea.hidden =
        false;

    }


    if (processingTitle) {

      processingTitle.textContent =
        "処理中";

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

    const safe =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            value
          ) || 0
        )
      );


    if (processingArea) {

      processingArea.hidden =
        false;

    }


    if (progressBar) {

      progressBar.style.width =
        `${safe}%`;

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


  function setBusy(
    busy
  ) {

    if (uploadButton) {

      uploadButton.disabled =
        busy;

      uploadButton.textContent =
        busy
          ? "処理中..."
          : "アップロード開始";

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

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearAll() {

    selectedFiles =
      [];


    renderFileList();


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


    showMessage(
      ""
    );


    updateProgress(
      0,
      "待機中"
    );

  }


  /* =======================================================
     CANVAS
  ======================================================= */

  function canvasToBlob(
    canvas
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
                  "画像変換に失敗しました。"
                )
              );

              return;

            }


            resolve(
              blob
            );

          },
          "image/png",
          0.95
        );

      }
    );

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  function loadImage(
    source
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const image =
          new Image();


        const isBlob =
          source instanceof Blob;


        const url =
          isBlob
            ? URL.createObjectURL(
                source
              )
            : source;


        image.onload =
          () => {

            if (isBlob) {

              URL.revokeObjectURL(
                url
              );

            }


            resolve(
              image
            );

          };


        image.onerror =
          () => {

            if (isBlob) {

              URL.revokeObjectURL(
                url
              );

            }


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
