
"use strict";

/* =========================================================
   教師ダッシュボード

   状態
   ---------------------------------------------------------
   uploaded
      採点待ち

   marking
      採点中

   marked
      採点済み

   公開
      tests.results_published = true
========================================================= */

let DB = null;


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeDashboard
);


async function initializeDashboard() {

  try {

    DB =
      window.supabaseClient ||
      window.SB;


    if (!DB) {

      throw new Error(
        "Supabase接続がありません。"
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


    setupEvents();


    await loadCounts();


  } catch (error) {

    console.error(
      "dashboard:",
      error
    );


    showDashboardError(
      error.message ||
      "ダッシュボードを読み込めませんでした。"
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

}


/* =========================================================
   COUNTS
========================================================= */

async function loadCounts() {

  await Promise.all([

    loadStudentCount(),

    loadTestCount(),

    loadUnmarkedCount(),

    loadPublishedCount()

  ]);

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudentCount() {

  const {
    count,
    error
  } =
    await DB
      .from(
        "students"
      )
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
        "active",
        true
      );


  if (error) {

    console.error(
      "生徒数:",
      error
    );

  }


  setText(
    "studentCount",
    count ??
    0
  );

}


/* =========================================================
   TESTS
========================================================= */

async function loadTestCount() {

  const {
    count,
    error
  } =
    await DB
      .from(
        "tests"
      )
      .select(
        "id",
        {
          count:
            "exact",
          head:
            true
        }
      );


  if (error) {

    console.error(
      "テスト数:",
      error
    );

  }


  setText(
    "testCount",
    count ??
    0
  );

}


/* =========================================================
   UNMARKED
========================================================= */

async function loadUnmarkedCount() {

  const {
    count,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        "id",
        {
          count:
            "exact",
          head:
            true
        }
      )
      .in(
        "status",
        [
          "uploaded",
          "marking"
        ]
      )
      .not(
        "student_id",
        "is",
        null
      );


  if (error) {

    console.error(
      "未採点答案数:",
      error
    );

  }


  setText(
    "unmarkedCount",
    count ??
    0
  );

}


/* =========================================================
   PUBLISHED
========================================================= */

async function loadPublishedCount() {

  const {
    count,
    error
  } =
    await DB
      .from(
        "tests"
      )
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
        "results_published",
        true
      );


  if (error) {

    console.error(
      "公開済みテスト:",
      error
    );

  }


  setText(
    "publishedCount",
    count ??
    0
  );

}


/* =========================================================
   HELPERS
========================================================= */

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      String(
        value
      );

  }

}


function showDashboardError(
  message
) {

  console.error(
    message
  );


  const elements = [

    "studentCount",

    "testCount",

    "unmarkedCount",

    "publishedCount"

  ];


  elements.forEach(
    id => {

      setText(
        id,
        "-"
      );

    }
  );

}
