import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const STUDENT_SESSION_COOKIE = "ts_student_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 14;

export type StudentSessionPayload = {
  studentId: string;
  role: "student";
  fullName: string;
  yearGroup: string | null;
  accessCode: string;
  issuedAt: number;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.TEACHING_SUCCESS_APP_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing TEACHING_SUCCESS_APP_SESSION_SECRET.");
  }
  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createStudentSessionToken(input: Omit<StudentSessionPayload, "issuedAt" | "expiresAt">) {
  const issuedAt = Date.now();
  const payload: StudentSessionPayload = {
    ...input,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_MS
  };
  const secret = getSessionSecret();
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(body, secret);
  return `${body}.${signature}`;
}

export function verifyStudentSessionToken(token?: string | null) {
  if (!token) return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const secret = getSessionSecret();
  const expected = signValue(body, secret);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(body)) as StudentSessionPayload;
  if (!payload?.studentId || payload.role !== "student") return null;
  if (payload.expiresAt <= Date.now()) return null;
  return payload;
}

export async function getStudentSessionFromCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDENT_SESSION_COOKIE)?.value ?? null;
  return verifyStudentSessionToken(token);
}

export function getStudentSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  };
}
