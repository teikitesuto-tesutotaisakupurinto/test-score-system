/* =========================================================
   未紐付け答案
========================================================= */


let students = [];


async function initializeUnmatched() {

  const profile =
    await getProfile();


  if (!profile) {

    location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    location.href =
      "/student/dashboard";

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  await loadStudents();

  await loadUnmatched();

}


async function loadStudents() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("students")
      .select(`
        id,
        student_no,
        name
      `)
      .eq(
        "active",
        true
      )
      .order(
        "student_no"
      );


  if (error) {

    console.error(error);

    return;

  }


  students =
    data || [];

}


async function loadUnmatched() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("answer_sheets")
      .select(`
        id,
        test_id,
        original_file_path,
        qr_value,
        status,
        created_at,
        tests(
          name,
          subject
        )
      `)
      .eq(
        "status",
        "unmatched"
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    console.error(error);

    return;

  }


  const container =
    document.getElementById(
      "answerList"
    );


  if (!data?.length) {

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
    data
      .map(
        answer =>
          createAnswerCard(
            answer
          )
      )
      .join("");


  data.forEach(
    answer => {

      const button =
        document.querySelector(
          `[data-match-id="${answer.id}"]`
        );


      button.addEventListener(
        "click",
        () =>
          matchAnswer(
            answer.id
          )
      );

    }
  );

}


function createAnswerCard(
  answer
) {

  return `

    <div
      class="card"
      id="answer-${answer.id}"
    >

      <div
        style="
          display:grid;
          grid-template-columns:
            1fr 300px;
          gap:20px;
        "
      >

        <div>

          <h3>
            ${escapeHtml(
              answer.tests?.name ||
              "テスト"
            )}
          </h3>

          <p>
            ${escapeHtml(
              answer.tests?.subject ||
              ""
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

        </div>


        <div>

          <label>
            生徒
          </label>

          <select
            data-student-id="${answer.id}"
          >

            <option value="">
              生徒を選択
            </option>

            ${
              students
                .map(
                  student => `

                    <option
                      value="${student.id}"
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
            data-match-id="${answer.id}"
            class="btn btn-primary"
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


async function matchAnswer(
  answerId
) {

  const select =
    document.querySelector(
      `[data-student-id="${answerId}"]`
    );


  const studentId =
    select.value;


  if (!studentId) {

    alert(
      "生徒を選択してください。"
    );

    return;

  }


  try {

    const {
      data: student,
      error: studentError
    } =
      await supabaseClient
        .from("students")
        .select(
          "id,student_no,name"
        )
        .eq(
          "id",
          studentId
        )
        .single();


    if (studentError) {

      throw studentError;

    }


    const {
      error
    } =
      await supabaseClient
        .from("answer_sheets")
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
        );


    if (error) {

      throw error;

    }


    const card =
      document.getElementById(
        `answer-${answerId}`
      );


    card.remove();


    /*
      残りがないか確認
    */

    if (
      !document.querySelector(
        "[id^='answer-']"
      )
    ) {

      document.getElementById(
        "answerList"
      ).innerHTML = `

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


  } catch (error) {

    console.error(error);

    alert(
      error.message ||
      "紐付けに失敗しました。"
    );

  }

}


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


function formatDate(
  value
) {

  if (!value) {
    return "";
  }

  return new Date(
    value
  ).toLocaleString(
    "ja-JP"
  );

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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


initializeUnmatched();
