
/* =========================================================
   テスト成績システム
   採点済み答案返却 完全版

   機能

   ・テスト選択
   ・生徒選択
   ・元答案ページ取得
   ・answer_regions取得
   ・layout_boxes取得
   ・scores取得
   ・mark_objects取得

   ・元答案画像そのものをCanvasへ描画
   ・○
   ・×
   ・△
   ・◎
   ・テキスト
   ・ペン描画
   ・点数

   を元画像の座標へ正確に合成

   ・ブラウザ印刷
   ・PDF保存

   PDFはDOMスクリーンショットではなく、
   元答案画像をCanvasへ直接合成して生成する。
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
     テスト一覧
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
            ascending: false
          }
        );


    if (error) {

      console.error(
        "テスト取得:",
        error
      );


      showMessage(
        "テスト一覧を取得できませんでした。",
        true
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
                value="${escapeHtml(test.id)}"
              >

                ${escapeHtml(
                  test.name
                )}

                ${
                  test.subject
                    ? ` / ${escapeHtml(test.subject)}`
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
     テスト変更
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
     生徒一覧
  ===================================================== */

  async function loadStudents() {

    const {
      data: answers,
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
            ascending: true
          }
        );


    if (error) {

      console.error(
        "生徒一覧取得:",
        error
      );


      return;

    }


    const map =
      new Map();


    (
      answers || []
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
              numeric: true
            }
          )
      );


    const studentSelect =
      document.getElementById(
        "studentSelect"
      );


    if (!studentSelect) {

      return;

    }


    studentSelect.disabled =
      false;


    studentSelect.innerHTML = `

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
     生徒答案取得
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
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

      console.error(
        "答案取得:",
        error
      );


      showMessage(
        "答案を取得できませんでした。",
        true
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


    /*
      全データ取得
    */

    await Promise.all([

      loadAnswerPages(),

      loadRegions(),

      loadScores(),

      loadMarks(),

      loadLayoutBoxes()

    ]);


    /*
      Canvas生成
    */

    await buildMarkedPages();


    /*
      プレビュー
    */

    renderPreview();


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
            ascending: true
          }
        );


    if (error) {

      throw error;

    }


    answerPages =
      data || [];

  }


  /* =====================================================
     answer_regions
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
     scores
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
     mark_objects
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
            ascending: true
          }
        );


    if (error) {

      throw error;

    }


    marks =
      data || [];

  }


  /* =====================================================
     layout_boxes
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
            ascending: true
          }
        )
        .order(
          "y",
          {
            ascending: true
          }
        )
        .order(
          "x",
          {
            ascending: true
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
     1ページを元画像から生成
  ===================================================== */

  async function createMarkedPageCanvas(
    page
  ) {

    /*
      元答案Storage
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
        `${page.page_no}ページの画像URLを取得できませんでした。`
      );

    }


    /*
      元画像
    */

    const image =
      await loadImage(
        data.signedUrl
      );


    /*
      元画像そのものと同じサイズ
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
      元画像をそのまま描画
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      現在ページの解答欄
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
      各解答欄
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


      /*
        採点記号
      */

      const pageMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            box.id
        );


      /*
        点数
      */

      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      /*
        記号
      */

      drawReturnMarks(
        context,
        box,
        region,
        pageMarks
      );


      /*
        点数
      */

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
     採点記号描画

     x/yは「解答欄内座標」として扱う。

     例:

     layout_box
       x = 100
       y = 200

     mark
       x = 50
       y = 30

     元画像上

       x = 150
       y = 230
========================================================= */

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
      regionがある場合は
      region座標系を優先する。

      region.width / height が
      layout_boxと異なる場合は
      スケール変換する。
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


        const size =
          Number(
            mark.font_size
          ) ||
          42;


        /*
          mark.x/y:
          region内座標
        */

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


        /*
          元答案ページ座標
        */

        const pageX =
          Number(
            box.x
          ) +
          (
            localX *
            scaleX
          );


        const pageY =
          Number(
            box.y
          ) +
          (
            localY *
            scaleY
          );


        /*
          サイズも
          region→元ページへ変換
        */

        const drawSize =
          size *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


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
            drawSize / 2,
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
              drawSize / 2,
            pageY -
              drawSize / 2
          );


          context.lineTo(
            pageX +
              drawSize / 2,
            pageY +
              drawSize / 2
          );


          context.moveTo(
            pageX +
              drawSize / 2,
            pageY -
              drawSize / 2
          );


          context.lineTo(
            pageX -
              drawSize / 2,
            pageY +
              drawSize / 2
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
              drawSize / 2
          );


          context.lineTo(
            pageX -
              drawSize / 2,
            pageY +
              drawSize / 2
          );


          context.lineTo(
            pageX +
              drawSize / 2,
            pageY +
              drawSize / 2
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
            `bold ${drawSize}px Arial`;


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
            `${drawSize}px Arial`;


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
                    (
                      Number(
                        point.x
                      ) ||
                      0
                    ) *
                    scaleX
                  );


                const py =
                  Number(
                    box.y
                  ) +
                  (
                    (
                      Number(
                        point.y
                      ) ||
                      0
                    ) *
                    scaleY
                  );


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
     点数描画

     点数は解答欄の右上付近へ表示。

     元画像の座標なので、
     PDF化しても位置がずれない。
========================================================= */

  function drawReturnScore(
    context,
    box,
    region,
    score
  ) {

    const boxX =
      Number(
        box.x
      ) || 0;


    const boxY =
      Number(
        box.y
      ) || 0;


    const boxWidth =
      Number(
        box.width
      ) || 100;


    const boxHeight =
      Number(
        box.height
      ) || 50;


    /*
      点数表示位置

      解答欄右上
    */

    const padding =
      Math.max(
        6,
        Math.min(
          boxWidth,
          boxHeight
        ) * 0.05
      );


    const x =
      boxX +
      boxWidth +
      padding;


    const y =
      boxY +
      Math.max(
        22,
        boxHeight * 0.25
      );


    /*
      解答欄サイズに応じて
      点数文字サイズを調整
    */

    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          boxHeight * 0.25
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
      x,
      y
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


    container.style.display =
      "block";


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
      (
        item,
        index
      ) => {

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

        /*
          すでに生成済みなら
          そのまま印刷
        */

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
     PDF出力
  ===================================================== */

  async function exportPdf() {

    if (
      !selectedAnswer
    ) {

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
      最新状態で再生成
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


    let firstPage =
      true;


    for (
      const item
      of generatedPageCanvases
    ) {

      const canvas =
        item.canvas;


      if (
        !firstPage
      ) {

        pdf.addPage();

      }


      firstPage =
        false;


      /*
        PNGのまま出力。

        元答案の文字品質を
        JPEG圧縮で落とさない。
      */

      const imageData =
        canvas.toDataURL(
          "image/png"
        );


      const pageSize =
        fitCanvasToA4(
          canvas
        );


      pdf.addImage(

        imageData,

        "PNG",

        pageSize.x,

        pageSize.y,

        pageSize.width,

        pageSize.height,

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


    const filename =
      `${sanitizeFilename(
        getTestName()
      )}-${sanitizeFilename(
        student?.student_no ||
        "student"
      )}-採点済み答案.pdf`;


    pdf.save(
      filename
    );

  }


  /* =====================================================
     Canvas → A4サイズ
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
     ボタン有効化
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
     メッセージ
  ===================================================== */

  function showMessage(
    message,
    error = false
  ) {

    /*
      answer-return.htmlに
      messageがない場合は何もしない。
    */

    const element =
      document.getElementById(
        "message"
      );


    if (!element) {

      return;

    }


    element.textContent =
      message;


    element.style.color =
      error
        ? "#c62828"
        : "#16834b";

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
     ファイル名安全化
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


        /*
          Supabase Signed URLなので
          crossOriginを設定してCanvasへ描画可能にする。
        */

        image.crossOrigin =
          "anonymous";


        image.onload =
          () => {

            resolve(
              image
            );

          };


        image.onerror =
          () => {

            reject(
              new Error(
                "答案画像を読み込めませんでした。"
              )
            );

          };


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
