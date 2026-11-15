
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
   test_pages 読み込み
   layout_boxes 読み込み
      ↓
   QR枠検索
      ↓
   QR読み取り
      ↓
   QRあり = 新しい答案
      ↓
   QRなし = 直前答案の続き
      ↓
   生徒特定
      ↓
   answer_sheets
      ↓
   answer-files Storage
      ↓
   answer_sheet_pages
      ↓
   全工程成功
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
        "answer-upload initialize:",
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

    /*
     * ファイル選択
     */

    filesElement?.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );


        /*
         * 同じファイルを再選択可能
         */

        event.target.value =
          "";

      }
    );


    /*
     * テスト変更
     */

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
            "load layout:",
            error
          );


          showMessage(
            error.message ||
            "解答用紙設定の読み込みに失敗しました。",
            true
          );


          stopProcessing();

        }

      }
    );


    /*
     * アップロード
     */

    uploadButton?.addEventListener(
      "click",
      uploadAnswers
    );


    /*
     * クリア
     */

    clearButton?.addEventListener(
      "click",
      clearAll
    );


    /*
     * ログアウト
     */

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

    if (!testId) {

      testPages = [];

      layoutBoxes = [];

      return;

    }


    addLog(
      "解答用紙の登録情報を取得しています..."
    );


    /* =====================================================
       test_pages

       実在する列だけ使用
    ===================================================== */

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


    /* =====================================================
       layout_boxes

       現在のDBに存在する列だけ使用

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

       source_page_idは使用しない。
    ===================================================== */

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


    addLog(
      `枠設定: ${layoutBoxes.length}個`
    );


    const qrCount =
      layoutBoxes.filter(
        box =>
          isQrBox(
            box
          )
      ).length;


    addLog(
      `QR枠: ${qrCount}個`
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


    setBusy(
      true
    );


    startProcessing();


    try {

      /*
       * 最新の枠設定を取得
       */

      updateProgress(
        0,
        "解答用紙・枠設定を確認しています..."
      );


      await loadTestLayout(
        currentTestId
      );


      /*
       * 生徒答案
       */

      if (
        answerTypeElement?.value !==
        "model"
      ) {

        if (!layoutBoxes.length) {

          addLog(
            "枠設定がありません。QRはページ全体から探索します。",
            true
          );

        }

      }


      const total =
        selectedFiles.length;


      /*
       * ファイルを1件ずつ
       */

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
        "すべての処理が完了しました。"
      );


      if (processingTitle) {

        processingTitle.textContent =
          "処理完了";

      }


      showMessage(
        `${total}件の答案処理が完了しました。`
      );


      selectedFiles =
        [];


      renderFiles();


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
      "ファイルを解析しています..."
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
     * QR単位で分割
     */

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
      `${groups.length}答案に分割しました。`
    );


    /*
     * 各答案保存
     */

    for (
      let index = 0;
      index < groups.length;
      index++
    ) {

      const group =
        groups[index];


      addLog(
        `答案 ${index + 1}/${groups.length} を保存しています...`
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
     * 既存のファイルパーサーがある場合
     * それを優先。
     */

    if (
      window.TEST_SCORE_FILES &&
      typeof window.TEST_SCORE_FILES.parseFile ===
        "function"
    ) {

      addLog(
        "既存ファイル解析処理を使用します。"
      );


      const result =
        await window.TEST_SCORE_FILES.parseFile(
          file
        );


      const normalized =
        normalizePages(
          result
        );


      if (normalized.length) {

        return normalized;

      }

    }


    const extension =
      getExtension(
        file.name
      );


    /*
     * PDF
     */

    if (
      extension ===
      "pdf"
    ) {

      return parsePdf(
        file
      );

    }


    /*
     * ZIP
     */

    if (
      extension ===
      "zip"
    ) {

      return parseZip(
        file
      );

    }


    /*
     * 画像
     */

    return [
      await parseImage(
        file
      )
    ];

  }


  /* =======================================================
     NORMALIZE PARSER
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
      `${file.name}: PDFを読み込んでいます。`
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
      `PDF: ${pdf.numPages}ページ`
    );


    for (
      let number = 1;
      number <=
      pdf.numPages;
      number++
    ) {

      updateProgress(
        Math.round(
          number /
          pdf.numPages *
          30
        ),
        `PDF ${number}/${pdf.numPages} を画像化しています...`
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
       * 3000px程度を上限に
       * QR読み取りに十分な解像度を確保。
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


    addLog(
      `${file.name}: ZIPを展開しています。`
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


    addLog(
      `ZIP内ファイル: ${entries.length}件`
    );


    for (
      const entry
      of entries
    ) {

      const extension =
        getExtension(
          entry.name
        );


      /*
       * ZIP内PDF
       */

      if (
        extension ===
        "pdf"
      ) {

        addLog(
          `ZIP: ${entry.name} をPDFとして処理`
        );


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


      /*
       * ZIP内画像
       */

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

        addLog(
          `ZIP: ${entry.name} を画像として処理`
        );


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
     GROUP BY QR
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
        30 +
        Math.round(
          index /
          pages.length *
          30
        ),
        `QR読み取り ${pageNo}/${pages.length}`
      );


      addLog(
        `ページ${pageNo}: QRを探索しています...`
      );


      /*
       * QRを読む
       */

      const qr =
        await readQrForPage(
          page,
          pageNo
        );


      /*
       * QRあり
       *
       * 新しい答案開始
       */

      if (qr) {

        addLog(
          `ページ${pageNo}: QR検出「${qr}」`
        );


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
       * 最初のページがQRなし
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
       * 現在の答案へ追加
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
     * ① QR枠
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
          isQrBox(
            box
          )
      );


    if (qrBoxes.length) {

      addLog(
        `ページ${pageNo}: QR枠 ${qrBoxes.length}個`
      );


      for (
        let index = 0;
        index < qrBoxes.length;
        index++
      ) {

        const box =
          qrBoxes[index];


        addLog(
          `ページ${pageNo}: QR枠 ${index + 1}/${qrBoxes.length} を読み取り中`
        );


        try {

          const candidates =
            await createQrCropCandidates(
              page,
              box,
              pageNo
            );


          for (
            const candidate
            of candidates
          ) {

            const qr =
              await decodeQrBlob(
                candidate
              );


            if (qr) {

              return normalizeQr(
                qr
              );

            }

          }

        } catch (error) {

          console.warn(
            "QR枠:",
            error
          );

        }

      }

    }


    /*
     * ② ページ全体
     */

    addLog(
      `ページ${pageNo}: ページ全体からQRを探索`
    );


    try {

      const qr =
        await decodeQrBlob(
          page.blob
        );


      if (qr) {

        return normalizeQr(
          qr
        );

      }

    } catch (error) {

      console.warn(
        "ページ全体QR:",
        error
      );

    }


    return null;

  }


  /* =======================================================
     QR BOX
  ======================================================= */

  function isQrBox(
    box
  ) {

    return String(
      box?.box_type ||
      ""
    )
      .trim()
      .toLowerCase() ===
      "qr";

  }


  /* =======================================================
     QR CROP CANDIDATES
  ======================================================= */

  async function createQrCropCandidates(
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


    /*
     * 登録座標 → 実画像座標
     */

    const scaleX =
      image.naturalWidth /
      sourceWidth;


    const scaleY =
      image.naturalHeight /
      sourceHeight;


    const baseX =
      Number(
        box.x
      ) *
      scaleX;


    const baseY =
      Number(
        box.y
      ) *
      scaleY;


    const baseWidth =
      Number(
        box.width
      ) *
      scaleX;


    const baseHeight =
      Number(
        box.height
      ) *
      scaleY;


    /*
     * QR枠の周囲を少し広げた
     * 候補も作る。
     */

    const margins = [
      0,
      0.05,
      0.12,
      0.20
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
            baseX -
            baseWidth *
            margin
          )
        );


      const y =
        Math.max(
          0,
          Math.floor(
            baseY -
            baseHeight *
            margin
          )
        );


      const right =
        Math.min(
          image.naturalWidth,
          Math.ceil(
            baseX +
            baseWidth *
            (1 + margin)
          )
        );


      const bottom =
        Math.min(
          image.naturalHeight,
          Math.ceil(
            baseY +
            baseHeight *
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


      const outputScale =
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
            outputScale
          )
        );


      canvas.height =
        Math.max(
          1,
          Math.round(
            height *
            outputScale
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


    const sizes = [
      3200,
      2600,
      2200,
      1800,
      1400,
      1000
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
          maxSize /
            width,
          maxSize /
            height
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

    let imageData =
      context.getImageData(
        0,
        0,
        width,
        height
      );


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
     * ② グレースケール＋二値化
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
          thresholded[i] *
            0.299 +
          thresholded[i + 1] *
            0.587 +
          thresholded[i + 2] *
            0.114
        );


      const value =
        gray < 140
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
     * ③ 反転
     */

    const inverted =
      new Uint8ClampedArray(
        thresholded
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


    if (
      result?.data
    ) {

      return result.data;

    }


    return null;

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
     STUDENT SEARCH
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
            "STUDENT:".length
          )
          .trim();

    }


    /*
     * 数字だけのQRも許可。
     */

    if (
      !studentNo &&
      /^\d{1,}$/.test(
        qrValue
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
     * 生徒番号検索
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
    group
  ) {

    const student =
      group.qrValue
        ? await findStudentByQr(
            group.qrValue
          )
        : null;


    if (group.qrValue) {

      addLog(
        `QR: ${group.qrValue}`
      );

    } else {

      addLog(
        "QRなし: 未紐付け答案"
      );

    }


    if (student) {

      addLog(
        `生徒特定: ${student.student_no || ""} ${student.name || ""}`
      );

    } else if (
      group.qrValue
    ) {

      addLog(
        "QRは読み取れましたが、生徒を特定できませんでした。",
        true
      );

    }


    /*
     * answer_sheets
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
       * 全ページ保存
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
          `答案 ${answer.id}: ページ${pageNo}/${group.pages.length}を保存`
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

          throw new Error(
            `Storage保存失敗: ${uploadError.message}`
          );

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
         * 1ページ目
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

            throw new Error(
              `答案ファイルパス更新失敗: ${updateError.message}`
            );

          }

        }

      }


      /*
       * 生徒情報
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

          throw new Error(
            `生徒紐付け失敗: ${error.message}`
          );

        }

      }


      addLog(
        `答案 ${answer.id}: 全${group.pages.length}ページ登録完了`
      );

    } catch (error) {

      /*
       * 途中失敗時ロールバック
       */

      addLog(
        `答案 ${answer.id}: 保存失敗。ロールバックします。`,
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

      throw new Error(
        `答案登録に失敗しました: ${error.message}`
      );

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

      throw new Error(
        `答案ページ登録に失敗しました: ${error.message}`
      );

    }

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
        `模範解答ページ${pageNo}/${pages.length}を保存`
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


  function stopProcessing() {

    if (processingArea) {

      processingArea.hidden =
        true;

    }

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
          Number(value) || 0
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


  /* =======================================================
     MESSAGE
  ======================================================= */

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
     BUSY
  ======================================================= */

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
     CANVAS → BLOB
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
     LOAD IMAGE
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
