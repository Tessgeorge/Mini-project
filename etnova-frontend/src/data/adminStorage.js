const MENTORS_KEY = "etnova_admin_mentors";
const TEAMS_KEY = "etnova_admin_allocation_teams";
const REVIEW_STAGES_KEY = "etnova_admin_review_stages";

export const DEFAULT_MENTORS = [
  {
    id: 1,
    name: "Dr. Anil Kumar",
    email: "anil@college.edu",
    roles: ["Guide"],
    assignedTeams: 1,
    status: "Active",
  },
  {
    id: 2,
    name: "Dr. Meera Thomas",
    email: "meera@college.edu",
    roles: ["Guide", "Coordinator"],
    assignedTeams: 2,
    status: "Active",
  },
  {
    id: 3,
    name: "Dr. Rahul Menon",
    email: "rahul@college.edu",
    roles: ["Evaluator"],
    assignedTeams: 0,
    status: "Inactive",
  },
  {
    id: 4,
    name: "Dr. Neha Iyer",
    email: "neha@college.edu",
    roles: ["Evaluator", "Coordinator"],
    assignedTeams: 0,
    status: "Active",
  },
];

export const DEFAULT_GUIDES = [
  { id: 1, name: "Dr. Anil Kumar", email: "anil@college.edu", assigned: 0 },
  { id: 2, name: "Dr. Meera Thomas", email: "meera@college.edu", assigned: 0 },
  { id: 3, name: "Dr. Rahul Menon", email: "rahul@college.edu", assigned: 0 },
  { id: 4, name: "Dr. Neha Iyer", email: "neha@college.edu", assigned: 0 },
];

export const DEFAULT_TEAMS = [
  { id: 1, name: "Smart Energy Meter", class: "S6 CSE A", stage: "0th Review", submissionStatus: "Pending", guide: null },
  { id: 2, name: "AI Attendance System", class: "S6 CSE A", stage: "0th Review", submissionStatus: "Late", guide: null },
  { id: 3, name: "IoT Lab Automation", class: "S6 CSE B", stage: "1st Review", submissionStatus: "Submitted", guide: null },
  { id: 4, name: "Campus Navigation Bot", class: "S6 CSE B", stage: "1st Review", submissionStatus: "Pending", guide: null },
  { id: 5, name: "Academic Query Assistant", class: "S6 CSE A", stage: "Final Review", submissionStatus: "Submitted", guide: null },
];

export const DEFAULT_REVIEW_STAGES = [
  {
    id: 1,
    name: "Abstract",
    status: "Inactive",
    submissions: 24,
    deadline: "2026-03-20T17:00:00",
    classDeadlines: {
      "S6 CSE A": "2026-03-18T09:00:00",
      "S6 CSE B": "2026-03-19T09:00:00",
    },
    mentorMarksDeadline: "2026-03-20T17:00:00",
  },
  {
    id: 2,
    name: "0th Review",
    status: "Inactive",
    submissions: 18,
    deadline: "2026-04-05T17:00:00",
    classDeadlines: {
      "S6 CSE A": "2026-04-03T10:00:00",
      "S6 CSE B": "2026-04-04T10:00:00",
    },
    mentorMarksDeadline: "2026-04-05T17:00:00",
  },
  {
    id: 3,
    name: "1st Review",
    status: "Inactive",
    submissions: 0,
    deadline: "2026-04-22T17:00:00",
    classDeadlines: {
      "S6 CSE A": "2026-04-20T10:00:00",
      "S6 CSE B": "2026-04-21T10:00:00",
    },
    mentorMarksDeadline: "2026-04-22T17:00:00",
  },
  {
    id: 4,
    name: "2nd Review",
    status: "Inactive",
    submissions: 0,
    deadline: "2026-05-12T17:00:00",
    classDeadlines: {
      "S6 CSE A": "2026-05-10T10:00:00",
      "S6 CSE B": "2026-05-11T10:00:00",
    },
    mentorMarksDeadline: "2026-05-12T17:00:00",
  },
  {
    id: 5,
    name: "Final Review",
    status: "Inactive",
    submissions: 0,
    deadline: "2026-06-08T17:00:00",
    classDeadlines: {
      "S6 CSE A": "2026-06-06T10:00:00",
      "S6 CSE B": "2026-06-07T10:00:00",
    },
    mentorMarksDeadline: "2026-06-08T17:00:00",
  },
];

function loadJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadMentors() {
  return loadJSON(MENTORS_KEY, DEFAULT_MENTORS);
}

export function saveMentors(mentors) {
  saveJSON(MENTORS_KEY, mentors);
}

export function loadAllocationTeams() {
  const teams = loadJSON(TEAMS_KEY, DEFAULT_TEAMS);
  return teams.map((team) => ({
    ...team,
    stage: team.stage || "0th Review",
    submissionStatus: team.submissionStatus || "Pending",
  }));
}

export function saveAllocationTeams(teams) {
  saveJSON(TEAMS_KEY, teams);
}

function normalizeReviewStages(stages) {
  return stages.map((stage) => {
    const normalizedStatus = stage.status === "Upcoming" ? "Inactive" : stage.status;
    const fallback = stage.deadline || stage.mentorMarksDeadline || "2026-01-01T09:00:00";
    if (stage.classDeadlines && stage.mentorMarksDeadline && stage.deadline) {
      return { ...stage, status: normalizedStatus };
    }
    return {
      ...stage,
      status: normalizedStatus,
      deadline: stage.deadline || stage.mentorMarksDeadline || fallback,
      manuallyUnlocked: Boolean(stage.manuallyUnlocked),
      classDeadlines: stage.classDeadlines || {
        "S6 CSE A": fallback,
        "S6 CSE B": fallback,
      },
      mentorMarksDeadline: stage.mentorMarksDeadline || fallback,
    };
  });
}

export function loadReviewStages() {
  const stages = loadJSON(REVIEW_STAGES_KEY, DEFAULT_REVIEW_STAGES);
  return normalizeReviewStages(stages);
}

export function saveReviewStages(stages) {
  saveJSON(REVIEW_STAGES_KEY, stages);
}
