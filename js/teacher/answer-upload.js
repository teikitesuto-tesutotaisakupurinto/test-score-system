(function () {

  "use strict";


  let uploadTests = [];


  /* =====================================================
     初期化
  ===================================================== */

  async function initializeAnswerUpload() {

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
     テスト一覧
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
          class_name,
          status
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      console.error(
        error
      );


      showMessage(
        "テスト一覧を取得できませんでした。",
        true
      );


      return;

    }


    uploadTests =
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
        uploadTests
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

                ${
                  test.grade
                    ? ` / ${escapeHtml(test.grade)}`
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
     アップロード開始
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
            "すべてのファイルの処理が完了しました。"
          );


        } catch (error) {

          console.error(
            "答案アップロード:",
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
     入力ファイル
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
        "ファイル解析中..."
      );


      if (
        !window.TEST_SCORE_FILES
      ) {

        throw new Error(
          "共通ファイル処理エンジンが読み込まれていません。"
        );

      }


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
          `${file.name}からページを取得できませんでした。`
        );

      }


      setRowStatus(
        row,
        `${pages.length}ページ検出`
      );


      /*
        1つの入力ファイルを
        1つのanswer_sheetとして扱う。

        ZIPの場合はZIP全体を1答案とする。
        複数答案ZIPはファイル単位で
        分けてアップロードする方式を基本とする。
      */

      const answerSheet =
        await createAnswerSheet(
          testId,
          file.name
        );


      let qrValue =
        null;


      /*
        ページ処理
      */

      for (
        let index = 0;
        index < pages.length;
        index++
      ) {

        const page =
          pages[index];


        const pageNo =
          index + 1;


        const storagePath =
          `${testId}/${answerSheet.id}/page-${String(pageNo).padStart(3, "0")}.png`;


        /*
          Storage
        */

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
              storagePath,
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


        /*
          answer_sheet_pages
        */

        await saveAnswerPage({

          answerSheetId:
            answerSheet.id,

          pageNo,

          storagePath,

          originalName:
            page.name ||
            file.name,

          fileType:
            "image/png",

          width:
            page.width,

          height:
            page.height

        });


        /*
          QR
        */

        if (!qrValue) {

          setRowStatus(
            row,
            `${pageNo}/${pages.length}ページ QR確認中...`
          );


          qrValue =
            await readQRCode(
              page.blob
            );

        }


        setRowStatus(
          row,
          `${pageNo}/${pages.length}ページ処理済み`
        );

      }


      /*
        QRが見つかった
      */

      if (qrValue) {

        const matched =
          await matchAnswerByQr(
            answerSheet.id,
            qrValue
          );


        if (matched) {

          setRowStatus(
            row,
            `QR紐付け完了：${matched.studentNo} ${matched.name}`
          );

        } else {

          setRowStatus(
            row,
            "QR読取済み・生徒未登録",
            true
          );

        }

      } else {

        setRowStatus(
          row,
          "QR未読取 → 未紐付け"
        );

      }


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
     answer_sheets
  ===================================================== */

  async function createAnswerSheet(
    testId,
    originalName
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

          original_file_path:
            null,

          status:
            "unmatched",

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
     QR読み取り
  ===================================================== */

  async function readQRCode(
    blob
  ) {

    if (
      typeof jsQR ===
      "undefined"
    ) {

      console.warn(
        "jsQRが読み込まれていません。"
      );


      return null;

    }


    const image =
      await loadImage(
        blob
      );


    /*
      大きすぎる画像は
      QR読み取り用に縮小する。

      元画像はStorageに
      そのまま保存済み。
    */

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


    /*
      通常読み取り
    */

    const imageData =
      context.getImageData(
        0,
        0,
        width,
        height
      );


    let result =
      jsQR(
        imageData.data,
        imageData.width,
        imageData.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    if (result) {

      return result.data;

    }


    /*
      グレースケール＋二値化
      の簡易再試行
    */

    const processed =
      preprocessForQr(
        canvas
      );


    const processedData =
      processed
        .getContext(
          "2d",
          {
            willReadFrequently:
              true
          }
        )
        .getImageData(
          0,
          0,
          processed.width,
          processed.height
        );


    result =
      jsQR(
        processedData.data,
        processedData.width,
        processedData.height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    return result?.data ||
      null;

  }


  /* =====================================================
     QR前処理
  ===================================================== */

  function preprocessForQr(
    sourceCanvas
  ) {

    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      sourceCanvas.width;


    canvas.height =
      sourceCanvas.height;


    const context =
      canvas.getContext(
        "2d"
      );


    context.drawImage(
      sourceCanvas,
      0,
      0
    );


    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );


    const data =
      imageData.data;


    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {

      const gray =
        Math.round(
          (
            data[i] * 0.299 +
            data[i + 1] * 0.587 +
            data[i + 2] * 0.114
          )
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


    context.putImageData(
      imageData,
      0,
      0
    );


    return canvas;

  }


  /* =====================================================
     QR → 生徒
  ===================================================== */

  async function matchAnswerByQr(
    answerSheetId,
    qrValue
  ) {

    const prefix =
      "STUDENT:";


    if (
      !qrValue ||
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


    /*
      6桁固定
    */

    if (
      !/^\d{6}$/.test(
        studentNo
      )
    ) {

      return null;

    }


    const {
      data: student,
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


    if (!student) {

      return null;

    }


    const {
      error:
        updateError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .update({

          student_id:
            student.id,

          qr_value:
            qrValue,

          status:
            "matched"

        })
        .eq(
          "id",
          answerSheetId
        );


    if (updateError) {

      throw updateError;

    }


    return {

      studentNo:
        student.student_no,

      name:
        student.name

    };

  }


  /* =====================================================
     画像
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

  initializeAnswerUpload();

})();
