import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";

type AnthropicReview = {
  grade: string;
  mark: number | null;
  comment: string;
  strengths: string[];
  fix_next: string[];
  confidence: number | null;
};

function toPlainObject(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 6)
    : [];
}

function extractJsonBlock(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Anthropic returned an empty response.");
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]) as Record<string, unknown>;
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
  }

  throw new Error("Anthropic did not return valid JSON.");
}

function normalizeReview(payload: Record<string, unknown>): AnthropicReview {
  const grade = String(payload.grade || "").trim();
  const comment = String(payload.comment || "").trim();
  const rawMark = payload.mark;
  const numericMark = typeof rawMark === "number" ? rawMark : Number(rawMark);
  const mark = Number.isFinite(numericMark) ? Math.min(100, Math.max(0, Number(numericMark.toFixed(2)))) : null;
  const rawConfidence = payload.confidence;
  const numericConfidence = typeof rawConfidence === "number" ? rawConfidence : Number(rawConfidence);
  const confidence = Number.isFinite(numericConfidence)
    ? Math.min(100, Math.max(0, Number(numericConfidence.toFixed(2))))
    : null;

  if (!comment) {
    throw new Error("Anthropic returned no review comment.");
  }

  return {
    grade,
    mark,
    comment,
    strengths: normalizeStringList(payload.strengths),
    fix_next: normalizeStringList(payload.fix_next),
    confidence
  };
}

function buildPrompt({
  assignment,
  submission,
  student,
  submissionFiles
}: {
  assignment: Record<string, unknown>;
  submission: Record<string, unknown>;
  student: Record<string, unknown>;
  submissionFiles: Array<Record<string, unknown>>;
}) {
  const autoResult = toPlainObject(submission.auto_result);
  const questionBreakdown = Array.isArray(autoResult.question_breakdown)
    ? autoResult.question_breakdown.slice(0, 20)
    : [];
  const modeSpecific = toPlainObject(autoResult.mode_specific);
  const extractedText = [
    String(submission.notes || "").trim(),
    ...submissionFiles.map((file) => String(file.ocr_text || "").trim())
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    "You are helping a tutor review student work from a tutoring portal.",
    "Use only the evidence supplied. Do not invent question-by-question feedback that is not supported by the OCR text, question breakdown, or existing auto-mark draft.",
    "If the OCR is weak, say so plainly and keep the review conservative.",
    "Return JSON only with this exact shape:",
    '{"grade":"string","mark":0,"comment":"string","strengths":["string"],"fix_next":["string"],"confidence":0}',
    "",
    "Submission context:",
    JSON.stringify(
      {
        student: {
          full_name: student.full_name || null,
          year_group: student.year_group || null
        },
        assignment: {
          title: assignment.title || null,
          subject: assignment.subject || null,
          description: assignment.description || null,
          year_group: assignment.year_group || null,
          exam_board: assignment.exam_board || null,
          marking_mode: assignment.marking_mode || null
        },
        existing_auto_draft: {
          auto_mark: submission.auto_mark ?? null,
          auto_grade: submission.auto_grade ?? null,
          auto_feedback: submission.auto_feedback ?? null,
          auto_confidence: submission.auto_confidence ?? null,
          summary: typeof autoResult.summary === "string" ? autoResult.summary : null,
          details: Array.isArray(autoResult.details) ? autoResult.details.slice(0, 10) : [],
          question_breakdown: questionBreakdown,
          strengths: normalizeStringList(modeSpecific.strengths),
          issues: normalizeStringList(modeSpecific.issues),
          next_steps: normalizeStringList(modeSpecific.next_steps)
        },
        submission: {
          submitted_at: submission.submitted_at || null,
          tutor_feedback: submission.tutor_feedback || null,
          current_grade: submission.grade || null,
          current_mark: submission.mark ?? null,
          ocr_text: extractedText || null,
          ocr_file_count: submissionFiles.length
        }
      },
      null,
      2
    ),
    "",
    "Output rules:",
    "- `comment` should be ready for a tutor to paste into the final feedback box.",
    "- `comment` should be 3 to 6 sentences and mention what is right, what needs fixing, and the clearest next step.",
    "- `grade` can be blank if the evidence is too weak.",
    "- `mark` can be null if the evidence is too weak.",
    "- `strengths` and `fix_next` should each contain 2 to 4 concise bullets.",
    "- Prefer plain UK tutoring language."
  ].join("\n");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey || apiKey.includes("...")) {
    return NextResponse.json(
      { error: "Missing a real ANTHROPIC_API_KEY. Replace the placeholder in your app env before generating AI review feedback." },
      { status: 503 }
    );
  }

  try {
    const { submissionId } = await params;
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };
    const force = Boolean(body.force);

    const { data: submission, error: submissionError } = await auth.supabase
      .from("submissions")
      .select(`
        id,
        submitted_at,
        notes,
        mark,
        grade,
        tutor_feedback,
        auto_mark,
        auto_grade,
        auto_feedback,
        auto_confidence,
        auto_result,
        review_ai_comment,
        review_ai_grade,
        review_ai_score,
        review_ai_generated_at,
        review_ai_provider,
        review_ai_payload,
        assignments!inner (
          id,
          tutor_id,
          title,
          subject,
          description,
          year_group,
          exam_board,
          marking_mode,
          student:profiles!assignments_student_id_fkey (
            id,
            full_name,
            year_group
          )
        ),
        submission_files (
          id,
          file_path,
          ocr_text
        )
      `)
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError || !submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const assignment = Array.isArray(submission.assignments) ? submission.assignments[0] : submission.assignments;
    if (!assignment || assignment.tutor_id !== auth.profile.id) {
      return NextResponse.json({ error: "You do not have access to this submission." }, { status: 403 });
    }

    if (!force && submission.review_ai_comment) {
      const cachedPayload = toPlainObject(submission.review_ai_payload);
      return NextResponse.json({
        comment: submission.review_ai_comment,
        grade: submission.review_ai_grade || "",
        mark: submission.review_ai_score ?? null,
        strengths: normalizeStringList(cachedPayload.strengths),
        fixNext: normalizeStringList(cachedPayload.fix_next),
        confidence:
          typeof cachedPayload.confidence === "number"
            ? cachedPayload.confidence
            : submission.auto_confidence ?? null,
        cached: true,
        generatedAt: submission.review_ai_generated_at
      });
    }

    const student = Array.isArray(assignment.student) ? assignment.student[0] : assignment.student;
    const submissionFiles = Array.isArray(submission.submission_files) ? submission.submission_files : [];
    const prompt = buildPrompt({
      assignment: assignment as Record<string, unknown>,
      submission: submission as Record<string, unknown>,
      student: (student || {}) as Record<string, unknown>,
      submissionFiles: submissionFiles as Array<Record<string, unknown>>
    });

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 900,
      temperature: 0.2,
      system:
        "You are a careful tutoring review assistant. Be conservative, practical, and evidence-led. Never hallucinate missing student answers.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const responseText = response.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n")
      .trim();
    const parsed = extractJsonBlock(responseText);
    const review = normalizeReview(parsed);

    const payload = {
      strengths: review.strengths,
      fix_next: review.fix_next,
      confidence: review.confidence,
      raw_response: responseText
    };

    const { error: cacheError } = await auth.supabase
      .from("submissions")
      .update({
        review_ai_comment: review.comment,
        review_ai_grade: review.grade || null,
        review_ai_score: review.mark,
        review_ai_generated_at: new Date().toISOString(),
        review_ai_provider: "anthropic",
        review_ai_payload: payload
      })
      .eq("id", submissionId);

    if (cacheError) {
      return NextResponse.json({ error: cacheError.message }, { status: 400 });
    }

    return NextResponse.json({
      comment: review.comment,
      grade: review.grade,
      mark: review.mark,
      strengths: review.strengths,
      fixNext: review.fix_next,
      confidence: review.confidence,
      cached: false
    });
  } catch (error) {
    console.error("ai-feedback generation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate AI tutor feedback." },
      { status: 500 }
    );
  }
}
