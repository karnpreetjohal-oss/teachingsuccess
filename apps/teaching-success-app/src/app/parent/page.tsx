import { PageIntro } from "@/components/page-intro";
import { StatCard } from "@/components/stat-card";
import { getParentDataBundle, getSubmissionScore, getSubmissionSummary, labelStudent } from "@/lib/server/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParentDashboardPage() {
  const { linkedStudents, assignments, reviews } = await getParentDataBundle({
    assignments: true,
    reviews: true
  });

  const latestSubmissions = assignments
    .flatMap((assignment) =>
      assignment.submissions.map((submission) => ({
        submission,
        assignment,
        student: assignment.student
      }))
    )
    .sort((a, b) => new Date(b.submission.submitted_at).getTime() - new Date(a.submission.submitted_at).getTime());

  const markedSubmissions = latestSubmissions.filter(({ submission }) => getSubmissionScore(submission) !== null);
  const averageScore = markedSubmissions.length
    ? Math.round(
        markedSubmissions.reduce((sum, entry) => sum + Number(getSubmissionScore(entry.submission) || 0), 0) /
          markedSubmissions.length
      )
    : null;

  const metrics = [
    {
      label: "Linked children",
      value: String(linkedStudents.length),
      helper: linkedStudents.length ? "active parent links" : "no children linked yet",
      tone: "blue"
    },
    {
      label: "Average score",
      value: averageScore === null ? "No marks yet" : `${averageScore}%`,
      helper: averageScore === null ? "awaiting marked work" : "across marked submissions",
      tone: averageScore === null ? "amber" : "green"
    },
    {
      label: "Tasks completed",
      value: String(assignments.filter((assignment) => assignment.status === "marked" || assignment.status === "completed").length),
      helper: "marked or completed assignments",
      tone: "green"
    },
    {
      label: "Needs attention",
      value: String(
        markedSubmissions.filter(({ submission }) => {
          const score = getSubmissionScore(submission);
          return score !== null && score < 70;
        }).length
      ),
      helper: "latest results under 70%",
      tone: "red"
    }
  ];

  const priorities = [
    ...reviews.slice(0, 2).map((review) => ({
      title: `${labelStudent(review.student)}: ${review.period_label || "Latest tutor review"}`,
      body: review.action_plan || review.needs_help || review.doing_well || "A new review has been published."
    })),
    ...markedSubmissions
      .filter(({ submission }) => {
        const score = getSubmissionScore(submission);
        return score !== null && score < 75;
      })
      .slice(0, 2)
      .map(({ assignment, submission, student }) => ({
        title: `${labelStudent(student)}: ${assignment.title}`,
        body: getSubmissionSummary(submission)
      }))
  ].slice(0, 4);

  const activity = [
    ...reviews.map((review) => ({
      id: review.id,
      time: review.created_at,
      text: `${labelStudent(review.student)}: ${review.period_label || "Tutor review"} published with predicted grade ${review.predicted_grade}.`
    })),
    ...latestSubmissions.slice(0, 6).map(({ assignment, submission, student }) => {
      const score = getSubmissionScore(submission);
      return {
        id: submission.id,
        time: submission.submitted_at,
        text:
          score === null
            ? `${labelStudent(student)} submitted ${assignment.title} and it is awaiting marking.`
            : `${labelStudent(student)} received ${score}% on ${assignment.title}.`
      };
    })
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  return (
    <>
      <PageIntro
        eyebrow="Parent dashboard"
        title={linkedStudents.length ? "Track progress without digging through detail first." : "Link a child to start the parent dashboard."}
        description="See the latest progress, current priorities, and recent activity across your linked children."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} helper={item.helper} tone={item.tone as "blue" | "green" | "amber" | "red"} />
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        {linkedStudents.length ? (
          linkedStudents.map((student) => (
            <Badge key={student.id} variant="gold">
              {labelStudent(student)}
              {student.year_group ? ` • ${student.year_group}` : ""}
            </Badge>
          ))
        ) : (
          <Badge variant="amber">No linked students yet</Badge>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <Badge variant="gold" className="w-fit">
              Current priorities
            </Badge>
            <CardTitle>What to focus on next</CardTitle>
            <CardDescription>Keep this short enough for a busy parent to scan in one minute.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-brand-muted">
            {priorities.length ? (
              priorities.map((item) => (
                <div key={`${item.title}-${item.body}`} className="rounded-2xl border border-brand-line bg-white px-4 py-4">
                  <p className="font-semibold text-brand-ink">{item.title}</p>
                  <p className="mt-1">{item.body}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-brand-line bg-white px-4 py-4">
                No current priorities yet. Once work is assigned or marked, the main next steps will appear here.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity feed</CardTitle>
            <CardDescription>Latest uploads, marks, reviews, and generated redos in one place.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                  {item.text}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                No recent activity yet. This feed will populate as soon as linked students start receiving assignments and reviews.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
