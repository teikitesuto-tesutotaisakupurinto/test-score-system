
(function () {

"use strict";


/* =====================================================
   STATE
===================================================== */

let testId = null;

let test = null;

let answers = [];

let students = new Map();

let pages = new Map();

let boxes = [];

let questions = [];

let scores = [];

let currentQuestionIndex = 0;

let started = false;

let saving = false;


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

const answerSummary =
document.getElementById(
  "answerSummary"
);

const answerSummaryBody =
document.getElementById(
  "answerSummaryBody"
);

const progressArea =
document.getElementById(
  "progressArea"
);

const progressBar =
document.getElementById(
  "progressBar"
);

const progressText =
document.getElementById(
  "progressText"
);

const questionArea =
document.getElementById(
  "questionArea"
);

const questionTitle =
document.getElementById(
  "questionTitle"
);

const questionMeta =
document.getElementById(
  "questionMeta"
);

const previousButton =
document.getElementById(
  "previousButton"
);

const nextButton =
document.getElementById(
  "nextButton"
);

const answerTableWrap =
document.getElementById(
  "answerTableWrap"
);

const completeArea =
document.getElementById(
  "completeArea"
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
await requireTeacher();


if (!profile) {

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

testId =
testSelect.value ||
null;


resetState();


if (!testId) {

showStatus(
"テストを選択してください。"
);

return;

}


try {

await loadTestPreview();


} catch (error) {

console.error(
error
);


showStatus(
error.message ||
"答案を取得できませんでした。",
true
);

}

}
);


startButton?.addEventListener(
"click",
startMarking
);


refreshButton?.addEventListener(
"click",
async () => {

if (!testId) {

await loadTests();

return;

}


try {

await loadTestPreview();


if (started) {

await loadTestData();

await renderCurrentQuestion();

}

} catch (error) {

showStatus(
error.message ||
"更新できませんでした。",
true
);

}

}
);


previousButton?.addEventListener(
"click",
async () => {

if (
currentQuestionIndex <=
0
) {

return;

}


currentQuestionIndex--;

await renderCurrentQuestion();

}
);


nextButton?.addEventListener(
"click",
nextQuestion
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
`テスト一覧の取得に失敗しました: ${error.message}`
);

}


testSelect.innerHTML = `

<option value="">
テストを選択してください
</option>

`;


for (
const item
of data || []
) {

const option =
document.createElement(
"option"
);


option.value =
item.id;


option.textContent =
[
item.name,
item.subject,
item.grade
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
   TEST PREVIEW
   テスト選択直後に答案を表示
===================================================== */

async function loadTestPreview() {

if (!testId) {

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
class_name
`
)
.eq(
"id",
testId
)
.single();


if (error) {

throw new Error(
`テスト情報の取得に失敗しました: ${error.message}`
);

}


test =
data;


/* -----------------------------------------------------
   答案
----------------------------------------------------- */

const {
data: answerData,
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
testId
)
.order(
"uploaded_at",
{
ascending:false
}
);


if (answerError) {

throw new Error(
`答案の取得に失敗しました: ${answerError.message}`
);

}


answers =
answerData || [];


/* -----------------------------------------------------
   生徒
----------------------------------------------------- */

await loadStudents();


/* -----------------------------------------------------
   一覧表示
----------------------------------------------------- */

renderAnswerSummary();


if (!answers.length) {

startButton.disabled =
true;


showStatus(
"このテストには答案が登録されていません。",
true
);

return;

}


startButton.disabled =
false;


showStatus(
`${test.name} / 答案 ${answers.length}件。採点開始でテスト全体の採点を開始できます。`
);

}


/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

students =
new Map();


const ids =
[
...new Set(
answers
.map(
answer =>
answer.student_id
)
.filter(Boolean)
)
];


if (!ids.length) {

return;

}


const {
data,
error
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
ids
);


if (error) {

throw new Error(
`生徒情報の取得に失敗しました: ${error.message}`
);

}


for (
const student
of data || []
) {

students.set(
student.id,
student
);

}

}


/* =====================================================
   ANSWER SUMMARY
===================================================== */

function renderAnswerSummary() {

if (!answerSummary ||
!answerSummaryBody) {

return;

}


answerSummary.classList.add(
"show"
);


answerSummaryBody.innerHTML =
"";


for (
const answer
of answers
) {

const student =
students.get(
answer.student_id
);


const row =
document.createElement(
"tr"
);


const no =
document.createElement(
"td"
);


no.textContent =
student?.student_no ||
"未紐付け";


const name =
document.createElement(
"td"
);


name.textContent =
student?.name ||
"-";


const pageCount =
document.createElement(
"td"
);


pageCount.textContent =
String(
answer.page_count ||
0
);


const status =
document.createElement(
"td"
);


status.textContent =
getAnswerStatus(
answer.status
);


row.appendChild(
no
);

row.appendChild(
name
);

row.appendChild(
pageCount
);

row.appendChild(
status
);


answerSummaryBody.appendChild(
row
);

}

}


/* =====================================================
   START
===================================================== */

async function startMarking() {

if (!testId) {

showStatus(
"テストを選択してください。",
true
);

return;

}


if (!answers.length) {

showStatus(
"答案がありません。",
true
);

return;

}


try {

setBusy(
true
);


showStatus(
"テスト全体の採点データを読み込んでいます..."
);


await loadTestData();


if (!questions.length) {

throw new Error(
"採点対象の設問がありません。"
);

}


started =
true;


currentQuestionIndex =
0;


questionArea.classList.add(
"show"
);


progressArea.classList.add(
"show"
);


startButton.textContent =
"採点中";


await renderCurrentQuestion();


} catch (error) {

console.error(
error
);


showStatus(
error.message ||
"採点を開始できませんでした。",
true
);

} finally {

setBusy(
false
);

}

}


/* =====================================================
   LOAD TEST DATA
===================================================== */

async function loadTestData() {


/* -----------------------------------------------------
   答案を最新取得
----------------------------------------------------- */

const {
data: answerData,
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
testId
)
.order(
"uploaded_at",
{
ascending:true
}
);


if (answerError) {

throw new Error(
`答案の取得に失敗しました: ${answerError.message}`
);

}


answers =
answerData || [];


await loadStudents();


/* -----------------------------------------------------
   Pages
----------------------------------------------------- */

pages =
new Map();


const answerIds =
answers.map(
answer =>
answer.id
);


if (answerIds.length) {

const {
data: pageData,
error: pageError
} =
await supabaseClient
.from(
"answer_sheet_pages"
)
.select(
`
answer_sheet_id,
page_no,
file_path,
file_type,
original_name,
width_px,
height_px
`
)
.in(
"answer_sheet_id",
answerIds
)
.order(
"page_no",
{
ascending:true
}
);


if (pageError) {

throw new Error(
`答案ページの取得に失敗しました: ${pageError.message}`
);

}


for (
const page
of pageData || []
) {

if (
!pages.has(
page.answer_sheet_id
)
) {

pages.set(
page.answer_sheet_id,
[]
);

}


pages
.get(
page.answer_sheet_id
)
.push(
page
);

}

}


/* -----------------------------------------------------
   Layout boxes
----------------------------------------------------- */

const {
data: boxData,
error: boxError
} =
await supabaseClient
.from(
"layout_boxes"
)
.select(
`
id,
test_id,
page_no,
box_type,
label,
x,
y,
width,
height,
question_id,
created_at,
points
`
)
.eq(
"test_id",
testId
)
.order(
"page_no",
{
ascending:true
}
)
.order(
"created_at",
{
ascending:true
}
);


if (boxError) {

throw new Error(
`枠設定の取得に失敗しました: ${boxError.message}`
);

}


boxes =
boxData || [];


/* -----------------------------------------------------
   Questions
----------------------------------------------------- */

questions =
boxes
.filter(
box => {

const type =
String(
box.box_type ||
""
)
.trim()
.toLowerCase();


return (
type === "answer" &&
Boolean(
box.question_id
)
);

}
)
.map(
box => ({

id:
box.id,

label:
box.label ||
"設問",

pageNo:
Number(
box.page_no
),

x:
Number(
box.x
),

y:
Number(
box.y
),

width:
Number(
box.width
),

height:
Number(
box.height
),

questionId:
box.question_id,

points:
Number(
box.points
) || 0

})
);


/* -----------------------------------------------------
   Scores
----------------------------------------------------- */

scores =
[];


if (answerIds.length) {

const {
data: scoreData,
error: scoreError
} =
await supabaseClient
.from(
"scores"
)
.select(
`
id,
answer_sheet_id,
layout_box_id,
question_id,
score,
status,
marked_at
`
)
.in(
"answer_sheet_id",
answerIds
);


if (scoreError) {

throw new Error(
`採点結果の取得に失敗しました: ${scoreError.message}`
);

}


scores =
scoreData || [];

}


updateProgress();

}


/* =====================================================
   QUESTION
===================================================== */

async function renderCurrentQuestion() {

if (!questions.length) {

return;

}


const question =
questions[
currentQuestionIndex
];


questionTitle.textContent =
question.label;


questionMeta.textContent =
`配点 ${formatNumber(
question.points
)}点 / 問題 ${
currentQuestionIndex + 1
} / ${
questions.length
}`;


previousButton.disabled =
currentQuestionIndex <=
0;


nextButton.textContent =
currentQuestionIndex >=
questions.length - 1
? "採点完了確認"
: "次の問題";


answerTableWrap.innerHTML = `

<div class="empty">
答案を表示しています...
</div>

`;


const table =
document.createElement(
"table"
);


table.className =
"answer-table";


table.innerHTML = `

<thead>

<tr>

<th class="student-cell">
生徒
</th>

<th class="answer-cell">
答案
</th>

<th class="score-cell">
得点
</th>

<th>
状態
</th>

</tr>

</thead>

<tbody></tbody>

`;


const tbody =
table.querySelector(
"tbody"
);


for (
const answer
of answers
) {

const row =
await createAnswerRow(
answer,
question
);


tbody.appendChild(
row
);

}


answerTableWrap.innerHTML =
"";


answerTableWrap.appendChild(
table
);


updateProgress();


showStatus(
`${test.name} / ${question.label} を採点中`
);

}


/* =====================================================
   ANSWER ROW
===================================================== */

async function createAnswerRow(
answer,
question
) {

const row =
document.createElement(
"tr"
);


/* -----------------------------------------------------
   Student
----------------------------------------------------- */

const studentCell =
document.createElement(
"td"
);


studentCell.className =
"student-cell";


const student =
students.get(
answer.student_id
);


const no =
document.createElement(
"div"
);


no.className =
"student-no";


no.textContent =
student?.student_no ||
"未紐付け";


const name =
document.createElement(
"div"
);


name.className =
"student-name";


name.textContent =
student?.name ||
"";


studentCell.appendChild(
no
);

studentCell.appendChild(
name
);


/* -----------------------------------------------------
   Image
----------------------------------------------------- */

const answerCell =
document.createElement(
"td"
);


answerCell.className =
"answer-cell";


try {

const viewer =
await createAnswerViewer(
answer,
question
);


answerCell.appendChild(
viewer
);

} catch (error) {

const missing =
document.createElement(
"div"
);


missing.className =
"answer-missing";


missing.textContent =
error.message ||
"答案画像を表示できません。";


answerCell.appendChild(
missing
);

}


/* -----------------------------------------------------
   Score
----------------------------------------------------- */

const scoreCell =
document.createElement(
"td"
);


scoreCell.className =
"score-cell";


const existing =
findScore(
answer.id,
question.id
);


const input =
document.createElement(
"input"
);


input.type =
"number";


input.step =
"0.1";


input.min =
"0";


input.max =
String(
question.points
);


input.className =
"score-input";


input.value =
existing
? existing.score
: "";


const save =
document.createElement(
"button"
);


save.type =
"button";


save.className =
"btn btn-primary score-save-button";


save.textContent =
"保存";


const state =
document.createElement(
"div"
);


state.className =
"score-state";


state.textContent =
existing &&
existing.status ===
"marked"
? "採点済み"
: "未採点";


if (
existing &&
existing.status ===
"marked"
) {

state.classList.add(
"marked"
);

}


const warning =
document.createElement(
"div"
);


warning.className =
"warning";


input.addEventListener(
"input",
() => {

validateInput(
input,
warning,
question.points
);

}
);


save.addEventListener(
"click",
async () => {

await saveScore(
answer,
question,
input,
warning,
state
);

}
);


scoreCell.appendChild(
input
);

scoreCell.appendChild(
document.createElement(
"br"
)
);

scoreCell.appendChild(
save
);

scoreCell.appendChild(
state
);

scoreCell.appendChild(
warning
);


/* -----------------------------------------------------
   Status
----------------------------------------------------- */

const statusCell =
document.createElement(
"td"
);


if (
existing &&
existing.status ===
"marked"
) {

statusCell.textContent =
"採点済み";

statusCell.style.color =
"#1769aa";

} else {

statusCell.textContent =
"未採点";

statusCell.style.color =
"#b42318";

}


row.appendChild(
studentCell
);

row.appendChild(
answerCell
);

row.appendChild(
scoreCell
);

row.appendChild(
statusCell
);


return row;

}


/* =====================================================
   ANSWER IMAGE
===================================================== */

async function createAnswerViewer(
answer,
question
) {

const answerPages =
pages.get(
answer.id
) || [];


const page =
answerPages.find(
item =>
Number(
item.page_no
) ===
Number(
question.pageNo
)
);


if (!page) {

throw new Error(
`答案ページ ${question.pageNo} がありません。`
);

}


if (!page.file_path) {

throw new Error(
"答案画像のStorageパスがありません。"
);

}


/* -----------------------------------------------------
   Storage
----------------------------------------------------- */

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
600
);


if (error) {

throw new Error(
`答案画像を取得できません: ${error.message}`
);

}


if (!data?.signedUrl) {

throw new Error(
"答案画像URLを取得できません。"
);

}


/* -----------------------------------------------------
   Viewer
----------------------------------------------------- */

const viewer =
document.createElement(
"div"
);


viewer.className =
"answer-viewer";


const image =
document.createElement(
"img"
);


image.src =
data.signedUrl;


image.alt =
"答案";


image.draggable =
false;


await waitForImage(
image
);


/* -----------------------------------------------------
   Scale
----------------------------------------------------- */

const pageWidth =
Number(
page.width_px
) ||
image.naturalWidth;


const pageHeight =
Number(
page.height_px
) ||
image.naturalHeight;


const scaleX =
image.naturalWidth /
pageWidth;


const scaleY =
image.naturalHeight /
pageHeight;


const x =
Number(
question.x
) ||
0;


const y =
Number(
question.y
) ||
0;


const width =
Math.max(
1,
Number(
question.width
) ||
1
);


const height =
Math.max(
1,
Number(
question.height
) ||
1
);


const cropWidth =
width *
scaleX;


const cropHeight =
height *
scaleY;


const displayWidth =
Math.min(
500,
Math.max(
350,
cropWidth
)
);


const displayScale =
displayWidth /
cropWidth;


const displayHeight =
Math.max(
150,
cropHeight *
displayScale
);


viewer.style.height =
`${displayHeight}px`;


image.style.width =
`${image.naturalWidth *
displayScale}px`;


image.style.height =
`${image.naturalHeight *
displayScale}px`;


image.style.left =
`${-x *
scaleX *
displayScale}px`;


image.style.top =
`${-y *
scaleY *
displayScale}px`;


viewer.appendChild(
image
);


return viewer;

}


/* =====================================================
   SAVE SCORE
===================================================== */

async function saveScore(
answer,
question,
input,
warning,
state
) {

const value =
Number(
input.value
);


if (
input.value === ""
) {

showWarning(
warning,
"点数を入力してください。"
);

return;

}


if (
!Number.isFinite(
value
)
) {

showWarning(
warning,
"点数が不正です。"
);

return;

}


if (
value < 0 ||
value >
question.points
) {

showWarning(
warning,
`0〜${question.points}点で入力してください。`
);

return;

}


warning.classList.remove(
"show"
);


if (saving) {

return;

}


saving =
true;


try {

/* ---------------------------------------------------
   Existing
--------------------------------------------------- */

const {
data: existing,
error: existingError
} =
await supabaseClient
.from(
"scores"
)
.select(
"id"
)
.eq(
"answer_sheet_id",
answer.id
)
.eq(
"layout_box_id",
question.id
)
.maybeSingle();


if (existingError) {

throw new Error(
`既存採点確認失敗: ${existingError.message}`
);

}


/* ---------------------------------------------------
   Update
--------------------------------------------------- */

if (existing?.id) {

const {
error
} =
await supabaseClient
.from(
"scores"
)
.update({

question_id:
question.questionId,

score:
value,

status:
"marked",

marked_at:
new Date().toISOString()

})
.eq(
"id",
existing.id
);


if (error) {

throw new Error(
`採点更新失敗: ${error.message}`
);

}


updateLocalScore(
existing.id,
answer.id,
question,
value
);

}


/* ---------------------------------------------------
   Insert
--------------------------------------------------- */

else {

const {
data,
error
} =
await supabaseClient
.from(
"scores"
)
.insert({

answer_sheet_id:
answer.id,

layout_box_id:
question.id,

question_id:
question.questionId,

score:
value,

status:
"marked",

marked_at:
new Date().toISOString()

})
.select(
"id"
)
.single();


if (error) {

throw new Error(
`採点登録失敗: ${error.message}`
);

}


updateLocalScore(
data.id,
answer.id,
question,
value
);

}


/* ---------------------------------------------------
   Status
--------------------------------------------------- */

state.textContent =
"採点済み";


state.className =
"score-state marked";


updateProgress();


showStatus(
`${getStudentLabel(
answer
)} / ${question.label} を保存しました。`
);


} catch (error) {

console.error(
error
);


showWarning(
warning,
error.message ||
"採点を保存できませんでした。"
);


state.textContent =
"保存失敗";


state.className =
"score-state error";


} finally {

saving =
false;

}

}


/* =====================================================
   LOCAL SCORE
===================================================== */

function updateLocalScore(
id,
answerId,
question,
value
) {

const existing =
findScore(
answerId,
question.id
);


if (existing) {

existing.id =
id;

existing.score =
value;

existing.status =
"marked";

return;

}


scores.push({

id,

answer_sheet_id:
answerId,

layout_box_id:
question.id,

question_id:
question.questionId,

score:
value,

status:
"marked"

});

}


/* =====================================================
   NEXT
===================================================== */

async function nextQuestion() {

const question =
questions[
currentQuestionIndex
];


if (
!isQuestionComplete(
question
)
) {

const proceed =
window.confirm(
"この問題には未採点の答案があります。このまま次へ進みますか？"
);


if (!proceed) {

return;

}

}


if (
currentQuestionIndex >=
questions.length - 1
) {

await finishMarking();

return;

}


currentQuestionIndex++;


await renderCurrentQuestion();

}


/* =====================================================
   COMPLETE
===================================================== */

async function finishMarking() {

const allComplete =
questions.every(
question =>
isQuestionComplete(
question
)
);


if (!allComplete) {

const remaining =
questions.filter(
question =>
!isQuestionComplete(
question
)
).length;


showStatus(
`未採点の設問があります。残り ${remaining}問です。`,
true
);


return;

}


completeArea.classList.add(
"show"
);


updateProgress();


showStatus(
"全答案・全設問の採点が完了しました。成績処理待ちです。"
);


/*
 * ここでは
 * answer_sheets.status = marked
 * に変更しない。
 *
 * 成績・偏差値・順位が完了してから
 * 最終確定処理で変更する。
 */

}


/* =====================================================
   QUESTION COMPLETE
===================================================== */

function isQuestionComplete(
question
) {

if (!question) {

return false;

}


return answers.every(
answer => {

const score =
findScore(
answer.id,
question.id
);


return Boolean(
score &&
score.status ===
"marked"
);

}
);

}


/* =====================================================
   FIND SCORE
===================================================== */

function findScore(
answerId,
questionId
) {

return scores.find(
score =>
score.answer_sheet_id ===
answerId &&
score.layout_box_id ===
questionId
) || null;

}


/* =====================================================
   PROGRESS
===================================================== */

function updateProgress() {

if (
!answers.length ||
!questions.length
) {

return;

}


let completed =
0;


const total =
answers.length *
questions.length;


for (
const answer
of answers
) {

for (
const question
of questions
) {

const score =
findScore(
answer.id,
question.id
);


if (
score &&
score.status ===
"marked"
) {

completed++;

}

}

}


const percent =
Math.round(
completed /
total *
100
);


progressBar.style.width =
`${percent}%`;


progressText.textContent =
`${completed} / ${total} 設問答案を採点済み (${percent}%)`;

}


/* =====================================================
   VALIDATE
===================================================== */

function validateInput(
input,
warning,
max
) {

if (
input.value === ""
) {

warning.classList.remove(
"show"
);

return;

}


const value =
Number(
input.value
);


if (
!Number.isFinite(
value
) ||
value < 0 ||
value > max
) {

showWarning(
warning,
`0〜${max}点で入力してください。`
);

return;

}


warning.classList.remove(
"show"
);

}


/* =====================================================
   WARNING
===================================================== */

function showWarning(
element,
text
) {

element.textContent =
text;

element.classList.add(
"show"
);

}


/* =====================================================
   STATUS
===================================================== */

function getAnswerStatus(
status
) {

switch (
String(
status ||
""
)
.toLowerCase()
) {

case "matched":
return "採点前";

case "uploaded":
return "採点前";

case "marking":
return "採点中";

case "marked":
return "採点完了・成績処理待ち";

default:
return status || "未処理";

}

}


/* =====================================================
   STUDENT
===================================================== */

function getStudentLabel(
answer
) {

const student =
students.get(
answer.student_id
);


if (!student) {

return "未紐付け";

}


return `${student.student_no || ""} / ${student.name || ""}`.trim();

}


/* =====================================================
   IMAGE
===================================================== */

function waitForImage(
image
) {

return new Promise(
(
resolve,
reject
) => {

if (
image.complete &&
image.naturalWidth > 0
) {

resolve();

return;

}


image.onload =
() =>
resolve();


image.onerror =
() =>
reject(
new Error(
"答案画像を読み込めませんでした。"
)
);

}
);


/* =====================================================
   RESET
===================================================== */

function resetState() {

test =
null;

answers =
[];

students =
new Map();

pages =
new Map();

boxes =
[];

questions =
[];

scores =
[];

currentQuestionIndex =
0;

started =
false;


answerSummary?.classList.remove(
"show"
);


questionArea?.classList.remove(
"show"
);


progressArea?.classList.remove(
"show"
);


completeArea?.classList.remove(
"show"
);


if (startButton) {

startButton.disabled =
true;

startButton.textContent =
"採点開始";

}


if (answerSummaryBody) {

answerSummaryBody.innerHTML =
"";

}


if (answerTableWrap) {

answerTableWrap.innerHTML = `

<div class="empty">
テストを選択してください。
</div>

`;

}

}


/* =====================================================
   BUSY
===================================================== */

function setBusy(
busy
) {

if (testSelect) {

testSelect.disabled =
busy;

}


if (startButton) {

startButton.disabled =
busy ||
!testId;

}


if (refreshButton) {

refreshButton.disabled =
busy;

}

}


/* =====================================================
   FORMAT
===================================================== */

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


/* =====================================================
   STATUS
===================================================== */

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

})();
