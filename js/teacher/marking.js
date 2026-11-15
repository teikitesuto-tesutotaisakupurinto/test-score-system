
"use strict";


/* =========================================================
   TEST MARKING
========================================================= */

(function () {


let DB = null;

let testId = null;

let test = null;

let answers = [];

let students = new Map();

let pages = new Map();

let questions = [];

let scores = [];

let questionIndex = 0;

let saving = false;


/* =========================================================
   DOM
========================================================= */

const statusEl =
document.getElementById("status");

const teacherName =
document.getElementById("teacherName");

const answerTableWrap =
document.getElementById("answerTableWrap");

const questionTitle =
document.getElementById("questionTitle");

const questionMeta =
document.getElementById("questionMeta");

const previousButton =
document.getElementById("previousButton");

const nextButton =
document.getElementById("nextButton");

const refreshButton =
document.getElementById("refreshButton");

const progress =
document.getElementById("progress");

const progressBar =
document.getElementById("progressBar");

const progressText =
document.getElementById("progressText");

const complete =
document.getElementById("complete");


/* =========================================================
   START
========================================================= */

function start() {

try {

setStatus(
"JavaScriptが起動しました。"
);


/* ---------------------------------------------------------
   Supabase
--------------------------------------------------------- */

DB =
window.SB ||
window.supabaseClient ||
window.sb;


if (!DB) {

throw new Error(
"Supabaseクライアントが見つかりません。config.jsを確認してください。"
);

}


/* ---------------------------------------------------------
   URL
--------------------------------------------------------- */

const params =
new URLSearchParams(
window.location.search
);

testId =
params.get("test");


if (!testId) {

throw new Error(
"テストIDがありません。採点一覧から「採点開始」を押してください。"
);

}


testId =
String(
testId
).trim();


setupEvents();


loadEverything();

} catch (error) {

showFatal(
error.message ||
"採点画面を起動できませんでした。"
);

}

}


/* =========================================================
   LOAD
========================================================= */

async function loadEverything() {

try {

setStatus(
"テスト情報を取得しています..."
);


const testResult =
await DB
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


if (testResult.error) {

throw new Error(
`テスト取得エラー: ${testResult.error.message}`
);

}


if (!testResult.data) {

throw new Error(
"指定されたテストがありません。"
);

}


test =
testResult.data;


setStatus(
"答案を取得しています..."
);


const answerResult =
await DB
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


if (answerResult.error) {

throw new Error(
`答案取得エラー: ${answerResult.error.message}`
);

}


answers =
answerResult.data || [];


if (!answers.length) {

throw new Error(
"このテストには答案がありません。"
);

}


setStatus(
"生徒情報を取得しています..."
);


await loadStudents();


setStatus(
"答案ページを取得しています..."
);


await loadPages();


setStatus(
"採点枠を取得しています..."
);


const boxResult =
await DB
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
points,
created_at
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


if (boxResult.error) {

throw new Error(
`採点枠取得エラー: ${boxResult.error.message}`
);

}


questions =
(boxResult.data || [])
.filter(
box => {

return (
String(
box.box_type ||
""
)
.toLowerCase()
.trim() ===
"answer" &&
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
"採点対象の設問がありません。"
);

}


setStatus(
"既存の採点結果を取得しています..."
);


await loadScores();


progress.classList.add(
"show"
);


await renderQuestion();


setStatus(
`${test.name} / 答案${answers.length}件 / 設問${questions.length}問`
);


} catch (error) {

showFatal(
error.message ||
"採点データの取得に失敗しました。"
);

}

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

students =
new Map();


const ids =
[
...new Set(
answers
.map(
item =>
item.student_id
)
.filter(Boolean)
)
];


if (!ids.length) {

return;

}


const result =
await DB
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


if (result.error) {

throw new Error(
`生徒情報取得エラー: ${result.error.message}`
);

}


for (
const student
of result.data || []
) {

students.set(
student.id,
student
);

}

}


/* =========================================================
   PAGES
========================================================= */

async function loadPages() {

pages =
new Map();


const ids =
answers.map(
item =>
item.id
);


const result =
await DB
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


if (result.error) {

throw new Error(
`答案ページ取得エラー: ${result.error.message}`
);

}


for (
const page
of result.data || []
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


/* =========================================================
   SCORES
========================================================= */

async function loadScores() {

const ids =
answers.map(
item =>
item.id
);


const result =
await DB
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


if (result.error) {

throw new Error(
`採点結果取得エラー: ${result.error.message}`
);

}


scores =
result.data || [];

}


/* =========================================================
   RENDER
========================================================= */

async function renderQuestion() {

const question =
questions[
questionIndex
];


questionTitle.textContent =
question.label;


questionMeta.textContent =
`${test.name} / 配点 ${format(
question.points
)}点 / ${questionIndex + 1} / ${questions.length}`;


previousButton.disabled =
questionIndex === 0;


nextButton.textContent =
questionIndex ===
questions.length - 1
? "採点完了確認"
: "次の問題";


answerTableWrap.innerHTML =
"";


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

tbody.appendChild(
await createRow(
answer,
question
)
);

}


answerTableWrap.appendChild(
table
);


updateProgress();

}


/* =========================================================
   ROW
========================================================= */

async function createRow(
answer,
question
) {

const row =
document.createElement(
"tr"
);


/* Student */

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


studentCell.append(
no,
name
);


/* Image */

const answerCell =
document.createElement(
"td"
);

answerCell.className =
"answer-cell";


try {

answerCell.appendChild(
await createViewer(
answer,
question
)
);

} catch (error) {

const errorBox =
document.createElement(
"div"
);

errorBox.className =
"answer-error";

errorBox.textContent =
error.message;

answerCell.appendChild(
errorBox
);

}


/* Score */

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

validate(
input,
warning,
question.points
);

}
);


save.addEventListener(
"click",
() => {

saveScore(
answer,
question,
input,
warning,
state
);

}
);


scoreCell.append(
input,
document.createElement("br"),
save,
state,
warning
);


/* Status */

const statusCell =
document.createElement(
"td"
);

statusCell.textContent =
existing &&
existing.status ===
"marked"
? "採点済み"
: "未採点";

statusCell.style.color =
existing &&
existing.status ===
"marked"
? "#1769aa"
: "#b42318";


row.append(
studentCell,
answerCell,
scoreCell,
statusCell
);


return row;

}


/* =========================================================
   VIEWER
========================================================= */

async function createViewer(
answer,
question
) {

const list =
pages.get(
answer.id
) ||
[];


const page =
list.find(
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


const result =
await DB
.storage
.from(
"answer-files"
)
.createSignedUrl(
page.file_path,
600
);


if (result.error) {

throw new Error(
`答案画像取得エラー: ${result.error.message}`
);

}


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
result.data.signedUrl;

image.alt =
"答案";


await waitImage(
image
);


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


viewer.style.height =
`${Math.max(
150,
cropHeight *
displayScale
)}px`;


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


/* =========================================================
   SAVE
========================================================= */

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

warn(
warning,
"点数を入力してください。"
);

return;

}


if (
!Number.isFinite(value) ||
value < 0 ||
value > question.points
) {

warn(
warning,
`0〜${question.points}点で入力してください。`
);

return;

}


saving =
true;


try {

const result =
await DB
.from("scores")
.select("id")
.eq(
"answer_sheet_id",
answer.id
)
.eq(
"layout_box_id",
question.id
)
.maybeSingle();


if (result.error) {

throw new Error(
`採点確認エラー: ${result.error.message}`
);

}


if (result.data) {

const update =
await DB
.from("scores")
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
result.data.id
);


if (update.error) {

throw new Error(
`採点更新エラー: ${update.error.message}`
);

}


setLocalScore(
result.data.id,
answer.id,
question,
value
);

} else {

const insert =
await DB
.from("scores")
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
.select("id")
.single();


if (insert.error) {

throw new Error(
`採点登録エラー: ${insert.error.message}`
);

}


setLocalScore(
insert.data.id,
answer.id,
question,
value
);

}


state.textContent =
"採点済み";

state.className =
"score-state marked";

warning.classList.remove(
"show"
);


updateProgress();


showStatus(
`${getStudentLabel(answer)} / ${question.label} を保存しました。`
);


} catch (error) {

warn(
warning,
error.message
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


/* =========================================================
   NEXT
========================================================= */

async function nextQuestion() {

const question =
questions[
questionIndex
];


if (
!isComplete(question)
) {

if (
!confirm(
"未採点の答案があります。このまま次へ進みますか？"
)
) {

return;

}

}


if (
questionIndex >=
questions.length - 1
) {

finish();

return;

}


questionIndex++;

await renderQuestion();

}


/* =========================================================
   FINISH
========================================================= */

function finish() {

const all =
questions.every(
question =>
isComplete(question)
);


if (!all) {

showStatus(
"まだ未採点の答案があります。",
true
);

return;

}


complete.classList.add(
"show"
);


showStatus(
"全答案・全設問の採点が完了しました。成績処理待ちです。"
);


nextButton.disabled =
true;

}


/* =========================================================
   HELPERS
========================================================= */

function findScore(
answerId,
questionId
) {

return scores.find(
item =>
item.answer_sheet_id ===
answerId &&
item.layout_box_id ===
questionId
) ||
null;

}


function setLocalScore(
id,
answerId,
question,
value
) {

const old =
findScore(
answerId,
question.id
);


if (old) {

old.id =
id;

old.score =
value;

old.status =
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


function isComplete(
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


function updateProgress() {

const total =
answers.length *
questions.length;


let done =
0;


for (
const answer
of answers
) {

for (
const question
of questions
) {

if (
isScored(
answer.id,
question.id
)
) {

done++;

}

}

}


const percent =
total
? Math.round(
done /
total *
100
)
: 0;


progressBar.style.width =
`${percent}%`;

progressText.textContent =
`${done} / ${total} 設問答案を採点済み (${percent}%)`;

}


function isScored(
answerId,
questionId
) {

const score =
findScore(
answerId,
questionId
);

return Boolean(
score &&
score.status ===
"marked"
);

}


function validate(
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
!Number.isFinite(value) ||
value < 0 ||
value > max
) {

warn(
warning,
`0〜${max}点で入力してください。`
);

return;

}


warning.classList.remove(
"show"
);

}


function warn(
element,
message
) {

element.textContent =
message;

element.classList.add(
"show"
);

}


function waitImage(
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
resolve;

image.onerror =
() =>
reject(
new Error(
"答案画像を読み込めませんでした。"
)
);

}
);


}


function getStudentLabel(
answer
) {

const student =
students.get(
answer.student_id
);

return student
? `${student.student_no || ""} / ${student.name || ""}`
: "未紐付け";

}


function format(
value
) {

const n =
Number(value);

return Number.isFinite(n)
? String(n)
: "0";

}


function setStatus(
message,
error
) {

statusEl.textContent =
message;

statusEl.style.color =
error
? "#b42318"
: "#333";

}


function showFatal(
message
) {

setStatus(
message,
true
);

answerTableWrap.innerHTML = `

<div class="empty">

${escapeHtml(message)}

<br><br>

<a
href="/teacher/marking"
class="btn"
>
採点一覧へ戻る
</a>

</div>

`;

}


function escapeHtml(
value
) {

return String(
value ??
""
)
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");

}


/* =========================================================
   START
========================================================= */

start();


})();
