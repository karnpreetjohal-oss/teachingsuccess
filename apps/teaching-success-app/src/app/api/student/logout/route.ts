import { NextResponse } from "next/server";

import { getStudentSessionCookieOptions, STUDENT_SESSION_COOKIE } from "@/lib/auth/student-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STUDENT_SESSION_COOKIE, "", {
    ...getStudentSessionCookieOptions(),
    maxAge: 0
  });
  return response;
}
