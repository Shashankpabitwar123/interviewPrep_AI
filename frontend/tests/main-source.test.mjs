import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const appSource = mainSource.slice(mainSource.indexOf("function App()"), mainSource.indexOf("function GuidedTopNavigation"));

test("study-note save paths never use an undeclared selectedJob variable", () => {
  assert.doesNotMatch(appSource, /prepDateForDay\([^\n]+,\s*selectedJob\s*,/);
  assert.match(appSource, /resolveJobForPlan\(jobs,\s*plan,\s*selectedJobId\)/);
});

test("Notes builds its date timeline from the selected job and active plan", () => {
  assert.match(mainSource, /buildGuidedPreparationDays\(selectedJob,\s*activePlan\)/);
  assert.doesNotMatch(mainSource, /buildGuidedPreparationDays\(groupTasksByDay/);
});

test("active job context renders role, company, and interview timing separately", () => {
  const contextBar = mainSource.slice(mainSource.indexOf("function GuidedJobContextBar"), mainSource.indexOf("function TypedBriefing"));
  assert.match(contextBar, /className="guided-job-role"/);
  assert.match(contextBar, /guided-job-company/);
  assert.match(contextBar, /className="guided-job-interview"/);
  assert.doesNotMatch(contextBar, /\$\{role\} at \$\{company\}/);
});

test("captured page-title chrome is normalized before display", () => {
  assert.match(mainSource, /function normalizeJobIdentityForDisplay/);
  assert.match(mainSource, /by clicking\|continue to/);
});

test("mock interview is voice-only and uses the secure Realtime backend", () => {
  const modal = mainSource.slice(mainSource.indexOf("function MockInterviewModal"), mainSource.indexOf("function MockReviewModal"));
  assert.match(mainSource, /createRealtimeInterviewConnection/);
  assert.match(modal, /Live .* mock interview/);
  assert.match(modal, /Repeat/);
  assert.match(modal, /Clarify/);
  assert.match(modal, /End interview/);
  assert.doesNotMatch(modal, /<textarea/);
  assert.doesNotMatch(modal, /speechSynthesis/);
});
