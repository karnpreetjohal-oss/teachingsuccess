import { KeyRound, ShieldCheck } from "lucide-react";

import { AdultLoginCard } from "@/components/adult-login-card";
import { StudentPinLoginCard } from "@/components/student-pin-login-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectIfAuthenticated } from "@/lib/server/account-session";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,rgba(44,58,82,0.98),rgba(58,95,149,0.9))] px-6 py-8 text-white shadow-soft md:px-8 md:py-10">
        <Badge variant="gold" className="mb-4">
          Teaching Success
        </Badge>
        <h1 className="max-w-3xl font-display text-5xl font-black leading-tight md:text-6xl">
          Sign in to your student, parent, or tutor account.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">
          Students use their access code and PIN. Parents and tutors sign in with their Teaching Success email and password.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
        <StudentPinLoginCard />

        <div className="grid gap-4">
          <AdultLoginCard />

          <Card>
            <CardHeader>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/16 text-brand-blue">
                <KeyRound className="h-6 w-6" />
              </div>
              <CardTitle>Student sign-in</CardTitle>
              <CardDescription>Use the access code and PIN shared by your tutor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-brand-muted">
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
                Ask your tutor for your access code if you cannot remember it.
              </div>
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
                If asked, enter your first name exactly as it appears on your account.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/16 text-brand-green">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <CardTitle>Parent and tutor sign-in</CardTitle>
              <CardDescription>Use the email linked to your Teaching Success account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-7 text-brand-muted">
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
                Parents can view linked children, homework updates, feedback, reports, and curriculum progress.
              </div>
              <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
                Tutors can assign work, manage PIN access, review uploads, and publish feedback.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
