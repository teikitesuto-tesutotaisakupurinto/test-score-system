/* =========================================================
   テスト成績システム
   PDF Loader

   PDF.jsを固定バージョンでロードする。

   実際のPDF.js本体はCDNから読み込む。
========================================================= */

(function () {

  "use strict";


  /*
    使用するPDF.jsバージョンを固定
  */

  const PDFJS_VERSION =
    "4.10.38";


  /*
    PDF.js本体
  */

  const PDFJS_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;


  /*
    PDF.js Worker
  */

  const PDFJS_WORKER_URL =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;


  /*
    ロード済みPromise
  */

  let loadingPromise =
    null;


  /*
    PDF.jsロード
  */

  async function loadPdfJs() {


    /*
      すでにロード済み
    */

    if (
      window.TEST_SCORE_PDFJS
    ) {

      return window.TEST_SCORE_PDFJS;

    }


    /*
      読み込み中
    */

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


          /*
            Worker設定
          */

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


  /*
    PDFを読み込む
  */

  async function loadPdf(
    blob
  ) {

    const pdfjsLib =
      await loadPdfJs();


    const buffer =
      await blob.arrayBuffer();


    const loadingTask =
      pdfjsLib.getDocument({

        data:
          buffer

      });


    return await loadingTask
      .promise;

  }


  /*
    PDFの1ページを画像化
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


    /*
      白背景
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


  /*
    PDF全部をページ配列にする
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
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
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


  /*
    Canvas → PNG
  */

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


  /*
    グローバル公開
  */

  window.TEST_SCORE_PDF = {

    loadPdf,

    renderPdfPage,

    pdfToPages,

    version:
      PDFJS_VERSION

  };


})();
