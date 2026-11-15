
/* =========================================================
   テスト成績システム
   採点済み答案返却 完全版

   元答案画像
       ↓
   Canvas
       ↓
   layout_boxes
       ↓
   mark_objects
       ↓
   scores
       ↓
   採点記号・点数を元画像座標へ描画
       ↓
   印刷 / PDF


   座標仕様

   mark_objects.x / y
   =
   answer_region内の元画像座標

   返却時:

   answer_region座標
       ↓
   layout_boxの元ページ座標
       ↓
   元答案Canvasへ描画
========================================================= */


(function () {

  "use strict";


  /* =====================================================
     状態
  ===================================================== */

  let tests = [];

  let students = [];

  let selectedTestId = null;

  let selectedStudentId = null;

  let selectedAnswer = null;

  let answerPages = [];

  let regions = [];

  let scores = [];

  let marks = [];

  let layoutBoxes = [];

  let generatedPageCanvases = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

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


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        profile.name ||
        "先生";

    }


    await loadTests();

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
        .from(
          "tests"
        )
        .select(`
          id,
          name,
          subject,
          grade,
          class_name,
          max_score
        `)
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      console.error(
        "テスト:",
        error
      );


      return;

    }


    tests =
      data || [];


    const select =
      document.getElementById(
        "testSelect"
      );


    if (!select) {

      return;

    }


    select.innerHTML = `

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


  /* =====================================================
     テスト選択
  ===================================================== */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  if (testSelect) {

    testSelect.addEventListener(
      "change",
      async event => {

        selectedTestId =
          event.target.value ||
          null;


        selectedStudentId =
          null;


        selectedAnswer =
          null;


        resetPreview();


        const studentSelect =
          document.getElementById(
            "studentSelect"
          );


        if (!selectedTestId) {

          if (studentSelect) {

            studentSelect.disabled =
              true;


            studentSelect.innerHTML = `

              <option value="">
                先にテストを選択してください
              </option>

            `;

          }


          return;

        }


        await loadStudents();

      }
    );

  }


  /* =====================================================
     生徒
  ===================================================== */

  async function loadStudents() {

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
          status,
          created_at,
          students(
            id,
            student_no,
            name
          )
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      console.error(
        "生徒:",
        error
      );


      return;

    }


    const map =
      new Map();


    (
      data || []
    ).forEach(
      answer => {

        if (
          answer.students
        ) {

          map.set(
            answer.students.id,
            answer.students
          );

        }

      }
    );


    students =
      [
        ...map.values()
      ]
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.student_no || ""
          ).localeCompare(
            String(
              b.student_no || ""
            ),
            undefined,
            {
              numeric:true
            }
          )
      );


    const select =
      document.getElementById(
        "studentSelect"
      );


    if (!select) {

      return;

    }


    select.disabled =
      false;


    select.innerHTML = `

      <option value="">
        生徒を選択してください
      </option>

      ${
        students
          .map(
            student => `

              <option
                value="${escapeHtml(
                  student.id
                )}"
              >

                ${escapeHtml(
                  student.student_no
                )}

                -

                ${escapeHtml(
                  student.name
                )}

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =====================================================
     生徒変更
  ===================================================== */

  const studentSelect =
    document.getElementById(
      "studentSelect"
    );


  if (studentSelect) {

    studentSelect.addEventListener(
      "change",
      async event => {

        selectedStudentId =
          event.target.value ||
          null;


        if (!selectedStudentId) {

          resetPreview();

          return;

        }


        await loadStudentAnswer();

      }
    );

  }


  /* =====================================================
     生徒答案
  ===================================================== */

  async function loadStudentAnswer() {

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
          status,
          created_at
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .eq(
          "student_id",
          selectedStudentId
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

      console.error(
        "答案:",
        error
      );


      return;

    }


    if (!data) {

      alert(
        "この生徒の答案が見つかりません。"
      );


      resetPreview();

      return;

    }


    selectedAnswer =
      data;


    try {

      await Promise.all([

        loadAnswerPages(),

        loadRegions(),

        loadScores(),

        loadMarks(),

        loadLayoutBoxes()

      ]);


      await buildMarkedPages();

      renderPreview();

    } catch (error) {

      console.error(
        "返却データ:",
        error
      );


      alert(
        error.message ||
        "採点済み答案を生成できませんでした。"
      );

    }

  }


  /* =====================================================
     答案ページ
  ===================================================== */

  async function loadAnswerPages() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          selectedAnswer.id
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    answerPages =
      data || [];

  }


  /* =====================================================
     Regions
  ===================================================== */

  async function loadRegions() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          image_path,
          page_no,
          x,
          y,
          width,
          height
        `)
        .eq(
          "answer_sheet_id",
          selectedAnswer.id
        );


    if (error) {

      throw error;

    }


    regions =
      data || [];

  }


  /* =====================================================
     Scores
  ===================================================== */

  async function loadScores() {

    const {
      data,
      error
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
          status,
          marked_by,
          marked_at
        `)
        .eq(
          "answer_sheet_id",
          selectedAnswer.id
        )
        .eq(
          "status",
          "marked"
        );


    if (error) {

      throw error;

    }


    scores =
      data || [];

  }


  /* =====================================================
     Mark objects
  ===================================================== */

  async function loadMarks() {

    const {
      data,
      error
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
          selectedAnswer.id
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    marks =
      data || [];

  }


  /* =====================================================
     Layout
  ===================================================== */

  async function loadLayoutBoxes() {

    const {
      data,
      error
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
          points,
          x,
          y,
          width,
          height
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .eq(
          "box_type",
          "answer"
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        )
        .order(
          "y",
          {
            ascending:true
          }
        )
        .order(
          "x",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    layoutBoxes =
      data || [];

  }


  /* =====================================================
     採点済みページ生成
  ===================================================== */

  async function buildMarkedPages() {

    generatedPageCanvases =
      [];


    for (
      const page
      of answerPages
    ) {

      const canvas =
        await createMarkedPageCanvas(
          page
        );


      generatedPageCanvases.push({

        page,

        canvas

      });

    }

  }


  /* =====================================================
     元画像Canvas
  ===================================================== */

  async function createMarkedPageCanvas(
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


    if (
      !data?.signedUrl
    ) {

      throw new Error(
        `${page.page_no}ページの画像URLを取得できませんでした。`
      );

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      元画像と完全に同じサイズ
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
      元画像
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      このページの解答欄
    */

    const pageBoxes =
      layoutBoxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            page.page_no
          )
      );


    /*
      採点結果を焼き込む
    */

    for (
      const box
      of pageBoxes
    ) {

      const region =
        regions.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      const pageMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            box.id
        );


      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      drawReturnMarks(
        context,
        box,
        region,
        pageMarks
      );


      if (score) {

        drawReturnScore(
          context,
          box,
          region,
          score.score
        );

      }

    }


    return canvas;

  }


  /* =====================================================
     記号焼き込み
  ===================================================== */

  function drawReturnMarks(
    context,
    box,
    region,
    pageMarks
  ) {

    if (
      !pageMarks.length
    ) {

      return;

    }


    /*
      region内座標
      ↓
      元答案ページ座標
    */

    const regionWidth =
      Number(
        region?.width
      ) ||
      Number(
        box.width
      ) ||
      1;


    const regionHeight =
      Number(
        region?.height
      ) ||
      Number(
        box.height
      ) ||
      1;


    const boxWidth =
      Number(
        box.width
      ) ||
      regionWidth;


    const boxHeight =
      Number(
        box.height
      ) ||
      regionHeight;


    const scaleX =
      boxWidth /
      regionWidth;


    const scaleY =
      boxHeight /
      regionHeight;


    pageMarks.forEach(
      mark => {

        const color =
          mark.color ||
          "#c62828";


        const originalSize =
          Number(
            mark.font_size
          ) ||
          42;


        const size =
          originalSize *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        const localX =
          Number(
            mark.x
          ) ||
          0;


        const localY =
          Number(
            mark.y
          ) ||
          0;


        const pageX =
          Number(
            box.x
          ) +
          localX *
          scaleX;


        const pageY =
          Number(
            box.y
          ) +
          localY *
          scaleY;


        context.save();


        context.strokeStyle =
          color;


        context.fillStyle =
          color;


        context.lineWidth =
          (
            Number(
              mark.stroke_width
            ) ||
            3
          ) *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        /*
          ○
        */

        if (
          mark.object_type ===
          "circle"
        ) {

          context.beginPath();


          context.arc(
            pageX,
            pageY,
            size / 2,
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
            pageX -
              size / 2,
            pageY -
              size / 2
          );


          context.lineTo(
            pageX +
              size / 2,
            pageY +
              size / 2
          );


          context.moveTo(
            pageX +
              size / 2,
            pageY -
              size / 2
          );


          context.lineTo(
            pageX -
              size / 2,
            pageY +
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

          context.beginPath();


          context.moveTo(
            pageX,
            pageY -
              size / 2
          );


          context.lineTo(
            pageX -
              size / 2,
            pageY +
              size / 2
          );


          context.lineTo(
            pageX +
              size / 2,
            pageY +
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
            `bold ${size}px Arial`;


          context.textBaseline =
            "alphabetic";


          context.fillText(
            "◎",
            pageX,
            pageY
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
            `${size}px Arial`;


          context.textBaseline =
            "alphabetic";


          context.fillText(
            mark.text_value ||
            "",
            pageX,
            pageY
          );

        }


        /*
          ペン
        */

        else if (
          mark.object_type ===
          "pen"
        ) {

          const points =
            Array.isArray(
              mark.points
            )
              ? mark.points
              : [];


          if (
            points.length
          ) {

            context.beginPath();


            points.forEach(
              (
                point,
                index
              ) => {

                const px =
                  Number(
                    box.x
                  ) +
                  (
                    Number(
                      point.x
                    ) ||
                    0
                  ) *
                  scaleX;


                const py =
                  Number(
                    box.y
                  ) +
                  (
                    Number(
                      point.y
                    ) ||
                    0
                  ) *
                  scaleY;


                if (
                  index === 0
                ) {

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
    );

  }


  /* =====================================================
     点数焼き込み
  ===================================================== */

  function drawReturnScore(
    context,
    box,
    region,
    score
  ) {

    const x =
      Number(
        box.x
      ) || 0;


    const y =
      Number(
        box.y
      ) || 0;


    const width =
      Number(
        box.width
      ) || 100;


    const height =
      Number(
        box.height
      ) || 50;


    /*
      解答欄右上
    */

    const padding =
      Math.max(
        6,
        Math.min(
          width,
          height
        ) * 0.05
      );


    const scoreX =
      x +
      width +
      padding;


    const scoreY =
      y +
      Math.max(
        22,
        height * 0.25
      );


    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          height * 0.25
        )
      );


    context.save();


    context.fillStyle =
      "#c62828";


    context.font =
      `bold ${fontSize}px Arial`;


    context.textBaseline =
      "middle";


    context.fillText(
      `${score}点`,
      scoreX,
      scoreY
    );


    context.restore();

  }


  /* =====================================================
     プレビュー
  ===================================================== */

  function renderPreview() {

    const container =
      document.getElementById(
        "returnPreview"
      );


    if (!container) {

      return;

    }


    const student =
      students.find(
        item =>
          item.id ===
          selectedStudentId
      );


    const test =
      tests.find(
        item =>
          item.id ===
          selectedTestId
      );


    const total =
      scores.reduce(
        (
          sum,
          item
        ) =>
          sum +
          (
            Number(
              item.score
            ) || 0
          ),
        0
      );


    container.style.display =
      "block";


    container.innerHTML = `

      <div
        class="return-page"
        id="returnDocument"
      >

        <div
          class="return-header"
        >

          <div
            class="return-title"
          >

            ${escapeHtml(
              test?.name ||
              "採点済み答案"
            )}

          </div>


          <div
            class="return-student"
          >

            生徒番号：

            ${escapeHtml(
              student?.student_no ||
              ""
            )}

            <br>

            氏名：

            ${escapeHtml(
              student?.name ||
              ""
            )}

          </div>

        </div>


        <div
          class="return-score"
        >

          合計点：

          <strong>
            ${total}
          </strong>

          点

        </div>


        <div
          id="generatedReturnPages"
          class="return-answer"
        >
        </div>

      </div>

    `;


    const pagesContainer =
      document.getElementById(
        "generatedReturnPages"
      );


    generatedPageCanvases.forEach(
      item => {

        const wrapper =
          document.createElement(
            "div"
          );


        wrapper.className =
          "return-answer-page";


        const image =
          document.createElement(
            "img"
          );


        image.src =
          item.canvas.toDataURL(
            "image/png"
          );


        image.alt =
          `採点済み答案 ${item.page.page_no}ページ`;


        image.style.cssText = `

          display:block;

          width:100%;

          height:auto;

        `;


        wrapper.appendChild(
          image
        );


        pagesContainer.appendChild(
          wrapper
        );

      }
    );


    enableReturnButtons();

  }


  /* =====================================================
     印刷
  ===================================================== */

  const printButton =
    document.getElementById(
      "printButton"
    );


  if (printButton) {

    printButton.addEventListener(
      "click",
      async () => {

        if (
          !generatedPageCanvases.length
        ) {

          await buildMarkedPages();

          renderPreview();

        }


        window.print();

      }
    );

  }


  /* =====================================================
     PDF
  ===================================================== */

  const pdfButton =
    document.getElementById(
      "pdfButton"
    );


  if (pdfButton) {

    pdfButton.addEventListener(
      "click",
      async () => {

        await exportPdf();

      }
    );

  }


  /* =====================================================
     PDF生成

     CanvasをそのままPDFへ配置
  ===================================================== */

  async function exportPdf() {

    if (!selectedAnswer) {

      alert(
        "生徒を選択してください。"
      );


      return;

    }


    if (
      !window.jspdf?.jsPDF
    ) {

      alert(
        "PDFライブラリが読み込まれていません。"
      );


      return;

    }


    /*
      最新状態を再生成
    */

    await buildMarkedPages();


    const {
      jsPDF
    } =
      window.jspdf;


    const pdf =
      new jsPDF({

        orientation:
          "portrait",

        unit:
          "mm",

        format:
          "a4"

      });


    let first =
      true;


    for (
      const item
      of generatedPageCanvases
    ) {

      if (!first) {

        pdf.addPage();

      }


      first =
        false;


      const canvas =
        item.canvas;


      /*
        PNGなので
        元答案の文字を
        JPEG圧縮しない。
      */

      const imageData =
        canvas.toDataURL(
          "image/png"
        );


      const size =
        fitCanvasToA4(
          canvas
        );


      pdf.addImage(

        imageData,

        "PNG",

        size.x,

        size.y,

        size.width,

        size.height,

        undefined,

        "FAST"

      );

    }


    const student =
      students.find(
        item =>
          item.id ===
          selectedStudentId
      );


    pdf.save(

      `${sanitizeFilename(
        getTestName()
      )}-${sanitizeFilename(
        student?.student_no ||
        "student"
      )}-採点済み答案.pdf`

    );

  }


  /* =====================================================
     A4へフィット
  ===================================================== */

  function fitCanvasToA4(
    canvas
  ) {

    const pageWidth =
      210;


    const pageHeight =
      297;


    const margin =
      5;


    const availableWidth =
      pageWidth -
      margin * 2;


    const availableHeight =
      pageHeight -
      margin * 2;


    const ratio =
      Math.min(

        availableWidth /
          canvas.width,

        availableHeight /
          canvas.height

      );


    const width =
      canvas.width *
      ratio;


    const height =
      canvas.height *
      ratio;


    const x =
      (
        pageWidth -
        width
      ) / 2;


    const y =
      (
        pageHeight -
        height
      ) / 2;


    return {

      x,

      y,

      width,

      height

    };

  }


  /* =====================================================
     ボタン
  ===================================================== */

  function enableReturnButtons() {

    const print =
      document.getElementById(
        "printButton"
      );


    const pdf =
      document.getElementById(
        "pdfButton"
      );


    if (print) {

      print.disabled =
        false;

    }


    if (pdf) {

      pdf.disabled =
        false;

    }

  }


  /* =====================================================
     リセット
  ===================================================== */

  function resetPreview() {

    const preview =
      document.getElementById(
        "returnPreview"
      );


    if (preview) {

      preview.style.display =
        "none";


      preview.innerHTML =
        "";

    }


    const print =
      document.getElementById(
        "printButton"
      );


    const pdf =
      document.getElementById(
        "pdfButton"
      );


    if (print) {

      print.disabled =
        true;

    }


    if (pdf) {

      pdf.disabled =
        true;

    }


    selectedAnswer =
      null;


    answerPages =
      [];

    regions =
      [];

    scores =
      [];

    marks =
      [];

    layoutBoxes =
      [];

    generatedPageCanvases =
      [];

  }


  /* =====================================================
     テスト名
  ===================================================== */

  function getTestName() {

    return (
      tests.find(
        test =>
          test.id ===
          selectedTestId
      )?.name ||
      "採点済み答案"
    );

  }


  /* =====================================================
     ファイル名
  ===================================================== */

  function sanitizeFilename(
    value
  ) {

    return String(
      value || ""
    )
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      )
      .trim() ||
      "file";

  }


  /* =====================================================
     画像ロード
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


        image.crossOrigin =
          "anonymous";


        image.onload =
          () =>
            resolve(
              image
            );


        image.onerror =
          () =>
            reject(
              new Error(
                "答案画像を読み込めませんでした。"
              )
            );


        image.src =
          src;

      }
    );

  }


  /* =====================================================
     Logout
  ===================================================== */

  const logoutButton =
    document.getElementById(
      "logoutButton"
    );


  if (logoutButton) {

    logoutButton.addEventListener(
      "click",
      logout
    );

  }


  /* =====================================================
     HTML escape
  ===================================================== */

  function escapeHtml(
    value
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    return String(value)
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


  /* =====================================================
     START
  ===================================================== */

  initialize();

})();
