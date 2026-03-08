export const studentToday = {
  studentName: "Aisha",
  currentAssignment: {
    id: "surds-recall",
    title: "Surds and index laws recall",
    subject: "Maths",
    yearGroup: "Year 11",
    examBoard: "Edexcel",
    topic: "Algebra / Surds",
    dueLabel: "Due today at 6:00 PM"
  },
  latestFeedback: {
    score: "78%",
    title: "Latest AI feedback",
    strengths: [
      "Strong method choice on simplifying surds",
      "Accurate substitution in the first two questions"
    ],
    nextStep: "Redo questions 4 and 5 with cleaner working and bracket handling."
  },
  progress: [
    { label: "Assignments done", value: "12", helper: "last 30 days", tone: "blue" },
    { label: "Redo completion", value: "83%", helper: "5 of 6 redos finished", tone: "green" },
    { label: "Priority topics", value: "2", helper: "surds, quadratic graphs", tone: "amber" }
  ]
};

export const studentPracticeTasks = [
  {
    title: "Redo: surds simplification",
    type: "Redo worksheet",
    status: "Needs redo",
    summary: "4 scaffolded questions matched to today's errors."
  },
  {
    title: "Mixed retrieval warm-up",
    type: "Follow-up task",
    status: "Not started",
    summary: "Short fluency set covering indices, fractions, and surds."
  },
  {
    title: "Challenge extension",
    type: "Stretch",
    status: "Completed",
    summary: "One exam-style reasoning question with model answer."
  }
];

export const studentProgressTopics = [
  { label: "Algebra", status: "Secure" },
  { label: "Surds", status: "Developing" },
  { label: "Quadratics", status: "Needs focus" },
  { label: "Ratio", status: "Secure" }
];

export const parentOverview = {
  childName: "Aisha Johal",
  metrics: [
    { label: "Average score", value: "81%", helper: "last 6 marked tasks", tone: "green" },
    { label: "Tasks completed", value: "14", helper: "this half term", tone: "blue" },
    { label: "Redo completion", value: "75%", helper: "3 of 4 finished", tone: "amber" },
    { label: "Needs attention", value: "2", helper: "surds, graph accuracy", tone: "red" }
  ],
  activity: [
    "AI marked today's maths upload and generated a redo task.",
    "Tutor review published for Spring Term 2 with a target grade of 7.",
    "English homework was submitted on time and marked secure."
  ]
};

export const parentHomeworkRows = [
  { title: "Surds and index laws recall", subject: "Maths", status: "Submitted", next: "Awaiting tutor approval" },
  { title: "Macbeth quotation retrieval", subject: "English", status: "Marked", next: "Redo complete" },
  { title: "Required practical write-up", subject: "Biology", status: "Assigned", next: "Due Thursday" }
];

export const parentMistakeRows = [
  { topic: "Surds", mistake: "Dropped brackets when expanding", redo: "Redo assigned", improvement: "Pending" },
  { topic: "Quadratic graphs", mistake: "Inaccurate turning point plotting", redo: "Redo completed", improvement: "+18%" },
  { topic: "Macbeth analysis", mistake: "AO2 language comments too brief", redo: "Practice task generated", improvement: "Tutor review due" }
];

export const parentCurriculumRows = [
  { subject: "Maths", unit: "Algebra and graphs", status: "Developing" },
  { subject: "English", unit: "Macbeth essay planning", status: "Secure" },
  { subject: "Biology", unit: "Required practicals", status: "Needs focus" }
];

export const tutorDashboard = {
  metrics: [
    { label: "Uploads waiting", value: "7", helper: "needs AI/tutor review", tone: "amber" },
    { label: "AI marks today", value: "12", helper: "drafts generated", tone: "blue" },
    { label: "At-risk students", value: "3", helper: "two or more redos overdue", tone: "red" },
    { label: "Reports due", value: "5", helper: "this week", tone: "green" }
  ],
  queue: [
    { student: "Aisha", title: "Surds and index laws recall", state: "AI draft ready" },
    { student: "Haroon", title: "AQA Language Paper 1 Q2", state: "Tutor approval needed" },
    { student: "Maya", title: "Y6 arithmetic speed test", state: "Missing photos" }
  ]
};

export const tutorStudents = [
  { name: "Aisha Johal", yearGroup: "Year 11", subjects: "Maths, English", examBoard: "Edexcel / AQA", parent: "N. Johal" },
  { name: "Maya Kaur", yearGroup: "Year 6", subjects: "Maths, English", examBoard: "Primary", parent: "R. Kaur" },
  { name: "Haroon Ali", yearGroup: "Year 11", subjects: "English", examBoard: "AQA", parent: "S. Ali" }
];

export const tutorReports = [
  { student: "Aisha Johal", summary: "Maths confidence improving, surds still inconsistent.", due: "Today" },
  { student: "Maya Kaur", summary: "Reading comprehension secure, inference still developing.", due: "Tomorrow" },
  { student: "Haroon Ali", summary: "AO2 analysis improving after scaffolded feedback.", due: "Friday" }
];
