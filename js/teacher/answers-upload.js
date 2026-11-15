
/* =========================================================
   テスト成績システム
   答案アップロード 完全版

   対応
   ---------------------------------------------------------
   ・PDF
   ・JPG
   ・JPEG
   ・PNG
   ・WEBP
   ・ZIP
   ・複数ファイル

   ZIP
   ---------------------------------------------------------
   ZIP
     ↓
   展開
     ↓
   PDF / 画像
     ↓
   処理

   Storage
   ---------------------------------------------------------
   生徒答案:
     answer-files

   解答用紙:
     model-answers


   注意
   ---------------------------------------------------------
   PDFを画像化する場合は
   PDF.jsを使用。

   PDF.jsはこのファイル内で
   動的ロードする。


   answer_sheet_pages
   ---------------------------------------------------------
   生徒答案の場合のみ作成。

   model_answer_pages
   ---------------------------------------------------------
   解答用紙の場合に作成。


   生徒番号
   ---------------------------------------------------------
   アップロードファイル名から
   6桁生徒番号を検出する。

   例:

     123456.jpg
     123456_数学.pdf
     student_123456.zip

   ただしファイル名だけで
   生徒を確定できない場合は
   紐付けを保留する。
========================================================= */


/* =========================================================
   IIFE
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     状態
  ======================================================= */

  let tests = [];

  let selectedTestId = null;

  let selectedFiles = [];

  let isUploading = false;


  /* =======================================================
     設定
  ======================================================= */

  const MAX_FILE_SIZE =
    50 * 1024 * 1024;


  const IMAGE_EXTENSIONS = [

    "jpg",

    "jpeg",

    "png",

    "webp"

  ];


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


  const teacherName =
    document.getElementById(
      "teacherName"
    );


  /* =======================================================
     初期化
  ======================================================= */

  async function initialize() {

    try {

      const profile =
        await requireTeacher();


      if (!profile) {

        return;

      }


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      await loadTests();


      setupEvents();

    } catch (error) {

      console.error(
        "アップロード初期化:",
        error
      );


      showMessage(
        error.message ||
        "画面を読み込めませんでした。",
        true
      );

    }

  }


  /* =======================================================
     テスト一覧
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
          class_name,
          status
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
     イベント
  ======================================================= */

  function setupEvents() {

    if (testSelect) {

      testSelect.addEventListener(
        "change",
        () => {

          selectedTestId =
            testSelect.value ||
            null;


          updateUploadButton();

        }
      );

    }


    if (fileInput) {

      fileInput.addEventListener(
        "change",
        event => {

          addFiles(
            event.target.files
          );


          fileInput.value =
            "";

        }
      );

    }


    if (dropZone) {

      dropZone.addEventListener(
        "click",
        () => {

          fileInput?.click();

        }
      );


      dropZone.addEventListener(
        "dragover",
        event => {

          event.preventDefault();


          dropZone.classList.add(
            "dragover"
          );

        }
      );


      dropZone.addEventListener(
        "dragleave",
        () => {

          dropZone.classList.remove(
            "dragover"
          );

        }
      );


      dropZone.addEventListener(
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

    }


    if (clearButton) {

      clearButton.addEventListener(
        "click",
        clearFiles
      );

    }


    if (uploadButton) {

      uploadButton.addEventListener(
        "click",
        uploadFiles
      );

    }


    if (answerType) {

      answerType.addEventListener(
        "change",
        () => {

          updateUploadButton();

        }
      );

    }


    if (logoutButton) {

      logoutButton.addEventListener(
        "click",
        logout
      );

    }

  }


  /* =======================================================
     ファイル追加
  ======================================================= */

  function addFiles(
    fileList
  ) {

    if (!fileList) {

      return;

    }


    const incoming =
      Array.from(
        fileList
      );


    const validFiles =
      [];


    for (
      const file
      of incoming
    ) {

      const validation =
        validateFile(
          file
        );


      if (!validation.ok) {

        showMessage(
          `${file.name}: ${validation.message}`,
          true
        );


        continue;

      }


      validFiles.push(
        file
      );

    }


    /*
      同じファイルを二重追加しない
    */

    validFiles.forEach(
      file => {

        const exists =
          selectedFiles.some(
            existing =>
              existing.name ===
                file.name &&
              existing.size ===
                file.size &&
              existing.lastModified ===
                file.lastModified
          );


        if (!exists) {

          selectedFiles.push(
            file
          );

        }

      }
    );


    renderSelectedFiles();

    updateUploadButton();

  }


  /* =======================================================
     ファイル検証
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
     ファイル一覧表示
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
                data-remove-file="${index}"
              >
                削除
              </button>

            </div>

          `
        )
        .join("");


    selectedFilesElement
      .querySelectorAll(
        "[data-remove-file]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            event => {

              event.stopPropagation();


              const index =
                Number(
                  button.dataset.removeFile
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
     アップロードボタン
  ======================================================= */

  function updateUploadButton() {

    if (!uploadButton) {

      return;

    }


    uploadButton.disabled =
      isUploading ||
      !selectedTestId ||
      !selectedFiles.length;

  }


  /* =======================================================
     アップロード開始
  ======================================================= */

  async function uploadFiles() {

    if (isUploading) {

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
        "ファイルを選択してください。",
        true
      );


      return;

    }


    const profile =
      await requireTeacher();


    if (!profile) {

      return;

    }


    isUploading =
      true;


    updateUploadButton();


    clearMessage();


    showProgress(
      0,
      "準備中..."
    );


    try {

      /*
        全ファイルを展開・処理
      */

      const files =
        await expandZipFiles(
          selectedFiles
        );


      if (!files.length) {

        throw new Error(
          "処理できるファイルがありません。"
        );

      }


      /*
        PDF / 画像をページ化
      */

      const pages =
        await convertFilesToPages(
          files
        );


      if (!pages.length) {

        throw new Error(
          "答案ページを作成できませんでした。"
        );

      }


      /*
        保存
      */

      if (
        answerType.value ===
        "model_answer"
      ) {

        await saveModelAnswerPages(
          pages
        );

      } else {

        await saveStudentAnswerPages(
          pages
        );

      }


      showProgress(
        100,
        "完了"
      );


      showMessage(
        `${pages.length}ページをアップロードしました。`,
        false
      );


      /*
        クリア
      */

      selectedFiles =
        [];


      renderSelectedFiles();


    } catch (error) {

      console.error(
        "アップロード:",
        error
      );


      showMessage(
        error.message ||
        "アップロードに失敗しました。",
        true
      );

    } finally {

      isUploading =
        false;


      updateUploadButton();

    }

  }


  /* =======================================================
     ZIP展開
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
        extension ===
        "zip"
      ) {

        const zipFiles =
          await extractZip(
            file
          );


        result.push(
          ...zipFiles
        );

      } else {

        result.push(
          file
        );

      }

    }


    return result;

  }


  /* =======================================================
     ZIP展開
     
     JSZipを動的ロード
  ======================================================= */

  async function extractZip(
    file
  ) {

    const JSZip =
      await loadJSZip();


    const zip =
      await JSZip.loadAsync(
        file
      );


    const result =
      [];


    const entries =
      Object.values(
        zip.files
      );


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
        !ALLOWED_EXTENSIONS.includes(
          extension
        )
      ) {

        continue;

      }


      /*
        ZIP内ZIPは再帰処理しない。

        ZIP爆発を防ぐ。
      */

      if (
        extension ===
        "zip"
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


      const type =
        guessMimeType(
          fileName
        );


      result.push(
        new File(
          [
            blob
          ],
          fileName,
          {
            type
          }
        )
      );

    }


    return result;

  }


  /* =======================================================
     ZIP.js
  ======================================================= */

  let jsZipPromise =
    null;


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
            () => {

              reject(
                new Error(
                  "JSZipの読み込みに失敗しました。"
                )
              );

            };


          document.head.appendChild(
            script
          );

        }
      );


    return jsZipPromise;

  }


  /* =======================================================
     PDF / 画像 → ページ
  ======================================================= */

  async function convertFilesToPages(
    files
  ) {

    const result =
      [];


    /*
      ファイル名順

      ZIP内部も含め、
      予測可能な順序にする。
    */

    files.sort(
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


    let current =
      0;


    for (
      const file
      of files
    ) {

      const extension =
        getExtension(
          file.name
        );


      if (
        extension ===
        "pdf"
      ) {

        const pdfPages =
          await convertPdfToPages(
            file
          );


        result.push(
          ...pdfPages
        );

      } else {

        const imagePage =
          await createImagePage(
            file
          );


        result.push(
          imagePage
        );

      }


      current++;


      showProgress(

        Math.round(
          current /
          files.length *
          70
        ),

        `${current}/${files.length} ファイル処理中`

      );

    }


    return result;

  }


  /* =======================================================
     PDF → Canvasページ
  ======================================================= */

  let pdfjsPromise =
    null;


  async function loadPdfJs() {

    if (
      pdfjsPromise
    ) {

      return pdfjsPromise;

    }


    pdfjsPromise =
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
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";


          script.type =
            "module";


          /*
            moduleの場合、
            window.pdfjsLibが直接生成されないため
            通常版を使う。
          */

          script.remove();


          const classic =
            document.createElement(
              "script"
            );


          classic.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";


          classic.onload =
            () => {

              if (
                window.pdfjsLib
              ) {

                window.pdfjsLib.GlobalWorkerOptions
                  .workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


                resolve(
                  window.pdfjsLib
                );

              } else {

                reject(
                  new Error(
                    "PDF.jsを読み込めませんでした。"
                  )
                );

              }

            };


          classic.onerror =
            () => {

              reject(
                new Error(
                  "PDF.jsの読み込みに失敗しました。"
                )
              );

            };


          document.head.appendChild(
            classic
          );

        }
      );


    return pdfjsPromise;

  }


  async function convertPdfToPages(
    file
  ) {

    const pdfjs =
      await loadPdfJs();


    const buffer =
      await file.arrayBuffer();


    const pdf =
      await pdfjs.getDocument({
        data:
          buffer
      }).promise;


    const pages =
      [];


    for (
      let pageNo = 1;
      pageNo <=
        pdf.numPages;
      pageNo++
    ) {

      const page =
        await pdf.getPage(
          pageNo
        );


      const baseViewport =
        page.getViewport({
          scale:
            1
        });


      /*
        元PDFの解像度を
        できるだけ維持する。

        巨大画像化を防ぐため
        最大長辺を約3500px。
      */

      const maxDimension =
        3500;


      const baseMax =
        Math.max(
          baseViewport.width,
          baseViewport.height
        );


      const scale =
        Math.min(
          3,
          Math.max(
            1,
            maxDimension /
              baseMax
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


      const context =
        canvas.getContext(
          "2d"
        );


      await page.render({

        canvasContext:
          context,

        viewport

      }).promise;


      pages.push({

        sourceName:
          file.name,

        pageNo,

        canvas,

        width:
          canvas.width,

        height:
          canvas.height,

        fileType:
          "image/png"

      });

    }


    return pages;

  }


  /* =======================================================
     画像 → Canvas
  ======================================================= */

  async function createImagePage(
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


      const context =
        canvas.getContext(
          "2d"
        );


      context.drawImage(
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
          canvas.height,

        fileType:
          "image/png"

      };

    } finally {

      URL.revokeObjectURL(
        url
      );

    }

  }


  /* =======================================================
     Image Load
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
     生徒答案保存
  ======================================================= */

  async function saveStudentAnswerPages(
    pages
  ) {

    /*
      先生ID
    */

    const user =
      await getAuthUser();


    if (!user) {

      throw new Error(
        "ログイン情報を取得できません。"
      );

    }


    /*
      ファイルごとに答案Sheetを作る。

      生徒番号がファイル名から取れれば
      student_idを自動紐付け。

      取れない場合は
      student_id = null で保留。
    */

    const grouped =
      groupPagesBySource(
        pages
      );


    let processed =
      0;


    for (
      const group
      of grouped
    ) {

      const studentNo =
        extractStudentNumber(
          group.sourceName
        );


      const student =
        studentNo
          ? await findStudentByNumber(
              studentNo
            )
          : null;


      /*
        answer_sheet作成
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
              student?.id ||
              null,

            status:
              student
                ? "uploaded"
                : "unmatched"

          })
          .select(
            "id"
          )
          .single();


      if (answerError) {

        throw answerError;

      }


      let pageNo =
        1;


      for (
        const page
        of group.pages
      ) {

        const filePath =
          createStudentAnswerPath(

            selectedTestId,

            answerSheet.id,

            pageNo,

            group.sourceName

          );


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
              filePath,
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
          error:
            pageError
        } =
          await supabaseClient
            .from(
              "answer_sheet_pages"
            )
            .insert({

              answer_sheet_id:
                answerSheet.id,

              page_no:
                pageNo,

              file_path:
                filePath,

              file_type:
                "image/png",

              original_name:
                group.sourceName,

              width_px:
                page.width,

              height_px:
                page.height

            });


        if (pageError) {

          throw pageError;

        }


        pageNo++;


        processed++;


        showProgress(

          70 +
          Math.round(
            processed /
            pages.length *
            30
          ),

          `${processed}/${pages.length}ページ保存中`

        );

      }

    }

  }


  /* =======================================================
     解答用紙保存
  ======================================================= */

  async function saveModelAnswerPages(
    pages
  ) {

    let processed =
      0;


    const grouped =
      groupPagesBySource(
        pages
      );


    for (
      const group
      of grouped
    ) {

      let pageNo =
        1;


      for (
        const page
        of group.pages
      ) {

        const filePath =
          createModelAnswerPath(

            selectedTestId,

            pageNo,

            group.sourceName

          );


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
              "model-answers"
            )
            .upload(
              filePath,
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


        /*
          model_answer_pagesが存在する場合のみ登録。

          テーブルがない環境では
          Storage保存までで終了。
        */

        try {

          const {
            error:
              pageError
          } =
            await supabaseClient
              .from(
                "model_answer_pages"
              )
              .insert({

                test_id:
                  selectedTestId,

                page_no:
                  pageNo,

                image_path:
                  filePath,

                width_px:
                  page.width,

                height_px:
                  page.height,

                original_name:
                  group.sourceName

              });


          if (
            pageError &&
            !isMissingTableError(
              pageError
            )
          ) {

            throw pageError;

          }

        } catch (error) {

          if (
            !isMissingTableError(
              error
            )
          ) {

            throw error;

          }

        }


        pageNo++;


        processed++;


        showProgress(

          70 +
          Math.round(
            processed /
            pages.length *
            30
          ),

          `${processed}/${pages.length}ページ保存中`

        );

      }

    }

  }


  /* =======================================================
     ファイルをSource単位にまとめる
  ======================================================= */

  function groupPagesBySource(
    pages
  ) {

    const map =
      new Map();


    pages.forEach(
      page => {

        const key =
          page.sourceName;


        if (
          !map.has(
            key
          )
        ) {

          map.set(
            key,
            {

              sourceName:
                key,

              pages:
                []

            }
          );

        }


        map.get(
          key
        ).pages.push(
          page
        );

      }
    );


    return [
      ...map.values()
    ];

  }


  /* =======================================================
     生徒番号
     
     6桁コードを抽出
  ======================================================= */

  function extractStudentNumber(
    fileName
  ) {

    if (!fileName) {

      return null;

    }


    const base =
      String(
        fileName
      )
        .split(
          /[\\/]+/
        )
        .pop();


    /*
      まず独立した6桁
    */

    const matches =
      base.match(
        /(?:^|[^0-9])([0-9]{6})(?:[^0-9]|$)/g
      );


    if (
      matches &&
      matches.length
    ) {

      const match =
        matches[0].match(
          /[0-9]{6}/
        );


      if (match) {

        return match[0];

      }

    }


    /*
      ファイル名が完全に6桁の場合など
    */

    const exact =
      base.match(
        /([0-9]{6})/
      );


    return exact
      ? exact[1]
      : null;

  }


  /* =======================================================
     生徒番号検索
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

      console.error(
        "生徒番号検索:",
        error
      );


      return null;

    }


    return data || null;

  }


  /* =======================================================
     Storage Path
  ======================================================= */

  function createStudentAnswerPath(
    testId,
    answerSheetId,
    pageNo,
    sourceName
  ) {

    const safe =
      sanitizePath(
        sourceName
      );


    return [

      testId,

      answerSheetId,

      `page-${String(
        pageNo
      ).padStart(
        3,
        "0"
      )}-${safe}.png`

    ].join(
      "/"
    );

  }


  function createModelAnswerPath(
    testId,
    pageNo,
    sourceName
  ) {

    const safe =
      sanitizePath(
        sourceName
      );


    return [

      testId,

      `page-${String(
        pageNo
      ).padStart(
        3,
        "0"
      )}-${safe}.png`

    ].join(
      "/"
    );

  }


  /* =======================================================
     Canvas → Blob
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
                  "画像Blobを作成できませんでした。"
                )
              );


              return;

            }


            resolve(
              blob
            );

          },
          type,
          0.95
        );

      }
    );

  }


  /* =======================================================
     Missing Table
  ======================================================= */

  function isMissingTableError(
    error
  ) {

    if (!error) {

      return false;

    }


    const text =
      [

        error.code,

        error.message,

        error.details

      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )
        .toLowerCase();


    return (

      text.includes(
        "relation"
      ) &&
      text.includes(
        "does not exist"
      )

    ) ||

    text.includes(
      "could not find the table"
    );

  }


  /* =======================================================
     拡張子
  ======================================================= */

  function getExtension(
    value
  ) {

    if (!value) {

      return "";

    }


    const clean =
      String(
        value
      )
        .split("?")[0]
        .split("#")[0];


    const parts =
      clean.split(
        "."
      );


    if (
      parts.length <
      2
    ) {

      return "";

    }


    return parts
      .pop()
      .toLowerCase();

  }


  /* =======================================================
     MIME
  ======================================================= */

  function guessMimeType(
    fileName
  ) {

    const extension =
      getExtension(
        fileName
      );


    if (
      extension ===
      "pdf"
    ) {

      return "application/pdf";

    }


    if (
      extension ===
      "jpg" ||
      extension ===
      "jpeg"
    ) {

      return "image/jpeg";

    }


    if (
      extension ===
      "png"
    ) {

      return "image/png";

    }


    if (
      extension ===
      "webp"
    ) {

      return "image/webp";

    }


    if (
      extension ===
      "gif"
    ) {

      return "image/gif";

    }


    return "application/octet-stream";

  }


  /* =======================================================
     Path安全化
  ======================================================= */

  function sanitizePath(
    value
  ) {

    return String(
      value ||
      "file"
    )
      .replace(
        /[\\/:*?"<>|]/g,
        "_"
      )
      .replace(
        /\s+/g,
        "_"
      )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      )
      .slice(
        0,
        100
      );

  }


  /* =======================================================
     サイズ
  ======================================================= */

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


    const safePercent =
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
        `${safePercent}%`;

    }


    if (
      progressText
    ) {

      progressText.textContent =
        text ||
        `${Math.round(
          safePercent
        )}%`;

    }

  }


  /* =======================================================
     Message
  ======================================================= */

  function showMessage(
    message,
    isError
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
      isError
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

    if (isUploading) {

      return;

    }


    selectedFiles =
      [];


    renderSelectedFiles();

    updateUploadButton();

    clearMessage();


    if (
      progressWrap
    ) {

      progressWrap.style.display =
        "none";

    }

  }


  /* =======================================================
     HTML Escape
  ======================================================= */

  function escapeHtml(
    value
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    return String(
      value
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
     START
  ======================================================= */

  initialize();

})();
