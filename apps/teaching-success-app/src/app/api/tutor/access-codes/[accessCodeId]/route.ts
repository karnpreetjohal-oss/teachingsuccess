import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accessCodeId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const { accessCodeId } = await params;
    const { isActive, expiresAt } = await request.json();
    const updates: { is_active?: boolean; expires_at?: string | null } = {};

    if (typeof isActive === "boolean") {
      updates.is_active = isActive;
    }
    if (expiresAt !== undefined) {
      updates.expires_at = expiresAt === "" ? null : expiresAt || null;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No changes were supplied." }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("student_access_codes")
      .update(updates)
      .eq("id", accessCodeId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("access-code update failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update access code." },
      { status: 500 }
    );
  }
}
