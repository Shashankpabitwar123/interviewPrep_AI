export const READINESS_FORMULA = "30% plan + 20% learning + 25% exams + 20% mock interviews + 5% consistency";

export function emptyReadinessReport() {
  return {
    score: 0,
    formula: READINESS_FORMULA,
    components: [
      { key: "plan", label: "Plan completion", value: 0, weight: 0.30 },
      { key: "learning", label: "Learning", value: 0, weight: 0.20 },
      { key: "exams", label: "Exam performance", value: 0, weight: 0.25 },
      { key: "mocks", label: "Mock interviews", value: 0, weight: 0.20 },
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
  const componentKeys = ["plan", "learning", "exams", "mocks", "consistency"];
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
    date.setDate(date.getDate() - totalDays + targetDay);
    return date;
  }
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + targetDay - 1);
  return date;
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
      review: complete ? { exam_id: stored.exam.id, average_score: stored.average_score, results: stored.results || [] } : undefined,
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
