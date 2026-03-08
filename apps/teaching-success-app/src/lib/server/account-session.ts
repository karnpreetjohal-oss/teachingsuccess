import { redirect } from "next/navigation";

import { getStudentSessionFromCookies } from "@/lib/auth/student-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "student" | "parent" | "tutor";
  year_group: string | null;
};

export async function getAuthenticatedSupabaseProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,year_group")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  return {
    supabase,
    user,
    profile: profile as AppProfile
  };
}

export async function requireSupabaseRole(role: "parent" | "tutor") {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== role) {
    redirect("/login");
  }
  return auth;
}

export async function redirectIfAuthenticated() {
  const studentSession = await getStudentSessionFromCookies();
  if (studentSession) {
    redirect("/student");
  }

  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth) {
    return;
  }

  if (auth.profile.role === "parent") {
    redirect("/parent");
  }

  if (auth.profile.role === "tutor") {
    redirect("/tutor");
  }
}
