
/* =========================================================
   テスト成績システム
   PDF Loader

   PDF.jsを固定バージョンでロード。
========================================================= */

(function () {

  "use strict";


  const PDFJS_VERSION =
    "4.10.38";


  const PDFJS_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;


  const PDFJS_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;


  let loadingPromise =
    null;


  /* =======================================================
     PDF.jsロード
  ======================================================= */

  async function loadPdfJs() {

    if (
      window.TEST_SCORE_PDFJS
    ) {

      return window.TEST_SCORE_PDFJS;

    }


    if (
      loadingPromise
    ) {

      return loadingPromise;

    }


    loadingPromise =
      import(
        PDFJS_URL
      )
      .then(
        pdfjsLib => {

          pdfjsLib
            .GlobalWorkerOptions
            .workerSrc =
              PDFJS_WORKER_URL;


          window.TEST_SCORE_PDFJS =
            pdfjsLib;


          return pdfjsLib;

        }
      )
      .catch(
        error => {

          console.error(
            "PDF.js load error:",
            error
          );


          loadingPromise =
            null;


          throw new Error(
            "PDF.jsの読み込みに失敗しました。"
          );

        }
      );


    return loadingPromise;

  }


  /* =======================================================
     PDFロード
  ======================================================= */

  async function loadPdf(
    blob
  ) {

    if (!blob) {

      throw new Error(
        "PDFファイルがありません。"
      );

    }


    const pdfjsLib =
      await loadPdfJs();


    const buffer =
      await blob.arrayBuffer();


    const loadingTask =
      pdfjsLib.getDocument({

        data:
          buffer

      });


    return loadingTask.promise;

  }


  /* =======================================================
     1ページ描画
  ======================================================= */

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


    /*
     * PDF背景を白にする。
     */

    context.fillStyle =
      "#ffffff";


    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
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


  /* =======================================================
     PDF → ページ画像
  ======================================================= */

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
      let pageNumber = 1;
      pageNumber <=
        pdf.numPages;
      pageNumber++
    ) {

      const page =
        await renderPdfPage(
          pdf,
          pageNumber,
          scale
        );


      pages.push({

        pageNo:
          pageNumber,

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
                  "CanvasからPNGを生成できませんでした。"
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
     公開
  ======================================================= */

  window.TEST_SCORE_PDF = {

    loadPdf,

    renderPdfPage,

    pdfToPages,

    version:
      PDFJS_VERSION

  };


})();
