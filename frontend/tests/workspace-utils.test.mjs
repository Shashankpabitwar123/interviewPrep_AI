import test from "node:test";
import assert from "node:assert/strict";

import {
  GENERATED_NOTES_FOLDER,
  READINESS_FORMULA,
  activityBelongsToPlan,
  buildGeneratedWorkspaceNote,
  combineReadinessReports,
  eventBelongsToPlan,
  filterArchived,
  isTaskCompleteForPlan,
  isUsableStudyNoteCacheEntry,
  normalizeCalendarEvent,
  normalizeNoteFolder,
  normalizeStudyNoteContent,
  normalizeWorkspaceNote,
  localTimeGreeting,
  prepDateForPlanDay,
  prepTimelineForPlan,
  reconcileExamAttempts,
  reconcileMockAttempts,
  resolveActiveJob,
  scorePercent,
  taskCompletionKey,
  upsertGeneratedWorkspaceNote,
} from "../src/workspace-utils.js";

test("active job selection prioritizes the explicit job over a stale plan", () => {
  const jobs = [{ id: 1 }, { id: 2 }];
  assert.equal(resolveActiveJob(jobs, 2, { job_post_id: 1 }).id, 2);
});

test("archived records are filtered with string-safe identifiers", () => {
  assert.deepEqual(filterArchived([{ id: 1 }, { id: 2 }], ["1"]), [{ id: 2 }]);
});

test("task completion keys cannot collide across prep plans", () => {
  const task = { id: "day-1-practice-exam" };
  const key = taskCompletionKey({ prep_plan_id: 10 }, task, "2026-08-20");
  const completed = { [key]: "2026-08-20" };
  assert.equal(isTaskCompleteForPlan({ prep_plan_id: 10 }, task, completed), true);
  assert.equal(isTaskCompleteForPlan({ prep_plan_id: 11 }, task, completed), false);
});

test("score values normalize from either zero-to-one or percentages", () => {
  assert.equal(scorePercent(0.82), 82);
  assert.equal(scorePercent(82), 82);
  assert.equal(scorePercent(undefined), null);
});

test("readiness reports retain the canonical formula when combined", () => {
  const report = combineReadinessReports([
    { score: 60, components: [{ key: "plan", label: "Plan completion", score: 50, weight: 0.3 }] },
    { score: 80, components: [{ key: "plan", label: "Plan completion", score: 100, weight: 0.3 }] },
  ]);
  assert.equal(report.score, 70);
  assert.equal(report.formula, READINESS_FORMULA);
  assert.equal(report.components.find((item) => item.key === "plan").value, 75);
});

test("calendar event aliases resolve to one prepPlanId field", () => {
  assert.equal(normalizeCalendarEvent({ planId: 7 }).prepPlanId, 7);
  assert.equal(eventBelongsToPlan({ prepPlanId: "7" }, 7), true);
});

test("activity without a plan or job identifier is not attributed to a selected plan", () => {
  const plan = { prep_plan_id: 7, job_post_id: 3 };
  assert.equal(activityBelongsToPlan({ prepPlanId: 7 }, plan), true);
  assert.equal(activityBelongsToPlan({ jobPostId: 3 }, plan), true);
  assert.equal(activityBelongsToPlan({ type: "exam" }, plan), false);
});

test("calendar dates remain anchored to the stored interview date", () => {
  const plan = { interview_at: "2026-08-30T17:00:00Z", days_until_interview: 10 };
  const first = prepDateForPlanDay(plan, 1, new Date("2026-08-20T12:00:00Z"));
  const refreshed = prepDateForPlanDay(plan, 1, new Date("2026-08-25T12:00:00Z"));
  assert.equal(first.toISOString(), refreshed.toISOString());
});

test("the full preparation timeline survives after its first dates pass", () => {
  const plan = {
    interview_at: "2026-08-30T17:00:00",
    days_until_interview: 10,
    tasks: [{ day: 1 }, { day: 10 }],
  };
  const original = prepTimelineForPlan(plan, new Date("2026-08-20T12:00:00"));
  const refreshed = prepTimelineForPlan(plan, new Date("2026-08-25T12:00:00"));
  assert.equal(original.length, 10);
  assert.equal(refreshed.length, 10);
  assert.equal(original[0].date.toISOString(), refreshed[0].date.toISOString());
  assert.equal(original[9].date.toISOString(), refreshed[9].date.toISOString());
  assert.equal(original[0].date.getDate(), 20);
  assert.equal(original[9].date.getDate(), 29);
});

test("greetings follow the browser's local time", () => {
  assert.equal(localTimeGreeting(new Date(2026, 7, 20, 8)), "Good morning");
  assert.equal(localTimeGreeting(new Date(2026, 7, 20, 14)), "Good afternoon");
  assert.equal(localTimeGreeting(new Date(2026, 7, 20, 20)), "Good evening");
});

test("backend exams restore missing workspace attempts and remove stale copies", () => {
  const local = [
    { id: "keep", exam: { id: 5 }, createdAt: "local-date" },
    { id: "stale", exam: { id: 6 } },
  ];
  const backend = [{
    exam: { id: 5, prep_plan_id: 9, day: 2 },
    status: "complete",
    average_score: 0.8,
    results: [],
    answers: { 1: "answer" },
    created_at: "server-date",
  }, { exam: { id: 7, prep_plan_id: 9, day: 3 }, status: "ready", created_at: "new-date" }];
  const reconciled = reconcileExamAttempts(local, backend, [{ id: 9, job_post_id: 4, job_title: "Engineer" }]);
  assert.deepEqual(reconciled.map((item) => item.exam.id), [5, 7]);
  assert.equal(reconciled[0].id, "keep");
  assert.equal(reconciled[0].score, 0.8);
  assert.equal(reconciled[1].jobPostId, 4);
});

test("scheduled mocks survive reconciliation while backend sessions are restored", () => {
  const local = [{ id: "scheduled", prepPlanId: 9, status: "ready" }];
  const backend = [{ id: 11, prep_plan_id: 9, status: "active", difficulty: "hard", question_count: 8, created_at: "server-date" }];
  const reconciled = reconcileMockAttempts(local, backend, [{ id: 9, job_post_id: 4, job_title: "Engineer" }]);
  assert.equal(reconciled[0].id, "scheduled");
  assert.equal(reconciled[1].id, "recovered-mock-11");
  assert.equal(reconciled[1].jobTitle, "Engineer");
});

const completeStudyNote = {
  title: "SQL joins",
  subtitle: "Applied interview preparation",
  role: "Data Analyst",
  topics: ["SQL"],
  summary: "Understand how joins combine related datasets.",
  sections: [{ title: "Core idea", body: "Choose a join from the relationship and required rows.", bullets: ["Validate row counts"] }],
  deep_dive: [],
  interview_questions: ["When would you use a left join?"],
  related_topics: ["Data validation"],
  resources: [],
  checklist: ["Explain one tradeoff"],
  source: "openai",
};

test("study-note cache is ready only when it contains complete renderable content", () => {
  assert.equal(isUsableStudyNoteCacheEntry({ content: completeStudyNote }), true);
  assert.equal(isUsableStudyNoteCacheEntry({ content: { title: "Incomplete" } }), false);
  assert.equal(normalizeStudyNoteContent({ title: "Incomplete" }), null);
});

test("generated notes stay in the automatic day-scoped folder and upsert idempotently", () => {
  const generated = buildGeneratedWorkspaceNote({
    content: completeStudyNote,
    task: { title: "Read notes: SQL joins" },
    cacheKey: "12:3:44",
    planId: 12,
    noteDate: "2026-08-23",
    createdAt: "first",
  });
  const first = upsertGeneratedWorkspaceNote([], generated);
  const updated = upsertGeneratedWorkspaceNote(first, { ...generated, body: "Updated", createdAt: "second" });

  assert.equal(generated.folder, GENERATED_NOTES_FOLDER);
  assert.equal(generated.noteDate, "2026-08-23");
  assert.equal(updated.length, 1);
  assert.equal(updated[0].body, "Updated");
  assert.equal(updated[0].createdAt, "first");
});

test("legacy generated notes migrate out of Study notes without creating an empty system folder", () => {
  assert.equal(normalizeNoteFolder("Generated notes"), GENERATED_NOTES_FOLDER);
  assert.equal(normalizeNoteFolder("Quick Notes"), "Study notes");
  assert.equal(normalizeWorkspaceNote({ generated: true, folder: "Study notes" }).folder, GENERATED_NOTES_FOLDER);
});
