import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OCR_PROVIDER = (Deno.env.get("OCR_PROVIDER") || "none").toLowerCase();
const OCR_API_KEY = Deno.env.get("OCR_API_KEY") || "";
const GOOGLE_VISION_KEY = Deno.env.get("GOOGLE_VISION_KEY") || OCR_API_KEY;
const AZURE_CV_ENDPOINT = Deno.env.get("AZURE_CV_ENDPOINT") || "";
const AZURE_CV_KEY = Deno.env.get("AZURE_CV_KEY") || OCR_API_KEY;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const SUBMISSION_BUCKET = "submission-files";
const ASSIGNMENT_SELECT_FIELDS =
  "id,subject,title,description,exam_board,marking_context,automark_enabled,automark_keywords,automark_target_words,marking_mode";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function countWords(text: string): number {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function gradeFromPercent(percent: number): string {
  if (percent >= 90) return "A*";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "E";
}

function titleCase(value: string): string {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseYearGroupInt(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value).match(/\d{1,2}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDetectedSubject(value: string | null | undefined) {
  const subject = String(value || "").trim().toLowerCase();
  if (!subject) return "general";
  if (subject === "math" || subject === "maths" || subject === "mathematics") return "maths";
  if (subject === "english") return "english";
  if (subject === "science" || subject === "biology" || subject === "chemistry" || subject === "physics") return "science";
  if (subject === "11+" || subject === "11 plus" || subject === "eleven plus") return "11+";
  if (subject === "general") return "general";
  return subject;
}

function getDefaultMarkingMode(subjectRaw: string, yearGroup?: string | number | null) {
  const subject = normalizeDetectedSubject(subjectRaw);
  const year = parseYearGroupInt(yearGroup);
  if (subject === "maths") return "maths_question_marking";
  if (subject === "science") return "science_short_answer";
  if (subject === "english") {
    if (year !== null && year >= 10) return "gcse_english_ao";
    return "english_writing_feedback";
  }
  return "generic_completion_review";
}

function inferSubjectFromText(text: string) {
  const normalized = String(text || "").toLowerCase();

  const scores = {
    maths: 0,
    english: 0,
    science: 0,
    general: 0,
  };

  const mathsPatterns = [
    /\bwork out\b/g, /\bsolve\b/g, /\bequation\b/g, /\balgebra\b/g, /\bfraction\b/g, /\bdecimal\b/g, /\bpercentage\b/g,
    /\bprobability\b/g, /\bmean\b/g, /\bmedian\b/g, /\bangle\b/g, /\bgraph\b/g, /\bcalculate\b/g,
    /\bsimplify\b/g, /\bfactor\b/g, /\bx\b/g
  ];
  const englishPatterns = [
    /\bquote\b/g, /\banalyse\b/g, /\banalysis\b/g, /\bwriter\b/g, /\blanguage\b/g, /\bcharacter\b/g,
    /\btheme\b/g, /\bpoem\b/g, /\bpoetry\b/g, /\bmacbeth\b/g, /\ban inspector calls\b/g, /\bessay\b/g,
    /\bparagraph\b/g, /\bhow does\b/g
  ];
  const sciencePatterns = [
    /\bcell\b/g, /\batom\b/g, /\bforce\b/g, /\benergy\b/g, /\breaction\b/g, /\bphotosynthesis\b/g,
    /\brespiration\b/g, /\bparticle\b/g, /\bmagnet\b/g, /\bvoltage\b/g, /\belectric\b/g, /\bbiology\b/g,
    /\bchemistry\b/g, /\bphysics\b/g, /\bpractical\b/g
  ];

  for (const pattern of mathsPatterns) {
    scores.maths += (normalized.match(pattern) || []).length * 2;
  }
  for (const pattern of englishPatterns) {
    scores.english += (normalized.match(pattern) || []).length * 2;
  }
  for (const pattern of sciencePatterns) {
    scores.science += (normalized.match(pattern) || []).length * 2;
  }

  if (/[=+\-/*×÷]/.test(normalized)) {
    scores.maths += 4;
  }
  if (/["“”']/.test(text)) {
    scores.english += 3;
  }
  if (/\bcm\b|\bmm\b|\bkg\b|\bnewton\b|\bvolts?\b|\bph\b/i.test(text)) {
    scores.science += 3;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topSubject, topScore] = sorted[0];
  return topScore >= 4 ? normalizeDetectedSubject(topSubject) : "general";
}

type QuestionBreakdownItem = {
  question: string;
  expected_answer: string;
  student_answer: string;
  correct: boolean;
  help?: string;
};

function normalizeArithmeticOperator(value: string) {
  if (value === "×" || value === "x" || value === "X" || value === "*") return "*";
  if (value === "÷" || value === "/") return "/";
  return value;
}

function solveSimpleArithmetic(prompt: string): string | null {
  const match = prompt.match(/(\d+(?:\.\d+)?)\s*([+\-xX×*÷/])\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const operator = normalizeArithmeticOperator(match[2]);
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  if (operator === "+") return String(left + right);
  if (operator === "-") return String(left - right);
  if (operator === "*") return String(left * right);
  if (operator === "/") {
    if (right === 0) return null;
    const result = left / right;
    return Number.isInteger(result) ? String(result) : String(Number(result.toFixed(4)));
  }

  return null;
}

function extractMathsQuestionBreakdownFromText(text: string): QuestionBreakdownItem[] {
  const normalized = String(text || "").replace(/\r/g, "");
  if (!normalized.trim()) {
    return [];
  }

  const questionMatches = [...normalized.matchAll(/(?:^|\n)\s*(\d{1,2})\s+(Work out[^\n]+)/gi)];
  if (!questionMatches.length) {
    return [];
  }

  return questionMatches.slice(0, 12).map((match, index) => {
    const questionNumber = Number(match[1]);
    const prompt = match[2].replace(/\s+/g, " ").trim();
    const start = match.index ?? 0;
    const end = questionMatches[index + 1]?.index ?? normalized.length;
    const block = normalized.slice(start, end);
    const expectedAnswer = solveSimpleArithmetic(prompt);
    const strippedBlock = block
      .replace(prompt, " ")
      .replace(/\(Total for Question[\s\S]*$/i, " ")
      .replace(/Total for Question[\s\S]*$/i, " ")
      .replace(/\b\d+\b/g, (value) => (value === String(questionNumber) ? " " : value));
    const answerCandidates = [...strippedBlock.matchAll(/-?\d+(?:\.\d+)?/g)].map((candidate) => candidate[0]);
    const studentAnswer = answerCandidates[answerCandidates.length - 1] || "(no answer detected)";
    const correct =
      Boolean(expectedAnswer) &&
      studentAnswer !== "(no answer detected)" &&
      normalizeAnswer(expectedAnswer || "") === normalizeAnswer(studentAnswer);

    return {
      question: `Q${questionNumber}: ${prompt}`,
      expected_answer: expectedAnswer || "(could not infer)",
      student_answer: studentAnswer,
      correct,
      help: correct ? undefined : expectedAnswer ? buildMathsHelp(expectedAnswer) : "Check the final answer and the working shown."
    };
  });
}

function deriveDraftTitle(text: string, subject: string) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) =>
      line.length >= 8 &&
      line.length <= 72 &&
      !/^name\b/i.test(line) &&
      !/^date\b/i.test(line) &&
      !/^page\s+\d+/i.test(line) &&
      !/^q\d+\b/i.test(line) &&
      !/^\d+\s*$/.test(line)
    );

  const candidate = lines.find((line) => {
    const letters = (line.match(/[a-z]/gi) || []).length;
    const digits = (line.match(/\d/g) || []).length;
    return letters >= 6 && digits < letters;
  });

  if (candidate) {
    return `Quick Upload: ${candidate.replace(/\s+/g, " ").slice(0, 60)}`;
  }

  if (subject === "maths") return "Quick Upload: Maths practice";
  if (subject === "english") return "Quick Upload: English response";
  if (subject === "science") return "Quick Upload: Science work";
  return "Quick Upload: Student work";
}

function inferQuickUploadMetadata({
  combinedText,
  existingSubject,
  existingTitle,
  existingDescription,
  yearGroup,
}: {
  combinedText: string;
  existingSubject: string | null | undefined;
  existingTitle: string | null | undefined;
  existingDescription: string | null | undefined;
  yearGroup: string | number | null | undefined;
}) {
  const normalizedExistingSubject = normalizeDetectedSubject(existingSubject);
  const hasStudentSuppliedSubject = /student supplied subject:/i.test(String(existingDescription || ""));
  const hasStudentSuppliedTitle = /student supplied title:/i.test(String(existingDescription || ""));
  const subject = normalizedExistingSubject !== "general" && normalizedExistingSubject
    ? normalizedExistingSubject
    : inferSubjectFromText([combinedText, existingDescription || ""].filter(Boolean).join("\n"));

  const markingMode = getDefaultMarkingMode(subject, yearGroup);
  const title = hasStudentSuppliedTitle && String(existingTitle || "").trim()
    ? String(existingTitle || "").trim()
    : /^quick upload:/i.test(String(existingTitle || ""))
      ? deriveDraftTitle(combinedText, subject)
      : String(existingTitle || "").trim() || deriveDraftTitle(combinedText, subject);

  const targetWords =
    subject === "english" ? (parseYearGroupInt(yearGroup) !== null && Number(parseYearGroupInt(yearGroup)) >= 10 ? 180 : 120) : null;

  const keywords: string[] = [];

  return {
    subject: subject === "general" ? "General" : titleCase(subject),
    title,
    markingMode,
    keywords,
    targetWords,
    subjectInferred: !hasStudentSuppliedSubject && normalizeDetectedSubject(subject) !== "general",
    titleInferred: !hasStudentSuppliedTitle,
    hasStudentSuppliedSubject,
    hasStudentSuppliedTitle,
  };
}

function calculateAutoMark(notes: string, keywords: string[], targetWords: number | null) {
  const normalized = String(notes || "").toLowerCase();
  const words = countWords(notes);
  const kw = Array.isArray(keywords) ? keywords.filter(Boolean).map((k) => String(k).toLowerCase()) : [];
  const hits = kw.filter((k) => normalized.includes(k));
  const keywordRatio = kw.length ? (hits.length / kw.length) : 1;
  const keywordScore = keywordRatio * 70;
  const wcTarget = Number(targetWords || 0);
  const wcRatio = wcTarget > 0 ? Math.min(words / wcTarget, 1) : 1;
  const lengthScore = wcRatio * 30;
  const score = Math.max(0, Math.min(100, Math.round(keywordScore + lengthScore)));

  const feedbackParts: string[] = [];
  if (kw.length) feedbackParts.push(`Keywords matched: ${hits.length}/${kw.length}`);
  if (wcTarget > 0) feedbackParts.push(`Word count: ${words}/${wcTarget}`);
  if (!feedbackParts.length) feedbackParts.push(`Word count: ${words}`);

  return {
    score,
    grade: gradeFromPercent(score),
    feedback: `Auto-mark: ${feedbackParts.join(" · ")}`,
  };
}

function calculateDraftStructureScore(text: string, emphasis: "generic" | "science") {
  const normalized = String(text || "");
  const words = countWords(normalized);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const questionLike = lines.filter((line) => /^q?\d+[\).:\- ]/i.test(line)).length;
  const scienceTerms = [
    "cell", "energy", "reaction", "force", "atom", "particle", "circuit", "voltage", "organism", "practical",
    "hypothesis", "method", "result", "conclusion"
  ];
  const genericAcademic = [
    "because", "therefore", "however", "explain", "method", "working", "example", "answer", "evidence"
  ];
  const vocabularyHits = (emphasis === "science" ? scienceTerms : genericAcademic).filter((term) =>
    normalized.toLowerCase().includes(term)
  ).length;

  const wordScore = Math.min(words / (emphasis === "science" ? 90 : 140), 1) * 38;
  const lineScore = Math.min(lines.length / 10, 1) * 18;
  const vocabScore = Math.min(vocabularyHits / 5, 1) * 18;
  const questionScore = Math.min(questionLike / 6, 1) * 16;
  const completenessScore = /[A-Za-z]/.test(normalized) ? 10 : 0;
  const score = Math.max(24, Math.min(86, Math.round(wordScore + lineScore + vocabScore + questionScore + completenessScore)));

  return {
    score,
    words,
    lines: lines.length,
    questionLike,
    vocabularyHits,
  };
}

function getObjectValue(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  return (source as Record<string, unknown>)[key];
}

function extractOpenAiJson(responseJson: unknown): Record<string, unknown> | null {
  const directText = getObjectValue(responseJson, "output_text");
  if (typeof directText === "string" && directText.trim()) {
    try {
      return JSON.parse(directText);
    } catch {
      // fall through to nested extraction
    }
  }

  const output = getObjectValue(responseJson, "output");
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    const content = getObjectValue(item, "content");
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      const textValue = getObjectValue(block, "text");
      if (typeof textValue === "string" && textValue.trim()) {
        try {
          return JSON.parse(textValue);
        } catch {
          continue;
        }
      }
      const jsonValue = getObjectValue(block, "json");
      if (jsonValue && typeof jsonValue === "object") {
        return jsonValue as Record<string, unknown>;
      }
    }
  }

  return null;
}

function parseStringArray(value: unknown, limit = 4): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, limit)
    .map((item) => item.trim());
}

function parseQuestionBreakdown(value: unknown): QuestionBreakdownItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const question = String(record.question || "").trim();
      const expectedAnswer = String(record.expected_answer || "").trim() || "(could not infer)";
      const studentAnswer = String(record.student_answer || "").trim() || "(no answer detected)";
      const correctRaw = record.correct;
      const help = String(record.help || "").trim() || undefined;

      if (!question) {
        return null;
      }

      return {
        question,
        expected_answer: expectedAnswer,
        student_answer: studentAnswer,
        correct: correctRaw === true,
        help,
      };
    })
    .filter((item): item is QuestionBreakdownItem => Boolean(item))
    .slice(0, 12);
}

type QuickUploadMarkingContext = {
  topic: string | null;
  taskDescription: string | null;
  maxMarks: number | null;
  markScheme: string | null;
  levelDescriptors: string | null;
  additionalContext: string | null;
  examBoard: string | null;
};

type UniversalOpenAiAssessment = {
  inferred_subject: string;
  inferred_title: string;
  inferred_task: string | null;
  exam_board: string | null;
  transcription: string;
  score: number | null;
  max_marks: number | null;
  percentage: number | null;
  grade_equivalent: string | null;
  level: string | null;
  strengths: string[];
  improvements: string[];
  detailed_feedback: string;
  mark_commentary: string;
  next_steps: string[];
  exemplar_addition: string | null;
  confidence: number;
};

function parseNullableNumber(value: unknown, { min, max }: { min?: number; max?: number } = {}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (min !== undefined && parsed < min) {
    return null;
  }
  if (max !== undefined && parsed > max) {
    return null;
  }

  return Number(parsed);
}

function parseQuickUploadMarkingContext(value: unknown): QuickUploadMarkingContext {
  if (!value || typeof value !== "object") {
    return {
      topic: null,
      taskDescription: null,
      maxMarks: null,
      markScheme: null,
      levelDescriptors: null,
      additionalContext: null,
      examBoard: null,
    };
  }

  const record = value as Record<string, unknown>;
  return {
    topic: String(record.topic || "").trim() || null,
    taskDescription: String(record.task_description || "").trim() || null,
    maxMarks: parseNullableNumber(record.max_marks, { min: 0, max: 1000 }),
    markScheme: String(record.mark_scheme || "").trim() || null,
    levelDescriptors: String(record.level_descriptors || "").trim() || null,
    additionalContext: String(record.additional_context || "").trim() || null,
    examBoard: String(record.exam_board || "").trim() || null,
  };
}

function validateUniversalOpenAiAssessment(payload: Record<string, unknown>): UniversalOpenAiAssessment | null {
  const inferredSubject = String(payload.inferred_subject || "").trim() || "General";
  const inferredTitle = String(payload.inferred_title || "").trim() || "Quick Upload: Student work";
  const transcription = String(payload.transcription || "").trim();
  const detailedFeedback = String(payload.detailed_feedback || "").trim();
  const markCommentary = String(payload.mark_commentary || "").trim();
  const inferredTask = String(payload.inferred_task || "").trim() || null;
  const examBoard = String(payload.exam_board || "").trim() || null;
  const rawScore = parseNullableNumber(payload.score, { min: 0, max: 1000 });
  const rawMaxMarks = parseNullableNumber(payload.max_marks, { min: 0, max: 1000 });
  let percentage = parseNullableNumber(payload.percentage, { min: 0, max: 100 });

  if (percentage === null && rawScore !== null && rawMaxMarks !== null && rawMaxMarks > 0) {
    percentage = Number(((rawScore / rawMaxMarks) * 100).toFixed(2));
  }

  if (!transcription || !detailedFeedback || !markCommentary) {
    return null;
  }

  return {
    inferred_subject: inferredSubject,
    inferred_title: inferredTitle,
    inferred_task: inferredTask,
    exam_board: examBoard,
    transcription,
    score: rawScore,
    max_marks: rawMaxMarks,
    percentage,
    grade_equivalent: String(payload.grade_equivalent || "").trim() || null,
    level: String(payload.level || "").trim() || null,
    strengths: parseStringArray(payload.strengths),
    improvements: parseStringArray(payload.improvements),
    detailed_feedback: detailedFeedback,
    mark_commentary: markCommentary,
    next_steps: parseStringArray(payload.next_steps),
    exemplar_addition: String(payload.exemplar_addition || "").trim() || null,
    confidence: parseNullableNumber(payload.confidence, { min: 0, max: 100 }) ?? 64,
  };
}

async function requestOpenAiUniversalAssessment({
  combinedText,
  assignmentTitle,
  assignmentSubject,
  yearGroup,
  quickUploadContext,
  studentNotes,
  imagePayloads,
}: {
  combinedText: string;
  assignmentTitle: string;
  assignmentSubject: string;
  yearGroup: string | number | null | undefined;
  quickUploadContext: QuickUploadMarkingContext;
  studentNotes: string;
  imagePayloads: Array<{ mimeType: string; base64: string }>;
}): Promise<UniversalOpenAiAssessment | null> {
  if (!OPENAI_API_KEY || (!combinedText.trim() && !imagePayloads.length)) {
    return null;
  }

  const providedContextLines = [
    `Student year group: ${yearGroup || "unknown"}`,
    `Current subject label: ${assignmentSubject || "General"}`,
    `Current task title: ${assignmentTitle || "Quick Upload: Student work"}`,
    `Provided topic: ${quickUploadContext.topic || "none"}`,
    `Provided exam board / framework: ${quickUploadContext.examBoard || "none"}`,
    `Provided task / question: ${quickUploadContext.taskDescription || "none"}`,
    `Provided maximum marks: ${quickUploadContext.maxMarks ?? "unknown"}`,
    quickUploadContext.markScheme ? `Provided mark scheme:\n${quickUploadContext.markScheme}` : "Provided mark scheme: none",
    quickUploadContext.levelDescriptors
      ? `Provided level descriptors:\n${quickUploadContext.levelDescriptors}`
      : "Provided level descriptors: none",
    quickUploadContext.additionalContext
      ? `Additional teacher context:\n${quickUploadContext.additionalContext}`
      : "Additional teacher context: none",
    studentNotes.trim() ? `Student note:\n${studentNotes.trim()}` : "Student note: none",
    combinedText.trim()
      ? `OCR text and notes:\n${combinedText}`
      : "OCR text was empty or unreliable, so infer directly from the uploaded image.",
  ];

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: providedContextLines.join("\n\n"),
    },
  ];

  imagePayloads.slice(0, 6).forEach((payload) => {
    userContent.push({
      type: "input_image",
      image_url: `data:${payload.mimeType};base64,${payload.base64}`,
    });
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are an expert teacher and examiner acting as a universal marker for uploaded student work.",
                "The upload may be from any mainstream school subject and may or may not include the full question, mark scheme, or total marks.",
                "Use supplied context when present. When context is missing, infer conservatively from the visible work and OCR text.",
                "First read and transcribe the student's work from the images and OCR text.",
                "Then mark it using the supplied mark scheme if available, otherwise use appropriate curriculum or exam expectations for the inferred subject and year group.",
                "Keep marks evidence-led and conservative. Do not invent unseen content.",
                "If the raw score or total marks cannot be justified, return null for score and/or max_marks, but still provide a percentage estimate if a sensible overall judgement is possible.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "universal_work_marker",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              inferred_subject: { type: "string" },
              inferred_title: { type: "string" },
              inferred_task: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              exam_board: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              transcription: { type: "string" },
              score: {
                anyOf: [{ type: "number", minimum: 0, maximum: 1000 }, { type: "null" }],
              },
              max_marks: {
                anyOf: [{ type: "number", minimum: 0, maximum: 1000 }, { type: "null" }],
              },
              percentage: {
                anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }],
              },
              grade_equivalent: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              level: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              strengths: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              improvements: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              detailed_feedback: { type: "string" },
              mark_commentary: { type: "string" },
              next_steps: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              exemplar_addition: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              confidence: { type: "number", minimum: 0, maximum: 100 },
            },
            required: [
              "inferred_subject",
              "inferred_title",
              "inferred_task",
              "exam_board",
              "transcription",
              "score",
              "max_marks",
              "percentage",
              "grade_equivalent",
              "level",
              "strengths",
              "improvements",
              "detailed_feedback",
              "mark_commentary",
              "next_steps",
              "exemplar_addition",
              "confidence",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI universal marking request failed with ${response.status}`);
  }

  const responseJson = await response.json();
  const parsed = extractOpenAiJson(responseJson);
  if (!parsed) {
    return null;
  }

  return validateUniversalOpenAiAssessment(parsed);
}

function validateOpenAiDraft(payload: Record<string, unknown>): OpenAiDraft | null {
  const inferredSubject = String(payload.inferred_subject || "").trim();
  const inferredTitle = String(payload.inferred_title || "").trim();
  const markingMode = String(payload.suggested_marking_mode || "").trim();
  const summary = String(payload.summary || "").trim();
  const confidenceRaw = Number(payload.confidence);

  const validSubjects = new Set(["Maths", "English", "Science", "General"]);
  const validModes = new Set([
    "maths_question_marking",
    "english_writing_feedback",
    "gcse_english_ao",
    "science_short_answer",
    "generic_completion_review",
  ]);

  if (!validSubjects.has(inferredSubject) || !validModes.has(markingMode) || !summary) {
    return null;
  }

  const scoreRaw = payload.draft_score;
  const numericScore =
    scoreRaw === null || scoreRaw === undefined || scoreRaw === ""
      ? null
      : Number(scoreRaw);
  const draftScore =
    numericScore === null || (Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 100)
      ? numericScore
      : null;

  return {
    inferred_subject: inferredSubject as OpenAiDraft["inferred_subject"],
    inferred_title: inferredTitle || "Quick Upload: Student work",
    suggested_marking_mode: markingMode as OpenAiDraft["suggested_marking_mode"],
    extracted_text: String(payload.extracted_text || "").trim() || null,
    draft_score: draftScore,
    draft_grade: String(payload.draft_grade || "").trim() || null,
    confidence: Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 60,
    summary,
    strengths: parseStringArray(payload.strengths),
    issues: parseStringArray(payload.issues),
    next_steps: parseStringArray(payload.next_steps),
    question_breakdown: parseQuestionBreakdown(payload.question_breakdown),
  };
}

async function requestOpenAiDraftAssessment({
  combinedText,
  assignmentContext,
  yearGroup,
  subject,
  markingMode,
  heuristicSummary,
  imagePayloads,
}: {
  combinedText: string;
  assignmentContext: string;
  yearGroup: string | number | null | undefined;
  subject: string;
  markingMode: string;
  heuristicSummary: string;
  imagePayloads: Array<{ mimeType: string; base64: string }>;
}): Promise<OpenAiDraft | null> {
  if (!OPENAI_API_KEY || (!combinedText.trim() && !imagePayloads.length)) {
    return null;
  }

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: [
        `Student year group: ${yearGroup || "unknown"}`,
        `Current subject: ${subject || "General"}`,
        `Current marking mode: ${markingMode || "generic_completion_review"}`,
        `Assignment context: ${assignmentContext || "None provided"}`,
        `Heuristic draft summary: ${heuristicSummary || "None"}`,
        combinedText.trim() ? `OCR text:\n${combinedText}` : "OCR text was empty or unreliable, so infer directly from the uploaded image.",
      ].join("\n\n"),
    },
  ];

  imagePayloads.slice(0, 4).forEach((payload) => {
    userContent.push({
      type: "input_image",
      image_url: `data:${payload.mimeType};base64,${payload.base64}`,
    });
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are marking OCR-extracted tutoring work. Infer subject/title conservatively, do not overclaim, and give a draft mark only from visible evidence in the OCR text.",
            },
          ],
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ocr_draft_assessment",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              inferred_subject: {
                type: "string",
                enum: ["Maths", "English", "Science", "General"],
              },
              inferred_title: { type: "string" },
              suggested_marking_mode: {
                type: "string",
                enum: [
                  "maths_question_marking",
                  "english_writing_feedback",
                  "gcse_english_ao",
                  "science_short_answer",
                  "generic_completion_review",
                ],
              },
              extracted_text: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              draft_score: {
                anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }],
              },
              draft_grade: {
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              confidence: { type: "number", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              strengths: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              issues: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              next_steps: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              question_breakdown: {
                type: "array",
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    question: { type: "string" },
                    expected_answer: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    student_answer: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                    correct: {
                      anyOf: [{ type: "boolean" }, { type: "null" }],
                    },
                    help: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                  },
                  required: ["question", "expected_answer", "student_answer", "correct", "help"],
                },
              },
            },
            required: [
              "inferred_subject",
              "inferred_title",
              "suggested_marking_mode",
              "extracted_text",
              "draft_score",
              "draft_grade",
              "confidence",
              "summary",
              "strengths",
              "issues",
              "next_steps",
              "question_breakdown",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI draft request failed with ${response.status}`);
  }

  const responseJson = await response.json();
  const parsed = extractOpenAiJson(responseJson);
  if (!parsed) {
    return null;
  }

  return validateOpenAiDraft(parsed);
}

type AutoAssessment = {
  mode: string;
  confidence: number;
  score: number | null;
  grade: string | null;
  feedback: string;
  details: string[];
  question_breakdown?: Array<{
    question: string;
    expected_answer: string;
    student_answer: string;
    correct: boolean;
    help?: string;
  }>;
  mode_specific?: Record<string, unknown>;
};

type OpenAiDraft = {
  inferred_subject: "Maths" | "English" | "Science" | "General";
  inferred_title: string;
  suggested_marking_mode:
    | "maths_question_marking"
    | "english_writing_feedback"
    | "gcse_english_ao"
    | "science_short_answer"
    | "generic_completion_review";
  extracted_text: string | null;
  draft_score: number | null;
  draft_grade: string | null;
  confidence: number;
  summary: string;
  strengths: string[];
  issues: string[];
  next_steps: string[];
  question_breakdown: QuestionBreakdownItem[];
};

function normalizeAnswer(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s,.;:!?()[\]{}]/g, "")
    .trim();
}

function extractNumberedMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^q?\s*(\d{1,3})\s*[\).:=\-]\s*(.+)$/i);
    if (!m) continue;
    const qNo = Number(m[1]);
    const ans = String(m[2] || "").trim();
    if (!Number.isFinite(qNo) || !ans) continue;
    map.set(qNo, ans);
  }
  return map;
}

function buildMathsHelp(expected: string): string {
  const e = expected.toLowerCase();
  if (/[x+\-*/=]/.test(e) || /solve|equation|factor|expand|simplify/.test(e)) {
    return "Show each algebra step clearly before your final answer.";
  }
  if (/fraction|\/|over/.test(e)) {
    return "Check equivalent fractions and simplify to the final form.";
  }
  if (/%|percent/.test(e)) {
    return "Convert between fraction, decimal and percentage to verify your answer.";
  }
  if (/cm|mm|m|km|area|volume|perimeter/.test(e)) {
    return "Include correct units and check if the method matches the measurement asked.";
  }
  return "Rework this question step-by-step and check arithmetic accuracy.";
}

function buildAutoAssessment(
  modeRaw: string,
  combinedText: string,
  keywords: string[],
  targetWords: number | null,
  ocrFileCount: number,
  assignmentText: string,
): AutoAssessment {
  const mode = String(modeRaw || "generic_completion_review");
  const text = String(combinedText || "");
  const assignmentContext = String(assignmentText || "");
  const words = countWords(text);
  const lines = text.split("\n").map((x) => x.trim()).filter(Boolean);

  if (!text.trim()) {
    return {
      mode,
      confidence: 0,
      score: null,
      grade: null,
      feedback: "We could not read enough text from this upload to mark it automatically.",
      details: [
        "No readable OCR text was extracted from the uploaded image.",
        "Retake the photo with the whole question visible, strong contrast, and no shadow across the page.",
        `OCR files analysed: ${ocrFileCount}`,
      ],
      mode_specific: {
        marking_basis: "no_text_detected",
        next_steps: [
          "Retake the photo in brighter light.",
          "Crop closer to the worksheet.",
          "Keep the page flat and the camera directly above it.",
        ],
      },
    };
  }

  if (mode === "maths_question_marking") {
    const answerKey = extractNumberedMap(assignmentContext);
    const studentAnswers = extractNumberedMap(text);
    if (answerKey.size > 0 && studentAnswers.size > 0) {
      const questionNos = [...answerKey.keys()].sort((a, b) => a - b);
      let correctCount = 0;
      const breakdown = questionNos.map((qNo) => {
        const expected = answerKey.get(qNo) || "";
        const student = studentAnswers.get(qNo) || "";
        const correct = !!student && normalizeAnswer(expected) === normalizeAnswer(student);
        if (correct) correctCount += 1;
        return {
          question: `Q${qNo}`,
          expected_answer: expected,
          student_answer: student || "(no answer detected)",
          correct,
          help: correct ? undefined : buildMathsHelp(expected),
        };
      });

      const total = questionNos.length;
      const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      const incorrect = total - correctCount;
      return {
        mode,
        confidence: 86,
        score: pct,
        grade: gradeFromPercent(pct),
        feedback: `${correctCount}/${total} correct. ${incorrect} question${incorrect === 1 ? "" : "s"} need${incorrect === 1 ? "s" : ""} review.`,
        details: [
          `Marked from detected answer key and scanned responses.`,
          `Correct answers: ${correctCount}/${total}`,
          `OCR files analysed: ${ocrFileCount}`,
        ],
        question_breakdown: breakdown.slice(0, 30),
        mode_specific: {
          marking_basis: "answer_key_match",
          detected_questions: total,
          detected_student_answers: studentAnswers.size,
        },
      };
    }

    const extractedBreakdown = extractMathsQuestionBreakdownFromText(text);
    if (extractedBreakdown.length) {
      const answerable = extractedBreakdown.filter((item) => item.expected_answer !== "(could not infer)");
      const correctCount = answerable.filter((item) => item.correct).length;
      const total = answerable.length || extractedBreakdown.length;
      const pct = total > 0 ? Math.round((correctCount / total) * 100) : null;
      const incorrect = total - correctCount;

      return {
        mode,
        confidence: 76,
        score: pct,
        grade: pct === null ? null : gradeFromPercent(pct),
        feedback:
          pct === null
            ? "Maths questions were detected, but the answers could not be matched clearly enough for a draft mark."
            : `${correctCount}/${total} detected arithmetic question${total === 1 ? "" : "s"} correct from the worksheet image.`,
        details: [
          `Detected worksheet questions: ${extractedBreakdown.length}`,
          pct === null ? "Answer matching was not strong enough to calculate a score." : `Correct answers: ${correctCount}/${total}`,
          incorrect > 0 ? `${incorrect} question${incorrect === 1 ? "" : "s"} still need review.` : "All detected arithmetic answers look correct.",
          `OCR files analysed: ${ocrFileCount}`,
        ],
        question_breakdown: extractedBreakdown,
        mode_specific: {
          marking_basis: "ocr_prompt_match",
          detected_questions: extractedBreakdown.length,
          answerable_questions: answerable.length,
        },
      };
    }

    const questionLike = lines.filter((l) => /^q?\d+[\).:\- ]/i.test(l)).length;
    const estimatedQuestions = Math.max(questionLike, Math.min(12, Math.max(1, Math.round(words / 14))));
    const estimatedCorrect = Math.max(0, Math.min(estimatedQuestions, Math.round(estimatedQuestions * 0.68)));
    const pct = Math.round((estimatedCorrect / estimatedQuestions) * 100);
    return {
      mode,
      confidence: 55,
      score: pct,
      grade: gradeFromPercent(pct),
      feedback: `Estimated ${estimatedCorrect}/${estimatedQuestions} correct from scan patterns. Add an answer key in assignment instructions using lines like "Q1=12" for exact marking.`,
      details: [
        `Estimated question count: ${estimatedQuestions}`,
        `Estimated correct: ${estimatedCorrect}`,
        `OCR files analysed: ${ocrFileCount}`,
      ],
      mode_specific: {
        marking_basis: "estimate_only",
      },
    };
  }

  if (mode === "english_writing_feedback") {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const avgSentenceLength = sentences.length ? Math.round(words / sentences.length) : 0;
    const hasEvidenceWords = /\bfor example|because|therefore|this shows|evidence|quote\b/i.test(text);
    const hasConnectives = /\bhowever|although|meanwhile|furthermore|therefore|whereas\b/i.test(text);
    const hasVariedPunctuation = /[,;:]/.test(text);

    const wwwPoints: string[] = [];
    const ebiPoints: string[] = [];
    if (words >= 120) wwwPoints.push("Sustained writing length gives enough content to assess ideas.");
    else ebiPoints.push("Extend the response to at least 120 words to develop ideas fully.");
    if (hasEvidenceWords) wwwPoints.push("Uses explanation language (for example/because/this shows) to justify points.");
    else ebiPoints.push("Add evidence sentences that explain why each point is valid.");
    if (hasConnectives) wwwPoints.push("Uses linking words to join ideas logically.");
    else ebiPoints.push("Use connectives such as however, therefore and whereas to improve flow.");
    if (hasVariedPunctuation) wwwPoints.push("Some punctuation variety supports clearer expression.");
    else ebiPoints.push("Use commas and clauses to vary sentence structure.");
    if (paragraphs.length >= 2) wwwPoints.push("Paragraphing is visible and helps structure.");
    else ebiPoints.push("Split writing into clear paragraphs for each main idea.");

    const www = wwwPoints.slice(0, 2).join(" ");
    const ebi = ebiPoints.slice(0, 2).join(" ");
    const qualityScore = [
      Math.min(words / 140, 1) * 35,
      (hasEvidenceWords ? 1 : 0) * 20,
      (hasConnectives ? 1 : 0) * 15,
      Math.min(paragraphs.length / 3, 1) * 15,
      (hasVariedPunctuation ? 1 : 0) * 15,
    ].reduce((a, b) => a + b, 0);
    const pseudoScore = Math.max(35, Math.min(92, Math.round(qualityScore)));
    const nextSteps = [
      "Add one short quoted example to support a key point.",
      "Use one sentence starter that analyses effect (e.g. This suggests...).",
      "Check spelling and punctuation before submitting.",
    ];
    return {
      mode,
      confidence: 74,
      score: pseudoScore,
      grade: gradeFromPercent(pseudoScore),
      feedback: `WWW: ${www} EBI: ${ebi}`,
      details: [
        `WWW: ${www}`,
        `EBI: ${ebi}`,
        `Word count: ${words}`,
        `Paragraphs detected: ${paragraphs.length}`,
        `Average sentence length: ${avgSentenceLength} words`,
        `Next step: ${nextSteps[0]}`,
      ],
      mode_specific: {
        www,
        ebi,
        next_steps: nextSteps,
        writing_metrics: {
          words,
          paragraphs: paragraphs.length,
          sentences: sentences.length,
          avg_sentence_length: avgSentenceLength,
        },
      },
    };
  }

  if (mode === "gcse_english_ao") {
    const hasQuotes = /["“”']/.test(text) || /\bquote|evidence\b/i.test(text);
    const hasAnalysisLanguage = /\bshows|suggests|implies|conveys|highlights|emphasises\b/i.test(text);
    const hasContext = /\bcontext|victorian|modern|audience|society|historical\b/i.test(text);
    const technicalAccuracy = /\btheir|there|they're\b/i.test(text) ? 1 : 0.8;

    const ao1 = Math.max(1, Math.min(6, Math.round((Math.min(words, 260) / 260) * 6)));
    const ao2 = Math.max(1, Math.min(6, Math.round(((hasAnalysisLanguage ? 0.6 : 0.2) + (hasQuotes ? 0.4 : 0.2)) * 6)));
    const ao3 = Math.max(1, Math.min(6, Math.round(((hasContext ? 0.7 : 0.25) + (hasQuotes ? 0.3 : 0.2)) * 6)));
    const ao4 = Math.max(1, Math.min(6, Math.round(((Math.min(words, 220) / 220) * 0.6 + technicalAccuracy * 0.4) * 6)));
    const total = ao1 + ao2 + ao3 + ao4;
    const pct = Math.round((total / 24) * 100);
    const targets = [
      "AO2: Zoom in on one key word/phrase and explain its effect in detail.",
      "AO3: Link interpretation to context more explicitly.",
      "AO4: Finish with a proofreading pass for punctuation and clarity.",
    ];
    return {
      mode,
      confidence: 70,
      score: pct,
      grade: gradeFromPercent(pct === 0 ? 0 : pct),
      feedback: `AO estimate generated. Focus next on AO2 language analysis and AO3 context links.`,
      details: [
        `AO1: ${ao1}/6`,
        `AO2: ${ao2}/6`,
        `AO3: ${ao3}/6`,
        `AO4: ${ao4}/6`,
        `Next step: ${targets[0]}`,
      ],
      mode_specific: {
        ao_breakdown: { ao1, ao2, ao3, ao4, total, out_of: 24 },
        improvement_targets: targets,
      },
    };
  }

  if (mode === "science_short_answer") {
    if (!keywords.length && !targetWords) {
      const draft = calculateDraftStructureScore(text, "science");
      return {
        mode,
        confidence: 64,
        score: draft.score,
        grade: gradeFromPercent(draft.score),
        feedback: `Science draft mark estimated from detected scientific vocabulary, response length, and answer structure.`,
        details: [
          `Draft mark based on OCR text structure rather than a fixed answer key.`,
          `Word count: ${draft.words}`,
          `Detected science terms: ${draft.vocabularyHits}`,
          `Question-style lines: ${draft.questionLike}`,
        ],
        mode_specific: {
          marking_basis: "science_structure_estimate",
          words: draft.words,
          vocabulary_hits: draft.vocabularyHits,
          question_lines: draft.questionLike,
        },
      };
    }

    const result = calculateAutoMark(text, keywords, targetWords);
    return {
      mode,
      confidence: 72,
      score: result.score,
      grade: result.grade,
      feedback: result.feedback,
      details: [
        `Keyword-led science check complete.`,
        `Word count: ${words}`,
        `OCR files analysed: ${ocrFileCount}`,
      ],
    };
  }

  if (!keywords.length && !targetWords) {
    const draft = calculateDraftStructureScore(text, "generic");
    return {
      mode: "generic_completion_review",
      confidence: 58,
      score: draft.score,
      grade: gradeFromPercent(draft.score),
      feedback: "Draft mark estimated from detected written content and completion signals.",
      details: [
        `Draft estimate based on response length and visible structure.`,
        `Word count: ${draft.words}`,
        `Lines detected: ${draft.lines}`,
        `Question-style lines: ${draft.questionLike}`,
      ],
      mode_specific: {
        marking_basis: "generic_structure_estimate",
        words: draft.words,
        lines: draft.lines,
      },
    };
  }

  const generic = calculateAutoMark(text, keywords, targetWords);
  return {
    mode: "generic_completion_review",
    confidence: 60,
    score: generic.score,
    grade: generic.grade,
    feedback: generic.feedback,
    details: [
      `Generic completion review applied.`,
      `Word count: ${words}`,
      `OCR files analysed: ${ocrFileCount}`,
    ],
  };
}

async function ocrWithOcrSpace(imageBytes: Uint8Array, mimeType: string): Promise<string> {
  if (!OCR_API_KEY) {
    throw new Error("OCR.Space API key is missing.");
  }

  const b64 = btoa(String.fromCharCode(...imageBytes));
  const body = new FormData();
  body.append("base64Image", `data:${mimeType};base64,${b64}`);
  body.append("isOverlayRequired", "false");
  body.append("language", "eng");
  body.append("apikey", OCR_API_KEY);

  const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body });
  if (!res.ok) {
    throw new Error(`OCR.Space request failed with ${res.status}`);
  }
  const json = await res.json();
  if (json.IsErroredOnProcessing) {
    const message = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join("; ") : "OCR.Space could not process the image.";
    throw new Error(message);
  }
  if (!json.ParsedResults?.length) return "";
  return json.ParsedResults.map((r: any) => r.ParsedText || "").join("\n");
}

async function ocrWithGoogle(imageBytes: Uint8Array): Promise<string> {
  if (!GOOGLE_VISION_KEY) {
    throw new Error("Google Vision API key is missing.");
  }

  const b64 = btoa(String.fromCharCode(...imageBytes));
  const body = {
    requests: [{ image: { content: b64 }, features: [{ type: "TEXT_DETECTION" }] }],
  };
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    throw new Error(`Google Vision request failed with ${res.status}`);
  }
  const json = await res.json();
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  return json.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

async function ocrWithAzure(imageBytes: Uint8Array, mimeType: string): Promise<string> {
  if (!AZURE_CV_ENDPOINT || !AZURE_CV_KEY) {
    throw new Error("Azure Computer Vision is not configured.");
  }

  const analyzeUrl = `${AZURE_CV_ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=read`;
  const res = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": AZURE_CV_KEY, "Content-Type": mimeType },
    body: imageBytes,
  });
  if (!res.ok) {
    throw new Error(`Azure OCR request failed with ${res.status}`);
  }
  const json = await res.json();
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  const lines = json.readResult?.pages?.flatMap((p: any) => p.lines ?? []) ?? [];
  return lines.map((l: any) => l.content).join("\n");
}

async function runOCR(imageBytes: Uint8Array, mimeType = "image/jpeg"): Promise<string> {
  if (OCR_PROVIDER === "ocrspace") return await ocrWithOcrSpace(imageBytes, mimeType);
  if (OCR_PROVIDER === "google") return await ocrWithGoogle(imageBytes);
  if (OCR_PROVIDER === "azure") return await ocrWithAzure(imageBytes, mimeType);
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = await req.json();
    const submissionId = body?.submission_id;
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("id,assignment_id,student_id,notes")
      .eq("id", submissionId)
      .single();
    if (subErr || !submission) throw new Error(subErr?.message || "Submission not found");

    const { data: assignment, error: asgErr } = await supabase
      .from("assignments")
      .select(ASSIGNMENT_SELECT_FIELDS)
      .eq("id", submission.assignment_id)
      .single();
    if (asgErr || !assignment) throw new Error(asgErr?.message || "Assignment not found");

    const { data: studentProfile, error: studentProfileErr } = await supabase
      .from("profiles")
      .select("year_group")
      .eq("id", submission.student_id)
      .maybeSingle();
    if (studentProfileErr) throw new Error(studentProfileErr.message);

    await supabase
      .from("submissions")
      .update({ ocr_processing: true })
      .eq("id", submissionId);

    const { data: files, error: filesErr } = await supabase
      .from("submission_files")
      .select("id,file_path")
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: true });
    if (filesErr) throw new Error(filesErr.message);

    const ocrTexts: string[] = [];
    const imagePayloads: Array<{ mimeType: string; base64: string }> = [];
    const fileErrors: string[] = [];

    for (const file of files || []) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(SUBMISSION_BUCKET)
          .download(file.file_path);
        if (dlErr || !blob) throw new Error(dlErr?.message || "Download failed");

        const mimeType = blob.type || "image/jpeg";
        const imageBytes = new Uint8Array(await blob.arrayBuffer());
        imagePayloads.push({
          mimeType,
          base64: btoa(String.fromCharCode(...imageBytes)),
        });
        const text = await runOCR(imageBytes, mimeType);
        ocrTexts.push(text || "");

        await supabase
          .from("submission_files")
          .update({ ocr_text: text || null })
          .eq("id", file.id);
      } catch (err: any) {
        fileErrors.push(`[${file.file_path}] ${err.message}`);
      }
    }

    const combined = [submission.notes || "", ...ocrTexts].filter(Boolean).join("\n\n");
    const isQuickUpload = /^quick upload:/i.test(String(assignment.title || ""));
    const quickUploadContext = parseQuickUploadMarkingContext(assignment.marking_context);
    const combinedForInference = [
      combined,
      quickUploadContext.taskDescription || "",
      quickUploadContext.markScheme || "",
      quickUploadContext.levelDescriptors || "",
      quickUploadContext.additionalContext || "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const inferredMeta = inferQuickUploadMetadata({
      combinedText: combinedForInference || combined,
      existingSubject: assignment.subject,
      existingTitle: assignment.title,
      existingDescription: assignment.description,
      yearGroup: studentProfile?.year_group ?? null,
    });
    const hasStudentSuppliedExamBoard = Boolean(quickUploadContext.examBoard);

    let workingAssignment = assignment;
    if (isQuickUpload) {
      const nextKeywords = inferredMeta.keywords || [];
      const updates: Record<string, unknown> = {};

      if (inferredMeta.subject && inferredMeta.subject !== assignment.subject) {
        updates.subject = inferredMeta.subject;
      }
      if (inferredMeta.title && inferredMeta.title !== assignment.title) {
        updates.title = inferredMeta.title;
      }
      if (inferredMeta.markingMode && inferredMeta.markingMode !== assignment.marking_mode) {
        updates.marking_mode = inferredMeta.markingMode;
      }
      if (JSON.stringify(nextKeywords) !== JSON.stringify(assignment.automark_keywords || [])) {
        updates.automark_keywords = nextKeywords;
      }
      if ((inferredMeta.targetWords || null) !== (assignment.automark_target_words || null)) {
        updates.automark_target_words = inferredMeta.targetWords;
      }
      if (quickUploadContext.examBoard && quickUploadContext.examBoard !== assignment.exam_board) {
        updates.exam_board = quickUploadContext.examBoard;
      }

      if (Object.keys(updates).length) {
        const { data: updatedAssignment, error: assignmentUpdateErr } = await supabase
          .from("assignments")
          .update(updates)
          .eq("id", assignment.id)
          .select(ASSIGNMENT_SELECT_FIELDS)
          .single();

        if (assignmentUpdateErr) throw new Error(assignmentUpdateErr.message);
        if (updatedAssignment) {
          workingAssignment = updatedAssignment;
        }
      }
    }

    let autoMark: number | null = null;
    let autoGrade: string | null = null;
    let autoFeedback: string | null = null;
    let autoResult: Record<string, unknown> | null = null;
    let autoConfidence: number | null = null;

    if (workingAssignment.automark_enabled) {
      const heuristicResult = buildAutoAssessment(
        workingAssignment.marking_mode || "generic_completion_review",
        combined,
        workingAssignment.automark_keywords || [],
        workingAssignment.automark_target_words || null,
        (files || []).length,
        [workingAssignment.title || "", workingAssignment.description || ""].filter(Boolean).join("\n"),
      );
      const heuristicModeSpecific =
        heuristicResult.mode_specific && typeof heuristicResult.mode_specific === "object"
          ? heuristicResult.mode_specific
          : {};
      const heuristicMarkingBasis = typeof heuristicModeSpecific.marking_basis === "string"
        ? heuristicModeSpecific.marking_basis
        : null;

      let universalAssessment: UniversalOpenAiAssessment | null = null;
      if (isQuickUpload && OPENAI_API_KEY && (combined.trim() || imagePayloads.length)) {
        try {
          universalAssessment = await requestOpenAiUniversalAssessment({
            combinedText: combined,
            assignmentTitle: workingAssignment.title || "Quick Upload: Student work",
            assignmentSubject: workingAssignment.subject || "General",
            yearGroup: studentProfile?.year_group ?? null,
            quickUploadContext,
            studentNotes: submission.notes || "",
            imagePayloads,
          });
        } catch (openAiError) {
          fileErrors.push(
            `[openai-universal] ${openAiError instanceof Error ? openAiError.message : "Universal marking failed"}`
          );
        }
      }

      let openAiDraft: OpenAiDraft | null = null;
      if (!universalAssessment && OPENAI_API_KEY && heuristicMarkingBasis !== "answer_key_match" && (combined.trim() || imagePayloads.length)) {
        try {
          openAiDraft = await requestOpenAiDraftAssessment({
            combinedText: combined,
            assignmentContext: [
              workingAssignment.subject || "",
              workingAssignment.title || "",
              workingAssignment.description || "",
              quickUploadContext.taskDescription || "",
              quickUploadContext.markScheme || "",
              quickUploadContext.levelDescriptors || "",
              quickUploadContext.additionalContext || "",
            ]
              .filter(Boolean)
              .join("\n"),
            yearGroup: studentProfile?.year_group ?? null,
            subject: workingAssignment.subject || "General",
            markingMode: workingAssignment.marking_mode || "generic_completion_review",
            heuristicSummary: heuristicResult.feedback,
            imagePayloads,
          });
        } catch (openAiError) {
          fileErrors.push(
            `[openai] ${openAiError instanceof Error ? openAiError.message : "Draft enhancement failed"}`
          );
        }
      }

      if (!combined.trim() && !openAiDraft && !universalAssessment) {
        fileErrors.push(
          OCR_PROVIDER === "none" && !OPENAI_API_KEY
            ? "No OCR provider or OpenAI image analysis is configured for automatic marking."
            : "No readable text could be extracted from the uploaded image."
        );
      }

      if (universalAssessment && isQuickUpload) {
        const universalAssignmentUpdates: Record<string, unknown> = {};
        if (
          !inferredMeta.hasStudentSuppliedSubject &&
          universalAssessment.inferred_subject &&
          universalAssessment.inferred_subject !== workingAssignment.subject &&
          universalAssessment.inferred_subject !== "General"
        ) {
          universalAssignmentUpdates.subject = universalAssessment.inferred_subject;
        }
        if (
          !inferredMeta.hasStudentSuppliedTitle &&
          universalAssessment.inferred_title &&
          universalAssessment.inferred_title !== workingAssignment.title
        ) {
          universalAssignmentUpdates.title = universalAssessment.inferred_title;
        }
        if (
          !hasStudentSuppliedExamBoard &&
          universalAssessment.exam_board &&
          universalAssessment.exam_board !== workingAssignment.exam_board
        ) {
          universalAssignmentUpdates.exam_board = universalAssessment.exam_board;
        }

        if (Object.keys(universalAssignmentUpdates).length) {
          const { data: updatedAssignment, error: universalAssignmentErr } = await supabase
            .from("assignments")
            .update(universalAssignmentUpdates)
            .eq("id", assignment.id)
            .select(ASSIGNMENT_SELECT_FIELDS)
            .single();

          if (universalAssignmentErr) {
            fileErrors.push(`[assignment-update] ${universalAssignmentErr.message}`);
          } else if (updatedAssignment) {
            workingAssignment = updatedAssignment;
          }
        }
      } else if (openAiDraft && isQuickUpload) {
        const openAiAssignmentUpdates: Record<string, unknown> = {};
        if (
          !inferredMeta.hasStudentSuppliedSubject &&
          openAiDraft.inferred_subject &&
          openAiDraft.inferred_subject !== workingAssignment.subject &&
          openAiDraft.inferred_subject !== "General"
        ) {
          openAiAssignmentUpdates.subject = openAiDraft.inferred_subject;
        }
        if (
          !inferredMeta.hasStudentSuppliedTitle &&
          openAiDraft.inferred_title &&
          openAiDraft.inferred_title !== workingAssignment.title
        ) {
          openAiAssignmentUpdates.title = openAiDraft.inferred_title;
        }
        if (
          openAiDraft.suggested_marking_mode &&
          openAiDraft.suggested_marking_mode !== workingAssignment.marking_mode
        ) {
          openAiAssignmentUpdates.marking_mode = openAiDraft.suggested_marking_mode;
        }

        if (Object.keys(openAiAssignmentUpdates).length) {
          const { data: updatedAssignment, error: openAiAssignmentErr } = await supabase
            .from("assignments")
            .update(openAiAssignmentUpdates)
            .eq("id", assignment.id)
            .select(ASSIGNMENT_SELECT_FIELDS)
            .single();

          if (openAiAssignmentErr) {
            fileErrors.push(`[assignment-update] ${openAiAssignmentErr.message}`);
          } else if (updatedAssignment) {
            workingAssignment = updatedAssignment;
          }
        }
      }

      const result = universalAssessment
        ? {
            mode: workingAssignment.marking_mode || "generic_completion_review",
            confidence: universalAssessment.confidence,
            score: universalAssessment.percentage,
            grade:
              universalAssessment.grade_equivalent ||
              universalAssessment.level ||
              (universalAssessment.percentage === null ? null : gradeFromPercent(universalAssessment.percentage)),
            feedback: universalAssessment.detailed_feedback,
            details: [
              `Why this mark was awarded: ${universalAssessment.mark_commentary}`,
              ...universalAssessment.strengths.map((item) => `Strength: ${item}`),
              ...universalAssessment.improvements.map((item) => `Improve: ${item}`),
              ...universalAssessment.next_steps.map((item) => `Next: ${item}`),
            ].slice(0, 8),
            question_breakdown: [] as QuestionBreakdownItem[],
            mode_specific: {
              draft_source: "openai",
              model: OPENAI_MODEL,
              marking_strategy: "universal_quick_upload",
              raw_score: universalAssessment.score,
              max_marks: universalAssessment.max_marks,
              transcription: universalAssessment.transcription,
              inferred_task: universalAssessment.inferred_task,
              exemplar_addition: universalAssessment.exemplar_addition,
              strengths: universalAssessment.strengths,
              issues: universalAssessment.improvements,
              improvements: universalAssessment.improvements,
              next_steps: universalAssessment.next_steps,
              heuristic_summary: heuristicResult.feedback,
              context_used: {
                has_task_description: Boolean(quickUploadContext.taskDescription),
                has_mark_scheme: Boolean(quickUploadContext.markScheme),
                has_level_descriptors: Boolean(quickUploadContext.levelDescriptors),
                has_max_marks: quickUploadContext.maxMarks !== null,
              },
            },
          }
        : openAiDraft
        ? {
            mode: workingAssignment.marking_mode || openAiDraft.suggested_marking_mode,
            confidence: openAiDraft.confidence,
            score: openAiDraft.draft_score,
            grade:
              openAiDraft.draft_grade ||
              (openAiDraft.draft_score === null ? null : gradeFromPercent(openAiDraft.draft_score)),
            feedback: openAiDraft.summary,
            details: [
              ...openAiDraft.strengths.map((item) => `Strength: ${item}`),
              ...openAiDraft.issues.map((item) => `Watch: ${item}`),
              ...openAiDraft.next_steps.map((item) => `Next: ${item}`),
            ].slice(0, 8),
            question_breakdown: openAiDraft.question_breakdown,
            mode_specific: {
              ...(heuristicModeSpecific && typeof heuristicModeSpecific === "object" ? heuristicModeSpecific : {}),
              draft_source: "openai",
              model: OPENAI_MODEL,
              strengths: openAiDraft.strengths,
              issues: openAiDraft.issues,
              next_steps: openAiDraft.next_steps,
              heuristic_summary: heuristicResult.feedback,
              extracted_text: openAiDraft.extracted_text,
            },
          }
        : {
            ...heuristicResult,
            mode_specific: {
              ...(heuristicModeSpecific && typeof heuristicModeSpecific === "object" ? heuristicModeSpecific : {}),
              draft_source: "heuristic",
            },
          };

      autoMark = result.score;
      autoGrade = result.grade;
      autoFeedback = result.feedback;
      autoConfidence = result.confidence;
      const finalSubjectInferred =
        inferredMeta.subjectInferred ||
        (!inferredMeta.hasStudentSuppliedSubject && workingAssignment.subject !== assignment.subject);
      const finalTitleInferred =
        inferredMeta.titleInferred ||
        (!inferredMeta.hasStudentSuppliedTitle && workingAssignment.title !== assignment.title);
      const finalExamBoardInferred =
        !hasStudentSuppliedExamBoard &&
        Boolean(workingAssignment.exam_board) &&
        workingAssignment.exam_board !== assignment.exam_board;
      autoResult = {
        mode: result.mode,
        confidence: result.confidence,
        summary: universalAssessment ? universalAssessment.mark_commentary : result.feedback,
        details: result.details,
        question_breakdown: result.question_breakdown || [],
        mode_specific: result.mode_specific || null,
        transcription: universalAssessment?.transcription || null,
        score: universalAssessment?.score ?? null,
        max_marks: universalAssessment?.max_marks ?? null,
        percentage: universalAssessment?.percentage ?? null,
        grade_equivalent: universalAssessment?.grade_equivalent || null,
        level: universalAssessment?.level || null,
        strengths: universalAssessment?.strengths || [],
        improvements: universalAssessment?.improvements || [],
        detailed_feedback: universalAssessment?.detailed_feedback || null,
        mark_commentary: universalAssessment?.mark_commentary || null,
        next_steps: universalAssessment?.next_steps || [],
        exemplar_addition: universalAssessment?.exemplar_addition || null,
        inferred_context: universalAssessment
          ? {
              subject: universalAssessment.inferred_subject,
              task: universalAssessment.inferred_task,
              exam_board: universalAssessment.exam_board,
            }
          : null,
        inferred_assignment: isQuickUpload
          ? {
              subject: workingAssignment.subject,
              title: workingAssignment.title,
              exam_board: workingAssignment.exam_board,
              marking_mode: workingAssignment.marking_mode,
              subject_inferred: finalSubjectInferred,
              title_inferred: finalTitleInferred,
              exam_board_inferred: finalExamBoardInferred,
            }
          : null,
      };
    } else if (fileErrors.length) {
      autoFeedback = `OCR warnings: ${fileErrors.join("; ")}`;
    }

    if (fileErrors.length) {
      autoFeedback = autoFeedback
        ? `${autoFeedback}\n\nOCR warnings: ${fileErrors.join("; ")}`
        : `OCR warnings: ${fileErrors.join("; ")}`;
      if (autoResult) {
        autoResult.warnings = fileErrors;
      }
    }

    const { error: updateErr } = await supabase
      .from("submissions")
      .update({
        auto_mark: autoMark,
        auto_grade: autoGrade,
        auto_feedback: autoFeedback,
        auto_result: autoResult,
        auto_confidence: autoConfidence,
        auto_graded_at: new Date().toISOString(),
        ocr_processing: false,
      })
      .eq("id", submissionId);
    if (updateErr) throw new Error(updateErr.message);

    return new Response(JSON.stringify({
      success: true,
      submission_id: submissionId,
      auto_mark: autoMark,
      auto_grade: autoGrade,
      auto_feedback: autoFeedback,
      ocr_warnings: fileErrors,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ocr_mark_submission failed:", err);
    try {
      const body = await req.clone().json();
      const submissionId = body?.submission_id;
      if (submissionId) {
        await supabase
          .from("submissions")
          .update({
            ocr_processing: false,
            auto_feedback: `Processing error: ${err.message}`,
            auto_graded_at: new Date().toISOString(),
          })
          .eq("id", submissionId);
      }
    } catch (_inner) {
      // Ignore secondary error while returning original failure.
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
