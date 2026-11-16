
"use strict";

/* =========================================================
   旧・答案領域処理

   現在の正式なクロップ処理は

     /teacher/answers/regions
          ↓
     js/teacher/answers-regions.js

   に統一。

   このファイルは旧ページ・旧リンクから
   来た場合の互換用。
========================================================= */

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


  /*
   * 旧画面を直接開いた場合も
   * 正式なクロップ画面へ移動。
   */

  if (
    testId
  ) {

    location.replace(
      `/teacher/answers/regions?test=${encodeURIComponent(
        testId
      )}`
    );

    return;

  }


  location.replace(
    "/teacher/answers/regions"
  );

})();
