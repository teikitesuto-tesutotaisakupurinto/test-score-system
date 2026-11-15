/* =========================================================
   テスト成績システム
   答案切り出し

   構造

   answer_sheets
        ↓
   answer_sheet_pages
        ↓
   layout_boxes
        ↓
   answer_regions
        ↓
   student-answers Storage


   1答案
   ├─ page 1
   ├─ page 2
   ├─ page 3
   └─ ...

   各ページの解答欄を
   layout_box単位で切り出す。
========================================================= */


/* =========================================================
   状態
========================================================= */

let regionTests = [];

let selectedTestId = null;

let resultCount = 0;


/* =========================================================
   初期化
========================================================= */

async function initializeRegions() {

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


  await loadTests();

}


/* =========================================================
   テスト一覧
========================================================= */

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
        class_name
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "テスト取得エラー:",
      error
    );


    showMessage(
      "テスト一覧を取得できませんでした。",
      true
    );


    return;

  }


  regionTests =
    data || [];


  const select =
    document.getElementById(
      "testSelect"
    );


  select.innerHTML = `

    <option value="">
      テストを選択してください
    </option>

    ${
      regionTests
        .map(
          test => `

            <option
              value="${escapeHtml(test.id)}"
            >

              ${escapeHtml(test.name)}

              ${
                test.subject
                  ? ` / ${escapeHtml(test.subject)}`
                  : ""
              }

              ${
                test.grade
                  ? ` / ${escapeHtml(test.grade)}`
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
   テスト選択
========================================================= */

document
  .getElementById(
    "testSelect"
  )
  .addEventListener(
    "change",
    async event => {

      selectedTestId =
        event.target.value ||
        null;


      const button =
        document.getElementById(
          "executeButton"
        );


      if (!selectedTestId) {

        button.disabled =
          true;


        document.getElementById(
          "summary"
        ).style.display =
          "none";


        document.getElementById(
          "testInformation"
        ).innerHTML =
          "";


        return;

      }


      button.disabled =
        false;


      await loadTestInformation();

      await loadSummary();

    }
  );


/* =========================================================
   テスト情報
========================================================= */

async function loadTestInformation() {

  const test =
    regionTests.find(
      item =>
        item.id ===
        selectedTestId
    );


  if (!test) {

    return;

  }


  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(
        test.name
      )}
    </strong>

    <br>

    教科：
    ${escapeHtml(
      test.subject || "-"
    )}

    ／

    学年：
    ${escapeHtml(
      test.grade || "-"
    )}

    ／

    クラス：
    ${escapeHtml(
      test.class_name || "-"
    )}

  `;

}


/* =========================================================
   処理対象概要
========================================================= */

async function loadSummary() {

  const [
    boxesResult,
    answersResult,
    pagesResult
  ] =
    await Promise.all([

      supabaseClient
        .from("layout_boxes")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "test_id",
          selectedTestId
        )
        .eq(
          "box_type",
          "answer"
        ),

      supabaseClient
        .from("answer_sheets")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "test_id",
          selectedTestId
        )
        .neq(
          "status",
          "unmatched"
        ),

      supabaseClient
        .from("test_pages")
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "test_id",
          selectedTestId
        )
        .neq(
          "page_no",
          999
        )

    ]);


  const boxCount =
    boxesResult.count || 0;


  const answerCount =
    answersResult.count || 0;


  const pageCount =
    pagesResult.count || 0;


  const summary =
    document.getElementById(
      "summary"
    );


  summary.style.display =
    "block";


  summary.innerHTML = `

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(3,minmax(0,1fr));
        gap:12px;
      "
    >

      <div>

        <div
          style="
            color:#777;
            font-size:12px;
          "
        >
          解答用紙ページ
        </div>

        <strong>
          ${pageCount}
        </strong>
        ページ

      </div>


      <div>

        <div
          style="
            color:#777;
            font-size:12px;
          "
        >
          解答欄
        </div>

        <strong>
          ${boxCount}
        </strong>
        個

      </div>


      <div>

        <div
          style="
            color:#777;
            font-size:12px;
          "
        >
          紐付け済み答案
        </div>

        <strong>
          ${answerCount}
        </strong>
        枚

      </div>

    </div>

  `;

}


/* =========================================================
   切り出し開始
========================================================= */

document
  .getElementById(
    "executeButton"
  )
  .addEventListener(
    "click",
    async () => {

      if (!selectedTestId) {

        return;

      }


      const button =
        document.getElementById(
          "executeButton"
        );


      button.disabled =
        true;


      button.textContent =
        "切り出し中...";


      clearResults();


      try {

        const count =
          await buildAnswerRegions(
            selectedTestId
          );


        showMessage(
          `${count}件の答案領域を作成しました。`
        );


      } catch (error) {

        console.error(
          "答案切り出しエラー:",
          error
        );


        showMessage(
          error.message ||
          "答案切り出しに失敗しました。",
          true
        );

      }


      button.disabled =
        false;


      button.textContent =
        "答案を問題別に切り出す";


    }
  );


/* =========================================================
   答案領域作成
========================================================= */

async function buildAnswerRegions(
  testId
) {

  /*
    解答欄
  */

  const {
    data: boxes,
    error: boxError
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        id,
        page_no,
        x,
        y,
        width,
        height,
        points,
        label
      `)
      .eq(
        "test_id",
        testId
      )
      .eq(
        "box_type",
        "answer"
      )
      .order(
        "page_no",
        {
          ascending: true
        }
      );


  if (boxError) {

    throw boxError;

  }


  if (!boxes?.length) {

    throw new Error(
      "解答欄が設定されていません。"
    );

  }


  /*
    紐付け済み答案
  */

  const {
    data: answers,
    error: answerError
  } =
    await supabaseClient
      .from("answer_sheets")
      .select(`
        id,
        student_id,
        original_file_path,
        status,
        students(
          student_no,
          name
        )
      `)
      .eq(
        "test_id",
        testId
      )
      .neq(
        "status",
        "unmatched"
      );


  if (answerError) {

    throw answerError;

  }


  if (!answers?.length) {

    throw new Error(
      "紐付け済み答案がありません。"
    );

  }


  /*
    すべての答案を処理
  */

  let created =
    0;


  for (
    const answer
    of answers
  ) {

    const pages =
      await loadAnswerPages(
        answer.id
      );


    if (!pages.length) {

      addResult(
        answer,
        null,
        "答案ページなし",
        true
      );


      continue;

    }


    /*
      各解答欄
    */

    for (
      const box
      of boxes
    ) {

      /*
        該当ページ
      */

      const page =
        pages.find(
          item =>
            Number(
              item.page_no
            ) ===
            Number(
              box.page_no
            )
        );


      if (!page) {

        addResult(
          answer,
          box,
          "該当ページなし",
          true
        );


        continue;

      }


      try {

        const blob =
          await cropAnswerImage(
            page.file_path,
            box
          );


        if (!blob) {

          addResult(
            answer,
            box,
            "画像切り出し失敗",
            true
          );


          continue;

        }


        const storagePath =
          `${testId}/${answer.id}/${box.id}.png`;


        /*
          Storage
        */

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
              storagePath,
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


        /*
          answer_regions
        */

        await saveAnswerRegion({

          answerSheetId:
            answer.id,

          box,

          storagePath

        });


        created++;


        addResult(
          answer,
          box,
          "完了"
        );


      } catch (error) {

        console.error(
          error
        );


        addResult(
          answer,
          box,
          error.message ||
          "失敗",
          true
        );

      }

    }

  }


  return created;

}


/* =========================================================
   答案ページ取得
========================================================= */

async function loadAnswerPages(
  answerId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "answer_sheet_pages"
      )
      .select(`
        id,
        page_no,
        file_path,
        file_type,
        original_name,
        width_px,
        height_px
      `)
      .eq(
        "answer_sheet_id",
        answerId
      )
      .order(
        "page_no",
        {
          ascending: true
        }
      );


  if (error) {

    throw error;

  }


  return data || [];

}


/* =========================================================
   画像切り出し
========================================================= */

async function cropAnswerImage(
  storagePath,
  box
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        "answer-files"
      )
      .createSignedUrl(
        storagePath,
        3600
      );


  if (error) {

    throw error;

  }


  if (
    !data?.signedUrl
  ) {

    throw new Error(
      "答案画像URLを取得できませんでした。"
    );

  }


  const image =
    await loadImage(
      data.signedUrl
    );


  /*
    座標
  */

  const x =
    Math.max(
      0,
      Number(box.x) || 0
    );


  const y =
    Math.max(
      0,
      Number(box.y) || 0
    );


  const width =
    Number(box.width) || 1;


  const height =
    Number(box.height) || 1;


  /*
    元画像内に収める
  */

  const cropWidth =
    Math.min(
      width,
      image.naturalWidth - x
    );


  const cropHeight =
    Math.min(
      height,
      image.naturalHeight - y
    );


  if (
    cropWidth <= 0 ||
    cropHeight <= 0
  ) {

    throw new Error(
      "解答欄が画像範囲外です。"
    );

  }


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    Math.round(
      cropWidth
    );


  canvas.height =
    Math.round(
      cropHeight
    );


  const context =
    canvas.getContext(
      "2d"
    );


  context.drawImage(

    image,

    x,
    y,

    cropWidth,
    cropHeight,

    0,
    0,

    cropWidth,
    cropHeight

  );


  return await canvasToBlob(
    canvas
  );

}


/* =========================================================
   answer_regions保存
========================================================= */

async function saveAnswerRegion({
  answerSheetId,
  box,
  storagePath
}) {

  /*
    既存確認
  */

  const {
    data: existing,
    error:
      existingError
  } =
    await supabaseClient
      .from(
        "answer_regions"
      )
      .select(
        "id"
      )
      .eq(
        "answer_sheet_id",
        answerSheetId
      )
      .eq(
        "layout_box_id",
        box.id
      )
      .maybeSingle();


  if (existingError) {

    throw existingError;

  }


  const values = {

    answer_sheet_id:
      answerSheetId,

    question_id:
      null,

    layout_box_id:
      box.id,

    page_no:
      box.page_no,

    image_path:
      storagePath,

    x:
      box.x,

    y:
      box.y,

    width:
      box.width,

    height:
      box.height

  };


  if (existing) {

    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .update(
          values
        )
        .eq(
          "id",
          existing.id
        );


    if (error) {

      throw error;

    }


  } else {

    const {
      error
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .insert(
          values
        );


    if (error) {

      throw error;

    }

  }

}


/* =========================================================
   Blob → Image
========================================================= */

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
        () => resolve(
          image
        );


      image.onerror =
        () => reject(
          new Error(
            "画像を読み込めませんでした。"
          )
        );


      image.src =
        src;

    }
  );

}


/* =========================================================
   Canvas → PNG
========================================================= */

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
        "image/png"
      );

    }
  );

}


/* =========================================================
   結果表示
========================================================= */

function addResult(
  answer,
  box,
  status,
  error = false
) {

  const container =
    document.getElementById(
      "resultList"
    );


  const item =
    document.createElement(
      "div"
    );


  item.style.cssText = `

    padding:9px;

    border-bottom:
      1px solid #d0d6dc;

    color:
      ${error
        ? "#c62828"
        : "#16834b"};

  `;


  item.textContent =

    `${answer.students?.student_no || ""}` +

    " - " +

    `${answer.students?.name || ""}` +

    " ／ " +

    `${box?.label || "解答欄"}` +

    " ／ " +

    status;


  container.appendChild(
    item
  );


  resultCount++;


  document.getElementById(
    "resultCount"
  ).textContent =
    `${resultCount}件`;

}


function clearResults() {

  resultCount =
    0;


  document.getElementById(
    "resultList"
  ).innerHTML =
    "";


  document.getElementById(
    "resultCount"
  ).textContent =
    "0件";

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


/* =========================================================
   Logout
========================================================= */

document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


/* =========================================================
   HTML escape
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


/* =========================================================
   START
========================================================= */

initializeRegions();
