
/* =========================================================
   テスト成績システム
   答案アップロード

   使用ファイル:
     js/teacher/answer-upload.js

   ページ構造:
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

    return document.getElementById(
      "uploadButton"
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


      const teacherName =
        document.getElementById(
          "teacherName"
        );


      if (teacherName) {

        teacherName.textContent =
          profile.name ||
          "先生";

      }


      setupEvents();


      await loadTests();


    } catch (error) {

      console.error(
        "answer upload initialize:",
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
     イベント
  ======================================================= */

  function setupEvents() {

    const filesElement =
      getFilesElement();


    const uploadButton =
      getUploadButton();


    const clearButton =
      getClearButton();


    filesElement?.addEventListener(
      "change",
      event => {

        addFiles(
          event.target.files
        );


        /*
         * 同じファイルを再選択可能にする。
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
     ファイル追加
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
     ファイル一覧
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
          "8px 0";


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
     テスト
  ======================================================= */

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

      console.error(
        error
      );


      showMessage(
        "テスト一覧を取得できませんでした。",
        true
      );


      return;

    }


    tests =
      data || [];


    const select =
      getTestElement();


    if (!select) {

      throw new Error(
        "テスト選択欄が見つかりません。"
      );

    }


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
      ]
        .filter(
          value =>
            value !== null &&
            value !== undefined &&
            String(
              value
            ).trim() !== ""
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
     アップロード
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


    if (button) {

      button.disabled =
        true;

      button.dataset.originalText =
        button.textContent;

      button.textContent =
        "処理中...";

    }


    clearUploadList();


    try {

      for (
        const file
        of selectedFiles
      ) {

        await processInputFile(
          testId,
          file
        );

      }


      showMessage(
        "答案の処理が完了しました。"
      );


      selectedFiles =
        [];


      renderFileList();


    } catch (error) {

      console.error(
        "answer upload:",
        error
      );


      showMessage(
        error.message ||
        "答案の処理に失敗しました。",
        true
      );

    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          button.dataset.originalText ||
          "アップロード";

      }

    }

  }


  /* =======================================================
     1ファイル
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
        "解析中..."
      );


      const pages =
        await parseFile(
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
       * QR単位で答案を分割。
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


  /* =======================================================
     FILE PARSER
  ======================================================= */

  async function parseFile(
    file
  ) {

    /*
     * 既存file-parserを優先。
     */

    if (
      window.TEST_SCORE_FILES &&
      typeof
        window.TEST_SCORE_FILES.parseFile ===
        "function"
    ) {

      return window.TEST_SCORE_FILES
        .parseFile(
          file
        );

    }


    /*
     * フォールバック。
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
     QR単位でグループ化
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

      const qr =
        await readQRCode(
          page.blob
        );


      /*
       * QRがある
       * ↓
       * 新しい答案
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
       * 最初のページに
       * QRがない場合
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
       * 現在の答案へ追加
       */

      currentGroup.pages.push(
        page
      );

    }


    return groups;

  }


  /* =======================================================
     答案保存
  ======================================================= */

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
     * answer_sheets
     */

    const answer =
      await createAnswerSheet(
        testId,
        student,
        group.qrValue
      );


    /*
     * ページ保存
     */

    for (
      let index = 0;
      index <
      group.pages.length;
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
     * QRから生徒を特定
     */

    if (student) {

      await updateAnswerStudent(
        answer.id,
        student.id,
        group.qrValue
      );

    }


    /*
     * 表示
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
     生徒検索
  ======================================================= */

  async function findStudentByQr(
    qrValue
  ) {

    if (!qrValue) {

      return null;

    }


    const prefix =
      "STUDENT:";


    /*
     * 現在のQR仕様:
     *
     * STUDENT:424990
     */

    if (
      qrValue.startsWith(
        prefix
      )
    ) {

      const studentNo =
        qrValue
          .substring(
            prefix.length
          )
          .trim();


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


    /*
     * JSON形式
     */

    let value =
      qrValue;


    try {

      const json =
        JSON.parse(
          qrValue
        );


      value =
        json.student_no ||
        json.studentNo ||
        json.student_id ||
        json.studentId ||
        json.id ||
        qrValue;

    } catch (_) {}


    /*
     * 生徒番号で検索
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
            value
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
     answer_sheets
  ======================================================= */

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


    /*
     * 元のanswer-upload.js仕様を維持。
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


  /* =======================================================
     answer_sheet_pages
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


  /* =======================================================
     生徒紐付け
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
     * 通常読み取り
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

      return result.data;

    }


    /*
     * 二値化して再試行
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


    return result?.data ||
      null;

  }


  /* =======================================================
     IMAGE LOAD
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
     UI
  ======================================================= */

  function createUploadRow(
    name
  ) {

    const container =
      getUploadListElement();


    /*
     * uploadListがない場合は
     * 画面を壊さずnullを返す。
     */

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


  /* =======================================================
     CLEAR
  ======================================================= */

  function clearFiles() {

    selectedFiles =
      [];


    renderFileList();


    if (filesElement) {

      filesElement.value =
        "";

    }


    showMessage(
      ""
    );


    const progress =
      getProgressArea();


    if (progress) {

      progress.hidden =
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
