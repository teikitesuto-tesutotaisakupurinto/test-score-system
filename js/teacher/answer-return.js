
/* =========================================================
   採点済み答案返却 最終版

   出力内容
   ---------------------------------------------------------
   元答案
   +
   保存済み採点記号
   +
   点数

   出力しないもの
   ---------------------------------------------------------
   氏名
   生徒番号
   テスト名
   新しい枠
   layout_boxes
   ページ番号
   ヘッダー
   フッター
   「採点済み」文字


   座標
   ---------------------------------------------------------
   answer_regions
      x / y
      ↓
   mark_objects
      x / y = region内座標
      ↓
   元答案座標へ復元
========================================================= */

(function () {

  "use strict";


  let answerSheetId = null;

  let pages = [];

  let regions = [];

  let marks = [];

  let scores = [];

  let boxes = [];


  const preview =
    document.getElementById(
      "returnPreview"
    );

  const answerSelect =
    document.getElementById(
      "answerSelect"
    );


  /* =======================================================
     INIT
  ======================================================= */

  async function initialize() {

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


    await loadAnswers();

    setupEvents();

  }


  /* =======================================================
     ANSWERS
  ======================================================= */

  async function loadAnswers() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("answer_sheets")
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
            ascending:false
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
                value="${escapeHtml(answer.id)}"
              >
                ${escapeHtml(answer.id)}
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

    answerSelect?.addEventListener(
      "change",
      async () => {

        answerSheetId =
          answerSelect.value ||
          null;


        if (answerSheetId) {

          await loadAnswer();

        }

      }
    );


    document
      .getElementById("pdfButton")
      ?.addEventListener(
        "click",
        downloadPdf
      );


    document
      .getElementById("printButton")
      ?.addEventListener(
        "click",
        printAnswer
      );


    document
      .getElementById("downloadButton")
      ?.addEventListener(
        "click",
        downloadPng
      );


    document
      .getElementById("logoutButton")
      ?.addEventListener(
        "click",
        logout
      );

  }


  /* =======================================================
     LOAD
  ======================================================= */

  async function loadAnswer() {

    const {
      data: pageData,
      error: pageError
    } =
      await supabaseClient
        .from("answer_sheet_pages")
        .select(`
          id,
          page_no,
          file_path,
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
            ascending:true
          }
        );


    if (pageError) {
      throw pageError;
    }


    pages =
      pageData || [];


    const {
      data: regionData,
      error: regionError
    } =
      await supabaseClient
        .from("answer_regions")
        .select(`
          id,
          layout_box_id,
          page_no,
          x,
          y,
          width,
          height
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (regionError) {
      throw regionError;
    }


    regions =
      regionData || [];


    const {
      data: markData,
      error: markError
    } =
      await supabaseClient
        .from("mark_objects")
        .select(`
          id,
          layout_box_id,
          object_type,
          text_value,
          color,
          font_size,
          stroke_width,
          x,
          y,
          width,
          height,
          points
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        );


    if (markError) {
      throw markError;
    }


    marks =
      markData || [];


    const {
      data: scoreData,
      error: scoreError
    } =
      await supabaseClient
        .from("scores")
        .select(`
          id,
          layout_box_id,
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
      layout_boxesは座標補助にだけ使用。

      枠として描画しない。
    */

    const {
      data: boxData,
      error: boxError
    } =
      await supabaseClient
        .from("layout_boxes")
        .select(`
          id,
          points
        `)
        .in(
          "id",
          [
            ...new Set(
              [
                ...regions.map(
                  r => r.layout_box_id
                ),
                ...marks.map(
                  m => m.layout_box_id
                ),
                ...scores.map(
                  s => s.layout_box_id
                )
              ]
            )
          ]
        );


    if (boxError) {
      throw boxError;
    }


    boxes =
      boxData || [];


    await renderPreview();

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


      preview.appendChild(
        canvas
      );

    }

  }


  /* =======================================================
     CREATE RETURNED IMAGE
  ======================================================= */

  async function createReturnedCanvas(
    page
  ) {

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
      元画像をそのまま描画
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      採点記号
    */

    regions
      .filter(
        region =>
          Number(
            region.page_no
          ) ===
          Number(
            page.page_no
          )
      )
      .forEach(
        region => {

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
            点数のみ。

            layout_boxの枠は描かない。
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
      );


    return canvas;

  }


  /* =======================================================
     MARK
  ======================================================= */

  function drawMark(
    context,
    mark,
    region
  ) {

    /*
      region内座標
      +
      regionの元答案座標
    */

    const x =
      Number(region.x || 0) +
      Number(mark.x || 0);


    const y =
      Number(region.y || 0) +
      Number(mark.y || 0);


    const width =
      Number(mark.width) ||
      Number(mark.font_size) ||
      50;


    const height =
      Number(mark.height) ||
      width;


    const color =
      mark.color ||
      "#d00000";


    const stroke =
      Number(
        mark.stroke_width
      ) || 4;


    const font =
      Number(
        mark.font_size
      ) || 42;


    context.save();


    context.strokeStyle =
      color;

    context.fillStyle =
      color;

    context.lineWidth =
      stroke;

    context.lineCap =
      "round";

    context.lineJoin =
      "round";


    if (
      mark.object_type ===
      "circle"
    ) {

      context.beginPath();

      context.arc(
        x,
        y,
        width / 2,
        0,
        Math.PI * 2
      );

      context.stroke();

    }


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


    else if (
      mark.object_type ===
      "double_circle"
    ) {

      context.font =
        `bold ${font}px Arial`;

      context.textBaseline =
        "middle";

      context.fillText(
        "◎",
        x,
        y
      );

    }


    else if (
      mark.object_type ===
      "text"
    ) {

      context.font =
        `${font}px Arial`;

      context.textBaseline =
        "middle";

      context.fillText(
        mark.text_value || "",
        x,
        y
      );

    }


    else if (
      mark.object_type ===
      "pen"
    ) {

      /*
        pointsが保存されている場合。
      */

      const points =
        Array.isArray(
          mark.points
        )
          ? mark.points
          : [];


      if (points.length > 1) {

        context.beginPath();


        points.forEach(
          (
            point,
            index
          ) => {

            const px =
              Number(region.x || 0) +
              Number(point.x || 0);


            const py =
              Number(region.y || 0) +
              Number(point.y || 0);


            if (index === 0) {

              context.moveTo(
                px,
                py
              );

            } else {

              context.lineTo(
                px,
                py
              );

            }

          }
        );


        context.stroke();

      }

    }


    context.restore();

  }


  /* =======================================================
     SCORE
     
     点数「だけ」を追加。
     
     枠・設問名・氏名等は追加しない。
  ======================================================= */

  function drawScore(
    context,
    score,
    region
  ) {

    const regionWidth =
      Number(
        region.width
      ) || 100;


    const regionHeight =
      Number(
        region.height
      ) || 50;


    /*
      点数位置は答案領域の右側。

      元答案の座標で描画。
    */

    const x =
      Number(region.x || 0) +
      regionWidth +
      10;


    const y =
      Number(region.y || 0) +
      regionHeight / 2;


    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          regionHeight * .25
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
      `${Number(score.score) || 0}点`,
      x,
      y
    );


    context.restore();

  }


  /* =======================================================
     PDF
  ======================================================= */

  let pdfPromise = null;


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
     PDF DOWNLOAD
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


    const pdf =
      new JsPDF({

        orientation:
          first.width >= first.height
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


    addCanvas(
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
        canvas.width >= canvas.height
          ? "landscape"
          : "portrait"
      );


      addCanvas(
        pdf,
        canvas
      );

    }


    pdf.save(
      "答案_採点済み.pdf"
    );

  }


  function addCanvas(
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
      return;
    }


    const win =
      window.open(
        "",
        "_blank"
      );


    if (!win) {

      alert(
        "印刷画面を開けませんでした。"
      );

      return;

    }


    win.document.write(`

      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>答案</title>

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


    win.document.close();


    for (
      const page
      of pages
    ) {

      const canvas =
        await createReturnedCanvas(
          page
        );


      const image =
        win.document.createElement(
          "img"
        );


      image.src =
        canvas.toDataURL(
          "image/png"
        );


      win.document.body.appendChild(
        image
      );

    }


    await wait(300);


    win.focus();

    win.print();

  }


  /* =======================================================
     PNG
  ======================================================= */

  async function downloadPng() {

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


      link.click();


      await wait(150);

    }

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
          reject;


        image.src =
          src;

      }
    );

  }


  function wait(
    ms
  ) {

    return new Promise(
      resolve =>
        setTimeout(
          resolve,
          ms
        )
    );

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");

  }


  initialize();

})();
