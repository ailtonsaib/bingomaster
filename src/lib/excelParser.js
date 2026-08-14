import JSZip from "jszip";

// Lê um arquivo .xlsx no navegador (via JSZip) e retorna um array de objetos
// onde cada chave é o cabeçalho da coluna (normalizado) e o valor é a string da célula.
// Normaliza cabeçalhos: minúsculas, sem acentos, espaços -> underscore.
export async function parseXlsxRows(file) {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);

  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile ? await parseSharedStrings(await sharedStringsFile.async("string")) : [];

  // Localiza a primeira planilha (zip.file com regex retorna array)
  const sheetMatches = zip.file(/xl\/worksheets\/sheet.*\.xml/) || [];
  const sheetFile = sheetMatches[0] || zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) throw new Error("Planilha não encontrada no arquivo .xlsx");
  const sheetXml = await sheetFile.async("string");

  const rows = parseSheet(sheetXml, sharedStrings);
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim() !== ""));
  return dataRows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = String(r[i] ?? "").trim();
    });
    return obj;
  });
}

function parseSharedStrings(xml) {
  const strings = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    // extrai textos dentro de <t>...</t>
    const texts = m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    const val = texts.map(t => t.replace(/<t[^>]*>/, "").replace(/<\/t>/, "")).join("");
    strings.push(decodeXml(val));
  }
  return strings;
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const cells = [];
    const cellRe = /<c\b[^>]*r="([A-Z]+\d+)"[^>]*?(?:\s+t="([^"]*)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is>[\s\S]*?<\/is>)?<\/c>/g;
    let cellMatch;
    let maxCol = 0;
    const cellMap = {};
    while ((cellMatch = cellRe.exec(rowXml)) !== null) {
      const ref = cellMatch[1];
      const type = cellMatch[2] || "";
      const val = cellMatch[3] || "";
      const colIdx = colNumber(ref);
      let value = val;
      if (type === "s") {
        value = sharedStrings[parseInt(val, 10)] ?? "";
      } else if (type === "inlineStr" || cellMap_inline(rowXml, ref)) {
        value = extractInline(rowXml, ref);
      }
      cellMap[colIdx] = String(value ?? "");
      if (colIdx > maxCol) maxCol = colIdx;
    }
    const row = [];
    for (let i = 0; i <= maxCol; i++) row.push(cellMap[i] ?? "");
    rows.push(row);
  }
  return rows;
}

function cellMap_inline() { return false; }
function extractInline() { return ""; }

function colNumber(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function decodeXml(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}