"use strict";

/* =========================================================
   未紐付け答案

   ・QRが読み取れなかった答案
   ・QRは解答用紙側で設定されたQR枠のみ使用
   ・生徒を手動選択
   ・unmatched → matched
========================================================= */

let students = [];


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeUnmatched
);


async function initializeUnmatched() {

  try {

    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


    await loadStudents();

    await loadUnmatched();


  } catch (error) {

    console.error(
      "answer-unmatched:",
      error
    );


    showError(
      error.message ||
      "未紐付け答案を読み込めませんでした。"
    );

  }

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

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
        name,
        active
        `
      )
      .order(
        "student_no",
        {
          ascending: true
        }
      );


  if (error) {

    throw error;

  }


  students =
    data || [];

}


/* =========================================================
   LOAD UNMATCHED
========================================================= */

async function loadUnmatched() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        original_file_path,
        qr_value,
        status,
        created_at,
        tests(
          id,
          name,
          subject,
          grade,
          class_name
        )
        `
      )
      .or("status.eq.unmatched,student_id.is.null")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    throw error;

  }


  renderAnswers(
    data || []
  );

}


/* =========================================================
   RENDER
========================================================= */

function renderAnswers(
  answers
) {

  const container =
    document.getElementById(
      "answerList"
    );


  if (!container) {

    return;

  }


  if (!answers.length) {

    container.innerHTML = `

      <div class="card">

        <div
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >
          未紐付け答案はありません。
        </div>

      </div>

    `;

    return;

  }


  container.innerHTML =
    answers
      .map(
        answer =>
          createAnswerCard(
            answer
          )
      )
      .join("");


  answers.forEach(
    answer => {

      const button =
        document.querySelector(
          `[data-match-id="${CSS.escape(
            answer.id
          )}"]`
        );


      button?.addEventListener(
        "click",
        () =>
          matchAnswer(
            answer.id
          )
      );

    }
  );

}


/* =========================================================
   CARD
========================================================= */

function createAnswerCard(
  answer
) {

  const test =
    answer.tests ||
    {};


  return `

    <div
      class="card"
      id="answer-${escapeHtml(
        answer.id
      )}"
      style="
        margin-bottom:15px;
      "
    >

      <div
        style="
          display:grid;
          grid-template-columns:
            minmax(0,1fr)
            320px;
          gap:20px;
        "
      >

        <div>

          <h3>
            ${escapeHtml(
              test.name ||
              "テスト"
            )}
          </h3>


          <p>
            ${escapeHtml(
              [
                test.subject,
                test.grade,
                test.class_name
              ]
                .filter(Boolean)
                .join(
                  " / "
                )
            )}
          </p>


          <p>

            アップロード：
            ${formatDate(
              answer.created_at
            )}

          </p>


          <p>

            QR：

            ${
              answer.qr_value
                ? escapeHtml(
                    answer.qr_value
                  )
                : "読み取り不可"
            }

          </p>


          <p
            style="
              color:#c62828;
              font-weight:700;
            "
          >
            未紐付け
          </p>

        </div>


        <div>

          <label
            for="student-${escapeHtml(
              answer.id
            )}"
          >
            生徒
          </label>


          <select
            id="student-${escapeHtml(
              answer.id
            )}"
            data-student-id="${escapeHtml(
              answer.id
            )}"
            style="
              width:100%;
              margin-top:5px;
            "
          >

            <option value="">
              生徒を選択
            </option>


            ${
              students
                .map(
                  student => `

                    <option
                      value="${escapeHtml(
                        student.id
                      )}"
                    >

                      ${escapeHtml(
                        student.student_no
                      )}
                      -
                      ${escapeHtml(
                        student.name
                      )}

                    </option>

                  `
                )
                .join("")
            }

          </select>


          <button
            data-match-id="${escapeHtml(
              answer.id
            )}"
            class="btn btn-primary"
            type="button"
            style="
              margin-top:8px;
              width:100%;
            "
          >
            この生徒に紐付け
          </button>

        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   MATCH
========================================================= */

async function matchAnswer(answerId) {
  const select = document.querySelector(
    `[data-student-id="${CSS.escape(answerId)}"]`
  );

  if (!select) return;

  const studentId = select.value;
  if (!studentId) {
    const message = document.getElementById("message");
    if (message) {
      message.textContent = "生徒を選択してください。";
      message.style.color = "#b42318";
    }
    return;
  }

  const button = document.querySelector(
    `[data-match-id="${CSS.escape(answerId)}"]`
  );

  if (button) {
    button.disabled = true;
    button.textContent = "紐付け中...";
  }

  try {
    const {
      data: student,
      error: studentError
    } = await supabaseClient
      .from("students")
      .select("id,student_no,name,active")
      .eq("id", studentId)
      .single();

    if (studentError) throw studentError;
    if (!student?.active) {
      throw new Error("選択した生徒は無効化されています。");
    }

    const {
      data: updatedAnswer,
      error
    } = await supabaseClient
      .from("answer_sheets")
      .update({
        student_id: student.id,
        qr_value: `MANUAL:${student.student_no}`,
        status: "matched"
      })
      .eq("id", answerId)
      .select("id")
      .single();

    if (error) throw error;
    if (!updatedAnswer) {
      throw new Error("答案を更新できませんでした。");
    }

    let cropWarning = false;
    try {
      await recropAnswer(answerId);
    } catch (cropError) {
      cropWarning = true;
      console.warn("answer crop regeneration:", cropError);
    }

    document.getElementById(`answer-${answerId}`)?.remove();

    const remaining = document.querySelector("[id^='answer-']");
    if (!remaining) {
      const container = document.getElementById("answerList");
      if (container) {
        container.innerHTML = `
          <div class="card">
            <div style="text-align:center;padding:30px;color:#16834b;">
              未紐付け答案はありません。
            </div>
          </div>
        `;
      }
    }

    const message = document.getElementById("message");
    if (message) {
      message.textContent = cropWarning
        ? "生徒の紐付けは完了しました。クロップ生成は失敗しましたが、元答案画像で採点できます。"
        : "生徒の紐付けが完了しました。";
      message.style.color = cropWarning ? "#b42318" : "#16834b";
    }

  } catch (error) {
    console.error("matchAnswer:", error);

    const message = document.getElementById("message");
    if (message) {
      message.textContent = error.message || "紐付けに失敗しました。";
      message.style.color = "#b42318";
    }

    if (button) {
      button.disabled = false;
      button.textContent = "この生徒に紐付け";
    }
  }
}


/* =========================================================
   ANSWER RECROP
========================================================= */

async function recropAnswer(answerSheetId) {
  const { data: answer, error: answerError } = await supabaseClient
    .from("answer_sheets")
    .select("id,test_id")
    .eq("id", answerSheetId)
    .single();
  if (answerError) throw answerError;

  const { data: answerPages, error: pageError } = await supabaseClient
    .from("answer_sheet_pages")
    .select("id,page_no,file_path,width_px,height_px")
    .eq("answer_sheet_id", answerSheetId)
    .order("page_no", { ascending: true });
  if (pageError) throw pageError;

  const { data: layoutBoxes, error: boxError } = await supabaseClient
    .from("layout_boxes")
    .select("id,page_no,box_type,box_role,x,y,width,height")
    .eq("test_id", answer.test_id)
    .eq("box_type", "answer");
  const answerOnlyBoxes = (layoutBoxes || []).filter(box => !["major", "minor"].includes(box.box_role));
  if (boxError) throw boxError;

  if (!answerPages?.length) throw new Error("答案ページ画像がありません。");
  if (!answerOnlyBoxes.length) throw new Error("採点対象の解答欄が設定されていません。");

  const { error: deleteError } = await supabaseClient
    .from("answer_regions")
    .delete()
    .eq("answer_sheet_id", answerSheetId);
  if (deleteError) throw deleteError;

  let created = 0;
  for (const answerPage of answerPages) {
    const pageBoxes = answerOnlyBoxes.filter(box => Number(box.page_no) === Number(answerPage.page_no));
    if (!pageBoxes.length) continue;

    const { data: downloaded, error: downloadError } = await supabaseClient
      .storage.from("test-files").download(answerPage.file_path);
    if (downloadError) throw downloadError;

    const image = await blobToImage(downloaded);
    const sourceWidth = Number(answerPage.width_px) || image.naturalWidth;
    const sourceHeight = Number(answerPage.height_px) || image.naturalHeight;
    const scaleX = image.naturalWidth / sourceWidth;
    const scaleY = image.naturalHeight / sourceHeight;

    for (const box of pageBoxes) {
      const rect = {
        x: (Number(box.x) || 0) * scaleX,
        y: (Number(box.y) || 0) * scaleY,
        width: (Number(box.width) || 0) * scaleX,
        height: (Number(box.height) || 0) * scaleY
      };
      const crop = cropImage(image, rect);
      if (!crop) continue;
      const blob = await canvasToBlob(crop);
      const path = [answer.test_id, answerSheetId, `${box.id}.png`].join("/");

      const { error: uploadError } = await supabaseClient
        .storage.from("student-answers")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;

      const { error: regionError } = await supabaseClient
        .from("answer_regions")
        .upsert({
          answer_sheet_id: answerSheetId,
          layout_box_id: box.id,
          page_no: answerPage.page_no,
          image_path: path,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }, { onConflict: "answer_sheet_id,layout_box_id" });
      if (regionError) throw regionError;
      created++;
    }
  }

  if (!created) throw new Error("答案の切り出し対象がありません。解答欄の枠設定を確認してください。");
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("答案画像を読み込めませんでした。")); };
    image.src = url;
  });
}

function cropImage(image, rect) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const width = Math.min(image.naturalWidth - x, Math.floor(rect.width));
  const height = Math.min(image.naturalHeight - y, Math.floor(rect.height));
  if (width <= 0 || height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("答案切り出し用Canvasを作成できませんでした。");
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("答案の切り出し画像を生成できませんでした。"));
    }, "image/png", 1);
  });
}


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  const container =
    document.getElementById(
      "answerList"
    );


  if (!container) {

    return;

  }


  container.innerHTML = `

    <div
      class="card"
      style="
        color:#b42318;
      "
    >

      ${escapeHtml(
        message
      )}

    </div>

  `;

}


/* =========================================================
   DATE
========================================================= */

function formatDate(
  value
) {

  if (!value) {

    return "";

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

    return "";

  }


  return date.toLocaleString(
    "ja-JP"
  );

}


/* =========================================================
   ESCAPE
========================================================= */

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


/* =========================================================
   LOGOUT
========================================================= */

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
