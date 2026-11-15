
(function () {

  "use strict";


  const params =
    new URLSearchParams(
      location.search
    );


  const testId =
    params.get(
      "test"
    );


  let profile = null;

  let test = null;

  let answer = null;

  let pages = [];

  let regions = [];

  let scores = [];

  let marks = [];

  let boxes = [];


  async function initialize() {

    const session =
      await getSession();


    if (!session) {

      location.replace(
        "/login"
      );

      return;

    }


    profile =
      await getProfile();


    if (
      !profile ||
      profile.role !==
        "student"
    ) {

      location.replace(
        "/login"
      );

      return;

    }


    document.getElementById(
      "studentName"
    ).textContent =
      profile.name ||
      "生徒";


    if (!testId) {

      location.replace(
        "/student/tests"
      );

      return;

    }


    await loadTest();

    await loadAnswer();

  }


  /* =====================================================
     テスト
  ===================================================== */

  async function loadTest() {

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
          class_name,
          max_score,
          results_published,
          results_published_at
        `)
        .eq(
          "id",
          testId
        )
        .eq(
          "results_published",
          true
        )
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      alert(
        "このテストは公開されていません。"
      );


      location.replace(
        "/student/tests"
      );


      return;

    }


    test =
      data;


    document.getElementById(
      "testName"
    ).textContent =
      test.name;


    document.getElementById(
      "originalAnswerLink"
    ).href =
      `/student/tests/answer?test=${encodeURIComponent(
        testId
      )}`;

  }


  /* =====================================================
     答案
  ===================================================== */

  async function loadAnswer() {

    /*
      RLSにより自分の答案だけ
    */

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_sheets"
        )
        .select(`
          id,
          student_id,
          status,
          created_at
        `)
        .eq(
          "test_id",
          testId
        )
        .neq(
          "status",
          "unmatched"
        )
        .order(
          "created_at",
          {
            ascending:false
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {

      throw error;

    }


    if (!data) {

      showNoAnswer();

      return;

    }


    answer =
      data;


    await Promise.all([

      loadPages(),

      loadRegions(),

      loadScores(),

      loadMarks(),

      loadBoxes()

    ]);


    renderSummary();


    await renderMarkedPages();

  }


  /* =====================================================
     ページ
  ===================================================== */

  async function loadPages() {

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
          original_name,
          width_px,
          height_px
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "page_no",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    pages =
      data || [];

  }


  /* =====================================================
     Regions
  ===================================================== */

  async function loadRegions() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "answer_regions"
        )
        .select(`
          id,
          answer_sheet_id,
          layout_box_id,
          image_path,
          page_no,
          x,
          y,
          width,
          height
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        );


    if (error) {

      throw error;

    }


    regions =
      data || [];

  }


  /* =====================================================
     Scores
  ===================================================== */

  async function loadScores() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "scores"
        )
        .select(`
          id,
          layout_box_id,
          score,
          status
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .eq(
          "status",
          "marked"
        );


    if (error) {

      throw error;

    }


    scores =
      data || [];

  }


  /* =====================================================
     Marks
  ===================================================== */

  async function loadMarks() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "mark_objects"
        )
        .select(`
          id,
          layout_box_id,
          object_type,
          text_value,
          color,
          font_size,
          stroke_width,
          x,
          y,
          width,
          height,
          points
        `)
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .order(
          "created_at",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    marks =
      data || [];

  }


  /* =====================================================
     Layout
  ===================================================== */

  async function loadBoxes() {

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "layout_boxes"
        )
        .select(`
          id,
          page_no,
          label,
          points,
          x,
          y,
          width,
          height,
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
          "page_no",
          {
            ascending:true
          }
        )
        .order(
          "y",
          {
            ascending:true
          }
        )
        .order(
          "x",
          {
            ascending:true
          }
        );


    if (error) {

      throw error;

    }


    boxes =
      data || [];

  }


  /* =====================================================
     集計
  ===================================================== */

  function renderSummary() {

    const total =
      scores.reduce(
        (
          sum,
          score
        ) =>
          sum +
          (
            Number(
              score.score
            ) || 0
          ),
        0
      );


    const max =
      boxes.reduce(
        (
          sum,
          box
        ) =>
          sum +
          (
            Number(
              box.points
            ) || 0
          ),
        0
      );


    const percentage =
      max > 0
        ? (
            total /
            max
          ) *
          100
        : 0;


    document.getElementById(
      "resultSummary"
    ).innerHTML = `

      <div class="result-summary-grid">


        <div>

          <div class="result-label">
            得点
          </div>

          <div class="result-value">
            ${total}
          </div>

          <div class="result-sub">
            / ${max}点
          </div>

        </div>


        <div>

          <div class="result-label">
            得点率
          </div>

          <div class="result-value">
            ${percentage.toFixed(1)}%
          </div>

        </div>


        <div>

          <div class="result-label">
            採点済み
          </div>

          <div class="result-value">
            ${scores.length}
          </div>

          <div class="result-sub">
            / ${boxes.length}問
          </div>

        </div>


      </div>

    `;

  }


  /* =====================================================
     採点済みページ
  ===================================================== */

  async function renderMarkedPages() {

    const container =
      document.getElementById(
        "markedPages"
      );


    container.innerHTML =
      "";


    for (
      const page
      of pages
    ) {

      try {

        const canvas =
          await createMarkedPageCanvas(
            page
          );


        const wrapper =
          document.createElement(
            "div"
          );


        wrapper.className =
          "student-answer-page";


        const title =
          document.createElement(
            "div"
          );


        title.className =
          "student-answer-page-title";


        title.textContent =
          `採点済み答案 ${page.page_no}ページ`;


        const image =
          document.createElement(
            "img"
          );


        image.src =
          canvas.toDataURL(
            "image/png"
          );


        image.alt =
          `採点済み答案 ${page.page_no}ページ`;


        wrapper.appendChild(
          title
        );


        wrapper.appendChild(
          image
        );


        container.appendChild(
          wrapper
        );


      } catch (error) {

        console.error(
          error
        );

      }

    }


    if (
      !container.children.length
    ) {

      container.innerHTML = `

        <div class="empty-state">

          採点済み答案を表示できません。

        </div>

      `;

    }

  }


  /* =====================================================
     Canvas生成
  ===================================================== */

  async function createMarkedPageCanvas(
    page
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
          page.file_path,
          3600
        );


    if (error) {

      throw error;

    }


    const image =
      await loadImage(
        data.signedUrl
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      image.naturalWidth;


    canvas.height =
      image.naturalHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    /*
      元答案
    */

    context.drawImage(
      image,
      0,
      0
    );


    /*
      このページの問題
    */

    const pageBoxes =
      boxes.filter(
        box =>
          Number(
            box.page_no
          ) ===
          Number(
            page.page_no
          )
      );


    for (
      const box
      of pageBoxes
    ) {

      const region =
        regions.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      const pageMarks =
        marks.filter(
          mark =>
            mark.layout_box_id ===
            box.id
        );


      const score =
        scores.find(
          item =>
            item.layout_box_id ===
            box.id
        );


      drawMarks(
        context,
        box,
        region,
        pageMarks
      );


      if (score) {

        drawScore(
          context,
          box,
          score.score
        );

      }

    }


    return canvas;

  }


  /* =====================================================
     ○×△◎テキスト・ペン
  ===================================================== */

  function drawMarks(
    context,
    box,
    region,
    pageMarks
  ) {

    if (
      !pageMarks.length
    ) {

      return;

    }


    const regionWidth =
      Number(
        region?.width
      ) ||
      Number(
        box.width
      ) ||
      1;


    const regionHeight =
      Number(
        region?.height
      ) ||
      Number(
        box.height
      ) ||
      1;


    const boxWidth =
      Number(
        box.width
      ) ||
      regionWidth;


    const boxHeight =
      Number(
        box.height
      ) ||
      regionHeight;


    const scaleX =
      boxWidth /
      regionWidth;


    const scaleY =
      boxHeight /
      regionHeight;


    pageMarks.forEach(
      mark => {

        const x =
          Number(
            box.x
          ) +
          (
            Number(
              mark.x
            ) || 0
          ) *
          scaleX;


        const y =
          Number(
            box.y
          ) +
          (
            Number(
              mark.y
            ) || 0
          ) *
          scaleY;


        const size =
          (
            Number(
              mark.font_size
            ) || 42
          ) *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        context.save();


        context.strokeStyle =
          mark.color ||
          "#c62828";


        context.fillStyle =
          mark.color ||
          "#c62828";


        context.lineWidth =
          (
            Number(
              mark.stroke_width
            ) || 3
          ) *
          (
            Math.abs(
              scaleX
            ) +
            Math.abs(
              scaleY
            )
          ) /
          2;


        if (
          mark.object_type ===
          "circle"
        ) {

          context.beginPath();


          context.arc(
            x,
            y,
            size / 2,
            0,
            Math.PI * 2
          );


          context.stroke();

        }


        else if (
          mark.object_type ===
          "x"
        ) {

          context.beginPath();


          context.moveTo(
            x - size / 2,
            y - size / 2
          );


          context.lineTo(
            x + size / 2,
            y + size / 2
          );


          context.moveTo(
            x + size / 2,
            y - size / 2
          );


          context.lineTo(
            x - size / 2,
            y + size / 2
          );


          context.stroke();

        }


        else if (
          mark.object_type ===
          "triangle"
        ) {

          context.beginPath();


          context.moveTo(
            x,
            y - size / 2
          );


          context.lineTo(
            x - size / 2,
            y + size / 2
          );


          context.lineTo(
            x + size / 2,
            y + size / 2
          );


          context.closePath();


          context.stroke();

        }


        else if (
          mark.object_type ===
          "double_circle"
        ) {

          context.font =
            `bold ${size}px Arial`;


          context.fillText(
            "◎",
            x,
            y
          );

        }


        else if (
          mark.object_type ===
          "text"
        ) {

          context.font =
            `${size}px Arial`;


          context.fillText(
            mark.text_value ||
            "",
            x,
            y
          );

        }


        else if (
          mark.object_type ===
          "pen"
        ) {

          const points =
            Array.isArray(
              mark.points
            )
              ? mark.points
              : [];


          if (
            points.length
          ) {

            context.beginPath();


            points.forEach(
              (
                point,
                index
              ) => {

                const px =
                  Number(
                    box.x
                  ) +
                  (
                    Number(
                      point.x
                    ) || 0
                  ) *
                  scaleX;


                const py =
                  Number(
                    box.y
                  ) +
                  (
                    Number(
                      point.y
                    ) || 0
                  ) *
                  scaleY;


                if (
                  index === 0
                ) {

                  context.moveTo(
                    px,
                    py
                  );

                } else {

                  context.lineTo(
                    px,
                    py
                  );

                }

              }
            );


            context.stroke();

          }

        }


        context.restore();

      }
    );

  }


  /* =====================================================
     点数
  ===================================================== */

  function drawScore(
    context,
    box,
    score
  ) {

    const x =
      (
        Number(
          box.x
        ) || 0
      ) +
      (
        Number(
          box.width
        ) || 100
      ) +
      8;


    const y =
      (
        Number(
          box.y
        ) || 0
      ) +
      Math.max(
        22,
        (
          Number(
            box.height
          ) || 50
        ) * 0.25
      );


    const fontSize =
      Math.max(
        18,
        Math.min(
          42,
          (
            Number(
              box.height
            ) || 50
          ) * 0.25
        )
      );


    context.save();


    context.fillStyle =
      "#c62828";


    context.font =
      `bold ${fontSize}px Arial`;


    context.textBaseline =
      "middle";


    context.fillText(
      `${score}点`,
      x,
      y
    );


    context.restore();

  }


  /* =====================================================
     画像
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


  function showNoAnswer() {

    document.getElementById(
      "resultSummary"
    ).innerHTML = `

      <div class="empty-state">

        答案がありません。

      </div>

    `;


    document.getElementById(
      "markedPages"
    ).innerHTML =
      "";

  }


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
