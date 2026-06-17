import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Database,
  ExternalLink,
  FileQuestion,
  FilePlus2,
  FileText,
  Flame,
  Folder,
  FolderPlus,
  Gauge,
  Home,
  Info,
  Link,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquareText,
  MoreVertical,
  NotebookText,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const EXTENSION_GUIDE_URL = "https://github.com/Shashankpabitwar123/interviewPrep_AI/tree/main/browser-extension";
const EXTENSION_WEB_SOURCE = "interviewprep-ai-web";
const EXTENSION_RESPONSE_SOURCE = "interviewprep-ai-extension";
const JOB_BRIEF_CACHE_KEY = "interviewprep_job_briefs";
const JOB_BRIEF_CACHE_VERSION = 2;
const JOB_BRIEF_QA_CACHE_KEY = "interviewprep_job_brief_questions";

const EXAM_PRESETS = {
  easy: { difficulty: "easy", questionCount: 10, timeLimit: 5, questionTypes: ["auto"] },
  medium: { difficulty: "medium", questionCount: 20, timeLimit: 10, questionTypes: ["auto"] },
  hard: { difficulty: "hard", questionCount: 40, timeLimit: 30, questionTypes: ["auto"] },
};

const EXAM_TYPE_OPTIONS = [
  ["auto", "AI decides"],
  ["multiple_choice", "MCQ"],
  ["short_answer", "Short answer"],
  ["one_word", "One word"],
  ["fill_blank", "Fill in blank"],
  ["multiple_select", "Multi-select"],
  ["coding", "Coding"],
];

function App() {
  const [mode, setMode] = useState("paste");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [jobs, setJobs] = useState([]);
  const [jobMarkers, setJobMarkers] = useState(() => loadLocalMap("interviewprep_job_markers"));
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobDraft, setJobDraft] = useState({ title: "", description: "", sourceUrl: "", color: "#2563eb" });
  const [jobActionMenuId, setJobActionMenuId] = useState(null);
  const [jobBrief, setJobBrief] = useState(null);
  const [jobBriefLoading, setJobBriefLoading] = useState(false);
  const [jobBriefQuestion, setJobBriefQuestion] = useState("");
  const [jobBriefAnswers, setJobBriefAnswers] = useState([]);
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [confirmBulkDeleteJobs, setConfirmBulkDeleteJobs] = useState(false);
  const [deletedJobs, setDeletedJobs] = useState(() => loadLocalList("interviewprep_deleted_jobs"));
  const [archivedJobIds, setArchivedJobIds] = useState(() => loadLocalList("interviewprep_archived_job_ids"));
  const [savedPlans, setSavedPlans] = useState([]);
  const [planSearch, setPlanSearch] = useState("");
  const [plan, setPlan] = useState(null);
  const [exam, setExam] = useState(null);
  const [examAttempts, setExamAttempts] = useState(() => loadLocalList("interviewprep_exam_attempts"));
  const [mockAttempts, setMockAttempts] = useState(() => loadLocalList("interviewprep_mock_attempts"));
  const [examSession, setExamSession] = useState(null);
  const [examReview, setExamReview] = useState(null);
  const [mockSession, setMockSession] = useState(null);
  const [mockReview, setMockReview] = useState(null);
  const [confirmDeleteAttempt, setConfirmDeleteAttempt] = useState(null);
  const [practiceExamPrompt, setPracticeExamPrompt] = useState(null);
  const [examAnswers, setExamAnswers] = useState({});
  const [examResult, setExamResult] = useState(null);
  const [examSettings, setExamSettings] = useState({ ...EXAM_PRESETS.medium });
  const [mockInterview, setMockInterview] = useState(null);
  const [mockDifficulty, setMockDifficulty] = useState("medium");
  const [mockQuestionTypes, setMockQuestionTypes] = useState(["technical", "multiple_choice", "coding", "behavioral", "team_problem_solving"]);
  const [mockAnswer, setMockAnswer] = useState("");
  const [completedTasks, setCompletedTasks] = useState(() => loadCompletedTasks());
  const [notes, setNotes] = useState(() => loadLocalList("interviewprep_notes"));
  const [generatedStudyNotes, setGeneratedStudyNotes] = useState(() => loadLocalMap("interviewprep_generated_study_notes"));
  const [noteReader, setNoteReader] = useState(null);
  const [noteFolders, setNoteFolders] = useState(() => loadLocalList("interviewprep_note_folders"));
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "", planId: "", folder: "", subfolder: "" });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarEvents, setCalendarEvents] = useState(() => loadLocalList("interviewprep_calendar_events"));
  const [calendarPlanDetails, setCalendarPlanDetails] = useState({});
  const [eventDraft, setEventDraft] = useState({ title: "", date: dateKey(new Date()), type: "preparation", color: "#2563eb", link: "" });
  const [recentActivity, setRecentActivity] = useState(() => loadLocalList("interviewprep_recent_activity"));
  const [status, setStatus] = useState("Backend Connected");
  const [theme, setTheme] = useState(() => loadTheme());
  const [loading, setLoading] = useState(false);
  const [loadingStudyTaskId, setLoadingStudyTaskId] = useState([]);
  const [loadingExamTaskId, setLoadingExamTaskId] = useState([]);
  const [improvingNoteId, setImprovingNoteId] = useState("");
  const [soundVolume, setSoundVolume] = useState(() => loadSoundVolume());
  const [activeView, setActiveView] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPlanDay, setSelectedPlanDay] = useState(1);
  const [user, setUser] = useState(() => loadSavedUser());
  const [authToken, setAuthToken] = useState(() => loadSavedToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [extensionState, setExtensionState] = useState({
    installed: false,
    checking: true,
    bubbleEnabled: false,
    signedIn: false,
    user: null,
    error: "",
  });

  useEffect(() => {
    resetCreatePrepForm();
    setInterviewDate(defaultInterviewDate());
    if (authToken) {
      reloadLocalWorkspaceState();
      refreshJobs();
      refreshSavedPlans();
    } else {
      clearVisibleWorkspaceState();
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    function closeSettingsFromOutside(event) {
      if (event.target.closest?.(".settings-popover") || event.target.closest?.("[data-settings-toggle='true']")) return;
      setSettingsOpen(false);
    }
    document.addEventListener("pointerdown", closeSettingsFromOutside, true);
    document.addEventListener("mousedown", closeSettingsFromOutside, true);
    document.addEventListener("click", closeSettingsFromOutside, true);
    return () => {
      document.removeEventListener("pointerdown", closeSettingsFromOutside, true);
      document.removeEventListener("mousedown", closeSettingsFromOutside, true);
      document.removeEventListener("click", closeSettingsFromOutside, true);
    };
  }, [settingsOpen]);

  function reloadLocalWorkspaceState() {
    setJobMarkers(loadLocalMap("interviewprep_job_markers"));
    setDeletedJobs(loadLocalList("interviewprep_deleted_jobs"));
    setArchivedJobIds(loadLocalList("interviewprep_archived_job_ids"));
    setExamAttempts(loadLocalList("interviewprep_exam_attempts"));
    setMockAttempts(loadLocalList("interviewprep_mock_attempts"));
    setNotes(loadLocalList("interviewprep_notes"));
    setGeneratedStudyNotes(loadLocalMap("interviewprep_generated_study_notes"));
    setNoteFolders(loadLocalList("interviewprep_note_folders"));
    setCalendarEvents(loadLocalList("interviewprep_calendar_events"));
    setRecentActivity(loadLocalList("interviewprep_recent_activity"));
    setCompletedTasks(loadCompletedTasks());
  }

  function clearVisibleWorkspaceState() {
    setJobs([]);
    setSavedPlans([]);
    setPlan(null);
    setRecentActivity([]);
    setDeletedJobs([]);
    setArchivedJobIds([]);
    setExamAttempts([]);
    setMockAttempts([]);
    setCalendarEvents([]);
    setCompletedTasks({});
    setNotes([]);
    setNoteFolders([]);
    setGeneratedStudyNotes({});
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };
    const token = options.authTokenOverride ?? authToken;
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestOptions = { ...options, headers };
    delete requestOptions.authTokenOverride;
    return fetch(`${API_URL}${path}`, requestOptions);
  }

  function requestExtension(action, payload = {}, timeoutMs = 1500) {
    return new Promise((resolve) => {
      const requestId = `ipai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", handleMessage);
        resolve({ ok: false, installed: false, error: "Extension not detected." });
      }, timeoutMs);

      function handleMessage(event) {
        if (event.source !== window) return;
        const response = event.data || {};
        if (response.source !== EXTENSION_RESPONSE_SOURCE || response.requestId !== requestId) return;
        window.clearTimeout(timer);
        window.removeEventListener("message", handleMessage);
        resolve(response);
      }

      window.addEventListener("message", handleMessage);
      window.postMessage({
        source: EXTENSION_WEB_SOURCE,
        requestId,
        action,
        ...payload,
      }, window.location.origin);
    });
  }

  async function refreshExtensionState() {
    const response = await requestExtension("getState");
    setExtensionState({
      installed: Boolean(response.installed && response.ok),
      checking: false,
      bubbleEnabled: Boolean(response.bubbleEnabled),
      signedIn: Boolean(response.signedIn),
      user: response.user || null,
      error: response.installed ? response.error || "" : "",
    });
    return response;
  }

  async function syncWebsiteSessionToExtension() {
    if (!user || !authToken) {
      const response = await requestExtension("syncSession", { user: null, authToken: "" });
      if (response.installed) await refreshExtensionState();
      return response;
    }
    const response = await requestExtension("syncSession", { user, authToken });
    if (response.installed) await refreshExtensionState();
    return response;
  }

  async function toggleExtensionBubble() {
    if (!extensionState.installed) {
      window.open(EXTENSION_GUIDE_URL, "_blank", "noopener,noreferrer");
      return;
    }

    const response = await requestExtension("setBubbleEnabled", { enabled: !extensionState.bubbleEnabled });
    if (!response.ok) {
      setExtensionState((current) => ({ ...current, error: response.error || "Could not update extension." }));
      return;
    }
    setExtensionState((current) => ({
      ...current,
      installed: true,
      checking: false,
      bubbleEnabled: response.bubbleEnabled ?? response.settings?.bubbleEnabled ?? !current.bubbleEnabled,
      error: "",
    }));
    await syncWebsiteSessionToExtension();
  }

  useEffect(() => {
    refreshExtensionState();
  }, []);

  useEffect(() => {
    syncWebsiteSessionToExtension();
  }, [user?.id, user?.email, authToken]);

  useEffect(() => {
    function handleExtensionEvent(event) {
      if (event.source !== window) return;
      const message = event.data || {};
      if (message.source !== EXTENSION_RESPONSE_SOURCE || !message.event) return;

      if (message.event === "captureStatus") {
        setStatus(message.status || (message.action === "plan" ? "Generating Prep Plan From Bubble" : "Saving Job From Bubble"));
        return;
      }

      if (message.event === "captureError") {
        setStatus(`Extension Error: ${message.status || "Capture failed"}`);
        return;
      }

      if (message.event === "captureCompleted") {
        const isPlan = message.action === "plan";
        setStatus(isPlan ? "Prep Plan Saved From Bubble" : "Job Saved From Bubble");
        playGeneratedSound(soundVolume);
        refreshJobs();
        refreshSavedPlans();
        addActivity({
          type: isPlan ? "plan" : "job",
          title: isPlan ? "Prep plan generated from bubble" : "Job saved from bubble",
          detail: message.title || "Captured job",
          badge: "extension",
          target: isPlan ? "prep" : "jobs",
        });
      }
    }

    window.addEventListener("message", handleExtensionEvent);
    return () => window.removeEventListener("message", handleExtensionEvent);
  }, [soundVolume, jobMarkers, archivedJobIds]);

  useEffect(() => {
    if (!savedPlans.length) {
      setCalendarPlanDetails({});
      return undefined;
    }

    let cancelled = false;
    async function loadCalendarPlanDetails() {
      const entries = await Promise.all(savedPlans.map(async (savedPlan) => {
        try {
          const response = await apiFetch(`/prep-plans/${savedPlan.id}`);
          if (!response.ok) return null;
          const detail = await response.json();
          return [savedPlan.id, { ...detail, job_color: colorForJobId(detail.job_post_id, jobMarkers, detail.job_title) }];
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        setCalendarPlanDetails(Object.fromEntries(entries.filter(Boolean)));
      }
    }

    loadCalendarPlanDetails();
    return () => {
      cancelled = true;
    };
  }, [savedPlans, jobMarkers]);

  const planDays = useMemo(() => {
    return buildPlanMilestones(plan, interviewDate);
  }, [plan, interviewDate]);

  const visibleTasks = useMemo(() => {
    return buildDailyStudyTasks(plan, selectedPlanDay);
  }, [plan, selectedPlanDay]);

  const streak = useMemo(() => buildStudyStreak(completedTasks), [completedTasks]);

  useEffect(() => {
    if (!examSession || examSession.remainingSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setExamSession((current) => {
        if (!current) return current;
        return { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examSession?.id, examSession?.remainingSeconds]);

  useEffect(() => {
    if (!mockSession || mockSession.remainingSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setMockSession((current) => {
        if (!current) return current;
        return { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mockSession?.attemptId, mockSession?.questionNumber, mockSession?.remainingSeconds]);

  async function refreshJobs(markers = jobMarkers, archivedIds = archivedJobIds, tokenOverride = authToken) {
    try {
      const response = await apiFetch(`/jobs`, { authTokenOverride: tokenOverride });
      if (!response.ok) return;
      const saved = await response.json();
      const hidden = new Set(archivedIds.map(String));
      setJobs(saved.filter((job) => !hidden.has(String(job.id))).map((job, index) => ({
        id: job.id,
        title: job.title,
        company: companyFromUrl(job.source_url) || "Saved Job",
        source_url: job.source_url,
        description_preview: job.description_preview,
        saved_at: index === 0 ? "Saved now" : `Saved ${index + 1}h ago`,
        logo: logoFor(job.title, job.source_url),
        tone: toneFor(job.source_url),
        color: colorForJobId(job.id, markers, job.title),
      })));
    } catch {
      setStatus("Backend Offline");
    }
  }

  async function refreshSavedPlans(archivedIds = archivedJobIds, tokenOverride = authToken) {
    try {
      const response = await apiFetch(`/prep-plans`, { authTokenOverride: tokenOverride });
      if (!response.ok) return;
      const plans = await response.json();
      const hidden = new Set(archivedIds.map(String));
      setSavedPlans(plans.filter((savedPlan) => !hidden.has(String(savedPlan.job_post_id))));
    } catch {
      setStatus("Backend Offline");
    }
  }

  function resetCreatePrepForm() {
    setMode("paste");
    setJobTitle("");
    setCompany("");
    setJobDescription("");
    setSourceUrl("");
    setHoursPerDay(3);
  }

  async function generatePlan(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("Generating Plan");
    try {
      const minDate = minInterviewDateTime();
      if (!interviewDate || interviewDate < minDate) {
        throw new Error("Choose today or a future interview date.");
      }
      const payload = {
        job_title: jobTitle.trim() || "Auto-detect role",
        company: company.trim() || "Auto-detect company",
        interview_at: new Date(interviewDate).toISOString(),
        hours_per_day: Number(hoursPerDay),
        comfort_level: "intermediate",
      };
      if (mode === "url") payload.source_url = normalizeUrl(sourceUrl);
      else payload.job_description = jobDescription || "Python FastAPI SQL REST APIs Docker testing and system design.";

      const response = await apiFetch(`/prep-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const savedPlan = await response.json();
      const planColor = colorForJobId(savedPlan.job_post_id, jobMarkers, savedPlan.job_title);
      const nextMarkers = savedPlan.job_post_id ? { ...jobMarkers, [savedPlan.job_post_id]: planColor } : jobMarkers;
      if (savedPlan.job_post_id) {
        setJobMarkers(nextMarkers);
        saveLocalMap("interviewprep_job_markers", nextMarkers);
      }
      setPlan({ ...savedPlan, job_color: planColor });
      setJobTitle(savedPlan.job_title || "");
      setCompany(savedPlan.company || inferCompanyName(company, jobDescription, sourceUrl));
      setSelectedPlanDay(1);
      setExam(null);
      setMockInterview(null);
      playGeneratedSound(soundVolume);
      setStatus("Prep Plan Saved");
      markStudyActivity("plan-generated");
      addActivity({ type: "plan", title: "Prep plan generated", detail: savedPlan.job_title, badge: `${savedPlan.days_until_interview}d`, target: "prep" });
      refreshJobs(nextMarkers);
      refreshSavedPlans();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveJobOnly(event) {
    event?.preventDefault?.();
    setLoading(true);
    setStatus("Saving Job");
    try {
      const payload = {
        job_title: jobTitle.trim() || "Auto-detect role",
        company: company.trim() || "Auto-detect company",
      };
      if (mode === "url") payload.source_url = normalizeUrl(sourceUrl);
      else payload.job_description = normalizeSavedJobDescription(jobDescription, jobTitle);
      const response = await apiFetch(`/jobs/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const saved = await response.json();
      setCompany(saved.company || inferCompanyName(company, jobDescription, sourceUrl));
      const jobColor = colorForJobId(saved.job_post_id, jobMarkers, saved.role_title || jobTitle);
      const nextMarkers = { ...jobMarkers, [saved.job_post_id]: jobColor };
      setJobMarkers(nextMarkers);
      saveLocalMap("interviewprep_job_markers", nextMarkers);
      await refreshJobs(nextMarkers);
      addActivity({ type: "job", title: "Job saved", detail: saved.role_title || jobTitle || "Saved job", badge: "", target: "jobs" });
      setStatus("Job Saved");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveManualJob(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("Saving Job");
    try {
      const response = await apiFetch(`/jobs/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_title: jobDraft.title,
          job_description: jobDraft.description || !jobDraft.sourceUrl ? normalizeSavedJobDescription(jobDraft.description, jobDraft.title) : undefined,
          source_url: jobDraft.sourceUrl ? normalizeUrl(jobDraft.sourceUrl) : undefined,
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const saved = await response.json();
      const nextMarkers = { ...jobMarkers, [saved.job_post_id]: jobDraft.color };
      setJobMarkers(nextMarkers);
      saveLocalMap("interviewprep_job_markers", nextMarkers);
      setJobDraft({ title: "", description: "", sourceUrl: "", color: "#2563eb" });
      setJobModalOpen(false);
      await refreshJobs(nextMarkers);
      addActivity({ type: "job", title: "Job added manually", detail: saved.role_title || jobDraft.title, badge: "", target: "jobs" });
      setStatus("Job Saved");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSavedJob(jobId) {
    setLoading(true);
    setStatus("Moving Job To Bin");
    try {
      const deletedJob = await getRecoverableJob(jobId);
      if (deletedJob) addDeletedJobToBin({ ...deletedJob, archived_backend: true });
      const nextArchivedIds = [...new Set([String(jobId), ...archivedJobIds.map(String)])];
      setArchivedJobIds(nextArchivedIds);
      saveLocalList("interviewprep_archived_job_ids", nextArchivedIds);
      setJobs((current) => current.filter((job) => String(job.id) !== String(jobId)));
      setSavedPlans((current) => current.filter((savedPlan) => String(savedPlan.job_post_id) !== String(jobId)));
      removeCalendarEventsForJobs([jobId], deletedJob ? [deletedJob.title] : []);
      if (String(plan?.job_post_id) === String(jobId)) setPlan(null);
      setSelectedJobIds((current) => current.filter((id) => String(id) !== String(jobId)));
      setConfirmDeleteJob(null);
      setJobActionMenuId(null);
      addActivity({ type: "job", title: "Job moved to bin", detail: deletedJob?.title || "Saved job", badge: "", target: "jobs" });
      setStatus("Job Moved To Bin");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedJobs() {
    if (!selectedJobIds.length) return;
    setLoading(true);
    setStatus("Moving Selected Jobs To Bin");
    try {
      const recoverableJobs = (await Promise.all(selectedJobIds.map((jobId) => getRecoverableJob(jobId)))).filter(Boolean);
      addDeletedJobsToBin(recoverableJobs.map((job) => ({ ...job, archived_backend: true })));
      const selectedIds = new Set(selectedJobIds.map(String));
      const nextArchivedIds = [...new Set([...selectedIds, ...archivedJobIds.map(String)])];
      setArchivedJobIds(nextArchivedIds);
      saveLocalList("interviewprep_archived_job_ids", nextArchivedIds);
      const deletedCount = selectedJobIds.length;
      setJobs((current) => current.filter((job) => !selectedIds.has(String(job.id))));
      setSavedPlans((current) => current.filter((savedPlan) => !selectedIds.has(String(savedPlan.job_post_id))));
      setSelectedJobIds([]);
      setConfirmBulkDeleteJobs(false);
      removeCalendarEventsForJobs(selectedJobIds, recoverableJobs.map((job) => job.title));
      if (selectedIds.has(String(plan?.job_post_id))) setPlan(null);
      addActivity({ type: "job", title: "Bulk moved jobs to bin", detail: `${deletedCount} jobs archived`, badge: String(deletedCount), target: "jobs" });
      setStatus(`${deletedCount} Jobs Moved To Bin`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function getRecoverableJob(jobId) {
    const listJob = jobs.find((job) => job.id === jobId);
    try {
      const response = await apiFetch(`/jobs/${jobId}`);
      if (response.ok) {
        const detail = await response.json();
        return {
          id: jobId,
          title: detail.title || listJob?.title || "Deleted job",
          company: inferCompanyName(listJob?.company || "", detail.description || "", detail.source_url || listJob?.source_url || ""),
          description: detail.description || listJob?.description_preview || "",
          source_url: detail.source_url || listJob?.source_url || "",
          color: jobMarkers[jobId] || listJob?.color || "#2563eb",
          deleted_at: new Date().toISOString(),
        };
      }
    } catch {
      // Fall back to the row data if the detail endpoint is unavailable.
    }
    return listJob ? {
      id: jobId,
      title: listJob.title || "Deleted job",
      company: listJob.company || companyFromUrl(listJob.source_url) || "",
      description: listJob.description_preview || "",
      source_url: listJob.source_url || "",
      color: jobMarkers[jobId] || listJob.color || "#2563eb",
      deleted_at: new Date().toISOString(),
    } : null;
  }

  function addDeletedJobToBin(job) {
    addDeletedJobsToBin([job]);
  }

  function addDeletedJobsToBin(jobsToStore) {
    if (!jobsToStore.length) return;
    setDeletedJobs((current) => {
      const next = [...jobsToStore, ...current.filter((item) => !jobsToStore.some((job) => job.id === item.id))].slice(0, 10);
      saveLocalList("interviewprep_deleted_jobs", next);
      return next;
    });
  }

  async function restoreDeletedJob(deletedJobId) {
    const jobToRestore = deletedJobs.find((job) => job.id === deletedJobId);
    if (!jobToRestore) return;
    setLoading(true);
    setStatus("Restoring Job");
    try {
      if (jobToRestore.archived_backend) {
        const response = await apiFetch(`/jobs/${deletedJobId}`);
        if (response.ok) {
          const nextArchivedIds = archivedJobIds.filter((id) => String(id) !== String(deletedJobId));
          setArchivedJobIds(nextArchivedIds);
          saveLocalList("interviewprep_archived_job_ids", nextArchivedIds);
          const nextDeletedJobs = deletedJobs.filter((job) => job.id !== deletedJobId);
          setDeletedJobs(nextDeletedJobs);
          saveLocalList("interviewprep_deleted_jobs", nextDeletedJobs);
          await refreshJobs(jobMarkers, nextArchivedIds);
          await refreshSavedPlans(nextArchivedIds);
          addActivity({ type: "job", title: "Job restored", detail: jobToRestore.title, badge: "", target: "jobs" });
          setStatus("Job Restored With Prep Data");
          return;
        }
      }
      const payload = {
        job_title: jobToRestore.title,
        company: jobToRestore.company || "Auto-detect company",
        job_description: jobToRestore.description || normalizeSavedJobDescription("", jobToRestore.title),
        source_url: jobToRestore.source_url ? normalizeUrl(jobToRestore.source_url) : undefined,
      };
      const response = await apiFetch(`/jobs/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const restored = await response.json();
      const nextMarkers = { ...jobMarkers, [restored.job_post_id]: jobToRestore.color || "#2563eb" };
      setJobMarkers(nextMarkers);
      saveLocalMap("interviewprep_job_markers", nextMarkers);
      const nextDeletedJobs = deletedJobs.filter((job) => job.id !== deletedJobId);
      setDeletedJobs(nextDeletedJobs);
      saveLocalList("interviewprep_deleted_jobs", nextDeletedJobs);
      await refreshJobs(nextMarkers);
      addActivity({ type: "job", title: "Job restored", detail: restored.role_title || jobToRestore.title, badge: "", target: "jobs" });
      setStatus("Job Restored");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function clearDeletedJob(deletedJobId) {
    const nextDeletedJobs = deletedJobs.filter((job) => job.id !== deletedJobId);
    setDeletedJobs(nextDeletedJobs);
    saveLocalList("interviewprep_deleted_jobs", nextDeletedJobs);
  }

  async function useSavedJob(job) {
    setLoading(true);
    setStatus("Loading Job");
    try {
      const response = await apiFetch(`/jobs/${job.id}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const detail = await response.json();
      if (isUrlBookmark(detail) && detail.source_url) {
        window.open(normalizeUrl(detail.source_url), "_blank", "noopener,noreferrer");
        setStatus("Saved Job URL Opened");
        return;
      }
      const planList = savedPlans.length ? savedPlans : await fetchSavedPlansList();
      const matchingPlan = planList.find((savedPlan) => String(savedPlan.job_post_id) === String(job.id));
      setJobTitle(detail.title);
      setCompany(inferCompanyName("", detail.description || "", detail.source_url || ""));
      setJobDescription(detail.description || "");
      setSourceUrl(detail.source_url || "");
      setMode(detail.source_url ? "url" : "paste");
      if (matchingPlan) {
        const planResponse = await apiFetch(`/prep-plans/${matchingPlan.id}`);
        if (planResponse.ok) {
          const planDetail = await planResponse.json();
          setPlan({ ...planDetail, job_color: colorForJobId(planDetail.job_post_id, jobMarkers, planDetail.job_title) });
          setSelectedPlanDay(1);
        }
      }
      setActiveView("dashboard");
      setStatus(matchingPlan ? "Job and Prep Plan Loaded" : "Job Loaded Into Prep Form");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function openJobDescription(job) {
    setJobBriefLoading(true);
    setJobBriefAnswers(loadJobBriefAnswers(job.id));
    setJobBriefQuestion("");
    const cachedBrief = loadLocalMap(JOB_BRIEF_CACHE_KEY)[String(job.id)];
    if (cachedBrief?.brief && cachedBrief.version === JOB_BRIEF_CACHE_VERSION) {
      setJobBrief({
        job: cachedBrief.job || job,
        brief: sanitizeJobBrief(cachedBrief.brief, cachedBrief.job || {}, job),
        error: "",
      });
      setJobBriefLoading(false);
      addActivity({ type: "job", title: "Job description reviewed", detail: cachedBrief.job?.title || job.title, badge: "saved", target: "jobs" });
      return;
    }

    setJobBrief({
      job,
      brief: null,
      error: "",
    });
    try {
      const [detailResponse, briefResponse] = await Promise.all([
        apiFetch(`/jobs/${job.id}`),
        apiFetch(`/jobs/${job.id}/brief`),
      ]);
      if (!detailResponse.ok) throw new Error(`Job returned ${detailResponse.status}`);
      if (!briefResponse.ok) throw new Error(`Brief returned ${briefResponse.status}`);
      const detail = await detailResponse.json();
      const rawBrief = await briefResponse.json();
      const cleanJob = {
        ...job,
        title: detail.title || job.title,
        company: rawBrief.company || inferCompanyName(job.company || "", detail.description || "", detail.source_url || job.source_url || ""),
        description: detail.description || "",
        source_url: detail.source_url || job.source_url || "",
      };
      const brief = sanitizeJobBrief(rawBrief, cleanJob, job);
      setJobBrief({
        job: cleanJob,
        brief,
        error: "",
      });
      saveLocalMap(JOB_BRIEF_CACHE_KEY, {
        ...loadLocalMap(JOB_BRIEF_CACHE_KEY),
        [String(job.id)]: { version: JOB_BRIEF_CACHE_VERSION, job: cleanJob, brief, cachedAt: new Date().toISOString() },
      });
      addActivity({ type: "job", title: "Job description reviewed", detail: detail.title || job.title, badge: brief.source || "", target: "jobs" });
    } catch (error) {
      setJobBrief((current) => ({
        ...current,
        error: error.message || "Could not load the job description brief.",
      }));
    } finally {
      setJobBriefLoading(false);
    }
  }

  async function askJobBriefQuestion() {
    if (!jobBrief?.job?.id || !jobBriefQuestion.trim()) return;
    const questionText = jobBriefQuestion.trim();
    setJobBriefLoading(true);
    try {
      const response = await apiFetch(`/jobs/${jobBrief.job.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const answer = await response.json();
      setJobBriefAnswers((current) => {
        const next = [
          { id: crypto.randomUUID?.() || `${Date.now()}`, question: questionText, ...answer },
          ...current,
        ];
        saveJobBriefAnswers(jobBrief.job.id, next);
        return next;
      });
      setJobBriefQuestion("");
    } catch (error) {
      setJobBriefAnswers((current) => {
        const next = [{
          id: crypto.randomUUID?.() || `${Date.now()}`,
          question: questionText,
          answer: error.message || "Could not answer this question right now.",
          interview_use: "Try again after checking the backend connection.",
          next_steps: [],
          source: "error",
        }, ...current];
        saveJobBriefAnswers(jobBrief.job.id, next);
        return next;
      });
    } finally {
      setJobBriefLoading(false);
    }
  }

  async function fetchSavedPlansList(archivedIds = archivedJobIds) {
    try {
      const response = await apiFetch(`/prep-plans`);
      if (!response.ok) return [];
      const plans = await response.json();
      const hidden = new Set(archivedIds.map(String));
      const visiblePlans = plans.filter((savedPlan) => !hidden.has(String(savedPlan.job_post_id)));
      setSavedPlans(visiblePlans);
      return visiblePlans;
    } catch {
      return [];
    }
  }

  async function openFullPlan() {
    if (!plan?.prep_plan_id) {
      setActiveView("prep");
      return;
    }
    await loadPrepPlan(plan.prep_plan_id);
    setActiveView("prep");
  }

  async function loadPrepPlan(prepPlanId) {
    setLoading(true);
    setStatus("Loading Prep Plan");
    try {
      const response = await apiFetch(`/prep-plans/${prepPlanId}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const detail = await response.json();
      setPlan({ ...detail, job_color: colorForJobId(detail.job_post_id, jobMarkers, detail.job_title) });
      setSelectedPlanDay(1);
      setStatus("Prep Plan Loaded");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function removePrepPlan(prepPlanId) {
    setLoading(true);
    setStatus("Removing Plan");
    try {
      const response = await apiFetch(`/prep-plans/${prepPlanId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      if (plan?.prep_plan_id === prepPlanId) setPlan(null);
      await refreshSavedPlans();
      setStatus("Plan Removed");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function generateExam(day = selectedPlanDay, options = {}) {
    const sourcePlan = options.planOverride || plan;
    if (!sourcePlan?.prep_plan_id) return;
    if (options.taskKey) setLoadingExamTaskId((current) => addLoadingId(current, options.taskKey));
    const effectiveSettings = normalizeExamSettings(options.settingsOverride || examSettings);
    const questionTypes = effectiveSettings.questionTypes.includes("auto")
      ? ["multiple_choice", "short_answer", "one_word", "fill_blank", "multiple_select", "coding"]
      : effectiveSettings.questionTypes;
    setLoading(true);
    setStatus("Generating Exam");
    try {
      const focusTopics = options.focusTopics || null;
      const response = await apiFetch(`/exams/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prep_plan_id: sourcePlan.prep_plan_id,
          day,
          question_count: Number(effectiveSettings.questionCount),
          difficulty: effectiveSettings.difficulty,
          time_limit_minutes: Number(effectiveSettings.timeLimit),
          question_types: questionTypes,
          auto_question_types: effectiveSettings.questionTypes.includes("auto"),
          focus_topics: focusTopics,
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const generatedExam = await response.json();
      const attempt = {
        id: crypto.randomUUID(),
        exam: generatedExam,
        jobTitle: sourcePlan.job_title,
        prepPlanId: sourcePlan.prep_plan_id,
        jobPostId: sourcePlan.job_post_id,
        day,
        difficulty: effectiveSettings.difficulty,
        questionTypes: effectiveSettings.questionTypes.includes("auto") ? ["AI selected"] : effectiveSettings.questionTypes,
        focusTopics,
        jobColor: colorForPlan(sourcePlan, jobMarkers),
        status: "ready",
        createdAt: new Date().toISOString(),
      };
      const nextAttempts = [attempt, ...examAttempts];
      setExamAttempts(nextAttempts);
      saveLocalList("interviewprep_exam_attempts", nextAttempts);
      setExam(generatedExam);
      addGeneratedCalendarEvent(`Exam: ${sourcePlan.job_title}`, "exam", colorForPlan(sourcePlan, jobMarkers), day, sourcePlan);
      setExamAnswers({});
      setExamResult(null);
      playGeneratedSound(soundVolume);
      setStatus("Exam Ready");
      markStudyActivity("exam-generated");
      addActivity({ type: "exam", title: "Exam generated", detail: generatedExam.title, badge: `${generatedExam.questions.length} Qs`, target: "exams" });
      setActiveView("exams");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      if (options.taskKey) setLoadingExamTaskId((current) => removeLoadingId(current, options.taskKey));
      setLoading(false);
    }
  }

  function scheduleMockInterviewAttempt() {
    if (!plan?.prep_plan_id) return;
    const attempt = {
      id: crypto.randomUUID(),
      jobTitle: plan.job_title,
      prepPlanId: plan.prep_plan_id,
      jobPostId: plan.job_post_id,
      jobColor: colorForPlan(plan, jobMarkers),
      difficulty: mockDifficulty,
      questionTypes: mockQuestionTypes,
      questionCount: { easy: 4, medium: 6, hard: 8 }[mockDifficulty] || 6,
      status: "ready",
      createdAt: new Date().toISOString(),
    };
    const nextAttempts = [attempt, ...mockAttempts];
    setMockAttempts(nextAttempts);
    saveLocalList("interviewprep_mock_attempts", nextAttempts);
    addActivity({ type: "mock", title: "Mock interview set up", detail: `${plan.job_title} • ${attempt.difficulty}`, badge: `${attempt.questionCount} Qs`, target: "exams" });
    setStatus("Mock Interview Ready");
    setActiveView("exams");
  }

  function startExamAttempt(attempt) {
    setExam(attempt.exam);
    setExamAnswers({});
    setExamResult(null);
    setExamSession({
      id: attempt.id,
      exam: attempt.exam,
      questionIndex: 0,
      remainingSeconds: attempt.exam.time_limit_minutes * 60,
    });
  }

  async function startMockAttempt(attempt) {
    await beginMockAttempt(attempt, mockAttempts);
  }

  async function startMockFromPlan() {
    if (!plan?.prep_plan_id) return;
    const attempt = {
      id: crypto.randomUUID(),
      jobTitle: plan.job_title,
      prepPlanId: plan.prep_plan_id,
      jobPostId: plan.job_post_id,
      jobColor: colorForPlan(plan, jobMarkers),
      difficulty: mockDifficulty,
      questionTypes: mockQuestionTypes,
      questionCount: { easy: 4, medium: 6, hard: 8 }[mockDifficulty] || 6,
      status: "ready",
      createdAt: new Date().toISOString(),
    };
    await beginMockAttempt(attempt, [attempt, ...mockAttempts]);
    setActiveView("exams");
  }

  async function beginMockAttempt(attempt, attemptsSource) {
    const interview = await startMockInterview({
      difficulty: attempt.difficulty,
      questionTypes: attempt.questionTypes,
      questionCount: attempt.questionCount,
    });
    if (!interview) return;
    const nextAttempts = attemptsSource.map((item) => item.id === attempt.id ? {
      ...item,
      status: "active",
      interview,
      startedAt: new Date().toISOString(),
    } : item);
    setMockAttempts(nextAttempts);
    saveLocalList("interviewprep_mock_attempts", nextAttempts);
    setMockInterview(interview);
    setMockAnswer("");
    setMockSession({
      attemptId: attempt.id,
      interview,
      answer: "",
      muted: false,
      questionTypes: attempt.questionTypes,
      questionNumber: interview.answered_questions + 1,
      remainingSeconds: mockQuestionSeconds(interview.difficulty, interview.answered_questions + 1),
    });
  }

  function deleteAttempt(kind, id) {
    if (kind === "exam") {
      const next = examAttempts.filter((attempt) => attempt.id !== id);
      setExamAttempts(next);
      saveLocalList("interviewprep_exam_attempts", next);
    } else {
      const next = mockAttempts.filter((attempt) => attempt.id !== id);
      setMockAttempts(next);
      saveLocalList("interviewprep_mock_attempts", next);
    }
    setConfirmDeleteAttempt(null);
  }

  function moveExamQuestion(offset) {
    setExamSession((current) => {
      if (!current || !exam) return current;
      const nextIndex = Math.min(exam.questions.length - 1, Math.max(0, current.questionIndex + offset));
      return { ...current, questionIndex: nextIndex };
    });
  }

  async function submitExamAnswers(event) {
    event?.preventDefault?.();
    const activeExam = examSession?.exam || exam;
    const activeAttemptId = examSession?.id;
    if (!activeExam?.id) return;
    setLoading(true);
    setStatus("Scoring Exam");
    try {
      const answers = activeExam.questions.map((question) => ({
        question_id: question.id,
        answer_text: examAnswers[question.id] || "",
      })).filter((answer) => answer.answer_text.trim());
      const response = await apiFetch(`/exams/${activeExam.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = await response.json();
      const completedAnswers = { ...examAnswers };
      setExamResult(result);
      setExamSession(null);
      setExamAttempts((current) => {
        const next = current.map((attempt) => attempt.id === activeAttemptId || attempt.exam.id === activeExam.id ? {
          ...attempt,
          status: "complete",
          score: result.average_score,
          review: result,
          answers: completedAnswers,
          completedAt: new Date().toISOString(),
        } : attempt);
        saveLocalList("interviewprep_exam_attempts", next);
        return next;
      });
      setActiveView("exams");
      setStatus("Exam Scored");
      markStudyActivity("exam-submitted");
      addActivity({ type: "exam", title: "Exam submitted", detail: activeExam.title, badge: `${Math.round(result.average_score * 100)}%`, target: "exams" });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function startMockInterview(options = {}) {
    if (!plan?.prep_plan_id) return;
    setLoading(true);
    setStatus("Starting Mock Interview");
    try {
      const response = await apiFetch(`/mock-interviews/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prep_plan_id: plan.prep_plan_id,
          difficulty: options.difficulty || mockDifficulty,
          question_count: options.questionCount,
          question_types: options.questionTypes || mockQuestionTypes,
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const interview = await response.json();
      setMockInterview(interview);
      addGeneratedCalendarEvent(`Mock interview: ${plan.job_title}`, "mock", colorForPlan(plan, jobMarkers), selectedPlanDay);
      setStatus("Mock Interview Started");
      markStudyActivity("mock-started");
      addActivity({ type: "mock", title: "Mock interview started", detail: plan?.job_title || "Interview practice", badge: "", target: "exams" });
      return interview;
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitMockSessionAnswer(answerText, options = {}) {
    const activeInterview = mockSession?.interview;
    if (!activeInterview?.id || !answerText.trim()) return;
    setLoading(true);
    setStatus("Scoring Mock Answer");
    try {
      const response = await apiFetch(`/mock-interviews/${activeInterview.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: answerText }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const interview = await response.json();
      setMockInterview(interview);
      const isComplete = interview.status === "complete" || options.forceComplete;
      const storedInterview = isComplete ? {
        ...interview,
        status: "complete",
        questionTypes: mockSession.questionTypes || options.questionTypes || [],
      } : interview;
      setMockAttempts((current) => {
        const next = current.map((attempt) => attempt.id === mockSession.attemptId ? {
          ...attempt,
          status: isComplete ? "complete" : "active",
          interview: storedInterview,
          score: interview.average_score,
          completedAt: isComplete ? new Date().toISOString() : attempt.completedAt,
        } : attempt);
        saveLocalList("interviewprep_mock_attempts", next);
        return next;
      });
      if (isComplete) {
        setMockInterview(storedInterview);
        setMockSession(null);
        setActiveView("exams");
        setStatus(options.forceComplete ? "Mock Interview Ended" : "Mock Interview Complete");
        addActivity({ type: "mock", title: options.forceComplete ? "Mock interview submitted early" : "Mock interview submitted", detail: storedInterview.current_topic || "Interview practice", badge: `${Math.round((storedInterview.average_score || 0) * 100)}%`, target: "exams" });
      } else {
        setMockSession({
          attemptId: mockSession.attemptId,
          interview,
          answer: "",
          muted: mockSession.muted,
          questionTypes: mockSession.questionTypes,
          questionNumber: interview.answered_questions + 1,
          remainingSeconds: mockQuestionSeconds(interview.difficulty, interview.answered_questions + 1),
        });
        setStatus("Next Mock Question Ready");
      }
      markStudyActivity("mock-answer");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function exitMockSession() {
    if (!mockSession?.interview) return;
    const answer = mockSession.answer.trim();
    if (answer) {
      await submitMockSessionAnswer(answer, { forceComplete: true });
      return;
    }
    const interview = {
      ...mockSession.interview,
      status: "complete",
      average_score: mockSession.interview.average_score ?? 0,
      questionTypes: mockSession.questionTypes || [],
    };
    setMockAttempts((current) => {
      const next = current.map((attempt) => attempt.id === mockSession.attemptId ? {
        ...attempt,
        status: "complete",
        interview,
        score: interview.average_score,
        completedAt: new Date().toISOString(),
      } : attempt);
      saveLocalList("interviewprep_mock_attempts", next);
      return next;
    });
    setMockInterview(interview);
    setMockSession(null);
    setActiveView("exams");
    addActivity({ type: "mock", title: "Mock interview submitted early", detail: interview.current_topic || "Interview practice", badge: `${Math.round((interview.average_score || 0) * 100)}%`, target: "exams" });
    setStatus("Mock Interview Ended");
  }

  async function submitMockAnswer(event) {
    event.preventDefault();
    if (!mockInterview?.id || !mockAnswer.trim()) return;
    setLoading(true);
    setStatus("Scoring Answer");
    try {
      const response = await apiFetch(`/mock-interviews/${mockInterview.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_text: mockAnswer }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setMockInterview(await response.json());
      setMockAnswer("");
      setStatus("Mock Answer Scored");
      markStudyActivity("mock-answer");
      addActivity({ type: "mock", title: "Mock answer scored", detail: "Feedback added to interview practice", badge: "", target: "exams" });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function markStudyActivity(key) {
    const today = dateKey(new Date());
    const taskKey = `${today}:${key}`;
    setCompletedTasks((current) => {
      const next = { ...current, [taskKey]: today };
      saveCompletedTasks(next);
      return next;
    });
  }

  function addActivity(item) {
    const activityItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      time: "now",
      badge: "",
      target: targetForActivity(item.type),
      ...item,
    };
    setRecentActivity((current) => {
      const next = [activityItem, ...current].slice(0, 40);
      saveLocalList("interviewprep_recent_activity", next);
      return next;
    });
  }

  function toggleTaskDone(task) {
    const today = dateKey(new Date());
    const taskKey = `${today}:task:${task.id || task.title}`;
    const wasDone = Boolean(completedTasks[taskKey]);
    setCompletedTasks((current) => {
      const next = { ...current };
      if (next[taskKey]) delete next[taskKey];
      else next[taskKey] = today;
      saveCompletedTasks(next);
      return next;
    });
    if (!wasDone) addActivity({ type: "practice", title: "Task completed", detail: task.title, badge: "done", target: task.task_type === "practice_exam" ? "exams" : "prep" });
  }

  function studyNoteCacheKey(task) {
    const taskKey = task.id || task.title;
    return `${plan?.prep_plan_id || plan?.job_id || "sample"}:${task.day || selectedPlanDay}:${taskKey}`;
  }

  function isStudyNoteGenerated(task) {
    if (task?.task_type === "practice_exam") return false;
    return Boolean(generatedStudyNotes[studyNoteCacheKey(task)]?.content);
  }

  async function startStudyTask(task) {
    const taskKey = task.id || task.title;
    const cacheKey = studyNoteCacheKey(task);
    if (task.task_type === "practice_exam") {
      setPracticeExamPrompt({
        task,
        day: task.day || selectedPlanDay,
        focusTopics: task.topics || [],
        taskKey,
      });
      return;
    }
    const cachedNote = generatedStudyNotes[cacheKey];
    if (cachedNote?.content) {
      setNoteReader({ task, content: cachedNote.content });
      setStatus(cachedNote.content.source === "heuristic" ? "Study Notes Ready" : "AI Study Notes Ready");
      addActivity({ type: "note", title: "Study note opened", detail: task.title, badge: cachedNote.content.source || "saved", target: "prep" });
      return;
    }
    setLoadingStudyTaskId((current) => addLoadingId(current, taskKey));
    setLoading(true);
    setStatus("Generating Study Notes");
    try {
      let content = generateStudyNote(plan, task);
      if (plan?.prep_plan_id) {
        const response = await apiFetch(`/study-notes/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prep_plan_id: plan.prep_plan_id,
            day: task.day || selectedPlanDay,
            title: task.title,
            topics: task.topics || [],
            instructions: task.instructions || "",
          }),
        });
        if (response.ok) content = await response.json();
      }
      setGeneratedStudyNotes((current) => {
        const next = {
          ...current,
          [cacheKey]: {
            content,
            taskTitle: task.title,
            updatedAt: new Date().toISOString(),
          },
        };
        saveLocalMap("interviewprep_generated_study_notes", next);
        return next;
      });
      setNoteReader({ task, content });
      playGeneratedSound(soundVolume);
      setStatus(content.source === "heuristic" ? "Study Notes Ready" : "AI Study Notes Ready");
      addActivity({ type: "note", title: "Study note opened", detail: task.title, badge: content.source || "", target: "prep" });
    } catch (error) {
      const fallbackContent = generateStudyNote(plan, task);
      setGeneratedStudyNotes((current) => {
        const next = {
          ...current,
          [cacheKey]: {
            content: fallbackContent,
            taskTitle: task.title,
            updatedAt: new Date().toISOString(),
          },
        };
        saveLocalMap("interviewprep_generated_study_notes", next);
        return next;
      });
      setNoteReader({
        task,
        content: fallbackContent,
      });
      playGeneratedSound(soundVolume);
      setStatus("Study Notes Ready");
    } finally {
      setLoadingStudyTaskId((current) => removeLoadingId(current, taskKey));
      setLoading(false);
    }
  }

  function finishNoteTask(task) {
    const today = dateKey(new Date());
    const taskKey = `${today}:task:${task.id || task.title}`;
    if (!completedTasks[taskKey]) {
      setCompletedTasks((current) => {
        const next = { ...current, [taskKey]: today };
        saveCompletedTasks(next);
        return next;
      });
      addActivity({ type: "practice", title: "Task completed", detail: task.title, badge: "done", target: "prep" });
      setStatus("Study Note Complete");
    } else {
      setStatus("Study Note Already Complete");
    }
    setNoteReader(null);
  }

  function saveNote(event) {
    event.preventDefault();
    if (!noteDraft.title.trim() && !noteDraft.body.trim()) return;
    const folder = noteDraft.folder.trim() || "Notes";
    const subfolder = noteDraft.subfolder?.trim() || "";
    const note = {
      id: crypto.randomUUID(),
      title: noteDraft.title.trim() || "Untitled note",
      body: noteDraft.body.trim(),
      planId: noteDraft.planId,
      folder,
      subfolder,
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [note, ...notes];
    const nextFolders = noteFolders.includes(folder) ? noteFolders : [folder, ...noteFolders];
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    setNoteDraft({ title: "", body: "", planId: noteDraft.planId, folder, subfolder });
    markStudyActivity("note-created");
    addActivity({ type: "note", title: "Note created", detail: note.title, badge: folder, target: "notes" });
    setStatus("Note Saved");
  }

  function importNotes(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ""),
        body: String(reader.result || ""),
        planId: noteDraft.planId,
        folder: noteDraft.folder.trim() || "Imported Notes",
        subfolder: noteDraft.subfolder?.trim() || "",
        createdAt: new Date().toISOString(),
      };
      const nextNotes = [imported, ...notes];
      setNotes(nextNotes);
      saveLocalList("interviewprep_notes", nextNotes);
      markStudyActivity("note-imported");
      addActivity({ type: "note", title: "Note imported", detail: imported.title, badge: "import", target: "notes" });
      setStatus("Note Imported");
    };
    reader.readAsText(file);
  }

  async function generateWorkspaceNote(planId, folder = "Generated Notes", subfolder = "") {
    if (!planId) {
      setStatus("Select A Job First");
      return;
    }
    setLoading(true);
    setStatus("Generating Workspace Note");
    try {
      const response = await apiFetch(`/prep-plans/${planId}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const planDetail = await response.json();
      const noteTask = buildDailyStudyTasks(planDetail, 1).find((task) => task.task_type === "study_note");
      if (!noteTask) throw new Error("No study topic found for this plan");
      let content = generateStudyNote(planDetail, noteTask);
      const generatedResponse = await apiFetch(`/study-notes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prep_plan_id: planDetail.prep_plan_id,
          day: noteTask.day || 1,
          title: noteTask.title,
          topics: noteTask.topics || [],
          instructions: noteTask.instructions || "",
        }),
      });
      if (generatedResponse.ok) content = await generatedResponse.json();
      const finalFolder = folder?.trim() || "Generated Notes";
      const generatedNote = {
        id: crypto.randomUUID(),
        title: content.title || noteTask.title,
        body: studyNoteContentToText(content),
        planId,
        folder: finalFolder,
        subfolder: subfolder?.trim() || "",
        generated: true,
        createdAt: new Date().toISOString(),
      };
      const nextNotes = [generatedNote, ...notes];
      const nextFolders = noteFolders.includes(finalFolder) ? noteFolders : [finalFolder, ...noteFolders];
      setNotes(nextNotes);
      setNoteFolders(nextFolders);
      saveLocalList("interviewprep_notes", nextNotes);
      saveLocalList("interviewprep_note_folders", nextFolders);
      playGeneratedSound(soundVolume);
      markStudyActivity("note-generated");
      addActivity({ type: "note", title: "Workspace note generated", detail: generatedNote.title, badge: "AI", target: "notes" });
      setStatus("Workspace Note Generated");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function removeNote(noteId) {
    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    saveLocalList("interviewprep_notes", nextNotes);
  }

  function createBlankNote({ title, folder = "Notes", planId = "" }) {
    const cleanFolder = normalizeNoteFolder(folder);
    const note = {
      id: crypto.randomUUID(),
      title: title.trim() || "Untitled note",
      body: "",
      planId,
      folder: cleanFolder,
      subfolder: "",
      color: "#2563eb",
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [note, ...notes];
    const nextFolders = cleanFolder !== "Notes" && !noteFolders.includes(cleanFolder) ? [cleanFolder, ...noteFolders] : noteFolders;
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Note created", detail: note.title, badge: cleanFolder, target: "notes" });
    setStatus("Note Created");
    return note.id;
  }

  function updateNote(noteId, patch) {
    const nextNotes = notes.map((note) => (
      note.id === noteId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
    ));
    const nextFolders = patch.folder && !noteFolders.includes(patch.folder) ? [patch.folder, ...noteFolders] : noteFolders;
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Note updated", detail: patch.title || "Saved note", badge: "saved", target: "notes" });
    setStatus("Note Updated");
  }

  async function improveSavedNote(noteId, role = "", draftOverride = null) {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;
    const sourceNote = draftOverride ? { ...note, ...draftOverride } : note;
    setImprovingNoteId(noteId);
    setStatus("Improving Note With AI");
    try {
      const response = await apiFetch(`/study-notes/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sourceNote.title,
          body: sourceNote.body,
          role,
          folder: normalizeNoteFolder(sourceNote.folder),
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const improved = await response.json();
      updateNote(noteId, {
        title: improved.title || sourceNote.title,
        body: improved.body || sourceNote.body,
        folder: normalizeNoteFolder(sourceNote.folder),
        subfolder: sourceNote.subfolder || "",
        color: improved.color || sourceNote.color || "#2563eb",
      });
      playGeneratedSound(soundVolume);
      setStatus(improved.source === "openai" ? "Note Improved With AI" : "Note Improved");
    } catch (error) {
      updateNote(noteId, {
        ...sourceNote,
        body: improveNoteLocally(sourceNote),
      });
      setStatus("Note Improved Locally");
    } finally {
      setImprovingNoteId("");
    }
  }

  function createNoteFolder(folderName) {
    const folder = folderName.trim();
    if (!folder) return;
    if (noteFolders.includes(folder)) {
      setStatus("Folder Already Exists");
      return;
    }
    const nextFolders = [folder, ...noteFolders];
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Folder created", detail: folder, badge: "folder", target: "notes" });
    setStatus("Folder Created");
  }

  function deleteNoteFolder(folderName) {
    const deletedCount = notes.filter((note) => normalizeNoteFolder(note.folder) === folderName).length;
    const nextNotes = notes.filter((note) => normalizeNoteFolder(note.folder) !== folderName);
    const nextFolders = noteFolders.filter((folder) => folder !== folderName);
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Folder deleted", detail: `${folderName} and ${deletedCount} notes removed`, badge: "folder", target: "notes" });
    setStatus("Folder Removed");
  }

  function addCalendarEvent(event) {
    event.preventDefault();
    if (!eventDraft.title.trim()) return;
    const nextEvent = { ...eventDraft, id: crypto.randomUUID(), source: "user" };
    const nextEvents = [nextEvent, ...calendarEvents];
    setCalendarEvents(nextEvents);
    saveLocalList("interviewprep_calendar_events", nextEvents);
    setEventDraft({ ...eventDraft, title: "", link: "" });
    setStatus("Calendar Event Added");
  }

  function addGeneratedCalendarEvent(title, type, color, day = 1, eventPlan = plan) {
    const date = new Date();
    date.setDate(date.getDate() + Math.max(0, day - 1));
    const nextEvent = {
      id: crypto.randomUUID(),
      source: "user",
      title,
      type,
      color,
      date: dateKey(date),
      link: "",
      jobPostId: eventPlan?.job_post_id,
      prepPlanId: eventPlan?.prep_plan_id,
    };
    setCalendarEvents((current) => {
      const nextEvents = [nextEvent, ...current];
      saveLocalList("interviewprep_calendar_events", nextEvents);
      return nextEvents;
    });
  }

  function removeCalendarEvent(eventId) {
    const nextEvents = calendarEvents.filter((event) => event.id !== eventId);
    setCalendarEvents(nextEvents);
    saveLocalList("interviewprep_calendar_events", nextEvents);
  }

  function removeCalendarEventsForJobs(jobIds, jobTitles = []) {
    const idSet = new Set(jobIds.map((id) => String(id)));
    const loweredTitles = jobTitles.filter(Boolean).map((title) => title.toLowerCase());
    setCalendarEvents((current) => {
      const nextEvents = current.filter((event) => {
        const linkedToJob = event.jobPostId && idSet.has(String(event.jobPostId));
        const titleMatchesOldEvent = loweredTitles.some((title) => (event.title || "").toLowerCase().includes(title));
        return !linkedToJob && !titleMatchesOldEvent;
      });
      saveLocalList("interviewprep_calendar_events", nextEvents);
      return nextEvents;
    });
  }

  function openAuth(modeName) {
    setAuthMode(modeName);
    setAuthMessage("");
    setAuthOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");

    try {
      if (authMode === "register" && !isStrongPassword(authForm.password)) {
        throw new Error("Password must be 8+ characters and include at least one letter and one number.");
      }
      const endpoint = authMode === "register" ? "register" : "login";
      const payload = authMode === "register"
        ? authForm
        : { email: authForm.email, password: authForm.password };

      const response = await apiFetch(`/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `API returned ${response.status}`);

      setUser(body.user);
      setAuthToken(body.access_token);
      saveUserSession(body.user, body.access_token);
      setAuthOpen(false);
      setAuthForm({ name: "", email: body.user.email, password: "" });
      reloadLocalWorkspaceState();
      setStatus(authMode === "register" ? "Account Created" : "Logged In");
      refreshJobs(jobMarkers, archivedJobIds, body.access_token);
      refreshSavedPlans(archivedJobIds, body.access_token);
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setAuthToken("");
    saveUserSession(null, "");
    reloadLocalWorkspaceState();
    setJobs([]);
    setSavedPlans([]);
    setPlan(null);
    clearVisibleWorkspaceState();
    setStatus("Guest Mode");
  }

  const activity = recentActivity.map((item) => ({ ...item, time: relativeTime(item.createdAt), target: item.target || targetForActivity(item.type) }));

  function openActivity(item) {
    setActiveView(item.target || targetForActivity(item.type));
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} theme-${theme}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveView("dashboard")}>
          <BrainCircuit size={25} />
          <span>InterviewPrep AI</span>
        </button>

        <nav className="nav-main">
          <NavItem icon={Home} label="Dashboard" active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} />
          <NavItem icon={BriefcaseBusiness} label="Jobs" active={activeView === "jobs"} onClick={() => setActiveView("jobs")} />
          <NavItem icon={ClipboardList} label="Prep Plan" active={activeView === "prep"} onClick={() => setActiveView("prep")} />
          <NavItem icon={Gauge} label="Exams" active={activeView === "exams"} onClick={() => setActiveView("exams")} />
          <NavItem icon={Database} label="Interview Data" active={activeView === "data"} onClick={() => setActiveView("data")} />
        </nav>

        <nav className="nav-secondary">
          <NavItem icon={BarChart3} label="Analytics" active={activeView === "analytics"} onClick={() => setActiveView("analytics")} />
          <NavItem icon={Activity} label="Progress" active={activeView === "progress"} onClick={() => setActiveView("progress")} />
          <NavItem icon={CalendarDays} label="Calendar" active={activeView === "calendar"} onClick={() => setActiveView("calendar")} />
          <NavItem icon={NotebookText} label="Notes" active={activeView === "notes"} onClick={() => setActiveView("notes")} />
        </nav>

        <div className="streak-card">
          <div className="streak-head">
            <Flame size={20} />
            <strong>Study Streak</strong>
          </div>
          <p><span>{streak.count}</span> days</p>
          <small>{streak.count ? "Keep it up!" : "Start today to build your streak."}</small>
          <div className="streak-dots">
            {streak.week.map((day) => (
              <div key={day.key}>
                <i className={day.done ? "done" : ""}>{day.done ? <Check size={11} /> : ""}</i>
                <em>{day.label}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <NavItem icon={Settings} label="Settings" active={settingsOpen} onClick={() => setSettingsOpen((current) => !current)} settingsToggle />
          <NavItem icon={LogOut} label="Log out" onClick={logout} />
          {settingsOpen && (
            <>
              <button type="button" className="settings-dismiss-layer" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
              <SettingsView
                user={user}
                status={status}
                theme={theme}
                setTheme={setTheme}
                soundVolume={soundVolume}
                setSoundVolume={setSoundVolume}
                deletedJobs={deletedJobs}
                extensionState={extensionState}
                restoreDeletedJob={restoreDeletedJob}
                clearDeletedJob={clearDeletedJob}
                loading={loading}
                onToggleExtension={toggleExtensionBubble}
                onInstallExtension={() => window.open(EXTENSION_GUIDE_URL, "_blank", "noopener,noreferrer")}
                onRefreshExtension={refreshExtensionState}
                onClose={() => setSettingsOpen(false)}
                onKnowMore={() => {
                  setSettingsOpen(false);
                  setActiveView("about");
                }}
              />
            </>
          )}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-button" onClick={() => setSidebarCollapsed((current) => !current)}><Menu size={19} /></button>
            <h1>{viewTitle(activeView)}</h1>
          </div>
          <div className="top-actions">
            <StatusIndicator status={status} />
            <button className="icon-button"><BookOpen size={20} /></button>
            <button className="icon-button notification"><Bell size={20} /><span>3</span></button>
            {user ? (
              <div className="profile account-profile">
                <span>{initialsFor(user.name)}</span>
                <strong>{user.name}</strong>
                <button className="icon-button" title="Log out" onClick={logout}><LogOut size={17} /></button>
              </div>
            ) : (
              <div className="guest-auth">
                <div className="profile guest-profile"><span>G</span><strong>Guest</strong></div>
                <button className="auth-link" onClick={() => openAuth("login")}><LogIn size={16} /> Login</button>
                <button className="auth-primary" onClick={() => openAuth("register")}><UserPlus size={16} /> Create Account</button>
              </div>
            )}
          </div>
        </header>

        {activeView === "dashboard" && <section className="dashboard-grid">
          <form className="panel create-panel" onSubmit={generatePlan} autoComplete="off">
            <PanelTitle icon={Sparkles} title="Create New Prep Plan" subtitle="Analyze the job and get a personalized plan." />

            <div className="segmented">
              <button type="button" className={mode === "paste" ? "selected" : ""} onClick={() => setMode("paste")}>
                <ClipboardList size={16} /> Paste Description
              </button>
              <button type="button" className={mode === "url" ? "selected" : ""} onClick={() => setMode("url")}>
                <Link size={16} /> Job URL
              </button>
            </div>

            <div className="form-grid">
              <label>
                Job Title <span>(AI can detect)</span>
                <input autoComplete="off" placeholder="Optional: Backend Intern, Data Analyst..." value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
              </label>
              <label>
                Company <span>(AI can detect)</span>
                <input autoComplete="off" placeholder="Optional: Amazon, Google, ExampleTech..." value={company} onChange={(event) => setCompany(event.target.value)} />
              </label>
            </div>

            {mode === "paste" ? (
              <label>
                Job Description <sup>*</sup>
                <textarea
                  placeholder="Paste the full job description here..."
                  autoComplete="off"
                  value={jobDescription}
                  maxLength={8000}
                  onChange={(event) => setJobDescription(event.target.value)}
                />
                <small className="char-count">{jobDescription.length} / 8000</small>
              </label>
            ) : (
              <label>
                Job URL <sup>*</sup>
                <input autoComplete="off" placeholder="https://company.com/jobs/backend-intern" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
              </label>
            )}

            <div className="form-grid">
              <label>
                Interview Date <sup>*</sup>
                <div className="input-icon"><Calendar size={16} /><input autoComplete="off" type="datetime-local" min={minInterviewDateTime()} value={interviewDate} onChange={(event) => setInterviewDate(normalizeFutureInterviewDate(event.target.value))} /></div>
              </label>
              <label>
                Hours Per Day <sup>*</sup>
                <div className="input-icon"><Clock3 size={16} /><input autoComplete="off" type="number" min="0.5" max="10" step="0.5" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} /></div>
              </label>
            </div>

            <div className="form-footer">
              <div className="info-strip"><Info size={17} /> We will extract key skills, topics and create a custom plan for you.</div>
              <div className="form-actions">
                <button type="button" className="outline-action" disabled={loading} onClick={saveJobOnly}>
                  <Save size={16} /> Save Job
                </button>
                <button className="primary" disabled={loading}>
                  {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                  Generate Prep Plan
                </button>
              </div>
            </div>
          </form>

          <section className="panel saved-panel">
            <PanelTitle icon={BriefcaseBusiness} title="Saved Jobs" action="View all" onAction={() => setActiveView("jobs")} />
            <div className="saved-list saved-list-scroll">
              {jobs.length ? (
                jobs.map((job) => (
                  <SavedJob
                    key={job.id}
                    job={job}
                    onSelect={useSavedJob}
                    menuOpen={jobActionMenuId === job.id}
                    onToggleMenu={setJobActionMenuId}
                    onRequestDelete={setConfirmDeleteJob}
                    onOpenDescription={openJobDescription}
                  />
                ))
              ) : (
                <div className="compact-empty-state">
                  <BriefcaseBusiness size={20} />
                  <strong>No saved jobs yet</strong>
                  <span>Save a job or generate a prep plan to see it here.</span>
                </div>
              )}
            </div>
            <button className="text-action" onClick={() => setJobModalOpen(true)}><Plus size={16} /> Add Job Manually</button>
          </section>

          <section className="panel plan-panel">
            <PanelTitle
              icon={CalendarDays}
              title="Your Prep Plan"
              badge={plan ? `${plan.days_until_interview} days to interview` : "18 days to interview"}
              secondaryBadge={plan ? sourceLabel(plan.plan_source) : "sample plan"}
              action="View Full Plan"
              onAction={openFullPlan}
            />
            <PlanStepper days={planDays} selectedDay={selectedPlanDay} onSelectDay={setSelectedPlanDay} />
            <PlanDayCarousel
              days={planDays}
              selectedDay={selectedPlanDay}
              completedTasks={completedTasks}
              plan={plan}
              onSelectDay={setSelectedPlanDay}
              showArrows={false}
            />

            <div className="upcoming-head">Upcoming Tasks (Day {selectedPlanDay})</div>
            <div className="task-table">
              {visibleTasks.slice(0, 4).map((task, index) => (
                <div className={`task-row study-task-row ${task.task_type === "practice_exam" ? "exam-task" : ""}`} key={task.id || task.title}>
                  <div>
                    <input
                      type="checkbox"
                      checked={Boolean(completedTasks[`${dateKey(new Date())}:task:${task.id || task.title}`])}
                      onChange={() => toggleTaskDone(task)}
                    />
                    <span>{task.title}</span>
                  </div>
                  <small>{task.topics?.join(", ") || ["Python", "Data Structures", "SQL"][index % 3]}</small>
                  <em>{task.task_type === "practice_exam" ? "Practice exam" : "Study notes"}</em>
                  <button type="button" onClick={() => startStudyTask(task)} disabled={isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId)}>
                    {isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId) ? <><Loader2 className="spin" size={15} /> Generating...</> : isStudyNoteGenerated(task) ? "Open" : "Start"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="panel activity-panel">
            <PanelTitle icon={Activity} title="Recent Activity" action="View all" />
            <div className="activity-list">
              {activity.length ? (
                activity.slice(0, 5).map((item, index) => (
                  <ActivityRow key={`${item.title}-${index}`} item={item} onClick={() => openActivity(item)} />
                ))
              ) : (
                <div className="compact-empty-state">
                  <Activity size={20} />
                  <strong>No recent activity</strong>
                  <span>Your generated plans, notes, exams, and mock interviews will appear here.</span>
                </div>
              )}
            </div>
            <button className="text-action">View All Activity</button>
          </section>
        </section>}

        {activeView === "jobs" && (
          <JobsView
            jobs={jobs}
            onSelectJob={useSavedJob}
            onOpenDescription={openJobDescription}
            menuId={jobActionMenuId}
            onToggleMenu={setJobActionMenuId}
            onRequestDelete={setConfirmDeleteJob}
            selectedJobIds={selectedJobIds}
            setSelectedJobIds={setSelectedJobIds}
            onRequestBulkDelete={() => setConfirmBulkDeleteJobs(true)}
            loading={loading}
            onOpenPlan={async (prepPlanId) => {
              await loadPrepPlan(prepPlanId);
              setActiveView("prep");
            }}
            savedPlans={savedPlans}
            removePrepPlan={removePrepPlan}
            jobMarkers={jobMarkers}
          />
        )}

        {activeView === "prep" && (
          <PrepPlanView
            plan={plan}
            savedPlans={savedPlans}
            selectedPlanDay={selectedPlanDay}
            setSelectedPlanDay={setSelectedPlanDay}
            completedTasks={completedTasks}
            toggleTaskDone={toggleTaskDone}
            loadPrepPlan={loadPrepPlan}
            removePrepPlan={removePrepPlan}
            generateExam={generateExam}
            startStudyTask={startStudyTask}
            isStudyNoteGenerated={isStudyNoteGenerated}
            loading={loading}
            loadingStudyTaskId={loadingStudyTaskId}
            loadingExamTaskId={loadingExamTaskId}
            jobMarkers={jobMarkers}
          />
        )}

        {activeView === "exams" && (
          <ExamsView
            plan={plan}
            savedPlans={savedPlans}
            planSearch={planSearch}
            setPlanSearch={setPlanSearch}
            loadPrepPlan={loadPrepPlan}
            exam={exam}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            examSettings={examSettings}
            setExamSettings={setExamSettings}
            selectedPlanDay={selectedPlanDay}
            examAnswers={examAnswers}
            setExamAnswers={setExamAnswers}
            examResult={examResult}
            generateExam={generateExam}
            scheduleMockInterviewAttempt={scheduleMockInterviewAttempt}
            startExamAttempt={startExamAttempt}
            startMockAttempt={startMockAttempt}
            openExamReview={setExamReview}
            openMockReview={setMockReview}
            requestDeleteAttempt={setConfirmDeleteAttempt}
            submitExamAnswers={submitExamAnswers}
            loading={loading}
            jobMarkers={jobMarkers}
          />
        )}

        {activeView === "calendar" && (
          <CalendarView
            plan={plan}
            planColor={colorForPlan(plan, jobMarkers)}
            calendarPlanDetails={calendarPlanDetails}
            jobMarkers={jobMarkers}
            completedTasks={completedTasks}
            toggleTaskDone={toggleTaskDone}
            generateExam={generateExam}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            calendarEvents={calendarEvents}
            eventDraft={eventDraft}
            setEventDraft={setEventDraft}
            addCalendarEvent={addCalendarEvent}
            removeCalendarEvent={removeCalendarEvent}
          />
        )}

        {activeView === "notes" && (
          <NotesView
            savedPlans={savedPlans}
            notes={notes}
            noteFolders={noteFolders}
            noteDraft={noteDraft}
            setNoteDraft={setNoteDraft}
            saveNote={saveNote}
            importNotes={importNotes}
            removeNote={removeNote}
            createBlankNote={createBlankNote}
            updateNote={updateNote}
            improveSavedNote={improveSavedNote}
            improvingNoteId={improvingNoteId}
            createNoteFolder={createNoteFolder}
            deleteNoteFolder={deleteNoteFolder}
            generateWorkspaceNote={generateWorkspaceNote}
            loading={loading}
          />
        )}

        {activeView === "progress" && (
          <ProgressView
            plan={plan}
            completedTasks={completedTasks}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            recentActivity={activity}
            savedPlans={savedPlans}
            jobs={jobs}
            onOpenPlan={async (prepPlanId) => {
              await loadPrepPlan(prepPlanId);
              setActiveView("prep");
            }}
          />
        )}

        {activeView === "about" && (
          <AboutView onBack={() => { setActiveView("dashboard"); setSettingsOpen(true); }} />
        )}

        {activeView === "analytics" && (
          <AnalyticsDevelopmentView />
        )}

        {!["dashboard", "jobs", "prep", "exams", "calendar", "notes", "progress", "about", "analytics"].includes(activeView) && (
          <PlaceholderView title={viewTitle(activeView)} />
        )}

        <footer>© 2026 InterviewPrep AI. All rights reserved. <span>Version 0.1.0</span></footer>
      </main>

      {authOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="auth-modal" onSubmit={submitAuth}>
            <div className="modal-head">
              <div>
                <h2>{authMode === "register" ? "Create account" : "Login"}</h2>
                <p>{authMode === "register" ? "Save your interview prep under your own account." : "Continue with your saved account."}</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            </div>

            {authMode === "register" && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  placeholder="Your name"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            {authMode === "register" && (
              <PasswordCriteria password={authForm.password} />
            )}

            {authMessage && <div className="auth-error">{authMessage}</div>}

            <button className="primary auth-submit" disabled={authLoading}>
              {authLoading ? <Loader2 className="spin" size={16} /> : authMode === "register" ? <UserPlus size={16} /> : <LogIn size={16} />}
              {authMode === "register" ? "Create Account" : "Login"}
            </button>
            <button
              type="button"
              className="switch-auth"
              onClick={() => {
                setAuthMessage("");
                setAuthMode(authMode === "register" ? "login" : "register");
              }}
            >
              {authMode === "register" ? "Already have an account? Login" : "New here? Create an account"}
            </button>
          </form>
        </div>
      )}

      {jobModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="auth-modal job-modal" onSubmit={saveManualJob}>
            <div className="modal-head">
              <div>
                <h2>Add job manually</h2>
                <p>Save a job first, then generate a prep plan whenever you are ready.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setJobModalOpen(false)}><X size={18} /></button>
            </div>
            <label>
              Job Title
              <input value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} required />
            </label>
            <label>
              Job URL <span>(optional)</span>
              <input value={jobDraft.sourceUrl} onChange={(event) => setJobDraft({ ...jobDraft, sourceUrl: event.target.value })} placeholder="company.com/jobs/intern" />
            </label>
            <label>
              Job Description
              <textarea value={jobDraft.description} onChange={(event) => setJobDraft({ ...jobDraft, description: event.target.value })} placeholder="Paste job description..." />
            </label>
            <label>
              Color Marker
              <input type="color" value={jobDraft.color} onChange={(event) => setJobDraft({ ...jobDraft, color: event.target.value })} />
            </label>
            <button className="primary auth-submit" disabled={loading}><Save size={16} /> Save Job</button>
          </form>
        </div>
      )}

      {confirmDeleteJob && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal confirm-modal">
            <div className="modal-head">
              <div>
                <h2>Delete saved job?</h2>
                <p>Are you sure you want to delete {confirmDeleteJob.title}? This will remove the saved job from your list.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setConfirmDeleteJob(null)}><X size={18} /></button>
            </div>
            <div className="confirm-actions">
              <button className="outline-action" onClick={() => setConfirmDeleteJob(null)}>Cancel</button>
              <button className="danger-action" onClick={() => deleteSavedJob(confirmDeleteJob.id)}>Delete Job</button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDeleteJobs && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <div className="confirm-icon danger"><Trash2 size={20} /></div>
            <div>
              <h3>Delete selected jobs?</h3>
              <p>Are you sure you want to delete {selectedJobIds.length} saved jobs? This will remove them from your saved jobs list.</p>
            </div>
            <div className="confirm-actions">
              <button className="outline-action" onClick={() => setConfirmBulkDeleteJobs(false)}>Cancel</button>
              <button className="danger-action" onClick={deleteSelectedJobs}>Delete Selected</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAttempt && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal confirm-modal">
            <div className="modal-head">
              <div>
                <h2>Delete attempt?</h2>
                <p>Are you sure you want to delete this {confirmDeleteAttempt.kind === "exam" ? "exam" : "mock interview"} attempt? This removes it from the Exams page.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setConfirmDeleteAttempt(null)}><X size={18} /></button>
            </div>
            <div className="confirm-actions">
              <button className="outline-action" onClick={() => setConfirmDeleteAttempt(null)}>Cancel</button>
              <button className="danger-action" onClick={() => deleteAttempt(confirmDeleteAttempt.kind, confirmDeleteAttempt.id)}>Delete Attempt</button>
            </div>
          </div>
        </div>
      )}

      {practiceExamPrompt && (
        <DifficultyPromptModal
          prompt={practiceExamPrompt}
          onClose={() => setPracticeExamPrompt(null)}
          onChoose={(difficulty) => {
            const settingsOverride = settingsForDifficulty(difficulty);
            const prompt = practiceExamPrompt;
            setPracticeExamPrompt(null);
            generateExam(prompt.day, {
              focusTopics: prompt.focusTopics,
              taskKey: prompt.taskKey,
              settingsOverride,
            });
          }}
        />
      )}

      {examSession && exam && (
        <ExamSessionModal
          exam={exam}
          session={examSession}
          answers={examAnswers}
          setAnswers={setExamAnswers}
          onMove={moveExamQuestion}
          onJump={(index) => setExamSession((current) => ({ ...current, questionIndex: index }))}
          onSubmit={submitExamAnswers}
          onClose={() => setExamSession(null)}
          loading={loading}
        />
      )}

      {mockSession && (
        <MockInterviewModal
          session={mockSession}
          setSession={setMockSession}
          onSubmit={submitMockSessionAnswer}
          onExit={exitMockSession}
          onClose={() => setMockSession(null)}
          loading={loading}
        />
      )}

      {examReview && (
        <ExamReviewModal
          review={examReview}
          onClose={() => setExamReview(null)}
        />
      )}

      {mockReview && (
        <MockReviewModal
          review={mockReview}
          onClose={() => setMockReview(null)}
        />
      )}

      {noteReader && (
        <StudyNoteModal
          reader={noteReader}
          onDone={() => finishNoteTask(noteReader.task)}
          onClose={() => setNoteReader(null)}
        />
      )}

      {jobBrief && (
        <JobDescriptionModal
          jobBrief={jobBrief}
          loading={jobBriefLoading}
          question={jobBriefQuestion}
          setQuestion={setJobBriefQuestion}
          answers={jobBriefAnswers}
          onAsk={askJobBriefQuestion}
          onClose={() => setJobBrief(null)}
        />
      )}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, settingsToggle = false }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick} data-settings-toggle={settingsToggle ? "true" : undefined}>
      <Icon size={20} />
      {label}
    </button>
  );
}

function PanelTitle({ icon: Icon, title, subtitle, action, badge, secondaryBadge, onAction }) {
  return (
    <div className="panel-title">
      <div>
        <Icon size={20} />
        <div>
          <h2>{title} {badge && <span>{badge}</span>} {secondaryBadge && <em>{secondaryBadge}</em>}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {action && <button type="button" onClick={onAction}>{action}{action.includes("Plan") && <ExternalLink size={14} />}</button>}
    </div>
  );
}

function SavedJob({ job, onSelect, menuOpen, onToggleMenu, onRequestDelete, onOpenDescription, selectable = false, selected = false, onToggleSelect }) {
  return (
    <div className={`saved-row ${selectable ? "selectable" : ""}`} role="button" tabIndex={0} onClick={() => onSelect?.(job)}>
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => {
            event.stopPropagation();
            onToggleSelect?.(job.id);
          }}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${job.title}`}
        />
      )}
      <span className="job-color-dot" style={{ background: job.color || "#2563eb" }} />
      <div className={`job-logo ${job.tone || ""}`} style={{ borderLeft: `4px solid ${job.color || "#2563eb"}` }}>{job.logo || logoFor(job.title, job.source_url)}</div>
      <div className="job-info">
        <strong>{job.title}</strong>
        <span>{job.company || companyFromUrl(job.source_url) || job.description_preview || "Saved Job"}</span>
      </div>
      <small>{job.saved_at || "Saved"}</small>
      <a href={normalizeUrl(job.source_url)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        {displayUrl(job.source_url)} <ExternalLink size={13} />
      </a>
      <button
        type="button"
        className="description-chip"
        onClick={(event) => {
          event.stopPropagation();
          onOpenDescription?.(job);
        }}
      >
        Description
      </button>
      <div className="job-menu-wrap">
        <button className="more" title="Job actions" onClick={(event) => { event.stopPropagation(); onToggleMenu?.(menuOpen ? null : job.id); }}><MoreVertical size={18} /></button>
        {menuOpen && (
          <div className="job-action-menu" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => onRequestDelete?.(job)}>Delete saved job</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanStepper({ days, selectedDay, onSelectDay }) {
  return (
    <div className="stepper">
      {days.map((day, index) => (
        <button type="button" className={`step ${day.day === selectedDay ? "selected" : ""}`} key={day.day} onClick={() => onSelectDay(day.day)}>
          <span className={day.isFinal ? "final" : ""}>{day.isFinal ? <Check size={16} /> : index + 1}</span>
          <strong>{day.isFinal ? "Final" : `Day ${day.day}`}</strong>
          <small>{day.label}</small>
        </button>
      ))}
    </div>
  );
}

function PlanDayCarousel({ days, selectedDay, completedTasks, plan, onSelectDay, compact = false, showArrows = true }) {
  const scrollerRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const userScrollRef = useRef(false);
  function move(direction) {
    userScrollRef.current = true;
    scrollerRef.current?.scrollBy({ left: direction * 500, behavior: "smooth" });
  }

  useEffect(() => {
    const selectedCard = scrollerRef.current?.querySelector(`[data-day="${selectedDay}"]`);
    if (!selectedCard) return undefined;
    programmaticScrollRef.current = true;
    selectedCard?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 420);
    return () => window.clearTimeout(timer);
  }, [selectedDay, days.length]);

  function markUserScroll() {
    if (!programmaticScrollRef.current) userScrollRef.current = true;
  }

  function syncSelectedDayFromScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || programmaticScrollRef.current || !userScrollRef.current) return;
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const cards = [...scroller.querySelectorAll("[data-day]")];
      if (!cards.length) return;
      const center = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
      const closest = cards.reduce((best, card) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        return !best || distance < best.distance ? { card, distance } : best;
      }, null);
      const day = Number(closest?.card?.dataset?.day);
      if (day && day !== selectedDay) onSelectDay(day);
      userScrollRef.current = false;
    }, 120);
  }

  return (
    <div className={`plan-carousel ${compact ? "compact" : ""} ${showArrows ? "" : "no-arrows"}`}>
      {showArrows && (
        <button type="button" className="carousel-arrow" aria-label="Previous days" onClick={() => move(-1)}>
          <ChevronRight size={18} />
        </button>
      )}
      <div
        className={`plan-cards ${compact ? "compact-plan-cards" : ""}`}
        ref={scrollerRef}
        onScroll={syncSelectedDayFromScroll}
        onWheel={markUserScroll}
        onPointerDown={markUserScroll}
        onTouchStart={markUserScroll}
      >
        {days.map((day, index) => (
          <PlanDayCard
            key={day.day}
            day={day}
            index={index}
            selected={day.day === selectedDay}
            completed={isPlanDayComplete(plan, day.day, completedTasks)}
            onSelect={() => onSelectDay(day.day)}
          />
        ))}
      </div>
      {showArrows && (
        <button type="button" className="carousel-arrow" aria-label="Next days" onClick={() => move(1)}>
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function PlanDayCard({ day, index, selected, completed, onSelect }) {
  const tones = ["blue", "purple", "orange", "green"];
  const icons = [ClipboardList, FileQuestion, UserRound, NotebookText];
  const Icon = iconForDay(day) || icons[index % icons.length];
  const tasks = day.tasks?.slice(0, 3) || [];
  const statusText = completed ? "Completed" : selected ? "Selected" : "Pending";
  const statusClass = completed ? "status-complete" : selected ? "status-progress" : "status-pending";
  return (
    <button type="button" data-day={day.day} className={`plan-day-card ${selected ? "selected" : ""} ${completed ? "completed" : ""}`} onClick={onSelect}>
      <div className={`card-icon ${tones[index % tones.length]}`}>
        <Icon size={17} />
      </div>
      <strong>{day.title}</strong>
      <ul>
        {(tasks.length ? tasks : sampleTasks().slice(0, 3)).map((task) => (
          <li key={task.id || task.title}><Check size={13} /> {task.title}</li>
        ))}
      </ul>
      <span className={statusClass}>{statusText}</span>
    </button>
  );
}

function ActivityRow({ item, onClick }) {
  const { type, title, detail, time, badge } = item;
  const Icon = type === "exam" ? CheckCircle2 : type === "plan" ? ClipboardList : type === "practice" ? FileQuestion : type === "mock" ? MessageSquareText : BriefcaseBusiness;
  return (
    <button className="activity-row" onClick={onClick}>
      <div className={`activity-icon ${type}`}><Icon size={18} /></div>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <small>{time}</small>
      {badge && <em>{badge}</em>}
    </button>
  );
}

function DifficultyPromptModal({ prompt, onChoose, onClose }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="auth-modal difficulty-modal">
        <div className="modal-head">
          <div>
            <h2>Choose exam difficulty</h2>
            <p>{prompt.task?.title || `Practice exam for Day ${prompt.day}`}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="difficulty-grid">
          {["easy", "medium", "hard"].map((difficulty) => {
            const preset = settingsForDifficulty(difficulty);
            return (
              <button type="button" key={difficulty} onClick={() => onChoose(difficulty)}>
                <strong>{difficulty}</strong>
                <span>{preset.questionCount} questions</span>
                <small>{preset.timeLimit} min • AI chooses question types</small>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExamSessionModal({ exam, session, answers, setAnswers, onMove, onJump, onSubmit, onClose, loading }) {
  const question = exam.questions[session.questionIndex];
  const answeredCount = exam.questions.filter((item) => answers[item.id]?.trim?.() || answers[item.id]).length;
  return (
    <div className="exam-modal-backdrop" role="dialog" aria-modal="true">
      <div className="exam-shell">
        {loading && (
          <div className="exam-evaluating-overlay">
            <Loader2 className="spin" size={28} />
            <strong>Evaluating your exam</strong>
            <span>Checking answers, expected reasoning, and interview readiness...</span>
          </div>
        )}
        <header className="exam-topbar">
          <div>
            <strong>{exam.title}</strong>
            <span>{answeredCount}/{exam.questions.length} answered</span>
          </div>
          <div className={`exam-timer ${session.remainingSeconds < 300 ? "warning" : ""}`}>
            <Clock3 size={17} /> {formatSeconds(session.remainingSeconds)}
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>

        <aside className="question-map">
          {exam.questions.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`${index === session.questionIndex ? "current" : ""} ${answers[item.id] ? "answered" : ""}`}
              onClick={() => onJump(index)}
            >
              {answers[item.id] ? <Check size={14} /> : index + 1}
            </button>
          ))}
        </aside>

        <main className="exam-stage">
          <div className="exam-question-focus">
            <span>Question {session.questionIndex + 1} of {exam.questions.length}</span>
            <h2>{question.prompt}</h2>
            {question.options?.length ? (
              <div className="exam-options large">
                {question.options.map((option) => (
                  <label key={option.label}>
                    <input
                      type={question.question_type === "multiple_select" ? "checkbox" : "radio"}
                      name={`session-question-${question.id}`}
                      value={option.label}
                      checked={question.question_type === "multiple_select"
                        ? String(answers[question.id] || "").split(",").includes(option.label)
                        : answers[question.id] === option.label}
                      onChange={(event) => {
                        if (question.question_type !== "multiple_select") {
                          setAnswers({ ...answers, [question.id]: event.target.value });
                          return;
                        }
                        const current = String(answers[question.id] || "").split(",").filter(Boolean);
                        const next = event.target.checked ? [...current, option.label] : current.filter((label) => label !== option.label);
                        setAnswers({ ...answers, [question.id]: next.join(",") });
                      }}
                    />
                    <strong>{option.label}</strong>
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                placeholder="Type your answer..."
                value={answers[question.id] || ""}
                onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
              />
            )}
            <small>{question.topics.join(", ")}</small>
          </div>
        </main>

        <footer className="exam-footer">
          <button type="button" className="outline-action" onClick={() => onMove(-1)} disabled={session.questionIndex === 0}>Previous</button>
          <button type="button" className="outline-action" onClick={() => onMove(1)} disabled={session.questionIndex === exam.questions.length - 1}>Next</button>
          <button type="button" className="danger-action" disabled={loading} onClick={() => onSubmit()}>
            {loading ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
            Submit Exam
          </button>
        </footer>
      </div>
    </div>
  );
}

function ExamReviewModal({ review, onClose }) {
  const { exam, result, answers } = review;
  const resultByQuestion = Object.fromEntries((result?.results || []).map((item) => [item.question_id, item]));
  return (
    <div className="exam-modal-backdrop review-backdrop" role="dialog" aria-modal="true">
      <div className="review-shell">
        <header className="exam-topbar">
          <div>
            <strong>Exam Review</strong>
            <span>{exam.title} • Score {Math.round((result?.average_score || 0) * 100)}%</span>
          </div>
          <button className="outline-action compact-action" onClick={onClose}>Exit Review</button>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>

        <main className="review-stage">
          {exam.questions.map((question, index) => {
            const questionResult = resultByQuestion[question.id];
            const correctOption = question.options?.find((option) => option.is_correct);
            const userAnswer = answers?.[question.id] || "Not answered";
            return (
              <article className="review-card" key={question.id}>
                <div className="review-card-head">
                  <span>Question {index + 1}</span>
                  <em>{Math.round((questionResult?.score || 0) * 100)}%</em>
                </div>
                <h3>{question.prompt}</h3>
                <div className="review-grid">
                  <div>
                    <strong>Your answer</strong>
                    <p>{userAnswer}</p>
                  </div>
                  <div>
                    <strong>{correctOption ? "Correct answer" : "Expected answer"}</strong>
                    <p>{correctOption ? `${correctOption.label}. ${correctOption.text}` : question.expected_answer || "Use a clear, specific answer with examples, tradeoffs, and edge cases."}</p>
                  </div>
                </div>
                {questionResult?.feedback && (
                  <div className="review-feedback">
                    <strong>Feedback</strong>
                    <p>{questionResult.feedback}</p>
                  </div>
                )}
              </article>
            );
          })}
        </main>
      </div>
    </div>
  );
}

function MockInterviewModal({ session, setSession, onSubmit, onExit, loading }) {
  const interview = session.interview;
  const currentQuestion = currentMockQuestion(interview);
  const answeredNumbers = Array.from({ length: interview.answered_questions }, (_, index) => index + 1);

  useEffect(() => {
    if (session.muted || !currentQuestion || !("speechSynthesis" in window)) return undefined;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.content);
    utterance.rate = interview.difficulty === "hard" ? 0.92 : interview.difficulty === "easy" ? 1 : 0.96;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [currentQuestion?.id, session.muted, interview.difficulty]);

  function toggleMute() {
    if (!session.muted && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSession({ ...session, muted: !session.muted });
  }

  return (
    <div className="exam-modal-backdrop" role="dialog" aria-modal="true">
      <div className="mock-interview-shell">
        <header className="exam-topbar">
          <div>
            <strong>{interview.difficulty} mock interview</strong>
            <span>{interview.answered_questions}/{interview.question_count} answered • {interview.current_topic}</span>
          </div>
          <div className={`exam-timer ${session.remainingSeconds < 30 ? "warning" : ""}`}>
            <Clock3 size={17} /> {formatSeconds(session.remainingSeconds)}
          </div>
          <button type="button" className="icon-button" onClick={onExit}><X size={19} /></button>
        </header>

        <aside className="question-map">
          {Array.from({ length: interview.question_count }, (_, index) => index + 1).map((number) => (
            <button
              type="button"
              key={number}
              className={`${number === session.questionNumber ? "current" : ""} ${answeredNumbers.includes(number) ? "answered" : ""}`}
            >
              {answeredNumbers.includes(number) ? <Check size={14} /> : number}
            </button>
          ))}
        </aside>

        <main className="exam-stage mock-stage">
          <div className="exam-question-focus">
            <span>{mockSectionLabel(currentQuestion, session.questionNumber)} • Question {session.questionNumber} of {interview.question_count}</span>
            <h2>{currentQuestion?.content || "Interview complete."}</h2>
            <div className="mock-session-tools">
              <button type="button" className="outline-action compact-action" onClick={toggleMute}>
                <Volume2 size={16} /> {session.muted ? "Unmute" : "Mute"}
              </button>
              <span>{session.muted ? "Voice is muted." : "The interviewer reads each new question automatically."} The AI scores clarity, examples, tradeoffs, and role fit.</span>
            </div>
            <textarea
              placeholder="Type your answer like you would say it in an interview..."
              value={session.answer}
              onChange={(event) => setSession({ ...session, answer: event.target.value })}
            />
            {session.remainingSeconds === 0 && <small className="time-warning">Time is up for this question. Submit your best answer to continue.</small>}
          </div>
        </main>

        <footer className="exam-footer">
          <button type="button" className="outline-action" onClick={onExit}>Submit Interview</button>
          <button type="button" className="primary" disabled={loading || !session.answer.trim()} onClick={() => onSubmit(session.answer)}>
            {loading ? <Loader2 className="spin" size={16} /> : <MessageSquareText size={16} />}
            Submit Answer
          </button>
        </footer>
      </div>
    </div>
  );
}

function MockReviewModal({ review, onClose }) {
  const interview = review.interview;
  const rows = mockReviewRows(interview);
  return (
    <div className="exam-modal-backdrop review-backdrop" role="dialog" aria-modal="true">
      <div className="review-shell">
        <header className="exam-topbar">
          <div>
            <strong>Mock Interview Review</strong>
            <span>{interview.difficulty} • Score {Math.round((interview.average_score || 0) * 100)}%</span>
          </div>
          <button className="outline-action compact-action" onClick={onClose}>Exit Review</button>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>

        <main className="review-stage">
          {rows.map((row, index) => (
            <article className="review-card" key={`${row.question.id}-${index}`}>
              <div className="review-card-head">
                <span>Question {index + 1}</span>
                <em>{row.feedback?.score !== null && row.feedback?.score !== undefined ? `${Math.round(row.feedback.score * 100)}%` : "review"}</em>
              </div>
              <h3>{row.question.content}</h3>
              <div className="review-grid">
                <div>
                  <strong>Your answer</strong>
                  <p>{row.answer?.content || "Not answered"}</p>
                </div>
                <div>
                  <strong>Expected answer direction</strong>
                  <p>Use a specific example, explain your reasoning, name tradeoffs, mention edge cases or tests, and connect the answer back to this role.</p>
                </div>
              </div>
              {row.feedback?.content && (
                <div className="review-feedback">
                  <strong>Feedback</strong>
                  <p>{row.feedback.content}</p>
                </div>
              )}
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}

function StudyNoteModal({ reader, onDone, onClose }) {
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState([]);
  const [asking, setAsking] = useState(false);

  async function askNoteQuestion(event) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || asking) return;
    setAsking(true);
    setQuestion("");
    try {
      const response = await apiFetch(`/study-notes/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_title: reader.content.title || reader.task.title,
          role: reader.content.role || "",
          topics: reader.content.topics || [],
          summary: reader.content.summary || "",
          sections: reader.content.sections || [],
          question: submittedQuestion,
          history: answers.map((item) => ({ question: item.question, answer: item.answer })),
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      setAnswers((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          question: submittedQuestion,
          answer: data.answer,
          interviewUse: data.interview_use,
          nextSteps: data.next_steps || [],
          source: data.source,
        },
      ]);
    } catch (error) {
      const fallback = answerStudyQuestion(reader.content, submittedQuestion);
      setAnswers((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          question: submittedQuestion,
          answer: fallback.answer,
          interviewUse: fallback.interviewUse,
          nextSteps: fallback.nextSteps || [],
          source: "local fallback",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="exam-modal-backdrop review-backdrop" role="dialog" aria-modal="true">
      <div className="study-note-shell">
        <header className="exam-topbar">
          <div>
            <strong>{reader.content.title || reader.task.title}</strong>
            <span>{reader.content.subtitle || reader.task.topics?.join(", ")} {reader.content.source && `• ${sourceLabel(reader.content.source)}`}</span>
          </div>
          <button className="outline-action compact-action" onClick={onDone}>Mark Done</button>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>
        <main className="study-note-body">
          {reader.content.summary && (
            <section className="note-summary">
              <h3>What this note will prepare you for</h3>
              <p>{reader.content.summary}</p>
            </section>
          )}
          <section className="topic-chip-section">
            <h3>Current note topics</h3>
            <div className="topic-chip-list">
              {reader.content.topics.map((topic) => <span key={topic}>{topic}</span>)}
            </div>
          </section>
          {reader.content.sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
              {section.bullets?.length > 0 && (
                <ul>
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
          <button className="primary explain-button" onClick={() => setShowDeepDive((current) => !current)}>
            <Sparkles size={16} /> {showDeepDive ? "Hide in-depth prep" : "More info / in-depth prep"}
          </button>
          {showDeepDive && (
            <section className="deep-dive-section">
              <h3>In-depth preparation</h3>
              {(reader.content.deep_dive || reader.content.deeper || []).map((item) => (
                typeof item === "string" ? <p key={item}>{item}</p> : (
                  <article key={item.title}>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                    {item.bullets?.length > 0 && (
                      <ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                    )}
                  </article>
                )
              ))}
            </section>
          )}
          {reader.content.interview_questions?.length > 0 && (
            <section>
              <h3>Likely interview question patterns</h3>
              <ul>
                {reader.content.interview_questions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          )}
          {reader.content.related_topics?.length > 0 && (
            <section>
              <h3>Study these related topics if you want to go deeper</h3>
              <div className="topic-chip-list">
                {reader.content.related_topics.map((topic) => <span key={topic}>{topic}</span>)}
              </div>
            </section>
          )}
          {reader.content.web_research?.length > 0 && (
            <section>
              <h3>Web research used</h3>
              <div className="resource-list">
                {reader.content.web_research.map((source) => (
                  <a key={`${source.url}-${source.query}`} href={normalizeUrl(source.url)} target="_blank" rel="noreferrer">
                    <strong>{source.title}</strong>
                    <span>{source.summary} Search: {source.query}</span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </section>
          )}
          {reader.content.resources?.length > 0 && (
            <section>
              <h3>Useful links and resources</h3>
              <div className="resource-list">
                {reader.content.resources.map((resource) => (
                  <a key={resource.url} href={normalizeUrl(resource.url)} target="_blank" rel="noreferrer">
                    <strong>{resource.title}</strong>
                    <span>{resource.why}</span>
                    <ExternalLink size={14} />
                  </a>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3>Before the exam</h3>
            <ul>
              {reader.content.checklist.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section className="note-question-section">
            <h3>Ask a question about this note</h3>
            <form className="note-question-form" onSubmit={askNoteQuestion}>
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Example: How do I explain this in an interview?"
              />
              <button className="primary" disabled={asking || !question.trim()}>
                {asking ? <Loader2 className="spin" size={16} /> : <MessageSquareText size={16} />} {asking ? "Thinking..." : "Ask"}
              </button>
            </form>
            {answers.length > 0 && (
              <div className="note-answer-list">
                {answers.map((item) => (
                  <div className="note-answer" key={item.id}>
                    <strong>You asked</strong>
                    <p>{item.question}</p>
                    <strong>Answer {item.source && <span>{sourceLabel(item.source)}</span>}</strong>
                    <p>{item.answer}</p>
                    <strong>How to use it in an interview</strong>
                    <p>{item.interviewUse}</p>
                    {item.nextSteps?.length > 0 && (
                      <>
                        <strong>Next steps</strong>
                        <ul>{item.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function JobDescriptionModal({ jobBrief, loading, question, setQuestion, answers = [], onAsk, onClose }) {
  const brief = jobBrief.brief;
  const job = jobBrief.job || {};
  const company = brief?.company || job.company || inferCompanyName("", job.description || "", job.source_url || "");
  const roleTitle = brief?.role_title || job.title || "Saved job";
  const isUrlOnly = isUrlBookmark(job);

  function submitQuestion(event) {
    event.preventDefault();
    onAsk();
  }

  return (
    <div className="exam-modal-backdrop review-backdrop" role="dialog" aria-modal="true">
      <div className="job-brief-shell">
        <header className="exam-topbar">
          <div>
            <strong>{roleTitle}</strong>
            <span>{company || "Company will be inferred from description"} {brief?.source && `• ${sourceLabel(brief.source)}`}</span>
          </div>
          {job.source_url && (
            <a className="outline-action compact-action" href={normalizeUrl(job.source_url)} target="_blank" rel="noreferrer">
              Source <ExternalLink size={14} />
            </a>
          )}
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>

        <main className="job-brief-body">
          {loading && !brief ? (
            <section className="job-brief-loading">
              <Loader2 className="spin" size={22} />
              <strong>Organizing job description...</strong>
              <span>AI is extracting company, requirements, responsibilities, and interview signals.</span>
            </section>
          ) : jobBrief.error ? (
            <section className="job-brief-loading error-state">
              <strong>Could not load description</strong>
              <span>{jobBrief.error}</span>
            </section>
          ) : isUrlOnly ? (
            <section className="job-brief-card">
              <h3>Saved URL</h3>
              <p>This job was saved as a URL bookmark. Open the source link to view the full description, or paste the description into the dashboard to generate a structured brief.</p>
            </section>
          ) : (
            <>
              <section className="job-brief-hero">
                <span>{company || "Detected company"}</span>
                <h2>{roleTitle}</h2>
                <p>{brief?.overview || "This saved job is ready for interview preparation."}</p>
              </section>
              <div className="job-brief-grid">
                <JobBriefSection title="Requirements" items={brief?.requirements} fallback="No explicit requirements were found, so focus on the responsibilities and tools mentioned." />
                <JobBriefSection title="Responsibilities" items={brief?.responsibilities} fallback="Responsibilities were not separated clearly in the post." />
                <JobBriefSection title="What They Are Looking For" items={brief?.looking_for} fallback="Prepare examples that show motivation, communication, and ability to learn quickly." />
                <JobBriefSection title="Interview Signals" items={brief?.interview_signals} fallback="Expect questions that test practical judgment, role fit, and examples from your past work." />
                <JobBriefSection title="Must Prepare Before Interview" items={brief?.must_prepare} fallback="Review the most repeated skills and responsibilities before generating exams." />
                <JobBriefSection title="How To Position Yourself" items={brief?.candidate_positioning} fallback="Frame your answers around impact, learning speed, and role-specific examples." />
                <JobBriefSection title="Likely Interview Questions" items={brief?.possible_interview_questions} fallback="Expect questions about your fit, projects, and how you would handle the posted responsibilities." />
                <JobBriefSection title="Red Flags To Avoid" items={brief?.red_flags_to_avoid} fallback="Avoid generic answers that do not connect back to the job description." />
              </div>
              <JobBriefSection title="Resume Keywords To Mirror" items={brief?.resume_keywords} fallback="Mirror the clearest skill keywords from the posting in your preparation and resume talking points." />
              <JobBriefSection title="Company / Role Context" items={brief?.company_context} fallback="Use the source page or company website to verify details not included in the pasted description." />
              <JobBriefSection title="Prep Advice" items={brief?.prep_advice} fallback="Prepare two project stories, one failure or learning story, and one question for the interviewer." />
              <section className="job-brief-card ask-job-card">
                <h3>Ask AI About This Description</h3>
                <form onSubmit={submitQuestion}>
                  <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask what to prepare, how to answer a requirement, or what questions may come up..." />
                  <button className="primary compact-action" disabled={loading || !question.trim()}>
                    {loading ? <Loader2 className="spin" size={15} /> : <MessageSquareText size={15} />}
                    Ask AI
                  </button>
                </form>
                {answers.length > 0 && (
                  <div className="job-brief-answer-stack">
                    {answers.map((answer) => (
                      <div className="job-brief-answer" key={answer.id}>
                        <strong>You asked</strong>
                        <p>{answer.question}</p>
                        <strong>Answer</strong>
                        <p>{answer.answer}</p>
                        <strong>How to use it in an interview</strong>
                        <p>{answer.interview_use}</p>
                        {answer.next_steps?.length > 0 && (
                          <ul>
                            {answer.next_steps.map((step) => <li key={step}>{step}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function JobBriefSection({ title, items = [], fallback }) {
  const cleanItems = cleanBriefItems(items);
  return (
    <section className="job-brief-card">
      <h3>{title}</h3>
      {cleanItems.length ? (
        <ul>
          {cleanItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p>{fallback}</p>
      )}
    </section>
  );
}

function sanitizeJobBrief(brief = {}, detail = {}, job = {}) {
  const roleTitle = brief.role_title || detail.title || job.title || "Saved job";
  const company = brief.company || detail.company || job.company || inferCompanyName("", detail.description || job.description || "", detail.source_url || job.source_url || "");
  const requirements = cleanBriefItems(brief.requirements);
  const responsibilities = cleanBriefItems(brief.responsibilities);
  const description = detail.description || job.description || "";
  const fallbackSignals = fallbackInterviewSignals(roleTitle);
  return {
    ...brief,
    company,
    role_title: roleTitle,
    overview: cleanBriefText(brief.overview) || `This posting is for ${roleTitle}${company ? ` at ${company}` : ""}. Review the requirements, responsibilities, and interview signals before building your prep plan.`,
    requirements: requirements.length ? requirements : fallbackRequirements(description),
    responsibilities: responsibilities.length ? responsibilities : fallbackResponsibilities(description),
    looking_for: cleanBriefItems(brief.looking_for).length
      ? cleanBriefItems(brief.looking_for)
      : fallbackLookingFor(description, requirements, responsibilities),
    interview_signals: cleanBriefItems(brief.interview_signals).length
      ? cleanBriefItems(brief.interview_signals)
      : fallbackSignals,
    must_prepare: cleanBriefItems(brief.must_prepare, 10).length
      ? cleanBriefItems(brief.must_prepare, 10)
      : [...(requirements.length ? requirements.slice(0, 4) : fallbackRequirements(description).slice(0, 3)), ...fallbackSignals.slice(0, 2)],
    resume_keywords: cleanBriefItems(brief.resume_keywords, 12).length
      ? cleanBriefItems(brief.resume_keywords, 12)
      : extractResumeKeywords(description),
    candidate_positioning: cleanBriefItems(brief.candidate_positioning, 8).length
      ? cleanBriefItems(brief.candidate_positioning, 8)
      : fallbackLookingFor(description, requirements, responsibilities),
    possible_interview_questions: cleanBriefItems(brief.possible_interview_questions, 10).length
      ? cleanBriefItems(brief.possible_interview_questions, 10)
      : fallbackLikelyQuestions(roleTitle, requirements, responsibilities),
    red_flags_to_avoid: cleanBriefItems(brief.red_flags_to_avoid, 8).length
      ? cleanBriefItems(brief.red_flags_to_avoid, 8)
      : [
          "Giving generic answers that do not mention the actual tools or responsibilities in this posting.",
          "Claiming experience without a concrete project, class, or work example to support it.",
          "Ignoring communication, ownership, or teamwork signals if the role description emphasizes them.",
        ],
    company_context: cleanBriefItems(brief.company_context, 8).length
      ? cleanBriefItems(brief.company_context, 8)
      : [
          company ? `Research ${company}'s product, customers, and recent work before the interview.` : "Confirm company context from the source page or company website.",
          "Prepare one question about team workflow, success metrics, and how this role contributes to business outcomes.",
        ],
    prep_advice: cleanBriefItems(brief.prep_advice).length
      ? cleanBriefItems(brief.prep_advice)
      : [
          "Prepare one concrete story for each major responsibility.",
          "Review the required tools and explain where you used similar skills.",
          "Practice connecting your projects to the company’s real work and role outcomes.",
        ],
  };
}

function loadJobBriefAnswers(jobId) {
  if (!jobId) return [];
  const saved = loadLocalMap(JOB_BRIEF_QA_CACHE_KEY);
  return Array.isArray(saved[String(jobId)]) ? saved[String(jobId)] : [];
}

function saveJobBriefAnswers(jobId, answers) {
  if (!jobId) return;
  const saved = loadLocalMap(JOB_BRIEF_QA_CACHE_KEY);
  saveLocalMap(JOB_BRIEF_QA_CACHE_KEY, {
    ...saved,
    [String(jobId)]: answers.slice(0, 30),
  });
}

function extractResumeKeywords(description = "") {
  const keywords = ["Python", "JavaScript", "TypeScript", "React", "SQL", "PostgreSQL", "API", "REST", "Docker", "AWS", "C#", ".NET", "Angular", "communication", "project management", "client", "analytics", "testing", "design", "estimating"];
  const lower = description.toLowerCase();
  const found = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  return found.length ? found.slice(0, 12).map((keyword) => `Mention ${keyword} only where you can connect it to a real example.`) : ["Mirror the clearest tools, responsibilities, and soft-skill words from the posting in your prep stories."];
}

function fallbackLikelyQuestions(roleTitle, requirements = [], responsibilities = []) {
  const topic = requirements[0] || responsibilities[0] || "this role";
  return [
    `Why are you interested in the ${roleTitle} position?`,
    `Walk me through a project or experience that proves you can handle ${topic}.`,
    "Tell me about a time you learned a new tool quickly and used it on real work.",
    "How do you prioritize when multiple tasks or stakeholders need attention?",
    "What would you do in your first month to become useful to this team?",
  ];
}

function cleanBriefItems(items, limit = 8) {
  const rawItems = Array.isArray(items) ? items : String(items || "").split(/\n+|•|;|\s-\s/);
  const seen = new Set();
  return rawItems
    .map((item) => cleanBriefText(item))
    .filter((item) => item.length >= 6 && /[A-Za-z]{3}/.test(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function cleanBriefText(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/^[•\-.:\s]+/, "").trim();
}

function fallbackRequirements(description) {
  const text = description || "";
  const skills = ["SQL", "API", "C#", ".NET", "Angular", "JavaScript", "Python", "communication", "problem-solving"].filter((skill) => text.toLowerCase().includes(skill.toLowerCase()));
  return skills.length
    ? skills.slice(0, 6).map((skill) => `Working knowledge of ${skill} as it appears in the job description.`)
    : ["Ability to connect your past projects, coursework, or work experience to the responsibilities in the posting."];
}

function fallbackResponsibilities(description) {
  const lines = String(description || "").split(/\r?\n/).map((line) => cleanBriefText(line)).filter(Boolean);
  const actionLines = lines.filter((line) => /^(build|develop|create|support|collaborate|prepare|coordinate|plan|assist|manage|utilize|produce)\b/i.test(line));
  return actionLines.slice(0, 6).length ? actionLines.slice(0, 6) : ["Explain how you would approach the main work, communicate progress, and validate quality for this role."];
}

function fallbackLookingFor(description, requirements = [], responsibilities = []) {
  const lower = String(description || "").toLowerCase();
  const items = [];
  if (lower.includes("high-volume") || lower.includes("robust") || lower.includes("scalable")) items.push("A candidate who understands reliability, scalability, and how to build software that holds up in production.");
  if (lower.includes("collabor") || lower.includes("communication") || lower.includes("stakeholder")) items.push("Someone who can communicate clearly, collaborate with others, and explain technical tradeoffs.");
  if (requirements.length) items.push(`Practical experience with the core requirements, especially ${requirements.slice(0, 3).join(", ")}.`);
  if (responsibilities.length) items.push(`Confidence taking ownership of work similar to: ${responsibilities[0]}.`);
  return items.slice(0, 6).length ? items.slice(0, 6) : [
    "A candidate who can prove they understand the role through concrete examples.",
    "Someone who can learn quickly, communicate clearly, and connect experience to the posted responsibilities.",
  ];
}

function fallbackInterviewSignals(roleTitle) {
  return [
    `Expect questions that test how your experience connects to the ${roleTitle} responsibilities.`,
    "Prepare to explain tradeoffs, implementation choices, and how you validate your work.",
    "Use specific examples instead of general claims whenever possible.",
  ];
}

function JobsView({ jobs, onSelectJob, onOpenDescription, menuId, onToggleMenu, onRequestDelete, selectedJobIds, setSelectedJobIds, onRequestBulkDelete, loading, savedPlans, onOpenPlan, removePrepPlan, jobMarkers }) {
  const [bulkMode, setBulkMode] = useState(false);
  const allSelected = jobs.length > 0 && selectedJobIds.length === jobs.length;
  function toggleJobSelection(jobId) {
    setSelectedJobIds((current) => current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]);
  }
  function closeBulkMode() {
    setBulkMode(false);
    setSelectedJobIds([]);
  }

  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <PanelTitle icon={BriefcaseBusiness} title="Jobs" subtitle="Saved job links and generated prep plans stay connected here." />
        {bulkMode ? (
          <div className="bulk-toolbar">
            <label>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setSelectedJobIds(event.target.checked ? jobs.map((job) => job.id) : [])}
              />
              Select all
            </label>
            <span>{selectedJobIds.length} selected</span>
            <button type="button" className="outline-action compact-action" onClick={closeBulkMode}>Cancel</button>
            <button type="button" className="danger-action compact-danger" disabled={!selectedJobIds.length || loading} onClick={onRequestBulkDelete}>
              <Trash2 size={16} /> Delete Selected
            </button>
          </div>
        ) : (
          <div className="jobs-feature-toolbar">
            <button type="button" className="icon-button danger-icon" title="Select jobs to delete" onClick={() => setBulkMode(true)}>
              <Trash2 size={17} />
            </button>
          </div>
        )}
        <div className="saved-list full-list">
          {jobs.map((job) => (
            <SavedJob
              key={job.id}
              job={job}
              onSelect={onSelectJob}
              menuOpen={menuId === job.id}
              onToggleMenu={onToggleMenu}
              onRequestDelete={onRequestDelete}
              onOpenDescription={onOpenDescription}
              selectable={bulkMode}
              selected={selectedJobIds.includes(job.id)}
              onToggleSelect={toggleJobSelection}
            />
          ))}
        </div>
      </section>
      <section className="panel page-panel">
        <PanelTitle icon={ClipboardList} title="Saved Prep Plans" subtitle="Open any plan to continue preparation." />
        <div className="plan-list">
          {savedPlans.length ? savedPlans.map((savedPlan) => (
            <div className="plan-list-row" key={savedPlan.id} role="button" tabIndex={0} onClick={() => onOpenPlan(savedPlan.id)}>
              <div>
                <strong><span className="inline-color-dot" style={{ background: colorForJobId(savedPlan.job_post_id, jobMarkers, savedPlan.job_title) }} />{savedPlan.job_title}</strong>
                <span>{savedPlan.days_until_interview} days left • {savedPlan.task_count} tasks</span>
              </div>
              <button className="remove-button" onClick={(event) => { event.stopPropagation(); removePrepPlan(savedPlan.id); }}>Remove</button>
            </div>
          )) : <EmptyState text="Generate a prep plan from the dashboard and it will appear here." />}
        </div>
      </section>
    </section>
  );
}

function PrepPlanView({ plan, savedPlans, selectedPlanDay, setSelectedPlanDay, completedTasks, toggleTaskDone, loadPrepPlan, removePrepPlan, generateExam, startStudyTask, isStudyNoteGenerated, loading, loadingStudyTaskId, loadingExamTaskId, jobMarkers }) {
  const planDays = buildPlanMilestones(plan, "");
  const selectedTasks = buildDailyStudyTasks(plan, selectedPlanDay);
  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <PanelTitle
          icon={ClipboardList}
          title={plan ? plan.job_title : "Prep Plan"}
          subtitle={plan ? `${plan.days_until_interview} days to interview • ${sourceLabel(plan.plan_source)}` : "Choose a saved prep plan from the list below."}
        />
        {plan ? (
          <>
            <PlanStepper days={planDays} selectedDay={selectedPlanDay} onSelectDay={setSelectedPlanDay} />
            <PlanDayCarousel
              days={planDays}
              selectedDay={selectedPlanDay}
              completedTasks={completedTasks}
              plan={plan}
              onSelectDay={setSelectedPlanDay}
              compact
            />
            <div className="detail-grid">
              <div>
                <h3>Day {selectedPlanDay} Tasks</h3>
                <div className="task-table">
                  {selectedTasks.map((task) => (
                    <div className={`task-row detail-task study-task-row ${task.task_type === "practice_exam" ? "exam-task" : ""}`} key={task.id || task.title}>
                      <div>
                        <input
                          type="checkbox"
                          checked={Boolean(completedTasks[`${dateKey(new Date())}:task:${task.id || task.title}`])}
                          onChange={() => toggleTaskDone(task)}
                        />
                        <span>{task.title}</span>
                      </div>
                      <small>{task.topics?.join(", ")}</small>
                      <em>{task.task_type === "practice_exam" ? "Practice exam" : "Study notes"}</em>
                      <button type="button" onClick={() => startStudyTask(task)} disabled={isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId)}>
                        {isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId) ? <><Loader2 className="spin" size={15} /> Generating...</> : isStudyNoteGenerated?.(task) ? "Open" : "Start"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="plan-summary-box">
                <strong>Plan Summary</strong>
                <p>{plan.plan_summary}</p>
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() => startStudyTask({
                    id: `day-${selectedPlanDay}-practice-exam`,
                    day: selectedPlanDay,
                    title: `Practice exam for Day ${selectedPlanDay}`,
                    topics: selectedTasks.flatMap((task) => task.topics || []),
                    task_type: "practice_exam",
                  })}
                >
                  <FileQuestion size={16} /> Generate Practice Exam
                </button>
              </aside>
            </div>
          </>
        ) : (
          <EmptyState text="No prep plan is open yet. Pick a saved plan below." />
        )}
      </section>

      <section className="panel page-panel">
        <PanelTitle icon={BookOpen} title="Saved Plans" />
        <div className="plan-list compact">
          {savedPlans.map((savedPlan) => (
            <div className="plan-list-row" key={savedPlan.id} role="button" tabIndex={0} onClick={() => loadPrepPlan(savedPlan.id)}>
              <div>
                <strong><span className="inline-color-dot" style={{ background: colorForJobId(savedPlan.job_post_id, jobMarkers, savedPlan.job_title) }} />{savedPlan.job_title}</strong>
                <span>{savedPlan.days_until_interview} days left • {savedPlan.task_count} tasks</span>
              </div>
              <button className="remove-button" onClick={(event) => { event.stopPropagation(); removePrepPlan(savedPlan.id); }}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function ExamsView({ plan, savedPlans, planSearch, setPlanSearch, loadPrepPlan, examAttempts, mockAttempts, examSettings, setExamSettings, selectedPlanDay, examResult, generateExam, scheduleMockInterviewAttempt, startExamAttempt, startMockAttempt, openExamReview, openMockReview, requestDeleteAttempt, loading, jobMarkers }) {
  const [showExamAdvanced, setShowExamAdvanced] = useState(false);
  const matches = savedPlans.filter((savedPlan) => savedPlan.job_title.toLowerCase().includes(planSearch.toLowerCase()));
  function chooseDifficulty(difficulty) {
    setExamSettings(settingsForDifficulty(difficulty));
  }

  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <PanelTitle icon={Gauge} title="Exams" subtitle="Generate role-specific exams from the selected prep plan day." />
        <div className="search-select-panel">
          <label>
            Search Saved Jobs
            <input placeholder="Search by job title..." value={planSearch} onChange={(event) => setPlanSearch(event.target.value)} />
          </label>
          <div className="search-results">
            {matches.slice(0, 6).map((savedPlan) => (
              <button key={savedPlan.id} className={plan?.prep_plan_id === savedPlan.id ? "selected" : ""} onClick={() => loadPrepPlan(savedPlan.id)}>
                <strong><span className="inline-color-dot" style={{ background: colorForJobId(savedPlan.job_post_id, jobMarkers, savedPlan.job_title) }} />{savedPlan.job_title}</strong>
                <span>{savedPlan.days_until_interview} days • {savedPlan.task_count} tasks</span>
              </button>
            ))}
          </div>
        </div>
        <div className="exam-config">
          <label>
            Difficulty
            <select value={examSettings.difficulty} onChange={(event) => chooseDifficulty(event.target.value)}>
              <option>easy</option>
              <option>medium</option>
              <option>hard</option>
            </select>
          </label>
          <div className="exam-standard">
            <strong>{examSettings.questionCount} questions</strong>
            <span>{examSettings.timeLimit} minutes • AI selects question types</span>
          </div>
          <button type="button" className="outline-action modify-exam-button" onClick={() => setShowExamAdvanced((current) => !current)}>
            {showExamAdvanced ? "Hide settings" : "Modify exam"}
          </button>
        </div>
        {showExamAdvanced && (
          <div className="advanced-exam-panel">
            <label>
              Questions
              <input type="number" min="3" max="60" value={examSettings.questionCount} onChange={(event) => setExamSettings({ ...examSettings, questionCount: event.target.value })} />
            </label>
            <label>
              Time Limit
              <input type="number" min="5" max="180" value={examSettings.timeLimit} onChange={(event) => setExamSettings({ ...examSettings, timeLimit: event.target.value })} />
            </label>
            <label className="wide-field">
              Focus topics
              <input placeholder="Optional: React state, REST APIs, SQL joins..." value={examSettings.customTopics || ""} onChange={(event) => setExamSettings({ ...examSettings, customTopics: event.target.value })} />
            </label>
            <div className="question-types exam-types wide-field">
              {EXAM_TYPE_OPTIONS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={examSettings.questionTypes.includes(value)}
                    onChange={() => setExamSettings({ ...examSettings, questionTypes: toggleListValue(examSettings.questionTypes, value) })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="plan-actions">
          <button
            className="primary"
            disabled={!plan || loading}
            onClick={() => generateExam(selectedPlanDay || 1, {
              focusTopics: parseTopicInput(examSettings.customTopics).length
                ? parseTopicInput(examSettings.customTopics)
                : topicsForWholePlan(plan),
              settingsOverride: examSettings,
            })}
          >
            <FileQuestion size={16} /> Generate Exam
          </button>
          <button className="outline-action" disabled={!plan || loading} onClick={scheduleMockInterviewAttempt}>
            <MessageSquareText size={16} /> Set Up Mock Interview
          </button>
        </div>
      </section>

      <section className="panel page-panel">
        <PanelTitle icon={FileQuestion} title="Exam & Mock Attempts" subtitle="Generated exams and mock interviews wait here until you start them." />
        <div className="attempt-list">
          {examAttempts.map((attempt) => {
            const reviewResult = attempt.review || (examResult?.exam_id === attempt.exam.id ? examResult : null);
            const score = typeof attempt.score === "number" ? attempt.score : reviewResult?.average_score;
            return (
              <div className="attempt-card" key={attempt.id}>
                <div>
                  <strong><span className="inline-color-dot" style={{ background: attempt.jobColor || colorForJobId(attempt.jobPostId || attempt.prepPlanId, jobMarkers, attempt.jobTitle) }} />{attempt.exam.title}</strong>
                  <span>{attempt.jobTitle} • Day {attempt.day} • {attempt.difficulty} • {attempt.exam.questions.length} questions • {attempt.exam.time_limit_minutes} min</span>
                  <small>{(attempt.questionTypes || []).join(", ")}</small>
                </div>
                <em className={attempt.status === "complete" ? "complete" : ""}>
                  {attempt.status === "complete" && typeof score === "number" ? `${Math.round(score * 100)}%` : attempt.status}
                </em>
                {attempt.status === "complete" ? (
                  <button
                    className="outline-action compact-action"
                    onClick={() => openExamReview({ exam: attempt.exam, result: reviewResult, answers: attempt.answers || {} })}
                    disabled={!reviewResult}
                  >
                    <BookOpen size={16} /> Review
                  </button>
                ) : (
                  <button className="primary" onClick={() => startExamAttempt(attempt)} disabled={loading}>Start Exam</button>
                )}
                <button className="icon-button danger-icon" onClick={() => requestDeleteAttempt({ kind: "exam", id: attempt.id })} aria-label="Delete exam attempt">
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
          {mockAttempts.map((attempt) => (
            <div className="attempt-card mock" key={attempt.id}>
              <div>
                <strong><span className="inline-color-dot" style={{ background: attempt.jobColor || colorForJobId(attempt.jobPostId || attempt.prepPlanId, jobMarkers, attempt.jobTitle) }} />Mock Interview</strong>
                <span>{attempt.jobTitle} • {attempt.difficulty} • {attempt.questionCount} questions</span>
                <small>{(attempt.questionTypes || []).join(", ")}</small>
              </div>
              <em className={attempt.status === "complete" ? "complete" : ""}>
                {attempt.status === "complete" && typeof attempt.score === "number" ? `${Math.round(attempt.score * 100)}%` : attempt.status}
              </em>
              {attempt.status === "complete" ? (
                <button className="outline-action compact-action" onClick={() => openMockReview({ interview: attempt.interview })} disabled={!attempt.interview}>
                  <BookOpen size={16} /> Review
                </button>
              ) : (
                <button className="primary" onClick={() => startMockAttempt(attempt)} disabled={loading}>
                  Start Interview
                </button>
              )}
              <button className="icon-button danger-icon" onClick={() => requestDeleteAttempt({ kind: "mock", id: attempt.id })} aria-label="Delete mock interview attempt">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          {!examAttempts.length && !mockAttempts.length && <EmptyState text="Generate an exam or set up a mock interview to create an attempt card." />}
        </div>
      </section>
    </section>
  );
}

function CalendarView({ plan, planColor, calendarPlanDetails, jobMarkers, completedTasks, toggleTaskDone, generateExam, calendarMonth, setCalendarMonth, calendarEvents, eventDraft, setEventDraft, addCalendarEvent, removeCalendarEvent }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const savedPlanEvents = Object.values(calendarPlanDetails).flatMap((detail) =>
    planEventsForCalendar(detail, colorForPlan(detail, jobMarkers))
  );
  const activePlanEvents = planEventsForCalendar(plan, planColor);
  const allEvents = mergeCalendarEvents([...savedPlanEvents, ...activePlanEvents, ...calendarEvents]);
  const monthDays = buildMonthDays(calendarMonth);
  const selectedDateEvents = selectedDate ? allEvents.filter((event) => event.date === selectedDate) : [];
  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <div className="calendar-head">
          <PanelTitle icon={CalendarDays} title="Calendar" subtitle="Plan preparation, mocks, real interviews, and meeting links." />
          <div>
            <button className="outline-action" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}>Prev</button>
            <strong>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <button className="outline-action" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}>Next</button>
          </div>
        </div>
        <form className="event-form" onSubmit={addCalendarEvent}>
          <input placeholder="Event title" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} />
          <input type="date" value={eventDraft.date} onChange={(event) => setEventDraft({ ...eventDraft, date: event.target.value })} />
          <select value={eventDraft.type} onChange={(event) => setEventDraft({ ...eventDraft, type: event.target.value })}>
            <option value="preparation">Preparation</option>
            <option value="mock">Mock interview</option>
            <option value="real_interview">Real interview</option>
            <option value="exam">Exam</option>
          </select>
          <input type="color" value={eventDraft.color} onChange={(event) => setEventDraft({ ...eventDraft, color: event.target.value })} />
          <input placeholder="Meet/Zoom link" value={eventDraft.link} onChange={(event) => setEventDraft({ ...eventDraft, link: event.target.value })} />
          <button className="primary"><Plus size={16} /> Add Event</button>
        </form>
        <div className="month-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
          {monthDays.map((date) => {
            const key = dateKey(date);
            const dateEvents = allEvents.filter((event) => event.date === key);
            const realInterview = dateEvents.find((event) => event.type === "real_interview");
            return (
              <div
                className={`month-day ${date.getMonth() !== calendarMonth.getMonth() ? "muted" : ""} ${dateEvents.length ? "has-events" : ""}`}
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedDate(key)}
                style={realInterview ? { background: tintColor(realInterview.color, 0.12), borderColor: realInterview.color } : undefined}
              >
                <span>{date.getDate()}</span>
                {dateEvents.slice(0, 4).map((event) => (
                  <div className="month-event" key={event.id} style={{ borderLeftColor: event.color }}>
                    <button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedDate(key); }}>{event.title}</button>
                    {event.link && <a href={normalizeUrl(event.link)} target="_blank" rel="noreferrer" onClick={(clickEvent) => clickEvent.stopPropagation()}><ExternalLink size={11} /></a>}
                  </div>
                ))}
                {dateEvents.some((event) => event.day) && <button type="button" className="mini-action" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedDate(key); }}>Actions</button>}
              </div>
            );
          })}
        </div>
        {selectedDate && (
          <div className="modal-backdrop">
            <div className="calendar-day-modal">
              <header>
                <div>
                  <strong>{formatCalendarDate(selectedDate)}</strong>
                  <span>{selectedDateEvents.length ? `${selectedDateEvents.length} event${selectedDateEvents.length === 1 ? "" : "s"}` : "No events yet"}</span>
                </div>
                <button className="icon-button" onClick={() => setSelectedDate(null)}><X size={18} /></button>
              </header>
              <div className="calendar-modal-events">
                {selectedDateEvents.length ? selectedDateEvents.map((event) => (
                  <article key={event.id} style={{ borderLeftColor: event.color }}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{labelForCalendarEvent(event.type)}</span>
                    </div>
                    <div className="calendar-modal-actions">
                      {event.day && (
                        <button className="primary compact-action" onClick={() => { generateExam(event.day, { planOverride: event.planDetail }); setSelectedDate(null); }}>
                          <FileQuestion size={15} /> Generate Exam
                        </button>
                      )}
                      {event.link && <a className="outline-action compact-action" href={normalizeUrl(event.link)} target="_blank" rel="noreferrer">Open Link <ExternalLink size={13} /></a>}
                      {event.source === "user" && (
                        <button className="danger-action compact-danger" onClick={() => removeCalendarEvent(event.id)}>
                          <Trash2 size={15} /> Remove
                        </button>
                      )}
                    </div>
                  </article>
                )) : <EmptyState text="No events on this date. Use the form above to add preparation, exam, or interview events." />}
              </div>
              <button className="outline-action" onClick={() => { setEventDraft({ ...eventDraft, date: selectedDate, color: planColor || eventDraft.color }); setSelectedDate(null); }}>
                <Plus size={16} /> Use this date in the event form
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function NotesView({ savedPlans, notes, noteFolders, noteDraft, setNoteDraft, saveNote, importNotes, removeNote, createBlankNote, updateNote, improveSavedNote, improvingNoteId, createNoteFolder, deleteNoteFolder, generateWorkspaceNote, loading }) {
  const [selectedPlanId, setSelectedPlanId] = useState(noteDraft.planId || savedPlans[0]?.id || "");
  const [openNoteId, setOpenNoteId] = useState("");
  const [editDraft, setEditDraft] = useState({ title: "", body: "", folder: "", subfolder: "", color: "#2563eb" });
  const [treeOpen, setTreeOpen] = useState(false);
  const [openFolders, setOpenFolders] = useState({});
  const [creatingItem, setCreatingItem] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  useEffect(() => {
    setNoteDraft((current) => ({ ...current, planId: selectedPlanId }));
  }, [selectedPlanId, setNoteDraft]);
  const selectedPlan = savedPlans.find((savedPlan) => String(savedPlan.id) === String(selectedPlanId));
  const visibleNotes = notes.filter((note) => selectedPlanId ? String(note.planId) === String(selectedPlanId) : !note.planId);
  const grouped = groupNotesByFolder(visibleNotes);
  const rootNotes = grouped.Notes || [];
  const folderNames = [...new Set([...noteFolders, ...Object.keys(grouped)])].filter((folder) => folder && folder !== "Quick Notes" && folder !== "Notes");
  const openNote = notes.find((note) => note.id === openNoteId);

  useEffect(() => {
    if (!openNote) {
      setOpenNoteId("");
      return;
    }
    setEditDraft({
      title: openNote.title || "",
      body: openNote.body || "",
      folder: normalizeNoteFolder(openNote.folder),
      subfolder: openNote.subfolder || "",
      color: openNote.color || "#2563eb",
    });
  }, [openNoteId, openNote?.updatedAt]);

  function selectPlan(planId) {
    setSelectedPlanId(planId);
    setOpenNoteId("");
    setCreatingItem(null);
    setTreeOpen(false);
    setNoteDraft({ ...noteDraft, planId, folder: noteDraft.folder || "Notes" });
  }

  function beginCreate(type, folder = "Notes") {
    setTreeOpen(true);
    if (type === "note" && folder !== "Notes") setOpenFolders((current) => ({ ...current, [folder]: true }));
    setCreatingItem({ type, folder });
    setNewItemName("");
  }

  function submitNewTreeItem(event) {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || !creatingItem) return;
    if (creatingItem.type === "folder") {
      createNoteFolder(name);
      setOpenFolders((current) => ({ ...current, [name]: true }));
    } else {
      const noteId = createBlankNote({ title: name, folder: creatingItem.folder || "Notes", planId: selectedPlanId });
      setOpenNoteId(noteId);
    }
    setNewItemName("");
    setCreatingItem(null);
  }

  function openNoteEditor(note) {
    setOpenNoteId(note.id);
    setEditDraft({
      title: note.title || "",
      body: note.body || "",
      folder: normalizeNoteFolder(note.folder),
      subfolder: note.subfolder || "",
      color: note.color || "#2563eb",
    });
  }

  function saveOpenNote(event) {
    event.preventDefault();
    if (!openNote) return;
    const folder = editDraft.folder.trim() || "Notes";
    updateNote(openNote.id, {
      title: editDraft.title.trim() || "Untitled note",
      body: editDraft.body,
      folder,
      subfolder: editDraft.subfolder.trim(),
      color: editDraft.color || "#2563eb",
    });
    setEditDraft((current) => ({ ...current, folder }));
  }

  function toggleFolder(folder) {
    setOpenFolders((current) => ({ ...current, [folder]: !current[folder] }));
  }

  function confirmDeleteNote(note) {
    if (!window.confirm(`Delete note "${note.title}"? This cannot be undone.`)) return;
    removeNote(note.id);
    if (openNoteId === note.id) setOpenNoteId("");
  }

  function confirmDeleteFolder(folder, folderNotes) {
    const count = folderNotes.length;
    const message = `Delete folder "${folder}" and ${count} note${count === 1 ? "" : "s"} inside it? This cannot be undone.`;
    if (!window.confirm(message)) return;
    deleteNoteFolder(folder);
    if (folderNotes.some((note) => note.id === openNoteId)) setOpenNoteId("");
  }

  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <PanelTitle icon={NotebookText} title="Notes" subtitle="Choose a job, then keep every folder, generated note, and personal note in one clean workspace." />
        <div className="notes-job-strip">
          {savedPlans.map((savedPlan) => (
            <button
              type="button"
              key={savedPlan.id}
              className={`notes-job-card ${String(selectedPlanId) === String(savedPlan.id) ? "selected" : ""}`}
              onClick={() => selectPlan(savedPlan.id)}
            >
              <BriefcaseBusiness size={18} />
              <span>{savedPlan.job_title}</span>
              <small>{savedPlan.days_until_interview ?? savedPlan.total_days} days left</small>
            </button>
          ))}
          <button type="button" className={`notes-job-card ${!selectedPlanId ? "selected" : ""}`} onClick={() => selectPlan("")}>
            <NotebookText size={18} />
            <span>General Notes</span>
            <small>No job tag</small>
          </button>
        </div>
      </section>

      <section className="panel page-panel notes-workspace">
        <aside className="notes-folder-rail">
          <div className="notes-tree-root">
            <button type="button" className="tree-action-button" aria-label="New folder" title="New folder" onClick={() => beginCreate("folder")}>
              <FolderPlus size={16} />
            </button>
            <button type="button" className="tree-action-button" aria-label="New note" title="New note" onClick={() => beginCreate("note", "Notes")}>
              <FilePlus2 size={16} />
            </button>
            <button type="button" className="tree-toggle" aria-label="Toggle notes tree" title={treeOpen ? "Collapse notes" : "Expand notes"} onClick={() => setTreeOpen((current) => !current)}>
              {treeOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>
            <div>
              <strong>{selectedPlan?.job_title || "General Notes"}</strong>
              <span>{visibleNotes.length ? `${visibleNotes.length} notes` : "No notes yet"}</span>
            </div>
          </div>
          {treeOpen && (
            <div className="notes-tree-list">
              {creatingItem?.type === "folder" && (
                <form className="tree-inline-create" onSubmit={submitNewTreeItem}>
                  <Folder size={15} />
                  <input autoFocus placeholder="New folder" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setCreatingItem(null); }} />
                </form>
              )}
              {creatingItem?.type === "note" && creatingItem.folder === "Notes" && (
                <form className="tree-inline-create root-note-create" onSubmit={submitNewTreeItem}>
                  <FileText size={15} />
                  <input autoFocus placeholder="New note" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setCreatingItem(null); }} />
                </form>
              )}
              {rootNotes.map((note) => (
                <div className={`tree-row note-tree-row root-note-row ${openNoteId === note.id ? "selected" : ""}`} key={note.id}>
                  <button type="button" className="tree-row-main" onClick={() => openNoteEditor(note)}>
                    <FileText size={15} style={{ color: note.color || "#2563eb" }} />
                    <span>{note.title}</span>
                  </button>
                  <button type="button" className="tree-hover-action danger" aria-label={`Delete ${note.title}`} title="Delete note" onClick={() => confirmDeleteNote(note)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {!visibleNotes.length && !folderNames.length && !creatingItem ? <span className="tree-empty">No notes</span> : null}
              {folderNames.map((folder) => {
                const folderNotes = grouped[folder] || [];
                const expanded = openFolders[folder] ?? false;
                return (
                  <div className="tree-folder-group" key={folder}>
                    <div className="tree-row folder-tree-row">
                      <button type="button" className="tree-row-main" onClick={() => toggleFolder(folder)}>
                        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        <Folder size={15} />
                        <span>{folder}</span>
                        <small>{folderNotes.length}</small>
                      </button>
                      <button type="button" className="tree-folder-note-action" aria-label={`New note in ${folder}`} title="New note" onClick={() => beginCreate("note", folder)}>
                        <FilePlus2 size={13} />
                      </button>
                      <button type="button" className="tree-hover-action danger" aria-label={`Delete ${folder}`} title="Delete folder" onClick={() => confirmDeleteFolder(folder, folderNotes)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {expanded && (
                      <div className="tree-children">
                        {creatingItem?.type === "note" && creatingItem.folder === folder && (
                          <form className="tree-inline-create note-create" onSubmit={submitNewTreeItem}>
                            <FileText size={15} />
                            <input autoFocus placeholder="New note" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setCreatingItem(null); }} />
                          </form>
                        )}
                        {folderNotes.map((note) => (
                          <div className={`tree-row note-tree-row ${openNoteId === note.id ? "selected" : ""}`} key={note.id}>
                            <button type="button" className="tree-row-main" onClick={() => openNoteEditor(note)}>
                              <FileText size={15} style={{ color: note.color || "#2563eb" }} />
                              <span>{note.title}</span>
                            </button>
                            <button type="button" className="tree-hover-action danger" aria-label={`Delete ${note.title}`} title="Delete note" onClick={() => confirmDeleteNote(note)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {!folderNotes.length && !(creatingItem?.type === "note" && creatingItem.folder === folder) && <span className="tree-empty indent">No notes</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <div className="notes-main">
          {openNote ? (
            <form className="note-editor-page" onSubmit={saveOpenNote}>
              <div className="note-editor-toolbar">
                <button type="button" className="outline-action" onClick={() => setOpenNoteId("")}>Back to notes</button>
                <div>
                  <button type="button" className="outline-action compact-action" disabled={improvingNoteId === openNote.id} onClick={() => improveSavedNote(openNote.id, selectedPlan?.job_title || "", editDraft)}>
                    {improvingNoteId === openNote.id ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} Improve with AI
                  </button>
                  <button type="button" className="danger-action compact-danger" onClick={() => confirmDeleteNote(openNote)}>
                    <Trash2 size={15} /> Remove
                  </button>
                  <button className="primary"><Save size={16} /> Save</button>
                </div>
              </div>
              <input className="note-editor-title" placeholder="Note title" value={editDraft.title} onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })} />
              <div className="note-editor-meta">
                <label className="note-color-field">
                  <Palette size={15} />
                  <input type="color" value={editDraft.color || openNote.color || "#2563eb"} onChange={(event) => setEditDraft({ ...editDraft, color: event.target.value })} />
                </label>
                <input placeholder="Folder" value={editDraft.folder} onChange={(event) => setEditDraft({ ...editDraft, folder: event.target.value })} list="note-folders" />
                <input placeholder="Subfolder" value={editDraft.subfolder} onChange={(event) => setEditDraft({ ...editDraft, subfolder: event.target.value })} />
                <span>{openNote.updatedAt ? "Edited" : "Created"} {formatShortDate(openNote.updatedAt || openNote.createdAt)}</span>
              </div>
              <textarea className="note-editor-body" placeholder="Write or edit your note here..." value={editDraft.body} onChange={(event) => setEditDraft({ ...editDraft, body: event.target.value })} />
              <datalist id="note-folders">
                {noteFolders.map((folder) => <option key={folder} value={folder} />)}
              </datalist>
            </form>
          ) : (
            <section className="note-empty-editor">
              <NotebookText size={34} />
              <strong>Select or create a note</strong>
              <span>Use the folder-plus or note-plus beside the job title, then press Enter to create it.</span>
              <button type="button" className="outline-action" disabled={!selectedPlanId || loading} onClick={() => generateWorkspaceNote(selectedPlanId, noteDraft.folder || "Generated Notes", noteDraft.subfolder || "")}>
                {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Generate AI Note
              </button>
              <label className="import-button">
                <Plus size={16} /> Import Notes
                <input type="file" accept=".txt,.md,.csv" onChange={importNotes} />
              </label>
            </section>
          )}
        </div>
      </section>
    </section>
  );
}
function ProgressView({ plan, completedTasks, examAttempts, mockAttempts, recentActivity, savedPlans, jobs, onOpenPlan }) {
  const [openSections, setOpenSections] = useState({
    plan: true,
    allPlans: true,
    notes: false,
    exams: false,
    mock: false,
    insights: false,
    queue: false,
    milestones: false,
    activity: false,
  });
  const [planDetails, setPlanDetails] = useState({});
  const [selectedProgressPlanId, setSelectedProgressPlanId] = useState(() => plan?.prep_plan_id || savedPlans[0]?.id || "");

  useEffect(() => {
    let cancelled = false;
    async function fetchPlanDetails() {
      const entries = await Promise.all(savedPlans.map(async (savedPlan) => {
        if (plan?.prep_plan_id && String(plan.prep_plan_id) === String(savedPlan.id)) return [savedPlan.id, plan];
        try {
          const response = await apiFetch(`/prep-plans/${savedPlan.id}`);
          if (!response.ok) return null;
          return [savedPlan.id, await response.json()];
        } catch {
          return null;
        }
      }));
      if (!cancelled) {
        const nextDetails = Object.fromEntries(entries.filter(Boolean));
        setPlanDetails((current) => ({ ...current, ...nextDetails }));
      }
    }
    if (savedPlans.length) fetchPlanDetails();
    return () => {
      cancelled = true;
    };
  }, [savedPlans.map((item) => item.id).join(","), plan?.prep_plan_id]);

  useEffect(() => {
    if (plan?.prep_plan_id) setSelectedProgressPlanId(plan.prep_plan_id);
    else if (!selectedProgressPlanId && savedPlans[0]?.id) setSelectedProgressPlanId(savedPlans[0].id);
  }, [plan?.prep_plan_id, savedPlans.length]);

  const allDetailedPlans = savedPlans.map((savedPlan) => {
    if (plan?.prep_plan_id && String(plan.prep_plan_id) === String(savedPlan.id)) return { ...plan, id: savedPlan.id };
    return planDetails[savedPlan.id] ? { ...planDetails[savedPlan.id], id: savedPlan.id } : null;
  }).filter(Boolean);
  const selectedPlan = allDetailedPlans.find((item) => String(item.prep_plan_id || item.id) === String(selectedProgressPlanId)) || plan || allDetailedPlans[0] || null;
  const planDays = selectedPlan ? buildPlanMilestones(selectedPlan, "").filter((day) => !day.isFinal) : [];
  const selectedExamAttempts = examAttempts.filter((attempt) => String(attempt.prepPlanId) === String(selectedPlan?.prep_plan_id || selectedPlan?.id));
  const selectedMockAttempts = mockAttempts.filter((attempt) => String(attempt.prepPlanId) === String(selectedPlan?.prep_plan_id || selectedPlan?.id));
  const completedCount = Object.keys(completedTasks).length;
  const allPlanTasks = selectedPlan ? planDays.flatMap((day) => buildDailyStudyTasks(selectedPlan, day.day)) : [];
  const noteTasks = allPlanTasks.filter((task) => task.task_type === "study_note");
  const completedNotes = countCompletedDayTasks(noteTasks, completedTasks);
  const completeExams = examAttempts.filter((attempt) => attempt.status === "complete");
  const completeMocks = mockAttempts.filter((attempt) => attempt.status === "complete");
  const allScores = [
    ...completeExams.map((attempt) => attempt.score),
    ...completeMocks.map((attempt) => attempt.score),
  ].filter((score) => Number.isFinite(Number(score)));
  const averageScore = allScores.length ? Math.round((allScores.reduce((sum, score) => sum + Number(score), 0) / allScores.length) * 100) : 0;
  const completedPlanDays = planDays.filter((day) => isPlanDayComplete(selectedPlan, day.day, completedTasks)).length;
  const planProgress = planDays.length ? Math.round((completedPlanDays / planDays.length) * 100) : 0;
  const activeAttempts = [...examAttempts, ...mockAttempts].filter((attempt) => attempt.status !== "complete").length;
  const selectedCompleteExams = completeExams.filter((attempt) => String(attempt.prepPlanId) === String(selectedPlan?.prep_plan_id || selectedPlan?.id));
  const selectedCompleteMocks = completeMocks.filter((attempt) => String(attempt.prepPlanId) === String(selectedPlan?.prep_plan_id || selectedPlan?.id));
  const topicInsights = buildTopicInsights(selectedCompleteExams.length ? selectedCompleteExams : completeExams);
  const mockInsights = buildMockSectionInsights(selectedCompleteMocks.length ? selectedCompleteMocks : completeMocks);
  const reviewQueue = buildReviewQueue(selectedCompleteExams.length ? selectedCompleteExams : completeExams, selectedCompleteMocks.length ? selectedCompleteMocks : completeMocks);
  const milestones = buildProgressMilestones({ plan: selectedPlan, completedCount, completeExams: selectedCompleteExams, completeMocks: selectedCompleteMocks, averageScore, completedPlanDays, planDays });
  const readinessReport = buildReadinessReport({
    plan: selectedPlan,
    planProgress,
    noteTasks,
    completedNotes,
    selectedCompleteExams,
    selectedCompleteMocks,
    selectedExamAttempts,
    selectedMockAttempts,
    reviewQueue,
  });
  const readinessScore = readinessReport.score;
  const nextAction = getProgressNextAction({ plan: selectedPlan, planDays, completedTasks, examAttempts: selectedExamAttempts, mockAttempts: selectedMockAttempts, reviewQueue });
  const planSummaries = allDetailedPlans.map((detail) => buildPlanProgressSummary(detail, completedTasks, examAttempts, mockAttempts));

  function toggleSection(key) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <section className="page-stack progress-page">
      <section className="panel page-panel progress-command">
        <div className="progress-command-copy">
          <PanelTitle
            icon={Activity}
            title="Progress"
            subtitle="A focused command center for readiness, next steps, weak spots, and proof of improvement."
            badge={selectedPlan ? `${selectedPlan.days_until_interview} days left` : "No active plan"}
          />
          <div className="next-action-card">
            <span>Recommended next action</span>
            <strong>{nextAction.title}</strong>
            <p>{nextAction.detail}</p>
          </div>
        </div>
        <div className="readiness-card">
          <div className="readiness-ring" style={{ "--score": readinessScore }}>
            <strong>{readinessScore}%</strong>
            <span>Ready</span>
          </div>
          <div>
            <strong>{readinessLabel(readinessScore)}</strong>
            <p>{readinessSummary(readinessScore, selectedPlan, readinessReport)}</p>
            <div className="readiness-breakdown">
              {readinessReport.components.map((item) => (
                <span key={item.label}>{item.label}: <strong>{item.value}%</strong></span>
              ))}
            </div>
            <small className="readiness-formula">Formula: Plan 20% + Notes 20% + Exams 25% + Mocks 20% + Review 15%</small>
          </div>
        </div>
      </section>

      <section className="progress-section-stack">
        <ProgressSection title="All prep plans" subtitle={`${planSummaries.length} saved plan${planSummaries.length === 1 ? "" : "s"} tracked`} icon={BriefcaseBusiness} open={openSections.allPlans} onToggle={() => toggleSection("allPlans")}>
          {planSummaries.length ? (
            <div className="progress-plan-grid">
              {planSummaries.map((summary) => (
                <article
                  className={`progress-plan-card ${String(selectedProgressPlanId) === String(summary.id) ? "selected" : ""}`}
                  key={summary.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedProgressPlanId(summary.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedProgressPlanId(summary.id);
                  }}
                >
                  <div>
                    <strong>{summary.title}</strong>
                    <span>{summary.daysLeft} days left • {summary.tasksDone}/{summary.tasksTotal} tasks • {summary.attempts} attempts</span>
                  </div>
                  <div className="progress-mini-bar"><span style={{ width: `${summary.progress}%` }} /></div>
                  <footer>
                    <em>{summary.progress}%</em>
                    <span>{String(selectedProgressPlanId) === String(summary.id) ? "Active" : "Click to view"}</span>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPlan?.(summary.id); }}>Open plan</button>
                  </footer>
                </article>
              ))}
            </div>
          ) : <EmptyState text="Generate prep plans from saved jobs and they will appear here." />}
        </ProgressSection>
      </section>

      <section className="progress-kpi-grid">
        <ProgressMetric title="Completed notes" value={`${completedNotes}/${noteTasks.length || 0}`} detail="Study-note tasks checked" />
        <ProgressMetric title="Overall score" value={allScores.length ? `${averageScore}%` : "N/A"} detail={`${allScores.length} scored attempt${allScores.length === 1 ? "" : "s"} across jobs`} />
        <ProgressMetric title="Open attempts" value={activeAttempts} detail="Ready or active exams/interviews" />
      </section>

      <section className="progress-section-stack">
        <ProgressSection title="Selected prep plan" subtitle={selectedPlan ? selectedPlan.job_title : "No selected plan"} icon={ClipboardList} open={openSections.plan} onToggle={() => toggleSection("plan")}>
          {selectedPlan ? (
            <div className="progress-section-grid">
              <div className="progress-bar-wrap">
                <div><strong>{planProgress}% complete</strong><span>{completedPlanDays} of {planDays.length} days completed</span></div>
                <div className="progress-bar"><span style={{ width: `${planProgress}%` }} /></div>
              </div>
              <div className="progress-day-list">
                {planDays.map((day) => {
                  const done = isPlanDayComplete(selectedPlan, day.day, completedTasks);
                  const tasks = buildDailyStudyTasks(selectedPlan, day.day);
                  return (
                    <article key={day.day} className={done ? "done" : ""}>
                      <div>
                        <strong>Day {day.day}</strong>
                        <span>{tasks.length} tasks • {day.label}</span>
                      </div>
                      <em>{done ? "Completed" : `${countCompletedDayTasks(tasks, completedTasks)} / ${tasks.length} done`}</em>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : <EmptyState text="Click a saved job with a prep plan or generate a new plan to activate progress tracking." />}
        </ProgressSection>

        <ProgressSection title="Study notes" subtitle="Topics covered and still pending" icon={NotebookText} open={openSections.notes} onToggle={() => toggleSection("notes")}>
          <div className="progress-two-column">
            <ProgressPillList title="Completed note topics" items={noteTasks.filter((task) => isTaskComplete(task, completedTasks)).flatMap((task) => task.topics || [task.title])} empty="Completed note topics will appear here." />
            <ProgressPillList title="Pending note topics" items={noteTasks.filter((task) => !isTaskComplete(task, completedTasks)).flatMap((task) => task.topics || [task.title])} empty="No pending note topics." tone="muted" />
          </div>
        </ProgressSection>

        <ProgressSection title="Exam performance" subtitle="Scores, question types, and practice coverage" icon={FileQuestion} open={openSections.exams} onToggle={() => toggleSection("exams")}>
          <div className="progress-attempt-list">
            {selectedExamAttempts.slice(0, 8).map((attempt) => (
              <article key={attempt.id}>
                <div>
                  <strong>{attempt.exam?.title || "Generated exam"}</strong>
                  <span>{attempt.jobTitle || selectedPlan?.job_title || "Interview practice"} • {attempt.difficulty || "medium"}</span>
                </div>
                <em>{attempt.status === "complete" ? `${Math.round(Number(attempt.score || 0) * 100)}%` : attempt.status}</em>
              </article>
            ))}
            {!selectedExamAttempts.length && <EmptyState text="Generated exams for the selected plan will appear here." />}
          </div>
        </ProgressSection>

        <ProgressSection title="Mock interview progress" subtitle="Behavioral, technical, and team-answer growth" icon={MessageSquareText} open={openSections.mock} onToggle={() => toggleSection("mock")}>
          <div className="progress-two-column">
            <div className="progress-attempt-list">
              {selectedMockAttempts.slice(0, 6).map((attempt) => (
                <article key={attempt.id}>
                  <div>
                    <strong>{attempt.difficulty || "Mock"} mock interview</strong>
                    <span>{attempt.jobTitle || selectedPlan?.job_title || "Interview practice"} • {attempt.questionCount || attempt.interview?.question_count || 0} questions</span>
                  </div>
                  <em>{attempt.status === "complete" ? `${Math.round(Number(attempt.score || 0) * 100)}%` : attempt.status}</em>
                </article>
              ))}
              {!selectedMockAttempts.length && <EmptyState text="Mock interviews for the selected plan will appear here after you generate them." />}
            </div>
            <ProgressPillList title="Section signals" items={mockInsights} empty="Mock section scores will appear here." />
          </div>
        </ProgressSection>

        <ProgressSection title="Strengths and weak spots" subtitle="Inferred from scores and feedback" icon={Gauge} open={openSections.insights} onToggle={() => toggleSection("insights")}>
          <div className="progress-two-column">
            <ProgressPillList title="Strengths" items={topicInsights.strengths} empty="High-scoring topics will appear here." />
            <ProgressPillList title="Needs review" items={topicInsights.weaknesses} empty="Weak areas will appear after scored attempts." tone="warning" />
          </div>
        </ProgressSection>

        <ProgressSection title="Review queue" subtitle="Items to revisit before the interview" icon={BookOpen} open={openSections.queue} onToggle={() => toggleSection("queue")}>
          <div className="review-queue-list">
            {reviewQueue.slice(0, 8).map((item) => (
              <article key={`${item.title}-${item.detail}`}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </article>
            ))}
            {!reviewQueue.length && <EmptyState text="Low-scored answers and unfinished work will appear here." />}
          </div>
        </ProgressSection>

        <ProgressSection title="Milestones" subtitle="Proof that preparation is moving forward" icon={CheckCircle2} open={openSections.milestones} onToggle={() => toggleSection("milestones")}>
          <div className="milestone-grid">
            {milestones.map((milestone) => (
              <article key={milestone.title} className={milestone.done ? "done" : ""}>
                <CheckCircle2 size={16} />
                <div>
                  <strong>{milestone.title}</strong>
                  <span>{milestone.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </ProgressSection>

        <ProgressSection title="Recent activity" subtitle="Meaningful actions from your preparation flow" icon={Activity} open={openSections.activity} onToggle={() => toggleSection("activity")}>
          <div className="progress-timeline">
            {recentActivity.slice(0, 10).map((item, index) => (
              <article key={`${item.title}-${index}`}>
                <span className={`activity-icon ${item.type}`}><Activity size={15} /></span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <small>{item.time}</small>
              </article>
            ))}
          </div>
        </ProgressSection>
      </section>
    </section>
  );
}

function ProgressMetric({ title, value, detail }) {
  return (
    <article className="progress-metric">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function ProgressSection({ title, subtitle, icon: Icon, open, onToggle, children }) {
  return (
    <section className={`panel page-panel progress-section ${open ? "open" : ""}`}>
      <button className="progress-section-toggle" onClick={onToggle}>
        <div>
          <Icon size={18} />
          <span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
        </div>
        <ChevronDown size={18} />
      </button>
      {open && <div className="progress-section-body">{children}</div>}
    </section>
  );
}

function ProgressPillList({ title, items, empty, tone = "good" }) {
  const uniqueItems = [...new Set(items.filter(Boolean))].slice(0, 12);
  return (
    <div className="progress-pill-panel">
      <strong>{title}</strong>
      {uniqueItems.length ? (
        <div className={`progress-pill-list ${tone}`}>
          {uniqueItems.map((item) => <span key={item}>{item}</span>)}
        </div>
      ) : <p>{empty}</p>}
    </div>
  );
}

function buildReadinessReport({ plan, planProgress, noteTasks, completedNotes, selectedCompleteExams, selectedCompleteMocks, selectedExamAttempts, selectedMockAttempts, reviewQueue }) {
  if (!plan) {
    return {
      score: 0,
      components: [
        { label: "Plan", value: 0 },
        { label: "Notes", value: 0 },
        { label: "Exams", value: 0 },
        { label: "Mocks", value: 0 },
        { label: "Review", value: 0 },
      ],
    };
  }

  const notesScore = noteTasks.length ? Math.round((completedNotes / noteTasks.length) * 100) : 0;
  const examScores = selectedCompleteExams.map((attempt) => Number(attempt.score || 0)).filter(Number.isFinite);
  const mockScores = selectedCompleteMocks.map((attempt) => Number(attempt.score || 0)).filter(Number.isFinite);
  const examsScore = examScores.length
    ? Math.round((examScores.reduce((sum, score) => sum + score, 0) / examScores.length) * 100)
    : selectedExamAttempts.length
      ? 25
      : 0;
  const mocksScore = mockScores.length
    ? Math.round((mockScores.reduce((sum, score) => sum + score, 0) / mockScores.length) * 100)
    : selectedMockAttempts.length
      ? 25
      : 0;
  const attemptCount = selectedCompleteExams.length + selectedCompleteMocks.length;
  const reviewScore = attemptCount
    ? Math.max(0, Math.min(100, 100 - reviewQueue.length * 12))
    : 20;
  const components = [
    { label: "Plan", value: Math.round(planProgress), weight: 0.2 },
    { label: "Notes", value: notesScore, weight: 0.2 },
    { label: "Exams", value: examsScore, weight: 0.25 },
    { label: "Mocks", value: mocksScore, weight: 0.2 },
    { label: "Review", value: reviewScore, weight: 0.15 },
  ];
  return {
    score: Math.round(components.reduce((sum, item) => sum + item.value * item.weight, 0)),
    components,
  };
}

function readinessLabel(score) {
  if (score >= 85) return "Interview-ready trajectory";
  if (score >= 65) return "Solid progress";
  if (score >= 40) return "Building momentum";
  return "Needs a focused start";
}

function readinessSummary(score, plan, report) {
  if (!plan) return "Load or generate a prep plan so the app can measure real readiness.";
  const lowest = report?.components?.slice().sort((a, b) => a.value - b.value)[0];
  if (lowest && lowest.value < 50) return `${lowest.label} is currently limiting readiness. Improve that area to raise this score.`;
  if (score >= 85) return "Keep reviewing weak answers and run one final mock interview before the real interview.";
  if (score >= 65) return "You are moving well. Finish remaining notes and use exams to close weak spots.";
  if (score >= 40) return "The plan has started. Focus on today’s notes, then submit a practice exam.";
  return "Start with the first note task, then take a small practice exam to create a baseline.";
}

function getProgressNextAction({ plan, planDays, completedTasks, examAttempts, mockAttempts, reviewQueue }) {
  if (!plan) {
    return { title: "Generate or load a prep plan", detail: "Progress becomes useful after a job has a connected preparation plan." };
  }
  for (const day of planDays) {
    const tasks = buildDailyStudyTasks(plan, day.day);
    const nextTask = tasks.find((task) => !isTaskComplete(task, completedTasks));
    if (nextTask) {
      return {
        title: nextTask.task_type === "practice_exam" ? `Take ${nextTask.title}` : nextTask.title,
        detail: nextTask.task_type === "practice_exam" ? "This exam should check only the topics from that day’s notes." : `Study: ${(nextTask.topics || []).join(", ") || "role-specific topic"}`,
      };
    }
  }
  const readyAttempt = [...examAttempts, ...mockAttempts].find((attempt) => attempt.status !== "complete");
  if (readyAttempt) return { title: readyAttempt.exam ? "Start your generated exam" : "Start your mock interview", detail: "You already generated it. Starting now gives the progress page a real score." };
  if (reviewQueue.length) return { title: "Review weak answers", detail: "Your low-scored answers are queued for targeted revision." };
  return { title: "Run a hard mock interview", detail: "The plan is complete, so use a realistic interview to stress-test your readiness." };
}

function buildTopicInsights(completeExams) {
  const topicScores = new Map();
  completeExams.forEach((attempt) => {
    const results = attempt.review?.results || [];
    const questions = attempt.exam?.questions || [];
    results.forEach((result) => {
      const question = questions.find((item) => item.id === result.question_id);
      const topics = question?.topics?.length ? question.topics : [question?.prompt?.split(" ").slice(0, 4).join(" ") || attempt.exam?.title];
      topics.forEach((topic) => {
        if (!topicScores.has(topic)) topicScores.set(topic, []);
        topicScores.get(topic).push(Number(result.score || 0));
      });
    });
  });
  const averaged = [...topicScores.entries()].map(([topic, scores]) => ({
    topic,
    average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
  }));
  return {
    strengths: averaged.filter((item) => item.average >= 0.75).sort((a, b) => b.average - a.average).map((item) => item.topic),
    weaknesses: averaged.filter((item) => item.average < 0.7).sort((a, b) => a.average - b.average).map((item) => item.topic),
  };
}

function buildMockSectionInsights(completeMocks) {
  const labels = [];
  completeMocks.forEach((attempt) => {
    mockReviewRows(attempt.interview).forEach((row, index) => {
      if (!row.feedback) return;
      labels.push(`${mockSectionLabel(row.question, index + 1)} ${Math.round((row.feedback.score || 0) * 100)}%`);
    });
  });
  return labels.slice(0, 8);
}

function buildReviewQueue(completeExams, completeMocks) {
  const queue = [];
  completeExams.forEach((attempt) => {
    const questions = attempt.exam?.questions || [];
    (attempt.review?.results || []).forEach((result) => {
      if (Number(result.score) >= 0.7) return;
      const question = questions.find((item) => item.id === result.question_id);
      queue.push({
        title: question?.topics?.join(", ") || attempt.exam?.title || "Exam answer",
        detail: result.feedback || "Review this answer and compare it with the expected answer.",
      });
    });
  });
  completeMocks.forEach((attempt) => {
    mockReviewRows(attempt.interview).forEach((row, index) => {
      if (!row.feedback || Number(row.feedback.score) >= 0.7) return;
      queue.push({
        title: `${mockSectionLabel(row.question, index + 1)} mock answer`,
        detail: row.feedback.content || "Add examples, tradeoffs, and clearer structure.",
      });
    });
  });
  return queue;
}

function buildProgressMilestones({ plan, completedCount, completeExams, completeMocks, averageScore, completedPlanDays, planDays }) {
  return [
    { title: "Prep plan generated", detail: "A job has a connected day-by-day plan.", done: Boolean(plan) },
    { title: "First study task completed", detail: "The user checked at least one learning task.", done: completedCount > 0 },
    { title: "First exam submitted", detail: "Exam feedback is available for review.", done: completeExams.length > 0 },
    { title: "First mock interview completed", detail: "Spoken interview practice has been scored.", done: completeMocks.length > 0 },
    { title: "80%+ average score", detail: "Scores show strong recall and explanation quality.", done: averageScore >= 80 },
    { title: "All plan days completed", detail: "Every day in the active plan is checked off.", done: planDays.length > 0 && completedPlanDays === planDays.length },
  ];
}

function buildPlanProgressSummary(plan, completedTasks, examAttempts, mockAttempts) {
  const days = buildPlanMilestones(plan, "").filter((day) => !day.isFinal);
  const tasks = days.flatMap((day) => buildDailyStudyTasks(plan, day.day));
  const tasksDone = countCompletedDayTasks(tasks, completedTasks);
  const progress = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0;
  const planId = plan.prep_plan_id || plan.id;
  const attempts = [...examAttempts, ...mockAttempts].filter((attempt) => String(attempt.prepPlanId) === String(planId));
  return {
    id: planId,
    title: plan.job_title || "Prep plan",
    daysLeft: plan.days_until_interview ?? days.length,
    tasksDone,
    tasksTotal: tasks.length,
    attempts: attempts.length,
    progress,
  };
}

function isTaskComplete(task, completedTasks) {
  const today = dateKey(new Date());
  return Boolean(completedTasks[`${today}:task:${task.id || task.title}`]);
}

function isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId) {
  const key = task.id || task.title;
  return task.task_type === "practice_exam" ? hasLoadingId(loadingExamTaskId, key) : hasLoadingId(loadingStudyTaskId, key);
}

function minInterviewDateTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeFutureInterviewDate(value) {
  if (!value) return value;
  const minDate = minInterviewDateTime();
  return value < minDate ? minDate : value;
}

function hasLoadingId(value, key) {
  return Array.isArray(value) ? value.includes(key) : value === key;
}

function addLoadingId(current, key) {
  const list = Array.isArray(current) ? current : current ? [current] : [];
  return list.includes(key) ? list : [...list, key];
}

function removeLoadingId(current, key) {
  const list = Array.isArray(current) ? current : current ? [current] : [];
  return list.filter((item) => item !== key);
}

function SettingsView({
  user,
  status,
  theme,
  setTheme,
  soundVolume,
  setSoundVolume,
  deletedJobs,
  extensionState,
  restoreDeletedJob,
  clearDeletedJob,
  loading,
  onToggleExtension,
  onInstallExtension,
  onRefreshExtension,
  onClose,
  onKnowMore,
}) {
  function updateSoundVolume(value) {
    const nextVolume = Math.max(0, Math.min(100, Number(value)));
    setSoundVolume(nextVolume);
    localStorage.setItem("interviewprep_sound_volume", String(nextVolume));
  }

  function updateTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem("interviewprep_theme", nextTheme);
  }

  return (
    <div className="settings-popover">
      <header>
        <div>
          <strong>Settings</strong>
          <span>Workspace preferences</span>
        </div>
        <button className="icon-button" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="settings-popover-body">
        <div className="settings-mini-card">
          <strong>Account</strong>
          <span>{user ? user.name : "Guest"}</span>
          {user?.email && <small>{user.email}</small>}
        </div>
        <div className="settings-mini-card">
          <strong>Backend</strong>
          <span>{statusText(status)}</span>
        </div>
        <div className="settings-mini-card theme-settings-card">
          <div className="sound-setting-head">
            <strong><Palette size={16} /> Appearance</strong>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </div>
          <button
            type="button"
            className={`theme-toggle ${theme === "dark" ? "is-dark" : ""}`}
            onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"}
          >
            <span />
            <strong>{theme === "dark" ? "Premium dark mode" : "Light mode"}</strong>
          </button>
        </div>
        <div className="settings-mini-card sound-settings-card">
          <div className="sound-setting-head">
            <strong><Volume2 size={16} /> Generation sound</strong>
            <span>{soundVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={soundVolume}
            onChange={(event) => updateSoundVolume(event.target.value)}
          />
          <div className="sound-setting-footer">
            <small>{soundVolume === 0 ? "Muted" : "Plans, notes, and exams"}</small>
            <button type="button" className="outline-action compact-action" onClick={() => playGeneratedSound(soundVolume)}>
              Test
            </button>
          </div>
        </div>
        <div className={`settings-mini-card extension-settings-card ${extensionState?.bubbleEnabled ? "active" : ""}`}>
          <div className="sound-setting-head">
            <strong><Sparkles size={16} /> Hovering extension</strong>
            <span>{extensionLabel(extensionState)}</span>
          </div>
          <span>{extensionDescription(extensionState, user)}</span>
          {extensionState?.error && <small className="extension-error">{extensionState.error}</small>}
          <div className="extension-actions">
            <button
              type="button"
              className={extensionState?.installed ? `theme-toggle extension-toggle ${extensionState?.bubbleEnabled ? "is-on" : ""}` : "outline-action compact-action"}
              onClick={onToggleExtension}
              aria-pressed={Boolean(extensionState?.bubbleEnabled)}
            >
              {extensionState?.installed ? (
                <>
                  <span />
                  <strong>{extensionState.bubbleEnabled ? "Bubble on" : "Bubble off"}</strong>
                </>
              ) : (
                <>Install Extension <ExternalLink size={13} /></>
              )}
            </button>
            <button
              type="button"
              className="outline-action compact-action"
              onClick={extensionState?.installed ? onRefreshExtension : onInstallExtension}
            >
              {extensionState?.installed ? "Refresh" : "Guide"}
            </button>
          </div>
          {extensionState?.installed && (
            <small>
              {extensionState.signedIn ? "Connected to your website login." : "Login on the website to connect the extension account."}
            </small>
          )}
        </div>
        <div className="settings-mini-card">
          <strong>Local workspace</strong>
          <span>Plans, attempts, notes, and settings stay on this machine.</span>
        </div>
        <div className="settings-mini-card deleted-bin-card">
          <div className="sound-setting-head">
            <strong><Trash2 size={16} /> Deleted jobs</strong>
            <span>{deletedJobs.length}/10</span>
          </div>
          {deletedJobs.length ? (
            <div className="deleted-job-list">
              {deletedJobs.map((job) => (
                <article key={`${job.id}-${job.deleted_at}`}>
                  <div>
                    <strong>{job.title}</strong>
                    <span>{job.company || companyFromUrl(job.source_url) || "Deleted job"}</span>
                  </div>
                  <div className="deleted-job-actions">
                    <button type="button" disabled={loading} onClick={() => restoreDeletedJob(job.id)}>
                      <RotateCcw size={13} /> Restore
                    </button>
                    <button type="button" disabled={loading} onClick={() => clearDeletedJob(job.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <span>No deleted jobs yet.</span>
          )}
        </div>
      </div>
      <button className="primary know-more-button" onClick={onKnowMore}>
        <Sparkles size={17} /> Know more
      </button>
    </div>
  );
}

function StatusIndicator({ status }) {
  const kind = statusKind(status);
  const isCompact = kind === "online" || kind === "offline";
  const Icon = kind === "offline" ? X : Check;
  return (
    <div className={`connection ${kind} ${isCompact ? "compact" : ""}`} title={statusText(status)} aria-label={statusText(status)}>
      <span className="status-dot"><Icon size={12} /></span>
      {!isCompact && <span>{statusText(status)}</span>}
    </div>
  );
}

function PasswordCriteria({ password }) {
  const checks = [
    ["8+ characters", password.length >= 8],
    ["Has a letter", /[A-Za-z]/.test(password)],
    ["Has a number", /\d/.test(password)],
  ];
  return (
    <div className="password-criteria" aria-live="polite">
      {checks.map(([label, done]) => (
        <span key={label} className={done ? "met" : ""}>
          <Check size={12} /> {label}
        </span>
      ))}
    </div>
  );
}

function AnalyticsDevelopmentView() {
  return (
    <section className="page-stack">
      <section className="panel page-panel analytics-dev-panel">
        <div className="analytics-dev-copy">
          <span>Analytics</span>
          <h2>Still in development</h2>
          <p>
            This section will become the deeper reporting layer for InterviewPrep AI: topic performance,
            exam trends, mock interview growth, weak-area heatmaps, time-to-interview readiness, and job-by-job comparisons.
          </p>
        </div>
        <div className="analytics-dev-grid">
          <article><BarChart3 size={20} /><strong>Score trends</strong><span>Track exam and mock scores over time.</span></article>
          <article><Gauge size={20} /><strong>Readiness signals</strong><span>Connect notes, attempts, review, and completion.</span></article>
          <article><BrainCircuit size={20} /><strong>AI insights</strong><span>Summarize what the user should improve next.</span></article>
        </div>
      </section>
    </section>
  );
}

function AboutView({ onBack }) {
  const features = [
    {
      title: "Job-aware planning",
      body: "The app treats the job description as the source of truth. It detects the role, company context, skills, interview timeline, and preparation pressure, then turns that into a daily plan.",
      detail: "A sales role gets client communication, product knowledge, role-play, and pitch practice. A backend role gets APIs, databases, testing, systems, and coding practice. The plan changes with the job, not with a generic template.",
      visual: ["Role signals", "Skill map", "Daily plan"],
      metric: "01",
    },
    {
      title: "Daily notes that teach",
      body: "Each day begins with focused study notes. Notes explain what to understand, how to say it in an interview, common mistakes, deeper context, related topics, and useful resources.",
      detail: "Users can ask questions inside a note, request deeper explanation, save personal notes into job folders, and improve their notes with AI so preparation stays organized.",
      visual: ["Learn", "Ask", "Organize"],
      metric: "02",
    },
    {
      title: "Role-specific exams",
      body: "Exams are designed to measure progress, not just produce questions. Daily practice exams stay locked to that day’s notes, while exams from the Exams tab can test the whole prep plan or custom topics.",
      detail: "Easy, medium, and hard presets control time and question count. Advanced settings let users request MCQ, multi-select, one-word, fill-blank, short-answer, or coding-style questions. AI chooses the mix when the user wants a realistic exam.",
      visual: ["Daily scope", "Full-plan exam", "Review"],
      metric: "03",
    },
    {
      title: "Voice mock interviews",
      body: "Mock interviews open in a focused modal, read questions aloud by default, and mix technical, behavioral, coding, and team problem-solving sections.",
      detail: "Users can mute the voice, exit early, and still receive a partial score. The point is to simulate the rhythm of a real interviewer asking one question at a time.",
      visual: ["Listen", "Answer", "Score"],
      metric: "04",
    },
    {
      title: "Review and improve",
      body: "Every exam and interview attempt is stored with score, answer history, feedback, and expected answers. The main page stays clean, while review gives detailed correction when the user wants it.",
      detail: "Progress uses completed notes, attempts, scores, mock interview feedback, weak spots, and review queue items to show how ready the user is for each saved job.",
      visual: ["Score", "Feedback", "Readiness"],
      metric: "05",
    },
  ];
  const pipeline = ["Job Description", "AI Analysis", "Prep Plan", "Daily Notes", "Focused Exam", "Mock Interview", "Review Loop"];
  return (
    <section className="about-page">
      <section className="about-hero">
        <button className="outline-action compact-action" onClick={onBack}>Back to Settings</button>
        <div className="about-hero-copy">
          <h2>InterviewPrep AI</h2>
          <p>A preparation operating system for interviews: one job post becomes a role-aware plan, focused study notes, realistic exams, voice mock interviews, and a progress loop that keeps every action connected to the target role.</p>
          <div className="about-hero-actions">
            <button className="primary" onClick={onBack}>Return to settings</button>
            <span>Built for measurable preparation, not random question banks.</span>
          </div>
          <div className="about-proof-row">
            <div><strong>Job post</strong><span>source of truth</span></div>
            <div><strong>Daily notes</strong><span>teach first</span></div>
            <div><strong>Exams</strong><span>test studied topics</span></div>
          </div>
        </div>
        <div className="about-product-preview" aria-hidden="true">
          <div className="preview-top">
            <span />
            <strong>Prep Plan Generated</strong>
            <em>AI</em>
          </div>
          <div className="preview-plan-line"><span /> Job skills detected</div>
          <div className="preview-plan-line"><span /> Day 1 notes: REST APIs, SQL, Testing</div>
          <div className="preview-plan-line"><span /> Exam: day notes or whole plan</div>
          <div className="preview-card-grid">
            <div><strong>Notes</strong><span>Explain deeper</span></div>
            <div><strong>Exam</strong><span>MCQ • coding • review</span></div>
            <div><strong>Mock</strong><span>Voice interviewer</span></div>
          </div>
          <div className="preview-score">
            <span>Review loop</span>
            <strong>82%</strong>
          </div>
        </div>
      </section>

      <section className="about-story-section">
        <div>
          <h3>What happens inside the product</h3>
          <p>InterviewPrep AI is built around one idea: preparation should be connected and measurable. The notes feed the exam. The exam feeds review. The mock interview matches the role. Progress shows what improved and what still needs work.</p>
        </div>
        <div className="story-metrics">
          <div><strong>1</strong><span>job post</span></div>
          <div><strong>7</strong><span>connected stages</span></div>
          <div><strong>0</strong><span>untracked effort</span></div>
        </div>
      </section>

      <section className="about-flow">
        {pipeline.map((step, index) => (
          <div className="flow-node" key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
            <small>{systemStepDetail(step)}</small>
          </div>
        ))}
      </section>

      <section className="about-feature-stack">
        {features.map((feature, index) => (
          <article className="about-feature-row" key={feature.title}>
            <div className="feature-number">{feature.metric}</div>
            <div className="feature-copy">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
              <small>{feature.detail}</small>
            </div>
            <div className="feature-visual">
              {feature.visual.map((item, visualIndex) => (
                <span key={item}><i>{visualIndex + 1}</i>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="about-capability-matrix">
        <div>
          <h3>Feature coverage</h3>
          <p>Each part of the app has a clear job. The dashboard creates and loads work, notes teach, exams measure, mock interviews simulate, calendar schedules, and progress turns activity into readiness.</p>
        </div>
        <div className="capability-grid">
          {[
            ["Dashboard", "Create prep plans, save jobs, load saved job context, and continue the current plan."],
            ["Prep Plan", "Move day by day, read generated notes, and launch scoped daily practice exams."],
            ["Exams", "Generate full-plan or custom exams with difficulty presets and advanced question-type control."],
            ["Notes", "Organize job-specific notes into folders, edit them, and improve them with AI."],
            ["Mock Interviews", "Practice spoken answers with timed, voice-read questions and review feedback."],
            ["Progress", "Track readiness across notes, exams, mocks, review queue, and saved prep plans."],
          ].map(([name, detail]) => (
            <article key={name}>
              <strong>{name}</strong>
              <span>{detail}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="about-system">
        <div>
          <h3>How we do it</h3>
          <p>The system starts with the job description, extracts role signals, distributes study topics across available days, generates notes, creates scoped exams, stores attempts, and turns scores into next actions.</p>
          <div className="system-note">The goal is not more content. The goal is the right work, in the right order, with feedback.</div>
        </div>
        <div className="system-diagram">
          {pipeline.map((step, index) => (
            <div className="system-step" key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
              <small>{systemStepDetail(step)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="about-mission">
        <h3>Our aim</h3>
        <p>Make interview prep feel less random. Instead of scattered notes, generic questions, and last-minute anxiety, InterviewPrep AI builds a clean loop: learn the right topics, test them realistically, speak them out loud, review what happened, and improve before interview day.</p>
        <div className="mission-principles">
          <span>Role-specific</span>
          <span>Day-by-day</span>
          <span>Notes first</span>
          <span>Realistic exams</span>
          <span>Review always</span>
        </div>
      </section>
    </section>
  );
}

function PlaceholderView({ title }) {
  return (
    <section className="page-stack">
      <section className="panel page-panel">
        <PanelTitle icon={NotebookText} title={title} subtitle="This section is reserved for the next build step." />
        <EmptyState text="We can wire this tab after the main prep, exams, jobs, and calendar flows are complete." />
      </section>
    </section>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function groupTasksByDay(tasks) {
  const map = new Map();
  tasks.forEach((task) => {
    if (!map.has(task.day)) map.set(task.day, []);
    map.get(task.day).push(task);
  });
  return [...map.entries()].map(([day, dayTasks]) => ({ day, tasks: dayTasks }));
}

function buildPlanMilestones(plan, interviewDate) {
  const grouped = groupTasksByDay(plan?.tasks || []);
  const sourceDays = grouped.length ? grouped : samplePlanDays();
  return sourceDays.map((day) => ({
    ...day,
    label: labelForPlanDay(day.day, interviewDate),
    title: titleForDay(day),
    isFinal: day.day === sourceDays[sourceDays.length - 1]?.day,
  }));
}

function samplePlanDays() {
  return [
    { day: 1, tasks: [{ title: "Skill gap analysis", task_type: "diagnostic" }, { title: "Strength assessment" }, { title: "Learning path setup" }] },
    { day: 2, tasks: [{ title: "DSA & Algorithms", task_type: "exam" }, { title: "System Design Basics" }, { title: "MCQ Practice" }] },
    { day: 3, tasks: [{ title: "Technical Interview", task_type: "mock_interview" }, { title: "Behavioral Questions" }, { title: "Feedback Session" }] },
    { day: 18, tasks: [{ title: "High-yield topics", task_type: "revision" }, { title: "Cheat sheet review" }, { title: "Confidence Boost" }] },
  ];
}

function buildDailyStudyTasks(plan, day) {
  const planTasks = plan?.tasks?.filter((task) => task.day === day) || [];
  const studySources = planTasks
    .filter((task) => task.task_type !== "exam" && task.task_type !== "mock_interview")
    .slice(0, 3);
  const fallbackTopics = topicsForStudyDay(plan, day);
  const sources = studySources.length ? studySources : fallbackTopics.slice(0, 3).map((topic) => ({
    title: topic,
    topics: [topic],
    instructions: `Understand ${topic}, explain it clearly, and connect it to the job responsibilities.`,
  }));
  const noteTasks = sources.map((source, index) => {
    const topics = source.topics?.length ? source.topics : [source.title];
    return {
      id: `day-${day}-note-${index}-${topics.join("-")}`,
      day,
      title: `Read notes: ${source.title}`,
      topics,
      task_type: "study_note",
      instructions: source.instructions,
      order: index + 1,
    };
  });
  const topics = [...new Set(noteTasks.flatMap((task) => task.topics))];
  return [
    ...noteTasks,
    {
      id: `day-${day}-practice-exam`,
      day,
      title: `Practice exam for Day ${day}`,
      topics,
      task_type: "practice_exam",
      order: noteTasks.length + 1,
    },
  ];
}

function isPlanDayComplete(plan, day, completedTasks) {
  const dayTasks = buildDailyStudyTasks(plan, day);
  if (!dayTasks.length) return false;
  return countCompletedDayTasks(dayTasks, completedTasks) === dayTasks.length;
}

function countCompletedDayTasks(dayTasks, completedTasks) {
  const today = dateKey(new Date());
  return dayTasks.filter((task) => Boolean(completedTasks[`${today}:task:${task.id || task.title}`])).length;
}

function topicsForStudyDay(plan, day) {
  const tasks = plan?.tasks?.filter((task) => task.day === day) || [];
  const topics = tasks.flatMap((task) => task.topics || []);
  const unique = [...new Set(topics.filter(Boolean))];
  if (unique.length) return unique;
  return ["Python fundamentals", "Data structures", "Interview communication"];
}

function topicsForWholePlan(plan) {
  const topics = (plan?.tasks || []).flatMap((task) => task.topics || []);
  const unique = [...new Set(topics.filter(Boolean))];
  return unique.length ? unique : topicsForStudyDay(plan, 1);
}

function generateStudyNote(plan, task) {
  const topic = task.topics?.[0] || "Interview topic";
  const topics = task.topics?.length ? task.topics : [topic];
  const role = plan?.job_title || "this role";
  const instructions = task.instructions || `Prepare to explain ${topic} clearly with examples and tradeoffs.`;
  return {
    title: `Interview prep note: ${topic}`,
    subtitle: `How ${topic} connects to ${role}`,
    role,
    topics,
    summary: `This note prepares you to explain ${topic} for ${role}. You should leave with a clear definition, practical examples, interview talking points, mistakes to avoid, and next topics to study if the interviewer goes deeper.`,
    sections: [
      {
        title: "What this note is teaching",
        body: `You are learning ${topics.join(", ")} as interview skills, not just memorized terms.`,
        bullets: topics.map((item) => `Explain ${item} with one concrete example and one tradeoff.`),
      },
      {
        title: "What to understand deeply",
        body: `${instructions} For ${role}, focus on what the concept does, when it matters, what can go wrong, and how you would prove your answer with a concrete example.`,
        bullets: [
          "What problem this topic solves",
          "When you would use it in real work",
          "What mistake a weak candidate might make",
          "How to validate your work or decision",
        ],
      },
      {
        title: "How to explain it in an interview",
        body: `Use this answer structure: define ${topic}, explain why it matters for ${role}, give one project or class example, name one tradeoff, then close with how you would test or validate it.`,
        bullets: [
          "Definition",
          "Job-related example",
          "Tradeoff or limitation",
          "Validation or result",
        ],
      },
      {
        title: "Common mistakes to avoid",
        body: `Do not only give a definition. Avoid vague answers like "it improves performance" without explaining how. Mention edge cases, failure modes, or communication tradeoffs when the topic touches teamwork or product requirements.`,
        bullets: [
          "Sounding too generic",
          "Giving no example",
          "Ignoring tradeoffs",
          "Forgetting to connect back to the job description",
        ],
      },
      {
        title: "Interview angle",
        body: `Connect ${topics.join(", ")} back to the job description. If the role mentions APIs, backend systems, testing, data, sales, writing, teamwork, or communication, explain how this topic helps you handle that responsibility.`,
        bullets: [
          `For ${role}, explain how this topic helps you perform the actual responsibilities.`,
          "Mention collaboration, quality, speed, or user impact where relevant.",
        ],
      },
    ],
    deep_dive: [
      {
        title: `How to reason about ${topic}`,
        body: `A strong explanation of ${topic} should include cause and effect: what problem it solves, what decision it helps you make, and what tradeoff appears if you choose a different approach.`,
        bullets: ["Purpose", "Decision", "Tradeoff", "Validation"],
      },
      {
        title: "Practice answer starter",
        body: `In this role, I would use ${topic} when... The main tradeoff is... I would validate it by...`,
        bullets: [],
      },
    ],
    interview_questions: [
      `Explain ${topic} in simple terms.`,
      `How would you apply ${topic} to this job?`,
      `What tradeoffs or mistakes matter when using ${topic}?`,
      `Tell me about a project where ${topic} or a related skill mattered.`,
    ],
    related_topics: [
      ...topics.map((item) => `${item} examples`),
      ...topics.map((item) => `${item} tradeoffs`),
      "Role-specific interview examples",
    ],
    resources: [
      ...topics.slice(0, 3).map((item) => ({
        title: `Search official docs and examples for ${item}`,
        url: `https://www.google.com/search?q=${encodeURIComponent(`${item} official documentation interview examples`)}`,
        why: "Use this to find current docs, examples, and deeper explanations for the exact topic.",
      })),
      {
        title: "Google Interview Warmup",
        url: "https://grow.google/certificates/interview-warmup/",
        why: "Helpful for practicing spoken answers and improving clarity.",
      },
    ],
    checklist: [
      `I can explain ${topic} in under one minute.`,
      `I can connect ${topic} to this job description.`,
      `I have one project, class, or work example ready for ${topic}.`,
      "I can name one tradeoff, edge case, or testing concern.",
    ],
    source: "local fallback",
  };
}

function studyNoteContentToText(content) {
  const lines = [
    content.subtitle,
    content.summary,
    "",
    ...(content.sections || []).flatMap((section) => [
      section.title,
      section.body,
      ...(section.bullets || []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    "In depth",
    ...(content.deep_dive || []).flatMap((section) => [
      section.title,
      section.body,
      ...(section.bullets || []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    "Interview questions",
    ...(content.interview_questions || []).map((question) => `- ${question}`),
    "",
    "Resources",
    ...(content.resources || []).map((resource) => `- ${resource.title}: ${resource.url}`),
  ];
  return lines.filter((line) => line !== undefined && line !== null).join("\n");
}

function answerStudyQuestion(content, question) {
  const topics = content.topics.join(", ");
  const lowerQuestion = question.toLowerCase();
  const focus = lowerQuestion.includes("example")
    ? "use a concrete project or class example"
    : lowerQuestion.includes("difference") || lowerQuestion.includes("compare")
      ? "compare definitions, tradeoffs, and when each option fits"
      : lowerQuestion.includes("interview")
        ? "give a clear spoken explanation with an example and tradeoff"
        : "start from the core concept and connect it to a practical decision";

  return {
    answer: `For ${topics}, ${focus}. The important part is to explain what problem the topic solves, what decision it helps you make, and what can go wrong if you use it without understanding the tradeoffs.`,
    interviewUse: `In the interview, answer in this order: definition, job-related example, tradeoff, edge case, and validation. A strong starter is: "For ${topics}, I would use it when... The tradeoff is... I would validate it by..."`,
    nextSteps: [
      `Write a one-minute explanation for ${topics}.`,
      "Prepare one example from a class, internship, or personal project.",
      "List one mistake to avoid and one tradeoff to mention.",
    ],
  };
}

function targetForActivity(type) {
  if (type === "exam" || type === "mock" || type === "practice") return "exams";
  if (type === "plan") return "prep";
  if (type === "job") return "jobs";
  if (type === "note") return "notes";
  return "dashboard";
}

function relativeTime(dateValue) {
  const created = new Date(dateValue);
  if (Number.isNaN(created.getTime())) return "now";
  const seconds = Math.max(0, Math.floor((Date.now() - created.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function systemStepDetail(step) {
  const details = {
    "Job Description": "Paste text or use a URL.",
    "AI Analysis": "Extract role, skills, and signals.",
    "Prep Plan": "Distribute work across days.",
    "Daily Notes": "Teach exactly what to learn.",
    "Focused Exam": "Test day notes, full plan, or custom topics.",
    "Mock Interview": "Practice speaking answers.",
    "Review Loop": "Turn feedback into the next attempt.",
  };
  return details[step] || "Prepare with context.";
}

function defaultInterviewDate() {
  const date = new Date();
  date.setDate(date.getDate() + 18);
  return date.toISOString().slice(0, 16);
}

function labelForPlanDay(day, interviewDate) {
  if (day === 1) return "Today";
  if (day === 2) return "Tomorrow";
  const date = new Date(interviewDate);
  if (Number.isNaN(date.getTime())) return `Day ${day}`;
  date.setDate(date.getDate() - Math.max(0, dayOffsetFromFinal(interviewDate) - day));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayOffsetFromFinal(interviewDate) {
  const date = new Date(interviewDate);
  const now = new Date();
  if (Number.isNaN(date.getTime())) return 1;
  return Math.max(1, Math.ceil((date - now) / 86_400_000));
}

function titleForDay(day) {
  const types = day.tasks?.map((task) => task.task_type) || [];
  if (types.includes("diagnostic")) return "Diagnostic & Analysis";
  if (types.includes("exam")) return "Technical Exam";
  if (types.includes("mock_interview")) return "Mock Interview";
  if (types.includes("revision")) return "Final Revision";
  if (types.includes("coding")) return "Coding Practice";
  return `Day ${day.day} Focus`;
}

function iconForDay(day) {
  const types = day.tasks?.map((task) => task.task_type) || [];
  if (types.includes("diagnostic")) return ClipboardList;
  if (types.includes("exam")) return FileQuestion;
  if (types.includes("mock_interview")) return UserRound;
  if (types.includes("revision")) return NotebookText;
  return ClipboardList;
}

function sourceLabel(source) {
  if (source === "openai") return "AI generated";
  if (source === "gemini") return "Gemini generated";
  if (source === "quota_fallback") return "Gemini quota fallback";
  if (source === "heuristic") return "local fallback";
  if (source === "local fallback") return "local fallback";
  if (source === "heuristic_fallback") return "local fallback";
  if (source === "saved") return "saved plan";
  return "local plan";
}

function viewTitle(view) {
  const titles = {
    dashboard: "Dashboard",
    jobs: "Jobs",
    prep: "Prep Plan",
    exams: "Exams",
    data: "Interview Data",
    analytics: "Analytics",
    progress: "Progress",
    calendar: "Calendar",
    notes: "Notes",
    settings: "Settings",
    about: "About",
  };
  return titles[view] || "Dashboard";
}

function normalizeUrl(url) {
  if (!url) return "#";
  return url.startsWith("http") ? url : `https://${url}`;
}

function displayUrl(url) {
  if (!url) return "saved";
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function colorForPlan(plan, markers = {}) {
  if (!plan) return "#2563eb";
  return plan.job_color || colorForJobId(plan.job_post_id, markers, plan.job_title);
}

function colorForJobId(jobId, markers = {}, seed = "") {
  if (jobId && markers[jobId]) return markers[jobId];
  return subtleJobColor(jobId || seed || "job");
}

function subtleJobColor(seed) {
  const colors = ["#2563eb", "#0f766e", "#7c3aed", "#c2410c", "#047857", "#be123c", "#0369a1", "#6d28d9", "#a16207", "#4338ca"];
  const text = String(seed);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973;
  }
  return colors[Math.abs(hash) % colors.length];
}

function tintColor(hex, amount = 0.1) {
  if (!hex?.startsWith("#") || hex.length !== 7) return "#f8fbff";
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  const tinted = channels.map((channel) => Math.round(channel + (255 - channel) * (1 - amount)));
  return `rgb(${tinted.join(", ")})`;
}

function companyFromUrl(url) {
  const host = displayUrl(url);
  if (!host || host === "saved") return "";
  const parts = host.split(".").filter(Boolean);
  const ignored = new Set(["www", "careers", "jobs", "boards", "apply", "greenhouse", "lever", "joinhandshake", "handshake", "workdayjobs", "myworkdayjobs"]);
  const companyPart = parts.find((part) => !ignored.has(part.toLowerCase()) && !part.includes("myworkdayjobs"));
  if (!companyPart) return "";
  return titleCaseCompany(companyPart);
}

function inferCompanyName(providedCompany, description, url) {
  if (providedCompany?.trim()) return providedCompany.trim();
  const headerCompany = companyFromJobBoardHeader(description);
  if (headerCompany) return headerCompany;
  const text = (description || "").replace(/\s+/g, " ").trim();
  if (text) {
    const patterns = [
      /\bcompany\s*:\s*([A-Z][A-Za-z0-9&.' -]{1,45})/i,
      /\bemployer\s*:\s*([A-Z][A-Za-z0-9&.' -]{1,45})/i,
      /\b(?:at|with)\s+([A-Z][A-Za-z0-9&.' -]{1,40})\s+(?:is|we|you|our|as|in)\b/,
      /\babout\s+([A-Z][A-Za-z0-9&.' -]{1,45})(?:\.|,|\s+is|\s+we|\s+our)/,
      /\bjoin\s+([A-Z][A-Za-z0-9&.' -]{1,35})(?:\s+as|\s+and|\.|,)/,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const candidate = cleanCompanyCandidate(match?.[1]);
      if (candidate) return candidate;
    }
  }
  return companyFromUrl(url);
}

function companyFromJobBoardHeader(description) {
  const lines = (description || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\s+logo$/i, "").trim())
    .filter(Boolean);
  const industryWords = ["architecture", "planning", "software", "technology", "health", "finance", "education", "marketing", "design", "landscape", "engineering", "consulting"];
  const roleWords = ["intern", "engineer", "designer", "estimator", "manager", "developer", "analyst", "associate", "assistant", "specialist"];
  const skipped = new Set(["save", "share", "apply", "at a glance", "job", "job description", "full-time", "part-time"]);
  for (let index = 0; index < Math.min(lines.length, 10); index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (skipped.has(lower) || lower.includes("logo") || lower.startsWith("posted ") || lower.includes("apply by")) continue;
    const next = lines[index + 1]?.toLowerCase() || "";
    const previous = lines[index - 1]?.toLowerCase() || "";
    const looksLikeCompany = /^[A-Z0-9][A-Za-z0-9&.' -]{1,45}$/.test(line)
      && !roleWords.some((word) => lower.includes(word))
      && !lower.includes("$")
      && !lower.includes("://");
    if (looksLikeCompany && (industryWords.some((word) => next.includes(word)) || roleWords.some((word) => next.includes(word)) || previous.includes("logo"))) {
      return cleanCompanyCandidate(line);
    }
  }
  return "";
}

function cleanCompanyCandidate(value) {
  if (!value) return "";
  const cleaned = value
    .replace(/\b(inc|llc|ltd|corp|corporation)\b\.?$/i, "")
    .replace(/\b(is|are|we|our|a|an|the|looking|hiring).*$/i, "")
    .trim();
  if (!cleaned || cleaned.length < 2) return "";
  return titleCaseCompany(cleaned);
}

function titleCaseCompany(value) {
  const special = {
    ai: "AI",
    aws: "AWS",
    ibm: "IBM",
    meta: "Meta",
    google: "Google",
    microsoft: "Microsoft",
    amazon: "Amazon",
    dropbox: "Dropbox",
  };
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => special[part.toLowerCase()] || part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function logoFor(title, url) {
  const host = displayUrl(url).toLowerCase();
  if (host.includes("amazon")) return "a";
  if (host.includes("microsoft")) return "M";
  if (host.includes("google")) return "G";
  if (host.includes("meta")) return "∞";
  if (host.includes("dropbox")) return "D";
  return (title || "J").slice(0, 1).toUpperCase();
}

function toneFor(url) {
  const host = displayUrl(url).toLowerCase();
  if (host.includes("amazon")) return "amazon";
  if (host.includes("microsoft")) return "microsoft";
  if (host.includes("google")) return "google";
  if (host.includes("meta")) return "meta";
  if (host.includes("dropbox")) return "dropbox";
  return "";
}

function loadSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("interviewprep_user"));
  } catch {
    return null;
  }
}

function loadSavedToken() {
  return localStorage.getItem("interviewprep_token") || "";
}

function saveUserSession(user, token) {
  if (user && token) {
    localStorage.setItem("interviewprep_user", JSON.stringify(user));
    localStorage.setItem("interviewprep_token", token);
  } else {
    localStorage.removeItem("interviewprep_user");
    localStorage.removeItem("interviewprep_token");
  }
}

function loadCompletedTasks() {
  const key = scopedStorageKey("interviewprep_completed_tasks");
  if (!key) return {};
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function loadLocalList(key) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveLocalList(key, value) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function loadLocalMap(key) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return {};
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function saveLocalMap(key, value) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function saveCompletedTasks(tasks) {
  const key = scopedStorageKey("interviewprep_completed_tasks");
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(tasks));
}

function scopedStorageKey(key) {
  const token = localStorage.getItem("interviewprep_token");
  if (!token) return "";
  try {
    const user = JSON.parse(localStorage.getItem("interviewprep_user"));
    if (!user?.id && !user?.email) return "";
    const scope = String(user.id || user.email).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${key}:${scope}`;
  } catch {
    return "";
  }
}

function loadSoundVolume() {
  const saved = Number(localStorage.getItem("interviewprep_sound_volume"));
  if (Number.isFinite(saved)) return Math.max(0, Math.min(100, saved));
  return 40;
}

function loadTheme() {
  return localStorage.getItem("interviewprep_theme") === "dark" ? "dark" : "light";
}

function isStrongPassword(password) {
  return password.length >= 8 && password.length <= 128 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function statusKind(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("offline") || normalized.startsWith("error")) return "offline";
  if (["backend connected", "logged in", "guest mode"].includes(normalized)) return "online";
  return "working";
}

function statusText(status = "") {
  if (status === "Backend Connected") return "Backend connected";
  if (status === "Backend Offline") return "Backend not connected";
  return status || "Backend connected";
}

function extensionLabel(extensionState = {}) {
  if (extensionState.checking) return "Checking";
  if (!extensionState.installed) return "Not installed";
  return extensionState.bubbleEnabled ? "Active" : "Installed";
}

function extensionDescription(extensionState = {}, user) {
  if (extensionState.checking) return "Checking whether the browser extension is available in this browser.";
  if (!extensionState.installed) return "Install it once, then this toggle can control the capture bubble from the website.";
  if (!user) return "Login to InterviewPrep AI so saved jobs and prep plans go to your account.";
  if (extensionState.bubbleEnabled) return "The capture bubble will appear on job pages where the extension has permission.";
  return "Turn it on when you want the draggable capture bubble on job pages.";
}

function isUrlBookmark(job = {}) {
  return Boolean(job.source_url && String(job.description || job.description_preview || "").startsWith("Saved URL bookmark."));
}

function selectedPlanTitle(savedPlans, planId) {
  return savedPlans.find((plan) => String(plan.id) === String(planId))?.job_title || "";
}

function normalizeSavedJobDescription(description, title) {
  const text = description.trim();
  if (text.length >= 20) return text;
  return `${text || title} saved job description for later interview preparation.`;
}

function playGeneratedSound(volume = 40) {
  try {
    const normalizedVolume = Math.max(0, Math.min(100, Number(volume))) / 100;
    if (normalizedVolume <= 0) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08 * normalizedVolume, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42);
    gain.connect(audioContext.destination);

    [620, 820].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.08);
      oscillator.stop(audioContext.currentTime + 0.22 + index * 0.08);
    });
    window.setTimeout(() => audioContext.close(), 600);
  } catch {
    // Audio can be blocked by the browser; generation should still succeed silently.
  }
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function mockQuestionSeconds(difficulty, questionNumber) {
  const ranges = {
    easy: [75, 120],
    medium: [120, 210],
    hard: [180, 300],
  };
  const [min, max] = ranges[difficulty] || ranges.medium;
  const pseudoRandom = Math.abs(Math.sin(questionNumber * 12.9898 + min) * 43758.5453) % 1;
  return Math.round(min + pseudoRandom * (max - min));
}

function currentMockQuestion(interview) {
  return [...(interview?.messages || [])].reverse().find((message) => message.role === "interviewer");
}

function mockSectionLabel(question, questionNumber) {
  const text = question?.content?.toLowerCase() || "";
  if (text.includes("behavioral")) return "Behavioral";
  if (text.includes("team") || text.includes("disagree") || text.includes("collaboration")) return "Team Problem Solving";
  if (text.includes("coding") || text.includes("code") || text.includes("complexity")) return "Coding";
  if (text.includes("multiple select")) return "Multiple Select";
  if (text.includes("mcq") || text.includes("multiple choice")) return "MCQ";
  if (text.includes("one-word") || text.includes("one word")) return "One Word";
  return questionNumber % 3 === 0 ? "Problem Solving" : "Technical";
}

function mockReviewRows(interview) {
  const rows = [];
  let currentQuestion = null;
  for (const message of interview?.messages || []) {
    if (message.role === "interviewer") {
      currentQuestion = { question: message, answer: null, feedback: null };
      rows.push(currentQuestion);
    } else if (message.role === "candidate" && currentQuestion) {
      currentQuestion.answer = message;
    } else if (message.role === "feedback" && currentQuestion) {
      currentQuestion.feedback = message;
    }
  }
  const questionCount = interview?.question_count || rows.length;
  const questionTypes = interview?.questionTypes || [];
  while (rows.length < questionCount) {
    const nextNumber = rows.length + 1;
    const plannedType = questionTypes[(nextNumber - 1) % Math.max(1, questionTypes.length)] || "technical";
    rows.push({
      question: {
        id: `planned-${nextNumber}`,
        content: `Question ${nextNumber} was not reached before the interview ended. Planned section: ${labelForQuestionType(plannedType)}.`,
      },
      answer: null,
      feedback: null,
      planned: true,
    });
  }
  return rows;
}

function labelForQuestionType(type) {
  const labels = {
    technical: "Technical",
    multiple_choice: "MCQ",
    one_word: "One Word",
    multiple_select: "Multiple Select",
    coding: "Coding",
    behavioral: "Behavioral",
    team_problem_solving: "Team Problem Solving",
  };
  return labels[type] || "Technical";
}

function groupNotesByFolder(notes) {
  return notes.reduce((groups, note) => {
    const folder = normalizeNoteFolder(note.folder);
    return { ...groups, [folder]: [...(groups[folder] || []), note] };
  }, {});
}

function normalizeNoteFolder(folder) {
  if (!folder || folder === "Quick Notes") return "Notes";
  return folder;
}

function improveNoteLocally(note) {
  const title = note.title?.trim() || "Untitled note";
  const body = note.body?.trim() || "Add your main idea here.";
  return [
    `## ${title}`,
    "",
    body,
    "",
    "## Interview angle",
    "- Explain the core idea in simple language.",
    "- Add one concrete example from a project, class, or work experience.",
    "- Mention one tradeoff, mistake, or edge case.",
    "",
    "## Quick review",
    "- Can I explain this in under one minute?",
    "- Can I connect it to the job description?",
    "- Do I have one example ready?",
  ].join("\n");
}

function formatShortDate(value) {
  if (!value) return "now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function shiftMonth(date, offset) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + offset);
  return next;
}

function buildMonthDays(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const first = new Date(start);
  first.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date;
  });
}

function mergeCalendarEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = event.id || `${event.date}:${event.type}:${event.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function planEventsForCalendar(plan, planColor = "#2563eb") {
  if (!plan?.tasks?.length) return [];
  const planId = plan.prep_plan_id || plan.id || plan.job_post_id || plan.job_title || "plan";
  const today = new Date();
  const events = plan.tasks.map((task) => {
    const date = new Date(today);
    date.setDate(today.getDate() + task.day - 1);
    return {
      id: `plan-${planId}-task-${task.id || task.day || task.title}`,
      title: task.title,
      date: dateKey(date),
      color: planColor,
      type: task.task_type,
      day: task.day,
      jobPostId: plan.job_post_id,
      prepPlanId: plan.prep_plan_id || plan.id,
      planDetail: plan,
    };
  });
  const interviewDate = new Date(today);
  interviewDate.setDate(today.getDate() + Math.max(0, plan.days_until_interview - 1));
  events.push({
    id: `plan-${planId}-interview`,
    title: `Real interview: ${plan.job_title}`,
    date: dateKey(interviewDate),
    color: planColor,
    type: "real_interview",
    jobPostId: plan.job_post_id,
    prepPlanId: plan.prep_plan_id || plan.id,
    planDetail: plan,
  });
  return events;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(key) {
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function labelForCalendarEvent(type) {
  const labels = {
    preparation: "Preparation",
    mock: "Mock interview",
    mock_interview: "Mock interview",
    real_interview: "Real interview",
    exam: "Exam",
    practice_exam: "Practice exam",
    study_note: "Study notes",
    diagnostic: "Diagnostic",
    revision: "Revision",
  };
  return labels[type] || "Preparation";
}

function buildStudyStreak(completedTasks) {
  const activeDates = new Set(Object.values(completedTasks));
  const today = new Date();
  let count = 0;

  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    if (!activeDates.has(dateKey(date))) break;
    count += 1;
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: dateKey(date),
      label: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      done: activeDates.has(dateKey(date)),
    };
  });

  return { count, week };
}

function toggleListValue(values, value) {
  if (value === "auto") return ["auto"];
  if (values.includes("auto")) return [value];
  if (values.includes(value)) {
    const next = values.filter((item) => item !== value);
    return next.length ? next : values;
  }
  return [...values, value];
}

function settingsForDifficulty(difficulty) {
  return { ...(EXAM_PRESETS[difficulty] || EXAM_PRESETS.medium) };
}

function normalizeExamSettings(settings) {
  const preset = settingsForDifficulty(settings?.difficulty || "medium");
  const questionTypes = Array.isArray(settings?.questionTypes) && settings.questionTypes.length ? settings.questionTypes : preset.questionTypes;
  return {
    difficulty: settings?.difficulty || preset.difficulty,
    questionCount: Number(settings?.questionCount || preset.questionCount),
    timeLimit: Number(settings?.timeLimit || preset.timeLimit),
    questionTypes: questionTypes.includes("auto") ? ["auto"] : questionTypes,
  };
}

function parseTopicInput(value) {
  return String(value || "")
    .split(",")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function initialsFor(name) {
  return (name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

createRoot(document.getElementById("root")).render(<App />);
