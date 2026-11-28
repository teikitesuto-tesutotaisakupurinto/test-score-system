
"use strict";

/* =========================================================
   生徒QR発行

   QR値
   ---------------------------------------------------------
   STUDENT:<生徒番号>

   答案アップロード時に
   QRを読み取り、生徒番号と完全一致させる。

   ・有効な生徒のみ
   ・生徒番号を変更しない
   ・QR値を推測しない
========================================================= */


let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeQR
);


async function initializeQR() {

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


    await loadStudents();


  } catch (error) {

    console.error(
      "QR:",
      error
    );


    showError(
      error.message ||
      "生徒QRを読み込めませんでした。"
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  document
    .getElementById(
      "reloadButton"
    )
    ?.addEventListener(
      "click",
      loadStudents
    );


  document
    .getElementById(
      "printButton"
    )
    ?.addEventListener(
      "click",
      () => {

        window.print();

      }
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
   STUDENTS
========================================================= */

async function loadStudents() {

  setStatus(
    "生徒一覧を取得しています..."
  );


  const {
    data,
    error
  } =
    await DB
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        active,
        qr_token
        `
      )
      .eq(
        "active",
        true
      )
      .order(
        "student_no",
        {
          ascending:true
        }
      );


  if (error) {

    throw error;

  }


  renderQr(
    data || []
  );


  setStatus(
    `${(
      data ||
      []
    ).length}名分のQRを表示しています。`
  );

}


/* =========================================================
   RENDER
========================================================= */

function renderQr(students) {
  const grid = document.getElementById("qrGrid");
  const printRoot = document.getElementById("qrPrintSheets");
  if (!grid || !printRoot) return;

  grid.replaceChildren();
  printRoot.replaceChildren();

  if (!students.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "有効な生徒が登録されていません。";
    grid.appendChild(empty);
    return;
  }

  // 画面上の確認用一覧
  students.forEach(student => {
    const card = document.createElement("article");
    card.className = "qr-card";
    const no = document.createElement("div");
    no.className = "qr-student-no";
    no.textContent = student.student_no || "";
    const name = document.createElement("div");
    name.className = "qr-student-name";
    name.textContent = student.name || "";
    const image = document.createElement("div");
    image.className = "qr-image";
    const qr = document.createElement("div");
    const qrValue = student.qr_token || `STUDENT:${student.student_no}`;

    if (typeof QRCode === "function") {
      new QRCode(qr, {
        text: qrValue,
        width: 150,
        height: 150,
        correctLevel: QRCode.CorrectLevel.M
      });
      image.appendChild(qr);
    } else {
      image.textContent = "QRライブラリを読み込めませんでした。";
    }

    const value = document.createElement("div");
    value.className = "qr-value";
    value.textContent = qrValue;
    card.append(no, name, image, value);
    grid.appendChild(card);
  });

  if (typeof QRCode !== "function") {
    throw new Error("QRコード生成ライブラリを読み込めませんでした。");
  }

  // A4縦1枚を高さ方向に3等分し、各区画に別々の生徒を1人ずつ配置。
  // 3人単位でページを作成し、余りは最終ページに空欄として残す。
  for (let offset = 0; offset < students.length; offset += 3) {
    const page = document.createElement("div");
    page.className = "qr-print-page";

    for (let slot = 0; slot < 3; slot++) {
      const student = students[offset + slot];
      const band = document.createElement("div");
      band.className = "qr-print-band";

      if (student) {
        const sticker = document.createElement("div");
        sticker.className = "qr-print-sticker";

        const qrWrap = document.createElement("div");
        qrWrap.className = "qr-print-code";
        const qrValue = student.qr_token || `STUDENT:${student.student_no}`;

        new QRCode(qrWrap, {
          text: qrValue,
          width: 180,
          height: 180,
          correctLevel: QRCode.CorrectLevel.H
        });

        const number = document.createElement("div");
        number.className = "qr-print-no";
        number.textContent = student.student_no || "";

        const studentName = document.createElement("div");
        studentName.className = "qr-print-name";
        studentName.textContent = student.name || "";

        sticker.append(qrWrap, number, studentName);
        band.appendChild(sticker);
      }

      page.appendChild(band);
    }

    printRoot.appendChild(page);
  }
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  text,
  error = false
) {

  const element =
    document.getElementById(
      "status"
    );


  if (!element) {

    return;

  }


  element.textContent =
    text;


  element.className =
    error
      ? "status error"
      : "status";

}


function showError(
  text
) {

  setStatus(
    text,
    true
  );

}
