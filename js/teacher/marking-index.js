/* =========================================================
   デジタル採点開始
========================================================= */


let markingTests = [];


async function initializeMarkingIndex() {

  const profile =
    await getProfile();

  if (!profile) {
    location.href = "/login";
    return;
  }

  if (
    profile.role !== "teacher" &&
    profile.role !== "admin"
  ) {
    location.href = "/student/dashboard";
    return;
  }

  document.getElementById(
    "teacherName"
  ).textContent =
    profile.name || "先生";

  await loadTests();

}


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
        class_name,
        max_score,
        status
      `)
      .order(
        "created_at",
        {
          ascending:false
        }
      );


  if (error) {

    console.error(error);

    return;

  }


  markingTests =
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
      markingTests
        .map(
          test => `

            <option value="${test.id}">

              ${escapeHtml(test.name)}

              ${
                test.subject
                  ? ` / ${escapeHtml(test.subject)}`
                  : ""
              }

            </option>

          `
        )
        .join("")
    }

  `;

}


document
  .getElementById(
    "testSelect"
  )
  .addEventListener(
    "change",
    async event => {

      const testId =
        event.target.value;


      if (!testId) {

        document.getElementById(
          "markingSummary"
        ).style.display =
          "none";

        return;

      }


      const test =
        markingTests.find(
          item =>
            item.id === testId
        );


      if (!test) {
        return;
      }


      await showTestSummary(
        test
      );

    }
  );


async function showTestSummary(
  test
) {

  const [
    answerResult,
    scoreResult,
    pageResult
  ] =
    await Promise.all([

      supabaseClient
        .from("answer_sheets")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .eq(
          "test_id",
          test.id
        )
        .neq(
          "status",
          "unmatched"
        ),

      supabaseClient
        .from("scores")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .eq(
          "status",
          "marked"
        ),

      supabaseClient
        .from("test_pages")
        .select(
          "id",
          {
            count:"exact",
            head:true
          }
        )
        .eq(
          "test_id",
          test.id
        )

    ]);


  const answerCount =
    answerResult.count || 0;


  const markedCount =
    scoreResult.count || 0;


  const pageCount =
    pageResult.count || 0;


  document.getElementById(
    "testInformation"
  ).innerHTML = `

    <strong>
      ${escapeHtml(test.name)}
    </strong>

    <br>

    教科：
    ${escapeHtml(test.subject || "")}

    ／

    学年：
    ${escapeHtml(test.grade || "")}

    ／

    満点：
    ${test.max_score}

    <br>

    解答用紙ページ：
    ${pageCount}ページ

  `;


  document.getElementById(
    "summaryContent"
  ).innerHTML = `

    答案数：
    <strong>
      ${answerCount}
    </strong>
    枚

    <br>

    採点済みデータ：
    <strong>
      ${markedCount}
    </strong>

  `;


  document.getElementById(
    "markingSummary"
  ).style.display =
    "block";


  document.getElementById(
    "startMarkingButton"
  ).href =
    `/teacher/marking/select?test=${encodeURIComponent(test.id)}`;

}


document
  .getElementById(
    "logoutButton"
  )
  .addEventListener(
    "click",
    logout
  );


function escapeHtml(value) {

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


initializeMarkingIndex();
