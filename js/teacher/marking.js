
/* =========================================================
   テスト成績システム
   テスト全体採点

   URL:
   /teacher/marking/mark?test=TEST_ID

   採点単位:
   テスト全体

   答案:
   answer_sheets
      ↓
   answer_sheet_pages
      ↓
   answer-files
========================================================= */

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

let saving = false;


/* =====================================================
   DOM
===================================================== */

const teacherName =
document.getElementById("teacherName");

const statusElement =
document.getElementById("status");

const progressArea =
document.getElementById("progressArea");

const progressBar =
document.getElementById("progressBar");

const progressText =
document.getElementById("progressText");

const questionTitle =
document.getElementById("questionTitle");

const questionMeta =
document.getElementById("questionMeta");

const previousButton =
document.getElementById("previousButton");

const nextButton =
document.getElementById("nextButton");

const answerTableWrap =
document.getElementById("answerTableWrap");

const completeArea =
document.getElementById("completeArea");

const refreshButton =
document.getElementById("refreshButton");


/* =====================================================
   START
===================================================== */

document.addEventListener(
"DOMContentLoaded",
initialize
);


/* =====================================================
   INITIALIZE
===================================================== */

async function initialize() {

try {

setStatus(
"採点画面を初期化しています..."
);


/* -----------------------------------------------------
   Auth
----------------------------------------------------- */

if (
typeof requireTeacher !==
"function"
) {

throw new Error(
"auth.js の requireTeacher が読み込まれていません。"
);

}


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


/* -----------------------------------------------------
   Events
----------------------------------------------------- */

setupEvents();


/* -----------------------------------------------------
   URL
----------------------------------------------------- */

const params =
new URLSearchParams(
window.location.search
);


testId =
params.get("test");


/*
 * もし ?test がない場合
 */

if (!testId) {

setStatus(
"テストが指定されていません。採点一覧からテストを選択してください。",
true
);


showEmpty(
"テストが指定されていません。"
);


return;

}


/*
 * UUIDが空でないことだけ確認。
 */

testId =
String(
testId
).trim();


if (!testId) {

throw new Error(
"テストIDが空です。"
);

}


/* -----------------------------------------------------
   Load
----------------------------------------------------- */

setStatus(
"テスト情報を取得しています..."
);


await loadTest();


} catch (error) {

console.error(
"MARKING INITIALIZE ERROR:",
error
);


setStatus(
error?.message ||
"採点画面の読み込みに失敗しました。",
true
);


showEmpty(
error?.message ||
"採点画面の読み込みに失敗しました。"
);

}

}


/* =====================================================
   EVENTS
===================================================== */

function setupEvents() {


previousButton?.addEventListener(
"click",
async () => {

if (
currentQuestionIndex <= 0
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


refreshButton?.addEventListener(
"click",
async () => {

try {

setStatus(
"更新しています..."
);


await loadTest();


} catch (error) {

console.error(
error
);


setStatus(
error.message ||
"更新に失敗しました。",
true
);

}

}
);


document
.getElementById("logoutButton")
?.addEventListener(
"click",
async event => {

event.preventDefault();


try {

if (
typeof logout ===
"function"
) {

await logout();

}

} catch (error) {

console.error(
error
);

}

}
);

}


/* =====================================================
   LOAD TEST
===================================================== */

async function loadTest() {


if (!testId) {

throw new Error(
"テストIDがありません。"
);

}


setStatus(
"テスト情報を取得しています..."
);


/* =====================================================
   TEST
===================================================== */

const {
data: testData,
error: testError
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
.eq(
"id",
testId
)
.maybeSingle();


if (testError) {

throw new Error(
`テスト取得エラー: ${testError.message}`
);

}


if (!testData) {

throw new Error(
`指定されたテストが見つかりません。テストID: ${testId}`
);

}


test =
testData;


/* =====================================================
   ANSWERS
===================================================== */

setStatus(
"答案を取得しています..."
);


const {
data: answerData,
error: answerError
} =
await supabaseClient
.from("answer_sheets")
.select(`
id,
test_id,
student_id,
page_count,
qr_value,
status,
uploaded_at
`)
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
`答案取得エラー: ${answerError.message}`
);

}


answers =
answerData || [];


if (!answers.length) {

throw new Error(
`「${test.name}」には登録された答案がありません。`
);

}


/* =====================================================
   STUDENTS
===================================================== */

setStatus(
"生徒情報を取得しています..."
);


await loadStudents();


/* =====================================================
   PAGES
===================================================== */

setStatus(
"答案ページを取得しています..."
);


await loadPages();


/* =====================================================
   LAYOUT
===================================================== */

setStatus(
"採点枠を取得しています..."
);


const {
data: boxData,
error: boxError
} =
await supabaseClient
.from("layout_boxes")
.select(`
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
`)
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
`採点枠取得エラー: ${boxError.message}`
);

}


boxes =
boxData || [];


/* =====================================================
   QUESTIONS
===================================================== */

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
) || 0,

y:
Number(
box.y
) || 0,

width:
Number(
box.width
) || 1,

height:
Number(
box.height
) || 1,

questionId:
box.question_id,

points:
Number(
box.points
) || 0

})
);


if (!questions.length) {

throw new Error(
`「${test.name}」に採点対象の設問枠がありません。layout_boxesのbox_type="answer"かつquestion_idが必要です。`
);

}


/* =====================================================
   SCORES
===================================================== */

setStatus(
"既存の採点結果を取得しています..."
);


await loadScores();


/* =====================================================
   READY
===================================================== */

currentQuestionIndex =
0;


if (progressArea) {

progressArea.classList.add(
"show"
);

}


await renderCurrentQuestion();


setStatus(
`${test.name} / 答案${answers.length}件 / 設問${questions.length}問`
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
.from("students")
.select(`
id,
student_no,
name
`)
.in(
"id",
ids
);


if (error) {

throw new Error(
`生徒取得エラー: ${error.message}`
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
   PAGES
===================================================== */

async function loadPages() {

pages =
new Map();


const ids =
answers.map(
answer =>
answer.id
);


if (!ids.length) {

return;

}


const {
data,
error
} =
await supabaseClient
.from("answer_sheet_pages")
.select(`
answer_sheet_id,
page_no,
file_path,
file_type,
original_name,
width_px,
height_px
`)
.in(
"answer_sheet_id",
ids
)
.order(
"page_no",
{
ascending:true
}
);


if (error) {

throw new Error(
`答案ページ取得エラー: ${error.message}`
);

}


for (
const page
of data || []
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


/* =====================================================
   SCORES
===================================================== */

async function loadScores() {

scores =
[];


const ids =
answers.map(
answer =>
answer.id
);


if (!ids.length) {

return;

}


const {
data,
error
} =
await supabaseClient
.from("scores")
.select(`
id,
answer_sheet_id,
layout_box_id,
question_id,
score,
status,
marked_at
`)
.in(
"answer_sheet_id",
ids
);


if (error) {

throw new Error(
`採点結果取得エラー: ${error.message}`
);

}


scores =
data || [];

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
`${test.name} / 配点 ${formatNumber(
question.points
)}点 / 問題 ${
currentQuestionIndex + 1
} / ${
questions.length
}`;


previousButton.disabled =
currentQuestionIndex <= 0;


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
   Answer
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
error.message;


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
"btn btn-primary score-save";

save.textContent =
"保存";


const state =
document.createElement(
"div"
);


state.className =
"score-state";


if (
existing &&
existing.status ===
"marked"
) {

state.textContent =
"採点済み";

state.classList.add(
"marked"
);

} else {

state.textContent =
"未採点";

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

validateScoreInput(
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
   ANSWER VIEWER
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
`答案ページ ${question.pageNo} が登録されていません。`
);

}


if (!page.file_path) {

throw new Error(
"答案ページのfile_pathがありません。"
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
`Storage画像取得エラー: ${error.message}`
);

}


if (!data?.signedUrl) {

throw new Error(
"Storageの署名URLを取得できませんでした。"
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
   Crop
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
   SAVE
===================================================== */

async function saveScore(
answer,
question,
input,
warning,
state
) {

if (saving) {

return;

}


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
value > question.points
) {

showWarning(
warning,
`0〜${question.points}点で入力してください。`
);

return;

}


saving =
true;


try {

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
`既存採点確認エラー: ${existingError.message}`
);

}


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
`採点更新エラー: ${error.message}`
);

}


updateLocalScore(
existing.id,
answer.id,
question,
value
);

} else {

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
`採点登録エラー: ${error.message}`
);

}


updateLocalScore(
data.id,
answer.id,
question,
value
);

}


warning.classList.remove(
"show"
);


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
   LOCAL
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

const complete =
questions.every(
question =>
isQuestionComplete(
question
)
);


if (!complete) {

const remaining =
questions.filter(
question =>
!isQuestionComplete(
question
)
).length;


showStatus(
`未採点の設問があります。残り${remaining}問です。`,
true
);

return;

}


if (completeArea) {

completeArea.classList.add(
"show"
);

}


showStatus(
"全答案・全設問の採点が完了しました。成績処理待ちです。"
);


updateProgress();


nextButton.disabled =
true;

}


/* =====================================================
   COMPLETE QUESTION
===================================================== */

function isQuestionComplete(
question
) {

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
   FIND
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


let complete =
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

complete++;

}

}

}


const percent =
Math.round(
complete /
total *
100
);


if (progressBar) {

progressBar.style.width =
`${percent}%`;

}


if (progressText) {

progressText.textContent =
`${complete} / ${total} 設問答案を採点済み (${percent}%)`;

}

}


/* =====================================================
   VALIDATE
===================================================== */

function validateScoreInput(
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
message
) {

element.textContent =
message;

element.classList.add(
"show"
);

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
   STATUS
===================================================== */

function showStatus(
message,
error = false
) {

if (!statusElement) {

return;

}


statusElement.textContent =
message;


statusElement.style.color =
error
? "#b42318"
: "#333";

}


/* =====================================================
   EMPTY
===================================================== */

function showEmpty(
message
) {

if (!answerTableWrap) {

return;

}


answerTableWrap.innerHTML = `

<div class="empty">

${escapeHtml(
message
)}

</div>

`;

}


/* =====================================================
   HELPERS
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
