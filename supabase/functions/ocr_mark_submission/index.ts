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
      .select("id,automark_enabled,automark_keywords,automark_target_words")
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

    if (assignment.automark_enabled) {
      const result = calculateAutoMark(
        combined,
        assignment.automark_keywords || [],
        assignment.automark_target_words || null,
      );
      autoMark = result.score;
      autoGrade = result.grade;
      autoFeedback = result.feedback;
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
