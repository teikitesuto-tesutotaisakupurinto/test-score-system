
/* =========================================================
   テスト成績システム
   js/teacher/answer-return.js

   採点済み答案返却

   仕様
   ---------------------------------------------------------
   ・採点済み答案のみ対象
   ・答案画像を表示
   ・answer_regionsを利用
   ・mark_objectsを答案上へ描画
   ・scoresの点数を答案上へ表示
   ・氏名 / 生徒番号 / QR / layout_boxesの枠線は
     返却画像には描画しない
   ・PDF / PNG / 印刷対応

   DB
   ---------------------------------------------------------
   answer_sheet_pages
   answer_regions
   mark_objects
   scores
   layout_boxes
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let answerSheetId =
    null;

  let pages =
    [];

  let regions =
    [];

  let marks =
    [];

  let scores =
    [];

  let boxes =
    [];

  let DB =
    null;


  /* =======================================================
     DOM
  ======================================================= */

  const answerSelect =
    document.getElementById(
      "answerSelect"
    );


  const preview =
    document.getElementById(
      "returnPreview"
    );


  const statusElement =
    document.getElementById(
      "status"
    );


  const printButton =
    document.getElementById(
      "printButton"
    );


  const pdfButton =
    document.getElementById(
      "pdfButton"
    );


  const downloadButton =
    document.getElementById(
      "downloadButton"
    );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


  async function initialize() {

    try {

      DB =
        window.supabaseClient ||
        window.SB ||
        null;


      if (!DB) {

        throw new Error(
          "Supabase Clientが初期化されていません。"
        );

      }


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


      setupEvents();


      disableActions(
        true
      );


      await loadAnswers();


      /*
       * URL:
       *
       * /teacher/results/return?answer=UUID
       */

      const answerId =
        new URLSearchParams(
          window.location.search
        ).get(
          "answer"
        );


      if (answerId) {

        answerSheetId =
          answerId;


        if (answerSelect) {

          answerSelect.value =
            answerId;

        }


        await loadAnswer();

      }

    } catch (error) {

      console.error(
        "answer-return initialize:",
        error
      );


      showError(
        error.message ||
        "答案返却画面を読み込めませんでした。"
      );

    }

  }


  /* =======================================================
     AUTH
  ======================================================= */

  async function requireTeacher() {

    if (
      typeof window.requireRole ===
      "function"
    ) {

      const result =
        await window.requireRole(
          "teacher"
        );


      if (!result) {

        return null;

      }


      return (
        result.profile ||
        result
      );

    }


    const {
      data,
      error
    } =
      await DB.auth.getUser();


    if (error) {

      throw error;

    }


    if (!data?.user) {

      location.replace(
        "/login"
      );

      return null;

    }


    return {

      name:
        data.user.email ||
        "先生"

    };

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    answerSelect?.addEventListener(
      "change",
      async () => {

        answerSheetId =
          answerSelect.value ||
          null;


        if (!answerSheetId) {

          clearPreview();

          return;

        }


        try {

          await loadAnswer();

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "答案を読み込めませんでした。"
          );

        }

      }
    );


    printButton?.addEventListener(
      "click",
      async () => {

        try {

          await printAnswer();

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "印刷できませんでした。"
          );

        }

      }
    );


    pdfButton?.addEventListener(
      "click",
      async () => {

        try {

          await downloadPdf();

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "PDFを作成できませんでした。"
          );

        }

      }
    );


    downloadButton?.addEventListener(
      "click",
      async () => {

        try {

          await downloadPng();

        } catch (error) {

          console.error(
            error
          );


          showError(
            error.message ||
            "PNGを作成できませんでした。"
          );

        }

      }
    );


    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        async () => {

          if (
            typeof window.logout ===
            "function"
          ) {

            await window.logout();

            return;

          }


          await DB.auth.signOut();


          location.replace(
            "/login"
          );

        }
      );

  }


  /* =======================================================
     LOAD ANSWERS
  ======================================================= */

  async function loadAnswers() {

    if (!answerSelect) {

      return;

    }


    setStatus(
      "採点済み答案を読み込んでいます..."
    );


    /*
     * teacher/results/return.html から
     * test_idが指定される場合にも対応。
     */

    const params =
      new URLSearchParams(
        window.location.search
      );


    const testId =
      params.get(
        "test"
      );


    let query =
      DB
        .from(
          "answer_sheets"
        )
        .select(
          `
          id,
          test_id,
          student_id,
          status,
          created_at,
          uploaded_at
          `
        )
        .eq(
          "status",
          "marked"
        );


    if (testId) {

      query =
        query.eq(
          "test_id",
          testId
        );

    }


    const {
      data,
      error
    } =
      await query
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      throw error;

    }


    const answers =
      data ||
      [];


    answerSelect.innerHTML = `

      <option value="">
        ${
          answers.length
            ? "採点済み答案を選択してください"
            : "採点済み答案はありません"
        }
      </option>

    `;


    answers.forEach(
      (
        answer,
        index
      ) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          answer.id;


        /*
         * 返却画面でも
         * 生徒名・生徒番号は表示しない。
         */

        option.textContent =
          `答案 ${index + 1}`;


        answerSelect.appendChild(
          option
        );

      }
    );


    setStatus(
      answers.length
        ? `${answers.length}件の採点済み答案があります。`
        : "採点済み答案はありません。"
    );

  }


  /* =======================================================
     LOAD ANSWER
  ======================================================= */

  async function loadAnswer() {

    if (!answerSheetId) {

      return;

    }


    setStatus(
      "答案を読み込んでいます..."
    );


    clearData();


    /*
     * =====================================================
     * 答案ページ
     * =====================================================
     */

    const {
      data:
        pageData,
      error:
        pageError
    } =
      await DB
        .from(
          "answer_sheet_pages"
        )
        .select(
          `
          id,
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
          answerSheetId
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (pageError) {

      throw pageError;

    }


    pages =
      pageData ||
      [];


    if (!pages.length) {

      throw new Error(
        "答案ページがありません。"
      );

    }


    /*
     * =====================================================
     * answer_regions
     * =====================================================
     */

    const {
      data:
        regionData,
      error:
        regionError
    } =
      await DB
        .from(
          "answer_regions"
        )
        .select(
          `
          id,
          answer_sheet_id,
          layout_box_id,
          page_no,
          image_path,
          x,
          y,
          width,
          height
          `
        )
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (regionError) {

      throw regionError;

    }


    regions =
      regionData ||
      [];


    /*
     * =====================================================
     * mark_objects
     * =====================================================
     */

    const {
      data:
        markData,
      error:
        markError
    } =
      await DB
        .from(
          "mark_objects"
        )
        .select(
          `
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          object_type,
          text_value,
          color,
          font_size,
          stroke_width,
          x,
          y,
          width,
          height,
          points,
          created_at
          `
        )
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (markError) {

      /*
       * 採点記号が無い場合でも
       * 点数だけは返却できる。
       */

      console.warn(
        "mark_objects:",
        markError
      );


      marks =
        [];

    } else {

      marks =
        markData ||
        [];

    }


    /*
     * =====================================================
     * scores
     * =====================================================
     */

    const {
      data:
        scoreData,
      error:
        scoreError
    } =
      await DB
        .from(
          "scores"
        )
        .select(
          `
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status
          `
        )
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .eq(
          "status",
          "marked"
        );


    if (scoreError) {

      throw scoreError;

    }


    scores =
      scoreData ||
      [];


    /*
     * =====================================================
     * layout_boxes
     *
     * 枠線そのものは描画しない。
     * 座標・配点・ラベルの参照だけに使う。
     * =====================================================
     */

    const layoutBoxIds =
      [
        ...new Set(
          [
            ...regions.map(
              region =>
                region.layout_box_id
            ),

            ...marks.map(
              mark =>
                mark.layout_box_id
            ),

            ...scores.map(
              score =>
                score.layout_box_id
            )

          ]
            .filter(Boolean)
        )
      ];


    if (layoutBoxIds.length) {

      const {
        data:
          boxData,
        error:
          boxError
      } =
        await DB
          .from(
            "layout_boxes"
          )
          .select(
            `
            id,
            question_id,
            label,
            points,
            x,
            y,
            width,
            height,
            page_no
            `
          )
          .in(
            "id",
            layoutBoxIds
          );


      if (boxError) {

        throw boxError;

      }


      boxes =
        boxData ||
        [];

    }


    /*
     * =====================================================
     * 表示
     * =====================================================
     */

    await renderPreview();


    disableActions(
      false
    );


    setStatus(
      "採点済み答案を表示しています。"
    );

  }


  /* =======================================================
     PREVIEW
  ======================================================= */

  async function renderPreview() {

    if (!preview) {

      return;

    }


    preview.innerHTML =
      "";


    /*
     * ページごとに
     * 元答案 + 採点記号 + 点数を表示。
     */

    for (
      const page
      of pages
    ) {

      const pageWrapper =
        document.createElement(
          "div"
        );


      pageWrapper.className =
        "return-page";


      pageWrapper.style.cssText = `

        position:relative;

        width:100%;

        margin-bottom:20px;

        background:#fff;

        overflow:hidden;

      `;


      const pageTitle =
        document.createElement(
          "div"
        );


      pageTitle.textContent =
        `${page.page_no}ページ`;


      pageTitle.style.cssText = `

        padding:7px 9px;

        border-bottom:
          1px solid #d0d6dc;

        background:#f5f6f7;

        font-size:12px;

        font-weight:700;

      `;


      const imageArea =
        await createPageCanvas(
          page
        );


      pageWrapper.append(
        pageTitle,
        imageArea
      );


      preview.appendChild(
        pageWrapper
      );

    }


    preview.style.display =
      pages.length
        ? "block"
        : "none";

  }


  /* =======================================================
     CREATE PAGE
  ======================================================= */

  async function createPageCanvas(
    page
  ) {

    /*
     * 元答案画像をStorageから取得。
     */

    const {
      data,
      error
    } =
      await DB
        .storage
        .from(
          "answer-files"
        )
        .createSignedUrl(
          page.file_path,
          900
        );


    if (error) {

      throw error;

    }


    if (!data?.signedUrl) {

      throw new Error(
        "答案画像URLを取得できませんでした。"
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
     * Canvasは返却用画像生成にのみ使用。
     *
     * 採点画面のクロップ生成とは別。
     */

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    canvas.style.cssText = `

      display:block;

      width:100%;

      height:auto;

    `;


    const context =
      canvas.getContext(
        "2d"
      );


    if (!context) {

      throw new Error(
        "Canvasを初期化できませんでした。"
      );

    }


    context.drawImage(
      image,
      0,
      0
    );


    /*
     * このページに属する
     * 解答枠だけ処理。
     */

    const pageRegions =
      regions.filter(
        region =>
          Number(
            region.page_no
          ) ===
          Number(
            page.page_no
          )
      );


    pageRegions.forEach(
      region => {

        drawRegionMarks(
          context,
          region
        );


        drawRegionScore(
          context,
          region
        );

      }
    );


    return canvas;

  }


  /* =======================================================
     REGION MARKS
  ======================================================= */

  function drawRegionMarks(
    context,
    region
  ) {

    const regionMarks =
      marks.filter(
        mark =>
          mark.layout_box_id ===
          region.layout_box_id
      );


    regionMarks.forEach(
      mark => {

        drawMark(
          context,
          mark,
          region
        );

      }
    );

  }


  /* =======================================================
     DRAW MARK
  ======================================================= */

  function drawMark(
    context,
    mark,
    region
  ) {

    const baseX =
      Number(
        region.x
      ) || 0;


    const baseY =
      Number(
        region.y
      ) || 0;


    const x =
      baseX +
      (
        Number(
          mark.x
        ) || 0
      );


    const y =
      baseY +
      (
        Number(
          mark.y
        ) || 0
      );


    const fontSize =
      Number(
        mark.font_size
      ) || 42;


    const color =
      mark.color ||
      "#d00000";


    const strokeWidth =
      Math.max(
        2,
        Number(
          mark.stroke_width
        ) || 3
      );


    const type =
      mark.object_type ||
      "";


    context.save();


    context.strokeStyle =
      color;


    context.fillStyle =
      color;


    context.lineWidth =
      strokeWidth;


    context.lineCap =
      "round";


    context.lineJoin =
      "round";


    /*
     * ○
     */

    if (
      type ===
      "circle"
    ) {

      context.beginPath();


      context.arc(
        x,
        y,
        fontSize / 2,
        0,
        Math.PI * 2
      );


      context.stroke();


    }


    /*
     * ×
     */

    else if (
      type ===
      "x"
    ) {

      const half =
        fontSize / 2;


      context.beginPath();


      context.moveTo(
        x - half,
        y - half
      );


      context.lineTo(
        x + half,
        y + half
      );


      context.moveTo(
        x + half,
        y - half
      );


      context.lineTo(
        x - half,
        y + half
      );


      context.stroke();

    }


    /*
     * △
     */

    else if (
      type ===
      "triangle"
    ) {

      const half =
        fontSize / 2;


      context.beginPath();


      context.moveTo(
        x,
        y - half
      );


      context.lineTo(
        x - half,
        y + half
      );


      context.lineTo(
        x + half,
        y + half
      );


      context.closePath();


      context.stroke();

    }


    /*
     * ◎
     */

    else if (
      type ===
      "double_circle"
    ) {

      context.font =
        `bold ${fontSize}px Arial`;


      context.textBaseline =
        "middle";


      context.fillText(
        "◎",
        x,
        y
      );

    }


    /*
     * 文字
     */

    else if (
      type ===
      "text"
    ) {

      context.font =
        `${fontSize}px Arial`;


      context.textBaseline =
        "middle";


      context.fillText(
        mark.text_value ||
        "",
        x,
        y
      );

    }


    /*
     * ペン
     *
     * pointsがJSON配列の場合に対応。
     */

    else if (
      type ===
      "pen"
    ) {

      drawPenMark(
        context,
        mark,
        region
      );

    }


    context.restore();

  }


  /* =======================================================
     PEN
  ======================================================= */

  function drawPenMark(
    context,
    mark,
    region
  ) {

    let points =
      mark.points;


    if (
      typeof points ===
      "string"
    ) {

      try {

        points =
          JSON.parse(
            points
          );

      } catch (_) {

        points =
          [];

      }

    }


    if (
      !Array.isArray(
        points
      ) ||
      points.length <
        2
    ) {

      return;

    }


    const baseX =
      Number(
        region.x
      ) || 0;


    const baseY =
      Number(
        region.y
      ) || 0;


    context.save();


    context.strokeStyle =
      mark.color ||
      "#d00000";


    context.lineWidth =
      Math.max(
        2,
        Number(
          mark.stroke_width
        ) || 3
      );


    context.lineCap =
      "round";


    context.lineJoin =
      "round";


    context.beginPath();


    points.forEach(
      (
        point,
        index
      ) => {

        const x =
          baseX +
          (
            Number(
              point.x
            ) || 0
          );


        const y =
          baseY +
          (
            Number(
              point.y
            ) || 0
          );


        if (
          index ===
          0
        ) {

          context.moveTo(
            x,
            y
          );

        } else {

          context.lineTo(
            x,
            y
          );

        }

      }
    );


    context.stroke();


    context.restore();

  }


  /* =======================================================
     SCORE
  ======================================================= */

  function drawRegionScore(
    context,
    region
  ) {

    const score =
      scores.find(
        item =>
          item.layout_box_id ===
          region.layout_box_id
      );


    if (!score) {

      return;

    }


    const regionX =
      Number(
        region.x
      ) || 0;


    const regionY =
      Number(
        region.y
      ) || 0;


    const regionWidth =
      Number(
        region.width
      ) || 100;


    const regionHeight =
      Number(
        region.height
      ) || 50;


    const x =
      regionX +
      regionWidth +
      10;


    const y =
      regionY +
      regionHeight / 2;


    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          regionHeight *
          0.25
        )
      );


    context.save();


    context.fillStyle =
      "#d00000";


    context.font =
      `bold ${fontSize}px Arial`;


    context.textBaseline =
      "middle";


    context.fillText(
      `${formatNumber(
        score.score
      )}点`,
      x,
      y
    );


    context.restore();

  }


  /* =======================================================
     PDF
  ======================================================= */

  async function downloadPdf() {

    if (!pages.length) {

      throw new Error(
        "答案ページがありません。"
      );

    }


    const JsPDF =
      await loadJsPdf();


    const canvases =
      [];


    for (
      const page
      of pages
    ) {

      canvases.push(
        await createPageCanvas(
          page
        )
      );

    }


    const first =
      canvases[0];


    const pdf =
      new JsPDF({

        orientation:
          first.width >=
          first.height
            ? "landscape"
            : "portrait",

        unit:
          "px",

        format:
          [
            first.width,
            first.height
          ],

        compress:
          true

      });


    canvases.forEach(
      (
        canvas,
        index
      ) => {

        if (
          index > 0
        ) {

          pdf.addPage(
            [
              canvas.width,
              canvas.height
            ],
            canvas.width >=
              canvas.height
              ? "landscape"
              : "portrait"
          );

        }


        pdf.addImage(
          canvas.toDataURL(
            "image/png"
          ),
          "PNG",
          0,
          0,
          canvas.width,
          canvas.height,
          undefined,
          "FAST"
        );

      }
    );


    pdf.save(
      "答案_採点済み.pdf"
    );

  }


  /* =======================================================
     PDF LIBRARY
  ======================================================= */

  let pdfPromise =
    null;


  function loadJsPdf() {

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
            window.jspdf?.jsPDF
          ) {

            resolve(
              window.jspdf.jsPDF
            );

            return;

          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";


          script.onload =
            () => {

              if (
                window.jspdf?.jsPDF
              ) {

                resolve(
                  window.jspdf.jsPDF
                );

              } else {

                reject(
                  new Error(
                    "PDFライブラリを読み込めませんでした。"
                  )
                );

              }

            };


          script.onerror =
            () =>
              reject(
                new Error(
                  "PDFライブラリの読み込みに失敗しました。"
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
     PRINT
  ======================================================= */

  async function printAnswer() {

    if (!pages.length) {

      throw new Error(
        "答案ページがありません。"
      );

    }


    const printWindow =
      window.open(
        "",
        "_blank"
      );


    if (!printWindow) {

      throw new Error(
        "印刷画面を開けませんでした。"
      );

    }


    printWindow.document.write(`

      <!doctype html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>
          採点済み答案
        </title>

        <style>

          @page {
            margin:0;
          }

          html,
          body {
            margin:0;
            padding:0;
          }

          img {
            display:block;
            width:100%;
            height:auto;
            page-break-after:always;
          }

          img:last-child {
            page-break-after:auto;
          }

        </style>

      </head>

      <body></body>

      </html>

    `);


    printWindow.document.close();


    for (
      const page
      of pages
    ) {

      const canvas =
        await createPageCanvas(
          page
        );


      const image =
        printWindow.document
          .createElement(
            "img"
          );


      image.src =
        canvas.toDataURL(
          "image/png"
        );


      printWindow.document.body
        .appendChild(
          image
        );

    }


    await wait(
      500
    );


    printWindow.focus();


    printWindow.print();

  }


  /* =======================================================
     PNG
  ======================================================= */

  async function downloadPng() {

    if (!pages.length) {

      throw new Error(
        "答案ページがありません。"
      );

    }


    for (
      const page
      of pages
    ) {

      const canvas =
        await createPageCanvas(
          page
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        canvas.toDataURL(
          "image/png"
        );


      link.download =
        `答案_採点済み_${String(
          page.page_no
        ).padStart(
          3,
          "0"
        )}.png`;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      await wait(
        150
      );

    }

  }


  /* =======================================================
     ACTION BUTTONS
  ======================================================= */

  function disableActions(
    disabled
  ) {

    if (printButton) {

      printButton.disabled =
        disabled;

    }


    if (pdfButton) {

      pdfButton.disabled =
        disabled;

    }


    if (downloadButton) {

      downloadButton.disabled =
        disabled;

    }

  }


  /* =======================================================
     CLEAR DATA
  ======================================================= */

  function clearData() {

    pages =
      [];

    regions =
      [];

    marks =
      [];

    scores =
      [];

    boxes =
      [];

  }


  /* =======================================================
     CLEAR PREVIEW
  ======================================================= */

  function clearPreview() {

    clearData();


    if (preview) {

      preview.innerHTML = `

        <div class="empty">
          採点済み答案を選択してください。
        </div>

      `;


      preview.style.display =
        "block";

    }


    disableActions(
      true
    );


    setStatus(
      "採点済み答案を選択してください。"
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
     WAIT
  ======================================================= */

  function wait(
    milliseconds
  ) {

    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          milliseconds
        )
    );

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
     NUMBER
  ======================================================= */

  function formatNumber(
    value
  ) {

    const number =
      Number(
        value
      );


    if (
      !Number.isFinite(
        number
      )
    ) {

      return "0";

    }


    return Number.isInteger(
      number
    )
      ? String(
          number
        )
      : number.toFixed(
          1
        );

  }


  /* =======================================================
     ESCAPE
  ======================================================= */

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


})();
