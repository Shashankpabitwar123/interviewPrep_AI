import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const approvedGuidedCss = readFileSync(new URL("../src/approved-guided.css", import.meta.url), "utf8");
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
  assert.match(modal, /Retry feedback/);
  assert.match(modal, /completionError/);
  assert.match(modal, /Your transcript is saved on this screen/);
  assert.doesNotMatch(modal, /<textarea/);
  assert.doesNotMatch(modal, /speechSynthesis/);
});

test("mobile workspaces contain menus, rails, forms, and long content", () => {
  const navigation = mainSource.slice(mainSource.indexOf("function GuidedTopNavigation"), mainSource.indexOf("function GuidedJobContextBar"));
  assert.match(navigation, /guided-profile-menu-backdrop/);
  assert.match(navigation, /role="menu"/);
  assert.match(navigation, /runProfileAction/);
  assert.match(approvedGuidedCss, /Mobile workspace containment/);
  assert.match(approvedGuidedCss, /@media \(max-width: 820px\)/);
  assert.match(approvedGuidedCss, /\.guided-plan-date-rail\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(approvedGuidedCss, /\.notes-date-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(approvedGuidedCss, /\.guided-job-modal\s*\{[^}]*max-height:\s*calc\(100dvh/s);
  assert.match(approvedGuidedCss, /\.guided-settings-anchor \.settings-popover[^}]*position:\s*fixed/s);
});
