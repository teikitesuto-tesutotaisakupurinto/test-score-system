(function () {

  "use strict";


  const PDFJS_VERSION =
    "4.10.38";


  const PDFJS_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;


  const PDFJS_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;


  let pdfjsPromise =
    null;


  /*
    PDF.jsを1回だけロード
  */

  async function loadPdfJs() {

    if (window.TEST_SCORE_PDFJS) {

      return window.TEST_SCORE_PDFJS;

    }


    if (pdfjsPromise) {

      return pdfjsPromise;

    }


    pdfjsPromise =
      import(
        PDFJS_URL
      )
      .then(
        pdfjsLib => {

          pdfjsLib.GlobalWorkerOptions.workerSrc =
            PDFJS_WORKER_URL;


          window.TEST_SCORE_PDFJS =
            pdfjsLib;


          return pdfjsLib;

        }
      )
      .catch(
        error => {

          pdfjsPromise =
            null;

          throw new Error(
            "PDF.jsの読み込みに失敗しました。"
          );

        }
      );


    return pdfjsPromise;

  }


  /*
    Blob / File → PDF
  */

  async function loadPdf(
    blob
  ) {

    const pdfjsLib =
      await loadPdfJs();


    const buffer =
      await blob.arrayBuffer();


    return await pdfjsLib
      .getDocument({
        data:
          buffer
      })
      .promise;

  }


  /*
    PDF 1ページ → PNG Blob
  */

  async function renderPdfPage(
    pdf,
    pageNumber,
    scale = 2
  ) {

    const page =
      await pdf.getPage(
        pageNumber
      );


    const viewport =
      page.getViewport({
        scale
      });


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      Math.ceil(
        viewport.width
      );


    canvas.height =
      Math.ceil(
        viewport.height
      );


    const context =
      canvas.getContext(
        "2d"
      );


    await page.render({

      canvasContext:
        context,

      viewport

    }).promise;


    const blob =
      await canvasToPng(
        canvas
      );


    return {

      blob,

      width:
        canvas.width,

      height:
        canvas.height

    };

  }


  /*
    PDF全部 → ページ配列
  */

  async function pdfToPages(
    blob,
    scale = 2
  ) {

    const pdf =
      await loadPdf(
        blob
      );


    const pages = [];


    for (
      let pageNo = 1;
      pageNo <= pdf.numPages;
      pageNo++
    ) {

      const page =
        await renderPdfPage(
          pdf,
          pageNo,
          scale
        );


      pages.push({

        pageNo,

        blob:
          page.blob,

        width:
          page.width,

        height:
          page.height

      });

    }


    return pages;

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
                  "CanvasをPNGへ変換できませんでした。"
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


  window.TEST_SCORE_PDF = {

    loadPdf,

    renderPdfPage,

    pdfToPages,

    version:
      PDFJS_VERSION

  };

})();
