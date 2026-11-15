/* =========================================================
   QRシール発行

   1人 18枚
   1枚 3cm × 2cm
   3人 / A4
   合計54枚
========================================================= */

let students = [];


async function initializeQR() {

  const profile =
    await getProfile();


  if (!profile) {

    window.location.href =
      "/login";

    return;

  }


  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {

    window.location.href =
      "/student/dashboard";

    return;

  }


  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";


  await loadStudents();


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
        "student_no",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(error);

    document.getElementById(
      "message"
    ).textContent =
      "生徒一覧を取得できませんでした。";

    return;

  }


  students =
    data || [];


  const selectIds = [
    "student1",
    "student2",
    "student3"
  ];


  selectIds.forEach(
    id => {

      const select =
        document.getElementById(
          id
        );


      select.innerHTML = `

        <option value="">
          選択してください
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

      `;

    }
  );

}


/*
  生成
*/

document
  .getElementById(
    "generateButton"
  )
  .addEventListener(
    "click",
    async () => {

      const ids = [

        document.getElementById(
          "student1"
        ).value,

        document.getElementById(
          "student2"
        ).value,

        document.getElementById(
          "student3"
        ).value

      ];


      if (
        ids.some(
          id => !id
        )
      ) {

        alert(
          "3人すべて選択してください。"
        );

        return;

      }


      /*
        同じ生徒を複数選択しない
      */

      if (
        new Set(ids).size !== 3
      ) {

        alert(
          "同じ生徒を複数選択できません。"
        );

        return;

      }


      const selected =
        ids.map(
          id =>
            students.find(
              student =>
                student.id === id
            )
        );


      await createStickerBatch(
        selected
      );

      createStickerSheet(
        selected
      );


      document.getElementById(
        "printButton"
      ).style.display =
        "inline-flex";

    }
  );


/*
  A4シール生成
*/

async function createStickerBatch(
  selectedStudents
) {

  const session =
    await getSession();


  /*
    発行履歴
  */

  const {
    data: batch,
    error: batchError
  } =
    await supabaseClient
      .from(
        "qr_sticker_batches"
      )
      .insert({

        created_by:
          session.user.id,

        stickers_per_student:
          18,

        students_per_sheet:
          3

      })
      .select()
      .single();


  if (batchError) {

    console.error(
      batchError
    );

    throw batchError;

  }


  /*
    1人18枚
  */

  const rows = [];


  selectedStudents.forEach(
    student => {

      for (
        let i = 1;
        i <= 18;
        i++
      ) {

        rows.push({

          batch_id:
            batch.id,

          student_id:
            student.id,

          sticker_no:
            i,

          qr_value:
            `STUDENT:${student.student_no}`

        });

      }

    }
  );


  const {
    error
  } =
    await supabaseClient
      .from(
        "qr_stickers"
      )
      .insert(
        rows
      );


  if (error) {

    console.error(
      error
    );

    throw error;

  }

}


/*
  シールシート
*/

function createStickerSheet(
  selectedStudents
) {

  const area =
    document.getElementById(
      "stickerArea"
    );


  let html = `

    <div class="sticker-sheet">

  `;


  let index = 0;


  selectedStudents.forEach(
    student => {

      for (
        let i = 1;
        i <= 18;
        i++
      ) {

        html += `

          <div class="sticker">

            <div
              id="qr_${index}"
              class="sticker-qr"
            ></div>

            <div
              class="sticker-info"
            >

              ${escapeHtml(
                student.name
              )}

              <br>

              ${escapeHtml(
                student.student_no
              )}

            </div>

          </div>

        `;


        index++;

      }

    }
  );


  html += `
    </div>
  `;


  area.innerHTML =
    html;


  /*
    QR生成
  */

  index = 0;


  selectedStudents.forEach(
    student => {

      for (
        let i = 1;
        i <= 18;
        i++
      ) {

        const element =
          document.getElementById(
            `qr_${index}`
          );


        new QRCode(
          element,
          {

            text:
              `STUDENT:${student.student_no}`,

            width:
              68,

            height:
              68,

            correctLevel:
              QRCode.CorrectLevel.M

          }
        );


        index++;

      }

    }
  );

}


/*
  印刷
*/

document
  .getElementById(
    "printButton"
  )
  .addEventListener(
    "click",
    () => {

      window.print();

    }
  );


/*
  ログアウト
*/

document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


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


initializeQR();
