/* =========================================================
   テスト成績システム
   共通ファイル解析

   対応:
   JPG
   JPEG
   PNG
   WEBP
   GIF
   BMP
   PDF
   ZIP

   出力はすべて
   「ページ画像」
   に統一する。
========================================================= */

(function () {

  "use strict";


  /* =======================================================
     対応形式
  ======================================================= */

  const IMAGE_EXTENSIONS = [

    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp"

  ];


  const PDF_EXTENSIONS = [

    "pdf"

  ];


  const ZIP_EXTENSIONS = [

    "zip"

  ];


  /* =======================================================
     拡張子
  ======================================================= */

  function getExtension(
    filename
  ) {

    const clean =
      String(
        filename || ""
      )
        .split("?")[0]
        .toLowerCase();


    const parts =
      clean.split(".");


    if (
      parts.length < 2
    ) {

      return "";

    }


    return parts.pop();

  }


  /* =======================================================
     判定
  ======================================================= */

  function isImage(
    filename
  ) {

    return IMAGE_EXTENSIONS
      .includes(
        getExtension(
          filename
        )
      );

  }


  function isPdf(
    filename
  ) {

    return PDF_EXTENSIONS
      .includes(
        getExtension(
          filename
        )
      );

  }


  function isZip(
    filename
  ) {

    return ZIP_EXTENSIONS
      .includes(
        getExtension(
          filename
        )
      );

  }


  function isSupported(
    filename
  ) {

    return (
      isImage(filename) ||
      isPdf(filename) ||
      isZip(filename)
    );

  }


  /* =======================================================
     画像
  ======================================================= */

  async function parseImage(
    file
  ) {

    const image =
      await loadImage(
        file
      );


    const png =
      await imageToPng(
        image
      );


    return [

      {

        type:
          "image",

        name:
          file.name,

        pageNo:
          1,

        blob:
          png,

        width:
          image.naturalWidth,

        height:
          image.naturalHeight

      }

    ];

  }


  /* =======================================================
     PDF
  ======================================================= */

  async function parsePdf(
    file
  ) {

    if (
      !window.TEST_SCORE_PDF
    ) {

      throw new Error(
        "PDF処理エンジンが読み込まれていません。"
      );

    }


    const pages =
      await window.TEST_SCORE_PDF
        .pdfToPages(
          file,
          2
        );


    return pages.map(
      page => ({

        type:
          "pdf",

        name:
          file.name,

        pageNo:
          page.pageNo,

        blob:
          page.blob,

        width:
          page.width,

        height:
          page.height

      })
    );

  }


  /* =======================================================
     ZIP
  ======================================================= */

  async function parseZip(
    file
  ) {

    if (
      typeof JSZip ===
      "undefined"
    ) {

      throw new Error(
        "ZIP処理ライブラリが読み込まれていません。"
      );

    }


    const zip =
      await JSZip.loadAsync(
        file
      );


    const entries = [];


    /*
      ZIP内を取得
    */

    for (
      const [
        path,
        entry
      ]
      of Object.entries(
        zip.files
      )
    ) {

      /*
        フォルダ除外
      */

      if (
        entry.dir
      ) {

        continue;

      }


      /*
        対応ファイルだけ
      */

      if (
        !isImage(path) &&
        !isPdf(path)
      ) {

        continue;

      }


      const blob =
        await entry.async(
          "blob"
        );


      entries.push({

        path,

        name:
          path
            .split("/")
            .pop(),

        blob

      });

    }


    /*
      何もない
    */

    if (
      !entries.length
    ) {

      throw new Error(
        "ZIP内に対応ファイルがありません。"
      );

    }


    /*
      ファイル名順
    */

    entries.sort(
      (a, b) =>
        a.path.localeCompare(
          b.path,
          undefined,
          {
            numeric:
              true
          }
        )
    );


    const result = [];


    let pageSequence =
      1;


    /*
      ZIP内部ファイル処理
    */

    for (
      const entry
      of entries
    ) {


      /*
        PDF
      */

      if (
        isPdf(
          entry.name
        )
      ) {

        const pages =
          await window.TEST_SCORE_PDF
            .pdfToPages(
              entry.blob,
              2
            );


        for (
          const page
          of pages
        ) {

          result.push({

            type:
              "zip-pdf",

            name:
              entry.name,

            sourcePath:
              entry.path,

            pageNo:
              pageSequence++,

            blob:
              page.blob,

            width:
              page.width,

            height:
              page.height

          });

        }


        continue;

      }


      /*
        画像
      */

      const image =
        await loadImage(
          entry.blob
        );


      const png =
        await imageToPng(
          image
        );


      result.push({

        type:
          "zip-image",

        name:
          entry.name,

        sourcePath:
          entry.path,

        pageNo:
          pageSequence++,

        blob:
          png,

        width:
          image.naturalWidth,

        height:
          image.naturalHeight

      });

    }


    return result;

  }


  /* =======================================================
     ファイル解析
  ======================================================= */

  async function parseFile(
    file
  ) {

    if (
      isZip(
        file.name
      )
    ) {

      return await parseZip(
        file
      );

    }


    if (
      isPdf(
        file.name
      )
    ) {

      return await parsePdf(
        file
      );

    }


    if (
      isImage(
        file.name
      )
    ) {

      return await parseImage(
        file
      );

    }


    throw new Error(
      `${file.name} は対応していないファイル形式です。`
    );

  }


  /* =======================================================
     Image → PNG
  ======================================================= */

  async function imageToPng(
    image
  ) {

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
      背景を白に統一
    */

    context.fillStyle =
      "#ffffff";


    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    context.drawImage(
      image,
      0,
      0
    );


    return await canvasToPng(
      canvas
    );

  }


  /* =======================================================
     Blob → Image
  ======================================================= */

  function loadImage(
    blob
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        const image =
          new Image();


        const url =
          URL.createObjectURL(
            blob
          );


        image.onload =
          () => {

            URL.revokeObjectURL(
              url
            );


            resolve(
              image
            );

          };


        image.onerror =
          () => {

            URL.revokeObjectURL(
              url
            );


            reject(
              new Error(
                "画像を読み込めませんでした。"
              )
            );

          };


        image.src =
          url;

      }
    );

  }


  /* =======================================================
     Canvas → PNG
  ======================================================= */

  function canvasToPng(
    canvas
  ) {

    return new Promise(
      (
        resolve,
        reject
      ) => {

        canvas.toBlob(
          blob => {

            if (!blob) {

              reject(
                new Error(
                  "PNG変換に失敗しました。"
                )
              );

              return;

            }


            resolve(
              blob
            );

          },
          "image/png"
        );

      }
    );

  }


  /* =======================================================
     ファイル名安全化
  ======================================================= */

  function sanitizeFileName(
    filename
  ) {

    return String(
      filename || ""
    )
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

  }


  /* =======================================================
     公開
  ======================================================= */

  window.TEST_SCORE_FILES = {

    parseFile,

    parseImage,

    parsePdf,

    parseZip,

    isImage,

    isPdf,

    isZip,

    isSupported,

    getExtension,

    sanitizeFileName

  };


})();
