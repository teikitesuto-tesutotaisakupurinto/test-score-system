
/* =========================================================
   テスト成績システム
   答案アップロード 完全版

   最終仕様
   ---------------------------------------------------------
   解答用紙
      ↓
   layout_boxes
      ↓
   答案アップロード
      ↓
   QR読み取り
      ↓
   生徒自動特定
      ↓
   answer_sheet
      ↓
   元答案保存
      ↓
   layout_boxesを答案画像へ座標変換
      ↓
   自動クロップ
      ↓
   answer_regions
      ↓
   採点

   対応ファイル
   ---------------------------------------------------------
   PDF
   JPG
   JPEG
   PNG
   WEBP
   ZIP

   ZIP
   ---------------------------------------------------------
   ZIP
     ↓
   展開
     ↓
   PDF / 画像
     ↓
   ページ化


   QR
   ---------------------------------------------------------
   180841

   student_no=180841

   qr_token=xxxxxxxx

   {"student_no":"180841"}

   {"qr_token":"xxxxxxxx"}

   https://example...?student_no=180841

   などに対応。


   重要
   ---------------------------------------------------------
   ・答案側で枠設定しない
   ・解答用紙の枠を使用
   ・元答案画像は原寸で保存
   ・クロップ画像はstudent-answersへ保存
   ・QRが読めない答案は自動登録しない
   ・生徒を特定できない答案はunmatched
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     State
  ======================================================= */

  let tests = [];

  let selectedTestId = null;

  let selectedFiles = [];

  let uploading = false;

  let pdfJsPromise = null;

  let jsZipPromise = null;

  let jsQrPromise = null;


  /* =======================================================
     Constants
  ======================================================= */

  const MAX_FILE_SIZE =
    50 * 1024 * 1024;


  const MAX_ZIP_ENTRIES =
    500;


  const ALLOWED_EXTENSIONS = [

    "pdf",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "zip"

  ];


  /* =======================================================
     DOM
  ======================================================= */

  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const answerType =
    document.getElementById(
      "answerType"
    );


  const fileInput =
    document.getElementById(
      "fileInput"
    );


  const dropZone =
    document.getElementById(
      "dropZone"
    );


  const selectedFilesElement =
    document.getElementById(
      "selectedFiles"
    );


  const uploadButton =
    document.getElementById(
      "uploadButton"
    );


  const clearButton =
    document.getElementById(
      "clearButton"
    );


  const progressWrap =
    document.getElementById(
      "progressWrap"
    );


  const progressValue =
    document.getElementById(
      "progressValue"
    );


  const progressText =
    document.getElementById(
      "progressText"
    );


  const messageElement =
    document.getElementById(
      "message"
    );


  /* =======================================================
     Initialize
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {

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

      setupEvents();

      updateUploadButton();

    } catch (error) {

      console.error(
        "answers-upload initialize:",
        error
      );


      showMessage(
        error.message ||
        "答案アップロード画面を読み込めませんでした。",
        true
      );

    }

  }


  /* =======================================================
     Tests
  ======================================================= */

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
          class_name
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


    tests =
      data || [];


    if (!testSelect) {

      return;

    }


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


  /* =======================================================
     Events
  ======================================================= */

  function setupEvents() {

    testSelect?.addEventListener(
      "change",
      () => {

        selectedTestId =
          testSelect.value ||
          null;


        updateUploadButton();

      }
    );


    fileInput?.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );


        /*
          同じファイルを再選択できるようにする。
        */

        fileInput.value =
          "";

      }
    );


    dropZone?.addEventListener(
      "click",
      () => {

        fileInput?.click();

      }
    );


    dropZone?.addEventListener(
      "dragover",
      event => {

        event.preventDefault();

        dropZone.classList.add(
          "dragover"
        );

      }
    );


    dropZone?.addEventListener(
      "dragleave",
      () => {

        dropZone.classList.remove(
          "dragover"
        );

      }
    );


    dropZone?.addEventListener(
      "drop",
      event => {

        event.preventDefault();

        dropZone.classList.remove(
          "dragover"
        );


        addFiles(
          event.dataTransfer.files
        );

      }
    );


    clearButton?.addEventListener(
      "click",
      clearFiles
    );


    uploadButton?.addEventListener(
      "click",
      uploadFiles
    );


    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
        "click",
        logout
      );

  }


  /* =======================================================
     Add Files
  ======================================================= */

  function addFiles(
    fileList
  ) {

    if (!fileList) {

      return;

    }


    const files =
      Array.from(
        fileList
      );


    for (
      const file
      of files
    ) {

      const result =
        validateFile(
          file
        );


      if (!result.ok) {

        showMessage(
          `${file.name}: ${result.message}`,
          true
        );


        continue;

      }


      const exists =
        selectedFiles.some(
          current =>
            current.name ===
              file.name &&
            current.size ===
              file.size &&
            current.lastModified ===
              file.lastModified
        );


      if (!exists) {

        selectedFiles.push(
          file
        );

      }

    }


    renderSelectedFiles();

    updateUploadButton();

  }


  /* =======================================================
     Validate
  ======================================================= */

  function validateFile(
    file
  ) {

    if (!file) {

      return {

        ok:false,

        message:
          "ファイルがありません。"

      };

    }


    if (
      file.size >
      MAX_FILE_SIZE
    ) {

      return {

        ok:false,

        message:
          "1ファイル50MBまでです。"

      };

    }


    const extension =
      getExtension(
        file.name
      );


    if (
      !ALLOWED_EXTENSIONS.includes(
        extension
      )
    ) {

      return {

        ok:false,

        message:
          "対応していないファイル形式です。"

      };

    }


    return {

      ok:true

    };

  }


  /* =======================================================
     Render File List
  ======================================================= */

  function renderSelectedFiles() {

    if (!selectedFilesElement) {

      return;

    }


    if (!selectedFiles.length) {

      selectedFilesElement.innerHTML =
        "";

      return;

    }


    selectedFilesElement.innerHTML =
      selectedFiles
        .map(
          (
            file,
            index
          ) => `

            <div
              class="selected-file"
            >

              <div
                class="selected-file-name"
              >

                ${escapeHtml(
                  file.name
                )}

              </div>


              <div
                class="selected-file-size"
              >

                ${formatFileSize(
                  file.size
                )}

              </div>


              <button
                type="button"
                class="btn"
                data-remove="${index}"
              >
                削除
              </button>

            </div>

          `
        )
        .join("");


    selectedFilesElement
      .querySelectorAll(
        "[data-remove]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();


              const index =
                Number(
                  button.dataset.remove
                );


              selectedFiles.splice(
                index,
                1
              );


              renderSelectedFiles();

              updateUploadButton();

            }
          );

        }
      );

  }


  /* =======================================================
     Upload Button
  ======================================================= */

  function updateUploadButton() {

    if (!uploadButton) {

      return;

    }


    uploadButton.disabled =
      uploading ||
      !selectedTestId ||
      !selectedFiles.length;

  }


  /* =======================================================
     Upload
  ======================================================= */

  async function uploadFiles() {

    if (uploading) {

      return;

    }


    if (!selectedTestId) {

      showMessage(
        "テストを選択してください。",
        true
      );

      return;

    }


    if (!selectedFiles.length) {

      showMessage(
        "答案ファイルを選択してください。",
        true
      );

      return;

    }


    uploading =
      true;


    updateUploadButton();

    clearMessage();


    try {

      /*
        最初に解答用紙が存在するか確認。

        これが今回の仕様上重要。
      */

      const template =
        await loadTemplate();


      if (!template.pages.length) {

        throw new Error(
          "先に解答用紙をアップロードして、解答欄を設定してください。"
        );

      }


      if (!template.boxes.length) {

        throw new Error(
          "先に解答用紙へ解答欄を設定してください。"
        );

      }


      /*
        ZIP展開
      */

      const sourceFiles =
        await expandZipFiles(
          selectedFiles
        );


      if (!sourceFiles.length) {

        throw new Error(
          "処理できる答案ファイルがありません。"
        );

      }


      /*
        PDF / 画像をページ化
      */

      const documents =
        [];


      for (
        let i = 0;
        i < sourceFiles.length;
        i++
      ) {

        const file =
          sourceFiles[i];


        const pages =
          await fileToPages(
            file
          );


        documents.push({

          sourceName:
            file.name,

          pages

        });


        showProgress(
          Math.round(
            (
              i + 1
            ) /
            sourceFiles.length *
            20
          ),
          `ファイル処理 ${i + 1}/${sourceFiles.length}`
        );

      }


      /*
        生徒ごとに答案処理
      */

      let documentIndex =
        0;


      let successCount =
        0;


      let unmatchedCount =
        0;


      for (
        const document
        of documents
      ) {

        documentIndex++;


        try {

          const result =
            await processDocument(
              document,
              template
            );


          if (
            result.matched
          ) {

            successCount++;

          } else {

            unmatchedCount++;

          }

        } catch (error) {

          console.error(
            "答案処理:",
            document.sourceName,
            error
          );


          unmatchedCount++;

        }


        showProgress(
          20 +
          Math.round(
            documentIndex /
            documents.length *
            80
          ),
          `答案処理 ${documentIndex}/${documents.length}`
        );

      }


      showProgress(
        100,
        "完了"
      );


      showMessage(
        `処理完了：${successCount}件紐付け / ${unmatchedCount}件未処理`,
        unmatchedCount > 0
      );


      clearFiles();

    } catch (error) {

      console.error(
        "アップロード:",
        error
      );


      showMessage(
        error.message ||
        "答案アップロードに失敗しました。",
        true
      );

    } finally {

      uploading =
        false;

      updateUploadButton();

    }

  }


  /* =======================================================
     Load Template
  ======================================================= */

  async function loadTemplate() {

    const {
      data:
        pages,
      error:
        pageError
    } =
      await supabaseClient
        .from(
          "test_pages"
        )
        .select(`
          id,
          test_id,
          page_no,
          file_path,
          file_type,
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "test_id",
          selectedTestId
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


    const {
      data:
        boxes,
      error:
        boxError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(`
          id,
          test_id,
          source_page_id,
          question_id,
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
        );


    if (boxError) {

      throw boxError;

    }


    return {

      pages:
        pages || [],

      boxes:
        boxes || []

    };

  }


  /* =======================================================
     Process Document
  ======================================================= */

  async function processDocument(
    document,
    template
  ) {

    /*
      QR読み取り
    */

    const qrResult =
      await detectStudentFromPages(
        document.pages
      );


    /*
      QRで特定できなければ
      ファイル名の6桁も試す。
    */

    let student =
      qrResult?.student ||
      null;


    let qr =
      qrResult?.qr ||
      null;


    if (!student) {

      const studentNo =
        extractStudentNumber(
          document.sourceName
        );


      if (studentNo) {

        student =
          await findStudentByNumber(
            studentNo
          );

      }

    }


    /*
      生徒特定できなければ
      unmatchedとして保存する。
    */

    if (!student) {

      await saveUnmatchedDocument(
        document
      );


      return {

        matched:false

      };

    }


    /*
      答案Sheet
    */

    const {
      data:
        answerSheet,
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .insert({

          test_id:
            selectedTestId,

          student_id:
            student.id,

          status:
            "uploaded"

        })
        .select(
          "id"
        )
        .single();


    if (answerError) {

      throw answerError;

    }


    /*
      元答案を保存
    */

    const answerPages =
      await saveOriginalPages(
        answerSheet.id,
        document
      );


    /*
      自動クロップ
    */

    await createAnswerRegions(
      answerSheet.id,
      answerPages,
      template.pages,
      template.boxes
    );


    /*
      QRログを必要なら
      answer_sheetsのstatusだけで管理。

      QR内容そのものは
      mark_objects等には入れない。
    */

    return {

      matched:true,

      student,

      qr,

      answerSheet

    };

  }


  /* =======================================================
     Save Original Pages
  ======================================================= */

  async function saveOriginalPages(
    answerSheetId,
    document
  ) {

    const result =
      [];


    let pageNo =
      1;


    for (
      const page
      of document.pages
    ) {

      const path =
        [
          selectedTestId,
          answerSheetId,
          `page-${String(
            pageNo
          ).padStart(
            3,
            "0"
          )}.png`
        ].join("/");


      const blob =
        await canvasToBlob(
          page.canvas,
          "image/png"
        );


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
            blob,
            {
              contentType:
                "image/png",

              upsert:
                false

            }
          );


      if (uploadError) {

        throw uploadError;

      }


      const {
        data:
          savedPage,
        error:
          pageError
      } =
        await supabaseClient
          .from(
            "answer_sheet_pages"
          )
          .insert({

            answer_sheet_id:
              answerSheetId,

            page_no:
              pageNo,

            file_path:
              path,

            file_type:
              "image/png",

            original_name:
              document.sourceName,

            width_px:
              page.width,

            height_px:
              page.height

          })
          .select()
          .single();


      if (pageError) {

        throw pageError;

      }


      result.push({

        ...savedPage,

        canvas:
          page.canvas,

        width:
          page.width,

        height:
          page.height

      });


      pageNo++;

    }


    return result;

  }


  /* =======================================================
     Automatic Crop
  ======================================================= */

  async function createAnswerRegions(
    answerSheetId,
    answerPages,
    templatePages,
    boxes
  ) {

    for (
      const answerPage
      of answerPages
    ) {

      /*
        同じページ番号の
        解答用紙を探す。
      */

      const templatePage =
        templatePages.find(
          page =>
            Number(
              page.page_no
            ) ===
            Number(
              answerPage.page_no
            )
        );


      if (!templatePage) {

        continue;

      }


      const pageBoxes =
        boxes.filter(
          box =>
            box.source_page_id ===
            templatePage.id
        );


      /*
        解答用紙と答案のサイズ比率
      */

      const scaleX =
        answerPage.width /
        Number(
          templatePage.width_px
        );


      const scaleY =
        answerPage.height /
        Number(
          templatePage.height_px
        );


      for (
        const box
        of pageBoxes
      ) {

        const rect = {

          x:
            Number(
              box.x
            ) *
            scaleX,

          y:
            Number(
              box.y
            ) *
            scaleY,

          width:
            Number(
              box.width
            ) *
            scaleX,

          height:
            Number(
              box.height
            ) *
            scaleY

        };


        const crop =
          cropCanvas(
            answerPage.canvas,
            rect
          );


        if (!crop) {

          continue;

        }


        const path =
          [
            selectedTestId,
            answerSheetId,
            `region-${box.id}.png`
          ].join("/");


        const blob =
          await canvasToBlob(
            crop,
            "image/png"
          );


        const {
          error:
            uploadError
        } =
          await supabaseClient
            .storage
            .from(
              "student-answers"
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


        if (uploadError) {

          throw uploadError;

        }


        const {
          error:
            regionError
        } =
          await supabaseClient
            .from(
              "answer_regions"
            )
            .upsert({

              answer_sheet_id:
                answerSheetId,

              layout_box_id:
                box.id,

              page_no:
                answerPage.page_no,

              image_path:
                path,

              x:
                rect.x,

              y:
                rect.y,

              width:
                rect.width,

              height:
                rect.height

            }, {

              onConflict:
                "answer_sheet_id,layout_box_id"

            });


        if (regionError) {

          throw regionError;

        }

      }

    }

  }


  /* =======================================================
     QR
  ======================================================= */

  async function detectStudentFromPages(
    pages
  ) {

    for (
      const page
      of pages
    ) {

      /*
        通常解析
      */

      let qr =
        await detectQr(
          page.canvas
        );


      /*
        QRが見つからない場合、
        四隅・中央付近を切り出して再試行。

        答案にQRが小さく印刷されている
        ケースへの対応。
      */

      if (!qr) {

        qr =
          await detectQrRegions(
            page.canvas
          );

      }


      if (!qr) {

        continue;

      }


      const student =
        await findStudentFromQr(
          qr
        );


      if (student) {

        return {

          student,

          qr,

          page

        };

      }

    }


    return null;

  }


  /* =======================================================
     QR Detection
  ======================================================= */

  async function detectQr(
    canvas
  ) {

    const jsQR =
      await loadJsQR();


    /*
      巨大画像を縮小して解析
    */

    const maxSide =
      2000;


    const scale =
      Math.min(
        1,
        maxSide /
        Math.max(
          canvas.width,
          canvas.height
        )
      );


    const scanCanvas =
      document.createElement(
        "canvas"
      );


    scanCanvas.width =
      Math.max(
        1,
        Math.round(
          canvas.width *
          scale
        )
      );


    scanCanvas.height =
      Math.max(
        1,
        Math.round(
          canvas.height *
          scale
        )
      );


    const context =
      scanCanvas.getContext(
        "2d",
        {
          willReadFrequently:
            true
        }
      );


    context.drawImage(
      canvas,
      0,
      0,
      scanCanvas.width,
      scanCanvas.height
    );


    const imageData =
      context.getImageData(
        0,
        0,
        scanCanvas.width,
        scanCanvas.height
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


    if (!result) {

      return null;

    }


    return {

      raw:
        result.data,

      location:
        result.location,

      scanScale:
        scale

    };

  }


  /* =======================================================
     QR Region Scan
  ======================================================= */

  async function detectQrRegions(
    canvas
  ) {

    const regions = [

      {
        x:0,
        y:0,
        width:.35,
        height:.35
      },

      {
        x:.65,
        y:0,
        width:.35,
        height:.35
      },

      {
        x:0,
        y:.65,
        width:.35,
        height:.35
      },

      {
        x:.65,
        y:.65,
        width:.35,
        height:.35
      },

      {
        x:.325,
        y:.325,
        width:.35,
        height:.35
      }

    ];


    for (
      const region
      of regions
    ) {

      const crop =
        document.createElement(
          "canvas"
        );


      crop.width =
        Math.round(
          canvas.width *
          region.width
        );


      crop.height =
        Math.round(
          canvas.height *
          region.height
        );


      crop
        .getContext("2d")
        .drawImage(

          canvas,

          Math.round(
            canvas.width *
            region.x
          ),

          Math.round(
            canvas.height *
            region.y
          ),

          crop.width,
          crop.height,

          0,
          0,

          crop.width,
          crop.height

        );


      const qr =
        await detectQr(
          crop
        );


      if (qr) {

        return qr;

      }

    }


    return null;

  }


  /* =======================================================
     Parse QR
  ======================================================= */

  function parseQrPayload(
    value
  ) {

    const raw =
      String(
        value ||
        ""
      ).trim();


    if (!raw) {

      return null;

    }


    /*
      JSON
    */

    try {

      const json =
        JSON.parse(
          raw
        );


      if (
        json.student_no
      ) {

        return {

          type:
            "student_no",

          value:
            String(
              json.student_no
            ).trim()

        };

      }


      if (
        json.qr_token
      ) {

        return {

          type:
            "qr_token",

          value:
            String(
              json.qr_token
            ).trim()

        };

      }

    } catch (_) {}


    /*
      student_no=180841
    */

    const studentNo =
      raw.match(
        /student[_-]?no\s*[:=]\s*([0-9]{6})/i
      );


    if (studentNo) {

      return {

        type:
          "student_no",

        value:
          studentNo[1]

      };

    }


    /*
      qr_token=...
    */

    const qrToken =
      raw.match(
        /qr[_-]?token\s*[:=]\s*([a-zA-Z0-9_-]+)/i
      );


    if (qrToken) {

      return {

        type:
          "qr_token",

        value:
          qrToken[1]

      };

    }


    /*
      URL
    */

    try {

      const url =
        new URL(
          raw
        );


      const urlStudentNo =
        url.searchParams.get(
          "student_no"
        );


      if (urlStudentNo) {

        return {

          type:
            "student_no",

          value:
            urlStudentNo

        };

      }


      const urlQrToken =
        url.searchParams.get(
          "qr_token"
        );


      if (urlQrToken) {

        return {

          type:
            "qr_token",

          value:
            urlQrToken

        };

      }

    } catch (_) {}


    /*
      6桁だけ
    */

    if (
      /^[0-9]{6}$/.test(
        raw
      )
    ) {

      return {

        type:
          "student_no",

        value:
          raw

      };

    }


    return null;

  }


  /* =======================================================
     Student from QR
  ======================================================= */

  async function findStudentFromQr(
    qr
  ) {

    const parsed =
      parseQrPayload(
        qr.raw
      );


    if (!parsed) {

      return null;

    }


    if (
      parsed.type ===
      "student_no"
    ) {

      return findStudentByNumber(
        parsed.value
      );

    }


    if (
      parsed.type ===
      "qr_token"
    ) {

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
            name,
            auth_user_id,
            active
          `)
          .eq(
            "qr_token",
            parsed.value
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


    return null;

  }


  /* =======================================================
     Student by Number
  ======================================================= */

  async function findStudentByNumber(
    studentNo
  ) {

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
          name,
          auth_user_id,
          active
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


  /* =======================================================
     Filename fallback
  ======================================================= */

  function extractStudentNumber(
    fileName
  ) {

    const match =
      String(
        fileName ||
        ""
      ).match(
        /(?:^|[^0-9])([0-9]{6})(?:[^0-9]|$)/
      );


    return match
      ? match[1]
      : null;

  }


  /* =======================================================
     Unmatched
  ======================================================= */

  async function saveUnmatchedDocument(
    document
  ) {

    /*
      生徒を特定できない場合は、
      答案を勝手に別生徒へ紐付けない。

      answer_sheets.student_id = null
      status = unmatched
    */

    const {
      data:
        answerSheet,
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .insert({

          test_id:
            selectedTestId,

          student_id:
            null,

          status:
            "unmatched"

        })
        .select(
          "id"
        )
        .single();


    if (answerError) {

      throw answerError;

    }


    await saveOriginalPages(
      answerSheet.id,
      document
    );

  }


  /* =======================================================
     ZIP
  ======================================================= */

  async function expandZipFiles(
    files
  ) {

    const result =
      [];


    for (
      const file
      of files
    ) {

      const extension =
        getExtension(
          file.name
        );


      if (
        extension !==
        "zip"
      ) {

        result.push(
          file
        );

        continue;

      }


      const extracted =
        await extractZip(
          file
        );


      result.push(
        ...extracted
      );

    }


    return result;

  }


  async function extractZip(
    file
  ) {

    const JSZip =
      await loadJSZip();


    const zip =
      await JSZip.loadAsync(
        file
      );


    const entries =
      Object.values(
        zip.files
      );


    if (
      entries.length >
      MAX_ZIP_ENTRIES
    ) {

      throw new Error(
        "ZIP内のファイル数が多すぎます。"
      );

    }


    const result =
      [];


    for (
      const entry
      of entries
    ) {

      if (
        entry.dir
      ) {

        continue;

      }


      const extension =
        getExtension(
          entry.name
        );


      if (
        ![
          "pdf",
          "jpg",
          "jpeg",
          "png",
          "webp"
        ].includes(
          extension
        )
      ) {

        continue;

      }


      const blob =
        await entry.async(
          "blob"
        );


      const fileName =
        entry.name
          .split("/")
          .pop();


      result.push(
        new File(
          [
            blob
          ],
          fileName,
          {
            type:
              guessMimeType(
                fileName
              )
          }
        )
      );

    }


    return result;

  }


  /* =======================================================
     JSZip
  ======================================================= */

  function loadJSZip() {

    if (
      jsZipPromise
    ) {

      return jsZipPromise;

    }


    jsZipPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          if (
            window.JSZip
          ) {

            resolve(
              window.JSZip
            );

            return;

          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";


          script.onload =
            () => {

              if (
                window.JSZip
              ) {

                resolve(
                  window.JSZip
                );

              } else {

                reject(
                  new Error(
                    "JSZipを読み込めませんでした。"
                  )
                );

              }

            };


          script.onerror =
            () =>
              reject(
                new Error(
                  "JSZipの読み込みに失敗しました。"
                )
              );


          document.head.appendChild(
            script
          );

        }
      );


    return jsZipPromise;

  }


  /* =======================================================
     File → Pages
  ======================================================= */

  async function fileToPages(
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

      return convertPdfToPages(
        file
      );

    }


    return [
      await convertImageToPage(
        file
      )
    ];

  }


  /* =======================================================
     PDF
  ======================================================= */

  function loadPdfJs() {

    if (
      pdfJsPromise
    ) {

      return pdfJsPromise;

    }


    pdfJsPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          if (
            window.pdfjsLib
          ) {

            resolve(
              window.pdfjsLib
            );

            return;

          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";


          script.onload =
            () => {

              if (
                !window.pdfjsLib
              ) {

                reject(
                  new Error(
                    "PDF.jsを読み込めませんでした。"
                  )
                );

                return;

              }


              window.pdfjsLib
                .GlobalWorkerOptions
                .workerSrc =
                  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


              resolve(
                window.pdfjsLib
              );

            };


          script.onerror =
            () =>
              reject(
                new Error(
                  "PDF.jsの読み込みに失敗しました。"
                )
              );


          document.head.appendChild(
            script
          );

        }
      );


    return pdfJsPromise;

  }


  async function convertPdfToPages(
    file
  ) {

    const pdfjs =
      await loadPdfJs();


    const buffer =
      await file.arrayBuffer();


    const pdf =
      await pdfjs
        .getDocument({
          data:
            buffer
        })
        .promise;


    const result =
      [];


    for (
      let i = 1;
      i <= pdf.numPages;
      i++
    ) {

      const page =
        await pdf.getPage(
          i
        );


      const base =
        page.getViewport({
          scale:1
        });


      /*
        最大3500px程度。
        原画像はここで無駄に巨大化しない。
      */

      const scale =
        Math.min(
          3,
          Math.max(
            1,
            3500 /
            Math.max(
              base.width,
              base.height
            )
          )
        );


      const viewport =
        page.getViewport({
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


      await page.render({

        canvasContext:
          canvas.getContext(
            "2d"
          ),

        viewport

      }).promise;


      result.push({

        sourceName:
          file.name,

        pageNo:
          i,

        canvas,

        width:
          canvas.width,

        height:
          canvas.height

      });

    }


    return result;

  }


  /* =======================================================
     Image
  ======================================================= */

  async function convertImageToPage(
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

        sourceName:
          file.name,

        pageNo:
          1,

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


  /* =======================================================
     QR.js
  ======================================================= */

  function loadJsQR() {

    if (
      jsQrPromise
    ) {

      return jsQrPromise;

    }


    jsQrPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {

          if (
            window.jsQR
          ) {

            resolve(
              window.jsQR
            );

            return;

          }


          const script =
            document.createElement(
              "script"
            );


          script.src =
            "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";


          script.onload =
            () => {

              if (
                window.jsQR
              ) {

                resolve(
                  window.jsQR
                );

              } else {

                reject(
                  new Error(
                    "QRライブラリを読み込めませんでした。"
                  )
                );

              }

            };


          script.onerror =
            () =>
              reject(
                new Error(
                  "QRライブラリの読み込みに失敗しました。"
                )
              );


          document.head.appendChild(
            script
          );

        }
      );


    return jsQrPromise;

  }


  /* =======================================================
     Crop
  ======================================================= */

  function cropCanvas(
    source,
    rect
  ) {

    const x =
      Math.max(
        0,
        Math.floor(
          rect.x
        )
      );


    const y =
      Math.max(
        0,
        Math.floor(
          rect.y
        )
      );


    const width =
      Math.min(
        source.width -
          x,
        Math.floor(
          rect.width
        )
      );


    const height =
      Math.min(
        source.height -
          y,
        Math.floor(
          rect.height
        )
      );


    if (
      width <= 0 ||
      height <= 0
    ) {

      return null;

    }


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;


    canvas.height =
      height;


    canvas
      .getContext(
        "2d"
      )
      .drawImage(

        source,

        x,
        y,
        width,
        height,

        0,
        0,
        width,
        height

      );


    return canvas;

  }


  /* =======================================================
     Canvas Blob
  ======================================================= */

  function canvasToBlob(
    canvas,
    type
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
                  "画像を作成できませんでした。"
                )
              );

              return;

            }


            resolve(
              blob
            );

          },
          type,
          .95
        );

      }
    );

  }


  /* =======================================================
     Image
  ======================================================= */

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


  /* =======================================================
     Helpers
  ======================================================= */

  function getExtension(
    value
  ) {

    const clean =
      String(
        value ||
        ""
      )
        .split("?")[0]
        .split("#")[0];


    const parts =
      clean.split(".");


    if (
      parts.length < 2
    ) {

      return "";

    }


    return parts
      .pop()
      .toLowerCase();

  }


  function guessMimeType(
    fileName
  ) {

    const ext =
      getExtension(
        fileName
      );


    if (
      ext === "pdf"
    ) {

      return "application/pdf";

    }


    if (
      ext === "jpg" ||
      ext === "jpeg"
    ) {

      return "image/jpeg";

    }


    if (
      ext === "png"
    ) {

      return "image/png";

    }


    if (
      ext === "webp"
    ) {

      return "image/webp";

    }


    return "application/octet-stream";

  }


  function formatFileSize(
    bytes
  ) {

    if (
      bytes < 1024
    ) {

      return `${bytes} B`;

    }


    if (
      bytes < 1024 * 1024
    ) {

      return `${(
        bytes /
        1024
      ).toFixed(1)} KB`;

    }


    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`;

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


  /* =======================================================
     Progress
  ======================================================= */

  function showProgress(
    percent,
    text
  ) {

    if (
      progressWrap
    ) {

      progressWrap.style.display =
        "block";

    }


    const value =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            percent
          ) || 0
        )
      );


    if (
      progressValue
    ) {

      progressValue.style.width =
        `${value}%`;

    }


    if (
      progressText
    ) {

      progressText.textContent =
        text ||
        `${Math.round(
          value
        )}%`;

    }

  }


  /* =======================================================
     Message
  ======================================================= */

  function showMessage(
    message,
    error
  ) {

    if (!messageElement) {

      alert(
        message
      );

      return;

    }


    messageElement.style.display =
      "block";


    messageElement.className =
      error
        ? "message error"
        : "message success";


    messageElement.textContent =
      message;

  }


  function clearMessage() {

    if (!messageElement) {

      return;

    }


    messageElement.style.display =
      "none";


    messageElement.textContent =
      "";

  }


  /* =======================================================
     Clear
  ======================================================= */

  function clearFiles() {

    selectedFiles =
      [];


    renderSelectedFiles();

    updateUploadButton();


    if (
      progressWrap
    ) {

      progressWrap.style.display =
        "none";

    }

  }


  /* =======================================================
     START
  ======================================================= */

  initialize();

})();
