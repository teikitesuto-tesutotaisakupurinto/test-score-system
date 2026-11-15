(function () {

  "use strict";


  let tests = [];

  let selectedTestId = null;

  let resultCount = 0;


  /* =====================================================
     初期化
  ===================================================== */

  async function initialize() {

    const profile =
      await getProfile();


    if (!profile) {

      location.replace("/login");

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


    document.getElementById(
      "teacherName"
    ).textContent =
      profile.name || "先生";


    await loadTests();

  }


  /* =====================================================
     テスト一覧
  ===================================================== */

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

      console.error(error);

      showMessage(
        "テスト一覧を取得できませんでした。",
        true
      );

      return;

    }


    tests =
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
        tests.map(
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

            </option>

          `
        ).join("")
      }

    `;

  }


  /* =====================================================
     テスト選択
  ===================================================== */

  document
    .getElementById("testSelect")
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


          return;

        }


        button.disabled =
          false;


        await loadTestInformation();

        await loadSummary();

      }
    );


  /* =====================================================
     テスト情報
  ===================================================== */

  async function loadTestInformation() {

    const test =
      tests.find(
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
        ${escapeHtml(test.name)}
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


  /* =====================================================
     概要
  ===================================================== */

  async function loadSummary() {

    const [
      boxesResult,
      answersResult,
      pagesResult,
      regionsResult
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
          .from("answer_sheet_pages")
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
            "answer_sheet_id",
            await getMatchedAnswerIds()
          ),

        supabaseClient
          .from("answer_regions")
          .select(
            "id",
            {
              count:
                "exact",
              head:
                true
            }
          )

      ]);


    const boxCount =
      boxesResult.count || 0;


    const answerCount =
      answersResult.count || 0;


    const pageCount =
      pagesResult.count || 0;


    const regionCount =
      regionsResult.count || 0;


    document.getElementById(
      "summary"
    ).style.display =
      "block";


    document.getElementById(
      "summary"
    ).innerHTML = `

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap:12px;
        "
      >

        <div>
          <div style="color:#777;font-size:12px;">
            解答欄
          </div>
          <strong>
            ${boxCount}
          </strong>
          個
        </div>

        <div>
          <div style="color:#777;font-size:12px;">
            答案
          </div>
          <strong>
            ${answerCount}
          </strong>
          枚
        </div>

        <div>
          <div style="color:#777;font-size:12px;">
            答案ページ
          </div>
          <strong>
            ${pageCount}
          </strong>
          ページ
        </div>

        <div>
          <div style="color:#777;font-size:12px;">
            切り出し済み
          </div>
          <strong>
            ${regionCount}
          </strong>
          件
        </div>

      </div>

    `;

  }


  /* =====================================================
     紐付け済み答案ID
  ===================================================== */

  async function getMatchedAnswerIds() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("answer_sheets")
        .select("id")
        .eq(
          "test_id",
          selectedTestId
        )
        .neq(
          "status",
          "unmatched"
        );


    if (error) {

      throw error;

    }


    return (
      data || []
    ).map(
      item =>
        item.id
    );

  }


  /* =====================================================
     実行
  ===================================================== */

  document
    .getElementById("executeButton")
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
            await buildRegions(
              selectedTestId
            );


          showMessage(
            `${count}件の答案領域を作成しました。`
          );


          await loadSummary();


        } catch (error) {

          console.error(error);


          showMessage(
            error.message ||
            "切り出しに失敗しました。",
            true
          );

        }


        button.disabled =
          false;


        button.textContent =
          "答案を問題別に切り出す";

      }
    );


  /* =====================================================
     本体
  ===================================================== */

  async function buildRegions(
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
          "page_no"
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
      答案
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


    let created =
      0;


    /*
      各答案
    */

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
          該当ページを探す
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

          /*
            既存なら再利用
          */

          const existing =
            await getExistingRegion(
              answer.id,
              box.id
            );


          /*
            画像切り出し
          */

          const blob =
            await cropAnswerImage(
              page.file_path,
              box
            );


          if (!blob) {

            throw new Error(
              "画像切り出しに失敗しました。"
            );

          }


          /*
            Storage
          */

          const storagePath =
            `${testId}/${answer.id}/${box.id}.png`;


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
            DB
          */

          const values = {

            answer_sheet_id:
              answer.id,

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


  /* =====================================================
     answer_sheet_pages
  ===================================================== */

  async function loadAnswerPages(
    answerSheetId
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
          answerSheetId
        )
        .order(
          "page_no"
        );


    if (error) {

      throw error;

    }


    return data || [];

  }


  /* =====================================================
     既存region
  ===================================================== */

  async function getExistingRegion(
    answerSheetId,
    layoutBoxId
  ) {

    const {
      data,
      error
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
          layoutBoxId
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    return data || null;

  }


  /* =====================================================
     画像切り出し
  ===================================================== */

  async function cropAnswerImage(
    filePath,
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
          filePath,
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


  /* =====================================================
     Image
  ===================================================== */

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
          () =>
            resolve(
              image
            );


        image.onerror =
          () =>
            reject(
              new Error(
                "画像を読み込めませんでした。"
              )
            );


        image.src =
          src;

      }
    );

  }


  /* =====================================================
     Canvas → PNG
  ===================================================== */

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
                  "PNG変換に失敗しました。"
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


  /* =====================================================
     結果
  ===================================================== */

  function addResult(
    answer,
    box,
    status,
    isError = false
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
        ${isError
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
    message,
    isError = false
  ) {

    const element =
      document.getElementById(
        "message"
      );


    element.textContent =
      message;


    element.style.color =
      isError
        ? "#c62828"
        : "#16834b";

  }


  /* =====================================================
     Logout
  ===================================================== */

  document
    .getElementById(
      "logoutButton"
    )
    .addEventListener(
      "click",
      logout
    );


  initialize();

})();
