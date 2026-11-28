
"use strict";

/* =========================================================
   生徒編集
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );

const studentId =
  params.get(
    "id"
  );


let DB =
  null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeStudentEdit
);


async function initializeStudentEdit() {

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


    if (!studentId) {

      showError(
        "生徒が指定されていません。"
      );

      return;

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
        "saveButton"
      )
      ?.addEventListener(
        "click",
        saveStudent
      );


    await loadClassOptions();
    await loadStudent();


  } catch (error) {

    console.error(
      "student-edit:",
      error
    );


    showError(
      error.message ||
      "生徒編集画面を起動できませんでした。"
    );

  }

}


async function loadClassOptions() {
  const select = document.getElementById("studentClassId");
  if (!select) return;
  const { data, error } = await DB.from("classes").select("id,name,grade").order("grade").order("name");
  if (error) {
    console.warn("登録済みクラス一覧を取得できません。クラス名の手入力で編集できます。", error);
    return;
  }
  select.innerHTML = '<option value="">クラス未所属</option>' + (data || []).map(item =>
    `<option value="${escapeHtml(item.id)}" data-grade="${escapeHtml(item.grade || "")}" data-name="${escapeHtml(item.name || "")}">${escapeHtml(item.grade || "")} ${escapeHtml(item.name || "")}</option>`
  ).join("");
}

/* =========================================================
   LOAD
========================================================= */

async function loadStudent() {

  const {
    data,
    error
  } =
    await DB
      .from(
        "students"
      )
      .select(
        `
        id,
        student_no,
        name,
        grade,
        class_name,
        active,
        municipality,
        school_name
        `
      )
      .eq(
        "id",
        studentId
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  if (!data) {

    throw new Error(
      "指定された生徒が見つかりません。"
    );

  }


  document.getElementById(
    "studentNo"
  ).value =
    data.student_no ||
    "";


  document.getElementById(
    "studentName"
  ).value =
    data.name ||
    "";


  document.getElementById(
    "studentGrade"
  ).value =
    data.grade ||
    "";


  document.getElementById("studentClass").value = data.class_name || "";
  const classSelect = document.getElementById("studentClassId");
  if (classSelect) {
    let selectedId = data.class_id || "";
    if (!selectedId) {
      const match = [...classSelect.options].find(option =>
        option.value && option.dataset.grade === String(data.grade || "")
        && option.dataset.name === String(data.class_name || "")
      );
      selectedId = match?.value || "";
    }
    classSelect.value = selectedId;
  }
  document.getElementById("studentMunicipality").value = data.municipality || "";
  document.getElementById("studentSchool").value = data.school_name || "";


  document.getElementById(
    "studentActive"
  ).value =
    data.active
      ? "true"
      : "false";


  document.getElementById(
    "loading"
  ).style.display =
    "none";


  document.getElementById(
    "editArea"
  ).style.display =
    "block";

}


/* =========================================================
   SAVE
========================================================= */

async function saveStudent() {

  const name =
    document.getElementById(
      "studentName"
    )
      .value
      .trim();


  const grade =
    document.getElementById(
      "studentGrade"
    )
      .value
      .trim();


  const classSelect = document.getElementById("studentClassId");
  const selectedClass = classSelect?.selectedOptions?.[0];
  const classId = classSelect?.value || null;
  const className = (selectedClass?.dataset?.name || document.getElementById("studentClass").value).trim();
  const selectedGrade = (selectedClass?.dataset?.grade || grade).trim();


  const active = document.getElementById("studentActive").value === "true";
  const municipality = document.getElementById("studentMunicipality")?.value.trim() || "";
  const schoolName = document.getElementById("studentSchool")?.value.trim() || "";


  if (!name) {

    showEditMessage(
      "氏名を入力してください。",
      true
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
    "保存中...";


  showEditMessage(
    ""
  );


  try {

    const {
      error
    } =
      await DB
        .from(
          "students"
        )
        .update({

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
          school_name: schoolName || null,

          active

        })
        .eq(
          "id",
          studentId
        );


    if (error) {

      throw error;

    }


    showEditMessage(
      "生徒情報を保存しました。",
      false
    );


    setTimeout(
      () => {

        window.location.href =
          "/teacher/students";

      },
      500
    );


  } catch (error) {

    console.error(
      "student update:",
      error
    );


    showEditMessage(
      error.message ||
      "保存に失敗しました。",
      true
    );


    button.disabled =
      false;


    button.textContent =
      "保存する";

  }

}


/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {

  const loading =
    document.getElementById(
      "loading"
    );


  if (!loading) {

    return;

  }


  loading.innerHTML = `

    <div
      style="
        color:#c62828;
      "
    >

      ${escapeHtml(
        message
      )}

    </div>

    <br>

    <a
      href="/teacher/students"
      class="btn"
    >
      生徒一覧へ戻る
    </a>

  `;

}


/* =========================================================
   MESSAGE
========================================================= */

function showEditMessage(
  text,
  error = false
) {

  const element =
    document.getElementById(
      "editMessage"
    );


  if (!element) {

    return;

  }


  element.textContent =
    text;


  element.style.color =
    error
      ? "#c62828"
      : "#16834b";

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
