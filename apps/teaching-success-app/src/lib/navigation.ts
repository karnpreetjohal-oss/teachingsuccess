export type NavIcon =
  | "home"
  | "upload"
  | "practice"
  | "progress"
  | "homework"
  | "mistakes"
  | "reports"
  | "curriculum"
  | "students"
  | "assign"
  | "review";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

export const studentNav: NavItem[] = [
  { href: "/student", label: "Today", icon: "home" },
  { href: "/student/upload", label: "Upload", icon: "upload" },
  { href: "/student/practice", label: "Redo", icon: "practice" },
  { href: "/student/progress", label: "Progress", icon: "progress" }
];

export const parentNav: NavItem[] = [
  { href: "/parent", label: "Dashboard", icon: "home" },
  { href: "/parent/homework", label: "Homework", icon: "homework" },
  { href: "/parent/mistakes", label: "Mistakes", icon: "mistakes" },
  { href: "/parent/reports", label: "Reports", icon: "reports" },
  { href: "/parent/curriculum", label: "Curriculum", icon: "curriculum" }
];

export const tutorNav: NavItem[] = [
  { href: "/tutor", label: "Dashboard", icon: "home" },
  { href: "/tutor/students", label: "Students", icon: "students" },
  { href: "/tutor/assignments/new", label: "Assign", icon: "assign" },
  { href: "/tutor/submissions", label: "Review", icon: "review" },
  { href: "/tutor/reports", label: "Reports", icon: "reports" }
];
