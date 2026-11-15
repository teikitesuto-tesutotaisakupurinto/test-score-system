
/* =========================================================
   テスト成績システム
   js/teacher/answer-return.js

   採点済み答案返却

   最終仕様
   ---------------------------------------------------------
   元答案
      +
   採点記号
      +
   点数

   追加しないもの
   ---------------------------------------------------------
   ・氏名
   ・生徒番号
   ・テスト名
   ・新しい枠
   ・layout_boxesの枠線
   ・ヘッダー
   ・フッター
   ・「採点済み」などの文字

   DB
   ---------------------------------------------------------
   test_pages.image_path
      → 元の解答用紙ではなく、
        答案ページでは answer_sheet_pages.file_path

   answer_regions.image_path
      → 自動クロップ画像

   mark_objects
      → 採点記号

   scores
      → 点数

   座標
   ---------------------------------------------------------
   answer_regions.x/y
      = 元答案上の解答欄左上

   mark_objects.x/y
      = answer_regions内の座標

   返却時
      answer_regions.x/y
      +
      mark_objects.x/y
      =
      元答案座標
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let answerSheetId = null;

  let pages = [];

  let regions = [];

  let marks = [];

  let scores = [];

  let boxes = [];


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


      setupEvents();

      await loadAnswers();


      /*
        URL:
        ?answer=UUID
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


        await loadAnswer();

      }
    );


    document
      .getElementById(
        "pdfButton"
      )
      ?.addEventListener(
        "click",
        downloadPdf
      );


    document
      .getElementById(
        "printButton"
      )
      ?.addEventListener(
        "click",
        printAnswer
      );


    document
      .getElementById(
        "downloadButton"
      )
      ?.addEventListener(
        "click",
        downloadPng
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
     LOAD ANSWERS
  ======================================================= */

  async function loadAnswers() {

    if (!answerSelect) {
      return;
    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          test_id,
          student_id,
          status,
          created_at
        `)
        .eq(
          "status",
          "marked"
        )
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


    answerSelect.innerHTML = `

      <option value="">
        採点済み答案を選択してください
      </option>

      ${
        (data || [])
          .map(
            answer => `

              <option
                value="${escapeHtml(
                  answer.id
                )}"
              >

                ${escapeHtml(
                  answer.id
                )}

              </option>

            `
          )
          .join("")
      }

    `;

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


    /*
      =====================================================
      答案ページ
      =====================================================

      answer_sheet_pages.file_path
      を使用。

      test_pages.image_pathではない。

      test_pages.image_pathは
      解答用紙テンプレート用。

      答案そのものは
      answer_sheet_pages.file_path。
    */

    const {
      data:
        pageData,
      error:
        pageError
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          answer_sheet_id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
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
      =====================================================
      answer_regions
      =====================================================
    */

    const {
      data:
        regionData,
      error:
        regionError
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          page_no,
          image_path,
          x,
          y,
          width,
          height
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "page_no",
          {
            ascending:
              true
          }
        );


    if (regionError) {
      throw regionError;
    }


    regions =
      regionData || [];


    /*
      =====================================================
      mark_objects
      =====================================================
    */

    const {
      data:
        markData,
      error:
        markError
    } =
      await supabaseClient
        .from(
          "mark_objects"
        )
        .select(`
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
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "created_at",
          {
            ascending:
              true
          }
        );


    if (markError) {
      throw markError;
    }


    marks =
      markData || [];


    /*
      =====================================================
      scores
      =====================================================
    */

    const {
      data:
        scoreData,
      error:
        scoreError
    } =
      await supabaseClient
        .from(
          "scores"
        )
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          question_id,
          score,
          status
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (scoreError) {
      throw scoreError;
    }


    scores =
      scoreData || [];


    /*
      =====================================================
      layout_boxes

      枠そのものは描画しない。

      必要なID情報だけ。
      =====================================================
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
        )
      ];


    if (layoutBoxIds.length) {

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
            question_id,
            label,
            points
          `)
          .in(
            "id",
            layoutBoxIds
          );


      if (boxError) {
        throw boxError;
      }


      boxes =
        boxData || [];

    } else {

      boxes =
        [];

    }


    /*
      表示
    */

    await renderPreview();


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


    if (!pages.length) {

      preview.innerHTML = `

        <div class="empty">
          答案ページがありません。
        </div>

      `;

      return;

    }


    for (
      const page
      of pages
    ) {

      const canvas =
        await createReturnedCanvas(
          page
        );


      canvas.style.display =
        "block";


      canvas.style.width =
        "100%";


      canvas.style.height =
        "auto";


      canvas.style.marginBottom =
        "20px";


      preview.appendChild(
        canvas
      );

    }

  }


  /* =======================================================
     CREATE RETURNED CANVAS
  ======================================================= */

  async function createReturnedCanvas(
    page
  ) {

    /*
      =====================================================
      元答案

      answer_sheet_pages.file_path
      =====================================================
    */

    if (!page.file_path) {

      throw new Error(
        `答案ページ${page.page_no}のfile_pathがありません。`
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
        `答案ページ${page.page_no}の画像URLを取得できませんでした。`
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    /*
      元画像原寸
    */

    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    /*
      元答案をそのまま描画
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      =====================================================
      このページのregion
      =====================================================
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


    for (
      const region
      of pageRegions
    ) {

      /*
        ===================================================
        採点記号
        ===================================================
      */

      marks
        .filter(
          mark =>
            mark.layout_box_id ===
            region.layout_box_id
        )
        .forEach(
          mark => {

            drawMark(
              context,
              mark,
              region
            );

          }
        );


      /*
        ===================================================
        点数

        「点数だけ追加」

        枠・設問名などは追加しない。
        ===================================================
      */

      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            region.layout_box_id
        );


      if (score) {

        drawScore(
          context,
          score,
          region
        );

      }

    }


    return canvas;

  }


  /* =======================================================
     DRAW MARK
  ======================================================= */

  function drawMark(
    context,
    mark,
    region
  ) {

    /*
      region内座標
      +
      元答案上のregion座標
    */

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


    const width =
      Number(
        mark.width
      ) ||
      Number(
        mark.font_size
      ) ||
      50;


    const height =
      Number(
        mark.height
      ) ||
      width;


    const color =
      mark.color ||
      "#d00000";


    const strokeWidth =
      Number(
        mark.stroke_width
      ) || 4;


    const fontSize =
      Number(
        mark.font_size
      ) || 42;


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
      ○
    */

    if (
      mark.object_type ===
      "circle"
    ) {

      context.beginPath();


      context.arc(
        x,
        y,
        Math.max(
          5,
          width / 2
        ),
        0,
        Math.PI * 2
      );


      context.stroke();

    }


    /*
      ×
    */

    else if (
      mark.object_type ===
      "x"
    ) {

      context.beginPath();


      context.moveTo(
        x - width / 2,
        y - height / 2
      );


      context.lineTo(
        x + width / 2,
        y + height / 2
      );


      context.moveTo(
        x + width / 2,
        y - height / 2
      );


      context.lineTo(
        x - width / 2,
        y + height / 2
      );


      context.stroke();

    }


    /*
      △
    */

    else if (
      mark.object_type ===
      "triangle"
    ) {

      context.beginPath();


      context.moveTo(
        x,
        y - height / 2
      );


      context.lineTo(
        x - width / 2,
        y + height / 2
      );


      context.lineTo(
        x + width / 2,
        y + height / 2
      );


      context.closePath();


      context.stroke();

    }


    /*
      ◎
    */

    else if (
      mark.object_type ===
      "double_circle"
    ) {

      context.font =
        `bold ${fontSize}px Arial`;


      context.textAlign =
        "center";


      context.textBaseline =
        "middle";


      context.fillText(
        "◎",
        x,
        y
      );

    }


    /*
      文字
    */

    else if (
      mark.object_type ===
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
      ペン
    */

    else if (
      mark.object_type ===
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


    /*
      JSON文字列の場合
    */

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
      !Array.isArray(points) ||
      points.length < 2
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
          index === 0
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

  }


  /* =======================================================
     SCORE
  ======================================================= */

  function drawScore(
    context,
    score,
    region
  ) {

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


    /*
      点数はregionの右側。

      元答案上に直接追加。
    */

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
          regionHeight * 0.25
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
      `${Number(
        score.score
      ) || 0}点`,
      x,
      y
    );


    context.restore();

  }


  /* =======================================================
     PDF
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
     DOWNLOAD PDF
  ======================================================= */

  async function downloadPdf() {

    if (!pages.length) {

      alert(
        "答案がありません。"
      );

      return;

    }


    const JsPDF =
      await loadJsPdf();


    const first =
      await createReturnedCanvas(
        pages[0]
      );


    const orientation =
      first.width >=
      first.height
        ? "landscape"
        : "portrait";


    const pdf =
      new JsPDF({

        orientation,

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


    addCanvasToPdf(
      pdf,
      first
    );


    for (
      let i = 1;
      i < pages.length;
      i++
    ) {

      const canvas =
        await createReturnedCanvas(
          pages[i]
        );


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


      addCanvasToPdf(
        pdf,
        canvas
      );

    }


    pdf.save(
      "答案_採点済み.pdf"
    );

  }


  function addCanvasToPdf(
    pdf,
    canvas
  ) {

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


  /* =======================================================
     PRINT
  ======================================================= */

  async function printAnswer() {

    if (!pages.length) {

      alert(
        "答案がありません。"
      );

      return;

    }


    const printWindow =
      window.open(
        "",
        "_blank"
      );


    if (!printWindow) {

      alert(
        "印刷画面を開けませんでした。"
      );

      return;

    }


    printWindow.document.write(`

      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>答案</title>

        <style>

          @page {
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          img {
            display: block;
            width: 100%;
            height: auto;
            page-break-after: always;
          }

          img:last-child {
            page-break-after: auto;
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
        await createReturnedCanvas(
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
     DOWNLOAD PNG
  ======================================================= */

  async function downloadPng() {

    if (!pages.length) {

      alert(
        "答案がありません。"
      );

      return;

    }


    for (
      const page
      of pages
    ) {

      const canvas =
        await createReturnedCanvas(
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
     CLEAR
  ======================================================= */

  function clearPreview() {

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


    if (preview) {

      preview.innerHTML = `

        <div class="empty">
          答案を選択してください。
        </div>

      `;

    }


    setStatus(
      "答案を選択してください。"
    );

  }


  /* =======================================================
     HELPERS
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
