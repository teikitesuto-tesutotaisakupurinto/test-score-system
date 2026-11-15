(function () {

  "use strict";


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


  function getExtension(
    filename
  ) {

    const clean =
      String(filename)
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


  function isImage(
    filename
  ) {

    return IMAGE_EXTENSIONS.includes(
      getExtension(filename)
    );

  }


  function isPdf(
    filename
  ) {

    return PDF_EXTENSIONS.includes(
      getExtension(filename)
    );

  }


  function isZip(
    filename
  ) {

    return ZIP_EXTENSIONS.includes(
      getExtension(filename)
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


  async function imageToPng(
    blob
  ) {

    const image =
      await loadImage(
        blob
      );


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
      白背景にしておく。
      GIF/WebP/BMP等の透明背景問題を
      答案画像側で防ぐ。
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


    const png =
      await canvasToPng(
        canvas
      );


    return {

      blob:
        png,

      width:
        canvas.width,

      height:
        canvas.height

    };

  }


  async function parseImage(
    file
  ) {

    const result =
      await imageToPng(
        file
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
          result.blob,

        width:
          result.width,

        height:
          result.height

      }

    ];

  }


  async function parsePdf(
    file
  ) {

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


    for (
      const [
        path,
        entry
      ]
      of Object.entries(
        zip.files
      )
    ) {

      if (
        entry.dir
      ) {

        continue;

      }


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


    let sequence =
      1;


    for (
      const entry
      of entries
    ) {

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
              sequence++,

            blob:
              page.blob,

            width:
              page.width,

            height:
              page.height

          });

        }

      } else {

        const image =
          await imageToPng(
            entry.blob
          );


        result.push({

          type:
            "zip-image",

          name:
            entry.name,

          sourcePath:
            entry.path,

          pageNo:
            sequence++,

          blob:
            image.blob,

          width:
            image.width,

          height:
            image.height

        });

      }

    }


    return result;

  }


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


  function sanitizeFileName(
    filename
  ) {

    return String(filename)
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

  }


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
