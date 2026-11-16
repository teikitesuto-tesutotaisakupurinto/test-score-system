
/* =========================================================
   テスト成績システム
   js/teacher/test-layout.js

   解答用紙 枠設定

   枠の種類
   ---------------------------------------------------------
   answer       解答欄
   qr           QRコードシール欄
   student_no   生徒番号欄
   name         氏名欄

   重要
   ---------------------------------------------------------
   question_id は必須ではない。

   現在のDBでは、
   layout_boxes.question_id が NULL の
   answer枠も採点対象として扱う。

   配点
   ---------------------------------------------------------
   layout_boxes.points を使用する。
========================================================= */


/* =========================================================
   URL
========================================================= */

const layoutParams =
  new URLSearchParams(
    window.location.search
  );


/*
 * 現在のページ構成では ?id=UUID。
 *
 * 念のため ?test=UUID も許可。
 */

const layoutTestId =
  layoutParams.get("id") ||
  layoutParams.get("test");


/* =========================================================
   STATE
========================================================= */

let pages =
  [];

let activePage =
  null;

let activeBoxType =
  "answer";

let boxElements =
  [];


/* =========================================================
   INIT
========================================================= */

async function initializeLayout() {

  try {

    /*
     * 認証
     */

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
        "/student/index.html";

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


    /*
     * テストID
     */

    if (!layoutTestId) {

      alert(
        "テストが指定されていません。"
      );


      window.location.href =
        "/teacher/tests";

      return;

    }


    setNavigation();


    await loadTest();


    await loadPages();


  } catch (error) {

    console.error(
      "test-layout initialize:",
      error
    );


    alert(
      error.message ||
      "枠設定を読み込めませんでした。"
    );

  }

}


/* =========================================================
   NAVIGATION
========================================================= */

function setNavigation() {

  const encoded =
    encodeURIComponent(
      layoutTestId
    );


  /*
   * 今回のZIPに実在するページだけを使用。
   */

  const pagesLink =
    document.getElementById(
      "pagesLink"
    );


  if (pagesLink) {

    pagesLink.href =
      `/teacher/tests/pages?id=${encoded}`;

  }


  const layoutLink =
    document.getElementById(
      "layoutLink"
    );


  if (layoutLink) {

    layoutLink.href =
      `/teacher/tests/layout?id=${encoded}`;

  }


  /*
   * questions.html は今回のZIPには存在しない。
   *
   * 配点設定へ移動する。
   */

  const questionsLink =
    document.getElementById(
      "questionsLink"
    );


  if (questionsLink) {

    questionsLink.href =
      `/teacher/tests/points?id=${encoded}`;

  }


  const pointsLink =
    document.getElementById(
      "pointsLink"
    );


  if (pointsLink) {

    pointsLink.href =
      `/teacher/tests/points?id=${encoded}`;

  }


  const modelAnswerLink =
    document.getElementById(
      "modelAnswerLink"
    );


  if (modelAnswerLink) {

    modelAnswerLink.href =
      `/teacher/tests/model-answer?id=${encoded}`;

  }

}


/* =========================================================
   LOAD TEST
========================================================= */

async function loadTest() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "tests"
      )
      .select(
        `
        id,
        name,
        subject,
        grade,
        class_name,
        max_score
        `
      )
      .eq(
        "id",
        layoutTestId
      )
      .maybeSingle();


  if (error) {

    console.error(
      "loadTest:",
      error
    );

    throw error;

  }


  if (!data) {

    throw new Error(
      "テストが見つかりません。"
    );

  }


  const information =
    document.getElementById(
      "testInformation"
    );


  if (information) {

    information.innerHTML = `

      <strong>
        ${escapeHtml(
          data.name
        )}
      </strong>

      ／

      ${escapeHtml(
        data.subject ||
        ""
      )}

      ／

      ${escapeHtml(
        data.grade ||
        ""
      )}

      ${
        data.class_name
          ? `
            ／
            ${escapeHtml(
              data.class_name
            )}
          `
          : ""
      }

      ／

      満点：
      ${escapeHtml(
        data.max_score ??
        ""
      )}

    `;

  }

}


/* =========================================================
   LOAD PAGES
========================================================= */

async function loadPages() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "test_pages"
      )
      .select(
        `
        id,
        page_no,
        image_path,
        width_px,
        height_px
        `
      )
      .eq(
        "test_id",
        layoutTestId
      )
      .order(
        "page_no",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      "loadPages:",
      error
    );

    throw error;

  }


  pages =
    data ||
    [];


  if (!pages.length) {

    const message =
      document.getElementById(
        "sheetMessage"
      );


    if (message) {

      message.textContent =
        "先に解答用紙を登録してください。";

    }


    return;

  }


  /*
   * ページ一覧が別UIにある場合
   */

  renderPageSelector();


  await showPage(
    pages[0]
  );

}


/* =========================================================
   PAGE SELECTOR
========================================================= */

function renderPageSelector() {

  const selector =
    document.getElementById(
      "pageSelect"
    );


  if (!selector) {

    return;

  }


  selector.innerHTML =
    "";


  pages.forEach(
    page => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        page.id;


      option.textContent =
        `${page.page_no}ページ`;


      selector.appendChild(
        option
      );

    }
  );


  selector.addEventListener(
    "change",
    async () => {

      const page =
        pages.find(
          item =>
            item.id ===
            selector.value
        );


      if (page) {

        await showPage(
          page
        );

      }

    }
  );

}


/* =========================================================
   SHOW PAGE
========================================================= */

async function showPage(
  page
) {

  activePage =
    page;


  const canvas =
    document.getElementById(
      "sheetCanvas"
    );


  if (!canvas) {

    throw new Error(
      "sheetCanvasがありません。"
    );

  }


  canvas.innerHTML =
    "";


  /*
   * 前ページの枠参照をクリア。
   */

  boxElements =
    [];


  /*
   * Storage
   *
   * 現在の構成では
   * model-answers bucketを使用。
   */

  let imageUrl =
    "";


  if (
    page.image_path
  ) {

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from(
          "model-answers"
        )
        .createSignedUrl(
          page.image_path,
          3600
        );


    if (error) {

      console.error(
        "signed url:",
        error
      );

    } else {

      imageUrl =
        data?.signedUrl ||
        "";

    }

  }


  const image =
    document.createElement(
      "img"
    );


  image.className =
    "sheet-background";


  image.draggable =
    false;


  if (imageUrl) {

    image.src =
      imageUrl;

  }


  image.onload =
    () => {

      resizeSheet(
        image.naturalWidth,
        image.naturalHeight
      );

    };


  canvas.appendChild(
    image
  );


  /*
   * 画像が取得できない場合
   */

  if (!imageUrl) {

    const message =
      document.createElement(
        "div"
      );


    message.className =
      "sheet-message";


    message.textContent =
      "解答用紙画像を表示できません。";


    canvas.appendChild(
      message
    );

  }


  /*
   * ページ番号
   */

  const pageLabel =
    document.createElement(
      "div"
    );


  pageLabel.className =
    "sheet-page-label";


  pageLabel.textContent =
    `${page.page_no}ページ`;


  canvas.appendChild(
    pageLabel
  );


  /*
   * 既存枠
   */

  await loadExistingBoxes(
    page.page_no
  );

}


/* =========================================================
   RESIZE
========================================================= */

function resizeSheet(
  width,
  height
) {

  const sheet =
    document.getElementById(
      "sheetCanvas"
    );


  if (!sheet) {

    return;

  }


  const maxWidth =
    Math.min(
      900,
      Math.max(
        400,
        window.innerWidth -
          300
      )
    );


  const scale =
    width > maxWidth
      ? maxWidth / width
      : 1;


  sheet.style.width =
    `${width * scale}px`;


  sheet.style.height =
    `${height * scale}px`;


  sheet.dataset.originalWidth =
    width;


  sheet.dataset.originalHeight =
    height;


  sheet.dataset.scale =
    scale;

}


/* =========================================================
   LOAD EXISTING BOXES
========================================================= */

async function loadExistingBoxes(
  pageNo
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "layout_boxes"
      )
      .select(
        `
        id,
        box_type,
        label,
        x,
        y,
        width,
        height,
        question_id,
        points,
        sort_order
        `
      )
      .eq(
        "test_id",
        layoutTestId
      )
      .eq(
        "page_no",
        pageNo
      )
      .order(
        "sort_order",
        {
          ascending:
            true
        }
      );


  if (error) {

    console.error(
      "loadExistingBoxes:",
      error
    );

    throw error;

  }


  (data || [])
    .forEach(
      box => {

        createBoxElement(
          box,
          false
        );

      }
    );

}


/* =========================================================
   CREATE BOX
========================================================= */

function createBoxElement(
  box,
  allowSave = true
) {

  const sheet =
    document.getElementById(
      "sheetCanvas"
    );


  if (!sheet) {

    return null;

  }


  const element =
    document.createElement(
      "div"
    );


  element.className =
    "layout-box";


  if (
    box.box_type ===
    "qr"
  ) {

    element.classList.add(
      "qr-box"
    );

  }


  if (
    box.box_type ===
    "student_no"
  ) {

    element.classList.add(
      "student-no-box"
    );

  }


  if (
    box.box_type ===
    "name"
  ) {

    element.classList.add(
      "name-box"
    );

  }


  element.dataset.id =
    box.id ||
    "";


  element.dataset.type =
    box.box_type ||
    "answer";


  /*
   * question_idはNULLを許可。
   */

  element.dataset.questionId =
    box.question_id ||
    "";


  element.dataset.points =
    Number(
      box.points
    ) || 0;


  element.dataset.pageNo =
    activePage?.page_no ||
    1;


  /*
   * 座標
   */

  element.style.left =
    `${Number(
      box.x
    ) || 0}px`;


  element.style.top =
    `${Number(
      box.y
    ) || 0}px`;


  element.style.width =
    `${Number(
      box.width
    ) || 100}px`;


  element.style.height =
    `${Number(
      box.height
    ) || 60}px`;


  const label =
    document.createElement(
      "div"
    );


  label.className =
    "layout-label";


  label.textContent =
    box.label ||
    getBoxLabel(
      box.box_type
    );


  element.appendChild(
    label
  );


  /*
   * 配点表示
   */

  if (
    box.box_type ===
    "answer"
  ) {

    const points =
      document.createElement(
        "span"
      );


    points.className =
      "layout-points";


    points.textContent =
      `${formatNumber(
        box.points
      )}点`;


    element.appendChild(
      points
    );

  }


  /*
   * ドラッグ
   */

  let dragging =
    false;


  let offsetX =
    0;


  let offsetY =
    0;


  element.addEventListener(
    "pointerdown",
    event => {

      dragging =
        true;


      offsetX =
        event.clientX -
        element.getBoundingClientRect().left;


      offsetY =
        event.clientY -
        element.getBoundingClientRect().top;


      element.setPointerCapture(
        event.pointerId
      );


      event.preventDefault();

    }
  );


  element.addEventListener(
    "pointermove",
    event => {

      if (!dragging) {

        return;

      }


      const sheetRect =
        sheet.getBoundingClientRect();


      const x =
        event.clientX -
        sheetRect.left -
        offsetX;


      const y =
        event.clientY -
        sheetRect.top -
        offsetY;


      element.style.left =
        `${Math.max(
          0,
          x
        )}px`;


      element.style.top =
        `${Math.max(
          0,
          y
        )}px`;

    }
  );


  element.addEventListener(
    "pointerup",
    event => {

      dragging =
        false;


      try {

        element.releasePointerCapture(
          event.pointerId
        );

      } catch (_) {}

    }
  );


  /*
   * ダブルクリック削除
   */

  element.addEventListener(
    "dblclick",
    async event => {

      event.stopPropagation();


      if (
        !window.confirm(
          "この枠を削除しますか？"
        )
      ) {

        return;

      }


      if (
        element.dataset.id
      ) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "layout_boxes"
            )
            .delete()
            .eq(
              "id",
              element.dataset.id
            );


        if (error) {

          alert(
            error.message
          );

          return;

        }

      }


      element.remove();


      boxElements =
        boxElements.filter(
          item =>
            item !==
            element
        );

    }
  );


  sheet.appendChild(
    element
  );


  boxElements.push(
    element
  );


  return element;

}


/* =========================================================
   BOX LABEL
========================================================= */

function getBoxLabel(
  type
) {

  const labels = {

    answer:
      "解答欄",

    qr:
      "QRコードシール欄",

    student_no:
      "生徒番号欄",

    name:
      "氏名欄"

  };


  return (
    labels[type] ||
    "枠"
  );

}


/* =========================================================
   BUTTONS
========================================================= */

function bindButton(
  id,
  type
) {

  const button =
    document.getElementById(
      id
    );


  if (!button) {

    return;

  }


  button.addEventListener(
    "click",
    () => {

      activeBoxType =
        type;


      activateButton(
        id
      );

    }
  );

}


bindButton(
  "answerBoxButton",
  "answer"
);


bindButton(
  "qrBoxButton",
  "qr"
);


bindButton(
  "studentNoBoxButton",
  "student_no"
);


bindButton(
  "nameBoxButton",
  "name"
);


/* =========================================================
   ACTIVE BUTTON
========================================================= */

function activateButton(
  id
) {

  [
    "answerBoxButton",
    "qrBoxButton",
    "studentNoBoxButton",
    "nameBoxButton"
  ]
    .forEach(
      buttonId => {

        const button =
          document.getElementById(
            buttonId
          );


        if (button) {

          button.classList.remove(
            "btn-primary"
          );

        }

      }
    );


  document
    .getElementById(
      id
    )
    ?.classList.add(
      "btn-primary"
    );

}


/* =========================================================
   ADD BOX
========================================================= */

const sheetCanvas =
  document.getElementById(
    "sheetCanvas"
  );


sheetCanvas?.addEventListener(
  "dblclick",
  event => {

    if (
      event.target.closest(
        ".layout-box"
      )
    ) {

      return;

    }


    if (!activePage) {

      return;

    }


    const rect =
      sheetCanvas.getBoundingClientRect();


    const x =
      event.clientX -
      rect.left;


    const y =
      event.clientY -
      rect.top;


    const scale =
      Number(
        sheetCanvas.dataset.scale
      ) || 1;


    const originalX =
      x /
      scale;


    const originalY =
      y /
      scale;


    const defaultWidth =
      activeBoxType ===
        "qr"
        ? 100
        : 160;


    const defaultHeight =
      activeBoxType ===
        "qr"
        ? 65
        : 80;


    createBoxElement({

      id:
        null,

      box_type:
        activeBoxType,

      label:
        getBoxLabel(
          activeBoxType
        ),

      x:
        Math.max(
          0,
          originalX -
            defaultWidth /
            2
        ),

      y:
        Math.max(
          0,
          originalY -
            defaultHeight /
            2
        ),

      width:
        defaultWidth,

      height:
        defaultHeight,

      question_id:
        null,

      points:
        0

    });


  }
);


/* =========================================================
   SAVE
========================================================= */

document
  .getElementById(
    "saveButton"
  )
  ?.addEventListener(
    "click",
    saveLayout
  );


async function saveLayout() {

  if (!activePage) {

    alert(
      "ページがありません。"
    );

    return;

  }


  const sheet =
    document.getElementById(
      "sheetCanvas"
    );


  const scale =
    Number(
      sheet.dataset.scale
    ) || 1;


  const elements =
    [
      ...
      document.querySelectorAll(
        "#sheetCanvas .layout-box"
      )
    ];


  if (!elements.length) {

    alert(
      "保存する枠がありません。"
    );

    return;

  }


  try {

    /*
     * 既存ページの枠を一度同期。
     *
     * ただし全削除して再作成はしない。
     */

    for (
      const element
      of elements
    ) {

      const x =
        parseFloat(
          element.style.left
        ) ||
        0;


      const y =
        parseFloat(
          element.style.top
        ) ||
        0;


      const width =
        parseFloat(
          element.style.width
        ) ||
        0;


      const height =
        parseFloat(
          element.style.height
        ) ||
        0;


      const type =
        element.dataset.type ||
        "answer";


      const points =
        Number(
          element.dataset.points
        ) || 0;


      const values = {

        test_id:
          layoutTestId,

        page_no:
          activePage.page_no,

        box_type:
          type,

        label:
          getBoxLabel(
            type
          ),

        x:
          x /
          scale,

        y:
          y /
          scale,

        width:
          width /
          scale,

        height:
          height /
          scale,

        /*
         * NULL許可。
         */

        question_id:
          element.dataset.questionId ||
          null,

        points:
          points

      };


      if (
        element.dataset.id
      ) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "layout_boxes"
            )
            .update(
              values
            )
            .eq(
              "id",
              element.dataset.id
            );


        if (error) {

          throw error;

        }

      } else {

        const {
          data,
          error
        } =
          await supabaseClient
            .from(
              "layout_boxes"
            )
            .insert(
              values
            )
            .select(
              `
              id,
              points
              `
            )
            .single();


        if (error) {

          throw error;

        }


        element.dataset.id =
          data.id;


        element.dataset.points =
          Number(
            data.points
          ) || 0;

      }

    }


    alert(
      "枠設定を保存しました。"
    );


  } catch (error) {

    console.error(
      "saveLayout:",
      error
    );


    alert(
      error.message ||
      "枠設定の保存に失敗しました。"
    );

  }

}


/* =========================================================
   LOGOUT
========================================================= */

document
  .getElementById(
    "logoutButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      if (
        typeof window.logout ===
        "function"
      ) {

        await window.logout();

      }

    }
  );


/* =========================================================
   FORMAT
========================================================= */

function formatNumber(
  value
) {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return "0";

  }


  return Number.isInteger(
    number
  )
    ? String(
        number
      )
    : number.toFixed(
        1
      );

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


/* =========================================================
   START
========================================================= */

initializeLayout();
