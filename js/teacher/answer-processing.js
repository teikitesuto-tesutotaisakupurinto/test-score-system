
"use strict";

/* =========================================================
   答案処理状況

   状態
   ---------------------------------------------------------
   unmatched
     QR未読取 / 生徒未紐付け

   uploaded
     生徒紐付け済み・採点待ち

   marking
     採点中

   marked
     採点完了

   published
     結果公開済み

   注意
   ---------------------------------------------------------
   ・この画面では採点処理を実行しない
   ・単なる待機画面にしない
   ・現在DBに保存されている実状態を表示
   ・公開は成績処理側が自動実行
========================================================= */

let DB = null;

let answerList = [];


/* =========================================================
   DOM
========================================================= */

const rows =
  document.getElementById(
    "processingRows"
  );


const message =
  document.getElementById(
    "message"
  );


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


async function initialize() {

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
        "reloadButton"
      )
      ?.addEventListener(
        "click",
        loadProcessing
      );


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


    await loadProcessing();


  } catch (error) {

    console.error(
      "answer-processing:",
      error
    );


    showError(
      error.message ||
      "答案処理状況を取得できませんでした。"
    );

  }

}


/* =========================================================
   LOAD
========================================================= */

async function loadProcessing() {

  setMessage(
    "答案処理状況を取得しています..."
  );


  const {
    data,
    error
  } =
    await DB
      .from(
        "answer_sheets"
      )
      .select(
        `
        id,
        test_id,
        student_id,
        qr_value,
        status,
        created_at,
        uploaded_at,

        tests(
          id,
          name,
          subject,
          grade
        ),

        students(
          id,
          student_no,
          name
        )
        `
      )
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    throw error;

  }


  answerList =
    data ||
    [];


  renderSummary();

  renderRows();


  setMessage(
    `答案 ${answerList.length}件を表示しています。`
  );

}


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {

  const total =
    answerList.length;


  const unmatched =
    answerList.filter(
      answer =>
        answer.status ===
          "unmatched" ||
        !answer.student_id
    ).length;


  const uploaded =
    answerList.filter(
      answer =>
        answer.status ===
        "uploaded"
    ).length;


  const marking =
    answerList.filter(
      answer =>
        answer.status ===
        "marking"
    ).length;


  const marked =
    answerList.filter(
      answer =>
        answer.status ===
        "marked"
    ).length;


  const published =
    answerList.filter(
      answer =>
        answer.status ===
        "published"
    ).length;


  setText(
    "totalCount",
    total
  );


  setText(
    "unmatchedCount",
    unmatched
  );


  setText(
    "uploadedCount",
    uploaded
  );


  /*
   * 現在HTMLでは
   * 採点中専用カードを設けていない。
   *
   * markedはそのまま表示。
   */

  setText(
    "markedCount",
    marked +
    marking
  );


  setText(
    "publishedCount",
    published
  );

}


/* =========================================================
   ROWS
========================================================= */

function renderRows() {

  if (!rows) {

    return;

  }


  if (!answerList.length) {

    rows.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="empty"
        >
          答案がありません。
        </td>

      </tr>

    `;

    return;

  }


  rows.innerHTML =
    "";


  answerList.forEach(
    answer => {

      rows.appendChild(
        createRow(
          answer
        )
      );

    }
  );

}


/* =========================================================
   ROW
========================================================= */

function createRow(
  answer
) {

  const row =
    document.createElement(
      "tr"
    );


  /*
   * 日時
   */

  const date =
    document.createElement(
      "td"
    );


  date.textContent =
    formatDate(
      answer.created_at ||
      answer.uploaded_at
    );


  /*
   * テスト
   */

  const test =
    document.createElement(
      "td"
    );


  test.textContent =
    [
      answer.tests?.name,
      answer.tests?.subject,
      answer.tests?.grade
    ]
      .filter(
        value =>
          value !== null &&
          value !== undefined &&
          String(
            value
          ).trim() !== ""
      )
      .join(
        " / "
      );


  /*
   * 生徒
   */

  const student =
    document.createElement(
      "td"
    );


  if (
    answer.students
  ) {

    student.textContent =
      [
        answer.students.student_no,
        answer.students.name
      ]
        .filter(
          value =>
            value !== null &&
            value !== undefined &&
            String(
              value
            ).trim() !== ""
        )
        .join(
          " / "
        );

  } else {

    student.textContent =
      "未紐付け";

  }


  /*
   * QR
   */

  const qr =
    document.createElement(
      "td"
    );


  qr.textContent =
    answer.qr_value
      ? "読み取り済み"
      : "未読取";


  /*
   * 状態
   */

  const state =
    document.createElement(
      "td"
    );


  state.innerHTML =
    getStatusHtml(
      answer
    );


  /*
   * 操作
   */

  const action =
    document.createElement(
      "td"
    );


  const actions =
    document.createElement(
      "div"
    );


  actions.style.display =
    "flex";


  actions.style.gap =
    "6px";


  actions.style.flexWrap =
    "wrap";


  /*
   * 未紐付け
   */

  if (
    answer.status ===
      "unmatched" ||
    !answer.student_id
  ) {

    const link =
      document.createElement(
        "a"
      );


    link.className =
      "btn";


    link.href =
      `/teacher/answers/matched?test=${encodeURIComponent(
        answer.test_id
      )}`;


    link.textContent =
      "紐付け";

    
    actions.appendChild(
      link
    );

  }


  /*
   * 採点
   */

  if (
    answer.student_id &&
    (
      answer.status ===
        "uploaded" ||
      answer.status ===
        "marking" ||
      answer.status ===
        "marked"
    )
  ) {

    const link =
      document.createElement(
        "a"
      );


    link.className =
      "btn";


    link.href =
      `/teacher/marking?test=${encodeURIComponent(
        answer.test_id
      )}`;


    link.textContent =
      "採点";


    actions.appendChild(
      link
    );

  }


  /*
   * 採点済み答案返却
   */

  if (
    answer.status ===
    "marked"
  ) {

    const link =
      document.createElement(
        "a"
      );


    link.className =
      "btn";


    link.href =
      `/teacher/results/return?answer=${encodeURIComponent(
        answer.id
      )}`;


    link.textContent =
      "答案を見る";


    actions.appendChild(
      link
    );

  }


  if (!actions.children.length) {

    actions.textContent =
      "-";

  }


  action.appendChild(
    actions
  );


  row.append(
    date,
    test,
    student,
    qr,
    state,
    action
  );


  return row;

}


/* =========================================================
   STATUS
========================================================= */

function getStatusHtml(
  answer
) {

  const status =
    answer.status;


  if (
    status ===
      "unmatched" ||
    !answer.student_id
  ) {

    return `

      <span
        class="status-badge status-unmatched"
      >
        未紐付け
      </span>

    `;

  }


  if (
    status ===
    "uploaded"
  ) {

    return `

      <span
        class="status-badge status-uploaded"
      >
        採点待ち
      </span>

    `;

  }


  if (
    status ===
    "marking"
  ) {

    return `

      <span
        class="status-badge status-uploaded"
      >
        採点中
      </span>

    `;

  }


  if (
    status ===
    "marked"
  ) {

    return `

      <span
        class="status-badge status-marked"
      >
        採点済み
      </span>

    `;

  }


  if (
    status ===
    "published"
  ) {

    return `

      <span
        class="status-badge status-marked"
      >
        公開済み
      </span>

    `;

  }


  return `

    <span
      class="status-badge status-other"
    >
      ${escapeHtml(
        status ||
        "不明"
      )}
    </span>

  `;

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


function setMessage(
  text
) {

  if (!message) {

    return;

  }


  message.textContent =
    text;


  message.className =
    "";

}


function showError(
  text
) {

  if (!message) {

    return;

  }


  message.textContent =
    text;


  message.className =
    "error";

}


function formatDate(
  value
) {

  if (!value) {

    return "-";

  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }


  return date.toLocaleString(
    "ja-JP"
  );

}


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
