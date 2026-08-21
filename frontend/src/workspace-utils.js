export const READINESS_FORMULA = "25% plan + 15% learning + 25% role mastery + 20% exams + 10% mock interviews + 5% consistency";
export const GENERATED_NOTES_FOLDER = "Generated notes";

export function emptyReadinessReport() {
  return {
    score: 0,
    formula: READINESS_FORMULA,
    components: [
      { key: "plan", label: "Plan completion", value: 0, weight: 0.25 },
      { key: "learning", label: "Learning", value: 0, weight: 0.15 },
      { key: "competencies", label: "Role mastery", value: 0, weight: 0.25 },
      { key: "exams", label: "Exam performance", value: 0, weight: 0.20 },
      { key: "mocks", label: "Mock interviews", value: 0, weight: 0.10 },
      { key: "consistency", label: "Consistency", value: 0, weight: 0.05 },
    ],
  };
}

export function idsMatch(left, right) {
  return left !== undefined && left !== null && right !== undefined && right !== null
    && String(left) === String(right);
}

export function filterArchived(records, archivedIds, idForRecord = (record) => record.id) {
  const hidden = new Set((archivedIds || []).map(String));
  return (records || []).filter((record) => !hidden.has(String(idForRecord(record))));
}

export function resolveActiveJob(jobs, activeJobId, activePlan) {
  return (jobs || []).find((job) => idsMatch(job.id, activeJobId))
    || (jobs || []).find((job) => idsMatch(job.id, activePlan?.job_post_id))
    || jobs?.[0]
    || null;
}

export function resolveJobForPlan(jobs, plan, activeJobId) {
  const planJobId = plan?.job_post_id ?? plan?.job_id;
  return (jobs || []).find((job) => idsMatch(job.id, planJobId))
    || resolveActiveJob(jobs, activeJobId, plan);
}

export function planTaskIdentity(plan, task) {
  const planId = plan?.prep_plan_id || plan?.id || plan?.job_post_id || "unscoped";
  const taskId = task?.serverTaskId || task?.id || task?.title || "task";
  return `${planId}:${taskId}`;
}

export function taskCompletionKey(plan, task, completedOn) {
  return `${completedOn}:plan:${plan?.prep_plan_id || plan?.id || plan?.job_post_id || "unscoped"}:task:${task?.serverTaskId || task?.id || task?.title || "task"}`;
}

export function isTaskCompleteForPlan(plan, task, completedTasks) {
  if (task?.status === "complete") return true;
  const planId = String(plan?.prep_plan_id || plan?.id || plan?.job_post_id || "unscoped");
  const taskId = String(task?.serverTaskId || task?.id || task?.title || "task");
  const scopedSuffix = `:plan:${planId}:task:${taskId}`;
  return Object.entries(completedTasks || {}).some(([key, value]) => key.endsWith(scopedSuffix) && Boolean(value));
}

export function scorePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric <= 1 ? numeric * 100 : numeric)));
}

export function normalizeReadinessReport(report) {
  if (!report) return null;
  return {
    ...report,
    formula: report.formula || READINESS_FORMULA,
    components: (report.components || []).map((component) => ({
      ...component,
      value: scorePercent(component.score ?? component.value) ?? 0,
    })),
  };
}

export function combineReadinessReports(reports) {
  const normalized = (reports || []).map(normalizeReadinessReport).filter(Boolean);
  if (!normalized.length) {
    return emptyReadinessReport();
  }
  const componentKeys = ["plan", "learning", "competencies", "exams", "mocks", "consistency"];
  const components = componentKeys.map((key) => {
    const matching = normalized
      .flatMap((report) => report.components)
      .filter((component) => component.key === key);
    const template = matching[0] || { key, label: key, weight: 0 };
    return {
      ...template,
      value: matching.length
        ? Math.round(matching.reduce((sum, component) => sum + component.value, 0) / matching.length)
        : 0,
    };
  });
  return {
    score: Math.round(normalized.reduce((sum, report) => sum + Number(report.score || 0), 0) / normalized.length),
    formula: READINESS_FORMULA,
    components,
  };
}

export function normalizeCalendarEvent(event, fallback = {}) {
  return {
    ...event,
    jobPostId: event?.jobPostId ?? event?.job_post_id ?? fallback.jobPostId,
    prepPlanId: event?.prepPlanId ?? event?.planId ?? event?.prep_plan_id ?? fallback.prepPlanId,
  };
}

export function eventBelongsToPlan(event, planId) {
  if (!planId) return true;
  return idsMatch(normalizeCalendarEvent(event).prepPlanId, planId);
}

export function activityBelongsToPlan(activity, plan) {
  if (!plan) return true;
  if (activity?.prepPlanId || activity?.prep_plan_id) {
    return idsMatch(activity.prepPlanId ?? activity.prep_plan_id, plan.prep_plan_id || plan.id);
  }
  if (activity?.jobPostId || activity?.job_post_id) {
    return idsMatch(activity.jobPostId ?? activity.job_post_id, plan.job_post_id);
  }
  return false;
}

export function prepDateForPlanDay(plan, day, now = new Date()) {
  const interview = plan?.interview_at ? new Date(plan.interview_at) : null;
  const totalDays = Math.max(1, Number(plan?.days_until_interview) || 1);
  const targetDay = Math.min(totalDays, Math.max(1, Number(day) || 1));
  if (interview && !Number.isNaN(interview.getTime())) {
    const date = new Date(interview);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - totalDays + targetDay - 1);
    return date;
  }
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + targetDay - 1);
  return date;
}

export function prepTimelineForPlan(plan, now = new Date()) {
  if (!plan) return [];
  const highestTaskDay = Math.max(0, ...(plan.tasks || []).map((task) => Number(task.day) || 0));
  const totalDays = Math.max(1, Number(plan.days_until_interview) || 0, highestTaskDay);
  const anchoredPlan = { ...plan, days_until_interview: totalDays };
  return Array.from({ length: totalDays }, (_, index) => ({
    day: index + 1,
    date: prepDateForPlanDay(anchoredPlan, index + 1, now),
  }));
}

export function localTimeGreeting(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const hour = Number.isNaN(date.getTime()) ? new Date().getHours() : date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function normalizeNoteFolder(folder) {
  const cleanName = String(folder || "").trim();
  if (!cleanName || ["notes", "quick notes"].includes(cleanName.toLowerCase())) return "Study notes";
  if (cleanName.toLowerCase() === GENERATED_NOTES_FOLDER.toLowerCase()) return GENERATED_NOTES_FOLDER;
  return cleanName;
}

export function normalizeWorkspaceNote(note) {
  if (!note || typeof note !== "object") return note;
  return {
    ...note,
    folder: note.generated || note.generationKey ? GENERATED_NOTES_FOLDER : normalizeNoteFolder(note.folder),
  };
}

function stringList(values) {
  return Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function noteSections(values) {
  if (!Array.isArray(values)) return [];
  return values.map((section) => ({
    title: String(section?.title || "").trim(),
    body: String(section?.body || "").trim(),
    bullets: stringList(section?.bullets),
  })).filter((section) => section.title && section.body);
}

export function normalizeStudyNoteContent(content) {
  if (!content || typeof content !== "object") return null;
  const normalized = {
    ...content,
    title: String(content.title || "").trim(),
    subtitle: String(content.subtitle || "").trim(),
    role: String(content.role || "").trim(),
    topics: stringList(content.topics),
    summary: String(content.summary || "").trim(),
    sections: noteSections(content.sections),
    deep_dive: noteSections(content.deep_dive || content.deeper),
    interview_questions: stringList(content.interview_questions),
    related_topics: stringList(content.related_topics),
    web_research: Array.isArray(content.web_research) ? content.web_research : [],
    resources: Array.isArray(content.resources) ? content.resources : [],
    checklist: stringList(content.checklist),
    source: String(content.source || "openai").trim(),
  };
  if (!normalized.title || !normalized.summary || !normalized.sections.length) return null;
  return normalized;
}

export function isUsableStudyNoteCacheEntry(entry) {
  return Boolean(normalizeStudyNoteContent(entry?.content));
}

export function resolveExamReviewResult(attempt) {
  return attempt?.result || attempt?.review || null;
}

export function expectedExamReviewAnswer(question) {
  const correctOptions = (question?.options || []).filter((option) => option?.is_correct);
  if (correctOptions.length) {
    return {
      label: correctOptions.length > 1 ? "Correct answers" : "Correct answer",
      text: correctOptions.map((option) => `${option.label}. ${option.text}`).join("; "),
    };
  }
  const expectedAnswer = String(question?.expected_answer || "").trim();
  return {
    label: "Expected answer",
    text: expectedAnswer || "The answer key is unavailable for this older attempt.",
  };
}

export function studyNoteFailureStatus(error) {
  const message = String(error?.message || "").replace(/^Study notes returned \d+:\s*/i, "").trim();
  if (/not configured|no ai provider/i.test(message)) {
    return "AI study notes unavailable — OpenAI is not configured on this backend.";
  }
  return message ? `Study notes error — ${message}` : "AI study notes are unavailable. Please try again.";
}

export function buildGeneratedWorkspaceNote({ content, task, cacheKey, planId, noteDate, createdAt = new Date().toISOString() }) {
  const normalized = normalizeStudyNoteContent(content);
  if (!normalized) throw new Error("The AI returned an incomplete study note. Please generate it again.");
  return {
    id: `generated-${cacheKey}`,
    generationKey: cacheKey,
    title: normalized.title || String(task?.title || "Study note").replace(/^Read notes:\s*/i, ""),
    body: studyNoteContentToText(normalized),
    planId: String(planId || ""),
    folder: GENERATED_NOTES_FOLDER,
    noteDate,
    generated: true,
    color: "#ff5d42",
    createdAt,
  };
}

export function upsertGeneratedWorkspaceNote(notes, generatedNote) {
  const existing = (notes || []).find((note) => note.generationKey === generatedNote.generationKey);
  if (!existing) return [generatedNote, ...(notes || [])];
  return (notes || []).map((note) => note.generationKey === generatedNote.generationKey
    ? { ...note, ...generatedNote, createdAt: note.createdAt || generatedNote.createdAt }
    : note);
}

export function studyNoteContentToText(content) {
  const normalized = normalizeStudyNoteContent(content);
  if (!normalized) return "";
  const lines = [
    normalized.subtitle,
    normalized.summary,
    "",
    ...normalized.sections.flatMap((section) => [
      section.title,
      section.body,
      ...section.bullets.map((bullet) => `- ${bullet}`),
      "",
    ]),
    "In depth",
    ...normalized.deep_dive.flatMap((section) => [
      section.title,
      section.body,
      ...section.bullets.map((bullet) => `- ${bullet}`),
      "",
    ]),
    "Interview questions",
    ...normalized.interview_questions.map((question) => `- ${question}`),
    "",
    "Resources",
    ...normalized.resources.map((resource) => `- ${resource?.title || "Resource"}: ${resource?.url || ""}`),
  ];
  return lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function planMeta(plans, prepPlanId) {
  return (plans || []).find((plan) => idsMatch(plan.id ?? plan.prep_plan_id, prepPlanId)) || {};
}

export function reconcileExamAttempts(localAttempts, backendAttempts, plans) {
  const backendIds = new Set((backendAttempts || []).map((item) => item.exam?.id).filter((id) => id !== undefined && id !== null).map(String));
  const localByBackendId = new Map(
    (localAttempts || []).filter((item) => item.exam?.id).map((item) => [String(item.exam.id), item]),
  );
  const localOnly = (localAttempts || []).filter((item) => !item.exam?.id || backendIds.has(String(item.exam.id)) === false && item.pendingBackend === true);
  const reconciled = (backendAttempts || []).map((stored) => {
    const existing = localByBackendId.get(String(stored.exam.id));
    const plan = planMeta(plans, stored.exam.prep_plan_id);
    const complete = stored.status === "complete";
    return {
      ...existing,
      id: existing?.id || `recovered-exam-${stored.exam.id}`,
      exam: stored.exam,
      prepPlanId: stored.exam.prep_plan_id,
      jobPostId: existing?.jobPostId ?? plan.job_post_id,
      jobTitle: existing?.jobTitle ?? plan.job_title,
      day: existing?.day ?? stored.exam.day,
      status: stored.status,
      score: complete ? stored.average_score : undefined,
      review: complete ? {
        exam_id: stored.exam.id,
        average_score: stored.average_score,
        results: stored.results || [],
        review_exam: stored.review_exam,
      } : undefined,
      answers: stored.answers || existing?.answers || {},
      createdAt: existing?.createdAt || stored.created_at,
      completedAt: complete ? existing?.completedAt || stored.created_at : undefined,
    };
  });
  return [...localOnly, ...reconciled];
}

export function reconcileMockAttempts(localAttempts, backendInterviews, plans) {
  const backendIds = new Set((backendInterviews || []).map((item) => String(item.id)));
  const localByBackendId = new Map(
    (localAttempts || []).filter((item) => item.interview?.id).map((item) => [String(item.interview.id), item]),
  );
  const scheduled = (localAttempts || []).filter((item) => !item.interview?.id);
  const reconciled = (backendInterviews || []).map((interview) => {
    const existing = localByBackendId.get(String(interview.id));
    const plan = planMeta(plans, interview.prep_plan_id);
    const complete = interview.status === "complete";
    return {
      ...existing,
      id: existing?.id || `recovered-mock-${interview.id}`,
      interview,
      prepPlanId: interview.prep_plan_id,
      jobPostId: existing?.jobPostId ?? plan.job_post_id,
      jobTitle: existing?.jobTitle ?? plan.job_title,
      difficulty: existing?.difficulty || interview.difficulty,
      questionTypes: existing?.questionTypes || [],
      questionCount: existing?.questionCount || interview.question_count,
      status: interview.status,
      score: complete ? interview.average_score : existing?.score,
      createdAt: existing?.createdAt || interview.created_at,
      completedAt: complete ? existing?.completedAt || interview.created_at : undefined,
    };
  });
  return [...scheduled, ...reconciled];
}
