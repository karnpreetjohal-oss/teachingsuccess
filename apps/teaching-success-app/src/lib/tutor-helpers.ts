export const MARKING_MODES = [
  "maths_question_marking",
  "english_writing_feedback",
  "gcse_english_ao",
  "science_short_answer",
  "generic_completion_review"
] as const;

export type MarkingMode = (typeof MARKING_MODES)[number];

export function parseYearGroupInt(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).match(/\d{1,2}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSubject(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "math" || raw === "maths") return "maths";
  if (raw === "english") return "english";
  if (raw === "science") return "science";
  if (raw === "11+" || raw === "11 plus" || raw === "eleven plus") return "11+";
  if (raw === "general") return "general";
  return raw;
}

export function parseKeywordCsv(value: string) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getDefaultMarkingMode(subjectRaw: string, yearGroup?: string | number | null): MarkingMode {
  const subject = normalizeSubject(subjectRaw);
  const year = parseYearGroupInt(yearGroup);
  if (subject === "maths") return "maths_question_marking";
  if (subject === "science") return "science_short_answer";
  if (subject === "english") {
    if (year !== null && year >= 10) return "gcse_english_ao";
    return "english_writing_feedback";
  }
  return "generic_completion_review";
}

export function markingModeLabel(mode: string | null | undefined) {
  const value = String(mode || "").trim();
  if (value === "maths_question_marking") return "Maths question marking";
  if (value === "english_writing_feedback") return "English writing feedback";
  if (value === "gcse_english_ao") return "GCSE English AO feedback";
  if (value === "science_short_answer") return "Science short-answer review";
  return "Generic completion review";
}
