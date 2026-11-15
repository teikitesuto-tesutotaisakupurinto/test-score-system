
/* =========================================================
   テスト成績システム
   答案確認・紐付け

   仕様
   ---------------------------------------------------------
   QR自動紐付け
       ↓
   answer_sheets.student_id
       ↓
   status = uploaded

   QRで特定できない
       ↓
   status = unmatched
       ↓
   この画面で手動紐付け

   重要
   ---------------------------------------------------------
   ・別生徒へ勝手に紐付けない
   ・手動紐付けは先生が明示的に実行
   ・紐付け後に自動クロップを再実行
========================================================= */

(function () {

  "use strict";


  let tests = [];

  let students = [];

  let answers = [];

  let selectedTestId = null;

  let selectedStatus = "all";


  const testSelect =
    document.getElementById(
      "testSelect"
    );


  const statusSelect =
    document.getElementById(
      "statusSelect"
    );


  const reloadButton =
    document.getElementById(
      "reloadButton"
    );


  const tableBody =
    document.getElementById(
      "answerTableBody"
    );


  const statusElement =
    document.getElementById(
      "status"
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


      document.getElementById(
        "teacherName"
      ).textContent =
        profile.name ||
        "先生";


      await loadTests();

      await loadStudents();

      setupEvents();

    } catch (error) {

      console.error(
        "matched initialize:",
        error
      );


      showError(
        error.message ||
        "答案確認画面を読み込めませんでした。"
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
          name
        `)
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      throw error;

    }


    tests =
      data || [];


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

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =======================================================
     Students
  ======================================================= */

  async function loadStudents() {

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


    students =
      data || [];

  }


  /* =======================================================
     Events
  ======================================================= */

  function setupEvents() {

    testSelect.addEventListener(
      "change",
      async () => {

        selectedTestId =
          testSelect.value ||
          null;

        await loadAnswers();

      }
    );


    statusSelect.addEventListener(
      "change",
      async () => {

        selectedStatus =
          statusSelect.value ||
          "all";

        renderAnswers();

      }
    );


    reloadButton.addEventListener(
      "click",
      async () => {

        await loadAnswers();

      }
    );


    document.getElementById(
      "logoutButton"
    ).addEventListener(
      "click",
      logout
    );

  }


  /* =======================================================
     Answers
  ======================================================= */

  async function loadAnswers() {

    if (!selectedTestId) {

      answers =
        [];

      renderAnswers();

      statusElement.textContent =
        "テストを選択してください。";

      return;

    }


    statusElement.textContent =
      "答案を読み込んでいます...";


    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          test_id,
          student_id,
          status,
          created_at
        `)
        .eq(
          "test_id",
          selectedTestId
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        );


    if (error) {

      throw error;

    }


    answers =
      data || [];


    /*
      Student情報をまとめて取得。
    */

    const studentIds =
      [
        ...new Set(
          answers
            .map(
              answer =>
                answer.student_id
            )
            .filter(
              Boolean
            )
        )
      ];


    if (
      studentIds.length
    ) {

      const {
        data:
          studentData,
        error:
          studentError
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
          .in(
            "id",
            studentIds
          );


      if (studentError) {

        throw studentError;

      }


      const map =
        new Map(
          (
            studentData ||
            []
          ).map(
            student => [
              student.id,
              student
            ]
          )
        );


      answers =
        answers.map(
          answer => ({

            ...answer,

            student:
              map.get(
                answer.student_id
              ) ||
              null

          })
        );

    }


    /*
      QRログがDBに保存されていない構成でも
      答案は表示可能。
    */

    renderAnswers();


    statusElement.textContent =
      `${answers.length}件の答案があります。`;

  }


  /* =======================================================
     Filter
  ======================================================= */

  function getFilteredAnswers() {

    if (
      selectedStatus ===
      "all"
    ) {

      return answers;

    }


    return answers.filter(
      answer =>
        answer.status ===
        selectedStatus
    );

  }


  /* =======================================================
     Render
  ======================================================= */

  function renderAnswers() {

    if (!tableBody) {

      return;

    }


    const filtered =
      getFilteredAnswers();


    if (!filtered.length) {

      tableBody.innerHTML = `

        <tr>

          <td
            colspan="7"
            class="empty"
          >

            該当する答案はありません。

          </td>

        </tr>

      `;

      return;

    }


    tableBody.innerHTML =
      filtered
        .map(
          answer =>
            createRow(
              answer
            )
        )
        .join("");


    /*
      イベント
    */

    tableBody
      .querySelectorAll(
        "[data-match]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const id =
                button.dataset.match;


              await openMatchDialog(
                id
              );

            }
          );

        }
      );


    tableBody
      .querySelectorAll(
        "[data-unmatch]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const id =
                button.dataset.unmatch;


              await unmatchAnswer(
                id
              );

            }
          );

        }
      );

  }


  /* =======================================================
     Row
  ======================================================= */

  function createRow(
    answer
  ) {

    const matched =
      Boolean(
        answer.student
      ) &&
      answer.status !==
        "unmatched";


    const statusHtml =
      matched

        ? `
          <span
            class="status-badge status-matched"
          >
            紐付け済み
          </span>
        `

        : `
          <span
            class="status-badge status-unmatched"
          >
            未紐付け
          </span>
        `;


    const studentNo =
      answer.student
        ?.student_no ||
      "-";


    const studentName =
      answer.student
        ?.name ||
      "-";


    return `

      <tr>

        <td>
          ${statusHtml}
        </td>


        <td>
          ${escapeHtml(
            studentNo
          )}
        </td>


        <td>
          ${escapeHtml(
            studentName
          )}
        </td>


        <td>

          <div class="qr-value">
            -
          </div>

        </td>


        <td>

          <code>
            ${escapeHtml(
              answer.id
            )}
          </code>

        </td>


        <td>
          ${escapeHtml(
            formatDate(
              answer.created_at
            )
          )}
        </td>


        <td>

          <div class="actions">

            ${
              matched

                ? `

                  <button
                    type="button"
                    class="btn"
                    data-unmatch="${escapeHtml(
                      answer.id
                    )}"
                  >
                    紐付け解除
                  </button>

                `

                : `

                  <button
                    type="button"
                    class="btn btn-primary"
                    data-match="${escapeHtml(
                      answer.id
                    )}"
                  >
                    生徒を紐付け
                  </button>

                `
            }

          </div>

        </td>

      </tr>

    `;

  }


  /* =======================================================
     Manual Match
  ======================================================= */

  async function openMatchDialog(
    answerId
  ) {

    const answer =
      answers.find(
        item =>
          item.id ===
          answerId
      );


    if (!answer) {

      return;

    }


    /*
      selectをpromptで作らず、
      先生が6桁番号を入力して
      生徒を確定する。
    */

    const studentNo =
      window.prompt(
        "紐付ける生徒の6桁生徒番号を入力してください。"
      );


    if (
      studentNo ===
      null
    ) {

      return;

    }


    const clean =
      studentNo.trim();


    if (
      !/^[0-9]{6}$/.test(
        clean
      )
    ) {

      alert(
        "6桁の生徒番号を入力してください。"
      );

      return;

    }


    const student =
      students.find(
        item =>
          item.student_no ===
          clean
      );


    if (!student) {

      alert(
        "該当する生徒が見つかりません。"
      );

      return;

    }


    const confirmed =
      window.confirm(
        `生徒番号 ${student.student_no} / ${student.name} に紐付けますか？`
      );


    if (!confirmed) {

      return;

    }


    await matchAnswer(
      answerId,
      student.id
    );

  }


  /* =======================================================
     Match
  ======================================================= */

  async function matchAnswer(
    answerId,
    studentId
  ) {

    /*
      生徒変更
    */

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

          status:
            "uploaded"

        })
        .eq(
          "id",
          answerId
        );


    if (error) {

      throw error;

    }


    /*
      既存のクロップを削除。

      生徒が変わった場合に
      古いregionを残さない。
    */

    await supabaseClient
      .from(
        "answer_regions"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerId
      );


    /*
      自動クロップ再実行
    */

    await recropAnswer(
      answerId
    );


    await loadAnswers();

  }


  /* =======================================================
     Unmatch
  ======================================================= */

  async function unmatchAnswer(
    answerId
  ) {

    const confirmed =
      window.confirm(
        "この答案の生徒紐付けを解除しますか？"
      );


    if (!confirmed) {

      return;

    }


    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .update({

          student_id:
            null,

          status:
            "unmatched"

        })
        .eq(
          "id",
          answerId
        );


    if (error) {

      throw error;

    }


    await supabaseClient
      .from(
        "answer_regions"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerId
      );


    await loadAnswers();

  }


  /* =======================================================
     Re-Crop
     
     手動紐付け後に、
     解答用紙のlayout_boxesを
     もう一度適用する。
  ======================================================= */

  async function recropAnswer(
    answerSheetId
  ) {

    /*
      答案
    */

    const {
      data:
        answer,
      error:
        answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          test_id
        `)
        .eq(
          "id",
          answerSheetId
        )
        .single();


    if (answerError) {

      throw answerError;

    }


    /*
      答案ページ
    */

    const {
      data:
        answerPages,
      error:
        pageError
    } =
      await supabaseClient
        .from(
          "answer_sheet_pages"
        )
        .select(`
          id,
          page_no,
          file_path,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          answerSheetId
        )
        .order(
          "page_no"
        );


    if (pageError) {

      throw pageError;

    }


    /*
      解答用紙
    */

    const {
      data:
        templatePages,
      error:
        templateError
    } =
      await supabaseClient
        .from(
          "test_pages"
        )
        .select(`
          id,
          page_no,
          width_px,
          height_px
        `)
        .eq(
          "test_id",
          answer.test_id
        )
        .order(
          "page_no"
        );


    if (templateError) {

      throw templateError;

    }


    /*
      枠
    */

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
          source_page_id,
          x,
          y,
          width,
          height
        `)
        .eq(
          "test_id",
          answer.test_id
        );


    if (boxError) {

      throw boxError;

    }


    /*
      既存regions削除
    */

    await supabaseClient
      .from(
        "answer_regions"
      )
      .delete()
      .eq(
        "answer_sheet_id",
        answerSheetId
      );


    /*
      各ページ
    */

    for (
      const answerPage
      of answerPages || []
    ) {

      const templatePage =
        (
          templatePages ||
          []
        ).find(
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
        (
          boxes ||
          []
        ).filter(
          box =>
            box.source_page_id ===
            templatePage.id
        );


      const {
        data:
          signed
      } =
        await supabaseClient
          .storage
          .from(
            "answer-files"
          )
          .createSignedUrl(
            answerPage.file_path,
            3600
          );


      if (!signed?.signedUrl) {

        continue;

      }


      const image =
        await loadImage(
          signed.signedUrl
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


      const scaleX =
        canvas.width /
        Number(
          templatePage.width_px
        );


      const scaleY =
        canvas.height /
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
            canvas,
            rect
          );


        if (!crop) {

          continue;

        }


        const path =
          [
            answer.test_id,
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
            insertError
        } =
          await supabaseClient
            .from(
              "answer_regions"
            )
            .insert({

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

            });


        if (insertError) {

          throw insertError;

        }

      }

    }

  }


  /* =======================================================
     Helpers
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
        source.width - x,
        Math.floor(
          rect.width
        )
      );


    const height =
      Math.min(
        source.height - y,
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
      .getContext("2d")
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
          reject;


        image.src =
          src;

      }
    );

  }


  function formatDate(
    value
  ) {

    if (!value) {

      return "-";

    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "-";

    }


    return date.toLocaleString(
      "ja-JP"
    );

  }


  function showError(
    message
  ) {

    statusElement.textContent =
      message;

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
