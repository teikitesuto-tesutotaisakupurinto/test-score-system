
/* =========================================================
   テスト成績システム
   答案アップロード 完全版

   対応:
   JPG / JPEG / PNG / WEBP / GIF / BMP
   PDF
   ZIP

   処理:

   ファイル
      ↓
   PDF / ZIP / 画像をページ化
      ↓
   各ページQR探索
      ↓
   QRあり
      ↓
   新しい答案
      ↓
   QRなし
      ↓
   直前の答案の続き
      ↓
   answer_sheets
      ↓
   answer_sheet_pages

   source_page_id は使用しない。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     STATE
  ======================================================= */

  let tests = [];

  let selectedFiles = [];


  /* =======================================================
     DOM
  ======================================================= */

  function getTestElement() {

    return (
      document.getElementById("testSelect") ||
      document.getElementById("test")
    );

  }


  function getFilesElement() {

    return (
      document.getElementById("answerFiles") ||
      document.getElementById("files")
    );

  }


  function getUploadButton() {

    return (
      document.getElementById("uploadButton") ||
      document.getElementById("upload")
    );

  }


  function getClearButton() {

    return (
      document.getElementById("clearButton") ||
      document.getElementById("clear")
    );

  }


  function getMessageElement() {

    return (
      document.getElementById("message") ||
      document.getElementById("msg")
    );

  }


  function getUploadListElement() {

    return (
      document.getElementById("uploadList") ||
      document.getElementById("fileList")
    );

  }


  function getProgressArea() {

    return document.getElementById(
      "progressArea"
    );

  }


  function getProgressBar() {

    return document.getElementById(
      "progressBar"
    );

  }


  function getProgressText() {

    return document.getElementById(
      "progressText"
    );

  }


  /* =======================================================
     初期化
  ======================================================= */

  async function initialize() {

    try {

      /*
       * 認証
       */

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


      /*
       * 先生名
       */

      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      /*
       * イベント
       */

      setupEvents();


      /*
       * テスト一覧
       */

      await loadTests();


    } catch (error) {

      console.error(
        "answer-upload initialize:",
        error
      );


      showMessage(
        error.message ||
        "答案アップロード画面の初期化に失敗しました。",
        true
      );

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  function setupEvents() {

    const filesElement =
      getFilesElement();


    const uploadButton =
      getUploadButton();


    const clearButton =
      getClearButton();


    /*
     * ファイル選択
     */

    filesElement?.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );


        /*
         * 同じファイルを再選択可能
         */

        event.target.value =
          "";

      }
    );


    /*
     * アップロード
     */

    uploadButton?.addEventListener(
      "click",
      uploadAnswers
    );


    /*
     * クリア
     */

    clearButton?.addEventListener(
      "click",
      clearFiles
    );


    /*
     * ログアウト
     */

    document
      .getElementById(
        "logoutButton"
      )
      ?.addEventListener(
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


  /* =======================================================
     TESTS
  ======================================================= */

  async function loadTests() {

    const select =
      getTestElement();


    if (!select) {

      throw new Error(
        "テスト選択欄が見つかりません。"
      );

    }


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
          created_at
        `)
        .order(
          "created_at",
          {
            ascending: false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data || [];


    select.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

    `;


    for (
      const test
      of tests
    ) {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        test.id;


      const parts = [
        test.name,
        test.subject,
        test.grade
      ].filter(
        value =>
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
      );


      option.textContent =
        parts.join(
          " / "
        );


      select.appendChild(
        option
      );

    }

  }


  /* =======================================================
     FILES
  ======================================================= */

  function addFiles(
    files
  ) {

    const allowed =
      new Set([
        "jpg",
        "jpeg",
        "png",
        "webp",
        "gif",
        "bmp",
        "pdf",
        "zip"
      ]);


    for (
      const file
      of Array.from(
        files || []
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

        showMessage(
          `${file.name} は対応していない形式です。`,
          true
        );

        continue;

      }


      const exists =
        selectedFiles.some(
          item =>
            item.name ===
              file.name &&
            item.size ===
              file.size &&
            item.lastModified ===
              file.lastModified
        );


      if (!exists) {

        selectedFiles.push(
          file
        );

      }

    }


    renderFileList();

  }


  /* =======================================================
     FILE LIST
  ======================================================= */

  function renderFileList() {

    const container =
      getUploadListElement();


    if (!container) {

      return;

    }


    if (!selectedFiles.length) {

      container.hidden =
        true;

      container.innerHTML =
        "";

      return;

    }


    container.hidden =
      false;


    container.innerHTML =
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


        row.style.padding =
          "10px 0";


        row.style.borderBottom =
          "1px solid #d0d6dc";


        const line =
          document.createElement(
            "div"
          );


        line.style.display =
          "flex";


        line.style.alignItems =
          "center";


        line.style.justifyContent =
          "space-between";


        line.style.gap =
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


        line.appendChild(
          name
        );


        line.appendChild(
          remove
        );


        row.appendChild(
          line
        );


        container.appendChild(
          row
        );

      }
    );

  }


  /* =======================================================
     UPLOAD
  ======================================================= */

  async function uploadAnswers() {

    const testElement =
      getTestElement();


    const testId =
      testElement?.value ||
      "";


    if (!testId) {

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


    const button =
      getUploadButton();


    setBusy(
      true
    );


    clearUploadList();


    try {

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


        await processInputFile(
          testId,
          file
        );

      }


      setProgress(
        100,
        "すべての答案処理が完了しました。"
      );


      showMessage(
        `${total}件の答案処理が完了しました。`
      );


      selectedFiles =
        [];


      renderFileList();


    } catch (error) {

      console.error(
        "ANSWER UPLOAD ERROR:",
        error
      );


      showMessage(
        error.message ||
        "答案の処理に失敗しました。",
        true
      );

    } finally {

      setBusy(
        false
      );

    }

  }


  /* =======================================================
     ONE FILE
  ======================================================= */

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
        "ファイルを解析しています..."
      );


      /*
       * ページ化
       */

      const pages =
        await parseFile(
          file
        );


      if (
        !pages ||
        !pages.length
      ) {

        throw new Error(
          `${file.name} からページを取得できませんでした。`
        );

      }


      setRowStatus(
        row,
        `${pages.length}ページ検出`
      );


      /*
       * QR単位で答案に分割
       */

      const groups =
        await groupPagesByQr(
          pages
        );


      if (!groups.length) {

        throw new Error(
          "答案グループを作成できませんでした。"
        );

      }


      setRowStatus(
        row,
        `${groups.length}答案を検出`
      );


      /*
       * 各答案を保存
       */

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


      /*
       * 1ファイルの失敗を
       * 他ファイルまで巻き込まない。
       */

    }

  }


  /* =======================================================
     PARSER
  ======================================================= */

  async function parseFile(
    file
  ) {

    /*
     * 既存file-parserがある場合は
     * それを優先。
     */

    if (
      window.TEST_SCORE_FILES &&
      typeof window.TEST_SCORE_FILES.parseFile ===
        "function"
    ) {

      const result =
        await window.TEST_SCORE_FILES.parseFile(
          file
        );


      return normalizeParsedPages(
        result
      );

    }


    /*
     * フォールバック
     */

    const extension =
      getExtension(
        file.name
      );


    if (
      extension ===
      "pdf"
    ) {

      return parsePdf(
        file
      );

    }


    if (
      extension ===
      "zip"
    ) {

      return parseZip(
        file
      );

    }


    return [
      await parseImage(
        file
      )
    ];

  }


  /* =======================================================
     PARSER RESULT NORMALIZE
  ======================================================= */

  function normalizeParsedPages(
    pages
  ) {

    if (!Array.isArray(pages)) {

      return [];

    }


    return pages.map(
      page => ({

        blob:
          page.blob,

        name:
          page.name ||
          "page",

        fileType:
          page.fileType ||
          page.type ||
          "image/png",

        width:
          Number(
            page.width ||
            page.width_px ||
            0
          ),

        height:
          Number(
            page.height ||
            page.height_px ||
            0
          )

      })
    );

  }


  /* =======================================================
     PDF
  ======================================================= */

  async function parsePdf(
    file
  ) {

    if (
      typeof pdfjsLib ===
      "undefined"
    ) {

      throw new Error(
        "PDF処理ライブラリが読み込まれていません。"
      );

    }


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


      /*
       * 枠座標を元画像に近い
       * 高解像度で扱う。
       */

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


      const blob =
        await canvasToBlob(
          canvas
        );


      pages.push({

        blob,

        name:
          `${file.name} - page ${number}`,

        fileType:
          "image/png",

        width:
          canvas.width,

        height:
          canvas.height

      });

    }


    return pages;

  }


  /* =======================================================
     ZIP
  ======================================================= */

  async function parseZip(
    file
  ) {

    if (
      typeof JSZip ===
      "undefined"
    ) {

      throw new Error(
        "ZIP処理ライブラリが読み込まれていません。"
      );

    }


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
            [
              blob
            ],
            entry.name,
            {
              type:
                "application/pdf"
            }
          );


        pages.push(
          ...await parsePdf(
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
          "webp",
          "gif",
          "bmp"
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
            [
              blob
            ],
            entry.name
          );


        pages.push(
          await parseImage(
            imageFile
          )
        );

      }

    }


    return pages;

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  async function parseImage(
    file
  ) {

    const image =
      await loadImage(
        file
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


    const blob =
      await canvasToBlob(
        canvas
      );


    return {

      blob,

      name:
        file.name,

      fileType:
        "image/png",

      width:
        canvas.width,

      height:
        canvas.height

    };

  }


  /* =======================================================
     QR GROUP
  ======================================================= */

  async function groupPagesByQr(
    pages
  ) {

    const groups =
      [];


    let currentGroup =
      null;


    for (
      const page
      of pages
    ) {

      /*
       * QR探索
       */

      const qr =
        await readQRCode(
          page.blob
        );


      /*
       * QRがある
       *
       * → 新しい答案開始
       */

      if (qr) {

        currentGroup = {

          qrValue:
            qr,

          pages:
            []

        };


        groups.push(
          currentGroup
        );

      }


      /*
       * QRがない最初のページ
       *
       * → 未紐付け答案として
       *   独立グループにする。
       */

      if (!currentGroup) {

        currentGroup = {

          qrValue:
            null,

          pages:
            []

        };


        groups.push(
          currentGroup
        );

      }


      /*
       * 現在の答案にページ追加
       */

      currentGroup.pages.push(
        page
      );

    }


    return groups;

  }


  /* =======================================================
     SAVE ANSWER GROUP
  ======================================================= */

  async function saveAnswerGroup(
    testId,
    group,
    row
  ) {

    /*
     * QR → 生徒
     */

    const student =
      group.qrValue
        ? await findStudentByQr(
            group.qrValue
          )
        : null;


    /*
     * answer_sheets作成
     *
     * 現在のDB定義に合わせる。
     */

    const answer =
      await createAnswerSheet(
        testId,
        student,
        group.qrValue
      );


    /*
     * ページをStorageへ保存
     */

    for (
      let index = 0;
      index < group.pages.length;
      index++
    ) {

      const page =
        group.pages[index];


      const pageNo =
        index + 1;


      const path =
        `${testId}/${answer.id}/page-${String(
          pageNo
        ).padStart(
          3,
          "0"
        )}.png`;


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

        /*
         * DBにゴミを残さない。
         */

        await deleteAnswerSheet(
          answer.id
        );


        throw uploadError;

      }


      /*
       * answer_sheet_pages
       */

      try {

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

      } catch (error) {

        /*
         * ページ登録に失敗したら
         * 答案自体を削除。
         */

        await deleteAnswerSheet(
          answer.id
        );


        throw error;

      }

    }


    /*
     * 生徒
     */

    if (student) {

      await updateAnswerStudent(
        answer.id,
        student.id,
        group.qrValue
      );

    }


    /*
     * UI
     */

    if (row) {

      const label =
        student
          ? `${student.student_no || ""} ${student.name || ""}`.trim()
          : "未紐付け";


      addDetailStatus(
        row,
        label
      );

    }

  }


  /* =======================================================
     ANSWER SHEET
  ======================================================= */

  async function createAnswerSheet(
    testId,
    student,
    qrValue
  ) {

    /*
     * 現在のDB:
     *
     * answer_sheets
     *   id
     *   test_id
     *   student_id
     *   qr_token
     *   file_path
     *   status
     *   uploaded_at
     *
     * qr_value等は使わない。
     */

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

          qr_token:
            qrValue ||
            null,

          /*
           * 最初のページのStorageパス。
           * ページ保存前でもDBのNOT NULLを
           * 満たすために先に確定させる。
           */

          file_path:
            `${testId}/pending/page-001.png`,

          status:
            student
              ? "matched"
              : "unmatched"

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


  /* =======================================================
     ANSWER PAGE
  ======================================================= */

  async function saveAnswerPage({
    answerSheetId,
    pageNo,
    storagePath,
    originalName,
    fileType,
    width,
    height
  }) {

    /*
     * 先ほど確認した
     * answer_sheet_pagesの列を使用。
     */

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


    /*
     * 1ページ目なら
     * answer_sheets.file_pathも
     * 実際のStorageパスへ更新。
     */

    if (
      Number(pageNo) ===
      1
    ) {

      const {
        error:
          updateError
      } =
        await supabaseClient
          .from(
            "answer_sheets"
          )
          .update({

            file_path:
              storagePath

          })
          .eq(
            "id",
            answerSheetId
          );


      if (updateError) {

        throw updateError;

      }

    }

  }


  /* =======================================================
     STUDENT
  ======================================================= */

  async function findStudentByQr(
    qrValue
  ) {

    if (!qrValue) {

      return null;

    }


    let studentNo =
      null;


    /*
     * 現行QR:
     *
     * STUDENT:424990
     */

    const prefix =
      "STUDENT:";


    if (
      qrValue
        .toUpperCase()
        .startsWith(
          prefix
        )
    ) {

      studentNo =
        qrValue
          .substring(
            prefix.length
          )
          .trim();

    }


    /*
     * JSON
     */

    if (!studentNo) {

      try {

        const json =
          JSON.parse(
            qrValue
          );


        studentNo =
          json.student_no ||
          json.studentNo ||
          null;

      } catch (_) {}

    }


    /*
     * URL
     */

    if (!studentNo) {

      try {

        const url =
          new URL(
            qrValue
          );


        studentNo =
          url.searchParams.get(
            "student_no"
          ) ||
          url.searchParams.get(
            "studentNo"
          );

      } catch (_) {}

    }


    /*
     * 生徒番号が取れなければ
     * UUIDとして検索
     */

    if (!studentNo) {

      const {
        data,
        error
      } =
        await supabaseClient
          .from(
            "students"
          )
          .select(
            `
            id,
            student_no,
            name
            `
          )
          .eq(
            "id",
            qrValue
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


    /*
     * 生徒番号検索
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "students"
        )
        .select(
          `
          id,
          student_no,
          name
          `
        )
        .eq(
          "student_no",
          String(
            studentNo
          ).trim()
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
     STUDENT UPDATE
  ======================================================= */

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

          qr_token:
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


  /* =======================================================
     DELETE FAILED ANSWER
  ======================================================= */

  async function deleteAnswerSheet(
    answerId
  ) {

    /*
     * StorageはDB削除だけでは
     * 消えないので、まずページ一覧を取得。
     */

    const {
      data: pages
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(
          "file_path"
        )
        .eq(
          "answer_sheet_id",
          answerId
        );


    if (
      pages &&
      pages.length
    ) {

      const paths =
        pages
          .map(
            page =>
              page.file_path
          )
          .filter(Boolean);


      if (paths.length) {

        await supabaseClient
          .storage
          .from(
            "answer-files"
          )
          .remove(
            paths
          );

      }

    }


    /*
     * answer_sheet_pages
     */

    await supabaseClient
      .from(
        "answer_sheet_pages"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerId
      );


    /*
     * answer_sheets
     */

    await supabaseClient
      .from(
        "answer_sheets"
      )
      .delete()
      .eq(
        "id",
        answerId
      );

  }


  /* =======================================================
     QR
  ======================================================= */

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


    /*
     * 通常
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


    if (
      result?.data
    ) {

      return result.data.trim();

    }


    /*
     * 二値化
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


    result =
      jsQR(
        data,
        width,
        height,
        {
          inversionAttempts:
            "attemptBoth"
        }
      );


    return result?.data
      ? result.data.trim()
      : null;

  }


  /* =======================================================
     IMAGE
  ======================================================= */

  function loadImage(
    source
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const image =
          new Image();


        const url =
          source instanceof Blob
            ? URL.createObjectURL(
                source
              )
            : source;


        image.onload =
          () => {

            if (
              source instanceof Blob
            ) {

              URL.revokeObjectURL(
                url
              );

            }


            resolve(
              image
            );

          };


        image.onerror =
          () => {

            if (
              source instanceof Blob
            ) {

              URL.revokeObjectURL(
                url
              );

            }


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


  /* =======================================================
     CANVAS → BLOB
  ======================================================= */

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


  /* =======================================================
     UI
  ======================================================= */

  function createUploadRow(
    name
  ) {

    const container =
      getUploadListElement();


    if (!container) {

      return null;

    }


    container.hidden =
      false;


    const row =
      document.createElement(
        "div"
      );


    row.style.padding =
      "10px 0";


    row.style.borderBottom =
      "1px solid #d0d6dc";


    row.innerHTML = `

      <strong>
        ${escapeHtml(name)}
      </strong>

      <span
        class="upload-status"
        style="
          margin-left:12px;
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
      ></div>

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

    if (!row) {

      return;

    }


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
        ? "#b42318"
        : "#16834b";

  }


  function addDetailStatus(
    row,
    text
  ) {

    if (!row) {

      return;

    }


    const detail =
      row.querySelector(
        ".upload-detail"
      );


    if (!detail) {

      return;

    }


    const line =
      document.createElement(
        "div"
      );


    line.textContent =
      text;


    detail.appendChild(
      line
    );

  }


  function clearUploadList() {

    const container =
      getUploadListElement();


    if (!container) {

      return;

    }


    container.innerHTML =
      "";


    container.hidden =
      true;

  }


  function showMessage(
    text,
    error = false
  ) {

    const element =
      getMessageElement();


    if (!element) {

      return;

    }


    element.textContent =
      text;


    element.className =
      error
        ? "small error"
        : "small";

  }


  function setProgress(
    value,
    text
  ) {

    const area =
      getProgressArea();


    const bar =
      getProgressBar();


    const label =
      getProgressText();


    if (area) {

      area.hidden =
        false;

    }


    if (bar) {

      const safe =
        Math.max(
          0,
          Math.min(
            100,
            value
          )
        );


      bar.style.width =
        `${safe}%`;

    }


    if (label) {

      label.textContent =
        text ||
        "";

    }

  }


  function setBusy(
    busy
  ) {

    const button =
      getUploadButton();


    const clear =
      getClearButton();


    const files =
      getFilesElement();


    const test =
      getTestElement();


    if (button) {

      if (
        !button.dataset.originalText
      ) {

        button.dataset.originalText =
          button.textContent;

      }


      button.disabled =
        busy;


      button.textContent =
        busy
          ? "処理中..."
          : button.dataset.originalText;

    }


    if (clear) {

      clear.disabled =
        busy;

    }


    if (files) {

      files.disabled =
        busy;

    }


    if (test) {

      test.disabled =
        busy;

    }

  }


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearFiles() {

    selectedFiles =
      [];


    renderFileList();


    const files =
      getFilesElement();


    if (files) {

      files.value =
        "";

    }


    showMessage(
      ""
    );


    const area =
      getProgressArea();


    if (area) {

      area.hidden =
        true;

    }


    const bar =
      getProgressBar();


    if (bar) {

      bar.style.width =
        "0%";

    }


    const text =
      getProgressText();


    if (text) {

      text.textContent =
        "待機中";

    }


    clearUploadList();

  }


  /* =======================================================
     HELPERS
  ======================================================= */

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
     START
  ======================================================= */

  initialize();

})();
