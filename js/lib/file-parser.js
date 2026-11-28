/* =========================================================
   テスト成績システム 共通ファイル解析
   PDF / 画像 / ZIP / Word / Excel / PowerPoint / CSV / TXT
   すべて採点・枠設定で使えるPNGページへ統一
========================================================= */
(function () {
  "use strict";

  const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
  const PDF_EXTENSIONS = ["pdf"];
  const ZIP_EXTENSIONS = ["zip"];
  const OFFICE_EXTENSIONS = ["docx", "xlsx", "xls", "pptx", "csv", "txt"];

  function getExtension(filename) {
    const clean = String(filename || "").split("?")[0].toLowerCase();
    const parts = clean.split(".");
    return parts.length < 2 ? "" : parts.pop();
  }
  function isImage(filename) { return IMAGE_EXTENSIONS.includes(getExtension(filename)); }
  function isPdf(filename) { return PDF_EXTENSIONS.includes(getExtension(filename)); }
  function isZip(filename) { return ZIP_EXTENSIONS.includes(getExtension(filename)); }
  function isOffice(filename) { return OFFICE_EXTENSIONS.includes(getExtension(filename)); }
  function isSupported(filename) { return isImage(filename) || isPdf(filename) || isZip(filename) || isOffice(filename); }

  async function parseImage(file) {
    const image = await loadImage(file);
    const png = await imageToPng(image);
    return [{ type: "image", name: file.name, pageNo: 1, blob: png, width: image.naturalWidth, height: image.naturalHeight }];
  }

  async function parsePdf(file) {
    if (!window.TEST_SCORE_PDF) throw new Error("PDF処理エンジンが読み込まれていません。");
    const pages = await window.TEST_SCORE_PDF.pdfToPages(file, 2);
    return pages.map(page => ({ type: "pdf", name: file.name, pageNo: page.pageNo, blob: page.blob, width: page.width, height: page.height }));
  }

  async function parseOffice(file) {
    const ext = getExtension(file.name);
    if (typeof html2canvas !== "function") throw new Error("文書変換ライブラリが読み込まれていません。画面を再読み込みしてください。");
    if (ext === "docx") {
      if (!window.mammoth) throw new Error("Word変換ライブラリが読み込まれていません。");
      const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      if (!result.value || !result.value.trim()) throw new Error("Word文書から本文を読み取れませんでした。");
      return renderHtmlPages(result.value, file.name, "word");
    }
    if (["xlsx", "xls", "csv"].includes(ext)) {
      if (!window.XLSX) throw new Error("Excel変換ライブラリが読み込まれていません。");
      const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const result = [];
      for (const sheetName of workbook.SheetNames) {
        const html = window.XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { header: "", footer: "" });
        const title = "<h2>" + escapeHtml(sheetName) + "</h2>";
        const pages = await renderHtmlPages(title + html, file.name + " - " + sheetName, "spreadsheet");
        result.push(...pages);
      }
      if (!result.length) throw new Error("Excelファイルに読み取れるシートがありません。");
      return result;
    }
    if (ext === "txt") {
      const text = await file.text();
      const html = "<pre class='plain-text'>" + escapeHtml(text) + "</pre>";
      return renderHtmlPages(html, file.name, "text");
    }
    if (ext === "pptx") return parsePowerPoint(file);
    throw new Error(file.name + " は未対応のファイル形式です。");
  }

  async function parsePowerPoint(file) {
    if (typeof JSZip === "undefined") throw new Error("PowerPoint展開ライブラリが読み込まれていません。");
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path));
    names.sort((a, b) => Number(a.match(/slide(\d+)/i)[1]) - Number(b.match(/slide(\d+)/i)[1]));
    if (!names.length) throw new Error("PowerPointのスライドを読み取れませんでした。");
    const result = [];
    for (let index = 0; index < names.length; index++) {
      const xml = await zip.files[names[index]].async("text");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      if (doc.querySelector("parsererror")) throw new Error("PowerPointのスライドデータが破損しています。");
      const paragraphs = Array.from(doc.getElementsByTagNameNS("*", "p"));
      const lines = paragraphs.map(p => Array.from(p.getElementsByTagNameNS("*", "t")).map(t => t.textContent || "").join("")).filter(Boolean);
      const body = lines.length ? lines.map(line => "<p>" + escapeHtml(line) + "</p>").join("") : "<p>このスライドには抽出可能なテキストがありません。</p>";
      const pages = await renderHtmlPages("<h2>スライド " + (index + 1) + "</h2>" + body, file.name, "presentation");
      result.push(...pages);
    }
    return result;
  }

  async function renderHtmlPages(html, filename, kind) {
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:-12000px;top:0;width:1000px;background:#fff;color:#111;padding:48px 56px;box-sizing:border-box;font-family:Arial,'Noto Sans JP',sans-serif;font-size:22px;line-height:1.55;overflow-wrap:anywhere;";
    const style = document.createElement("style");
    style.textContent = "*,*::before,*::after{box-sizing:border-box} h1,h2,h3{margin:0 0 24px} p{margin:0 0 14px} table{border-collapse:collapse;width:100%;font-size:16px} td,th{border:1px solid #777;padding:6px;vertical-align:top} img{max-width:100%;height:auto} pre{white-space:pre-wrap;overflow-wrap:anywhere;font-family:monospace;font-size:18px} ul,ol{padding-left:32px}";
    root.appendChild(style);
    document.body.appendChild(root);

    const source = document.createElement("div");
    source.innerHTML = html;
    const nodes = Array.from(source.childNodes);
    const groups = [];
    const maxHeight = 1320;
    let current = document.createElement("div");
    root.appendChild(current);

    for (const node of nodes) {
      current.appendChild(node.cloneNode(true));
      if (current.scrollHeight > maxHeight && current.childNodes.length > 1) {
        const last = current.lastChild;
        current.removeChild(last);
        groups.push(current);
        current = document.createElement("div");
        root.appendChild(current);
        current.appendChild(last);
      }
    }
    if (current.childNodes.length || !groups.length) groups.push(current);

    const pages = [];
    try {
      for (let i = 0; i < groups.length; i++) {
        const page = document.createElement("div");
        page.style.cssText = "width:1000px;min-height:1300px;background:#fff;padding:48px 56px;box-sizing:border-box;font-family:Arial,'Noto Sans JP',sans-serif;font-size:22px;line-height:1.55;color:#111;overflow-wrap:anywhere;";
        page.appendChild(groups[i]);
        root.replaceChildren(style, page);
        await new Promise(resolve => requestAnimationFrame(resolve));
        const canvas = await html2canvas(page, { scale: 1.5, backgroundColor: "#ffffff", useCORS: true, logging: false });
        const blob = await canvasToPng(canvas);
        pages.push({ type: kind, name: filename, pageNo: i + 1, blob, width: canvas.width, height: canvas.height });
      }
    } finally {
      root.remove();
    }
    return pages;
  }

  async function parseZip(file) {
    if (typeof JSZip === "undefined") throw new Error("ZIP処理ライブラリが読み込まれていません。");
    const zip = await JSZip.loadAsync(file);
    const entries = Object.entries(zip.files).filter(([path, entry]) => !entry.dir && isSupported(path) && !isZip(path));
    if (!entries.length) throw new Error("ZIP内に対応ファイルがありません。");
    entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    const result = [];
    for (const [path, entry] of entries) {
      const blob = await entry.async("blob");
      const nestedFile = new File([blob], path.split("/").pop(), { type: blob.type });
      const parsed = await parseFile(nestedFile);
      for (const page of parsed) result.push({ ...page, sourcePath: path, pageNo: result.length + 1 });
    }
    return result;
  }

  async function parseFile(file) {
    if (!file) throw new Error("ファイルが指定されていません。");
    if (isZip(file.name)) return parseZip(file);
    if (isPdf(file.name)) return parsePdf(file);
    if (isImage(file.name)) return parseImage(file);
    if (isOffice(file.name)) return parseOffice(file);
    throw new Error(file.name + " は対応していません。対応形式: PDF、画像、DOCX、XLSX、XLS、PPTX、CSV、TXT、ZIP。");
  }

  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像を読み込めませんでした。")); };
      image.src = url;
    });
  }

  async function imageToPng(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return canvasToPng(canvas);
  }

  function canvasToPng(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG変換に失敗しました。")), "image/png");
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function sanitizeFileName(filename) {
    return String(filename || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  window.TEST_SCORE_FILES = { parseFile, parseImage, parsePdf, parseZip, parseOffice, isImage, isPdf, isZip, isOffice, isSupported, getExtension, sanitizeFileName };
})();
