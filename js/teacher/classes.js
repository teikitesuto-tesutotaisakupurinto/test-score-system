
"use strict";

/* =========================================================
   クラス一覧
========================================================= */

let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeClasses
);


async function initializeClasses() {

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


    await loadClasses();


  } catch (error) {

    console.error(
      "classes:",
      error
    );


    showClassError(
      error.message ||
      "クラス情報を取得できませんでした。"
    );

  }

}


/* =========================================================
   LOAD CLASSES
========================================================= */

async function loadClasses() {
  const { data: classes, error } = await DB
    .from("classes")
    .select("id,name,grade")
    .order("grade", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;

  const { data: students, error: studentsError } = await DB
    .from("students")
    .select("id,class_id,grade,class_name,active");
  if (studentsError) throw studentsError;

  const allStudents = students || [];
  const validClassIds = new Set((classes || []).map(item => item.id));
  const rows = (classes || []).map(classItem => {
    // 有効なclass_idを最優先。削除済みクラスIDを持つ旧データは学年・クラス名で復旧表示する。
    const members = allStudents.filter(student => {
      if (student.active === false) return false;
      const linkedClassId = student.class_id || null;
      if (linkedClassId && validClassIds.has(linkedClassId)) {
        return linkedClassId === classItem.id;
      }
      return String(student.grade || "").trim() === String(classItem.grade || "").trim()
        && String(student.class_name || "").trim() === String(classItem.name || "").trim();
    });
    return { ...classItem, studentCount: members.length };
  });
  renderClasses(rows);
}


/* =========================================================
   RENDER
========================================================= */

function renderClasses(
  classes
) {

  const tbody =
    document.getElementById(
      "classRows"
    );


  if (!tbody) {

    return;

  }


  if (!classes.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="4"
          style="
            text-align:center;
            padding:30px;
            color:#777;
          "
        >

          クラスが登録されていません。

          <br><br>

          <a
            href="/teacher/classes/new"
            class="btn btn-primary"
          >
            クラスを作成
          </a>

        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML =
    classes
      .map(
        classItem => `

          <tr>


            <td>

              ${escapeHtml(
                classItem.grade ||
                ""
              )}

            </td>


            <td>

              ${escapeHtml(
                classItem.name ||
                ""
              )}

            </td>


            <td>

              ${formatNumber(
                classItem.studentCount
              )}人

            </td>


            <td>

              <div
                style="
                  display:flex;
                  gap:6px;
                  flex-wrap:wrap;
                "
              >

                <a
                  href="/teacher/classes/students?id=${encodeURIComponent(
                    classItem.id
                  )}"
                  class="btn"
                >
                  生徒を見る
                </a>


                <a
                  href="/teacher/classes/students?id=${encodeURIComponent(
                    classItem.id
                  )}"
                  class="btn"
                >
                  名簿
                </a>

              </div>

            </td>


          </tr>

        `
      )
      .join("");

}


/* =========================================================
   ERROR
========================================================= */

function showClassError(
  message
) {

  const tbody =
    document.getElementById(
      "classRows"
    );


  if (!tbody) {

    return;

  }


  tbody.innerHTML = `

    <tr>

      <td
        colspan="4"
        style="
          text-align:center;
          padding:30px;
          color:#c62828;
        "
      >

        ${escapeHtml(
          message
        )}

      </td>

    </tr>

  `;


  const messageElement =
    document.getElementById(
      "classMessage"
    );


  if (messageElement) {

    messageElement.textContent =
      message;

    messageElement.style.color =
      "#b42318";

  }

}


/* =========================================================
   NUMBER
========================================================= */

function formatNumber(
  value
) {

  const n =
    Number(
      value
    );


  if (
    !Number.isFinite(
      n
    )
  ) {

    return "0";

  }


  return Number.isInteger(
    n
  )
    ? String(n)
    : n.toFixed(1);

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
