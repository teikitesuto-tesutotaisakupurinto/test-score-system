/* =========================================================
   生徒CSV一括登録
========================================================= */

let importStudents = [];


async function initializeImport() {

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

}


initializeImport();


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


/*
  CSVプレビュー
*/

document
  .getElementById(
    "previewButton"
  )
  .addEventListener(
    "click",
    async () => {

      const file =
        document.getElementById(
          "csvFile"
        ).files[0];


      const message =
        document.getElementById(
          "message"
        );


      if (!file) {

        message.textContent =
          "CSVファイルを選択してください。";

        message.style.color =
          "#c62828";

        return;

      }


      try {

        const text =
          await readFile(
            file
          );


        importStudents =
          parseCSV(
            text
          );


        if (
          !importStudents.length
        ) {

          throw new Error(
            "登録できるデータがありません。"
          );

        }


        renderPreview();


        document.getElementById(
          "importButton"
        ).disabled =
          false;


        message.textContent =
          `${importStudents.length}人を登録できます。`;

        message.style.color =
          "#16834b";


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "CSVを読み込めませんでした。";

        message.style.color =
          "#c62828";

      }

    }
  );


/*
  CSV登録
*/

document
  .getElementById(
    "importButton"
  )
  .addEventListener(
    "click",
    async () => {

      if (
        !importStudents.length
      ) {

        return;

      }


      const button =
        document.getElementById(
          "importButton"
        );


      const message =
        document.getElementById(
          "message"
        );


      button.disabled =
        true;

      button.textContent =
        "登録中...";


      try {

        const rows =
          importStudents.map(
            student => ({

              name:
                student.name,

              grade:
                student.grade ||
                null,

              class_name:
                student.className ||
                null

            })
          );


        const {
          data,
          error
        } =
          await supabaseClient
            .from("students")
            .insert(rows)
            .select(
              "id,student_no,name"
            );


        if (error) {

          throw error;

        }


        message.textContent =
          `${data.length}人を登録しました。`;

        message.style.color =
          "#16834b";


        /*
          登録された番号を表示
        */

        const numberList =
          data
            .map(
              student =>
                `${student.name}：${student.student_no}`
            )
            .join("\n");


        alert(
          `登録完了\n\n${numberList}`
        );


        window.location.href =
          "/teacher/students";


      } catch (error) {

        console.error(error);

        message.textContent =
          error.message ||
          "一括登録に失敗しました。";

        message.style.color =
          "#c62828";


        button.disabled =
          false;

        button.textContent =
          "登録する";

      }

    }
  );


/*
  ファイル読み込み
*/

function readFile(file) {

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
            reader.result
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


/*
  CSV解析
*/

function parseCSV(text) {

  const lines =
    text
      .replace(
        /^\uFEFF/,
        ""
      )
      .split(/\r?\n/)
      .filter(
        line =>
          line.trim() !== ""
      );


  if (
    lines.length < 2
  ) {

    return [];

  }


  const headers =
    parseCSVLine(
      lines[0]
    ).map(
      header =>
        header.trim()
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


  const classIndex =
    findHeader(
      headers,
      [
        "クラス",
        "class",
        "class_name"
      ]
    );


  if (
    nameIndex === -1
  ) {

    throw new Error(
      "「氏名」列がありません。"
    );

  }


  return lines
    .slice(1)
    .map(
      line => {

        const values =
          parseCSVLine(
            line
          );


        return {

          name:
            values[nameIndex]
              ?.trim() || "",

          grade:
            gradeIndex >= 0
              ? values[gradeIndex]
                  ?.trim() || ""
              : "",

          className:
            classIndex >= 0
              ? values[classIndex]
                  ?.trim() || ""
              : ""

        };

      }
    )
    .filter(
      student =>
        student.name
    );

}


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
          header
            .toLowerCase()
            ===
          candidate.toLowerCase()
      );


    if (
      index >= 0
    ) {

      return index;

    }

  }


  return -1;

}


/*
  CSV 1行解析
*/

function parseCSVLine(
  line
) {

  const result = [];

  let current = "";

  let quoted = false;


  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];


    if (
      char === '"'
    ) {

      if (
        quoted &&
        line[i + 1] === '"'
      ) {

        current += '"';

        i++;

      } else {

        quoted =
          !quoted;

      }

      continue;

    }


    if (
      char === "," &&
      !quoted
    ) {

      result.push(
        current
      );

      current = "";

      continue;

    }


    current +=
      char;

  }


  result.push(
    current
  );


  return result;

}


/*
  プレビュー
*/

function renderPreview() {

  const area =
    document.getElementById(
      "previewArea"
    );


  const tbody =
    document.getElementById(
      "previewRows"
    );


  tbody.innerHTML =
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
              ${escapeHtml(
                student.className
              )}
            </td>

          </tr>

        `
      )
      .join("");


  area.style.display =
    "block";

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
