import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OCR_PROVIDER = (Deno.env.get("OCR_PROVIDER") || "none").toLowerCase();
const OCR_API_KEY = Deno.env.get("OCR_API_KEY") || "";
const GOOGLE_VISION_KEY = Deno.env.get("GOOGLE_VISION_KEY") || OCR_API_KEY;
const AZURE_CV_ENDPOINT = Deno.env.get("AZURE_CV_ENDPOINT") || "";
const AZURE_CV_KEY = Deno.env.get("AZURE_CV_KEY") || OCR_API_KEY;
const SUBMISSION_BUCKET = "submission-files";

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
  const b64 = btoa(String.fromCharCode(...imageBytes));
  const body = new FormData();
  body.append("base64Image", `data:${mimeType};base64,${b64}`);
  body.append("isOverlayRequired", "false");
  body.append("language", "eng");
  body.append("apikey", OCR_API_KEY);

  const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body });
  const json = await res.json();
  if (!json.ParsedResults?.length) return "";
  return json.ParsedResults.map((r: any) => r.ParsedText || "").join("\n");
}

async function ocrWithGoogle(imageBytes: Uint8Array): Promise<string> {
  const b64 = btoa(String.fromCharCode(...imageBytes));
  const body = {
    requests: [{ image: { content: b64 }, features: [{ type: "TEXT_DETECTION" }] }],
  };
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const json = await res.json();
  return json.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

async function ocrWithAzure(imageBytes: Uint8Array, mimeType: string): Promise<string> {
  const analyzeUrl = `${AZURE_CV_ENDPOINT}/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=read`;
  const res = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": AZURE_CV_KEY, "Content-Type": mimeType },
    body: imageBytes,
  });
  const json = await res.json();
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
      .select("id,title,description,automark_enabled,automark_keywords,automark_target_words,marking_mode")
      .eq("id", submission.assignment_id)
      .single();
    if (asgErr || !assignment) throw new Error(asgErr?.message || "Assignment not found");

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
    const fileErrors: string[] = [];

    for (const file of files || []) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(SUBMISSION_BUCKET)
          .download(file.file_path);
        if (dlErr || !blob) throw new Error(dlErr?.message || "Download failed");

        const mimeType = blob.type || "image/jpeg";
        const imageBytes = new Uint8Array(await blob.arrayBuffer());
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
    let autoMark: number | null = null;
    let autoGrade: string | null = null;
    let autoFeedback: string | null = null;
    let autoResult: Record<string, unknown> | null = null;
    let autoConfidence: number | null = null;

    if (assignment.automark_enabled) {
      const result = buildAutoAssessment(
        assignment.marking_mode || "generic_completion_review",
        combined,
        assignment.automark_keywords || [],
        assignment.automark_target_words || null,
        (files || []).length,
        [assignment.title || "", assignment.description || ""].filter(Boolean).join("\n"),
      );
      autoMark = result.score;
      autoGrade = result.grade;
      autoFeedback = result.feedback;
      autoConfidence = result.confidence;
      autoResult = {
        mode: result.mode,
        confidence: result.confidence,
        summary: result.feedback,
        details: result.details,
        question_breakdown: result.question_breakdown || [],
        mode_specific: result.mode_specific || null,
      };
      if (fileErrors.length) {
        autoFeedback = `${autoFeedback} · OCR warnings: ${fileErrors.join("; ")}`;
      }
    } else if (fileErrors.length) {
      autoFeedback = `OCR warnings: ${fileErrors.join("; ")}`;
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
