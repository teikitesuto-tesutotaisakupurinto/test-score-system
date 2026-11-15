const regionTestId =
  new URLSearchParams(location.search).get("test");

async function buildAnswerRegions() {

  const profile = await getProfile();

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

  if (!regionTestId) {
    throw new Error("テストが指定されていません。");
  }

  /*
    テストの解答欄
  */
  const {
    data: boxes,
    error: boxError
  } = await supabaseClient
    .from("layout_boxes")
    .select(`
      id,
      page_no,
      x,
      y,
      width,
      height,
      box_type
    `)
    .eq("test_id", regionTestId)
    .eq("box_type", "answer")
    .order("page_no");

  if (boxError) {
    throw boxError;
  }

  /*
    紐付け済み答案
  */
  const {
    data: answers,
    error: answerError
  } = await supabaseClient
    .from("answer_sheets")
    .select(`
      id,
      student_id,
      original_file_path,
      status
    `)
    .eq("test_id", regionTestId)
    .neq("status", "unmatched");

  if (answerError) {
    throw answerError;
  }

  /*
    ページ画像
  */
  const {
    data: pages,
    error: pageError
  } = await supabaseClient
    .from("test_pages")
    .select(`
      page_no,
      image_path
    `)
    .eq("test_id", regionTestId)
    .neq("page_no", 999)
    .order("page_no");

  if (pageError) {
    throw pageError;
  }

  const pageMap = new Map(
    (pages || []).map(page => [
      page.page_no,
      page.image_path
    ])
  );

  let created = 0;

  for (const answer of answers || []) {

    for (const box of boxes || []) {

      const sourcePath =
        await getAnswerPagePath(
          answer,
          box.page_no,
          pageMap
        );

      if (!sourcePath) {
        continue;
      }

      /*
        既存確認
      */
      const {
        data: existing
      } = await supabaseClient
        .from("answer_regions")
        .select("id")
        .eq(
          "answer_sheet_id",
          answer.id
        )
        .eq(
          "question_id",
          box.id
        )
        .maybeSingle();

      /*
        現在question_idが問題登録方式の
        名残なので、ここではbox IDを
        仮識別子として扱わない。

        実際の採点保存はlayout_box_idを
        使用する。
      */

      const regionPath =
        `${regionTestId}/${answer.id}/box-${box.id}.png`;

      /*
        実画像切り出しは、
        ブラウザで画像をCanvasに読み込んで
        Storageへ保存する。
      */

      const blob =
        await cropImage(
          sourcePath,
          box
        );

      if (!blob) {
        continue;
      }

      const {
        error: uploadError
      } =
        await supabaseClient
          .storage
          .from("student-answers")
          .upload(
            regionPath,
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
        answer_regionsは既存設計上
        question_idが必要なので、
        次のDB変更でlayout_box_idを追加する。
      */

      created++;
    }
  }

  return created;
}


async function getAnswerPagePath(
  answer,
  pageNo,
  pageMap
) {
  /*
    現在のアップロード形式が
    1ファイル1答案の場合、
    元ファイルを返す。

    複数ページPDF対応は次段階。
  */

  if (!answer.original_file_path) {
    return null;
  }

  return answer.original_file_path;
}


async function cropImage(
  path,
  box
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from("answer-files")
      .createSignedUrl(
        path,
        3600
      );

  if (error) {
    console.error(error);
    return null;
  }

  const image =
    await loadImage(
      data.signedUrl
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  const x =
    Number(box.x) || 0;

  const y =
    Number(box.y) || 0;

  const width =
    Number(box.width) || 1;

  const height =
    Number(box.height) || 1;

  canvas.width =
    Math.max(1, Math.round(width));

  canvas.height =
    Math.max(1, Math.round(height));

  const ctx =
    canvas.getContext("2d");

  ctx.drawImage(
    image,
    x,
    y,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return new Promise(
    resolve =>
      canvas.toBlob(
        resolve,
        "image/png"
      )
  );
}


function loadImage(
  src
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();

      image.onload =
        () => resolve(image);

      image.onerror =
        reject;

      image.src =
        src;

    }
  );
}
