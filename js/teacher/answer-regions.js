
(function () {

  "use strict";


  /* =====================================================
     STATE
  ===================================================== */

  let tests = [];

  let selectedTestId = null;

  let resultCount = 0;


  /* =====================================================
     INIT
  ===================================================== */

  async function initialize() {

    try {

      const profile =
        await getProfile();


      if (!profile) {

        location.replace(
          "/login"
        );

        return;

      }


      if (
        profile.role !== "teacher" &&
        profile.role !== "admin"
      ) {

        location.replace(
          "/student/index.html"
        );

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


      await loadTests();

    } catch (error) {

      console.error(
        "answer-regions initialize:",
        error
      );


      showMessage(
        error.message ||
        "答案領域画面を読み込めませんでした。",
        true
      );

    }

  }


  /* =====================================================
     TEST LIST
  ===================================================== */

  async function loadTests() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "tests"
        )
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
            ascending:
              false
          }
        );


    if (error) {

      console.error(
        error
      );


      showMessage(
        "テスト一覧を取得できませんでした。",
        true
      );


      return;

    }


    tests =
      data ||
      [];


    const select =
      document.getElementById(
        "testSelect"
      );


    if (!select) {

      return;

    }


    select.innerHTML = `

      <option value="">
        テストを選択してください
      </option>

      ${
        tests
          .map(
            test => `

              <option
                value="${escapeHtml(
                  test.id
                )}"
              >

                ${escapeHtml(
                  test.name
                )}

                ${
                  test.subject
                    ? ` / ${escapeHtml(
                        test.subject
                      )}`
                    : ""
                }

                ${
                  test.grade
                    ? ` / ${escapeHtml(
                        test.grade
                      )}`
                    : ""
                }

              </option>

            `
          )
          .join("")
      }

    `;

  }


  /* =====================================================
     TEST SELECT
  ===================================================== */

  document
    .getElementById(
      "testSelect"
    )
    ?.addEventListener(
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

          if (button) {

            button.disabled =
              true;

          }


          const summary =
            document.getElementById(
              "summary"
            );


          if (summary) {

            summary.style.display =
              "none";

          }


          return;

        }


        if (button) {

          button.disabled =
            false;

        }


        try {

          await loadTestInformation();

          await loadSummary();

        } catch (error) {

          console.error(
            error
          );


          showMessage(
            error.message ||
            "テスト情報を取得できませんでした。",
            true
          );

        }

      }
    );


  /* =====================================================
     TEST INFORMATION
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


    const element =
      document.getElementById(
        "testInformation"
      );


    if (!element) {

      return;

    }


    element.innerHTML = `

      <strong>
        ${escapeHtml(
          test.name
        )}
      </strong>

      <br>

      教科：
      ${escapeHtml(
        test.subject ||
        "-"
      )}

      ／

      学年：
      ${escapeHtml(
        test.grade ||
        "-"
      )}

      ／

      クラス：
      ${escapeHtml(
        test.class_name ||
        "-"
      )}

    `;

  }


  /* =====================================================
     SUMMARY
  ===================================================== */

  async function loadSummary() {

    const answerIds =
      await getMatchedAnswerIds();


    const [
      boxesResult,
      answersResult,
      pagesResult,
      regionsResult
    ] =
      await Promise.all([

        supabaseClient
          .from(
            "layout_boxes"
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
            "test_id",
            selectedTestId
          )
          .eq(
            "box_type",
            "answer"
          ),

        supabaseClient
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
          .eq(
            "test_id",
            selectedTestId
          )
          .neq(
            "status",
            "unmatched"
          ),

        answerIds.length
          ? supabaseClient
              .from(
                "answer_sheet_pages"
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
                "answer_sheet_id",
                answerIds
              )
          : Promise.resolve({
              count:0,
              error:null
            }),

        supabaseClient
          .from(
            "answer_regions"
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

      ]);


    if (
      boxesResult.error
    ) {

      throw boxesResult.error;

    }


    if (
      answersResult.error
    ) {

      throw answersResult.error;

    }


    if (
      pagesResult.error
    ) {

      throw pagesResult.error;

    }


    if (
      regionsResult.error
    ) {

      throw regionsResult.error;

    }


    const boxCount =
      boxesResult.count ||
      0;


    const answerCount =
      answersResult.count ||
      0;


    const pageCount =
      pagesResult.count ||
      0;


    const regionCount =
      regionsResult.count ||
      0;


    const summary =
      document.getElementById(
        "summary"
      );


    if (!summary) {

      return;

    }


    summary.style.display =
      "block";


    summary.innerHTML = `

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0,1fr)
            );
          gap:12px;
        "
      >

        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            解答欄
          </div>

          <strong>
            ${boxCount}
          </strong>

          個

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            答案
          </div>

          <strong>
            ${answerCount}
          </strong>

          枚

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
            答案ページ
          </div>

          <strong>
            ${pageCount}
          </strong>

          ページ

        </div>


        <div>

          <div
            style="
              color:#777;
              font-size:12px;
            "
          >
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
     MATCHED ANSWER IDS
  ===================================================== */

  async function getMatchedAnswerIds() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(
          "id"
        )
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
      data ||
      []
    ).map(
      item =>
        item.id
    );

  }


  /* =====================================================
     EXECUTE
  ===================================================== */

  document
    .getElementById(
      "executeButton"
    )
    ?.addEventListener(
      "click",
      async () => {

        if (!selectedTestId) {

          return;

        }


        const button =
          document.getElementById(
            "executeButton"
          );


        if (button) {

          button.disabled =
            true;

          button.textContent =
            "切り出し中...";

        }


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

          console.error(
            "buildRegions:",
            error
          );


          showMessage(
            error.message ||
            "切り出しに失敗しました。",
            true
          );

        }


        if (button) {

          button.disabled =
            false;

          button.textContent =
            "答案を問題別に切り出す";

        }

      }
    );


  /* =====================================================
     BUILD REGIONS
  ===================================================== */

  async function buildRegions(
    testId
  ) {

    /*
     * 解答欄
     *
     * question_idは使用しない。
     * box_type=answerを対象にする。
     */

    const {
      data: boxes,
      error: boxError
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(`
          id,
          page_no,
          x,
          y,
          width,
          height,
          points,
          label,
          box_type
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
        )
        .order(
          "sort_order",
          {
            ascending:
              true
          }
        );


    if (boxError) {

      throw boxError;

    }


    /*
     * 集計枠は切り出さない。
     */

    const excludedLabels =
      new Set([
        "合計",
        "小計"
      ]);


    const answerBoxes =
      (
        boxes ||
        []
      ).filter(
        box =>
          !excludedLabels.has(
            String(
              box.label ||
              ""
            ).trim()
          )
      );


    if (!answerBoxes.length) {

      throw new Error(
        "解答欄が設定されていません。"
      );

    }


    /*
     * 答案
     */

    const {
      data: answers,
      error: answerError
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
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
     * 各答案
     */

    for (
      const answer
      of answers
    ) {

      const answerPages =
        await loadAnswerPages(
          answer.id
        );


      if (!answerPages.length) {

        addResult(
          answer,
          null,
          "答案ページなし",
          true
        );


        continue;

      }


      /*
       * 各解答欄
       */

      for (
        const box
        of answerBoxes
      ) {

        const page =
          answerPages.find(
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
           * 既存region
           */

          const existing =
            await getExistingRegion(
              answer.id,
              box.id
            );


          /*
           * 画像切り出し
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
           * Storage
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
           * DB
           *
           * question_idはNULLでよい。
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
            "region:",
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
     ANSWER PAGES
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
     EXISTING REGION
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


    return data ||
      null;

  }


  /* =====================================================
     CROP IMAGE
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
        Number(
          box.x
        ) || 0
      );


    const y =
      Math.max(
        0,
        Number(
          box.y
        ) || 0
      );


    const width =
      Number(
        box.width
      ) || 1;


    const height =
      Number(
        box.height
      ) || 1;


    const cropWidth =
      Math.min(
        width,
        image.naturalWidth -
          x
      );


    const cropHeight =
      Math.min(
        height,
        image.naturalHeight -
          y
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


    if (!context) {

      throw new Error(
        "Canvasを初期化できませんでした。"
      );

    }


    /*
     * Signed URLの画像を
     * CORS許可付きで読み込んでいるため、
     * toBlob可能な状態にする。
     */

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
     LOAD IMAGE
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


        /*
         * 重要:
         *
         * StorageのSigned URLを
         * Canvasへ描画するためCORSを許可。
         */

        image.crossOrigin =
          "anonymous";


        image.onload =
          () =>
            resolve(
              image
            );


        image.onerror =
          () =>
            reject(
              new Error(
                "答案画像を読み込めませんでした。"
              )
            );


        image.src =
          src;

      }
    );

  }


  /* =====================================================
     CANVAS → BLOB
  ===================================================== */

  function canvasToBlob(
    canvas
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        try {

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

        } catch (error) {

          reject(
            new Error(
              `画像変換に失敗しました: ${error.message}`
            )
          );

        }

      }
    );

  }


  /* =====================================================
     RESULT
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


    if (!container) {

      return;

    }


    const item =
      document.createElement(
        "div"
      );


    item.style.cssText = `

      padding:9px;

      border-bottom:
        1px solid #d0d6dc;

      color:
        ${
          isError
            ? "#c62828"
            : "#16834b"
        };

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


    const resultCountElement =
      document.getElementById(
        "resultCount"
      );


    if (resultCountElement) {

      resultCountElement.textContent =
        `${resultCount}件`;

    }

  }


  /* =====================================================
     CLEAR RESULTS
  ===================================================== */

  function clearResults() {

    resultCount =
      0;


    const list =
      document.getElementById(
        "resultList"
      );


    if (list) {

      list.innerHTML =
        "";

    }


    const count =
      document.getElementById(
        "resultCount"
      );


    if (count) {

      count.textContent =
        "0件";

    }

  }


  /* =====================================================
     MESSAGE
  ===================================================== */

  function showMessage(
    message,
    isError = false
  ) {

    const element =
      document.getElementById(
        "message"
      );


    if (!element) {

      return;

    }


    element.textContent =
      message;


    element.style.color =
      isError
        ? "#c62828"
        : "#16834b";

  }


  /* =====================================================
     LOGOUT
  ===================================================== */

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


  /* =====================================================
     ESCAPE
  ===================================================== */

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


  /* =====================================================
     START
  ===================================================== */

  initialize();

})();
