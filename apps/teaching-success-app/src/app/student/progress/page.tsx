import { PageIntro } from "@/components/page-intro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLatestStudentReview, getStudentProgressData } from "@/lib/server/student-data";

function masteryLabel(rating: string) {
  if (rating === "secure") return "Secure";
  if (rating === "not_yet") return "Needs focus";
  return "Developing";
}

function topicVariant(rating: string) {
  if (rating === "secure") return "green";
  if (rating === "not_yet") return "red";
  return "amber";
}

export default async function StudentProgressPage() {
  const [{ submissions, mastery }, latestReview] = await Promise.all([
    getStudentProgressData(),
    getLatestStudentReview()
  ]);
  const trendPoints = [...submissions]
    .slice()
    .reverse()
    .map((submission, index) => ({
      key: submission.id,
      label: `W${index + 1}`,
      mark: Number(submission.auto_mark || 0)
    }));

  return (
    <>
      <PageIntro
        eyebrow="My progress"
        title="Track recent marks and topic strengths."
        description="See your latest marked work, the topics you feel secure on, and the areas that need more practice."
      />

      <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Trend snapshot</CardTitle>
            <CardDescription>Your most recent marked submissions, shown as a simple score trend.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {trendPoints.length ? (
              <div className="flex h-64 items-end gap-3 rounded-[26px] bg-[linear-gradient(180deg,rgba(74,111,165,0.12),rgba(255,255,255,0.7))] p-4">
                {trendPoints.map((point) => (
                  <div key={point.key} className="flex flex-1 flex-col justify-end gap-2">
                    <div className="rounded-t-2xl bg-brand-blue/80" style={{ height: `${Math.max(point.mark, 8)}%` }} />
                    <p className="text-center text-xs font-semibold text-brand-muted">{point.label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[26px] border border-brand-line bg-brand-surface px-5 py-8 text-sm leading-7 text-brand-muted">
                No marked submissions yet. As soon as OCR or tutor marking finishes, the trend chart will begin to fill.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Topic status</CardTitle>
            <CardDescription>Recent topic updates from your tutor and marked work.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {mastery.length ? (
              mastery.map((topic) => {
                const objective = Array.isArray(topic.curriculum_objectives)
                  ? topic.curriculum_objectives[0]
                  : topic.curriculum_objectives;

                return (
                  <div
                    key={`${objective?.objective_id || "objective"}-${topic.updated_at}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white px-4 py-4"
                  >
                    <div>
                      <p className="font-semibold text-brand-ink">{objective?.objective_text || "Curriculum objective"}</p>
                      <p className="text-sm text-brand-muted">{objective?.subject || "Subject"}</p>
                    </div>
                    <Badge variant={topicVariant(topic.rating) as "green" | "red" | "amber"}>
                      {masteryLabel(topic.rating)}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-muted">
                Topic updates will appear here as soon as your tutor records them.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {latestReview ? (
        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">Latest tutor review</Badge>
                <Badge variant="blue">{latestReview.predicted_grade}</Badge>
                {latestReview.confidence_pct !== null ? (
                  <Badge variant="neutral">{Number(latestReview.confidence_pct)}% confidence</Badge>
                ) : null}
              </div>
              <CardTitle>{latestReview.period_label || "Current review"}</CardTitle>
              <CardDescription>The latest tutor review sits alongside the automated progress signals.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Doing well</p>
                <p className="mt-1">{latestReview.doing_well || "No strengths summary yet."}</p>
              </div>
              <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/10 px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Needs help</p>
                <p className="mt-1">{latestReview.needs_help || "No focus note yet."}</p>
              </div>
              <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Action plan</p>
                <p className="mt-1">{latestReview.action_plan || "The tutor plan will appear here."}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
