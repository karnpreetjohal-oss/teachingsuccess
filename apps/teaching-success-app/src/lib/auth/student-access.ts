import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

function normalizePin(pin: string) {
  return pin.replace(/\s+/g, "");
}

export function hashStudentPin(pin: string) {
  const normalized = normalizePin(pin);
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(normalized, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyStudentPin(pin: string, storedHash: string) {
  const normalized = normalizePin(pin);
  const [salt, hash] = String(storedHash).split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(normalized, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function normalizeAccessCode(accessCode: string) {
  return accessCode.trim().toUpperCase();
}

export function firstNameMatches(fullName: string | null | undefined, firstName: string | null | undefined) {
  if (!firstName) return true;
  const candidate = firstName.trim().toLowerCase();
  if (!candidate) return true;
  const actual = String(fullName || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  return candidate === actual;
}
