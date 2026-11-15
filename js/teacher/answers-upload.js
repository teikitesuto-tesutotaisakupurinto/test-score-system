
"use strict";

/*
 * js/teacher/answers-upload.js
 *
 * 答案アップロード
 *
 * 使用するページ対応:
 *
 * test_pages.page_no
 *        ↓
 * layout_boxes.page_no
 *        ↓
 * answer_sheet_pages.page_no
 *
 * source_page_id は使用しない。
 */


/* =========================================================
   STATE
========================================================= */

let selectedFiles = [];

let currentTestId = null;

let testPages = [];

let layoutBoxes = [];

let students = [];


/* =========================================================
   DOM
========================================================= */

const testElement =
  document.getElementById("test");

const answerTypeElement =
  document.getElementById("answerType");

const filesElement =
  document.getElementById("files");

const fileListElement =
  document.getElementById("fileList");

const uploadButton =
  document.getElementById("uploadButton");

const clearButton =
  document.getElementById("clearButton");

const messageElement =
  document.getElementById("message");

const progressArea =
  document.getElementById("progressArea");

const progressBar =
  document.getElementById("progressBar");

const progressText =
  document.getElementById("progressText");

const resultElement =
  document.getElementById("result");

const teacherNameElement =
  document.getElementById("teacherName");

const logoutButton =
  document.getElementById("logoutButton");


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

  try {

    /*
     * 認証
     */

    if (
      typeof requireRole ===
      "function"
    ) {

      const authenticated =
        await requireRole(
          "teacher"
        );


      if (
        authenticated ===
        false
      ) {

        return;

      }

    }


    /*
     * 先生名
     */

    await loadTeacherName();


    /*
     * テスト
     */

    await loadTests();


    /*
     * イベント
     */

    setupEvents();


  } catch (error) {

    console.error(
      "answers-upload initialize:",
      error
    );


    showError(
      error.message ||
      "答案アップロード画面の初期化に失敗しました。"
    );

  }

}


/* =========================================================
   TEACHER
========================================================= */

async function loadTeacherName() {

  if (
    !teacherNameElement
  ) {

    return;

  }


  /*
   * auth.js側のユーザー情報を
   * 取得できる場合だけ表示。
   */

  try {

    if (
      typeof getCurrentUser ===
      "function"
    ) {

      const user =
        await getCurrentUser();


      if (user) {

        teacherNameElement.textContent =
          user.name ||
          user.display_name ||
          user.email ||
          "";

      }

    }

  } catch (error) {

    console.warn(
      "teacher name:",
      error
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  filesElement?.addEventListener(
    "change",
    event => {

      addFiles(
        event.target.files
      );


      /*
       * 同じファイルを
       * 再選択可能にする。
       */

      event.target.value =
        "";

    }
  );


  uploadButton?.addEventListener(
    "click",
    uploadAnswers
  );


  clearButton?.addEventListener(
    "click",
    clearFiles
  );


  logoutButton?.addEventListener(
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


/* =========================================================
   TESTS
========================================================= */

async function loadTests() {

  if (
    !testElement
  ) {

    throw new Error(
      "テスト選択欄が見つかりません。"
    );

  }


  const {
    data,
    error
  } =
    await SB
      .from("tests")
      .select(`
        id,
        name,
        subject,
        grade,
        created_at
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


  testElement.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

  `;


  for (
    const test
    of data || []
  ) {

    const option =
      document.createElement(
        "option"
      );


    option.value =
      test.id;


    option.textContent =
      [
        test.name,
        test.subject
      ]
        .filter(Boolean)
        .join(
          " / "
        );


    testElement.appendChild(
      option
    );

  }

}


/* =========================================================
   FILES
========================================================= */

function addFiles(
  fileList
) {

  const allowed =
    new Set([
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "webp",
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

      showError(
        `${file.name} は対応していない形式です。`
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


  renderFileList();

}


/* =========================================================
   FILE LIST
========================================================= */

function renderFileList() {

  if (
    !fileListElement
  ) {

    return;

  }


  if (
    !selectedFiles.length
  ) {

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


      row.className =
        "form-group";


      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.style.display =
        "flex";


      wrapper.style.alignItems =
        "center";


      wrapper.style.justifyContent =
        "space-between";


      wrapper.style.gap =
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


      wrapper.appendChild(
        name
      );


      wrapper.appendChild(
        remove
      );


      row.appendChild(
        wrapper
      );


      fileListElement.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   UPLOAD
========================================================= */

async function uploadAnswers() {

  currentTestId =
    testElement?.value ||
    "";


  if (!currentTestId) {

    showError(
      "テストを選択してください。"
    );

    return;

  }


  if (
    !selectedFiles.length
  ) {

    showError(
      "ファイルを選択してください。"
    );

    return;

  }


  setBusy(
    true
  );


  try {

    clearResult();


    /*
     * 生徒答案
     */

    if (
      answerTypeElement?.value !==
      "model"
    ) {

      setProgress(
        0,
        "解答用紙の設定を読み込んでいます..."
      );


      await loadLayout(
        currentTestId
      );


      await loadStudents();

    }


    /*
     * ファイル処理
     */

    const total =
      selectedFiles.length;


    for (
      let index = 0;
      index < total;
      index++
    ) {

      const file =
        selectedFiles[index];


      setProgress(
        Math.round(
          index /
          total *
          100
        ),
        `${index + 1}/${total}件目を処理しています...`
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

    }


    setProgress(
      100,
      "処理が完了しました。"
    );


    showSuccess(
      `${total}件の処理が完了しました。`
    );


    selectedFiles =
      [];


    renderFileList();


  } catch (error) {

    console.error(
      "upload answers:",
      error
    );


    showError(
      error.message ||
      "答案の処理に失敗しました。"
    );

  } finally {

    setBusy(
      false
    );

  }

}


/* =========================================================
   LAYOUT
========================================================= */

async function loadLayout(
  testId
) {

  /*
   * test_pages
   */

  const {
    data: pages,
    error: pageError
  } =
    await SB
      .from("test_pages")
      .select(`
        id,
        test_id,
        page_no,
        image_path,
        width_px,
        height_px,
        original_name
      `)
      .eq(
        "test_id",
        testId
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


  /*
   * layout_boxes
   *
   * source_page_idは使用しない。
   */

  const {
    data: boxes,
    error: boxError
  } =
    await SB
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
        points,
        parent_box_id,
        major_no,
        minor_no,
        box_role,
        sort_order,
        subtotal_group
      `)
      .eq(
        "test_id",
        testId
      )
      .order(
        "page_no",
        {
          ascending:
            true
        }
      )
      .order(
        "sort_order",
        {
          ascending:
            true
        }
      );


  if (boxError) {

    throw boxError;

  }


  testPages =
    pages || [];


  layoutBoxes =
    boxes || [];

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

  const {
    data,
    error
  } =
    await SB
      .from("students")
      .select("*")
      .eq(
        "active",
        true
      );


  if (error) {

    throw error;

  }


  students =
    data || [];

}


/* =========================================================
   STUDENT ANSWER
========================================================= */

async function processStudentAnswer(
  testId,
  file
) {

  const pages =
    await expandFile(
      file
    );


  if (!pages.length) {

    throw new Error(
      `${file.name}からページを取得できませんでした。`
    );

  }


  /*
   * QR
   */

  let qrValue =
    null;


  for (
    let index = 0;
    index < pages.length;
    index++
  ) {

    const pageNo =
      index + 1;


    const boxes =
      getBoxesForPage(
        pageNo
      );


    qrValue =
      readQrFromPage(
        pages[index],
        boxes
      );


    if (qrValue) {

      break;

    }

  }


  /*
   * 生徒
   */

  const student =
    findStudent(
      qrValue
    );


  /*
   * 答案ID
   */

  const answerId =
    crypto.randomUUID();


  /*
   * ページをStorageへ保存
   */

  const pageRecords =
    [];


  for (
    let index = 0;
    index < pages.length;
    index++
  ) {

    const pageNo =
      index + 1;


    const path =
      buildAnswerPath(
        testId,
        answerId,
        pageNo
      );


    await uploadPage(
      path,
      pages[index]
    );


    pageRecords.push({

      pageNo,

      path,

      width:
        pages[index].width,

      height:
        pages[index].height

    });

  }


  /*
   * answer_sheets
   */

  const {
    data: answerSheet,
    error: answerError
  } =
    await SB
      .from("answer_sheets")
      .insert({

        id:
          answerId,

        test_id:
          testId,

        student_id:
          student?.id ||
          null,

        file_path:
          pageRecords[0].path,

        status:
          student
            ? "matched"
            : "unmatched"

      })
      .select(
        "id"
      )
      .single();


  if (answerError) {

    throw answerError;

  }


  /*
   * answer_sheet_pages
   */

  for (
    const page
    of pageRecords
  ) {

    const {
      error: pageError
    } =
      await SB
        .from(
          "answer_sheet_pages"
        )
        .upsert(
          {

            answer_sheet_id:
              answerSheet.id,

            page_no:
              page.pageNo,

            file_path:
              page.path,

            width_px:
              page.width,

            height_px:
              page.height

          },
          {
            onConflict:
              "answer_sheet_id,page_no"
          }
        );


    if (pageError) {

      throw pageError;

    }


    await createAnswerRegions(
      answerSheet.id,
      page.pageNo
    );

  }


  if (student) {

    addResult(
      `${file.name}: ${student.student_no || ""} ${student.name || ""} に自動紐付けしました。`,
      false
    );

  } else if (qrValue) {

    addResult(
      `${file.name}: QR「${qrValue}」は読み取りましたが、生徒を特定できませんでした。`,
      true
    );

  } else {

    addResult(
      `${file.name}: QRを読み取れなかったため未紐付けで保存しました。`,
      true
    );

  }

}


/* =========================================================
   MODEL ANSWER
========================================================= */

async function processModelAnswer(
  testId,
  file
) {

  const pages =
    await expandFile(
      file
    );


  for (
    let index = 0;
    index < pages.length;
    index++
  ) {

    const pageNo =
      index + 1;


    const path =
      [
        testId,
        "model-answer",
        `page-${String(
          pageNo
        ).padStart(
          3,
          "0"
        )}.png`
      ].join("/");


    const blob =
      await canvasToBlob(
        pages[index].canvas
      );


    const {
      error
    } =
      await SB
        .storage
        .from(
          "model-answers"
        )
        .upload(
          path,
          blob,
          {
            contentType:
              "image/png",

            upsert:
              true
          }
        );


    if (error) {

      throw error;

    }

  }

}


/* =========================================================
   ANSWER REGIONS
========================================================= */

async function createAnswerRegions(
  answerSheetId,
  pageNo
) {

  const boxes =
    getBoxesForPage(
      pageNo
    );


  /*
   * question_idが既に設定されている
   * 小問だけ。
   *
   * この処理で設問IDは生成しない。
   */

  const rows =
    boxes
      .filter(
        box =>
          box.box_role ===
            "minor" &&
          box.question_id
      )
      .map(
        box => ({

          answer_sheet_id:
            answerSheetId,

          question_id:
            box.question_id,

          page_no:
            pageNo,

          x:
            Number(
              box.x
            ),

          y:
            Number(
              box.y
            ),

          width:
            Number(
              box.width
            ),

          height:
            Number(
              box.height
            )

        })
      );


  if (!rows.length) {

    return;

  }


  const {
    error
  } =
    await SB
      .from(
        "answer_regions"
      )
      .insert(
        rows
      );


  if (error) {

    throw error;

  }

}


/* =========================================================
   PAGE BOXES
========================================================= */

function getBoxesForPage(
  pageNo
) {

  return layoutBoxes.filter(
    box =>
      Number(
        box.page_no
      ) ===
      Number(
        pageNo
      )
  );

}


/* =========================================================
   QR
========================================================= */

function readQrFromPage(
  page,
  boxes
) {

  /*
   * QR枠優先。
   */

  const qrBoxes =
    boxes.filter(
      box =>
        box.box_role ===
          "qr" ||
        box.box_type ===
          "qr"
    );


  for (
    const box
    of qrBoxes
  ) {

    const cropped =
      cropCanvas(
        page.canvas,
        box
      );


    const result =
      decodeQr(
        cropped
      );


    if (
      result?.data
    ) {

      return normalizeQr(
        result.data
      );

    }

  }


  /*
   * QR枠がなければ
   * ページ全体。
   */

  const result =
    decodeQr(
      page.canvas
    );


  return result?.data
    ? normalizeQr(
        result.data
      )
    : null;

}


/* =========================================================
   QR DECODE
========================================================= */

function decodeQr(
  canvas
) {

  if (
    typeof jsQR !==
    "function"
  ) {

    return null;

  }


  if (
    !canvas.width ||
    !canvas.height
  ) {

    return null;

  }


  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  const image =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );


  return jsQR(
    image.data,
    image.width,
    image.height,
    {
      inversionAttempts:
        "attemptBoth"
    }
  );

}


/* =========================================================
   QR NORMALIZE
========================================================= */

function normalizeQr(
  value
) {

  const text =
    String(
      value ||
      ""
    ).trim();


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


/* =========================================================
   STUDENT MATCH
========================================================= */

function findStudent(
  qrValue
) {

  if (!qrValue) {

    return null;

  }


  const value =
    normalizeStudentValue(
      qrValue
    );


  const qrKeys = [
    "qr_token",
    "qr",
    "qr_code",
    "qr_value"
  ];


  for (
    const student
    of students
  ) {

    for (
      const key
      of qrKeys
    ) {

      if (
        student[key] ===
          undefined ||
        student[key] ===
          null
      ) {

        continue;

      }


      if (
        normalizeStudentValue(
          student[key]
        ) ===
        value
      ) {

        return student;

      }

    }

  }


  const studentByNo =
    students.find(
      student =>
        normalizeStudentValue(
          student.student_no
        ) ===
        value
    );


  if (studentByNo) {

    return studentByNo;

  }


  return (
    students.find(
      student =>
        normalizeStudentValue(
          student.id
        ) ===
        value
    ) ||
    null
  );

}


function normalizeStudentValue(
  value
) {

  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /[\s\-]/g,
      ""
    )
    .toLowerCase();

}


/* =========================================================
   FILE EXPANSION
========================================================= */

async function expandFile(
  file
) {

  const extension =
    getExtension(
      file.name
    );


  if (
    extension ===
    "pdf"
  ) {

    return pdfToPages(
      file
    );

  }


  if (
    extension ===
    "zip"
  ) {

    return zipToPages(
      file
    );

  }


  return [
    await imageToPage(
      file
    )
  ];

}


/* =========================================================
   PDF
========================================================= */

async function pdfToPages(
  file
) {

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


  for (
    let number = 1;
    number <=
    pdf.numPages;
    number++
  ) {

    const pdfPage =
      await pdf.getPage(
        number
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

      canvas,

      width:
        canvas.width,

      height:
        canvas.height

    });

  }


  return pages;

}


/* =========================================================
   ZIP
========================================================= */

async function zipToPages(
  file
) {

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
        ...await pdfToPages(
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
        "webp"
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
          entry.name,
          {
            type:
              extension ===
                "jpg"
                ? "image/jpeg"
                : `image/${extension}`
          }
        );


      pages.push(
        await imageToPage(
          imageFile
        )
      );

    }

  }


  return pages;

}


/* =========================================================
   IMAGE
========================================================= */

async function imageToPage(
  file
) {

  const url =
    URL.createObjectURL(
      file
    );


  try {

    const image =
      await loadImage(
        url
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

      canvas,

      width:
        canvas.width,

      height:
        canvas.height

    };

  } finally {

    URL.revokeObjectURL(
      url
    );

  }

}


/* =========================================================
   STORAGE
========================================================= */

async function uploadPage(
  path,
  page
) {

  const blob =
    await canvasToBlob(
      page.canvas
    );


  const {
    error
  } =
    await SB
      .storage
      .from(
        "answers"
      )
      .upload(
        path,
        blob,
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

    throw error;

  }

}


/* =========================================================
   PATH
========================================================= */

function buildAnswerPath(
  testId,
  answerId,
  pageNo
) {

  return [
    testId,
    answerId,
    `page-${String(
      pageNo
    ).padStart(
      3,
      "0"
    )}.png`
  ].join(
    "/"
  );

}


/* =========================================================
   CROP
========================================================= */

function cropCanvas(
  source,
  box
) {

  const x =
    Math.max(
      0,
      Math.round(
        Number(
          box.x
        )
      )
    );


  const y =
    Math.max(
      0,
      Math.round(
        Number(
          box.y
        )
      )
    );


  const width =
    Math.max(
      1,
      Math.round(
        Number(
          box.width
        )
      )
    );


  const height =
    Math.max(
      1,
      Math.round(
        Number(
          box.height
        )
      )
    );


  const safeWidth =
    Math.max(
      1,
      Math.min(
        width,
        source.width - x
      )
    );


  const safeHeight =
    Math.max(
      1,
      Math.min(
        height,
        source.height - y
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    safeWidth;


  canvas.height =
    safeHeight;


  canvas
    .getContext(
      "2d"
    )
    .drawImage(
      source,

      x,
      y,
      safeWidth,
      safeHeight,

      0,
      0,
      safeWidth,
      safeHeight
    );


  return canvas;

}


/* =========================================================
   BLOB
========================================================= */

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


/* =========================================================
   IMAGE
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


/* =========================================================
   UI
========================================================= */

function setBusy(
  busy
) {

  if (uploadButton) {

    uploadButton.disabled =
      busy;

  }


  if (clearButton) {

    clearButton.disabled =
      busy;

  }

}


function setProgress(
  value,
  text
) {

  if (progressArea) {

    progressArea.hidden =
      false;

  }


  if (progressBar) {

    progressBar.style.width =
      `${Math.max(
        0,
        Math.min(
          100,
          value
        )
      )}%`;

  }


  if (progressText) {

    progressText.textContent =
      text ||
      "";

  }

}


function showSuccess(
  text
) {

  if (!messageElement) {

    return;

  }


  messageElement.className =
    "message";


  messageElement.textContent =
    text;

}


function showError(
  text
) {

  if (!messageElement) {

    return;

  }


  messageElement.className =
    "message error";


  messageElement.textContent =
    text;

}


function clearResult() {

  if (!resultElement) {

    return;

  }


  resultElement.innerHTML =
    "";


  resultElement.hidden =
    true;

}


function addResult(
  text,
  error = false
) {

  if (!resultElement) {

    return;

  }


  resultElement.hidden =
    false;


  const line =
    document.createElement(
      "p"
    );


  line.textContent =
    text;


  if (error) {

    line.className =
      "error";

  }


  resultElement.appendChild(
    line
  );

}


/* =========================================================
   CLEAR
========================================================= */

clearButton?.addEventListener(
  "click",
  () => {

    selectedFiles =
      [];


    renderFileList();


    if (filesElement) {

      filesElement.value =
        "";

    }


    if (messageElement) {

      messageElement.textContent =
        "";

    }


    if (progressArea) {

      progressArea.hidden =
        true;

    }

  }
);


/* =========================================================
   HELPERS
========================================================= */

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
