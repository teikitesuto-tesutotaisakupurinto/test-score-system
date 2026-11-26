
"use strict";

/* =========================================================
   採点済み答案返却

   元答案
      +
   採点記号
      +
   点数

   描画しない
   ---------------------------------------------------------
   ・氏名
   ・生徒番号
   ・テスト名
   ・layout_boxesの枠線
   ・ヘッダー
   ・フッター

   公開
   ---------------------------------------------------------
   教師側ではmarked答案を確認可能。
   生徒側への公開は
   tests.results_published=true
   のときだけ。
========================================================= */


let DB = null;

let tests = [];

let students = [];

let currentTestId = null;

let currentStudentId = null;

let answerSheetId = null;

let pages = [];

let regions = [];

let marks = [];

let scores = [];

let boxes = [];


/* =========================================================
   DOM
========================================================= */

const testSelect =
  document.getElementById(
    "testSelect"
  );


const studentSelect =
  document.getElementById(
    "studentSelect"
  );


const studentArea =
  document.getElementById(
    "studentArea"
  );


const preview =
  document.getElementById(
    "returnPreview"
  );


const statusElement =
  document.getElementById(
    "returnStatus"
  );


const printButton =
  document.getElementById(
    "printButton"
  );


const pdfButton =
  document.getElementById(
    "pdfButton"
  );


const pngButton =
  document.getElementById(
    "pngButton"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


    await loadTests();


    selectFromUrl();


  } catch (error) {

    console.error(
      "answer-return:",
      error
    );


    showError(
      error.message ||
      "答案返却画面を読み込めませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  testSelect?.addEventListener(
    "change",
    async () => {

      currentTestId =
        testSelect.value ||
        null;


      currentStudentId =
        null;


      answerSheetId =
        null;


      clearPreview();


      resetStudentSelect();


      if (!currentTestId) {

        return;

      }


      await loadStudents();

    }
  );


  studentSelect?.addEventListener(
    "change",
    async () => {

      currentStudentId =
        studentSelect.value ||
        null;


      if (!currentStudentId) {

        clearPreview();

        return;

      }


      await loadAnswer();

    }
  );


  printButton?.addEventListener(
    "click",
    printAnswer
  );


  pdfButton?.addEventListener(
    "click",
    downloadPdf
  );


  pngButton?.addEventListener(
    "click",
    downloadPng
  );


  document
    .getElementById(
      "logoutButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        await logout();

      }
    );

}


/* =========================================================
   URL
========================================================= */

function selectFromUrl() {

  const params =
    new URLSearchParams(
      location.search
    );


  const requestedTest =
    params.get(
      "test"
    );


  const requestedAnswer =
    params.get(
      "answer"
    );


  if (requestedTest) {

    const exists =
      tests.some(
        test =>
          test.id ===
          requestedTest
      );


    if (exists) {

      currentTestId =
        requestedTest;


      testSelect.value =
        requestedTest;


      loadStudents(
        requestedAnswer
      );

      return;

    }

  }


  if (requestedAnswer) {

    loadAnswerById(
      requestedAnswer
    );

  }

}


/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "tests"
      )
      .select(
        `
        id,
        name,
        subject,
        grade,
        class_name
        `
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


  tests =
    data || [];


  testSelect.innerHTML = `

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
                [
                  test.name,
                  test.subject,
                  test.grade,
                  test.class_name
                ]
                  .filter(Boolean)
                  .join(
                    " / "
                  )
              )}

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents(
  requestedAnswerId = null
) {

  setStatus(
    "採点済み答案を取得しています..."
  );


  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        student_id,
        status,
        created_at,
        students(
          id,
          student_no,
          name
        )
        `
      )
      .eq(
        "test_id",
        currentTestId
      )
      .in(
        "status",
        ["marked", "published"]
      )
      .not(
        "student_id",
        "is",
        null
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


  /*
   * 同一生徒に複数答案がある場合は
   * 最新のmarked答案を使用。
   */

  const latest =
    new Map();


  (
    data ||
    []
  ).forEach(
    answer => {

      if (
        !latest.has(
          answer.student_id
        )
      ) {

        latest.set(
          answer.student_id,
          answer
        );

      }

    }
  );


  students =
    [
      ...latest.values()
    ];


  studentSelect.innerHTML = `

    <option value="">
      生徒を選択してください
    </option>

    ${
      students
        .map(
          answer => `

            <option
              value="${escapeHtml(
                answer.student_id
              )}"
            >

              ${escapeHtml(
                [
                  answer.students?.student_no,
                  answer.students?.name
                ]
                  .filter(Boolean)
                  .join(
                    " / "
                  )
              )}

            </option>

          `
        )
        .join("")
    }

  `;


  studentSelect.disabled =
    students.length ===
    0;


  studentArea.style.display =
    "block";


  if (!students.length) {

    setStatus(
      "このテストには採点済み答案がありません。"
    );

    return;

  }


  if (requestedAnswerId) {

    const answer =
      students.find(
        item =>
          item.id ===
          requestedAnswerId
      );


    if (answer) {

      currentStudentId =
        answer.student_id;


      studentSelect.value =
        answer.student_id;


      await loadAnswer();

      return;

    }

  }


  setStatus(
    `${students.length}人の採点済み答案があります。`
  );

}


/* =========================================================
   ANSWER BY ID
========================================================= */

async function loadAnswerById(
  id
) {

  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        student_id,
        status
        `
      )
      .eq(
        "id",
        id
      )
      .in(
        "status",
        ["marked", "published"]
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "採点済み答案が見つかりません。"
    );

  }


  currentTestId =
    data.test_id;


  answerSheetId =
    data.id;


  currentStudentId =
    data.student_id;


  testSelect.value =
    data.test_id;


  await loadStudents(
    data.id
  );

}


/* =========================================================
   ANSWER
========================================================= */

async function loadAnswer() {

  if (
    !currentTestId ||
    !currentStudentId
  ) {

    return;

  }


  setStatus(
    "採点済み答案を読み込んでいます..."
  );


  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        student_id,
        status
        `
      )
      .eq(
        "test_id",
        currentTestId
      )
      .eq(
        "student_id",
        currentStudentId
      )
      .in(
        "status",
        ["marked", "published"]
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    clearPreview();

    setStatus(
      "採点済み答案がありません。",
      true
    );

    return;

  }


  answerSheetId =
    data.id;


  await loadAnswerData();


  await renderPreview();


  enableActions();


  setStatus(
    "採点済み答案を表示しています。"
  );

}


/* =========================================================
   DATA
========================================================= */

async function loadAnswerData() {

  const [
    pageResult,
    regionResult,
    markResult,
    scoreResult
  ] =
    await Promise.all([

      DB
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
        ),

      DB
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
        ),

      DB
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
        ),

      DB
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
        )

    ]);


  if (pageResult.error) {

    throw pageResult.error;

  }


  if (regionResult.error) {

    throw regionResult.error;

  }


  if (markResult.error) {

    throw markResult.error;

  }


  if (scoreResult.error) {

    throw scoreResult.error;

  }


  pages =
    pageResult.data ||
    [];


  regions =
    regionResult.data ||
    [];


  marks =
    markResult.data ||
    [];


  scores =
    scoreResult.data ||
    [];


  const boxIds =
    [
      ...new Set(
        [
          ...regions.map(
            item =>
              item.layout_box_id
          ),

          ...marks.map(
            item =>
              item.layout_box_id
          ),

          ...scores.map(
            item =>
              item.layout_box_id
          )

        ]
      )
    ];


  if (!boxIds.length) {

    boxes =
      [];

    return;

  }


  const {
    data,
    error
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
        points
        `
      )
      .in(
        "id",
        boxIds
      );


  if (error) {

    throw error;

  }


  boxes =
    data || [];

}


/* =========================================================
   RENDER
========================================================= */

async function renderPreview() {

  preview.innerHTML =
    "";


  preview.style.display =
    "block";


  if (!pages.length) {

    preview.innerHTML = `

      <div class="return-empty">
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


/* =========================================================
   CANVAS
========================================================= */

async function createReturnedCanvas(
  page
) {

  if (!page.file_path) {

    throw new Error(
      `答案${page.page_no}ページの画像がありません。`
    );

  }


  const {
    data,
    error
  } =
    await DB
      .storage
      .from(
        "test-files"
      )
      .createSignedUrl(
        page.file_path,
        3600
      );


  if (
    error ||
    !data?.signedUrl
  ) {

    throw new Error(
      `答案${page.page_no}ページの画像URLを取得できませんでした。`
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


  canvas.width =
    image.naturalWidth;


  canvas.height =
    image.naturalHeight;


  const context =
    canvas.getContext(
      "2d"
    );


  context.drawImage(
    image,
    0,
    0
  );


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

      const pageMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            region.layout_box_id
        );


      pageMarks.forEach(
        mark => {

          drawMark(
            context,
            mark,
            region
          );

        }
      );


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


/* =========================================================
   MARK
========================================================= */

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

  } else if (
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

  } else if (
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

  } else if (
    mark.object_type ===
    "double_circle"
  ) {

    context.font =
      `bold ${fontSize}px sans-serif`;

    context.textAlign =
      "center";

    context.textBaseline =
      "middle";

    context.fillText(
      "◎",
      x,
      y
    );

  } else if (
    mark.object_type ===
    "text"
  ) {

    context.font =
      `${fontSize}px sans-serif`;

    context.textBaseline =
      "middle";

    context.fillText(
      mark.text_value ||
      "",
      x,
      y
    );

  } else if (
    mark.object_type ===
    "pen"
  ) {

    drawPen(
      context,
      mark,
      region
    );

  }


  context.restore();

}


/* =========================================================
   PEN
========================================================= */

function drawPen(
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
    !Array.isArray(points) ||
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

}


/* =========================================================
   SCORE
========================================================= */

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
    `bold ${fontSize}px sans-serif`;


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


/* =========================================================
   PDF
========================================================= */

async function downloadPdf() {

  if (!pages.length) {

    setStatus(
      "答案がありません。",
      true
    );

    return;

  }


  const JsPDF =
    window.jspdf?.jsPDF;


  if (!JsPDF) {

    throw new Error(
      "PDFライブラリを読み込めませんでした。"
    );

  }


  const first =
    await createReturnedCanvas(
      pages[0]
    );


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


  addCanvasToPdf(
    pdf,
    first
  );


  for (
    let index = 1;
    index <
    pages.length;
    index++
  ) {

    const canvas =
      await createReturnedCanvas(
        pages[index]
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


/* =========================================================
   PRINT
========================================================= */

async function printAnswer() {

  if (!pages.length) {

    setStatus(
      "答案がありません。",
      true
    );

    return;

  }


  const printWindow =
    window.open(
      "",
      "_blank"
    );


  if (!printWindow) {

    setStatus(
      "印刷画面を開けませんでした。",
      true
    );

    return;

  }


  printWindow.document.write(`

    <!doctype html>

    <html>

    <head>

      <meta charset="UTF-8">

      <title>
        答案
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


/* =========================================================
   PNG
========================================================= */

async function downloadPng() {

  if (!pages.length) {

    setStatus(
      "答案がありません。",
      true
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
      120
    );

  }

}


/* =========================================================
   UI
========================================================= */

function resetStudentSelect() {

  studentSelect.innerHTML = `

    <option value="">
      生徒を選択してください
    </option>

  `;


  studentSelect.disabled =
    true;


  studentArea.style.display =
    "none";

}


function enableActions() {

  printButton.disabled =
    false;

  pdfButton.disabled =
    false;

  pngButton.disabled =
    false;

}


function clearPreview() {

  answerSheetId =
    null;

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


  preview.innerHTML =
    "";


  preview.style.display =
    "none";


  printButton.disabled =
    true;

  pdfButton.disabled =
    true;

  pngButton.disabled =
    true;

}


function setStatus(
  text,
  error = false
) {

  if (!statusElement) {

    return;

  }


  statusElement.textContent =
    text;


  statusElement.className =
    error
      ? "return-status error"
      : "return-status";

}


function showError(
  text
) {

  setStatus(
    text,
    true
  );

}


/* =========================================================
   HELPERS
========================================================= */

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
