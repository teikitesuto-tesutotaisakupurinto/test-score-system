
/* =========================================================
   テスト成績システム
   採点済み答案返却
   js/teacher/answer-return.js

   最重要仕様
   ---------------------------------------------------------
   最終出力は「元答案」を基準にする。

   追加してよいもの
     ・保存済み採点記号
     ・点数

   追加してはいけないもの
     ・氏名
     ・生徒番号
     ・テスト名
     ・新しいヘッダー
     ・新しい枠
     ・layout_boxesの枠線
     ・ページ番号
     ・勝手な文字
     ・勝手な余白

   layout_boxes
     ↓
   自動クロップ用の基準
     ↓
   最終返却画像には描画しない。


   座標
   ---------------------------------------------------------
   元答案画像の原寸座標をそのまま使用する。

   表示用に縮小していても、
   Canvas内部では原寸座標で描画する。


   出力
   ---------------------------------------------------------
   元答案画像
       +
   mark_objects
       +
   scores
       ↓
   PDF / 印刷


   注意
   ---------------------------------------------------------
   answer_sheet_pages.file_path
   answer_sheet_pages.width_px
   answer_sheet_pages.height_px

   mark_objects.x / y
   scores.score

   を基準にする。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     State
  ======================================================= */

  let currentAnswerSheetId = null;

  let currentTestId = null;

  let pages = [];

  let scores = [];

  let marks = [];

  let layoutBoxes = [];

  let answerRegions = [];

  let currentStudent = null;

  let currentTest = null;


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const answerSelect =
    document.getElementById(
      "answerSelect"
    );


  const previewArea =
    document.getElementById(
      "returnPreview"
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


  const statusElement =
    document.getElementById(
      "status"
    );


  const teacherName =
    document.getElementById(
      "teacherName"
    );


  /* =======================================================
     Initialize
  ======================================================= */

  async function initialize() {

    try {

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


      await loadTests();

      setupEvents();

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
     Tests
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
          class_name
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


    if (!testSelect) {

      return;

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
                value="${escapeHtml(
                  test.id
                )}"
              >

                ${escapeHtml(
                  test.name
                )}

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     Events
  ======================================================= */

  function setupEvents() {

    testSelect
      ?.addEventListener(
        "change",
        async () => {

          currentTestId =
            testSelect.value ||
            null;


          clearPreview();


          if (!currentTestId) {

            return;

          }


          await loadAnswers();

        }
      );


    answerSelect
      ?.addEventListener(
        "change",
        async () => {

          currentAnswerSheetId =
            answerSelect.value ||
            null;


          if (
            !currentAnswerSheetId
          ) {

            clearPreview();

            return;

          }


          await loadAnswer();

        }
      );


    printButton
      ?.addEventListener(
        "click",
        printReturnedAnswer
      );


    pdfButton
      ?.addEventListener(
        "click",
        downloadPdf
      );


    downloadButton
      ?.addEventListener(
        "click",
        downloadImages
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
     Answers
  ======================================================= */

  async function loadAnswers() {

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
          student_id,
          test_id,
          status,
          created_at
        `)
        .eq(
          "test_id",
          currentTestId
        )
        .neq(
          "status",
          "unmatched"
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


    const answers =
      data || [];


    if (!answerSelect) {

      return;

    }


    answerSelect.innerHTML = `

      <option value="">
        答案を選択してください
      </option>

      ${
        answers
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
     Answer
  ======================================================= */

  async function loadAnswer() {

    setStatus(
      "答案を読み込んでいます..."
    );


    const {
      data:
        answer,
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          student_id,
          test_id,
          status,
          created_at
        `)
        .eq(
          "id",
          currentAnswerSheetId
        )
        .single();


    if (answerError) {

      throw answerError;

    }


    currentTestId =
      answer.test_id;


    /*
      Student
    */

    const {
      data:
        student,
      error:
        studentError
    } =
      await supabaseClient
        .from(
          "students"
        )
        .select(`
          id,
          student_no,
          name
        `)
        .eq(
          "id",
          answer.student_id
        )
        .maybeSingle();


    if (studentError) {

      throw studentError;

    }


    currentStudent =
      student;


    /*
      Test
    */

    const {
      data:
        test,
      error:
        testError
    } =
      await supabaseClient
        .from(
          "tests"
        )
        .select(`
          id,
          name
        `)
        .eq(
          "id",
          answer.test_id
        )
        .single();


    if (testError) {

      throw testError;

    }


    currentTest =
      test;


    /*
      Pages
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
          currentAnswerSheetId
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
      Scores
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
          currentAnswerSheetId
        )
        .eq(
          "status",
          "marked"
        );


    if (scoreError) {

      throw scoreError;

    }


    scores =
      scoreData || [];


    /*
      Mark objects
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
          question_id,
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
          points,
          created_at
        `)
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
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
      Regions

      最終返却では描画しない。
      座標変換の補助情報としてのみ使用。
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
          x,
          y,
          width,
          height,
          image_path
        `)
        .eq(
          "answer_sheet_id",
          currentAnswerSheetId
        );


    if (regionError) {

      throw regionError;

    }


    answerRegions =
      regionData || [];


    /*
      Layout boxes

      枠そのものは最終画像へ描画しない。
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
          height
        `)
        .eq(
          "test_id",
          currentTestId
        );


    if (boxError) {

      throw boxError;

    }


    layoutBoxes =
      boxData || [];


    await renderPreview();


    setStatus(
      "採点済み答案を表示しています。"
    );

  }


  /* =======================================================
     Preview
  ======================================================= */

  async function renderPreview() {

    if (!previewArea) {

      return;

    }


    previewArea.innerHTML =
      "";


    for (
      const page
      of pages
    ) {

      const canvas =
        await createReturnedCanvas(
          page
        );


      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "return-page";


      /*
        Canvasは画面上だけ縮小。
        内部解像度は元画像そのもの。
      */

      canvas.style.display =
        "block";

      canvas.style.width =
        "100%";

      canvas.style.height =
        "auto";


      wrapper.appendChild(
        canvas
      );


      previewArea.appendChild(
        wrapper
      );

    }

  }


  /* =======================================================
     Create returned Canvas
     
     元画像
       +
     mark_objects
       +
     scores

     layout_boxesは描画しない。
  ======================================================= */

  async function createReturnedCanvas(
    page
  ) {

    /*
      元画像をSigned URL取得
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
        "答案画像URLを取得できませんでした。"
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      元画像原寸
    */

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    /*
      1.
      元画像そのもの
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      2.
      採点記号だけ追加
    */

    const pageMarks =
      getPageMarks(
        page
      );


    pageMarks.forEach(
      mark => {

        drawMarkObject(
          context,
          mark
        );

      }
    );


    /*
      3.
      点数だけ追加
    */

    const pageScores =
      getPageScores(
        page
      );


    pageScores.forEach(
      score => {

        drawScoreOnly(
          context,
          score
        );

      }
    );


    /*
      絶対にここで
      layout_boxesを描画しない。
    */

    return canvas;

  }


  /* =======================================================
     Page Marks
  ======================================================= */

  function getPageMarks(
    page
  ) {

    return marks.filter(
      mark => {

        const box =
          layoutBoxes.find(
            item =>
              item.id ===
              mark.layout_box_id
          );


        if (!box) {

          return false;

        }


        const sourcePage =
          Number(
            getSourcePageNumber(
              box
            )
          );


        return (
          sourcePage ===
          Number(
            page.page_no
          )
        );

      }
    );

  }


  /* =======================================================
     Page Scores
  ======================================================= */

  function getPageScores(
    page
  ) {

    return scores.filter(
      score => {

        const box =
          layoutBoxes.find(
            item =>
              item.id ===
              score.layout_box_id
          );


        if (!box) {

          return false;

        }


        const sourcePage =
          Number(
            getSourcePageNumber(
              box
            )
          );


        return (
          sourcePage ===
          Number(
            page.page_no
          )
        );

      }
    );

  }


  /* =======================================================
     Source Page
  ======================================================= */

  function getSourcePageNumber(
    box
  ) {

    if (
      box.source_page_id
    ) {

      const region =
        answerRegions.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      if (
        region?.page_no
      ) {

        return region.page_no;

      }

    }


    return (
      box.page_no ||
      1
    );

  }


  /* =======================================================
     Mark Object
     
     x / yは答案画像上の座標を優先。

     answer_regionsがある場合は
     region座標を利用して補正する。
  ======================================================= */

  function drawMarkObject(
    context,
    mark
  ) {

    const box =
      layoutBoxes.find(
        item =>
          item.id ===
          mark.layout_box_id
      );


    if (!box) {

      return;

    }


    const region =
      answerRegions.find(
        item =>
          item.layout_box_id ===
          mark.layout_box_id
      );


    const position =
      convertMarkPosition(
        mark,
        box,
        region
      );


    const color =
      mark.color ||
      "#d00000";


    const fontSize =
      Number(
        mark.font_size
      ) || 42;


    const strokeWidth =
      Number(
        mark.stroke_width
      ) || 3;


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

      const radius =
        Math.max(
          10,
          Number(
            mark.width
          ) ||
          fontSize / 2
        );


      context.beginPath();


      context.arc(
        position.x,
        position.y,
        radius,
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

      const size =
        Math.max(
          12,
          Number(
            mark.width
          ) ||
          fontSize
        );


      context.beginPath();


      context.moveTo(
        position.x -
          size / 2,
        position.y -
          size / 2
      );


      context.lineTo(
        position.x +
          size / 2,
        position.y +
          size / 2
      );


      context.moveTo(
        position.x +
          size / 2,
        position.y -
          size / 2
      );


      context.lineTo(
        position.x -
          size / 2,
        position.y +
          size / 2
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

      const size =
        Math.max(
          12,
          Number(
            mark.width
          ) ||
          fontSize
        );


      context.beginPath();


      context.moveTo(
        position.x,
        position.y -
          size / 2
      );


      context.lineTo(
        position.x -
          size / 2,
        position.y +
          size / 2
      );


      context.lineTo(
        position.x +
          size / 2,
        position.y +
          size / 2
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


      context.textBaseline =
        "middle";


      context.fillText(
        "◎",
        position.x,
        position.y
      );

    }


    /*
      テキスト
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
        position.x,
        position.y
      );

    }


    /*
      ペン
    */

    else if (
      mark.object_type ===
      "pen"
    ) {

      drawPen(
        context,
        mark,
        box,
        region
      );

    }


    context.restore();

  }


  /* =======================================================
     Position
  ======================================================= */

  function convertMarkPosition(
    mark,
    box,
    region
  ) {

    /*
      すでにmark.x / yが
      元答案座標として保存されている場合。

      現行採点仕様を優先。
    */

    if (
      mark.coordinate_space ===
      "answer"
    ) {

      return {

        x:
          Number(
            mark.x
          ) || 0,

        y:
          Number(
            mark.y
          ) || 0

      };

    }


    /*
      answer_region基準の座標。

      region.x / yは答案原寸座標。
    */

    if (
      region
    ) {

      const localX =
        Number(
          mark.x
        ) || 0;


      const localY =
        Number(
          mark.y
        ) || 0;


      /*
        markがregion内座標の場合。
      */

      return {

        x:
          (
            Number(
              region.x
            ) || 0
          ) +
          localX,

        y:
          (
            Number(
              region.y
            ) || 0
          ) +
          localY

      };

    }


    /*
      最終fallback

      mark.x / yを
      そのまま原寸座標として使用。
    */

    return {

      x:
        Number(
          mark.x
        ) || 0,

      y:
        Number(
          mark.y
        ) || 0

    };

  }


  /* =======================================================
     Pen
  ======================================================= */

  function drawPen(
    context,
    mark,
    box,
    region
  ) {

    const points =
      Array.isArray(
        mark.points
      )
        ? mark.points
        : [];


    if (
      points.length < 2
    ) {

      return;

    }


    context.beginPath();


    points.forEach(
      (
        point,
        index
      ) => {

        let x =
          Number(
            point.x
          ) || 0;


        let y =
          Number(
            point.y
          ) || 0;


        if (
          region
        ) {

          x +=
            Number(
              region.x
            ) || 0;


          y +=
            Number(
              region.y
            ) || 0;

        }


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
     Score
     
     「点数だけ」を追加する。

     新しい枠・ラベル・氏名等は追加しない。
  ======================================================= */

  function drawScoreOnly(
    context,
    score
  ) {

    const box =
      layoutBoxes.find(
        item =>
          item.id ===
          score.layout_box_id
      );


    if (!box) {

      return;

    }


    const region =
      answerRegions.find(
        item =>
          item.layout_box_id ===
          score.layout_box_id
      );


    /*
      点数位置

      原則:
        解答欄右側

      ただしregionが存在する場合は
      regionの原寸座標を基準にする。
    */

    let x;

    let y;


    if (region) {

      x =
        (
          Number(
            region.x
          ) || 0
        ) +
        (
          Number(
            region.width
          ) ||
          Number(
            box.width
          ) ||
          0
        ) +
        10;


      y =
        (
          Number(
            region.y
          ) || 0
        ) +
        (
          Number(
            region.height
          ) ||
          Number(
            box.height
          ) ||
          30
        ) /
        2;

    } else {

      x =
        (
          Number(
            box.x
          ) || 0
        ) +
        (
          Number(
            box.width
          ) || 0
        ) +
        10;


      y =
        (
          Number(
            box.y
          ) || 0
        ) +
        (
          Number(
            box.height
          ) || 30
        ) /
        2;

    }


    /*
      点数フォント

      元画像サイズに合わせて決定。
    */

    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          (
            Number(
              region?.height
            ) ||
            Number(
              box.height
            ) ||
            50
          ) *
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
     
     jsPDFを動的ロード。
  ======================================================= */

  let jsPdfPromise =
    null;


  function loadJsPdf() {

    if (
      jsPdfPromise
    ) {

      return jsPdfPromise;

    }


    jsPdfPromise =
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
                    "jsPDFを読み込めませんでした。"
                  )
                );

              }

            };


          script.onerror =
            () => {

              reject(
                new Error(
                  "jsPDFの読み込みに失敗しました。"
                )
              );

            };


          document.head.appendChild(
            script
          );

        }
      );


    return jsPdfPromise;

  }


  /* =======================================================
     PDF Download
     
     ページごとに
     元画像サイズに近いPDFページを作る。
  ======================================================= */

  async function downloadPdf() {

    if (
      !pages.length
    ) {

      alert(
        "答案がありません。"
      );


      return;

    }


    try {

      const JsPDF =
        await loadJsPdf();


      const firstCanvas =
        await createReturnedCanvas(
          pages[0]
        );


      const firstWidth =
        firstCanvas.width;


      const firstHeight =
        firstCanvas.height;


      const orientation =
        firstWidth >=
        firstHeight
          ? "landscape"
          : "portrait";


      const pdf =
        new JsPDF({

          orientation,

          unit:
            "px",

          format:
            [
              firstWidth,
              firstHeight
            ],

          compress:
            true

        });


      /*
        最初のページ
      */

      addCanvasToPdf(
        pdf,
        firstCanvas,
        firstWidth,
        firstHeight
      );


      /*
        2ページ目以降
      */

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
          canvas,
          canvas.width,
          canvas.height
        );

      }


      /*
        ファイル名に
        氏名や生徒番号を追加しない。

        仕様:
        答案_採点済み.pdf
      */

      pdf.save(
        "答案_採点済み.pdf"
      );


    } catch (error) {

      console.error(
        "PDF:",
        error
      );


      alert(
        error.message ||
        "PDFを作成できませんでした。"
      );

    }

  }


  /* =======================================================
     Canvas → PDF
  ======================================================= */

  function addCanvasToPdf(
    pdf,
    canvas,
    width,
    height
  ) {

    const image =
      canvas.toDataURL(
        "image/png"
      );


    pdf.addImage(
      image,
      "PNG",
      0,
      0,
      width,
      height,
      undefined,
      "FAST"
    );

  }


  /* =======================================================
     Image Download
     
     PDFではなく
     各ページのPNGを保存。
  ======================================================= */

  async function downloadImages() {

    if (
      !pages.length
    ) {

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


      /*
        ブラウザのダウンロード処理が
       連続で詰まらないよう少し待つ。
      */

      await wait(
        150
      );

    }

  }


  /* =======================================================
     Print
     
     印刷時もCanvasを元画像比率のまま出す。
  ======================================================= */

  async function printReturnedAnswer() {

    if (
      !pages.length
    ) {

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


    printWindow.document.open();


    printWindow.document.write(`

      <!DOCTYPE html>

      <html lang="ja">

      <head>

        <meta charset="UTF-8">

        <title>
          答案_採点済み
        </title>

        <style>

          @page {

            margin:0;

          }


          html,
          body {

            margin:0;

            padding:0;

            background:#fff;

          }


          .page {

            width:100vw;

            page-break-after:always;

            break-after:page;

          }


          .page:last-child {

            page-break-after:auto;

            break-after:auto;

          }


          img {

            display:block;

            width:100%;

            height:auto;

          }

        </style>

      </head>

      <body>

      </body>

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


      const wrapper =
        printWindow.document
          .createElement(
            "div"
          );


      wrapper.className =
        "page";


      wrapper.appendChild(
        image
      );


      printWindow.document
        .body
        .appendChild(
          wrapper
        );

    }


    /*
      画像描画完了後に印刷
    */

    await wait(
      300
    );


    printWindow.focus();


    printWindow.print();

  }


  /* =======================================================
     Preview Clear
  ======================================================= */

  function clearPreview() {

    pages =
      [];

    scores =
      [];

    marks =
      [];

    layoutBoxes =
      [];

    answerRegions =
      [];


    currentAnswerSheetId =
      null;


    currentStudent =
      null;


    currentTest =
      null;


    if (previewArea) {

      previewArea.innerHTML =
        "";

    }

  }


  /* =======================================================
     Status
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


    if (previewArea) {

      previewArea.innerHTML = `

        <div
          style="
            padding:30px;
            color:#b42318;
          "
        >

          ${escapeHtml(
            message
          )}

        </div>

      `;

    }

  }


  /* =======================================================
     Image
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
     Wait
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
     Escape
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


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
