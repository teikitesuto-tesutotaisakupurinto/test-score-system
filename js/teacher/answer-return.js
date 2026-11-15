(function () {

  "use strict";


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


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name ||
      "先生";


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

  document
    .getElementById(
      "testSelect"
    )
    .addEventListener(
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

          studentSelect.disabled =
            true;


          studentSelect.innerHTML = `

            <option value="">
              先にテストを選択してください
            </option>

          `;


          return;

        }


        await loadStudents();

      }
    );


  /* =====================================================
     生徒
  ===================================================== */

  async function loadStudents() {

    const {
      data:
        answers,
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
            a.student_no
          ).localeCompare(
            String(
              b.student_no
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
                value="${escapeHtml(student.id)}"
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

  document
    .getElementById(
      "studentSelect"
    )
    .addEventListener(
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


  /* =====================================================
     答案取得
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
          status
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
        error
      );


      return;

    }


    if (!data) {

      alert(
        "答案が見つかりません。"
      );


      resetPreview();

      return;

    }


    selectedAnswer =
      data;


    await Promise.all([

      loadAnswerPages(),

      loadRegions(),

      loadScores(),

      loadMarks(),

      loadLayoutBoxes()

    ]);


    await renderPreview();

  }


  /* =====================================================
     ページ
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

      console.error(
        error
      );


      return;

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
          layout_box_id,
          image_path,
          page_no
        `)
        .eq(
          "answer_sheet_id",
          selectedAnswer.id
        );


    if (error) {

      console.error(
        error
      );


      return;

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
          layout_box_id,
          score,
          status
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

      console.error(
        error
      );


      return;

    }


    scores =
      data || [];

  }


  /* =====================================================
     Marks
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
          selectedAnswer.id
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      console.error(
        error
      );


      return;

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
          page_no,
          label,
          points,
          x,
          y,
          width,
          height,
          box_type
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

      console.error(
        error
      );


      return;

    }


    layoutBoxes =
      data || [];

  }


  /* =====================================================
     プレビュー
  ===================================================== */

  async function renderPreview() {

    const container =
      document.getElementById(
        "returnPreview"
      );


    container.style.display =
      "block";


    const student =
      students.find(
        item =>
          item.id ===
          selectedStudentId
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

        <div class="return-header">

          <div class="return-title">
            ${escapeHtml(
              tests.find(
                test =>
                  test.id ===
                  selectedTestId
              )?.name ||
              "採点済み答案"
            )}
          </div>


          <div class="return-student">

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


        <div class="return-score">

          合計点：

          <strong>
            ${total}
          </strong>

          点

        </div>


        <div
          id="returnPages"
          class="return-answer"
        >
        </div>

      </div>

    `;


    await renderAnswerPages();


    enableReturnButtons();

  }


  /* =====================================================
     元答案ページ表示
  ===================================================== */

  async function renderAnswerPages() {

    const container =
      document.getElementById(
        "returnPages"
      );


    for (
      const page
      of answerPages
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

        continue;

      }


      const pageElement =
        document.createElement(
          "div"
        );


      pageElement.className =
        "return-answer-page";


      const image =
        document.createElement(
          "img"
        );


      image.src =
        data.signedUrl;


      image.alt =
        `答案 ${page.page_no}ページ`;


      pageElement.appendChild(
        image
      );


      container.appendChild(
        pageElement
      );

    }


    /*
      採点記号・点数を
      元答案の上に重ねる
    */

    await renderMarksOverlay(
      container
    );

  }


  /* =====================================================
     採点記号オーバーレイ
  ===================================================== */

  async function renderMarksOverlay(
    container
  ) {

    /*
      返却用では、
      切り出し済みregionを
      元答案の上に重ねるのではなく、
      採点記号を問題別に
      簡易表示する。

      実際の答案画像そのものに
      焼き込む処理は後述の
      Canvas生成で行う。
    */

    for (
      const region
      of regions
    ) {

      const pageElement =
        [
          ...container.children
        ].find(
          element => {

            return true;

          }
        );


      if (!pageElement) {

        continue;

      }


      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            region.layout_box_id
        );


      if (!score) {

        continue;

      }


      const label =
        document.createElement(
          "div"
        );


      label.textContent =
        `${score.score}点`;


      label.style.cssText = `

        position:relative;

        display:inline-block;

        margin:2px;

        padding:2px 6px;

        color:#c62828;

        font-weight:700;

      `;


      /*
        現在はページ下部へ表示。
        印刷用に確実に見えるようにする。
      */

      pageElement.appendChild(
        label
      );

    }

  }


  /* =====================================================
     ボタン
  ===================================================== */

  function enableReturnButtons() {

    document.getElementById(
      "printButton"
    ).disabled =
      false;


    document.getElementById(
      "pdfButton"
    ).disabled =
      false;

  }


  /* =====================================================
     印刷
  ===================================================== */

  document
    .getElementById(
      "printButton"
    )
    .addEventListener(
      "click",
      () => {

        window.print();

      }
    );


  /* =====================================================
     PDF
  ===================================================== */

  document
    .getElementById(
      "pdfButton"
    )
    .addEventListener(
      "click",
      async () => {

        await exportPdf();

      }
    );


  async function exportPdf() {

    if (
      !window.jspdf?.jsPDF
    ) {

      alert(
        "PDFライブラリが読み込まれていません。"
      );


      return;

    }


    const documentElement =
      document.getElementById(
        "returnDocument"
      );


    if (!documentElement) {

      return;

    }


    /*
      html2canvasを動的ロード
    */

    if (
      !window.html2canvas
    ) {

      await loadHtml2Canvas();

    }


    if (
      !window.html2canvas
    ) {

      alert(
        "PDF画像変換ライブラリを読み込めませんでした。"
      );


      return;

    }


    const canvas =
      await window.html2canvas(
        documentElement,
        {
          scale:2,

          useCORS:true,

          backgroundColor:
            "#ffffff"
        }
      );


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


    const pageWidth =
      210;


    const pageHeight =
      297;


    const imageData =
      canvas.toDataURL(
        "image/jpeg",
        0.95
      );


    const ratio =
      Math.min(
        pageWidth /
          canvas.width,

        pageHeight /
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


    pdf.addImage(
      imageData,
      "JPEG",
      x,
      y,
      width,
      height
    );


    const student =
      students.find(
        item =>
          item.id ===
          selectedStudentId
      );


    pdf.save(
      `${testDataName()}-${student?.student_no || "student"}.pdf`
    );

  }


  /* =====================================================
     html2canvas
  ===================================================== */

  function loadHtml2Canvas() {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const script =
          document.createElement(
            "script"
          );


        script.src =
          "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";


        script.onload =
          resolve;


        script.onerror =
          reject;


        document.head.appendChild(
          script
        );

      }
    );

  }


  /* =====================================================
     テスト名
  ===================================================== */

  function testDataName() {

    return (
      tests.find(
        test =>
          test.id ===
          selectedTestId
      )?.name ||
      "採点済み答案"
    )
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      );

  }


  /* =====================================================
     リセット
  ===================================================== */

  function resetPreview() {

    const preview =
      document.getElementById(
        "returnPreview"
      );


    preview.style.display =
      "none";


    preview.innerHTML =
      "";


    document.getElementById(
      "printButton"
    ).disabled =
      true;


    document.getElementById(
      "pdfButton"
    ).disabled =
      true;


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

  }


  /* =====================================================
     Logout
  ===================================================== */

  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  /* =====================================================
     Escape
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


  initialize();

})();
