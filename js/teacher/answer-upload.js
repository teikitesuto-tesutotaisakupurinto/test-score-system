/* =========================================================
   テスト成績システム
   答案アップロード 完全版

   対応:
   JPG / JPEG / PNG / WEBP / GIF / BMP
   PDF
   ZIP

   基本構造:

   入力ファイル
      ↓
   file-parser
      ↓
   ページ画像
      ↓
   QR探索
      ↓
   QRがあるページ = 新しい答案
      ↓
   QRがない後続ページ = 直前の答案
      ↓
   answer_sheets
      ↓
   answer_sheet_pages
========================================================= */


(function () {

  "use strict";


  let tests = [];


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
        .from("tests")
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
            ascending: false
          }
        );


    if (error) {

      console.error(error);

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

                ${escapeHtml(test.name)}

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
     アップロード
  ===================================================== */

  document
    .getElementById(
      "uploadButton"
    )
    .addEventListener(
      "click",
      async () => {

        const testId =
          document.getElementById(
            "testSelect"
          ).value;


        const files =
          [
            ...
            document.getElementById(
              "answerFiles"
            ).files
          ];


        if (!testId) {

          showMessage(
            "テストを選択してください。",
            true
          );

          return;

        }


        if (!files.length) {

          showMessage(
            "答案ファイルを選択してください。",
            true
          );

          return;

        }


        const button =
          document.getElementById(
            "uploadButton"
          );


        button.disabled =
          true;


        button.textContent =
          "処理中...";


        clearUploadList();


        try {

          for (
            const file
            of files
          ) {

            await processInputFile(
              testId,
              file
            );

          }


          showMessage(
            "答案の処理が完了しました。"
          );


        } catch (error) {

          console.error(
            error
          );


          showMessage(
            error.message ||
            "答案の処理に失敗しました。",
            true
          );

        }


        button.disabled =
          false;


        button.textContent =
          "アップロード開始";

      }
    );


  /* =====================================================
     1ファイル
  ===================================================== */

  async function processInputFile(
    testId,
    file
  ) {

    const row =
      createUploadRow(
        file.name
      );


    try {

      setRowStatus(
        row,
        "解析中..."
      );


      const pages =
        await window.TEST_SCORE_FILES
          .parseFile(
            file
          );


      if (
        !pages ||
        !pages.length
      ) {

        throw new Error(
          "ページを取得できませんでした。"
        );

      }


      setRowStatus(
        row,
        `${pages.length}ページ検出`
      );


      /*
        ページをQR単位で答案に分割
      */

      const groups =
        await groupPagesByQr(
          pages
        );


      setRowStatus(
        row,
        `${groups.length}答案を検出`
      );


      for (
        const group
        of groups
      ) {

        await saveAnswerGroup(
          testId,
          group,
          row
        );

      }


      setRowStatus(
        row,
        `${groups.length}答案登録完了`
      );


    } catch (error) {

      console.error(
        error
      );


      setRowStatus(
        row,
        error.message ||
        "処理失敗",
        true
      );

    }

  }


  /* =====================================================
     QR単位でページをグループ化
  ===================================================== */

  async function groupPagesByQr(
    pages
  ) {

    const groups = [];

    let currentGroup =
      null;


    for (
      const page
      of pages
    ) {

      const qr =
        await readQRCode(
          page.blob
        );


      /*
        QRが見つかった
        → 新しい答案
      */

      if (qr) {

        currentGroup = {

          qrValue:
            qr,

          pages: []

        };


        groups.push(
          currentGroup
        );

      }


      /*
        QRがない最初のページ
        → 答案を特定できない
      */

      if (!currentGroup) {

        currentGroup = {

          qrValue:
            null,

          pages: []

        };


        groups.push(
          currentGroup
        );

      }


      /*
        現在の答案にページ追加
      */

      currentGroup.pages.push(
        page
      );

    }


    return groups;

  }


  /* =====================================================
     答案グループ保存
  ===================================================== */

  async function saveAnswerGroup(
    testId,
    group,
    row
  ) {

    const student =
      group.qrValue
        ? await findStudentByQr(
            group.qrValue
          )
        : null;


    /*
      answer_sheets
    */

    const answer =
      await createAnswerSheet(
        testId,
        student,
        group.qrValue
      );


    /*
      ページ保存
    */

    for (
      let i = 0;
      i < group.pages.length;
      i++
    ) {

      const page =
        group.pages[i];


      const pageNo =
        i + 1;


      const path =
        `${testId}/${answer.id}/page-${String(pageNo).padStart(3, "0")}.png`;


      const {
        error:
          uploadError
      } =
        await supabaseClient
          .storage
          .from(
            "answer-files"
          )
          .upload(
            path,
            page.blob,
            {

              contentType:
                "image/png",

              upsert:
                true

            }
          );


      if (uploadError) {

        throw uploadError;

      }


      await saveAnswerPage({

        answerSheetId:
          answer.id,

        pageNo,

        storagePath:
          path,

        originalName:
          page.name ||
          "page",

        fileType:
          "image/png",

        width:
          page.width,

        height:
          page.height

      });

    }


    /*
      QRから生徒を特定
    */

    if (student) {

      await updateAnswerStudent(
        answer.id,
        student.id,
        group.qrValue
      );

    }


    if (row) {

      const label =
        student
          ? `${student.student_no} ${student.name}`
          : "未紐付け";


      addDetailStatus(
        row,
        label
      );

    }

  }


  /* =====================================================
     生徒検索
  ===================================================== */

  async function findStudentByQr(
    qrValue
  ) {

    const prefix =
      "STUDENT:";


    if (
      !qrValue.startsWith(
        prefix
      )
    ) {

      return null;

    }


    const studentNo =
      qrValue
        .substring(
          prefix.length
        )
        .trim();


    if (
      !/^\d{6}$/.test(
        studentNo
      )
    ) {

      return null;

    }


    const {
      data,
      error
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
        "student_no",
        studentNo
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();


    if (error) {

      throw error;

    }


    return data || null;

  }


  /* =====================================================
     answer_sheets
  ===================================================== */

  async function createAnswerSheet(
    testId,
    student,
    qrValue
  ) {

    const session =
      await getSession();


    if (!session) {

      throw new Error(
        "ログインセッションがありません。"
      );

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .insert({

          test_id:
            testId,

          student_id:
            student?.id ||
            null,

          original_file_path:
            null,

          qr_value:
            qrValue ||
            null,

          status:
            student
              ? "matched"
              : "unmatched",

          uploaded_by:
            session.user.id

        })
        .select(
          "id"
        )
        .single();


    if (error) {

      throw error;

    }


    return data;

  }


  /* =====================================================
     answer_sheet_pages
  ===================================================== */

  async function saveAnswerPage({
    answerSheetId,
    pageNo,
    storagePath,
    originalName,
    fileType,
    width,
    height
  }) {

    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .upsert(
          {

            answer_sheet_id:
              answerSheetId,

            page_no:
              pageNo,

            file_path:
              storagePath,

            file_type:
              fileType,

            original_name:
              originalName,

            width_px:
              width,

            height_px:
              height

          },
          {

            onConflict:
              "answer_sheet_id,page_no"

          }
        );


    if (error) {

      throw error;

    }

  }


  /* =====================================================
     生徒紐付け
  ===================================================== */

  async function updateAnswerStudent(
    answerId,
    studentId,
    qrValue
  ) {

    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .update({

          student_id:
            studentId,

          qr_value:
            qrValue,

          status:
            "matched"

        })
        .eq(
          "id",
          answerId
        );


    if (error) {

      throw error;

    }

  }


  /* =====================================================
     QR読み取り
  ===================================================== */

  async function readQRCode(
    blob
  ) {

    if (
      typeof jsQR ===
      "undefined"
    ) {

      return null;

    }


    const image =
      await loadImage(
        blob
      );


    const maxSize =
      3000;


    let width =
      image.naturalWidth;


    let height =
      image.naturalHeight;


    if (
      width > maxSize ||
      height > maxSize
    ) {

      const ratio =
        Math.min(
          maxSize / width,
          maxSize / height
        );


      width =
        Math.round(
          width * ratio
        );


      height =
        Math.round(
          height * ratio
        );

    }


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;


    canvas.height =
      height;


    const context =
      canvas.getContext(
        "2d",
        {
          willReadFrequently:
            true
        }
      );


    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );


    const imageData =
      context.getImageData(
        0,
        0,
        width,
        height
      );


    const result =
      jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (result?.data) {

      return result.data;

    }


    /*
      簡易二値化して再試行
    */

    const data =
      imageData.data;


    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {

      const gray =
        Math.round(
          data[i] * 0.299 +
          data[i + 1] * 0.587 +
          data[i + 2] * 0.114
        );


      const value =
        gray < 160
          ? 0
          : 255;


      data[i] =
        value;

      data[i + 1] =
        value;

      data[i + 2] =
        value;

    }


    const retry =
      jsQR(
        data,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    return retry?.data ||
      null;

  }


  /* =====================================================
     Image
  ===================================================== */

  function loadImage(
    blob
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const image =
          new Image();


        const url =
          URL.createObjectURL(
            blob
          );


        image.onload =
          () => {

            URL.revokeObjectURL(
              url
            );


            resolve(
              image
            );

          };


        image.onerror =
          () => {

            URL.revokeObjectURL(
              url
            );


            reject(
              new Error(
                "画像を読み込めませんでした。"
              )
            );

          };


        image.src =
          url;

      }
    );

  }


  /* =====================================================
     UI
  ===================================================== */

  function createUploadRow(
    name
  ) {

    const container =
      document.getElementById(
        "uploadList"
      );


    const row =
      document.createElement(
        "div"
      );


    row.style.cssText = `

      padding:10px;

      margin-bottom:6px;

      border:
        1px solid #d0d6dc;

      background:#fff;

    `;


    row.innerHTML = `

      <strong>
        ${escapeHtml(name)}
      </strong>


      <span
        class="upload-status"
        style="
          margin-left:15px;
          color:#777;
        "
      >
        待機中
      </span>


      <div
        class="upload-detail"
        style="
          margin-top:5px;
          font-size:12px;
          color:#666;
        "
      >
      </div>

    `;


    container.appendChild(
      row
    );


    return row;

  }


  function setRowStatus(
    row,
    text,
    error = false
  ) {

    const status =
      row.querySelector(
        ".upload-status"
      );


    if (!status) {

      return;

    }


    status.textContent =
      text;


    status.style.color =
      error
        ? "#c62828"
        : "#16834b";

  }


  function addDetailStatus(
    row,
    text
  ) {

    const detail =
      row.querySelector(
        ".upload-detail"
      );


    if (!detail) {

      return;

    }


    const item =
      document.createElement(
        "div"
      );


    item.textContent =
      text;


    detail.appendChild(
      item
    );

  }


  function clearUploadList() {

    document.getElementById(
      "uploadList"
    ).innerHTML =
      "";

  }


  function showMessage(
    text,
    error = false
  ) {

    const element =
      document.getElementById(
        "message"
      );


    element.textContent =
      text;


    element.style.color =
      error
        ? "#c62828"
        : "#16834b";

  }


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
     START
  ===================================================== */

  initialize();

})();
