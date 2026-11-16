
"use strict";

/* =========================================================
   旧・採点対象選択画面

   このファイルは互換用。

   新仕様
   ---------------------------------------------------------
   /teacher/marking
        ↓
   テスト選択
        ↓
   /teacher/marking/mark?test=UUID

   答案選択・設問選択は行わない。
========================================================= */


(function () {

  "use strict";


  const params =
    new URLSearchParams(
      window.location.search
    );


  const testId =
    params.get(
      "test"
    );


  if (testId) {

    window.location.replace(
      `/teacher/marking/mark?test=${encodeURIComponent(
        testId
      )}`
    );

    return;

  }


  window.location.replace(
    "/teacher/marking"
  );

})();
