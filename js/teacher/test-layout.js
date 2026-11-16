
"use strict";

/* =========================================================
   旧・枠設定URL互換

   正式画面
   ---------------------------------------------------------
   /teacher/tests/pages?test=UUID

   このURL
   ---------------------------------------------------------
   /teacher/tests/layout?id=UUID
   /teacher/tests/layout?test=UUID

   ↓

   正式な解答用紙・枠設定へ移動
========================================================= */

(function () {

  "use strict";


  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get("test") ||
    params.get("id");


  const encoded =
    testId
      ? encodeURIComponent(
          testId
        )
      : "";


  const teacherName =
    document.getElementById(
      "teacherName"
    );


  /*
   * 認証とテスト情報を確認してから
   * 正式画面へ送る。
   */

  async function initialize() {

    try {

      const auth =
        await requireRole(
          "teacher"
        );


      if (!auth) {

        return;

      }


      if (teacherName) {

        teacherName.textContent =
          auth.profile?.name ||
          "先生";

      }


      if (!testId) {

        showError(
          "テストIDがありません。"
        );

        return;

      }


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
            testId
          )
          .maybeSingle();


      if (error) {

        throw error;

      }


      if (!data) {

        throw new Error(
          "テストが見つかりません。"
        );

      }


      renderInformation(
        data
      );


      setLinks();


    } catch (error) {

      console.error(
        "test-layout:",
        error
      );


      showError(
        error.message ||
        "枠設定を開けませんでした。"
      );

    }

  }


  function setLinks() {

    const pagesUrl =
      `/teacher/tests/pages?test=${encoded}`;


    const pointsUrl =
      `/teacher/tests/points?test=${encoded}`;


    const modelUrl =
      `/teacher/tests/model-answer?test=${encoded}`;


    const previewUrl =
      `/teacher/tests/preview?test=${encoded}`;


    setHref(
      "pagesLink",
      pagesUrl
    );


    setHref(
      "layoutLink",
      pagesUrl
    );


    setHref(
      "pointsLink",
      pointsUrl
    );


    setHref(
      "modelAnswerLink",
      modelUrl
    );


    setHref(
      "previewLink",
      previewUrl
    );


    setHref(
      "openPagesButton",
      pagesUrl
    );


    setHref(
      "openPointsButton",
      pointsUrl
    );

  }


  function renderInformation(
    test
  ) {

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

      ／

      満点：
      ${escapeHtml(
        test.max_score ??
        "-"
      )}

    `;

  }


  function setHref(
    id,
    href
  ) {

    const element =
      document.getElementById(
        id
      );


    if (element) {

      element.href =
        href;

    }

  }


  function showError(
    text
  ) {

    const element =
      document.getElementById(
        "message"
      );


    if (!element) {

      return;

    }


    element.textContent =
      text;


    element.className =
      "message error";

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


  initialize();

})();
