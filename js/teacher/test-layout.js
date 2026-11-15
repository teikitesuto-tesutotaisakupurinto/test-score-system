/* =========================================================
   解答用紙 枠設定

   枠の種類
   - answer       解答欄
   - qr            QRコードシール欄
   - student_no    生徒番号欄
   - name          氏名欄
========================================================= */


const layoutParams =
  new URLSearchParams(
    window.location.search
  );


const layoutTestId =
  layoutParams.get("id");


let pages = [];

let activePage = null;

let activeBoxType =
  "answer";

let boxElements = [];


async function initializeLayout() {

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

}


function setNavigation() {

  document.getElementById(
    "pagesLink"
  ).href =
    `/teacher/tests/pages?id=${encodeURIComponent(layoutTestId)}`;


  document.getElementById(
    "layoutLink"
  ).href =
    `/teacher/tests/layout?id=${encodeURIComponent(layoutTestId)}`;


  document.getElementById(
    "questionsLink"
  ).href =
    `/teacher/tests/questions?id=${encodeURIComponent(layoutTestId)}`;


  document.getElementById(
    "modelAnswerLink"
  ).href =
    `/teacher/tests/model-answer?id=${encodeURIComponent(layoutTestId)}`;

}


async function loadTest() {

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
        class_name,
        max_score
      `)
      .eq(
        "id",
        layoutTestId
      )
      .maybeSingle();


  if (error) {

    console.error(error);

    return;

  }


  if (!data) {

    alert(
      "テストが見つかりません。"
    );

    return;

  }


  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(
        data.name
      )}
    </strong>

    ／

    ${escapeHtml(
      data.subject || ""
    )}

    ／

    ${escapeHtml(
      data.grade || ""
    )}

    ／

    満点：
    ${data.max_score}

  `;

}


async function loadPages() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("test_pages")
      .select(`
        id,
        page_no,
        image_path,
        width_px,
        height_px
      `)
      .eq(
        "test_id",
        layoutTestId
      )
      .order(
        "page_no"
      );


  if (error) {

    console.error(error);

    return;

  }


  pages =
    data || [];


  if (!pages.length) {

    document.getElementById(
      "sheetMessage"
    ).textContent =
      "先に解答用紙を登録してください。";

    return;

  }


  await showPage(
    pages[0]
  );

}


async function showPage(
  page
) {

  activePage =
    page;


  const canvas =
    document.getElementById(
      "sheetCanvas"
    );


  canvas.innerHTML = "";


  /*
    Storageのprivate画像なので
    signed URLを発行する
  */

  let imageUrl = "";


  if (
    page.image_path
  ) {

    const {
      data,
      error
    } =
      await supabaseClient
        .storage
        .from("model-answers")
        .createSignedUrl(
          page.image_path,
          3600
        );


    if (!error) {

      imageUrl =
        data?.signedUrl || "";

    }

  }


  const image =
    document.createElement(
      "img"
    );


  image.className =
    "sheet-background";


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
    ページ番号
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
    既存枠
  */

  await loadExistingBoxes(
    page.page_no
  );

}


function resizeSheet(
  width,
  height
) {

  const sheet =
    document.getElementById(
      "sheetCanvas"
    );


  const maxWidth =
    Math.min(
      900,
      window.innerWidth - 300
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


async function loadExistingBoxes(
  pageNo
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("layout_boxes")
      .select(`
        id,
        box_type,
        label,
        x,
        y,
        width,
        height,
        question_id
      `)
      .eq(
        "test_id",
        layoutTestId
      )
      .eq(
        "page_no",
        pageNo
      )
      .order(
        "created_at"
      );


  if (error) {

    console.error(error);

    return;

  }


  (data || [])
    .forEach(
      box =>
        createBoxElement(
          box,
          false
        )
    );

}


function createBoxElement(
  box,
  allowSave = true
) {

  const sheet =
    document.getElementById(
      "sheetCanvas"
    );


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
    box.id || "";


  element.dataset.type =
    box.box_type;


  element.dataset.questionId =
    box.question_id || "";


  element.style.left =
    `${box.x}px`;


  element.style.top =
    `${box.y}px`;


  element.style.width =
    `${box.width}px`;


  element.style.height =
    `${box.height}px`;


  const label =
    document.createElement(
      "div"
    );


  label.className =
    "layout-label";


  label.textContent =
    getBoxLabel(
      box.box_type
    );


  element.appendChild(
    label
  );


  /*
    ドラッグ移動
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

      if (
        event.target ===
        label
      ) {

        dragging =
          true;

      } else {

        dragging =
          true;

      }


      offsetX =
        event.clientX -
        element.offsetLeft;


      offsetY =
        event.clientY -
        element.offsetTop;


      element.setPointerCapture(
        event.pointerId
      );

    }
  );


  element.addEventListener(
    "pointermove",
    event => {

      if (!dragging) {
        return;
      }


      element.style.left =
        `${event.clientX - offsetX}px`;


      element.style.top =
        `${event.clientY - offsetY}px`;

    }
  );


  element.addEventListener(
    "pointerup",
    () => {

      dragging =
        false;

    }
  );


  /*
    ダブルクリックで削除
  */

  element.addEventListener(
    "dblclick",
    async () => {

      if (
        !confirm(
          "この枠を削除しますか？"
        )
      ) {

        return;

      }


      if (
        element.dataset.id
      ) {

        await supabaseClient
          .from(
            "layout_boxes"
          )
          .delete()
          .eq(
            "id",
            element.dataset.id
          );

      }


      element.remove();

    }
  );


  sheet.appendChild(
    element
  );


  boxElements.push(
    element
  );

}


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
      "氏名欄",

    other:
      "その他"

  };


  return labels[type]
    || "枠";

}


/*
  ツール選択
*/

document
  .getElementById(
    "answerBoxButton"
  )
  .addEventListener(
    "click",
    () => {

      activeBoxType =
        "answer";

      activateButton(
        "answerBoxButton"
      );

    }
  );


document
  .getElementById(
    "qrBoxButton"
  )
  .addEventListener(
    "click",
    () => {

      activeBoxType =
        "qr";

      activateButton(
        "qrBoxButton"
      );

    }
  );


document
  .getElementById(
    "studentNoBoxButton"
  )
  .addEventListener(
    "click",
    () => {

      activeBoxType =
        "student_no";

      activateButton(
        "studentNoBoxButton"
      );

    }
  );


document
  .getElementById(
    "nameBoxButton"
  )
  .addEventListener(
    "click",
    () => {

      activeBoxType =
        "name";

      activateButton(
        "nameBoxButton"
      );

    }
  );


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


        button.classList.remove(
          "btn-primary"
        );

      }
    );


  document
    .getElementById(
      id
    )
    .classList.add(
      "btn-primary"
    );

}


/*
  枠を追加
*/

document
  .getElementById(
    "sheetCanvas"
  )
  .addEventListener(
    "dblclick",
    event => {

      /*
        既存の枠をダブルクリックした場合は
        そちらの削除処理に任せる
      */

      if (
        event.target.closest(
          ".layout-box"
        )
      ) {

        return;

      }


      const rect =
        event.currentTarget
          .getBoundingClientRect();


      const x =
        event.clientX -
        rect.left;


      const y =
        event.clientY -
        rect.top;


      createBoxElement({

        box_type:
          activeBoxType,

        label:
          getBoxLabel(
            activeBoxType
          ),

        x:
          Math.max(
            0,
            x - 50
          ),

        y:
          Math.max(
            0,
            y - 30
          ),

        width:
          activeBoxType === "qr"
            ? 100
            : 160,

        height:
          activeBoxType === "qr"
            ? 65
            : 80

      });

    }
  );


/*
  保存
*/

document
  .getElementById(
    "saveButton"
  )
  .addEventListener(
    "click",
    async () => {

      if (!activePage) {

        alert(
          "ページがありません。"
        );

        return;

      }


      const scale =
        Number(
          document.getElementById(
            "sheetCanvas"
          ).dataset.scale
        ) || 1;


      const boxes =
        [
          ...
          document.querySelectorAll(
            "#sheetCanvas .layout-box"
          )
        ];


      try {

        for (
          const element
          of boxes
        ) {

          const x =
            parseFloat(
              element.style.left
            );


          const y =
            parseFloat(
              element.style.top
            );


          const width =
            parseFloat(
              element.style.width
            );


          const height =
            parseFloat(
              element.style.height
            );


          const values = {

            test_id:
              layoutTestId,

            page_no:
              activePage.page_no,

            box_type:
              element.dataset.type,

            label:
              getBoxLabel(
                element.dataset.type
              ),

            x:
              x / scale,

            y:
              y / scale,

            width:
              width / scale,

            height:
              height / scale,

            question_id:
              element.dataset.questionId
                || null

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
                .select()
                .single();


            if (error) {

              throw error;

            }


            element.dataset.id =
              data.id;

          }

        }


        alert(
          "枠設定を保存しました。"
        );


      } catch (error) {

        console.error(error);

        alert(
          error.message ||
          "枠設定の保存に失敗しました。"
        );

      }

    }
  );


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


initializeLayout();
