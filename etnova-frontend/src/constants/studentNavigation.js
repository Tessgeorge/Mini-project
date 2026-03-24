export const STUDENT_PAGE_ROUTE_BY_ID = {
  dashboard: "/student/dashboard",
  project: "/student/profile",
  team: "/student/team",
  ideas: "/student/ideas",
  submissions: "/student/submissions",
  discussion: "/student/chat",
  chat: "/student/chat",
  marks: "/student/marks",
};

export const STUDENT_NAV_ITEMS = [
  { to: "/student/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/student/profile", label: "Project Overview", icon: "folder_open" },
  { to: "/student/team", label: "Team", icon: "group" },
  { to: "/student/ideas", label: "Idea Workspace", icon: "lightbulb" },
  { to: "/student/submissions", label: "Submissions", icon: "upload_file" },
  { to: "/student/chat", label: "Discussion", icon: "forum" },
  { to: "/student/marks", label: "Marks", icon: "grading" },
];

export const STUDENT_QUICK_NAV_ITEMS = [
  { id: "project", icon: "folder_open", label: "Project Overview", color: "#00D2C4" },
  { id: "team", icon: "group", label: "Team", color: "#6366f1" },
  { id: "ideas", icon: "lightbulb", label: "Idea Workspace", color: "#f59e0b" },
  { id: "submissions", icon: "upload_file", label: "Submissions", color: "#10b981" },
  { id: "marks", icon: "grade", label: "Marks", color: "#f43f5e" },
];
