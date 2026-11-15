/* =========================================================
   テスト成績システム
   採点一覧

   答案単位ではなくテスト単位。

   テスト選択
      ↓
   答案一覧表示
      ↓
   採点開始
      ↓
   /teacher/marking/mark?test=UUID
========================================================= */

(function () {

"use strict";


let currentTestId = null;

let currentTest = null;


/* =====================================================
   DOM
===================================================== */

const teacherName =
document.getElementById(
  "teacherName"
);

const testSelect =
document.getElementById(
  "testSelect"
);

const startButton =
document.getElementById(
  "startButton"
);

const refreshButton =
document.getElementById(
  "refreshButton"
);

const statusElement =
document.getElementById(
  "status"
);

const answerPanel =
document.getElementById(
  "answerPanel"
);

const answerPanelHeader =
document.getElementById(
  "answerPanelHeader"
);

const answerTableBody =
document.getElementById(
  "answerTableBody"
);

const emptyArea =
document.getElementById(
  "emptyArea"
);


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


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
"/student/dashboard"
);

return;

}


if (teacherName) {

teacherName.textContent =
profile.name ||
"先生";

}


setupEvents();

await loadTests();


} catch (error) {

console.error(
error
);

showStatus(
error.message ||
"採点画面の初期化に失敗しました。",
true
);

}

}


/* =====================================================
   EVENTS
===================================================== */

function setupEvents() {


testSelect?.addEventListener(
"change",
async () => {

currentTestId =
testSelect.value ||
null;


if (!currentTestId) {

clearPreview();

return;

}


await loadPreview();

}
);


startButton?.addEventListener(
"click",
startMarking
);


refreshButton?.addEventListener(
"click",
async () => {

if (!currentTestId) {

await loadTests();

return;

}

await loadPreview();

}
);


document
.getElementById(
"logoutButton"
)
?.addEventListener(
"click",
async event => {

event.preventDefault();


if (
typeof logout ===
"function"
) {

await logout();

}

}
);

}


/* =====================================================
   TESTS
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
.select(
`
id,
name,
subject,
grade,
class_name,
created_at
`
)
.order(
"created_at",
{
ascending:false
}
);


if (error) {

throw new Error(
`テスト一覧を取得できませんでした: ${error.message}`
);

}


testSelect.innerHTML = `

<option value="">
テストを選択してください
</option>

`;


for (
const test
of data || []
) {

const option =
document.createElement(
"option"
);


option.value =
test.id;


option.textContent =
[
test.name,
test.subject,
test.grade
]
.filter(
value =>
value !== null &&
value !== undefined &&
String(value).trim() !== ""
)
.join(
" / "
);


testSelect.appendChild(
option
);

}

}


/* =====================================================
   PREVIEW
   テスト選択直後に答案を表示
===================================================== */

async function loadPreview() {

if (!currentTestId) {

return;

}


try {

showStatus(
"答案を取得しています..."
);


startButton.disabled =
true;


const {
data: testData,
error: testError
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
class_name
`
)
.eq(
"id",
currentTestId
)
.single();


if (testError) {

throw new Error(
`テスト情報を取得できませんでした: ${testError.message}`
);

}


currentTest =
testData;


const {
data: answers,
error: answerError
} =
await supabaseClient
.from(
"answer_sheets"
)
.select(
`
id,
test_id,
student_id,
page_count,
qr_value,
status,
uploaded_at
`
)
.eq(
"test_id",
currentTestId
)
.order(
"uploaded_at",
{
ascending:false
}
);


if (answerError) {

throw new Error(
`答案を取得できませんでした: ${answerError.message}`
);

}


const list =
answers || [];


if (!list.length) {

clearAnswerRows();


showStatus(
`${currentTest.name} に登録された答案はありません。`,
true
);

return;

}


/* -----------------------------------------------------
   STUDENTS
----------------------------------------------------- */

const studentIds =
[
...new Set(
list
.map(
answer =>
answer.student_id
)
.filter(Boolean)
)
];


let studentMap =
new Map();


if (studentIds.length) {

const {
data: students,
error: studentError
} =
await supabaseClient
.from(
"students"
)
.select(
`
id,
student_no,
name
`
)
.in(
"id",
studentIds
);


if (studentError) {

throw new Error(
`生徒情報を取得できませんでした: ${studentError.message}`
);

}


studentMap =
new Map(
(students || [])
.map(
student => [
student.id,
student
]
)
);

}


/* -----------------------------------------------------
   RENDER
----------------------------------------------------- */

answerPanel.classList.add(
"show"
);

emptyArea.style.display =
"none";


answerPanelHeader.textContent =
`${currentTest.name} / 答案 ${list.length}件`;


answerTableBody.innerHTML =
"";


for (
const answer
of list
) {

const student =
studentMap.get(
answer.student_id
);


const row =
document.createElement(
"tr"
);


const noCell =
document.createElement(
"td"
);


noCell.innerHTML =
`
<div class="student-no">
${escapeHtml(
student?.student_no ||
"未紐付け"
)}
</div>
`;


const nameCell =
document.createElement(
"td"
);


nameCell.textContent =
student?.name ||
"-";


const pageCell =
document.createElement(
"td"
);


pageCell.textContent =
String(
answer.page_count ||
0
);


const statusCell =
document.createElement(
"td"
);


statusCell.textContent =
getStatusText(
answer.status
);


statusCell.className =
getStatusClass(
answer.status
);


row.appendChild(
noCell
);

row.appendChild(
nameCell
);

row.appendChild(
pageCell
);

row.appendChild(
statusCell
);


answerTableBody.appendChild(
row
);

}


startButton.disabled =
false;


showStatus(
`${currentTest.name} / ${list.length}件の答案があります。採点開始でテスト全体の採点を開始します。`
);


} catch (error) {

console.error(
error
);


clearAnswerRows();


showStatus(
error.message ||
"答案を取得できませんでした。",
true
);

}

}


/* =====================================================
   START
===================================================== */

function startMarking() {

if (!currentTestId) {

showStatus(
"テストを選択してください。",
true
);

return;

}


window.location.href =
`/teacher/marking/mark?test=${encodeURIComponent(
currentTestId
)}`;

}


/* =====================================================
   CLEAR
===================================================== */

function clearPreview() {

currentTest =
null;

answerPanel.classList.remove(
"show"
);

clearAnswerRows();

emptyArea.style.display =
"block";

startButton.disabled =
true;

showStatus(
"テストを選択してください。"
);

}


function clearAnswerRows() {

answerTableBody.innerHTML =
"";

}


/* =====================================================
   STATUS
===================================================== */

function getStatusText(
status
) {

switch (
String(
status ||
""
).toLowerCase()
) {

case "matched":
return "採点前";

case "uploaded":
return "採点前";

case "marking":
return "採点中";

case "marked":
return "採点完了・成績処理待ち";

case "unmatched":
return "未紐付け";

default:
return status ||
"未処理";

}

}


function getStatusClass(
status
) {

switch (
String(
status ||
""
).toLowerCase()
) {

case "marking":
return "state-marking";

case "marked":
return "state-done";

default:
return "state-before";

}

}


function showStatus(
text,
error = false
) {

if (!statusElement) {

return;

}


statusElement.textContent =
text;


statusElement.style.color =
error
? "#b42318"
: "#333";

}


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

})();
