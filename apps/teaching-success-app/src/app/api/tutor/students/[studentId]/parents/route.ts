import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";
import { getTutorManagedStudent } from "@/lib/server/tutor-managed-student";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function buildTemporaryPassword() {
  return `TS${randomBytes(6).toString("hex")}!9`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    const body = await request.json();
    const fullName = String(body?.fullName || "").trim();
    const email = normalizeEmail(String(body?.email || ""));
    const password = String(body?.password || "").trim();

    if (!email) {
      return NextResponse.json({ error: "Parent email is required." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const student = await getTutorManagedStudent(admin, auth.profile.id, studentId);

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const { data: existingProfile, error: existingProfileError } = await admin
      .from("profiles")
      .select("id,email,full_name,role")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfileError) {
      return NextResponse.json({ error: existingProfileError.message }, { status: 400 });
    }

    if (existingProfile && existingProfile.role !== "parent") {
      return NextResponse.json(
        { error: "That email already belongs to a non-parent account." },
        { status: 400 }
      );
    }

    let parentId = existingProfile?.id || "";
    let action: "created" | "linked" | "already_linked" = existingProfile ? "linked" : "created";
    let issuedPassword: string | null = null;

    if (existingProfile) {
      if (fullName && !existingProfile.full_name) {
        const { error: parentProfileError } = await admin.from("profiles").upsert(
          {
            id: existingProfile.id,
            email,
            full_name: fullName,
            role: "parent"
          },
          {
            onConflict: "id"
          }
        );

        if (parentProfileError) {
          return NextResponse.json({ error: parentProfileError.message }, { status: 400 });
        }
      }
    } else {
      if (!fullName) {
        return NextResponse.json(
          { error: "Add the parent's full name when creating a new parent account." },
          { status: 400 }
        );
      }

      issuedPassword = password || buildTemporaryPassword();

      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password: issuedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          signup_role: "parent"
        },
        app_metadata: {
          role: "parent",
          provider: "email"
        }
      });

      if (createUserError || !createdUser.user) {
        return NextResponse.json(
          { error: createUserError?.message || "Could not create parent account." },
          { status: 400 }
        );
      }

      parentId = createdUser.user.id;

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: parentId,
          email,
          full_name: fullName,
          role: "parent"
        },
        {
          onConflict: "id"
        }
      );

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    const { data: link, error: linkError } = await admin
      .from("parent_student_links")
      .insert({
        parent_id: parentId,
        student_id: studentId
      })
      .select(`
        id,
        created_at,
        parent:profiles!parent_student_links_parent_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .maybeSingle();

    if (linkError && !linkError.message.includes("parent_student_links_parent_id_student_id_key")) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    if (linkError) {
      action = "already_linked";
    }

    const parentRecord = Array.isArray(link?.parent) ? link.parent[0] : link?.parent;

    return NextResponse.json({
      ok: true,
      action,
      student: {
        id: student.id,
        fullName: student.full_name || student.email || "Student"
      },
      parent: {
        id: parentId,
        fullName: parentRecord?.full_name || existingProfile?.full_name || fullName || null,
        email: parentRecord?.email || existingProfile?.email || email
      },
      linkId: link?.id || null,
      issuedPassword
    });
  } catch (error) {
    console.error("parent link create failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not link parent." },
      { status: 500 }
    );
  }
}
