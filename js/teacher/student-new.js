
"use strict";

/* =========================================================
   生徒登録
========================================================= */

let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeStudentNew
);


async function initializeStudentNew() {

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


    const teacherName =
      document.getElementById(
        "teacherName"
      );


    if (teacherName) {

      teacherName.textContent =
        auth.profile?.name ||
        "先生";

    }


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


    document
      .getElementById(
        "studentForm"
      )
      ?.addEventListener(
        "submit",
        handleSubmit
      );


  } catch (error) {

    console.error(
      "student-new:",
      error
    );


    showMessage(
      error.message ||
      "生徒登録画面を起動できませんでした。"
    );

  }

}


async function loadClassOptions() {
  const select = document.getElementById("studentClassId");
  if (!select) return;
  const { data, error } = await DB.from("classes").select("id,name,grade").order("grade").order("name");
  if (error) throw error;
  select.innerHTML = '<option value="">クラスを選択（任意）</option>' + (data || []).map(item =>
    `<option value="${escapeHtml(item.id)}" data-grade="${escapeHtml(item.grade || "")}" data-name="${escapeHtml(item.name || "")}">${escapeHtml(item.grade || "")} ${escapeHtml(item.name || "")}</option>`
  ).join("");
}

function applySelectedClass() {
  const select = document.getElementById("studentClassId");
  const option = select?.selectedOptions?.[0];
  if (!option?.value) return;
  document.getElementById("studentGrade").value = option.dataset.grade || "";
  document.getElementById("studentClass").value = option.dataset.name || "";
}

/* =========================================================
   SUBMIT
========================================================= */

async function handleSubmit(
  event
) {

  event.preventDefault();


  const name =
    document
      .getElementById(
        "studentName"
      )
      .value
      .trim();


  const grade =
    document
      .getElementById(
        "studentGrade"
      )
      .value
      .trim();


  const classSelect = document.getElementById("studentClassId");
  const selectedClass = classSelect?.selectedOptions?.[0];
  const classId = classSelect?.value || null;
  const className = (selectedClass?.dataset?.name || document.getElementById("studentClass").value).trim();
  const selectedGrade = (selectedClass?.dataset?.grade || grade).trim();
  const municipality = document.getElementById("studentMunicipality")?.value.trim() || "";
  const schoolName = document.getElementById("studentSchool")?.value.trim() || "";


  if (!name) {

    showMessage(
      "氏名を入力してください。"
    );

    return;

  }


  const button =
    document.getElementById(
      "saveButton"
    );


  button.disabled =
    true;


  button.textContent =
    "登録中...";


  showMessage(
    ""
  );


  try {

    /*
     * student_noはDB側の
     * BEFORE INSERT TRIGGERで
     * ランダム6桁を発行する。
     *
     * クライアント側では生成しない。
     */

    const {
      data,
      error
    } =
      await DB
        .from(
          "students"
        )
        .insert({

          name,

          grade:
            selectedGrade ||
            null,

          class_name:
            className ||
            null,

          class_id:
            classId,

          municipality: municipality || null,
          school_name: schoolName || null

        })
        .select(
          `
          id,
          student_no,
          name,
          grade,
          class_name
          `
        )
        .single();


    if (error) {

      throw error;

    }


    if (!data?.id) {

      throw new Error(
        "登録結果を取得できませんでした。"
      );

    }


    /*
     * alertではなく画面上で表示。
     */

    showMessage(
      `生徒を登録しました。\n生徒番号：${data.student_no || ""}`,
      "success"
    );


    /*
     * 登録後は一覧へ。
     */

    setTimeout(
      () => {

        location.href =
          "/teacher/students";

      },
      500
    );


  } catch (error) {

    console.error(
      "student insert:",
      error
    );


    showMessage(
      error.message ||
      "生徒登録に失敗しました。"
    );


    button.disabled =
      false;


    button.textContent =
      "登録する";

  }

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  text,
  type = "error"
) {

  const message =
    document.getElementById(
      "formMessage"
    );


  if (!message) {

    return;

  }


  message.textContent =
    text;


  message.style.color =
    type ===
      "success"
      ? "#16834b"
      : "#c62828";

}
