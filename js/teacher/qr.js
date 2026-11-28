
"use strict";

/* =========================================================
   生徒QR発行

   QR値
   ---------------------------------------------------------
   生徒番号そのもの

   答案アップロード時に
   QRを読み取り、生徒番号と完全一致させる。

   ・有効な生徒のみ
   ・生徒番号を変更しない
   ・QR値を推測しない
========================================================= */


let DB = null;
let studentsLoaded = false;


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
        // 印刷ダイアログはユーザー操作の同期処理として開く。
        // QR画像の生成・読込待ちは一覧ロード時に完了させておく。
        if (!studentsLoaded) {
          showError("QRコードの生成が完了していません。画面の読み込み完了後に印刷してください。");
          return;
        }
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
        active
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


  await ensureQRCode();
  renderQr(data || []);
  await waitForQrRender();
  studentsLoaded = true;


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

async function ensureQRCode() {
  if (typeof window.QRCode === "function") return window.QRCode;
  for (const src of [
    "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
    "https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"
  ]) {
    const loaded = await new Promise(resolve => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve(typeof window.QRCode === "function");
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    if (loaded) return window.QRCode;
  }
  throw new Error("QRコード生成ライブラリを読み込めません。ネットワーク接続を確認してください。");
}

function waitForQrRender() {
  const root = document.getElementById("qrPrintSheets");
  if (!root) return Promise.reject(new Error("印刷用QR領域がありません。"));
  const images = [...root.querySelectorAll("img")];
  return Promise.all(images.map(image => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("QR画像の生成に失敗しました。")), { once: true });
    });
  })).then(() => {
    if (!root.querySelector("canvas, img")) throw new Error("印刷するQRが生成されていません。");
  });
}

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
    const qrValue = String(student.student_no || "").trim();

    if (typeof QRCode === "function") {
      new QRCode(qr, {
        text: qrValue,
        width: 150,
        height: 150,
        correctLevel: QRCode.CorrectLevel.H
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
        const qrValue = String(student.student_no || "").trim();

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
