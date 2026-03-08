import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { hashStudentPin, normalizeAccessCode } from "@/lib/auth/student-access";
import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function buildGeneratedStudentEmail(fullName: string) {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return `${slug || "student"}-${Date.now().toString(36)}@students.teachingsuccess.app`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeYearGroup(value: string) {
  return value.trim();
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const yearGroup = normalizeYearGroup(String(body?.yearGroup || ""));
    const emailInput = normalizeEmail(String(body?.email || ""));
    const accessCode = normalizeAccessCode(String(body?.accessCode || ""));
    const pin = String(body?.pin || "").trim();
    const expiresAt = String(body?.expiresAt || "").trim();
    const rotateExisting = body?.rotateExisting !== false;

    if (!fullName || !yearGroup || !accessCode || !pin) {
      return NextResponse.json(
        { error: "Full name, year group, access code, and PIN are required." },
        { status: 400 }
      );
    }

    if (!/^\d{4,8}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 4 to 8 digits." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const email = emailInput || buildGeneratedStudentEmail(fullName);

    const { data: existingProfile, error: existingProfileError } = emailInput
      ? await admin
          .from("profiles")
          .select("id,email,full_name,role,year_group")
          .ilike("email", email)
          .maybeSingle()
      : { data: null, error: null };

    if (existingProfileError) {
      return NextResponse.json({ error: existingProfileError.message }, { status: 400 });
    }

    if (existingProfile && existingProfile.role !== "student") {
      return NextResponse.json(
        { error: "That email already belongs to a non-student account." },
        { status: 400 }
      );
    }

    let studentId = existingProfile?.id || "";
    let action: "created" | "updated" = existingProfile ? "updated" : "created";

    if (existingProfile) {
      const { error: updateUserError } = await admin.auth.admin.updateUserById(existingProfile.id, {
        email,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          signup_role: "student",
          year_group: yearGroup
        },
        app_metadata: {
          role: "student",
          provider: "email"
        }
      });

      if (updateUserError) {
        return NextResponse.json({ error: updateUserError.message }, { status: 400 });
      }
    } else {
      const password = randomBytes(18).toString("base64url");
      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          signup_role: "student",
          year_group: yearGroup
        },
        app_metadata: {
          role: "student",
          provider: "email"
        }
      });

      if (createUserError || !createdUser.user) {
        return NextResponse.json(
          { error: createUserError?.message || "Could not create student account." },
          { status: 400 }
        );
      }

      studentId = createdUser.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: studentId,
        email,
        full_name: fullName,
        role: "student",
        year_group: yearGroup
      },
      {
        onConflict: "id"
      }
    );

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (rotateExisting) {
      const { error: deactivateError } = await admin
        .from("student_access_codes")
        .update({ is_active: false })
        .eq("student_id", studentId)
        .eq("is_active", true);

      if (deactivateError) {
        return NextResponse.json({ error: deactivateError.message }, { status: 400 });
      }
    }

    const { data: accessCodeRow, error: accessCodeError } = await admin
      .from("student_access_codes")
      .insert({
        student_id: studentId,
        access_code: accessCode,
        pin_hash: hashStudentPin(pin),
        expires_at: expiresAt || null,
        created_by: auth.profile.id
      })
      .select(`
        id,
        student_id,
        access_code,
        is_active,
        expires_at,
        last_used_at,
        created_at,
        student:profiles!student_access_codes_student_id_fkey (
          id,
          full_name,
          email,
          year_group
        )
      `)
      .single();

    if (accessCodeError) {
      const detail =
        accessCodeError.message.includes("student_access_codes_access_code_key")
          ? "That access code is already in use."
          : accessCodeError.message;
      return NextResponse.json({ error: detail }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      action,
      student: {
        id: studentId,
        fullName,
        yearGroup,
        email: emailInput ? email : null
      },
      accessCode: {
        id: accessCodeRow.id,
        accessCode: accessCodeRow.access_code,
        expiresAt: accessCodeRow.expires_at,
        isActive: accessCodeRow.is_active
      },
      usesPinLoginOnly: !emailInput
    });
  } catch (error) {
    console.error("student create failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create student." },
      { status: 500 }
    );
  }
}
