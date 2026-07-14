import ExcelJS from "exceljs";

export interface ParsedRoster {
  names: string[];
}

export interface ParseRosterError {
  error: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 500;

function isNameHeader(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "name" || v === "الاسم" || v === "student name" || v === "student";
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseCsvText(text: string): string[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const rows = lines.map(splitCsvLine);
  const header = rows[0];
  let nameCol = header.findIndex(isNameHeader);
  if (nameCol === -1) nameCol = 0;

  return rows
    .slice(1)
    .map((r) => (r[nameCol] || "").trim())
    .filter((n) => n !== "");
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const names: string[] = [];
  let nameCol = 1;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      let found = -1;
      row.eachCell((cell, colNumber) => {
        if (isNameHeader((cell.text ?? "").toString())) found = colNumber;
      });
      nameCol = found !== -1 ? found : 1;
      return;
    }
    const val = (row.getCell(nameCol).text ?? "").toString().trim();
    if (val !== "") names.push(val);
  });

  return names;
}

export async function parseRosterFile(
  file: File
): Promise<ParsedRoster | ParseRosterError> {
  if (file.size === 0) {
    return { error: "That file is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is too large (max 5MB)." };
  }

  const lowerName = file.name.toLowerCase();
  let names: string[] = [];

  try {
    if (lowerName.endsWith(".csv")) {
      names = parseCsvText(await file.text());
    } else if (lowerName.endsWith(".xlsx")) {
      names = await parseXlsxBuffer(await file.arrayBuffer());
    } else {
      return { error: "Unsupported file type — upload a .xlsx or .csv file." };
    }
  } catch {
    return {
      error: "Could not read that file — make sure it's a valid .xlsx or .csv file.",
    };
  }

  if (names.length === 0) {
    return {
      error:
        "We couldn't find any names in that file. Make sure the first column has student names, with a header row on top.",
    };
  }

  if (names.length > MAX_ROWS) {
    return { error: `That file has too many rows (max ${MAX_ROWS} students per upload).` };
  }

  return { names };
}
