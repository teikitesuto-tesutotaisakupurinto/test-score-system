
"use strict";

/* =========================================================
   生徒CSV一括登録

   CSV
   ---------------------------------------------------------
   氏名,学年,クラス

   ・UTF-8 BOM対応
   ・引用符対応
   ・氏名必須
   ・学年 / クラス任意
   ・生徒番号はDB側で自動発行
   ・大量データは分割INSERT
========================================================= */


let DB =
  null;


let importStudents =
  [];


let importing =
  false;


/* =========================================================
   DOM
========================================================= */

const csvFile =
  document.getElementById(
    "csvFile"
  );


const previewButton =
  document.getElementById(
    "previewButton"
  );


const importButton =
  document.getElementById(
    "importButton"
  );


const previewArea =
  document.getElementById(
    "previewArea"
  );


const previewRows =
  document.getElementById(
    "previewRows"
  );


const previewCount =
  document.getElementById(
    "previewCount"
  );


const message =
  document.getElementById(
    "message"
  );


const progressArea =
  document.getElementById(
    "importProgress"
  );


const progressBar =
  document.getElementById(
    "progressBar"
  );


const progressText =
  document.getElementById(
    "progressText"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeImport
);


async function initializeImport() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase Clientが初期化されていません。"
      );

    }


    const auth =
      await requireRole(
        "teacher"
      );


    if (!auth) {

      return;

    }


    document.getElementById(
      "teacherName"
    ).textContent =
      auth.profile?.name ||
      "先生";


    setupEvents();


  } catch (error) {

    console.error(
      "student-import:",
      error
    );


    showMessage(
      error.message ||
      "CSV一括登録画面を起動できませんでした。",
      true
    );

  }

}


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

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


  csvFile?.addEventListener(
    "change",
    () => {

      importStudents =
        [];

      previewArea.style.display =
        "none";


      importButton.disabled =
        true;


      showMessage(
        ""
      );

    }
  );


  previewButton?.addEventListener(
    "click",
    previewCsv
  );


  importButton?.addEventListener(
    "click",
    importCsv
  );

}


/* =========================================================
   PREVIEW
========================================================= */

async function previewCsv() {

  if (importing) {

    return;

  }


  const file =
    csvFile?.files?.[0];


  if (!file) {

    showMessage(
      "CSVファイルを選択してください。",
      true
    );

    return;

  }


  previewButton.disabled =
    true;


  try {

    const text =
      await readFile(
        file
      );


    importStudents =
      parseCSV(
        text
      );


    if (!importStudents.length) {

      throw new Error(
        "登録できるデータがありません。"
      );

    }


    /*
     * 空行・氏名空欄は除外済み。
     */

    renderPreview();


    importButton.disabled =
      false;


    showMessage(
      `${importStudents.length}人を登録できます。`
    );


  } catch (error) {

    console.error(
      error
    );


    importStudents =
      [];


    importButton.disabled =
      true;


    previewArea.style.display =
      "none";


    showMessage(
      error.message ||
      "CSVを読み込めませんでした。",
      true
    );

  } finally {

    previewButton.disabled =
      false;

  }

}


/* =========================================================
   IMPORT
========================================================= */

async function importCsv() {

  if (
    importing ||
    !importStudents.length
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      `${importStudents.length}人を登録します。よろしいですか？`
    );


  if (!confirmed) {

    return;

  }


  importing =
    true;


  setControlsDisabled(
    true
  );


  progressArea.classList.add(
    "show"
  );


  const chunkSize =
    200;


  let inserted =
    0;


  try {
    const { data: registeredClasses, error: classLookupError } = await DB
      .from("classes")
      .select("id,name,grade");
    if (classLookupError) throw classLookupError;

    for (
      let start = 0;
      start <
      importStudents.length;
      start +=
        chunkSize
    ) {

      const chunk =
        importStudents.slice(
          start,
          start +
            chunkSize
        );


      const rows =
        chunk.map(
          student => ({

            name:
              student.name,

            grade:
              student.grade ||
              null,

            class_name:
              student.className ||
              null,

            class_id: (registeredClasses || []).find(item =>
              String(item.grade || "").trim() === String(student.grade || "").trim()
              && String(item.name || "").trim() === String(student.className || "").trim()
            )?.id || null,

            municipality: student.municipality || null,
            school_name: student.schoolName || null

          })
        );


      const {
        data,
        error
      } =
        await DB
          .from(
            "students"
          )
          .insert(
            rows
          )
          .select(
            `
            id,
            student_no,
            name
            `
          );


      if (error) {

        throw error;

      }


      inserted +=
        (
          data?.length ||
          chunk.length
        );


      updateProgress(
        Math.min(
          start +
            chunk.length,
          importStudents.length
        ),
        importStudents.length
      );


      /*
       * 大量登録時にブラウザUIを固めない。
       */

      await yieldBrowser();

    }


    showMessage(
      `${inserted}人を登録しました。`
    );


    /*
     * 登録番号を画面に出す。
     * alertは使わない。
     */

    const resultText =
      "登録された生徒番号は生徒一覧で確認できます。";


    showMessage(
      `${inserted}人を登録しました。\n${resultText}`
    );


    setTimeout(
      () => {

        location.href =
          "/teacher/students";

      },
      700
    );


  } catch (error) {

    console.error(
      "student import:",
      error
    );


    showMessage(
      error.message ||
      "一括登録に失敗しました。",
      true
    );


    importButton.disabled =
      false;


  } finally {

    importing =
      false;


    setControlsDisabled(
      false
    );

  }

}


/* =========================================================
   FILE
========================================================= */

function readFile(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();


      reader.onload =
        () =>
          resolve(
            String(
              reader.result ||
              ""
            )
          );


      reader.onerror =
        () =>
          reject(
            new Error(
              "ファイルを読み込めませんでした。"
            )
          );


      reader.readAsText(
        file,
        "UTF-8"
      );

    }
  );

}


/* =========================================================
   CSV
========================================================= */

function parseCSV(
  text
) {

  const normalized =
    String(
      text ||
      ""
    )
      .replace(
        /^\uFEFF/,
        ""
      );


  const lines =
    splitCSVLines(
      normalized
    )
      .filter(
        line =>
          line.some(
            value =>
              String(
                value
              ).trim() !== ""
          )
      );


  if (
    lines.length <
    2
  ) {

    return [];

  }


  const headers =
    lines[0]
      .map(
        header =>
          String(
            header
          )
            .trim()
      );


  const nameIndex =
    findHeader(
      headers,
      [
        "氏名",
        "名前",
        "name"
      ]
    );


  const gradeIndex =
    findHeader(
      headers,
      [
        "学年",
        "grade"
      ]
    );


  const classIndex = findHeader(headers, ["クラス", "class", "class_name"]);
  const municipalityIndex = findHeader(headers, ["市区町村", "自治体", "municipality"]);
  const schoolIndex = findHeader(headers, ["学校", "学校名", "school", "school_name"]);


  if (
    nameIndex ===
    -1
  ) {

    throw new Error(
      "「氏名」列がありません。"
    );

  }


  return lines
    .slice(1)
    .map(
      values => ({

        name:
          cleanCell(
            values[nameIndex]
          ),

        grade:
          gradeIndex >= 0
            ? cleanCell(
                values[gradeIndex]
              )
            : "",

        className: classIndex >= 0 ? cleanCell(values[classIndex]) : "",
        municipality: municipalityIndex >= 0 ? cleanCell(values[municipalityIndex]) : "",
        schoolName: schoolIndex >= 0 ? cleanCell(values[schoolIndex]) : ""

      })
    )
    .filter(
      student =>
        student.name
    );

}


/* =========================================================
   CSV LINES
========================================================= */

function splitCSVLines(
  text
) {

  const result =
    [];


  let row =
    [];


  let current =
    "";


  let quoted =
    false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text[i];


    if (
      char ===
      '"'
    ) {

      if (
        quoted &&
        text[i + 1] ===
        '"'
      ) {

        current +=
          '"';

        i++;

      } else {

        quoted =
          !quoted;

      }


      continue;

    }


    if (
      char ===
      "," &&
      !quoted
    ) {

      row.push(
        current
      );


      current =
        "";


      continue;

    }


    if (
      (
        char ===
        "\n" ||
        char ===
        "\r"
      ) &&
      !quoted
    ) {

      if (
        char ===
        "\r" &&
        text[i + 1] ===
        "\n"
      ) {

        i++;

      }


      row.push(
        current
      );


      result.push(
        row
      );


      row =
        [];


      current =
        "";


      continue;

    }


    current +=
      char;

  }


  row.push(
    current
  );


  if (
    row.some(
      value =>
        String(
          value
        ).trim() !== ""
    )
  ) {

    result.push(
      row
    );

  }


  return result;

}


/* =========================================================
   HEADER
========================================================= */

function findHeader(
  headers,
  candidates
) {

  for (
    const candidate
    of candidates
  ) {

    const index =
      headers.findIndex(
        header =>
          String(
            header
          )
            .toLowerCase() ===
          String(
            candidate
          )
            .toLowerCase()
      );


    if (
      index >=
      0
    ) {

      return index;

    }

  }


  return -1;

}


/* =========================================================
   PREVIEW
========================================================= */

function renderPreview() {

  previewRows.innerHTML =
    importStudents
      .map(
        student => `

          <tr>

            <td>
              ${escapeHtml(
                student.name
              )}
            </td>

            <td>
              ${escapeHtml(
                student.grade
              )}
            </td>

            <td>
              ${escapeHtml(student.className)}
            </td>
            <td>
              ${escapeHtml(student.municipality)}
            </td>
            <td>
              ${escapeHtml(student.schoolName)}
            </td>

          </tr>

        `
      )
      .join("");


  previewCount.textContent =
    `${importStudents.length}件`;

  
  previewArea.style.display =
    "block";

}


/* =========================================================
   PROGRESS
========================================================= */

function updateProgress(
  current,
  total
) {

  const percent =
    total
      ? Math.round(
          current /
          total *
          100
        )
      : 0;


  progressBar.style.width =
    `${percent}%`;


  progressText.textContent =
    `${current} / ${total}人 (${percent}%)`;

}


/* =========================================================
   CONTROLS
========================================================= */

function setControlsDisabled(
  disabled
) {

  if (csvFile) {

    csvFile.disabled =
      disabled;

  }


  if (previewButton) {

    previewButton.disabled =
      disabled;

  }


  if (importButton) {

    importButton.disabled =
      disabled;


    importButton.textContent =
      disabled
        ? "登録中..."
        : "登録する";

  }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  error = false
) {

  message.textContent =
    text;


  message.className =
    error
      ? "import-message error"
      : text
        ? "import-message success"
        : "import-message";

}


/* =========================================================
   YIELD
========================================================= */

function yieldBrowser() {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        0
      )
  );

}


/* =========================================================
   CELL
========================================================= */

function cleanCell(
  value
) {

  return String(
    value ??
    ""
  )
    .trim();

}


/* =========================================================
   ESCAPE
========================================================= */

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
