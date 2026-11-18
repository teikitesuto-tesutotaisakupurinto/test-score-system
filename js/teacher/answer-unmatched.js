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
        name
        `
      )
      .eq(
        "active",
        true
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
      .eq(
        "status",
        "unmatched"
      )
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

async function matchAnswer(
  answerId
) {

  const select =
    document.querySelector(
      `[data-student-id="${CSS.escape(
        answerId
      )}"]`
    );


  if (!select) {

    return;

  }


  const studentId =
    select.value;


  if (!studentId) {

    alert(
      "生徒を選択してください。"
    );

    return;

  }


  const button =
    document.querySelector(
      `[data-match-id="${CSS.escape(
        answerId
      )}"]`
    );


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "紐付け中...";

  }


  try {

    /*
     * 生徒確認
     */

    const {
      data: student,
      error: studentError
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
          studentId
        )
        .eq(
          "active",
          true
        )
        .single();


    if (studentError) {

      throw studentError;

    }


    /*
     * 未紐付け → 紐付け済み
     *
     * uploaded にはしない。
     * answer_sheets_status_check と
     * システム全体の状態を
     * matched に統一。
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
            student.id,

          qr_value:
            `MANUAL:${student.student_no}`,

          status:
            "matched"

        })
        .eq(
          "id",
          answerId
        )
        .eq(
          "status",
          "unmatched"
        );


    if (error) {

      throw error;

    }


    /*
     * 答案クロップを再生成できる環境なら
     * 紐付け後処理を起動。
     *
     * 実際のクロップ生成は
     * answer-processing側で行う。
     */

    if (
      typeof window.reprocessAnswer ===
      "function"
    ) {

      try {

        await window.reprocessAnswer(
          answerId
        );

      } catch (error) {

        console.warn(
          "answer reprocess:",
          error
        );

      }

    }


    /*
     * カードを削除
     */

    const card =
      document.getElementById(
        `answer-${answerId}`
      );


    card?.remove();


    /*
     * 残り確認
     */

    const remaining =
      document.querySelector(
        "[id^='answer-']"
      );


    if (!remaining) {

      const container =
        document.getElementById(
          "answerList"
        );


      if (container) {

        container.innerHTML = `

          <div class="card">

            <div
              style="
                text-align:center;
                padding:30px;
                color:#16834b;
              "
            >
              未紐付け答案はありません。
            </div>

          </div>

        `;

      }

    }


  } catch (error) {

    console.error(
      "matchAnswer:",
      error
    );


    alert(
      error.message ||
      "紐付けに失敗しました。"
    );


    if (button) {

      button.disabled =
        false;

      button.textContent =
        "この生徒に紐付け";

    }

  }

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
