/* =========================================================
   答案アップロード
========================================================= */

let tests = [];


async function initializeAnswerUpload() {

  const profile =
    await getProfile();

  if (!profile) {
    location.href = "/login";
    return;
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    location.href = "/student/dashboard";
    return;
  }

  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";

  await loadTests();

}


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
        status
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(error);

    showMessage(
      "テスト一覧を取得できませんでした。",
      true
    );

    return;
  }

  tests =
    data || [];


  const select =
    document.getElementById(
      "testSelect"
    );


  if (!tests.length) {

    select.innerHTML = `
      <option value="">
        テストがありません
      </option>
    `;

    return;

  }


  select.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      tests
        .map(
          test => `

            <option value="${test.id}">

              ${escapeHtml(test.name)}

              ${
                test.subject
                  ? ` / ${escapeHtml(test.subject)}`
                  : ""
              }

            </option>

          `
        )
        .join("")
    }

  `;

}


/* =========================================================
   アップロード開始
========================================================= */

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
        document.getElementById(
          "answerFiles"
        ).files;


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


      button.disabled = true;

      button.textContent =
        "アップロード中...";


      clearUploadList();


      try {

        let completed =
          0;


        for (
          const file
          of files
        ) {

          await uploadOneFile(
            testId,
            file
          );


          completed++;

          showMessage(
            `${completed} / ${files.length} 件処理しました。`
          );

        }


        showMessage(
          `${completed}件のアップロードが完了しました。`
        );


      } catch (error) {

        console.error(error);

        showMessage(
          error.message ||
          "アップロードに失敗しました。",
          true
        );

      }


      button.disabled = false;

      button.textContent =
        "アップロード開始";

    }
  );


/* =========================================================
   1ファイル
========================================================= */

async function uploadOneFile(
  testId,
  file
) {

  const row =
    createUploadRow(
      file.name
    );


  try {

    /*
      Storage保存
    */

    const extension =
      getExtension(
        file.name
      );


    const path =
      `${testId}/${crypto.randomUUID()}.${extension}`;


    const {
      error: uploadError
    } =
      await supabaseClient
        .storage
        .from(
          "answer-files"
        )
        .upload(
          path,
          file,
          {
            upsert: false
          }
        );


    if (uploadError) {

      throw uploadError;

    }


    setRowStatus(
      row,
      "Storage保存完了"
    );


    /*
      答案レコード作成
    */

    const session =
      await getSession();


    const {
      data: answerSheet,
      error: answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .insert({

          test_id:
            testId,

          original_file_path:
            path,

          status:
            "unmatched",

          uploaded_by:
            session.user.id

        })
        .select()
        .single();


    if (answerError) {

      throw answerError;

    }


    setRowStatus(
      row,
      "答案登録完了"
    );


    /*
      画像の場合のみ、
      QR読み取りを行う
    */

    if (
      file.type.startsWith(
        "image/"
      )
    ) {

      setRowStatus(
        row,
        "QR読み取り中..."
      );


      const qrValue =
        await readQRCode(
          file
        );


      if (qrValue) {

        await matchQRCode(
          answerSheet.id,
          qrValue,
          row
        );

      } else {

        setRowStatus(
          row,
          "QR未読取 → 未紐付け"
        );

      }

    } else {

      setRowStatus(
        row,
        "PDF → 未紐付け"
      );

    }


  } catch (error) {

    console.error(error);

    setRowStatus(
      row,
      error.message ||
      "エラー",
      true
    );

  }

}


/* =========================================================
   QR → 生徒
========================================================= */

async function matchQRCode(
  answerSheetId,
  qrValue,
  row
) {

  /*
    QR形式
    STUDENT:483921
  */

  const prefix =
    "STUDENT:";


  if (
    !qrValue.startsWith(
      prefix
    )
  ) {

    setRowStatus(
      row,
      "QR形式不正 → 未紐付け",
      true
    );

    return;

  }


  const studentNo =
    qrValue
      .substring(
        prefix.length
      )
      .trim();


  if (
    !/^\d{6}$/.test(
      studentNo
    )
  ) {

    setRowStatus(
      row,
      "6桁生徒番号ではありません。",
      true
    );

    return;

  }


  const {
    data: student,
    error
  } =
    await supabaseClient
      .from(
        "students"
      )
      .select(
        "id,student_no,name"
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


  if (!student) {

    setRowStatus(
      row,
      `生徒番号 ${studentNo} が未登録`,
      true
    );

    return;

  }


  /*
    答案に生徒を紐付け
  */

  const {
    error: updateError
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


  setRowStatus(
    row,
    `${student.student_no} ${student.name} に紐付け完了`
  );

}


/* =========================================================
   QR読み取り
========================================================= */

async function readQRCode(
  file
) {

  /*
    jsQRを使用。
    画像からQRを読み取る。
  */

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


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.drawImage(
    image,
    0,
    0
  );


  const imageData =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
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


  return result?.data ||
    null;

}


function loadImage(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();


      image.onload =
        () => resolve(image);


      image.onerror =
        reject;


      image.src =
        URL.createObjectURL(
          file
        );

    }
  );

}


/* =========================================================
   表示
========================================================= */

function createUploadRow(
  fileName
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
    border:1px solid #d0d6dc;
    padding:10px;
    margin-bottom:6px;
    background:#fff;
  `;


  row.innerHTML = `

    <strong>
      ${escapeHtml(fileName)}
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
  ).innerHTML = "";

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


function getExtension(
  filename
) {

  const parts =
    filename.split(".");


  return parts.length > 1
    ? parts
        .pop()
        .toLowerCase()
    : "bin";

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


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


initializeAnswerUpload();
