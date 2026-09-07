import {
  MAX_GEO_QUESTIONS,
  MAX_GEO_QUESTION_LENGTH
} from "./geo-types";
import type { ImportedGeoQuestion } from "./geo-types";

export interface GeoQuestionImportResult {
  questions: ImportedGeoQuestion[];
  duplicateCount: number;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) {
    throw new Error("The CSV contains an unterminated quoted field.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeQuestions(
  questions: ImportedGeoQuestion[]
): GeoQuestionImportResult {
  const unique = new Map<string, ImportedGeoQuestion>();
  let duplicateCount = 0;
  for (const question of questions) {
    const text = question.text.trim();
    const category = question.category?.trim();
    if (!text) {
      continue;
    }
    if (text.length > MAX_GEO_QUESTION_LENGTH) {
      throw new Error(
        `A GEO question exceeds the ${MAX_GEO_QUESTION_LENGTH.toLocaleString()} character limit.`
      );
    }
    const key = text.normalize("NFKC").toLocaleLowerCase();
    if (unique.has(key)) {
      duplicateCount += 1;
      continue;
    }
    unique.set(key, {
      text,
      ...(category ? { category: category.slice(0, 120) } : {})
    });
  }
  const normalized = [...unique.values()];
  if (normalized.length === 0) {
    throw new Error("No valid GEO questions were found.");
  }
  if (normalized.length > MAX_GEO_QUESTIONS) {
    throw new Error(
      `A GEO study supports up to ${MAX_GEO_QUESTIONS} unique questions.`
    );
  }
  return { questions: normalized, duplicateCount };
}

export function parseGeoQuestionFile(
  content: string,
  fileName: string
): GeoQuestionImportResult {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  if (fileName.toLocaleLowerCase().endsWith(".csv")) {
    const rows = parseCsvRows(normalizedContent).filter((row) =>
      row.some((value) => value.trim())
    );
    if (rows.length === 0) {
      throw new Error("The CSV file is empty.");
    }
    const firstRow = rows[0]?.map((value) => value.trim().toLocaleLowerCase()) ?? [];
    const questionIndex = firstRow.findIndex((value) =>
      ["question", "prompt", "query", "domanda"].includes(value)
    );
    const categoryIndex = firstRow.findIndex((value) =>
      ["category", "topic", "categoria"].includes(value)
    );
    const hasHeader = questionIndex >= 0;
    const effectiveQuestionIndex = hasHeader ? questionIndex : 0;
    return normalizeQuestions(
      rows.slice(hasHeader ? 1 : 0).map((row) => ({
        text: row[effectiveQuestionIndex] ?? "",
        ...(categoryIndex >= 0 && row[categoryIndex]
          ? { category: row[categoryIndex] }
          : {})
      }))
    );
  }
  if (!fileName.toLocaleLowerCase().endsWith(".txt")) {
    throw new Error("Upload a .csv or .txt question file.");
  }
  return normalizeQuestions(
    normalizedContent.split(/\r?\n/).map((text) => ({ text }))
  );
}
