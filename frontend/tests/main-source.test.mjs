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
