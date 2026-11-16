
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

function renderQr(
  students
) {

  const grid =
    document.getElementById(
      "qrGrid"
    );


  if (!grid) {

    return;

  }


  grid.innerHTML =
    "";


  if (!students.length) {

    grid.innerHTML = `

      <div class="empty">

        有効な生徒が登録されていません。

      </div>

    `;

    return;

  }


  students.forEach(
    student => {

      const card =
        document.createElement(
          "article"
        );


      card.className =
        "qr-card";


      const studentNo =
        document.createElement(
          "div"
        );


      studentNo.className =
        "qr-student-no";


      studentNo.textContent =
        student.student_no ||
        "";


      const studentName =
        document.createElement(
          "div"
        );


      studentName.className =
        "qr-student-name";


      studentName.textContent =
        student.name ||
        "";


      const image =
        document.createElement(
          "div"
        );


      image.className =
        "qr-image";


      const qr =
        document.createElement(
          "div"
        );


      /*
       * qr_tokenが存在する場合は
       * DBに保存された値を使用。
       *
       * 無い場合は生徒番号を使用。
       */

      const qrValue =
        student.qr_token ||
        `STUDENT:${student.student_no}`;


      if (
        typeof QRCode !==
        "function"
      ) {

        image.textContent =
          "QRライブラリを読み込めませんでした。";

      } else {

        new QRCode(
          qr,
          {

            text:
              qrValue,

            width:
              150,

            height:
              150,

            correctLevel:
              QRCode.CorrectLevel.M

          }
        );


        image.appendChild(
          qr
        );

      }


      const value =
        document.createElement(
          "div"
        );


      value.className =
        "qr-value";


      value.textContent =
        qrValue;


      card.append(
        studentNo,
        studentName,
        image,
        value
      );


      grid.appendChild(
        card
      );

    }
  );

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
