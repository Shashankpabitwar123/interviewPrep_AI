import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CircularProgressbar } from "react-circular-progressbar";
import MarketingLanding from "./MarketingLanding.jsx";
import {
  GENERATED_NOTES_FOLDER,
  READINESS_FORMULA,
  activityBelongsToPlan,
  buildGeneratedWorkspaceNote,
  combineReadinessReports,
  emptyReadinessReport,
  expectedExamReviewAnswer,
  eventBelongsToPlan,
  filterArchived,
  isTaskCompleteForPlan,
  isUsableStudyNoteCacheEntry,
  normalizeCalendarEvent,
  normalizeNoteFolder,
  normalizeReadinessReport,
  normalizeStudyNoteContent,
  normalizeWorkspaceNote,
  localTimeGreeting,
  prepDateForPlanDay,
  prepTimelineForPlan,
  reconcileExamAttempts,
  reconcileMockAttempts,
  resolveActiveJob,
  resolveExamReviewResult,
  resolveJobForPlan,
  scorePercent,
  studyNoteFailureStatus,
  studyNoteContentToText,
  taskCompletionKey,
  upsertGeneratedWorkspaceNote,
} from "./workspace-utils.js";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/500.css";
import "@fontsource/public-sans/600.css";
import "@fontsource/public-sans/700.css";
import "react-circular-progressbar/dist/styles.css";
import {
  Activity,
  BarChart3,
  Ban,
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
  Copy,
  Database,
  Eye,
  EyeOff,
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
  MessageSquareText,
  MoreVertical,
  NotebookText,
  Palette,
  Plus,
  Play,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trash2,
  UserRound,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import "./styles.css";
import "./guided.css";
import "./approved-guided.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const EXTENSION_GUIDE_URL = "https://github.com/Shashankpabitwar123/interviewPrep_AI/tree/main/browser-extension";
const EXTENSION_WEB_SOURCE = "interviewprep-ai-web";
const EXTENSION_RESPONSE_SOURCE = "interviewprep-ai-extension";
const JOB_BRIEF_CACHE_KEY = "interviewprep_job_briefs";
const JOB_BRIEF_CACHE_VERSION = 2;
const JOB_BRIEF_QA_CACHE_KEY = "interviewprep_job_brief_questions";
const INTERVIEW_DANCE_FRAMES = Array.from(
  { length: 16 },
  (_, index) => `/interview-day-dance/frame-${String(index + 1).padStart(2, "0")}.png`,
);
const INTERVIEW_CELEBRATION_CONFETTI = [
  ["5%", "0ms", "3400ms", "18deg", "-18px", "var(--approved-coral)"],
  ["12%", "160ms", "3900ms", "-34deg", "16px", "var(--approved-mint)"],
  ["18%", "350ms", "3600ms", "62deg", "-10px", "var(--approved-coral)"],
  ["27%", "100ms", "4200ms", "-72deg", "24px", "var(--approved-mint)"],
  ["34%", "500ms", "3800ms", "36deg", "-14px", "var(--approved-coral)"],
  ["41%", "240ms", "4100ms", "-44deg", "18px", "var(--approved-mint)"],
  ["49%", "60ms", "3700ms", "80deg", "-22px", "var(--approved-coral)"],
  ["56%", "420ms", "4000ms", "-58deg", "12px", "var(--approved-mint)"],
  ["63%", "180ms", "3500ms", "28deg", "-12px", "var(--approved-coral)"],
  ["70%", "540ms", "4300ms", "-88deg", "26px", "var(--approved-mint)"],
  ["78%", "120ms", "3750ms", "48deg", "-16px", "var(--approved-coral)"],
  ["86%", "350ms", "4050ms", "-26deg", "17px", "var(--approved-mint)"],
  ["93%", "30ms", "3600ms", "70deg", "-20px", "var(--approved-coral)"],
  ["9%", "700ms", "3700ms", "-50deg", "12px", "var(--approved-mint)"],
  ["23%", "760ms", "3400ms", "38deg", "-14px", "var(--approved-coral)"],
  ["38%", "620ms", "4180ms", "-68deg", "22px", "var(--approved-mint)"],
  ["52%", "820ms", "3550ms", "74deg", "-18px", "var(--approved-coral)"],
  ["67%", "680ms", "4000ms", "-42deg", "15px", "var(--approved-mint)"],
  ["82%", "760ms", "3480ms", "54deg", "-11px", "var(--approved-coral)"],
  ["97%", "600ms", "4400ms", "-78deg", "20px", "var(--approved-mint)"],
];
const WORKSPACE_STORAGE_KEYS = [
  "interviewprep_job_markers",
  "interviewprep_deleted_jobs",
  "interviewprep_archived_job_ids",
  "interviewprep_exam_attempts",
  "interviewprep_mock_attempts",
  "interviewprep_notes",
  "interviewprep_generated_study_notes",
  "interviewprep_note_folders",
  "interviewprep_calendar_events",
  "interviewprep_recent_activity",
  "interviewprep_completed_tasks",
  "interviewprep_active_job_id",
  JOB_BRIEF_CACHE_KEY,
  JOB_BRIEF_QA_CACHE_KEY,
];

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

const NOTE_COLOR_OPTIONS = ["#ff5d42", "#f2bd5c", "#7cdda5", "#5d8bff", "#9f83f4", "#df7ca9"];

const ONBOARDING_VERSION = 1;

const DASHBOARD_TOUR_STEPS = [
  {
    target: "[data-tour='today-next-step']",
    title: "Start with one clear step",
    body: "Today shows the most useful task for your current interview, so you always know what to do next.",
  },
  {
    target: "[data-tour='today-week']",
    title: "Follow this week’s work",
    body: "Your learning and practice tasks stay connected to the selected job and its interview date.",
  },
  {
    target: "[data-tour='today-readiness']",
    title: "Understand your readiness",
    body: "The score uses completed plan work, learning, exam results, mock interviews, and recent consistency.",
  },
  {
    target: "[data-tour='today-workspace']",
    title: "Keep the interview in context",
    body: "See saved jobs, preparation streak, and time remaining without opening several separate pages.",
  },
  {
    target: "[data-tour-nav='prep']",
    title: "Use five simple workspaces",
    body: "Today guides you, Jobs stores roles, Plan organizes your schedule, Notes keeps study material, and Practice contains exams, mocks, and interview insights.",
  },
  {
    target: "[data-tour='settings-button']",
    title: "Control your workspace",
    body: "Settings includes theme, sounds, deleted-job recovery, local fallback, account controls, and the browser capture bubble.",
  },
];

const TAB_ONBOARDING = {
  jobs: {
    target: "[data-tour-page='jobs']",
    title: "Jobs",
    body: "Manage saved jobs, open AI job descriptions, delete or restore job records, and load a job into the dashboard when you want to prepare.",
  },
  prep: {
    target: "[data-tour-page='prep']",
    title: "Prep Plan",
    body: "Review every saved plan, move through preparation days, open generated notes, and create practice exams from the exact topics assigned for each day.",
  },
  exams: {
    target: "[data-tour-page='exams']",
    title: "Exams",
    body: "Generate role-specific exams or mock interviews, choose difficulty, start attempts, submit answers, and review scores and feedback.",
  },
  progress: {
    target: "[data-tour-page='progress']",
    title: "Readiness",
    body: "See the selected job's readiness, next action, completed work, practice results, and most important focus areas in one place.",
  },
  calendar: {
    target: "[data-tour-page='calendar']",
    title: "Calendar",
    body: "View interview dates, prep tasks, mock interviews, and custom events. Click dates to inspect or act on scheduled items.",
  },
  notes: {
    target: "[data-tour-page='notes']",
    title: "Notes",
    body: "Organize AI-generated and personal notes by job, create folders, write your own notes, improve them with AI, and keep interview-ready explanations.",
  },
  settings: {
    target: ".settings-popover",
    title: "Settings",
    body: "Adjust dark mode, generation sound, fallback behavior, the capture bubble extension, deleted-job recovery, account options, and onboarding replay.",
  },
  developer: {
    target: "[data-tour-page='developer']",
    title: "Developer Dashboard",
    body: "Admin-only controls show users, activity, token usage, account status, blocking, deletion, and production monitoring details.",
  },
};

const STANDARD_ONBOARDING_TABS = ["jobs", "prep", "exams", "progress", "calendar", "notes", "settings"];

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
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
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
  const [notes, setNotes] = useState(() => loadLocalList("interviewprep_notes").map(normalizeWorkspaceNote));
  const [generatedStudyNotes, setGeneratedStudyNotes] = useState(() => loadLocalMap("interviewprep_generated_study_notes"));
  const [noteReader, setNoteReader] = useState(null);
  const [noteFolders, setNoteFolders] = useState(() => loadLocalList("interviewprep_note_folders"));
  const [noteDraft, setNoteDraft] = useState({ title: "", body: "", planId: "", folder: "", subfolder: "", noteDate: "" });
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
  const [allowLocalFallback, setAllowLocalFallback] = useState(() => loadAllowLocalFallback());
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedJobId, setSelectedJobId] = useState(() => loadLocalValue("interviewprep_active_job_id"));
  const activeJobIdRef = useRef(selectedJobId);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const workspaceUpdatedAtRef = useRef(null);
  const workspaceRevisionRef = useRef(0);
  const workspaceSyncChainRef = useRef(Promise.resolve());
  const todayIntroPlayedRef = useRef(false);
  const [readinessReport, setReadinessReport] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [jobSwitcherOpen, setJobSwitcherOpen] = useState(false);
  const [selectedPlanDay, setSelectedPlanDay] = useState(1);
  const [user, setUser] = useState(() => loadSavedUser());
  const [authToken, setAuthToken] = useState(() => loadSavedToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [authMessageTone, setAuthMessageTone] = useState("error");
  const [authOtpSent, setAuthOtpSent] = useState(false);
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);
  const [extensionState, setExtensionState] = useState({
    installed: false,
    checking: true,
    bubbleEnabled: false,
    signedIn: false,
    user: null,
    error: "",
  });
  const isAdmin = user?.is_admin || user?.role === "admin";

  function updateSelectedJobId(value) {
    const normalized = value || "";
    activeJobIdRef.current = normalized;
    setSelectedJobId(normalized);
  }
  const onboardingUserKey = user?.email || "guest";
  const [onboarding, setOnboarding] = useState(() => loadOnboardingState(onboardingUserKey));
  const [onboardingMode, setOnboardingMode] = useState("");
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    resetCreatePrepForm();
    setInterviewDate(defaultInterviewDate());
    if (authToken) {
      reloadLocalWorkspaceState();
    } else {
      clearVisibleWorkspaceState();
    }
  }, []);

  useEffect(() => {
    if (!authToken) {
      setWorkspaceHydrated(false);
      setReadinessReport(null);
      return;
    }
    hydrateWorkspace(authToken);
  }, [authToken]);

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

  useEffect(() => {
    setOnboarding(loadOnboardingState(onboardingUserKey));
    setOnboardingMode("");
    setOnboardingStep(0);
  }, [onboardingUserKey]);

  useEffect(() => {
    if (authOpen || settingsOpen || onboardingMode || activeView !== "dashboard" || onboarding.dashboardTourDone || onboarding.skipAll) return;
    const timer = window.setTimeout(() => {
      setOnboardingMode("dashboard");
      setOnboardingStep(0);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeView, authOpen, onboarding.dashboardTourDone, onboarding.skipAll, onboardingMode, settingsOpen]);

  useEffect(() => {
    if (authOpen || settingsOpen || onboardingMode || onboarding.skipAll || activeView === "dashboard" || activeView === "about") return;
    if (activeView === "developer" && !isAdmin) return;
    if (!TAB_ONBOARDING[activeView] || onboarding.seenTabs?.[activeView]) return;
    const timer = window.setTimeout(() => {
      setOnboardingMode(`tab:${activeView}`);
      setOnboardingStep(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeView, authOpen, isAdmin, onboarding.seenTabs, onboarding.skipAll, onboardingMode, settingsOpen]);

  useEffect(() => {
    if (authOpen || !settingsOpen || onboardingMode || onboarding.skipAll || onboarding.seenTabs?.settings) return;
    const timer = window.setTimeout(() => {
      setOnboardingMode("tab:settings");
      setOnboardingStep(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [authOpen, onboarding.seenTabs, onboarding.skipAll, onboardingMode, settingsOpen]);

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
    updateSelectedJobId(loadLocalValue("interviewprep_active_job_id"));
  }

  function saveOnboardingUpdate(nextState) {
    setOnboarding(nextState);
    saveOnboardingState(onboardingUserKey, nextState);
  }

  function completeOnboardingStep() {
    if (onboardingMode === "dashboard") {
      if (onboardingStep < DASHBOARD_TOUR_STEPS.length - 1) {
        setOnboardingStep((current) => current + 1);
        return;
      }
      saveOnboardingUpdate({ ...onboarding, dashboardTourDone: true });
    } else if (onboardingMode.startsWith("tab:")) {
      const tabKey = onboardingMode.replace("tab:", "");
      saveOnboardingUpdate({
        ...onboarding,
        seenTabs: { ...(onboarding.seenTabs || {}), [tabKey]: true },
      });
    }
    setOnboardingMode("");
    setOnboardingStep(0);
  }

  function skipAllOnboarding() {
    const seenTabs = Object.fromEntries([...STANDARD_ONBOARDING_TABS, ...(isAdmin ? ["developer"] : [])].map((tab) => [tab, true]));
    saveOnboardingUpdate({ ...onboarding, dashboardTourDone: true, seenTabs, skipAll: true });
    setOnboardingMode("");
    setOnboardingStep(0);
  }

  function replayOnboarding() {
    const nextState = { version: ONBOARDING_VERSION, dashboardTourDone: false, seenTabs: {}, skipAll: false };
    saveOnboardingUpdate(nextState);
    setSettingsOpen(false);
    setActiveView("dashboard");
    window.setTimeout(() => {
      setOnboardingMode("dashboard");
      setOnboardingStep(0);
    }, 250);
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

  function clearLocalWorkspaceStorage() {
    WORKSPACE_STORAGE_KEYS.forEach((key) => {
      const scopedKey = scopedStorageKey(key);
      if (!scopedKey) return;
      try {
        localStorage.removeItem(scopedKey);
      } catch {
        // Account deletion still proceeds when browser storage is unavailable.
      }
    });
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };
    headers["X-Allow-Local-Fallback"] = allowLocalFallback ? "true" : "false";
    const token = options.authTokenOverride ?? authToken;
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestOptions = { ...options, headers };
    delete requestOptions.authTokenOverride;
    const method = (requestOptions.method || "GET").toUpperCase();
    const retryable = method === "GET" || path.endsWith("/otp");
    const attempts = retryable ? 2 : 1;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(`${API_URL}${path}`, requestOptions);
        if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) {
          await wait(900);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) {
          await wait(900);
          continue;
        }
      }
    }
    throw new Error(lastError?.message === "Failed to fetch"
      ? "Unable to reach the PrepInterview AI backend. Please wait a moment and try again."
      : lastError?.message || "Unable to reach the PrepInterview AI backend.");
  }

  async function readApiError(response, label = "API") {
    try {
      const body = await response.clone().json();
      if (body?.detail) return `${label} returned ${response.status}: ${body.detail}`;
    } catch {
      // Some errors return plain text or an empty body.
    }
    try {
      const text = await response.clone().text();
      if (text) return `${label} returned ${response.status}: ${text}`;
    } catch {
      // Fall through to the generic message.
    }
    return `${label} returned ${response.status}`;
  }

  async function hydrateWorkspace(tokenOverride = authToken) {
    try {
      const response = await apiFetch("/workspace", { authTokenOverride: tokenOverride });
      if (!response.ok) throw new Error(await readApiError(response, "Workspace"));
      const payload = await response.json();
      const data = payload.data || {};
      workspaceUpdatedAtRef.current = payload.updated_at || null;
      workspaceRevisionRef.current = Number(data._revision || 0);
      const hydratedMarkers = data.jobMarkers && typeof data.jobMarkers === "object" ? data.jobMarkers : jobMarkers;
      const hydratedArchivedIds = Array.isArray(data.archivedJobIds) ? data.archivedJobIds : archivedJobIds;
      const preferredJobId = data.activeJobId || loadLocalValue("interviewprep_active_job_id");
      const hydratedExamAttempts = Array.isArray(data.examAttempts) ? data.examAttempts : examAttempts;
      const hydratedMockAttempts = Array.isArray(data.mockAttempts) ? data.mockAttempts : mockAttempts;
      if (Object.keys(data).length) {
        applyWorkspaceCollection(data, "completedTasks", setCompletedTasks, saveCompletedTasks);
        if (Object.prototype.hasOwnProperty.call(data, "notes")) {
          const normalizedNotes = (data.notes || []).map(normalizeWorkspaceNote);
          applyWorkspaceCollection({ notes: normalizedNotes }, "notes", setNotes, (value) => saveLocalList("interviewprep_notes", value));
        }
        if (Object.prototype.hasOwnProperty.call(data, "generatedStudyNotes")) {
          const normalizedGeneratedNotes = Object.fromEntries(Object.entries(data.generatedStudyNotes || {}).map(([key, value]) => [
            key,
            { ...value, planId: value?.planId || String(key).split(":")[0] },
          ]));
          applyWorkspaceCollection({ generatedStudyNotes: normalizedGeneratedNotes }, "generatedStudyNotes", setGeneratedStudyNotes, (value) => saveLocalMap("interviewprep_generated_study_notes", value));
        }
        applyWorkspaceCollection(data, "noteFolders", setNoteFolders, (value) => saveLocalList("interviewprep_note_folders", value));
        if (Object.prototype.hasOwnProperty.call(data, "calendarEvents")) {
          applyWorkspaceCollection(
            { calendarEvents: (data.calendarEvents || []).map((event) => normalizeCalendarEvent(event)) },
            "calendarEvents",
            setCalendarEvents,
            (value) => saveLocalList("interviewprep_calendar_events", value),
          );
        }
        applyWorkspaceCollection(data, "recentActivity", setRecentActivity, (value) => saveLocalList("interviewprep_recent_activity", value));
        applyWorkspaceCollection(data, "examAttempts", setExamAttempts, (value) => saveLocalList("interviewprep_exam_attempts", value));
        applyWorkspaceCollection(data, "mockAttempts", setMockAttempts, (value) => saveLocalList("interviewprep_mock_attempts", value));
        applyWorkspaceCollection(data, "jobMarkers", setJobMarkers, (value) => saveLocalMap("interviewprep_job_markers", value));
        applyWorkspaceCollection(data, "deletedJobs", setDeletedJobs, (value) => saveLocalList("interviewprep_deleted_jobs", value));
        applyWorkspaceCollection(data, "archivedJobIds", setArchivedJobIds, (value) => saveLocalList("interviewprep_archived_job_ids", value));
      }
      const [visibleJobs, visiblePlans] = await Promise.all([
        refreshJobs(hydratedMarkers, hydratedArchivedIds, tokenOverride),
        refreshSavedPlans(hydratedArchivedIds, tokenOverride),
      ]);
      const [examListResult, mockListResult] = await Promise.allSettled([
        apiFetch("/exams", { authTokenOverride: tokenOverride }),
        apiFetch("/mock-interviews", { authTokenOverride: tokenOverride }),
      ]);
      const examListResponse = examListResult.status === "fulfilled" ? examListResult.value : null;
      const mockListResponse = mockListResult.status === "fulfilled" ? mockListResult.value : null;
      if (examListResponse?.ok) {
        const reconciled = reconcileExamAttempts(hydratedExamAttempts, await examListResponse.json(), visiblePlans);
        setExamAttempts(reconciled);
        saveLocalList("interviewprep_exam_attempts", reconciled);
      }
      if (mockListResponse?.ok) {
        const reconciled = reconcileMockAttempts(hydratedMockAttempts, await mockListResponse.json(), visiblePlans);
        setMockAttempts(reconciled);
        saveLocalList("interviewprep_mock_attempts", reconciled);
      }
      const activeJob = visibleJobs.find((job) => String(job.id) === String(preferredJobId)) || visibleJobs[0] || null;
      const matchingPlan = activeJob
        ? visiblePlans.find((savedPlan) => String(savedPlan.job_post_id) === String(activeJob.id))
        : null;
      updateSelectedJobId(activeJob?.id || "");
      saveLocalValue("interviewprep_active_job_id", activeJob?.id || "");
      if (matchingPlan) {
        const planResponse = await apiFetch(`/prep-plans/${matchingPlan.id}`, { authTokenOverride: tokenOverride });
        if (planResponse.ok) {
          const planDetail = await planResponse.json();
          setPlan({ ...planDetail, job_color: colorForJobId(planDetail.job_post_id, hydratedMarkers, planDetail.job_title) });
          await refreshReadiness(tokenOverride, planDetail.prep_plan_id);
        } else {
          setPlan(null);
          setReadinessReport(null);
        }
      } else {
        setPlan(null);
        setReadinessReport(null);
      }
      setWorkspaceHydrated(true);
    } catch (error) {
      const [visibleJobs, visiblePlans] = await Promise.all([
        refreshJobs(jobMarkers, archivedJobIds, tokenOverride),
        refreshSavedPlans(archivedJobIds, tokenOverride),
      ]);
      const preferredJobId = loadLocalValue("interviewprep_active_job_id");
      const activeJob = visibleJobs.find((job) => String(job.id) === String(preferredJobId)) || visibleJobs[0] || null;
      const matchingPlan = activeJob
        ? visiblePlans.find((savedPlan) => String(savedPlan.job_post_id) === String(activeJob.id))
        : null;
      updateSelectedJobId(activeJob?.id || "");
      if (matchingPlan) {
        try {
          const planResponse = await apiFetch(`/prep-plans/${matchingPlan.id}`, { authTokenOverride: tokenOverride });
          if (planResponse.ok) {
            const detail = await planResponse.json();
            setPlan({ ...detail, job_color: colorForJobId(detail.job_post_id, jobMarkers, detail.job_title) });
            await refreshReadiness(tokenOverride, detail.prep_plan_id);
          }
        } catch {
          // Jobs remain usable even if the selected plan could not be restored.
        }
      }
      setWorkspaceHydrated(true);
      setStatus(error.message || "Workspace sync unavailable");
    }
  }

  function syncWorkspace() {
    const data = {
      completedTasks,
      notes,
      generatedStudyNotes,
      noteFolders,
      calendarEvents,
      recentActivity,
      examAttempts,
      mockAttempts,
      jobMarkers,
      deletedJobs,
      archivedJobIds,
      activeJobId: selectedJobId || "",
    };
    const persist = async () => {
      try {
        const response = await apiFetch("/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data,
            expected_updated_at: workspaceUpdatedAtRef.current,
            expected_revision: workspaceRevisionRef.current,
          }),
        });
        if (!response.ok) throw new Error(await readApiError(response, "Workspace sync"));
        const payload = await response.json();
        workspaceUpdatedAtRef.current = payload.updated_at || null;
        workspaceRevisionRef.current = Number(payload.data?._revision || workspaceRevisionRef.current + 1);
        await refreshReadiness();
      } catch (error) {
        setStatus(error.message || "Workspace sync failed. Your local copy is still safe.");
      }
    };
    workspaceSyncChainRef.current = workspaceSyncChainRef.current.catch(() => {}).then(persist);
    return workspaceSyncChainRef.current;
  }

  async function refreshReadiness(tokenOverride = authToken, prepPlanIdOverride = plan?.prep_plan_id) {
    if (!tokenOverride) return;
    const query = prepPlanIdOverride ? `?prep_plan_id=${prepPlanIdOverride}` : "";
    try {
      const response = await apiFetch(`/workspace/readiness${query}`, { authTokenOverride: tokenOverride });
      if (response.status === 404) {
        setReadinessReport(null);
        return;
      }
      if (!response.ok) return;
      const report = normalizeReadinessReport(await response.json());
      if (activeJobIdRef.current && report?.job_post_id && !idsMatch(activeJobIdRef.current, report.job_post_id)) return;
      setReadinessReport(report);
    } catch {
      // Readiness will refresh after the next successful workspace sync.
    }
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

  const streak = useMemo(() => buildStudyStreak(completedTasks), [completedTasks]);

  useEffect(() => {
    if (!authToken || !workspaceHydrated) return undefined;
    const timer = window.setTimeout(() => syncWorkspace(), 700);
    return () => window.clearTimeout(timer);
  }, [authToken, workspaceHydrated, completedTasks, notes, generatedStudyNotes, noteFolders, calendarEvents, recentActivity, examAttempts, mockAttempts, jobMarkers, deletedJobs, archivedJobIds, selectedJobId]);

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
      const visibleJobs = filterArchived(saved, archivedIds).map((job, index) => {
        const identity = normalizeJobIdentityForDisplay(job.title, job.company || companyFromUrl(job.source_url));
        return {
          id: job.id,
          title: identity.role,
          company: identity.company,
          source_url: job.source_url,
          description_preview: job.description_preview,
          saved_at: index === 0 ? "Saved now" : `Saved ${index + 1}h ago`,
          logo: logoFor(identity.role, job.source_url),
          tone: toneFor(job.source_url),
          color: colorForJobId(job.id, markers, identity.role),
          interview_at: job.interview_at,
          hours_per_day: job.hours_per_day,
        };
      });
      setJobs(visibleJobs);
      return visibleJobs;
    } catch {
      setStatus("Backend Offline");
      return [];
    }
  }

  async function refreshSavedPlans(archivedIds = archivedJobIds, tokenOverride = authToken) {
    try {
      const response = await apiFetch(`/prep-plans`, { authTokenOverride: tokenOverride });
      if (!response.ok) return;
      const plans = await response.json();
      const visiblePlans = filterArchived(plans, archivedIds, (savedPlan) => savedPlan.job_post_id);
      setSavedPlans(visiblePlans);
      return visiblePlans;
    } catch {
      setStatus("Backend Offline");
      return [];
    }
  }

  function resetCreatePrepForm() {
    setMode("paste");
    setJobTitle("");
    setCompany("");
    setJobDescription("");
    setSourceUrl("");
    setInterviewDate(defaultInterviewDate());
    setHoursPerDay(3);
  }

  function openAddJobModal() {
    resetCreatePrepForm();
    setJobModalOpen(true);
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
      if (!response.ok) throw new Error(await readApiError(response, "Prep plan"));

      const savedPlan = await response.json();
      const planColor = colorForJobId(savedPlan.job_post_id, jobMarkers, savedPlan.job_title);
      const nextMarkers = savedPlan.job_post_id ? { ...jobMarkers, [savedPlan.job_post_id]: planColor } : jobMarkers;
      if (savedPlan.job_post_id) {
        setJobMarkers(nextMarkers);
        saveLocalMap("interviewprep_job_markers", nextMarkers);
      }
      setPlan({ ...savedPlan, job_color: planColor });
      updateSelectedJobId(savedPlan.job_post_id || "");
      saveLocalValue("interviewprep_active_job_id", savedPlan.job_post_id || "");
      setJobTitle(savedPlan.job_title || "");
      setCompany(savedPlan.company || inferCompanyName(company, jobDescription, sourceUrl));
      setSelectedPlanDay(1);
      setExam(null);
      setMockInterview(null);
      playGeneratedSound(soundVolume);
      setStatus("Prep Plan Saved");
      setJobModalOpen(false);
      markStudyActivity("plan-generated");
      addActivity({ type: "plan", title: "Prep plan generated", detail: savedPlan.job_title, badge: `${savedPlan.days_until_interview}d`, target: "prep", prepPlanId: savedPlan.prep_plan_id, jobPostId: savedPlan.job_post_id });
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
      if (mode === "url" && !sourceUrl.trim()) throw new Error("Add the job URL before saving.");
      if (mode === "paste" && !jobDescription.trim()) throw new Error("Paste the job description before saving.");
      if (!interviewDate || interviewDate < minInterviewDateTime()) throw new Error("Choose today or a future interview date.");
      if (!Number(hoursPerDay) || Number(hoursPerDay) < 0.5) throw new Error("Choose at least 0.5 preparation hours per day.");
      const payload = {
        job_title: jobTitle.trim() || "Auto-detect role",
        company: company.trim() || "Auto-detect company",
        interview_at: interviewDate ? new Date(interviewDate).toISOString() : undefined,
        hours_per_day: Number(hoursPerDay),
      };
      if (mode === "url") payload.source_url = normalizeUrl(sourceUrl);
      else payload.job_description = normalizeSavedJobDescription(jobDescription, jobTitle);
      const response = await apiFetch(`/jobs/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Job save"));
      const saved = await response.json();
      setCompany(saved.company || inferCompanyName(company, jobDescription, sourceUrl));
      const jobColor = colorForJobId(saved.job_post_id, jobMarkers, saved.role_title || jobTitle);
      const nextMarkers = { ...jobMarkers, [saved.job_post_id]: jobColor };
      setJobMarkers(nextMarkers);
      saveLocalMap("interviewprep_job_markers", nextMarkers);
      await refreshJobs(nextMarkers);
      addActivity({ type: "job", title: "Job saved", detail: saved.role_title || jobTitle || "Saved job", badge: "", target: "jobs", jobPostId: saved.job_post_id });
      setStatus("Job Saved");
      updateSelectedJobId(saved.job_post_id || "");
      saveLocalValue("interviewprep_active_job_id", saved.job_post_id || "");
      setPlan(null);
      setReadinessReport(null);
      setJobModalOpen(false);
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
      updateSelectedJobId(saved.job_post_id || "");
      saveLocalValue("interviewprep_active_job_id", saved.job_post_id || "");
      setPlan(null);
      setReadinessReport(null);
      addActivity({ type: "job", title: "Job added manually", detail: saved.role_title || jobDraft.title, badge: "", target: "jobs", jobPostId: saved.job_post_id });
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
      const remainingJobs = jobs.filter((job) => String(job.id) !== String(jobId));
      setJobs(remainingJobs);
      setSavedPlans((current) => current.filter((savedPlan) => String(savedPlan.job_post_id) !== String(jobId)));
      removeCalendarEventsForJobs([jobId], deletedJob ? [deletedJob.title] : []);
      if (String(selectedJobId) === String(jobId)) {
        const nextJob = remainingJobs[0] || null;
        updateSelectedJobId(nextJob?.id || "");
        saveLocalValue("interviewprep_active_job_id", nextJob?.id || "");
        setPlan(null);
        setReadinessReport(null);
        if (nextJob) await useSavedJob(nextJob, { navigate: false });
      }
      setSelectedJobIds((current) => current.filter((id) => String(id) !== String(jobId)));
      setConfirmDeleteJob(null);
      setJobActionMenuId(null);
      addActivity({ type: "job", title: "Job moved to bin", detail: deletedJob?.title || "Saved job", badge: "", target: "jobs", jobPostId: jobId });
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
      const remainingJobs = jobs.filter((job) => !selectedIds.has(String(job.id)));
      setJobs(remainingJobs);
      setSavedPlans((current) => current.filter((savedPlan) => !selectedIds.has(String(savedPlan.job_post_id))));
      setSelectedJobIds([]);
      setConfirmBulkDeleteJobs(false);
      removeCalendarEventsForJobs(selectedJobIds, recoverableJobs.map((job) => job.title));
      if (selectedIds.has(String(selectedJobId))) {
        const nextJob = remainingJobs[0] || null;
        updateSelectedJobId(nextJob?.id || "");
        saveLocalValue("interviewprep_active_job_id", nextJob?.id || "");
        setPlan(null);
        setReadinessReport(null);
        if (nextJob) await useSavedJob(nextJob, { navigate: false });
      }
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

  async function useSavedJob(job, options = {}) {
    const { navigate = true } = options;
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
      setCompany(detail.company || inferCompanyName("", detail.description || "", detail.source_url || ""));
      setJobDescription(detail.description || "");
      setSourceUrl(detail.source_url || "");
      setMode(detail.source_url ? "url" : "paste");
      updateSelectedJobId(detail.id);
      saveLocalValue("interviewprep_active_job_id", detail.id);
      if (detail.interview_at) setInterviewDate(toLocalDateTimeInput(detail.interview_at));
      if (detail.hours_per_day) setHoursPerDay(detail.hours_per_day);
      if (matchingPlan) {
        const planResponse = await apiFetch(`/prep-plans/${matchingPlan.id}`);
        if (planResponse.ok) {
          const planDetail = await planResponse.json();
          setPlan({ ...planDetail, job_color: colorForJobId(planDetail.job_post_id, jobMarkers, planDetail.job_title) });
          setSelectedPlanDay(1);
          await refreshReadiness(authToken, planDetail.prep_plan_id);
        }
      } else {
        setPlan(null);
        setReadinessReport(null);
      }
      if (navigate) setActiveView("dashboard");
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
      if (!detailResponse.ok) throw new Error(await readApiError(detailResponse, "Job"));
      if (!briefResponse.ok) throw new Error(await readApiError(briefResponse, "Brief"));
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

  async function loadSavedJobDetail(job) {
    const response = await apiFetch(`/jobs/${job.id}`);
    if (!response.ok) throw new Error(await readApiError(response, "Job"));
    const detail = await response.json();
    return {
      ...job,
      ...detail,
      title: detail.title || job.title,
      company: detail.company || job.company || inferCompanyName("", detail.description || "", detail.source_url || job.source_url || ""),
      source_url: detail.source_url || job.source_url || "",
    };
  }

  async function loadSavedJobAnalysis(job) {
    const response = await apiFetch(`/jobs/${job.id}/brief`);
    if (!response.ok) throw new Error(await readApiError(response, "Job analysis"));
    return response.json();
  }

  async function askSavedJobAnalysisQuestion(jobId, question) {
    const response = await apiFetch(`/jobs/${jobId}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Job question"));
    return response.json();
  }

  async function updateSavedJobDescription(jobId, description) {
    const response = await apiFetch(`/jobs/${jobId}/description`, {
      method: "PATCH",
      body: JSON.stringify({ description }),
    });
    if (!response.ok) throw new Error(await readApiError(response, "Job description"));
    const detail = await response.json();
    setJobs((current) => current.map((job) => String(job.id) === String(jobId)
      ? { ...job, description_preview: descriptionPreview(detail.description), ...detail }
      : job));
    addActivity({ type: "job", title: "Job description updated", detail: detail.title || "Saved job", target: "jobs" });
    setStatus("Job description updated");
    return detail;
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
      if (!response.ok) throw new Error(await readApiError(response, "Job question"));
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
      if (!response.ok) throw new Error(await readApiError(response, "Prep plan"));
      const detail = await response.json();
      setPlan({ ...detail, job_color: colorForJobId(detail.job_post_id, jobMarkers, detail.job_title) });
      updateSelectedJobId(detail.job_post_id || "");
      saveLocalValue("interviewprep_active_job_id", detail.job_post_id || "");
      setSelectedPlanDay(1);
      setStatus("Prep Plan Loaded");
      await refreshReadiness(authToken, detail.prep_plan_id);
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
      if (plan?.prep_plan_id === prepPlanId) {
        setPlan(null);
        setReadinessReport(null);
      }
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
      const scope = options.scope || (focusTopics?.length ? "custom_topics" : "selected_day");
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
          scope,
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
        scope: generatedExam.scope || scope,
      scopeLabel: options.scopeLabel || examScopeLabel(generatedExam.scope || scope, day),
        jobColor: colorForPlan(sourcePlan, jobMarkers),
        status: "ready",
        createdAt: new Date().toISOString(),
      };
      const nextAttempts = [attempt, ...examAttempts];
      setExamAttempts(nextAttempts);
      saveLocalList("interviewprep_exam_attempts", nextAttempts);
      setExam(generatedExam);
      addGeneratedCalendarEvent(`Exam: ${sourcePlan.job_title}`, "exam", colorForPlan(sourcePlan, jobMarkers), day, sourcePlan, { resourceType: "exam", resourceId: generatedExam.id });
      setExamAnswers({});
      setExamResult(null);
      playGeneratedSound(soundVolume);
      setStatus("Exam Ready");
      markStudyActivity("exam-generated");
      addActivity({ type: "exam", title: "Exam generated", detail: generatedExam.title, badge: `${generatedExam.questions.length} Qs`, target: "exams", prepPlanId: sourcePlan.prep_plan_id, jobPostId: sourcePlan.job_post_id });
      setActiveView("exams");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      if (options.taskKey) setLoadingExamTaskId((current) => removeLoadingId(current, options.taskKey));
      setLoading(false);
    }
  }

  function scheduleMockInterviewAttempt(options = {}) {
    const sourcePlan = options.planOverride || plan;
    if (!sourcePlan?.prep_plan_id) return;
    const difficulty = options.difficulty || mockDifficulty;
    const questionTypes = options.questionTypes || mockQuestionTypes;
    const questionCount = Number(options.questionCount || { easy: 4, medium: 6, hard: 8 }[difficulty] || 6);
    const attempt = {
      id: crypto.randomUUID(),
      jobTitle: sourcePlan.job_title,
      prepPlanId: sourcePlan.prep_plan_id,
      jobPostId: sourcePlan.job_post_id,
      jobColor: colorForPlan(sourcePlan, jobMarkers),
      difficulty,
      questionTypes,
      questionCount,
      day: options.day || selectedPlanDay,
      focusTopics: options.focusTopics || [],
      scope: options.scope || "full_plan",
      scopeLabel: options.scopeLabel || mockScopeLabel(options.scope || "full_plan", options.day || selectedPlanDay),
      status: "ready",
      createdAt: new Date().toISOString(),
    };
    const nextAttempts = [attempt, ...mockAttempts];
    setMockAttempts(nextAttempts);
    saveLocalList("interviewprep_mock_attempts", nextAttempts);
    addActivity({ type: "mock", title: "Mock interview set up", detail: `${sourcePlan.job_title} • ${attempt.difficulty}`, badge: `${attempt.questionCount} Qs`, target: "exams", prepPlanId: sourcePlan.prep_plan_id, jobPostId: sourcePlan.job_post_id });
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

  async function startMockFromPlan(task = {}) {
    if (!plan?.prep_plan_id) return;
    const day = task.day || selectedPlanDay;
    const difficulty = task.difficulty || difficultyForPlanDay(plan, day);
    const attempt = {
      id: crypto.randomUUID(),
      jobTitle: plan.job_title,
      prepPlanId: plan.prep_plan_id,
      jobPostId: plan.job_post_id,
      jobColor: colorForPlan(plan, jobMarkers),
      difficulty,
      questionTypes: mockQuestionTypes,
      questionCount: { easy: 4, medium: 6, hard: 8 }[difficulty] || 6,
      day,
      focusTopics: task.topics || [],
      scope: "through_selected_day",
      scopeLabel: mockScopeLabel("through_selected_day", day),
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
      focusTopics: attempt.focusTopics,
      topic: attempt.focusTopics?.[0],
      scope: attempt.scope,
      day: attempt.day,
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

  async function deleteAttempt(kind, id) {
    const source = kind === "exam" ? examAttempts : mockAttempts;
    const attempt = source.find((item) => item.id === id);
    const backendId = kind === "exam" ? attempt?.exam?.id : attempt?.interview?.id;
    setLoading(true);
    setStatus(`Deleting ${kind === "exam" ? "Exam" : "Mock Interview"}`);
    try {
      if (backendId) {
        const path = kind === "exam" ? `/exams/${backendId}` : `/mock-interviews/${backendId}`;
        const response = await apiFetch(path, { method: "DELETE" });
        if (!response.ok && response.status !== 404) throw new Error(await readApiError(response, "Attempt delete"));
      }
      const next = source.filter((item) => item.id !== id);
      if (kind === "exam") {
        setExamAttempts(next);
        saveLocalList("interviewprep_exam_attempts", next);
      } else {
        setMockAttempts(next);
        saveLocalList("interviewprep_mock_attempts", next);
      }
      if (backendId) {
        setCalendarEvents((current) => {
          const remaining = current.filter((event) => !(event.resourceType === kind && String(event.resourceId) === String(backendId)));
          saveLocalList("interviewprep_calendar_events", remaining);
          return remaining;
        });
      }
      setConfirmDeleteAttempt(null);
      await refreshReadiness(authToken, attempt?.prepPlanId || plan?.prep_plan_id);
      setStatus("Attempt Deleted");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
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
      addActivity({ type: "exam", title: "Exam submitted", detail: activeExam.title, badge: `${Math.round(result.average_score * 100)}%`, target: "exams", prepPlanId: plan?.prep_plan_id, jobPostId: plan?.job_post_id });
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
          scope: options.scope || "full_plan",
          day: options.day || selectedPlanDay,
          focus_topics: options.focusTopics || [],
          topic: options.topic,
        }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      let interview = await response.json();
      if (options.forceComplete && interview.status !== "complete") {
        const completeResponse = await apiFetch(`/mock-interviews/${interview.id}/complete`, { method: "POST" });
        if (!completeResponse.ok) throw new Error(`API returned ${completeResponse.status}`);
        interview = await completeResponse.json();
      }
      setMockInterview(interview);
      addGeneratedCalendarEvent(`Mock interview: ${plan.job_title}`, "mock", colorForPlan(plan, jobMarkers), options.day || selectedPlanDay, plan, { resourceType: "mock", resourceId: interview.id });
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
    setLoading(true);
    setStatus("Ending Mock Interview");
    let interview;
    try {
      const response = await apiFetch(`/mock-interviews/${mockSession.interview.id}/complete`, { method: "POST" });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      interview = {
        ...await response.json(),
        questionTypes: mockSession.questionTypes || [],
      };
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setLoading(false);
      return;
    }
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
    setLoading(false);
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
      prepPlanId: item.prepPlanId ?? plan?.prep_plan_id,
      jobPostId: item.jobPostId ?? plan?.job_post_id ?? selectedJobId,
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
    const taskPlan = { prep_plan_id: task.planId || plan?.prep_plan_id || plan?.id };
    const taskKey = taskCompletionKey(taskPlan, task, today);
    const wasDone = isTaskComplete(task, completedTasks);
    setCompletedTasks((current) => {
      const next = { ...current };
      if (wasDone) {
        const suffix = `:plan:${taskPlan.prep_plan_id || "unscoped"}:task:${task.serverTaskId || task.id || task.title}`;
        Object.keys(next).filter((key) => key.endsWith(suffix)).forEach((key) => delete next[key]);
      } else next[taskKey] = today;
      saveCompletedTasks(next);
      return next;
    });
    if (!wasDone) addActivity({ type: "practice", title: "Task completed", detail: task.title, badge: "done", target: ["practice_exam", "mock_interview"].includes(task.task_type) ? "exams" : "prep", prepPlanId: task.planId || plan?.prep_plan_id, jobPostId: plan?.job_post_id });
    if (task.serverTaskId) {
      apiFetch(`/prep-plans/tasks/${task.serverTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: wasDone ? "not_started" : "complete" }),
      }).then((response) => {
        if (!response.ok) throw new Error(`Task update returned ${response.status}`);
        return refreshReadiness();
      }).catch(() => setStatus("Task saved locally; server sync will retry"));
    }
  }

  function studyNoteCacheKey(task) {
    const taskKey = task.id || task.title;
    return `${plan?.prep_plan_id || plan?.job_id || "sample"}:${task.day || selectedPlanDay}:${taskKey}`;
  }

  function isStudyNoteGenerated(task) {
    if (["practice_exam", "mock_interview"].includes(task?.task_type)) return false;
    const cacheKey = studyNoteCacheKey(task);
    return isUsableStudyNoteCacheEntry(generatedStudyNotes[cacheKey])
      && notes.some((note) => note.generationKey === cacheKey);
  }

  function saveGeneratedNoteToWorkspace(content, task, cacheKey) {
    if (!content || !plan) return;
    const planId = String(plan.prep_plan_id || plan.id || plan.job_id || "");
    const day = Number(task.day || selectedPlanDay || 1);
    const noteJob = resolveJobForPlan(jobs, plan, selectedJobId);
    const noteDate = prepDateForDay(plan, noteJob, day);
    const normalized = normalizeStudyNoteContent(content);
    if (!normalized) throw new Error("The AI returned an incomplete study note. Please generate it again.");
    const nextNote = buildGeneratedWorkspaceNote({ content: normalized, task, cacheKey, planId, noteDate });
    setNotes((current) => {
      const next = upsertGeneratedWorkspaceNote(current, nextNote);
      saveLocalList("interviewprep_notes", next);
      return next;
    });
    setNoteFolders((current) => {
      const next = addNoteFolder(current, GENERATED_NOTES_FOLDER, planId, noteDate);
      saveLocalList("interviewprep_note_folders", next);
      return next;
    });
    return normalized;
  }

  function discardGeneratedStudyNote(cacheKey) {
    setGeneratedStudyNotes((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, cacheKey)) return current;
      const next = { ...current };
      delete next[cacheKey];
      saveLocalMap("interviewprep_generated_study_notes", next);
      return next;
    });
  }

  async function startStudyTask(task) {
    const taskKey = task.id || task.title;
    const cacheKey = studyNoteCacheKey(task);
    if (task.task_type === "mock_interview") {
      await startMockFromPlan(task);
      return;
    }
    if (task.task_type === "practice_exam") {
      setPracticeExamPrompt({
        task,
        day: task.day || selectedPlanDay,
        focusTopics: task.topics || [],
        taskKey,
        recommendedDifficulty: task.difficulty || difficultyForPlanDay(plan, task.day || selectedPlanDay),
      });
      return;
    }
    const cachedNote = generatedStudyNotes[cacheKey];
    const cachedContent = normalizeStudyNoteContent(cachedNote?.content);
    if (cachedContent) {
      const readyContent = saveGeneratedNoteToWorkspace(cachedContent, task, cacheKey);
      setNoteReader({ task, content: readyContent });
      setStatus(readyContent.source === "heuristic" ? "Study Notes Ready" : "AI Study Notes Ready");
      addActivity({ type: "note", title: "Study note opened", detail: task.title, badge: readyContent.source || "saved", target: "prep" });
      return;
    }
    if (cachedNote) discardGeneratedStudyNote(cacheKey);
    setLoadingStudyTaskId((current) => addLoadingId(current, taskKey));
    setLoading(true);
    setStatus("Generating Study Notes");
    try {
      let content = null;
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
            difficulty: task.difficulty || difficultyForPlanDay(plan, task.day || selectedPlanDay),
          }),
        });
        if (!response.ok) throw new Error(await readApiError(response, "Study notes"));
        content = await response.json();
      }
      if (!content && allowLocalFallback) content = generateStudyNote(plan, task);
      if (!content) throw new Error("AI study-note generation is unavailable.");
      const readyContent = saveGeneratedNoteToWorkspace(content, task, cacheKey);
      setGeneratedStudyNotes((current) => {
        const next = {
          ...current,
          [cacheKey]: {
            content: readyContent,
            taskTitle: task.title,
            planId: String(plan?.prep_plan_id || plan?.id || ""),
            jobPostId: plan?.job_post_id,
            status: "ready",
            updatedAt: new Date().toISOString(),
          },
        };
        saveLocalMap("interviewprep_generated_study_notes", next);
        return next;
      });
      setNoteReader({ task, content: readyContent });
      playGeneratedSound(soundVolume);
      setStatus(readyContent.source === "heuristic" ? "Study Notes Ready" : "AI Study Notes Ready");
      addActivity({ type: "note", title: "Study note opened", detail: task.title, badge: readyContent.source || "", target: "prep" });
    } catch (error) {
      if (!allowLocalFallback) {
        setStatus(studyNoteFailureStatus(error));
        return;
      }
      const fallbackContent = generateStudyNote(plan, task);
      const readyContent = saveGeneratedNoteToWorkspace(fallbackContent, task, cacheKey);
      setGeneratedStudyNotes((current) => {
        const next = {
          ...current,
          [cacheKey]: {
            content: readyContent,
            taskTitle: task.title,
            planId: String(plan?.prep_plan_id || plan?.id || ""),
            jobPostId: plan?.job_post_id,
            status: "ready",
            updatedAt: new Date().toISOString(),
          },
        };
        saveLocalMap("interviewprep_generated_study_notes", next);
        return next;
      });
      setNoteReader({
        task,
        content: readyContent,
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
    const taskPlan = { prep_plan_id: task.planId || plan?.prep_plan_id || plan?.id };
    const taskKey = taskCompletionKey(taskPlan, task, today);
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
    const folder = normalizeNoteFolder(noteDraft.folder) || "Study notes";
    const subfolder = noteDraft.subfolder?.trim() || "";
    const noteDate = noteDraft.noteDate || dateKey(new Date());
    const note = {
      id: crypto.randomUUID(),
      title: noteDraft.title.trim() || "Untitled note",
      body: noteDraft.body.trim(),
      planId: noteDraft.planId,
      folder,
      subfolder,
      noteDate,
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [note, ...notes];
    const nextFolders = addNoteFolder(noteFolders, folder, noteDraft.planId, noteDate);
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    setNoteDraft({ title: "", body: "", planId: noteDraft.planId, folder, subfolder, noteDate });
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
        noteDate: noteDraft.noteDate || dateKey(new Date()),
        createdAt: new Date().toISOString(),
      };
      const nextNotes = [imported, ...notes];
      const nextFolders = addNoteFolder(noteFolders, imported.folder, imported.planId, imported.noteDate);
      setNotes(nextNotes);
      setNoteFolders(nextFolders);
      saveLocalList("interviewprep_notes", nextNotes);
      saveLocalList("interviewprep_note_folders", nextFolders);
      markStudyActivity("note-imported");
      addActivity({ type: "note", title: "Note imported", detail: imported.title, badge: "import", target: "notes" });
      setStatus("Note Imported");
    };
    reader.readAsText(file);
  }

  async function generateWorkspaceNote(planId, folder = "Study notes", subfolder = "", noteDate = "") {
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
      let content = null;
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
      if (!generatedResponse.ok) throw new Error(await generatedResponse.text());
      content = await generatedResponse.json();
      if (!content && allowLocalFallback) content = generateStudyNote(planDetail, noteTask);
      if (!content) throw new Error("AI note generation is unavailable.");
      const noteJob = resolveJobForPlan(jobs, planDetail, selectedJobId);
      const finalFolder = normalizeNoteFolder(folder) || "Study notes";
      const generatedNote = {
        id: crypto.randomUUID(),
        title: content.title || noteTask.title,
        body: studyNoteContentToText(content),
        planId,
        folder: finalFolder,
        subfolder: subfolder?.trim() || "",
        noteDate: noteDate || prepDateForDay(planDetail, noteJob, noteTask.day || 1),
        generated: true,
        createdAt: new Date().toISOString(),
      };
      const nextNotes = [generatedNote, ...notes];
      const nextFolders = addNoteFolder(noteFolders, finalFolder, planId, generatedNote.noteDate);
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
    const removedNote = notes.find((note) => note.id === noteId);
    const nextNotes = notes.filter((note) => note.id !== noteId);
    const nextFolders = normalizeNoteFolder(removedNote?.folder) === GENERATED_NOTES_FOLDER
      && !nextNotes.some((note) => note.folder === GENERATED_NOTES_FOLDER
        && String(note.planId || "") === String(removedNote.planId || "")
        && String(note.noteDate || "") === String(removedNote.noteDate || ""))
      ? noteFolders.filter((folder) => !matchesNoteFolder(folder, GENERATED_NOTES_FOLDER, removedNote.planId, removedNote.noteDate))
      : noteFolders;
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    if (removedNote?.generationKey) discardGeneratedStudyNote(removedNote.generationKey);
  }

  function createBlankNote({ title, folder = "", planId = "", noteDate = "" }) {
    const cleanFolder = normalizeNoteFolder(folder);
    const scopedDate = noteDate || dateKey(new Date());
    const note = {
      id: crypto.randomUUID(),
      title: title.trim() || "Untitled note",
      body: "",
      planId,
      folder: cleanFolder,
      subfolder: "",
      noteDate: scopedDate,
      color: "#ff5d42",
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [note, ...notes];
    const nextFolders = addNoteFolder(noteFolders, cleanFolder, planId, scopedDate);
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Note created", detail: note.title, badge: cleanFolder, target: "notes" });
    setStatus("Note Created");
    return note.id;
  }

  function updateNote(noteId, patch, options = {}) {
    const currentNote = notes.find((note) => note.id === noteId);
    const nextNotes = notes.map((note) => (
      note.id === noteId ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note
    ));
    const nextFolders = patch.folder
      ? addNoteFolder(noteFolders, patch.folder, patch.planId ?? currentNote?.planId, patch.noteDate ?? currentNote?.noteDate)
      : noteFolders;
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    if (!options.quiet) {
      addActivity({ type: "note", title: "Note updated", detail: patch.title || "Saved note", badge: "saved", target: "notes" });
      setStatus("Note Updated");
    }
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
      if (!allowLocalFallback) {
        setStatus("AI Note Improvement Failed");
        return;
      }
      updateNote(noteId, {
        ...sourceNote,
        body: improveNoteLocally(sourceNote),
      });
      setStatus("Note Improved Locally");
    } finally {
      setImprovingNoteId("");
    }
  }

  function createNoteFolder(folderName, scope = {}) {
    const folder = normalizeNoteFolder(folderName);
    if (!folder) return false;
    if (folder === GENERATED_NOTES_FOLDER) {
      setStatus("Generated notes appears automatically after AI creates a note");
      return false;
    }
    if (hasNoteFolder(noteFolders, folder, scope.planId, scope.noteDate)) {
      setStatus("Folder Already Exists");
      return false;
    }
    const nextFolders = addNoteFolder(noteFolders, folder, scope.planId, scope.noteDate);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Folder created", detail: folder, badge: "folder", target: "notes" });
    setStatus("Folder Created");
    return true;
  }

  function renameNoteFolder(folderName, nextFolderName, scope = {}) {
    const currentFolder = normalizeNoteFolder(folderName).trim();
    const renamedFolder = normalizeNoteFolder(nextFolderName).trim();
    if (!currentFolder || !renamedFolder || renamedFolder === currentFolder) return false;
    if ([currentFolder, renamedFolder].includes(GENERATED_NOTES_FOLDER)) {
      setStatus("Generated notes is managed automatically");
      return false;
    }
    if (hasNoteFolder(noteFolders, renamedFolder, scope.planId, scope.noteDate)) {
      setStatus("Folder Already Exists");
      return false;
    }
    const belongsToFolder = (note) => normalizeNoteFolder(note.folder) === currentFolder
      && String(note.planId || "") === String(scope.planId || "")
      && String(note.noteDate || dateKey(new Date())) === String(scope.noteDate || dateKey(new Date()));
    const nextNotes = notes.map((note) => (
      belongsToFolder(note) ? { ...note, folder: renamedFolder, updatedAt: new Date().toISOString() } : note
    ));
    const remainingFolders = noteFolders.filter((folder) => !matchesNoteFolder(folder, currentFolder, scope.planId, scope.noteDate));
    const nextFolders = addNoteFolder(remainingFolders, renamedFolder, scope.planId, scope.noteDate);
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    addActivity({ type: "note", title: "Folder renamed", detail: `${currentFolder} to ${renamedFolder}`, badge: "folder", target: "notes" });
    setStatus("Folder Renamed");
    return true;
  }

  function deleteNoteFolder(folderName, scope = {}) {
    const normalizedFolder = normalizeNoteFolder(folderName);
    const matchesScope = (note) => normalizeNoteFolder(note.folder) === normalizedFolder
      && String(note.planId || "") === String(scope.planId || "")
      && String(note.noteDate || dateKey(new Date())) === String(scope.noteDate || dateKey(new Date()));
    const deletedCount = notes.filter(matchesScope).length;
    const deletedGenerationKeys = notes.filter(matchesScope).map((note) => note.generationKey).filter(Boolean);
    const nextNotes = notes.filter((note) => !matchesScope(note));
    const nextFolders = noteFolders.filter((folder) => !matchesNoteFolder(folder, normalizedFolder, scope.planId, scope.noteDate));
    setNotes(nextNotes);
    setNoteFolders(nextFolders);
    saveLocalList("interviewprep_notes", nextNotes);
    saveLocalList("interviewprep_note_folders", nextFolders);
    if (deletedGenerationKeys.length) {
      setGeneratedStudyNotes((current) => {
        const next = { ...current };
        deletedGenerationKeys.forEach((key) => delete next[key]);
        saveLocalMap("interviewprep_generated_study_notes", next);
        return next;
      });
    }
    addActivity({ type: "note", title: "Folder removed", detail: `${normalizedFolder}; ${deletedCount} note${deletedCount === 1 ? "" : "s"} deleted`, badge: "folder", target: "notes" });
    setStatus("Folder Removed");
  }

  function addCalendarEvent(event) {
    event.preventDefault();
    if (!eventDraft.title.trim()) return;
    const nextEvent = normalizeCalendarEvent(
      { ...eventDraft, id: crypto.randomUUID(), source: "user" },
      { jobPostId: plan?.job_post_id || selectedJobId, prepPlanId: plan?.prep_plan_id },
    );
    const nextEvents = [nextEvent, ...calendarEvents];
    setCalendarEvents(nextEvents);
    saveLocalList("interviewprep_calendar_events", nextEvents);
    setEventDraft({ ...eventDraft, title: "", link: "" });
    setStatus("Calendar Event Added");
  }

  function addGeneratedCalendarEvent(title, type, color, day = 1, eventPlan = plan, resource = {}) {
    const date = prepDateForPlanDay(eventPlan, day);
    const nextEvent = normalizeCalendarEvent({
      id: crypto.randomUUID(),
      source: "user",
      title,
      type,
      color,
      date: dateKey(date),
      link: "",
      ...resource,
    }, { jobPostId: eventPlan?.job_post_id, prepPlanId: eventPlan?.prep_plan_id });
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
    setAuthMessageTone("error");
    setAuthOtpSent(false);
    setAuthOtpCode("");
    setAuthPasswordVisible(false);
    setAuthOpen(true);
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage("");
    setAuthMessageTone("error");

    try {
      if ((authMode === "register" || (authMode === "reset" && authOtpSent)) && !isStrongPassword(authForm.password)) {
        throw new Error("Password must have 8+ characters, an uppercase letter, lowercase letter, number, and symbol.");
      }

      if (authMode === "reset") {
        if (!authOtpSent) {
          const response = await apiFetch("/auth/password-reset/otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: authForm.email }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.detail || `API returned ${response.status}`);

          setAuthOtpSent(true);
          setAuthMessageTone("success");
          setAuthMessage(body.dev_otp ? `${body.message} Dev code: ${body.dev_otp}` : body.message);
          return;
        }

        const response = await apiFetch("/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authForm.email,
            otp_code: authOtpCode,
            new_password: authForm.password,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || `API returned ${response.status}`);

        setAuthMode("login");
        setAuthOtpSent(false);
        setAuthOtpCode("");
        setAuthPasswordVisible(false);
        setAuthForm({ name: "", email: authForm.email, password: "" });
        setAuthMessageTone("success");
        setAuthMessage(body.message || "Password updated. You can log in with your new password.");
        return;
      }

      if (authMode === "register" && !authOtpSent) {
        const response = await apiFetch("/auth/register/otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.email }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || `API returned ${response.status}`);

        setAuthOtpSent(true);
        setAuthMessageTone("success");
        setAuthMessage(body.dev_otp ? `${body.message} Dev code: ${body.dev_otp}` : body.message);
        return;
      }

      const endpoint = authMode === "register" ? "register" : "login";
      const payload = authMode === "register"
        ? { ...authForm, otp_code: authOtpCode }
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
      setAuthOtpSent(false);
      setAuthOtpCode("");
      reloadLocalWorkspaceState();
      setStatus(authMode === "register" ? "Account Created" : "Logged In");
    } catch (error) {
      setAuthMessageTone("error");
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

  async function deleteAccount() {
    if (!authToken) {
      setConfirmDeleteAccount(false);
      setStatus("Login Required");
      return;
    }

    setDeletingAccount(true);
    try {
      let response = await apiFetch("/auth/me/delete", { method: "POST" });
      if (response.status === 404 || response.status === 405) {
        response = await apiFetch("/auth/me", { method: "DELETE" });
      }
      if (!response.ok) throw new Error(await readApiError(response, "Delete account"));

      clearLocalWorkspaceStorage();
      setConfirmDeleteAccount(false);
      setSettingsOpen(false);
      logout();
      setStatus("Account Deleted");
    } catch (error) {
      setStatus(error.message || "Could Not Delete Account");
    } finally {
      setDeletingAccount(false);
    }
  }

  const activity = recentActivity.map((item) => ({ ...item, time: relativeTime(item.createdAt), target: item.target || targetForActivity(item.type) }));
  const generationInProgress = loading && [
    "Generating Plan",
    "Generating Exam",
    "Generating Study Notes",
    "Generating Workspace Note",
    "Starting Mock Interview",
  ].includes(status);

  const selectedContextJob = resolveActiveJob(jobs, selectedJobId, plan);

  return (
    <div className={authToken && activeView !== "about" ? `guided-shell theme-${theme}` : "marketing-host"}>
      {authToken && activeView === "about" ? (
        <MarketingLanding
          workspaceMode
          onReturn={() => {
            setActiveView("dashboard");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onStart={() => setActiveView("jobs")}
          onSignIn={() => setActiveView("dashboard")}
        />
      ) : authToken ? (
        <>
          <GuidedTopNavigation
            activeView={activeView}
            generationInProgress={generationInProgress}
            onNavigate={(nextView) => {
              setActiveView(nextView);
              setProfileMenuOpen(false);
              setJobSwitcherOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            user={user}
            status={status}
            isAdmin={isAdmin}
            profileOpen={profileMenuOpen}
            setProfileOpen={setProfileMenuOpen}
            onOpenSettings={() => {
              setSettingsOpen(true);
              setProfileMenuOpen(false);
            }}
            onLogout={logout}
          />

          <main className={`guided-app-main ${activeView === "dashboard" ? "guided-app-main--today" : ""} ${activeView === "jobs" ? "guided-app-main--jobs" : ""}`}>
            {!["jobs", "developer"].includes(activeView) && (
              <GuidedJobContextBar
                selectedJob={selectedContextJob}
                selectedPlan={plan}
                jobs={jobs}
                jobMarkers={jobMarkers}
                open={jobSwitcherOpen}
                setOpen={setJobSwitcherOpen}
                onSelect={useSavedJob}
                onAddJob={openAddJobModal}
              />
            )}

        {activeView === "dashboard" && (
          <GuidedTodayView
            user={user}
            plan={plan}
            selectedJob={selectedContextJob}
            completedTasks={completedTasks}
            readiness={readinessReport}
            streak={streak}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            workspaceReady={workspaceHydrated}
            animateIntro={!todayIntroPlayedRef.current}
            loadingStudyTaskId={loadingStudyTaskId}
            loadingExamTaskId={loadingExamTaskId}
            isStudyNoteGenerated={isStudyNoteGenerated}
            onAddJob={openAddJobModal}
            onOpenJobs={() => setActiveView("jobs")}
            onOpenLearn={() => setActiveView("prep")}
            onOpenNotes={() => setActiveView("notes")}
            onOpenPractice={() => setActiveView("exams")}
            onOpenReadiness={() => setActiveView("progress")}
            onStartTask={startStudyTask}
            onOpenPlanDay={(day) => {
              setSelectedPlanDay(day);
              setActiveView("prep");
            }}
            onIntroComplete={() => {
              todayIntroPlayedRef.current = true;
            }}
          />
        )}

        {activeView === "prep" && <GuidedSectionTabs title="Plan" description="Follow your day-by-day preparation plan for the selected job." tabs={[]} active={activeView} onChange={setActiveView} />}
        {activeView === "exams" && <GuidedSectionTabs title="Practice" description="Create job-specific exams and mock interviews, then review completed attempts." tabs={[]} active={activeView} onChange={setActiveView} />}
        {activeView === "progress" && <GuidedSectionTabs title="Readiness" description="See what matters now and the next best action for the selected job." tabs={[]} active={activeView} onChange={setActiveView} />}

        {activeView === "jobs" && (
          <div data-tour-page="jobs">
          <JobsView
            jobs={jobs}
            activeJobId={selectedJobId}
            onSelectJob={(job) => useSavedJob(job, { navigate: false })}
            onLoadJobDetail={loadSavedJobDetail}
            onLoadJobAnalysis={loadSavedJobAnalysis}
            onAskJobAnalysisQuestion={askSavedJobAnalysisQuestion}
            onUpdateDescription={updateSavedJobDescription}
            onAddJob={openAddJobModal}
            onManageDeleted={() => setSettingsOpen(true)}
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
            plan={plan}
            readiness={readinessReport}
            completedTasks={completedTasks}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            removePrepPlan={removePrepPlan}
            jobMarkers={jobMarkers}
          />
          </div>
        )}

        {activeView === "prep" && (
          <div data-tour-page="prep">
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
          </div>
        )}

        {activeView === "exams" && (
          <div data-tour-page="exams">
          <ExamsView
            plan={plan}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            examSettings={examSettings}
            setExamSettings={setExamSettings}
            selectedPlanDay={selectedPlanDay}
            generateExam={generateExam}
            scheduleMockInterviewAttempt={scheduleMockInterviewAttempt}
            startExamAttempt={startExamAttempt}
            startMockAttempt={startMockAttempt}
            openExamReview={setExamReview}
            openMockReview={setMockReview}
            requestDeleteAttempt={setConfirmDeleteAttempt}
            loading={loading}
          />
          </div>
        )}

        {activeView === "calendar" && (
          <div data-tour-page="calendar">
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
          </div>
        )}

        {activeView === "notes" && (
          <div data-tour-page="notes">
          <NotesView
            plan={plan}
            selectedJob={selectedContextJob}
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
            renameNoteFolder={renameNoteFolder}
            deleteNoteFolder={deleteNoteFolder}
            generateWorkspaceNote={generateWorkspaceNote}
            apiFetch={apiFetch}
            readApiError={readApiError}
            allowLocalFallback={allowLocalFallback}
            loading={loading}
          />
          </div>
        )}

        {activeView === "progress" && (
          <div data-tour-page="progress">
          <ProgressView
            plan={plan}
            completedTasks={completedTasks}
            examAttempts={examAttempts}
            mockAttempts={mockAttempts}
            recentActivity={activity}
            savedPlans={savedPlans}
            jobs={jobs}
            apiFetch={apiFetch}
            readiness={readinessReport}
            onOpenPlan={async (prepPlanId) => {
              await loadPrepPlan(prepPlanId);
              setActiveView("prep");
            }}
          />
          </div>
        )}

        {activeView === "developer" && isAdmin && (
          <div data-tour-page="developer">
          <DeveloperDashboard
            apiFetch={apiFetch}
            currentUser={user}
            onStatus={setStatus}
          />
          </div>
        )}

        {activeView === "developer" && !isAdmin && (
          <PlaceholderView title="Developer Dashboard" />
        )}

        {!["dashboard", "jobs", "prep", "exams", "calendar", "notes", "progress", "about", "developer"].includes(activeView) && (
          <PlaceholderView title={viewTitle(activeView)} />
        )}

        <footer className="guided-footer">© 2026 PrepInterview AI. All rights reserved. <span>Version 0.1.0</span></footer>
      </main>

          {settingsOpen && (
            <>
              <button type="button" className="settings-dismiss-layer" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
              <div className="guided-settings-anchor">
                <SettingsView
                  user={user}
                  theme={theme}
                  setTheme={setTheme}
                  soundVolume={soundVolume}
                  setSoundVolume={setSoundVolume}
                  allowLocalFallback={allowLocalFallback}
                  setAllowLocalFallback={setAllowLocalFallback}
                  deletedJobs={deletedJobs}
                  extensionState={extensionState}
                  restoreDeletedJob={restoreDeletedJob}
                  clearDeletedJob={clearDeletedJob}
                  loading={loading}
                  onToggleExtension={toggleExtensionBubble}
                  onInstallExtension={() => window.open(EXTENSION_GUIDE_URL, "_blank", "noopener,noreferrer")}
                  onRefreshExtension={refreshExtensionState}
                  onDeleteAccount={() => setConfirmDeleteAccount(true)}
                  onClose={() => setSettingsOpen(false)}
                  onReplayOnboarding={replayOnboarding}
                  onKnowMore={() => {
                    setSettingsOpen(false);
                    setActiveView("about");
                  }}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <MarketingLanding
          onStart={() => openAuth("register")}
          onSignIn={() => openAuth("login")}
        />
      )}

      {authOpen && (
        <div className="modal-backdrop auth-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <form className="auth-modal auth-themed-modal" onSubmit={submitAuth}>
            <div className="modal-head">
              <div>
                <div className="auth-brand-lockup"><img src="/prepinterview-logo.png" alt="" aria-hidden="true" /><span>PrepInterview AI</span></div>
                <h2 id="auth-modal-title">{authMode === "register" ? "Create account" : authMode === "reset" ? "Reset password" : "Login"}</h2>
                <p>
                  {authMode === "register"
                    ? "Save your interview prep under your own account."
                    : authMode === "reset"
                      ? "Verify your email, then choose a new password."
                      : "Continue with your saved account."}
                </p>
              </div>
              <button type="button" className="icon-button" aria-label="Close account dialog" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            </div>

            {authMode === "register" && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  placeholder="Your name"
                  disabled={authOtpSent}
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
                disabled={authOtpSent}
                required
              />
            </label>
            {(authMode !== "reset" || authOtpSent) && (
              <label>
                {authMode === "reset" ? "New password" : "Password"}
                <span className="password-input-wrap">
                  <input
                    type={authPasswordVisible ? "text" : "password"}
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                    placeholder="At least 8 characters"
                    minLength={8}
                    maxLength={128}
                    disabled={authMode === "register" && authOtpSent}
                    required
                  />
                  <button
                    type="button"
                    className="password-eye"
                    onClick={() => setAuthPasswordVisible((visible) => !visible)}
                    aria-label={authPasswordVisible ? "Hide password" : "Show password"}
                    title={authPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {authPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            )}
            {(authMode === "register" || (authMode === "reset" && authOtpSent)) && (
              <PasswordCriteria password={authForm.password} />
            )}
            {(authMode === "register" || authMode === "reset") && authOtpSent && (
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={authOtpCode}
                  onChange={(event) => setAuthOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  required
                />
              </label>
            )}
            {authMode === "login" && (
              <button
                type="button"
                className="switch-auth subtle-switch"
                onClick={() => {
                  setAuthMode("reset");
                  setAuthMessage("");
                  setAuthMessageTone("error");
                  setAuthOtpSent(false);
                  setAuthOtpCode("");
                  setAuthForm({ ...authForm, password: "" });
                  setAuthPasswordVisible(false);
                }}
              >
                Forgot password?
              </button>
            )}

            {authMessage && <div className={`auth-message ${authMessageTone}`}>{authMessage}</div>}

            <button className="primary auth-submit" disabled={authLoading}>
              {authLoading
                ? <Loader2 className="spin" size={16} />
                : authMode === "register" && !authOtpSent
                  ? <Bell size={16} />
                  : authMode === "register"
                    ? <UserPlus size={16} />
                    : authMode === "reset" && !authOtpSent
                      ? <Bell size={16} />
                      : authMode === "reset"
                        ? <ShieldCheck size={16} />
                        : <LogIn size={16} />}
              {authMode === "register" && !authOtpSent
                ? "Send Verification Code"
                : authMode === "register"
                  ? "Verify & Create Account"
                  : authMode === "reset" && !authOtpSent
                    ? "Send Reset Code"
                    : authMode === "reset"
                      ? "Set New Password"
                      : "Login"}
            </button>
            {(authMode === "register" || authMode === "reset") && authOtpSent && (
              <button
                type="button"
                className="switch-auth"
                onClick={() => {
                  setAuthOtpSent(false);
                  setAuthOtpCode("");
                  setAuthMessage("");
                  setAuthMessageTone("error");
                }}
              >
                Use a different email or resend code
              </button>
            )}
            <button
              type="button"
              className="switch-auth"
              onClick={() => {
                setAuthMessage("");
                setAuthMessageTone("error");
                setAuthOtpSent(false);
                setAuthOtpCode("");
                setAuthPasswordVisible(false);
                setAuthForm({ ...authForm, password: "" });
                setAuthMode(authMode === "register" ? "login" : authMode === "reset" ? "login" : "register");
              }}
            >
              {authMode === "register" ? "Already have an account? Login" : authMode === "reset" ? "Remembered it? Login" : "New here? Create an account"}
            </button>
          </form>
        </div>
      )}

      {jobModalOpen && (
        <GuidedAddJobModal
          mode={mode}
          setMode={setMode}
          jobTitle={jobTitle}
          setJobTitle={setJobTitle}
          company={company}
          setCompany={setCompany}
          jobDescription={jobDescription}
          setJobDescription={setJobDescription}
          sourceUrl={sourceUrl}
          setSourceUrl={setSourceUrl}
          interviewDate={interviewDate}
          setInterviewDate={setInterviewDate}
          hoursPerDay={hoursPerDay}
          setHoursPerDay={setHoursPerDay}
          loading={loading}
          onClose={() => setJobModalOpen(false)}
          onSave={saveJobOnly}
          onGenerate={generatePlan}
          onExtension={() => window.open(EXTENSION_GUIDE_URL, "_blank", "noopener,noreferrer")}
        />
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

      {confirmDeleteAccount && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal confirm-modal">
            <div className="modal-head">
              <div>
                <h2>Delete account?</h2>
                <p>This permanently removes your account and account-owned jobs, prep plans, exams, and mock interview data. This cannot be undone.</p>
              </div>
              <button type="button" className="icon-button" disabled={deletingAccount} onClick={() => setConfirmDeleteAccount(false)}><X size={18} /></button>
            </div>
            <div className="confirm-actions">
              <button className="outline-action" disabled={deletingAccount} onClick={() => setConfirmDeleteAccount(false)}>Cancel</button>
              <button className="danger-action" disabled={deletingAccount} onClick={deleteAccount}>
                {deletingAccount ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                Delete Account
              </button>
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
              scope: "selected_day",
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
          apiFetch={apiFetch}
          onClose={() => setExamReview(null)}
        />
      )}

      {mockReview && (
        <MockReviewModal
          review={mockReview}
          apiFetch={apiFetch}
          onClose={() => setMockReview(null)}
        />
      )}

      {noteReader && (
        <StudyNoteModal
          reader={noteReader}
          apiFetch={apiFetch}
          readApiError={readApiError}
          allowLocalFallback={allowLocalFallback}
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

      {authToken && onboardingMode && (
        <OnboardingCoachmark
          mode={onboardingMode}
          step={onboardingStep}
          isAdmin={isAdmin}
          onNext={completeOnboardingStep}
          onSkip={skipAllOnboarding}
          onClose={completeOnboardingStep}
        />
      )}
    </div>
  );
}

function OnboardingCoachmark({ mode, step, isAdmin, onNext, onSkip, onClose }) {
  const [targetRect, setTargetRect] = useState(null);
  const isDashboardTour = mode === "dashboard";
  const tabKey = mode.startsWith("tab:") ? mode.replace("tab:", "") : "";
  const steps = isDashboardTour ? DASHBOARD_TOUR_STEPS : [TAB_ONBOARDING[tabKey]].filter(Boolean);
  const currentStep = steps[step] || steps[0];
  const isLast = isDashboardTour ? step >= steps.length - 1 : true;

  useEffect(() => {
    if (!currentStep?.target) return undefined;
    let frame = 0;
    function updateRect() {
      const target = document.querySelector(currentStep.target);
      if (!target) {
        setTargetRect(null);
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      frame = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: Math.max(8, rect.top),
          left: Math.max(8, rect.left),
          width: Math.max(44, rect.width),
          height: Math.max(44, rect.height),
        });
      });
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep?.target]);

  if (!currentStep) return null;

  const viewportWidth = window.innerWidth || 1200;
  const viewportHeight = window.innerHeight || 800;
  const cardWidth = 330;
  const preferredLeft = targetRect ? targetRect.left + targetRect.width + 18 : viewportWidth / 2 - cardWidth / 2;
  const left = Math.min(Math.max(18, preferredLeft), viewportWidth - cardWidth - 18);
  const preferredTop = targetRect ? targetRect.top + Math.min(24, targetRect.height / 2) : viewportHeight / 2 - 120;
  const top = Math.min(Math.max(18, preferredTop), viewportHeight - 260);
  const progressText = isDashboardTour ? `${step + 1} of ${steps.length}` : "First visit";

  return (
    <div className="onboarding-layer" role="dialog" aria-modal="true" aria-label={currentStep.title}>
      <button type="button" className="onboarding-scrim" aria-label="Close onboarding" onClick={onClose} />
      {targetRect && (
        <div
          className="onboarding-highlight"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}
      <article className="onboarding-card" style={{ top, left }}>
        <span className="onboarding-pill">{progressText}</span>
        <h3>{currentStep.title}</h3>
        <p>{currentStep.body}</p>
        {tabKey === "settings" && <small>You can replay this tour any time from Settings.</small>}
        {tabKey === "developer" && isAdmin && <small>This page only appears for admin accounts.</small>}
        <div className="onboarding-actions">
          <button type="button" className="ghost-action" onClick={onSkip}>Skip all</button>
          <button type="button" className="primary compact-primary" onClick={onNext}>
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </article>
    </div>
  );
}

function GuidedTopNavigation({ activeView, generationInProgress, onNavigate, user, status, isAdmin, profileOpen, setProfileOpen, onOpenSettings, onLogout }) {
  const navItems = [
    ["dashboard", "Today", Home, ["dashboard"]],
    ["jobs", "Jobs", BriefcaseBusiness, ["jobs"]],
    ["prep", "Plan", ClipboardList, ["prep"]],
    ["notes", "Notes", NotebookText, ["notes"]],
    ["exams", "Practice", MessageSquareText, ["exams"]],
  ];

  return (
    <header className="guided-top-navigation">
      <button className="guided-brand-lockup" onClick={() => onNavigate("dashboard")} aria-label="PrepInterview AI home">
        <img src="/prepinterview-logo.png" alt="" aria-hidden="true" />
        <span>PrepInterview AI</span>
      </button>

      <nav className="guided-primary-navigation" aria-label="Primary navigation">
        {navItems.map(([id, label, Icon, views]) => (
          <button key={id} data-tour-nav={id} className={views.includes(activeView) ? "active" : ""} onClick={() => onNavigate(id)}>
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="guided-top-tools">
        <span className="guided-current-date"><CalendarDays size={18} />{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
        <div className="guided-profile-wrap">
          <button className="guided-profile-trigger" onClick={() => setProfileOpen((current) => !current)} aria-expanded={profileOpen}>
            <span>{initialsFor(user?.name)}</span>
            <strong>{user?.name?.split(" ")[0] || "User"}</strong>
            <ChevronDown size={15} />
          </button>
          {profileOpen && (
            <div className="guided-profile-menu">
              <div className="guided-profile-status"><StatusIndicator status={status} /><span>{user?.email}</span></div>
              <button onClick={() => onNavigate("progress")}><Target size={18} />Readiness</button>
              <button onClick={() => onNavigate("calendar")}><CalendarDays size={18} />Schedule</button>
              <button data-settings-toggle="true" data-tour="settings-button" onClick={onOpenSettings}><Settings size={18} />Settings</button>
              <button onClick={() => onNavigate("about")}><Info size={18} />About PrepInterview AI</button>
              {isAdmin && <button onClick={() => onNavigate("developer")}><ShieldCheck size={18} />Admin tools <small>Admin</small></button>}
              <div className="guided-menu-separator" />
              <button onClick={onLogout}><LogOut size={18} />Log out</button>
            </div>
          )}
        </div>
      </div>
      {generationInProgress && <span className="guided-generation-progress" role="status" aria-label="Creating your interview preparation content" />}
    </header>
  );
}

function GuidedJobContextBar({ selectedJob, selectedPlan, jobs, jobMarkers, open, setOpen, onSelect, onAddJob }) {
  const identity = normalizeJobIdentityForDisplay(
    selectedPlan?.job_title || selectedJob?.title || "Choose a job",
    selectedJob?.company || selectedPlan?.company || companyFromUrl(selectedJob?.source_url) || "",
  );
  const role = identity.role;
  const company = identity.company;
  const savedInterviewDate = selectedJob?.interview_at ? new Date(selectedJob.interview_at) : null;
  const interviewDay = savedInterviewDate && !Number.isNaN(savedInterviewDate.getTime()) ? new Date(savedInterviewDate) : null;
  const today = new Date();
  interviewDay?.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const daysAway = savedInterviewDate && !Number.isNaN(savedInterviewDate.getTime())
    ? Math.max(0, Math.round((interviewDay.getTime() - today.getTime()) / 86400000))
    : null;
  const interviewLabel = savedInterviewDate && !Number.isNaN(savedInterviewDate.getTime())
    ? `${savedInterviewDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })} · ${daysAway === 0 ? "today" : `${daysAway} days away`}`
    : selectedPlan?.days_until_interview
      ? `${selectedPlan.days_until_interview} days away`
      : "date not set";

  return (
    <section className="guided-job-context-row">
      <div className="guided-job-switcher-wrap">
        <button className="guided-job-switcher" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
          <BriefcaseBusiness size={25} />
          <span className="guided-job-identity">
            <strong className="guided-job-role">{role}</strong>
            {(selectedJob || selectedPlan) && <span className={`guided-job-company ${company ? "" : "missing"}`}>{company || "Company not detected"}</span>}
            <small className="guided-job-interview">{selectedJob || selectedPlan ? `Interview ${interviewLabel}` : "Add a role to start your guided preparation"}</small>
          </span>
          <ChevronDown size={18} />
        </button>
        {open && (
          <div className="guided-job-switcher-menu">
            <header><strong>Switch job</strong><span>Your plan, notes, practice, and progress update together.</span></header>
            {jobs.length ? jobs.map((job) => {
              const jobIdentity = normalizeJobIdentityForDisplay(job.title, job.company || companyFromUrl(job.source_url));
              return (
                <button key={job.id} className={String(selectedJob?.id) === String(job.id) ? "selected" : ""} onClick={() => { onSelect(job); setOpen(false); }}>
                  <i style={{ backgroundColor: colorForJobId(job.id, jobMarkers, jobIdentity.role) }} />
                  <span><strong>{jobIdentity.role}</strong><small>{jobIdentity.company || "Company not detected"}</small></span>
                  {String(selectedJob?.id) === String(job.id) && <Check size={16} />}
                </button>
              );
            }) : <p>No saved jobs yet.</p>}
          </div>
        )}
      </div>
      <button className="guided-secondary-button guided-add-job-button" onClick={onAddJob}><Plus size={19} />Add a job</button>
    </section>
  );
}

function TypedBriefing({ lines, ready, animate, onComplete }) {
  const fullText = lines.join("\n");
  const [typedText, setTypedText] = useState(animate ? "" : fullText);
  const [complete, setComplete] = useState(!animate);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!ready) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reducedMotion) {
      setTypedText(fullText);
      setComplete(true);
      completeRef.current?.();
      return undefined;
    }

    let cursor = 0;
    let timer;
    setTypedText("");
    setComplete(false);
    const typeNext = () => {
      cursor += 1;
      setTypedText(fullText.slice(0, cursor));
      if (cursor >= fullText.length) {
        setComplete(true);
        completeRef.current?.();
        return;
      }
      const previousCharacter = fullText[cursor - 1];
      timer = window.setTimeout(typeNext, previousCharacter === "\n" ? 180 : /[.!?]/.test(previousCharacter) ? 55 : 17);
    };
    timer = window.setTimeout(typeNext, 180);
    return () => window.clearTimeout(timer);
  }, [animate, fullText, ready]);

  const visibleLines = typedText.split("\n");
  return (
    <div className={`daily-typing-copy ${complete ? "complete" : "typing"}`}>
      <h1 aria-label={lines[0]}><span aria-hidden="true">{visibleLines[0] || "\u00a0"}</span></h1>
      <p aria-label={lines[1]}><span aria-hidden="true">{visibleLines[1] || "\u00a0"}</span></p>
      <p className="daily-countdown-line" aria-label={lines[2]}><span aria-hidden="true">{visibleLines[2] || "\u00a0"}</span>{!complete && <i aria-hidden="true" />}</p>
    </div>
  );
}

function AnimatedMomentumMetric({ label, value, suffix = "", ringValue, description, tone = "coral", ready, onClick }) {
  const tooltipId = useId();
  const targetValue = Math.max(0, Number(value) || 0);
  const targetRing = Math.min(100, Math.max(0, Number(ringValue ?? targetValue) || 0));
  const [displayValue, setDisplayValue] = useState(0);
  const [displayRing, setDisplayRing] = useState(0);

  useEffect(() => {
    if (!ready) {
      setDisplayValue(0);
      setDisplayRing(0);
      return undefined;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(targetValue);
      setDisplayRing(targetRing);
      return undefined;
    }

    let animationFrame;
    let startedAt;
    const duration = 950;
    const animateValue = (timestamp) => {
      startedAt ??= timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setDisplayValue(Math.round(targetValue * eased));
      setDisplayRing(targetRing * eased);
      if (progress < 1) animationFrame = window.requestAnimationFrame(animateValue);
    };
    animationFrame = window.requestAnimationFrame(animateValue);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [ready, targetRing, targetValue]);

  const metricContents = (
    <>
      <span className="daily-momentum-ring" aria-hidden="true">
        <CircularProgressbar value={displayRing} text={`${displayValue}${suffix}`} strokeWidth={8} />
      </span>
      <strong>{label}</strong>
    </>
  );

  return (
    <div className={`daily-momentum-metric tone-${tone}`}>
      {onClick ? (
        <button className="daily-momentum-metric-control" onClick={onClick} aria-describedby={tooltipId} aria-label={`${label}: ${targetValue}${suffix}. Open details.`}>
          {metricContents}
        </button>
      ) : (
        <div className="daily-momentum-metric-control" tabIndex={0} aria-describedby={tooltipId} aria-label={`${label}: ${targetValue}${suffix}`}>
          {metricContents}
        </div>
      )}
      <span className="daily-momentum-tooltip" id={tooltipId} role="tooltip"><b>{label}</b>{description}</span>
    </div>
  );
}

function GuidedTodayView({
  user,
  plan,
  selectedJob,
  completedTasks,
  readiness,
  streak,
  examAttempts,
  mockAttempts,
  workspaceReady,
  animateIntro,
  loadingStudyTaskId,
  loadingExamTaskId,
  isStudyNoteGenerated,
  onAddJob,
  onOpenJobs,
  onOpenLearn,
  onOpenNotes,
  onOpenPractice,
  onOpenReadiness,
  onStartTask,
  onOpenPlanDay,
  onIntroComplete,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [localNow, setLocalNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setLocalNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const preparationDays = buildGuidedPreparationDays(selectedJob, plan, localNow);
  const todayDay = preparationDays.find((day) => day.isToday)
    || preparationDays.find((day) => day.isFuture)
    || preparationDays[preparationDays.length - 1];
  const todayTasks = todayDay ? buildDailyStudyTasks(plan, todayDay.day) : [];
  const completedToday = todayTasks.filter((task) => isTaskComplete(task, completedTasks)).length;
  const focusTask = todayTasks.find((task) => !isTaskComplete(task, completedTasks));
  const todayComplete = Boolean(todayDay?.isToday && todayTasks.length && completedToday === todayTasks.length);
  const allPlanTasks = preparationDays.flatMap((day) => buildDailyStudyTasks(plan, day.day));
  const completedPlanTasks = allPlanTasks.filter((task) => isTaskComplete(task, completedTasks)).length;
  const planProgress = allPlanTasks.length ? Math.round((completedPlanTasks / allPlanTasks.length) * 100) : 0;
  const company = selectedJob?.company || plan?.company || companyFromUrl(selectedJob?.source_url) || "";
  const role = plan?.job_title || selectedJob?.title || "your next opportunity";
  const roleAndCompany = company && !role.toLocaleLowerCase().includes(company.toLocaleLowerCase()) ? `${role} at ${company}` : role;
  const firstName = String(user?.name || "there").trim().split(/\s+/)[0] || "there";
  const interviewDate = guidedInterviewDate(selectedJob, plan, preparationDays.length);
  const daysToInterview = calendarDayDistance(localNow, interviewDate);
  const countdownLine = !plan
    ? "Add a role and we’ll organize what matters."
    : daysToInterview === 0
      ? "Your interview is today."
      : daysToInterview === 1
        ? "1 day until your interview."
        : daysToInterview > 1
          ? `${daysToInterview} days until your interview.`
          : "Your saved interview date has passed.";
  const briefingLines = [
    `${localTimeGreeting(localNow)}, ${firstName}`,
    plan ? `You’re preparing for ${roleAndCompany}.` : "Your next interview starts with one saved job.",
    countdownLine,
  ];
  const planId = String(plan?.prep_plan_id || plan?.id || "");
  const relevantAttempts = [...(examAttempts || []), ...(mockAttempts || [])].filter((attempt) => {
    const attemptPlanId = attempt.prepPlanId || attempt.exam?.prep_plan_id || attempt.interview?.prep_plan_id;
    return planId && String(attemptPlanId) === planId;
  });
  const scoredPractice = relevantAttempts.filter((attempt) => attempt.status === "complete" || attempt.score !== undefined).length;
  const readinessScore = readiness?.score ?? 0;
  const interviewToday = Boolean(plan && daysToInterview === 0);
  const interviewPassed = Boolean(plan && daysToInterview < 0);
  const focusTitle = !plan
    ? "Add the job you want"
    : interviewPassed
      ? "Update your interview date"
      : interviewToday
        ? "Review your strongest examples"
        : todayComplete
          ? "Today’s preparation is complete"
          : focusTask?.title || "Open your preparation plan";
  const focusDescription = !plan
    ? "Paste the job description or URL. We’ll identify the priorities and build a focused plan around the role."
    : interviewPassed
      ? "Keep your completed history, then add or select the next role you want to prepare for."
      : interviewToday
        ? "Use the job analysis to refresh the role’s critical requirements, then enter the interview with a clear story."
        : todayComplete
          ? "You’ve finished today’s work. Your completed tasks remain in the timeline below, and tomorrow’s plan is ready when you are."
          : focusTask?.instructions || "Continue the next role-specific activity in your plan.";
  const focusLabel = !plan
    ? "Start here"
    : interviewToday
      ? "Interview day"
      : todayComplete
        ? `${completedToday} of ${todayTasks.length} complete`
        : `${todayDay?.isToday ? "Today" : todayDay?.relativeLabel || "Next"} · ${guidedTaskTypeLabel(focusTask)} · ${guidedTaskDuration(focusTask)} min`;
  const focusAction = () => {
    if (!plan || interviewPassed) onAddJob();
    else if (interviewToday) onOpenJobs();
    else if (todayComplete || !focusTask) onOpenLearn();
    else onStartTask(focusTask);
  };
  const focusActionLabel = !plan
    ? "Add your first job"
    : interviewPassed
      ? "Add another job"
      : interviewToday
        ? "Review job analysis"
        : todayComplete
          ? "Preview the plan"
          : isTaskGenerating(focusTask, loadingStudyTaskId, loadingExamTaskId)
            ? "Preparing..."
            : isStudyNoteGenerated(focusTask)
              ? "Open task"
              : "Start task";

  return (
    <section className="guided-approved-today daily-briefing" data-tour-page="dashboard">
      <article className="daily-briefing-hero daily-briefing-enter">
        <div className="daily-sync-state">
          {workspaceReady ? <CheckCircle2 size={15} /> : <Loader2 className="spin" size={15} />}
          <span>{workspaceReady ? "Workspace refreshed" : "Refreshing your workspace"}</span>
        </div>
        <TypedBriefing lines={briefingLines} ready={workspaceReady} animate={animateIntro} onComplete={onIntroComplete} />
        <div className="daily-hero-meta" aria-label="Current plan summary">
          <span><CalendarDays size={16} />{plan ? interviewDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "No interview scheduled"}</span>
          <span><Target size={16} />{plan ? `${planProgress}% of plan complete` : "One clear plan from job to interview"}</span>
        </div>
      </article>

      <div className="daily-briefing-grid">
        <article className={`daily-focus-card daily-briefing-enter ${todayComplete ? "complete" : ""}`} data-tour="today-next-step">
          <header>
            <div><span>YOUR FOCUS</span><h2>One useful next step</h2></div>
            {plan && focusTask && !todayComplete && !interviewToday && (
              <button onClick={() => setWhyOpen((current) => !current)} aria-expanded={whyOpen}><Info size={16} />Why this?</button>
            )}
          </header>
          <div className="daily-focus-body">
            <span className="daily-focus-icon">{todayComplete ? <Check size={22} /> : interviewToday ? <Target size={22} /> : <Play size={20} />}</span>
            <div>
              <small>{focusLabel}</small>
              <h3>{focusTitle}</h3>
              <p>{focusDescription}</p>
            </div>
          </div>
          {whyOpen && (
            <div className="guided-why-task"><BrainCircuit size={19} /><span><strong>Why this comes next:</strong> It is the first unfinished activity for the current plan day and keeps your preparation tied to the role’s priorities.</span></div>
          )}
          <footer>
            <button className="guided-primary-button" onClick={focusAction} disabled={Boolean(focusTask && isTaskGenerating(focusTask, loadingStudyTaskId, loadingExamTaskId))}>
              {focusTask && isTaskGenerating(focusTask, loadingStudyTaskId, loadingExamTaskId) ? <Loader2 className="spin" size={17} /> : !plan ? <Plus size={18} /> : <Play size={17} fill="currentColor" />}
              {focusActionLabel}
            </button>
            {plan && <button className="guided-secondary-button" onClick={onOpenLearn}><ClipboardList size={17} />View full plan</button>}
          </footer>
        </article>

        <article className="daily-momentum-card daily-briefing-enter" data-tour="today-readiness">
          <header><div><span>MOMENTUM</span><h2>Your preparation at a glance</h2></div><TrendingUp size={21} /></header>
          <div className="daily-momentum-metrics">
            <AnimatedMomentumMetric
              label="Readiness"
              value={readinessScore}
              suffix="%"
              description="Weighted score from completed plan work, exams, and mock interviews."
              ready={workspaceReady}
              onClick={onOpenReadiness}
            />
            <AnimatedMomentumMetric
              label="Plan done"
              value={planProgress}
              suffix="%"
              description="The percentage of scheduled preparation tasks you’ve completed."
              ready={workspaceReady}
              onClick={onOpenLearn}
            />
            <AnimatedMomentumMetric
              label="Day streak"
              value={streak.count}
              ringValue={Math.min(100, (streak.count / 7) * 100)}
              description="Consecutive days with completed preparation activity. The ring tracks a 7-day goal."
              tone="mint"
              ready={workspaceReady}
            />
          </div>
          <p className="daily-momentum-summary">{readinessScore > 0 ? readiness?.label : scoredPractice > 0 ? "Your scored practice is ready to review." : "Complete a scored exam or mock interview to start measuring readiness."}</p>
          <button className="guided-text-button" onClick={onOpenReadiness}>See readiness details <ChevronRight size={16} /></button>
        </article>
      </div>

      {plan && (
        <article className="daily-timeline-card daily-briefing-enter" data-tour="today-week">
          <header>
            <div><span>PREPARATION HISTORY</span><h2>Your full interview timeline</h2><p>Every original plan date stays visible, including completed days that have passed.</p></div>
            <button className="guided-secondary-button" onClick={onOpenLearn}><CalendarDays size={17} />Open schedule</button>
          </header>
          <div className="daily-timeline-track" aria-label="Original preparation timeline">
            {preparationDays.map((day) => {
              const dayTasks = buildDailyStudyTasks(plan, day.day);
              const completeCount = dayTasks.filter((task) => isTaskComplete(task, completedTasks)).length;
              const complete = dayTasks.length > 0 && completeCount === dayTasks.length;
              const phase = complete ? "complete" : day.isToday ? "today" : day.isPast ? "past" : "upcoming";
              const statusLabel = complete ? "Complete" : day.isToday ? "Today" : day.isPast ? "Needs review" : `${completeCount}/${dayTasks.length}`;
              return (
                <button key={day.day} className={`daily-timeline-day ${phase}`} onClick={() => onOpenPlanDay(day.day)} aria-label={`${day.monthDay}, Day ${day.day}: ${statusLabel}`}>
                  <small>{day.shortLabel}</small>
                  <span>{complete ? <Check size={15} /> : day.date.getDate()}</span>
                  <strong>Day {day.day}</strong>
                  <em>{statusLabel}</em>
                </button>
              );
            })}
            <div className={`daily-interview-marker ${interviewPassed ? "past" : interviewToday ? "today" : ""}`}>
              <small>{interviewDate.toLocaleDateString(undefined, { weekday: "short" })}</small>
              <span><Target size={16} /></span>
              <strong>Interview</strong>
              <em>{interviewDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</em>
            </div>
          </div>
        </article>
      )}

      <article className="daily-journey-card daily-briefing-enter">
        <header><div><span>PREP WORKSPACE</span><h2>Everything you need, in one path</h2></div><p>Open a section only when you need it.</p></header>
        <div className="daily-journey-grid">
          <button onClick={plan ? onOpenJobs : onAddJob}><BriefcaseBusiness size={20} /><span><strong>Job analysis</strong><small>{plan ? "See what matters most" : "Add the role first"}</small></span><ChevronRight size={17} /></button>
          <button onClick={plan ? onOpenLearn : onAddJob}><ClipboardList size={20} /><span><strong>Plan</strong><small>{plan ? `${planProgress}% complete` : "Build a daily path"}</small></span><ChevronRight size={17} /></button>
          <button onClick={plan ? onOpenNotes : onAddJob}><NotebookText size={20} /><span><strong>Notes</strong><small>{plan ? "Keep useful answers close" : "Connected to your plan"}</small></span><ChevronRight size={17} /></button>
          <button onClick={plan ? onOpenPractice : onAddJob}><MessageSquareText size={20} /><span><strong>Practice</strong><small>{plan ? `${scoredPractice} scored ${scoredPractice === 1 ? "session" : "sessions"}` : "Exams and mock interviews"}</small></span><ChevronRight size={17} /></button>
        </div>
      </article>
    </section>
  );
}

function buildGuidedPreparationDays(selectedJob, plan, now = new Date()) {
  if (!plan) return [];
  const interviewAt = selectedJob?.interview_at || plan?.interview_at;
  const sourcePlan = interviewAt ? { ...plan, interview_at: interviewAt } : plan;
  const today = startOfLocalDay(now);
  return prepTimelineForPlan(sourcePlan, now).map(({ day, date }) => {
    const anchoredDate = startOfLocalDay(date);
    const difference = Math.round((anchoredDate.getTime() - today.getTime()) / 86_400_000);
    return {
      day,
      date: anchoredDate,
      isToday: difference === 0,
      isPast: difference < 0,
      isFuture: difference > 0,
      relativeLabel: difference === 0 ? "Today" : difference === 1 ? "Tomorrow" : difference === -1 ? "Yesterday" : `Day ${day}`,
      shortLabel: anchoredDate.toLocaleDateString(undefined, { weekday: "short" }),
      monthDay: anchoredDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });
}

function calendarDayDistance(from, to) {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function guidedInterviewDate(selectedJob, plan, totalDays) {
  const savedDate = selectedJob?.interview_at ? new Date(selectedJob.interview_at) : null;
  if (savedDate && !Number.isNaN(savedDate.getTime())) return savedDate;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(1, Number(plan?.days_until_interview) || totalDays || 1));
  return date;
}

function guidedTaskTypeLabel(task) {
  if (task?.task_type === "practice_exam") return "Exam";
  if (task?.task_type === "mock_interview") return "Mock interview";
  if (task?.task_type === "diagnostic") return "Overview";
  return "Notes";
}

function guidedTaskDuration(task) {
  if (task?.duration_minutes) return task.duration_minutes;
  if (task?.task_type === "practice_exam") return 30;
  if (task?.task_type === "mock_interview") return 45;
  return 35;
}

function GuidedSectionTabs({ title, description, tabs, active, onChange }) {
  return (
    <section className="guided-section-head">
      <div><h2>{title}</h2><p>{description}</p></div>
      {tabs.length > 0 && <div className="guided-section-tabs">{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "active" : ""} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</div>}
    </section>
  );
}

function GuidedAddJobModal({ mode, setMode, jobTitle, setJobTitle, company, setCompany, jobDescription, setJobDescription, sourceUrl, setSourceUrl, interviewDate, setInterviewDate, hoursPerDay, setHoursPerDay, loading, onClose, onSave, onGenerate, onExtension }) {
  return (
    <div className="modal-backdrop guided-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guided-add-job-title" onMouseDown={onClose}>
      <form className="guided-job-modal" onSubmit={onGenerate} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h2 id="guided-add-job-title">Add a job</h2><p>Start with the role you want. Every preparation step will stay connected to it.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={20} /></button></header>
        <section className="guided-job-capture-panel" aria-label="Job source">
          <header><div><span>Job source</span><h3>How do you want to add this role?</h3></div><small>Use the source you already have.</small></header>
          <div className="guided-method-tabs guided-job-capture-methods" role="tablist" aria-label="Job source method">
            <button type="button" role="tab" aria-selected={mode === "url"} className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}><Link size={18} /><span><strong>Job URL</strong><small>Paste a listing link</small></span></button>
            <button type="button" role="tab" aria-selected={mode === "paste"} className={mode === "paste" ? "active" : ""} onClick={() => setMode("paste")}><ClipboardList size={18} /><span><strong>Description</strong><small>Paste the full posting</small></span></button>
            <button type="button" role="tab" aria-selected={mode === "extension"} className={mode === "extension" ? "active" : ""} onClick={() => setMode("extension")}><Sparkles size={18} /><span><strong>Browser capture</strong><small>Use the Chrome bubble</small></span></button>
          </div>
        </section>

        {mode === "extension" ? (
          <section className="guided-extension-help"><header><Sparkles size={20} /><div><span>Browser capture</span><h3>Capture a job while you browse</h3></div></header><p>Use the PrepInterview AI bubble on LinkedIn, Handshake, or a company careers page. The captured job will appear in this account.</p><button type="button" className="outline-action" onClick={onExtension}>Install or connect extension <ExternalLink size={15} /></button></section>
        ) : (
          <div className="guided-job-form">
            {mode === "url" ? <label><span className="guided-required-label">Job URL <sup>*</sup></span><input autoFocus value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://company.com/jobs/..." required /></label> : <label><span className="guided-required-label">Job description <sup>*</sup></span><textarea autoFocus value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} maxLength={8000} placeholder="Paste the full job description here..." required /><small>{jobDescription.length} / 8000</small></label>}
            <div className="guided-form-two"><label>Job title <span>Optional · AI can detect</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="e.g. Data Analyst" /></label><label>Company <span>Optional · AI can detect</span><input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="e.g. JPMorgan Chase" /></label></div>
            <div className="guided-form-two"><label><span className="guided-required-label">Interview date <sup>*</sup></span><input type="datetime-local" min={minInterviewDateTime()} value={interviewDate} onChange={(event) => setInterviewDate(normalizeFutureInterviewDate(event.target.value))} required /></label><label><span className="guided-required-label">Hours per day <sup>*</sup></span><input type="number" min="0.5" max="10" step="0.5" value={hoursPerDay} onChange={(event) => setHoursPerDay(event.target.value)} required /></label></div>
          </div>
        )}

        {mode !== "extension" && <footer><button type="button" className="outline-action" disabled={loading} onClick={onSave}><Save size={16} />Save job only</button><button className="primary" disabled={loading}>{loading ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}Generate prep plan</button></footer>}
      </form>
    </div>
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
            const recommended = difficulty === prompt.recommendedDifficulty;
            return (
              <button type="button" key={difficulty} className={recommended ? "recommended" : ""} onClick={() => onChoose(difficulty)}>
                <strong>{difficulty}{recommended ? " · planned" : ""}</strong>
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

function ExamReviewModal({ review, apiFetch, onClose }) {
  const { exam, answers } = review;
  const result = resolveExamReviewResult(review);
  const reviewExam = result?.review_exam || exam;
  const resultByQuestion = Object.fromEntries((result?.results || []).map((item) => [item.question_id, item]));
  return (
    <div className="exam-modal-backdrop review-backdrop" role="dialog" aria-modal="true">
      <div className="review-shell">
        <header className="exam-topbar">
          <div>
            <strong>Exam Review</strong>
            <span>{reviewExam.title} • Score {Math.round((result?.average_score || 0) * 100)}%</span>
          </div>
          <button className="outline-action compact-action" onClick={onClose}>Exit Review</button>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </header>

        <main className="review-stage">
          <ArtifactFeedbackPrompt
            apiFetch={apiFetch}
            artifactType="exam"
            artifactId={reviewExam.id}
            prepPlanId={reviewExam.prep_plan_id}
          />
          {reviewExam.questions.map((question, index) => {
            const questionResult = resultByQuestion[question.id];
            const answerKey = expectedExamReviewAnswer(question);
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
                    <strong>{answerKey.label}</strong>
                    <p>{answerKey.text}</p>
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

function MockReviewModal({ review, apiFetch, onClose }) {
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
          <ArtifactFeedbackPrompt
            apiFetch={apiFetch}
            artifactType="mock_interview"
            artifactId={interview.id}
            prepPlanId={interview.prep_plan_id}
          />
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

function StudyNoteModal({ reader, apiFetch, readApiError, allowLocalFallback, onDone, onClose }) {
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
      if (!response.ok) throw new Error(await readApiError(response, "Note question"));
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
      if (!allowLocalFallback) {
        setAnswers((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            question: submittedQuestion,
            answer: "AI is not responding right now, and local fallback is turned off in settings. Turn on local fallback if you want an offline answer when the API is unavailable.",
            interviewUse: "",
            nextSteps: [],
            source: "AI unavailable",
          },
        ]);
        return;
      }
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
          <ArtifactFeedbackPrompt
            apiFetch={apiFetch}
            artifactType="study_note"
            artifactId={reader.task.id || reader.task.title}
            prepPlanId={reader.task.planId}
          />
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

function ArtifactFeedbackPrompt({ apiFetch, artifactType, artifactId, prepPlanId, jobPostId }) {
  const [rating, setRating] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(nextRating) {
    if (!apiFetch || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact_type: artifactType,
          artifact_id: String(artifactId).slice(0, 180),
          rating: nextRating,
          prep_plan_id: prepPlanId || undefined,
          job_post_id: jobPostId || undefined,
        }),
      });
      if (!response.ok) throw new Error("Feedback could not be saved");
      setRating(nextRating);
      setMessage("Thanks — this will improve future generations.");
    } catch {
      setMessage("Could not save feedback right now.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="artifact-feedback-prompt" aria-label="Generation feedback">
      <div><strong>Was this useful?</strong><span>{message || "A quick signal helps us protect content quality."}</span></div>
      <div>
        <button type="button" className={rating === "helpful" ? "selected" : ""} disabled={saving} onClick={() => submit("helpful")}><ThumbsUp size={14} /> Yes</button>
        <button type="button" className={rating === "needs_work" ? "selected" : ""} disabled={saving} onClick={() => submit("needs_work")}><ThumbsDown size={14} /> Needs work</button>
      </div>
    </section>
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

function JobsView({
  jobs,
  activeJobId,
  onSelectJob,
  onLoadJobDetail,
  onLoadJobAnalysis,
  onAskJobAnalysisQuestion,
  onUpdateDescription,
  onAddJob,
  onManageDeleted,
  menuId,
  onToggleMenu,
  onRequestDelete,
  selectedJobIds,
  setSelectedJobIds,
  onRequestBulkDelete,
  loading,
  savedPlans,
  onOpenPlan,
  plan,
  readiness,
  completedTasks,
  examAttempts,
  mockAttempts,
}) {
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("analysis");
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [jobDetails, setJobDetails] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [rawDescriptionOpen, setRawDescriptionOpen] = useState(false);
  const [rawDescriptionDraft, setRawDescriptionDraft] = useState("");
  const [editingRawDescription, setEditingRawDescription] = useState(false);
  const [savingRawDescription, setSavingRawDescription] = useState(false);
  const [rawDescriptionError, setRawDescriptionError] = useState("");
  const [copiedValue, setCopiedValue] = useState("");
  const [savedAnalyses, setSavedAnalyses] = useState({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisQuestion, setAnalysisQuestion] = useState("");
  const [analysisAnswers, setAnalysisAnswers] = useState([]);
  const [askingAnalysisQuestion, setAskingAnalysisQuestion] = useState(false);

  const filteredJobs = jobs.filter((job) => `${job.title} ${job.company || ""} ${job.description_preview || ""}`.toLowerCase().includes(searchText.trim().toLowerCase()));
  const selectedJob = jobs.find((job) => String(job.id) === String(activeJobId)) || jobs[0] || null;
  const selectedDetail = selectedJob ? jobDetails[String(selectedJob.id)] || selectedJob : null;
  const matchingPlan = selectedJob ? savedPlans.find((savedPlan) => String(savedPlan.job_post_id) === String(selectedJob.id)) : null;
  const selectedPlanIsLoaded = matchingPlan && String(plan?.job_post_id) === String(selectedJob?.id);
  const selectedPlanTasks = selectedPlanIsLoaded
    ? [...new Set((plan.tasks || []).map((task) => task.day))].flatMap((day) => buildDailyStudyTasks(plan, day))
    : [];
  const completedPlanTasks = selectedPlanTasks.filter((task) => isTaskComplete(task, completedTasks)).length;
  const nextTask = selectedPlanTasks.find((task) => !isTaskComplete(task, completedTasks));
  const allPlanTasksComplete = selectedPlanIsLoaded && selectedPlanTasks.length > 0 && completedPlanTasks >= selectedPlanTasks.length;
  const matchingPlanId = matchingPlan?.id;
  const practiceAttempts = [...examAttempts, ...mockAttempts].filter((attempt) => String(attempt.prepPlanId || attempt.prep_plan_id) === String(matchingPlanId));
  const readinessScore = selectedPlanIsLoaded
    ? readiness?.score ?? 0
    : matchingPlan?.task_count
      ? Math.round((completedPlanTasks / Math.max(selectedPlanTasks.length, matchingPlan.task_count)) * 100)
      : 0;
  const descriptionText = selectedDetail?.description || selectedJob?.description_preview || "";
  const isDescriptionSource = Boolean(selectedJob && !selectedJob.source_url);
  const requiredSkills = selectedDetail?.analysis?.required_skills || extractResumeKeywords(descriptionText).slice(0, 6);
  const coreSkills = (selectedDetail?.analysis?.core_skills || []).map((skill) => skill?.name).filter(Boolean);
  const preparationSkills = coreSkills.length ? coreSkills : extractPreparationSkills(descriptionText);
  const interviewFocus = (selectedDetail?.analysis?.interview_focus || []).flatMap((group) => group.topics || []).slice(0, 6);
  const lookingFor = summarizeJobForWorkspace(descriptionText, selectedJob);
  const descriptionSummary = summarizeSavedJobDescription(selectedJob, descriptionText, requiredSkills, interviewFocus);

  useEffect(() => {
    if (jobs.length && !jobs.some((job) => String(job.id) === String(activeJobId))) onSelectJob(jobs[0]);
  }, [jobs, activeJobId]);

  useEffect(() => {
    if (!selectedJob || jobDetails[String(selectedJob.id)]) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    onLoadJobDetail(selectedJob)
      .then((detail) => {
        if (!cancelled) setJobDetails((current) => ({ ...current, [String(selectedJob.id)]: detail }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedJob?.id]);

  useEffect(() => {
    if (!selectedJob) return undefined;
    setAnalysisQuestion("");
    setAnalysisAnswers(loadJobBriefAnswers(selectedJob.id));
    if (activeTab !== "analysis" || savedAnalyses[String(selectedJob.id)]) return undefined;

    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError("");
    onLoadJobAnalysis(selectedJob)
      .then((analysis) => {
        if (!cancelled) setSavedAnalyses((current) => ({ ...current, [String(selectedJob.id)]: analysis }));
      })
      .catch((error) => {
        if (!cancelled) setAnalysisError(error.message || "Could not load the saved job analysis.");
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, selectedJob?.id, savedAnalyses]);

  useEffect(() => {
    if (deleteMode && deleteRequested && selectedJobIds.length === 0) {
      setDeleteMode(false);
      setDeleteRequested(false);
    }
  }, [deleteMode, deleteRequested, selectedJobIds.length]);

  function toggleJobSelection(jobId) {
    setSelectedJobIds((current) => current.some((id) => String(id) === String(jobId))
      ? current.filter((id) => String(id) !== String(jobId))
      : [...current, jobId]);
  }

  function chooseJob(job) {
    if (deleteMode) {
      toggleJobSelection(job.id);
      return;
    }
    onSelectJob(job);
    setActiveTab("analysis");
    setAnalysisError("");
    onToggleMenu(null);
  }

  function cancelDeleteMode() {
    setDeleteMode(false);
    setDeleteRequested(false);
    setSelectedJobIds([]);
  }

  function openRawDescription() {
    setRawDescriptionDraft(descriptionText);
    setRawDescriptionError("");
    setEditingRawDescription(false);
    setRawDescriptionOpen(true);
  }

  function closeRawDescription() {
    if (savingRawDescription) return;
    setRawDescriptionOpen(false);
    setEditingRawDescription(false);
    setRawDescriptionError("");
  }

  async function saveRawDescription() {
    const nextDescription = rawDescriptionDraft.trim();
    if (nextDescription.length < 20) {
      setRawDescriptionError("Enter at least 20 characters for the saved job description.");
      return;
    }
    setSavingRawDescription(true);
    setRawDescriptionError("");
    try {
      const updatedDetail = await onUpdateDescription(selectedJob.id, nextDescription);
      setJobDetails((current) => ({ ...current, [String(selectedJob.id)]: updatedDetail }));
      setRawDescriptionDraft(updatedDetail.description);
      setEditingRawDescription(false);
    } catch (error) {
      setRawDescriptionError(error.message || "Could not save the job description.");
    } finally {
      setSavingRawDescription(false);
    }
  }

  function requestSelectedDelete() {
    if (!selectedJobIds.length) return;
    setDeleteRequested(true);
    onRequestBulkDelete();
  }

  async function copyText(value, key) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedValue(key);
    window.setTimeout(() => setCopiedValue(""), 1800);
  }

  async function submitJobAnalysisQuestion() {
    const question = analysisQuestion.trim();
    if (!selectedJob?.id || !question || askingAnalysisQuestion) return;
    setAskingAnalysisQuestion(true);
    try {
      const answer = await onAskJobAnalysisQuestion(selectedJob.id, question);
      setAnalysisAnswers((current) => {
        const next = [{
          id: crypto.randomUUID?.() || `${Date.now()}`,
          question,
          ...answer,
        }, ...current];
        saveJobBriefAnswers(selectedJob.id, next);
        return next;
      });
      setAnalysisQuestion("");
    } catch (error) {
      setAnalysisAnswers((current) => {
        const next = [{
          id: crypto.randomUUID?.() || `${Date.now()}`,
          question,
          answer: error.message || "Could not answer this question right now.",
          interview_use: "Try again after checking the backend connection.",
          next_steps: [],
          source: "error",
        }, ...current];
        saveJobBriefAnswers(selectedJob.id, next);
        return next;
      });
    } finally {
      setAskingAnalysisQuestion(false);
    }
  }

  return (
    <section className="guided-jobs-page">
      <header className="guided-jobs-heading">
        <div><span className="guided-jobs-title-line"><h1>Jobs</h1><b>{jobs.length}</b></span><p>Select a role to review its plan, source, and interview focus.</p></div>
        <button className="guided-primary-button guided-jobs-add-button" onClick={onAddJob}><Plus size={17} />Add job</button>
      </header>

      <div className="guided-jobs-layout">
        <aside className="guided-job-list-panel">
          <header className="guided-job-list-header"><strong>Saved jobs</strong><span>{filteredJobs.length} shown</span></header>
          <div className="guided-job-search-row">
            <label><Search size={16} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search" /></label>
            {deleteMode ? (
              <div className="guided-delete-mode-actions">
                <button className="cancel" title="Exit delete mode" onClick={cancelDeleteMode}><X size={18} /></button>
                <button className="confirm" title="Delete selected jobs" disabled={!selectedJobIds.length || loading} onClick={requestSelectedDelete}><Check size={18} /></button>
              </div>
            ) : (
              <button className="guided-delete-mode-trigger" title="Select jobs to delete" onClick={() => setDeleteMode(true)}><Trash2 size={17} /></button>
            )}
          </div>
          {deleteMode && <div className="guided-delete-mode-label">Select the jobs to delete <strong>{selectedJobIds.length} selected</strong></div>}
          <div className="guided-job-list">
            {filteredJobs.map((job) => {
              const jobPlan = savedPlans.find((savedPlan) => String(savedPlan.job_post_id) === String(job.id));
              const selected = selectedJobIds.some((id) => String(id) === String(job.id));
              const isCurrent = String(job.id) === String(selectedJob?.id);
              const jobProgress = String(plan?.job_post_id) === String(job.id) ? readiness?.score ?? 0 : 0;
              return (
                <div className={`guided-job-list-row ${isCurrent && !deleteMode ? "selected" : ""} ${selected ? "checked" : ""}`} key={job.id}>
                  {deleteMode && <input type="checkbox" checked={selected} onChange={() => toggleJobSelection(job.id)} aria-label={`Select ${job.title}`} />}
                  <button onClick={() => chooseJob(job)}>
                    <i style={{ backgroundColor: job.color || "#fc5b40" }} />
                    <span><strong>{job.title}</strong><small>{job.company || companyFromUrl(job.source_url) || "Saved job"}</small><em>{jobPlan ? "Plan active" : "Saved"}</em></span>
                    <b>{isCurrent && selectedPlanIsLoaded ? `${jobProgress}%` : jobPlan ? "Plan" : "Saved"}</b>
                  </button>
                </div>
              );
            })}
            {!filteredJobs.length && <div className="guided-job-list-empty">No jobs match your search.</div>}
          </div>
          <button className="guided-manage-deleted" onClick={onManageDeleted}><Trash2 size={16} />Manage deleted jobs</button>
        </aside>

        <section className="guided-job-detail-panel">
          {selectedJob ? (
            <>
              <header className="guided-job-detail-header">
                <div><i style={{ backgroundColor: selectedJob.color || "#fc5b40" }} /><span><h2>{selectedJob.title}</h2><p>{selectedJob.company || companyFromUrl(selectedJob.source_url) || "Saved job"}{selectedJob.interview_at ? ` · ${new Date(selectedJob.interview_at).toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : ""}</p></span></div>
                <div className="job-menu-wrap">
                  <button className="icon-button" aria-label="More job options" onClick={() => onToggleMenu(menuId === selectedJob.id ? null : selectedJob.id)}><MoreVertical size={21} /></button>
                  {menuId === selectedJob.id && <div className="job-action-menu"><button onClick={() => onRequestDelete(selectedJob)}>Delete saved job</button></div>}
                </div>
              </header>
              <div className="guided-job-tabs"><button className={activeTab === "analysis" ? "active" : ""} onClick={() => setActiveTab("analysis")}>Job analysis</button><button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>Overview</button></div>

              {activeTab === "overview" ? (
                <div className="guided-job-overview">
                  <article className={`guided-job-plan-status ${matchingPlan ? "active" : "saved"}`}>
                    {matchingPlan ? <CheckCircle2 size={22} /> : <BriefcaseBusiness size={22} />}
                    <span><strong>{matchingPlan ? "Plan active" : "Job saved"}</strong><small>{matchingPlan ? `${matchingPlan.days_until_interview} days · ${matchingPlan.task_count} tasks${selectedPlanIsLoaded ? ` · ${completedPlanTasks} complete` : ""}` : "Create a plan when you are ready to prepare."}</small></span>
                    <button className="guided-secondary-button" onClick={() => matchingPlan ? onOpenPlan(matchingPlan.id) : onSelectJob(selectedJob)}>{matchingPlan ? "Open plan" : "Create plan"}</button>
                  </article>
                  <div className="guided-job-metrics">
                    <GuidedJobMetric label="Readiness" value={selectedPlanIsLoaded ? `${readinessScore}%` : "—"} detail={selectedPlanIsLoaded ? readinessScore >= 70 ? "On track" : "Keep preparing" : matchingPlan ? "Open plan to view" : "Plan not started"} />
                    <GuidedJobMetric label="Next task" value={allPlanTasksComplete ? "All tasks complete" : nextTask?.title?.replace(/^Read notes:\s*/i, "") || (matchingPlan ? "Open plan" : "Create plan")} detail={allPlanTasksComplete ? "Review or practice again" : nextTask ? `${guidedTaskDuration(nextTask)} minutes` : matchingPlan ? `${matchingPlan.task_count} planned tasks` : "No tasks yet"} />
                    <GuidedJobMetric label="Practice" value={`${practiceAttempts.length} ${practiceAttempts.length === 1 ? "attempt" : "attempts"}`} detail={practiceAttempts.length ? "Exams and mock interviews" : "No attempts yet"} />
                  </div>
                  <article className="guided-job-source-panel">
                    {isDescriptionSource ? (
                      <>
                        <header><h3>Job description</h3><button onClick={openRawDescription}>Read full description</button></header>
                        <p className="description-preview">{descriptionSummary}</p>
                      </>
                    ) : (
                      <>
                        <header><h3>Job URL</h3></header>
                        <a className="guided-job-source-link" href={normalizeUrl(selectedJob.source_url)} target="_blank" rel="noopener noreferrer"><span>{fullJobUrl(selectedJob.source_url)}</span><ExternalLink size={15} /></a>
                      </>
                    )}
                    {preparationSkills.length > 0 && <div className="guided-job-focus"><small>Preparation focus</small><div className="guided-job-tags">{preparationSkills.slice(0, 8).map((skill) => <span key={skill}>{skill}</span>)}</div></div>}
                  </article>
                </div>
              ) : (
                <JobAnalysisTab
                  analysis={savedAnalyses[String(selectedJob.id)]}
                  loading={analysisLoading}
                  error={analysisError}
                  onRetry={() => setSavedAnalyses((current) => {
                    const next = { ...current };
                    delete next[String(selectedJob.id)];
                    return next;
                  })}
                  question={analysisQuestion}
                  setQuestion={setAnalysisQuestion}
                  answers={analysisAnswers}
                  asking={askingAnalysisQuestion}
                  onAsk={submitJobAnalysisQuestion}
                />
              )}
            </>
          ) : <EmptyState text="Add a job to start building your interview workspace." />}
        </section>
      </div>

      {rawDescriptionOpen && selectedJob && (
        <div className="modal-backdrop guided-raw-description-backdrop" role="dialog" aria-modal="true" aria-labelledby="raw-description-title" onMouseDown={closeRawDescription}>
          <section className="guided-raw-description-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><small>Pasted job description</small><h2 id="raw-description-title">{selectedJob.title}</h2></div><button className="icon-button" aria-label="Close job description" onClick={closeRawDescription}><X size={20} /></button></header>
            {editingRawDescription ? (
              <label className="guided-raw-description-editor"><span>Edit saved description</span><textarea value={rawDescriptionDraft} onChange={(event) => setRawDescriptionDraft(event.target.value)} disabled={savingRawDescription} /></label>
            ) : <div className="guided-raw-description-text">{descriptionText || "The full saved description is still loading."}</div>}
            {rawDescriptionError && <p className="guided-raw-description-error" role="alert">{rawDescriptionError}</p>}
            <footer>{editingRawDescription ? <><button className="guided-secondary-button" disabled={savingRawDescription} onClick={() => { setEditingRawDescription(false); setRawDescriptionDraft(descriptionText); setRawDescriptionError(""); }}>Cancel</button><button className="guided-primary-button" disabled={savingRawDescription} onClick={saveRawDescription}>{savingRawDescription ? "Saving..." : "Save changes"}</button></> : <><button className="guided-secondary-button" onClick={closeRawDescription}>Close</button><button className="guided-secondary-button" onClick={() => setEditingRawDescription(true)}>Edit description</button><button className="guided-primary-button" onClick={() => copyText(descriptionText, "description")}><Copy size={17} />{copiedValue === "description" ? "Copied" : "Copy description"}</button></>}</footer>
          </section>
        </div>
      )}
    </section>
  );
}

function GuidedJobMetric({ label, value, detail }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function JobAnalysisTab({ analysis, loading, error, onRetry, question, setQuestion, answers, asking, onAsk }) {
  if (loading && !analysis) {
    return <div className="guided-job-analysis-view guided-job-analysis-loading"><Loader2 className="spin" size={18} />Loading saved job analysis...</div>;
  }

  if (error && !analysis) {
    return (
      <div className="guided-job-analysis-view guided-job-analysis-empty">
        <BrainCircuit size={20} />
        <div><strong>Job analysis is not available yet</strong><p>{error}</p></div>
        <button className="guided-secondary-button" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  if (!analysis) return null;

  const requirements = analysis.requirements || {};
  const interviewTopics = Array.isArray(analysis.interview_topics) ? analysis.interview_topics : [];
  const priorities = Array.isArray(analysis.what_matters_most) ? analysis.what_matters_most : [];
  const responsibilities = Array.isArray(analysis.responsibilities) ? analysis.responsibilities : [];
  const behavioralStories = Array.isArray(analysis.behavioral_story_prompts) ? analysis.behavioral_story_prompts : [];
  const positioningPrompts = Array.isArray(analysis.positioning_prompts) ? analysis.positioning_prompts : [];
  const questionsToAsk = Array.isArray(analysis.questions_to_ask) ? analysis.questions_to_ask : [];
  const unknowns = Array.isArray(analysis.unknowns_to_verify) ? analysis.unknowns_to_verify : [];

  return (
    <div className="guided-job-analysis-view guided-job-analysis-direct">
      <section className="guided-analysis-summary">
        <span>Role summary</span>
        <p>{analysis.role_summary || "Review this posting and connect your strongest examples to the role."}</p>
      </section>

      {priorities.length > 0 && (
        <section className="guided-analysis-priorities">
          <header><div><span>Prepare first</span><h3>What matters most</h3></div><small>Ranked from the job posting</small></header>
          <div className="guided-analysis-priority-list">
            {priorities.map((item, index) => (
              <article key={`${item.title}-${index}`}>
                <b className={`priority-${item.priority || "important"}`}>{priorityLabel(item.priority)}</b>
                <div><strong>{item.title}</strong><p>{item.why_it_matters}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="guided-analysis-columns">
        <section>
          <header><span>Role match</span><h3>Requirements</h3></header>
          <AnalysisRequirementGroup title="Must have" items={requirements.must_have} />
          <AnalysisRequirementGroup title="Nice to have" items={requirements.preferred} />
          <AnalysisRequirementGroup title="Experience or education" items={requirements.experience_and_education} />
          <AnalysisRequirementGroup title="Eligibility mentioned" items={requirements.eligibility_constraints} subtle />
        </section>
        <section>
          <header><span>Day-to-day</span><h3>Responsibilities</h3></header>
          <AnalysisBulletList items={responsibilities} emptyText="No specific responsibilities were identified in the saved posting." />
        </section>
      </div>

      <section className="guided-analysis-topics">
        <header><div><span>Interview preparation</span><h3>Topics to focus on</h3></div><small>Use the highest-priority topics in your plan first.</small></header>
        <div>
          {interviewTopics.map((topic, index) => (
            <article key={`${topic.topic}-${index}`}>
              <b className={`priority-${topic.priority || "important"}`}>{priorityLabel(topic.priority)}</b>
              <span>{topic.category || "other"}</span>
              <div><strong>{topic.topic}</strong><p>{topic.why_it_matters}</p></div>
            </article>
          ))}
          {!interviewTopics.length && <p className="guided-analysis-empty-copy">No interview topics were identified yet.</p>}
        </div>
      </section>

      <div className="guided-analysis-columns guided-analysis-prep-columns">
        <section>
          <header><span>Your examples</span><h3>Stories to prepare</h3></header>
          <AnalysisBulletList items={behavioralStories} emptyText="Prepare concise examples that show the skills and responsibilities above." />
        </section>
        <section>
          <header><span>Your positioning</span><h3>How to connect your experience</h3></header>
          <AnalysisBulletList items={positioningPrompts} emptyText="Connect relevant projects, coursework, and experience to the top priorities above." />
        </section>
      </div>

      {(questionsToAsk.length > 0 || unknowns.length > 0) && (
        <div className="guided-analysis-columns guided-analysis-prep-columns">
          <section>
            <header><span>Interview close</span><h3>Questions worth asking</h3></header>
            <AnalysisBulletList items={questionsToAsk} emptyText="Ask about success measures, collaboration, and the team’s current priorities." />
          </section>
          <section>
            <header><span>Before you rely on it</span><h3>Verify</h3></header>
            <AnalysisBulletList items={unknowns} emptyText="Confirm details that were not clearly stated in the posting." subtle />
          </section>
        </div>
      )}

      <section className="guided-analysis-ask">
        <header><BrainCircuit size={18} /><div><h3>Ask about this job</h3><p>Get a role-specific explanation, example, or interview-ready answer.</p></div></header>
        <form onSubmit={(event) => { event.preventDefault(); onAsk(); }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask anything about this role..." disabled={asking} />
          <button className="guided-primary-button" disabled={!question.trim() || asking}>{asking ? "Asking..." : "Ask"}</button>
        </form>
        {answers.length > 0 && <div className="guided-analysis-answers">{answers.slice(0, 3).map((answer) => <article key={answer.id}><strong>{answer.question}</strong><p>{answer.answer}</p>{answer.interview_use && <small><b>Use in an interview:</b> {answer.interview_use}</small>}</article>)}</div>}
      </section>
    </div>
  );
}

function AnalysisRequirementGroup({ title, items, subtle = false }) {
  if (!Array.isArray(items) || !items.length) return null;
  return <div className={`guided-analysis-requirement-group ${subtle ? "subtle" : ""}`}><strong>{title}</strong><AnalysisBulletList items={items} /></div>;
}

function AnalysisBulletList({ items, emptyText, subtle = false }) {
  if (!Array.isArray(items) || !items.length) return emptyText ? <p className={subtle ? "guided-analysis-empty-copy subtle" : "guided-analysis-empty-copy"}>{emptyText}</p> : null;
  return <ul className={subtle ? "subtle" : ""}>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

function priorityLabel(priority) {
  if (priority === "critical") return "Critical";
  if (priority === "supporting") return "Supporting";
  return "Important";
}

function extractPreparationSkills(description) {
  const text = String(description || "").toLowerCase();
  const skills = [
    ["Power BI", ["power bi", "powerbi", "power query", "dax"]],
    ["Tableau", ["tableau"]],
    ["SQL", ["sql", "postgresql", "postgres", "mysql", "snowflake", "bigquery"]],
    ["Python", ["python", "pandas", "numpy", "fastapi", "django", "flask"]],
    ["Excel", ["excel", "pivot table", "vlookup", "xlookup"]],
    ["Linux", ["linux", "unix", "bash", "shell scripting"]],
    ["JavaScript", ["javascript", "ecmascript"]],
    ["TypeScript", ["typescript"]],
    ["React", ["react", "reactjs", "react.js"]],
    ["Node.js", ["node.js", "nodejs", "node js", "express.js"]],
    ["Git", ["git", "github", "gitlab"]],
    ["Docker", ["docker", "containerization"]],
    ["AWS", ["aws", "amazon web services"]],
  ];
  return skills.filter(([, aliases]) => aliases.some((alias) => text.includes(alias))).map(([name]) => name).slice(0, 8);
}

function summarizeJobForWorkspace(description, job) {
  const clean = String(description || "").replace(/\s+/g, " ").trim();
  if (!clean) return `Review the requirements and responsibilities for ${job?.title || "this role"} before preparing.`;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  return sentences.slice(0, 2).join(" ").trim();
}

function summarizeSavedJobDescription(job, description, skills = [], focus = []) {
  const clean = String(description || "").replace(/\s+/g, " ").trim();
  if (!clean) return `The saved description for ${job?.title || "this role"} is loading.`;
  const role = `${job?.title || "This role"}${job?.company ? ` at ${job.company}` : ""}`;
  const selectedSkills = skills.filter(Boolean).slice(0, 3);
  const selectedFocus = focus.filter(Boolean).slice(0, 2);
  if (!selectedSkills.length && !selectedFocus.length) return summarizeJobForWorkspace(clean, job);
  const skillText = selectedSkills.join(", ");
  const focusText = selectedFocus.join(" and ");
  return `${role} emphasizes ${skillText || "the responsibilities in the saved posting"}.${focusText ? ` The interview is likely to focus on ${focusText}.` : ""}`;
}

function descriptionPreview(description) {
  const clean = String(description || "").replace(/\s+/g, " ").trim();
  return clean.length <= 120 ? clean : `${clean.slice(0, 117).trimEnd()}...`;
}

function PrepPlanView({ plan, selectedPlanDay, setSelectedPlanDay, completedTasks, toggleTaskDone, generateExam, startStudyTask, isStudyNoteGenerated, loading, loadingStudyTaskId, loadingExamTaskId }) {
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraScope, setExtraScope] = useState("selected_day");
  const [extraDifficulty, setExtraDifficulty] = useState("medium");
  const [viewingInterviewDay, setViewingInterviewDay] = useState(false);
  const calendarDays = useMemo(() => buildPlanCalendarDays(plan), [plan]);
  const activeDay = calendarDays.some((item) => item.day === selectedPlanDay) ? selectedPlanDay : calendarDays[0]?.day || 1;
  const selectedCalendarDay = calendarDays.find((item) => item.day === activeDay);
  const selectedTasks = useMemo(() => buildDailyStudyTasks(plan, activeDay), [plan, activeDay]);
  const selectedDone = countCompletedDayTasks(selectedTasks, completedTasks);
  const allTasks = useMemo(() => calendarDays.flatMap((item) => buildDailyStudyTasks(plan, item.day)), [calendarDays, plan]);
  const allDone = countCompletedDayTasks(allTasks, completedTasks);
  const scopeTopics = extraScope === "through_selected_day" ? topicsThroughPlanDay(plan, activeDay) : topicsForStudyDay(plan, activeDay);
  const selectedIsComplete = selectedTasks.length > 0 && selectedDone === selectedTasks.length;

  useEffect(() => {
    setViewingInterviewDay(false);
  }, [plan?.id]);

  const handleExtraExam = () => {
    generateExam(activeDay, {
      scope: extraScope,
      taskKey: `extra-${extraScope}-day-${activeDay}`,
      settingsOverride: settingsForDifficulty(extraDifficulty),
    });
  };

  if (!plan) {
    return (
      <section className="page-stack guided-plan-page">
        <section className="guided-plan-empty panel">
          <ClipboardList size={21} />
          <div><h1>Plan</h1><p>Add a job and generate a prep plan to see your schedule here.</p></div>
        </section>
      </section>
    );
  }

  return (
    <section className="page-stack guided-plan-page">
      <header className="guided-plan-heading">
        <div>
          <span>PREPARATION PLAN</span>
          <h1>{plan.job_title}</h1>
          <p>{calendarDays.length} preparation days · Interview {formatPlanDate(calendarDays.at(-1)?.interviewDate)}</p>
        </div>
        <div className="guided-plan-heading-progress" aria-label="Overall preparation progress">
          <strong>{allDone}/{allTasks.length || 0}</strong>
          <span>tasks complete</span>
        </div>
      </header>

      <section className="guided-plan-calendar panel" aria-label="Preparation dates">
        <div className="guided-plan-calendar-head">
          <span><CalendarDays size={17} /> Select a preparation day</span>
          <small>Interview {formatPlanDate(calendarDays.at(-1)?.interviewDate)}</small>
        </div>
        <div className="guided-plan-date-rail">
          {calendarDays.map((item) => {
            const complete = isPlanDayComplete(plan, item.day, completedTasks);
            return (
              <button
                type="button"
                key={item.day}
                className={`guided-plan-date ${!viewingInterviewDay && item.day === activeDay ? "selected" : ""} ${complete ? "complete" : ""}`}
                aria-pressed={!viewingInterviewDay && item.day === activeDay}
                onClick={() => {
                  setViewingInterviewDay(false);
                  setSelectedPlanDay(item.day);
                }}
              >
                <strong>{item.date.getDate()}</strong>
                <span>{item.isToday ? "Today" : item.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`guided-plan-interview-tile ${viewingInterviewDay ? "selected" : ""}`}
            aria-label={`Open interview day for ${formatPlanDate(calendarDays.at(-1)?.interviewDate)}`}
            aria-pressed={viewingInterviewDay}
            onClick={() => setViewingInterviewDay(true)}
          >
            <Target size={15} />
            <span>Interview</span>
            <strong>{calendarDays.at(-1)?.interviewDate?.getDate()}</strong>
          </button>
        </div>
      </section>

      <div className="guided-plan-layout">
        <section className="guided-plan-day-panel panel">
          {viewingInterviewDay ? (
            <InterviewDayPanel plan={plan} allDone={allDone} allTasks={allTasks} />
          ) : (
            <>
              <div className="guided-plan-day-head">
                <div>
                  <span>{selectedCalendarDay?.isToday ? "TODAY" : `DAY ${activeDay}`}</span>
                  <h2>{selectedCalendarDay?.isToday ? "Today's preparation" : `Preparation for ${formatPlanDate(selectedCalendarDay?.date)}`}</h2>
                </div>
                <em className={selectedIsComplete ? "complete" : ""}>{selectedDone}/{selectedTasks.length} complete</em>
              </div>
              <div className="guided-plan-topic-row" aria-label="Topics for this day">
                {topicsForStudyDay(plan, activeDay).slice(0, 4).map((topic) => <span key={topic}>{topic}</span>)}
              </div>
              <div className="guided-plan-task-list">
                {selectedTasks.map((task, index) => {
                  const complete = isTaskComplete(task, completedTasks);
                  const generating = isTaskGenerating(task, loadingStudyTaskId, loadingExamTaskId);
                  const examTask = task.task_type === "practice_exam";
                  const mockTask = task.task_type === "mock_interview";
                  const action = generating ? "Preparing" : mockTask ? "Start mock" : examTask ? "Choose difficulty" : isStudyNoteGenerated?.(task) ? "Open notes" : "Generate note";
                  return (
                    <article className={`guided-plan-task ${complete ? "complete" : ""}`} key={task.id || task.title}>
                      <button type="button" className="guided-plan-task-check" onClick={() => toggleTaskDone(task)} aria-label={`${complete ? "Mark incomplete" : "Mark complete"}: ${task.title}`}>
                        {complete ? <Check size={15} /> : index + 1}
                      </button>
                      <div className="guided-plan-task-icon">{mockTask ? <MessageSquareText size={17} /> : examTask ? <FileQuestion size={17} /> : <NotebookText size={17} />}</div>
                      <div className="guided-plan-task-copy">
                        <strong>{task.title}</strong>
                        <span>{mockTask ? "Mock interview" : examTask ? "Practice exam" : "Study note"} · {capitalize(task.difficulty || difficultyForPlanDay(plan, activeDay))} · {task.duration_minutes || (mockTask ? 45 : examTask ? 30 : 35)} min</span>
                      </div>
                      <button type="button" className="guided-plan-task-action" onClick={() => startStudyTask(task)} disabled={generating || loading}>
                        {generating ? <Loader2 size={15} className="spin" /> : null}{action}<ChevronRight size={15} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <aside className="guided-plan-side-stack">
          <section className="guided-plan-health panel">
            <div><TrendingUp size={18} /><span>Plan health</span></div>
            <strong>{Math.round((allDone / Math.max(1, allTasks.length)) * 100)}%</strong>
            <p>{calendarDays.length - calendarDays.filter((item) => isPlanDayComplete(plan, item.day, completedTasks)).length} days still to complete</p>
            <div className="guided-plan-progress-track"><span style={{ width: `${Math.round((allDone / Math.max(1, allTasks.length)) * 100)}%` }} /></div>
          </section>

          <section className={`guided-extra-exam panel ${extraOpen ? "open" : ""}`}>
            <button type="button" className="guided-extra-exam-trigger" onClick={() => setExtraOpen((current) => !current)}>
              <span><FileQuestion size={18} /> Extra practice exam</span><ChevronDown size={17} />
            </button>
            {extraOpen && (
              <div className="guided-extra-exam-body">
                <p>Generate an additional exam without changing today’s scheduled practice.</p>
                <div className="guided-extra-scope-grid" role="radiogroup" aria-label="Exam coverage">
                  <button type="button" className={extraScope === "selected_day" ? "selected" : ""} onClick={() => setExtraScope("selected_day")}>
                    <strong>{selectedCalendarDay?.isToday ? "Today only" : `Day ${activeDay} only`}</strong>
                    <span>Only this day’s notes and topics</span>
                  </button>
                  <button type="button" className={extraScope === "through_selected_day" ? "selected" : ""} onClick={() => setExtraScope("through_selected_day")}>
                    <strong>Syllabus through Day {activeDay}</strong>
                    <span>Everything learned so far, never future topics</span>
                  </button>
                </div>
                <div className="guided-extra-topic-list">
                  {scopeTopics.slice(0, 6).map((topic) => <span key={topic}>{topic}</span>)}
                </div>
                <div className="guided-extra-exam-footer">
                  <div className="guided-extra-difficulty" aria-label="Exam difficulty">
                    {["easy", "medium", "hard"].map((difficulty) => <button type="button" key={difficulty} className={extraDifficulty === difficulty ? "selected" : ""} onClick={() => setExtraDifficulty(difficulty)}>{difficulty}</button>)}
                  </div>
                  <button type="button" className="guided-primary-action" onClick={handleExtraExam} disabled={loading || !scopeTopics.length}>
                    {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                    Generate extra exam
                  </button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function InterviewDayPanel({ plan, allDone, allTasks }) {
  const totalTasks = allTasks.length;
  const planComplete = totalTasks > 0 && allDone === totalTasks;
  const interviewSchedule = formatInterviewSchedule(plan);
  const [danceFrame, setDanceFrame] = useState(0);

  useEffect(() => {
    const shouldReduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!planComplete || shouldReduceMotion) {
      setDanceFrame(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDanceFrame((currentFrame) => (currentFrame + 1) % INTERVIEW_DANCE_FRAMES.length);
    }, 120);
    return () => window.clearInterval(intervalId);
  }, [planComplete]);

  return (
    <div className={`guided-interview-day-panel ${planComplete ? "is-complete" : ""}`}>
      {planComplete && (
        <div className="guided-celebration-confetti" aria-hidden="true">
          {INTERVIEW_CELEBRATION_CONFETTI.map(([left, delay, duration, rotation, drift, color], index) => (
            <i
              key={`${left}-${index}`}
              style={{
                "--confetti-left": left,
                "--confetti-delay": delay,
                "--confetti-duration": duration,
                "--confetti-rotation": rotation,
                "--confetti-drift": drift,
                "--confetti-color": color,
              }}
            />
          ))}
        </div>
      )}
      <div className="guided-interview-day-copy">
        <span>INTERVIEW DAY</span>
        <h2>{planComplete ? "You’re ready. Best of luck." : "Your interview day is here."}</h2>
        <p>
          {planComplete
            ? "You completed every planned task and covered the topics in your preparation plan. Go in confident, be clear, and let your work speak for itself."
            : `${allDone} of ${totalTasks} planned tasks are complete. Use the remaining time for the highest-priority items, then go in confident and focused.`}
        </p>
        <div className="guided-interview-schedule">
          <Target size={19} />
          <div>
            <strong>{interviewSchedule}</strong>
            <span>{plan.job_title}{plan.company ? ` · ${plan.company}` : ""}</span>
          </div>
        </div>
      </div>

      <figure className="guided-interview-mascot-stage" aria-label="Smiling PrepInterview AI student celebrating interview day with a briefcase">
        <div className="guided-interview-dance" aria-hidden="true">
          <img src={INTERVIEW_DANCE_FRAMES[danceFrame]} alt="" />
        </div>
        <figcaption>{planComplete ? "You did the work. Now go show it." : "Your plan is almost complete."}</figcaption>
      </figure>
    </div>
  );
}

function ExamsView({ plan, examAttempts, mockAttempts, examSettings, setExamSettings, selectedPlanDay, generateExam, scheduleMockInterviewAttempt, startExamAttempt, startMockAttempt, openExamReview, openMockReview, requestDeleteAttempt, loading }) {
  const [mode, setMode] = useState("exam");
  const [scopeKey, setScopeKey] = useState("today");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mockSettings, setMockSettings] = useState({
    difficulty: "medium",
    questionCount: 6,
    questionTypes: ["technical", "behavioral"],
  });

  const activeDay = Math.max(1, Number(selectedPlanDay) || 1);
  const scopeOptions = useMemo(() => {
    const currentTopics = topicsForStudyDay(plan, activeDay);
    return [
      {
        id: "today",
        label: "Today",
        detail: "Only today's planned material",
        scope: "selected_day",
        scopeLabel: `Day ${activeDay} only`,
        topics: currentTopics,
      },
      {
        id: "covered",
        label: "Covered so far",
        detail: `Everything through Day ${activeDay}`,
        scope: "through_selected_day",
        scopeLabel: `Topics through Day ${activeDay}`,
        topics: topicsThroughPlanDay(plan, activeDay),
      },
      {
        id: "full",
        label: "Full interview prep",
        detail: "All topics in this preparation plan",
        scope: "full_plan",
        scopeLabel: "Full interview prep",
        topics: topicsForWholePlan(plan),
      },
    ];
  }, [plan, activeDay]);
  const selectedScope = scopeOptions.find((option) => option.id === scopeKey) || scopeOptions[0];
  const selectedPlanId = String(plan?.prep_plan_id || "");
  const belongsToSelectedPlan = (attempt) => String(attempt.prepPlanId || attempt.prep_plan_id || "") === selectedPlanId;
  const attempts = [
    ...examAttempts.filter(belongsToSelectedPlan).map((attempt) => ({ ...attempt, kind: "exam" })),
    ...mockAttempts.filter(belongsToSelectedPlan).map((attempt) => ({ ...attempt, kind: "mock" })),
  ];
  const readyAttempts = attempts.filter((attempt) => attempt.status !== "complete");
  const completedAttempts = attempts.filter((attempt) => attempt.status === "complete");

  function chooseExamDifficulty(difficulty) {
    setExamSettings(settingsForDifficulty(difficulty));
  }

  function toggleMockQuestionType(questionType) {
    setMockSettings((current) => ({
      ...current,
      questionTypes: current.questionTypes.includes(questionType)
        ? (current.questionTypes.length === 1 ? current.questionTypes : current.questionTypes.filter((item) => item !== questionType))
        : [...current.questionTypes, questionType],
    }));
  }

  function createPracticeAttempt() {
    if (!plan?.prep_plan_id || loading) return;
    if (mode === "exam") {
      generateExam(activeDay, {
        scope: selectedScope.id === "full" ? "custom_topics" : selectedScope.scope,
        scopeLabel: selectedScope.scopeLabel,
        focusTopics: selectedScope.topics,
        settingsOverride: examSettings,
      });
      return;
    }
    scheduleMockInterviewAttempt({
      day: activeDay,
      scope: selectedScope.scope,
      scopeLabel: selectedScope.scopeLabel,
      focusTopics: selectedScope.topics,
      difficulty: mockSettings.difficulty,
      questionCount: mockSettings.questionCount,
      questionTypes: mockSettings.questionTypes,
    });
  }

  if (!plan?.prep_plan_id) {
    return (
      <section className="page-stack practice-page">
        <section className="panel page-panel practice-empty-state">
          <FileQuestion size={22} />
          <div>
            <h2>Choose a job to practice for</h2>
            <p>Exams and mock interviews stay connected to one selected role.</p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="page-stack practice-page">
      <section className="panel page-panel practice-setup-panel">
        <div className="practice-section-heading">
          <div>
            <span className="eyebrow">CREATE PRACTICE · DAY {activeDay}</span>
            <h3>{mode === "exam" ? "Practice exam" : "Mock interview"}</h3>
            <p>{mode === "exam" ? "Check what you know before the interview." : "Rehearse role-specific answers aloud."} Every attempt stays with the selected job.</p>
          </div>
        </div>

        <div className="practice-mode-switch" role="tablist" aria-label="Practice mode">
          <button type="button" role="tab" aria-selected={mode === "exam"} className={mode === "exam" ? "active" : ""} onClick={() => setMode("exam")}><FileQuestion size={17} />Practice exam</button>
          <button type="button" role="tab" aria-selected={mode === "mock"} className={mode === "mock" ? "active" : ""} onClick={() => setMode("mock")}><MessageSquareText size={17} />Mock interview</button>
        </div>

        <div className="practice-setup-grid">
          <div className="practice-control-group">
            <span className="practice-control-label">What should it cover?</span>
            <div className="practice-scope-options">
              {scopeOptions.map((option) => (
                <button type="button" key={option.id} className={`practice-scope-option ${scopeKey === option.id ? "active" : ""}`} onClick={() => setScopeKey(option.id)}>
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
            <p className="practice-topics-preview">Focus: {selectedScope.topics.length ? selectedScope.topics.slice(0, 4).join(" · ") : "Role-specific topics from your plan"}</p>
          </div>

          <div className="practice-control-group">
            <span className="practice-control-label">Difficulty</span>
            <div className="practice-segmented" role="group" aria-label="Difficulty">
              {["easy", "medium", "hard"].map((difficulty) => {
                const selected = mode === "exam" ? examSettings.difficulty === difficulty : mockSettings.difficulty === difficulty;
                return <button type="button" key={difficulty} className={selected ? "active" : ""} onClick={() => mode === "exam" ? chooseExamDifficulty(difficulty) : setMockSettings((current) => ({ ...current, difficulty }))}>{capitalize(difficulty)}</button>;
              })}
            </div>
            <p className="practice-setting-summary">{mode === "exam" ? `${examSettings.questionCount} questions · ${examSettings.timeLimit} min` : `${mockSettings.questionCount} questions · conversational feedback`}</p>
          </div>
        </div>

        <button type="button" className="practice-advanced-toggle" onClick={() => setShowAdvanced((current) => !current)}>{showAdvanced ? "Hide settings" : "Adjust question settings"}<ChevronDown size={16} className={showAdvanced ? "rotated" : ""} /></button>
        {showAdvanced && (
          <div className="practice-advanced-settings">
            <label>Question count
              <input type="number" min="3" max={mode === "exam" ? 40 : 12} value={mode === "exam" ? examSettings.questionCount : mockSettings.questionCount} onChange={(event) => mode === "exam" ? setExamSettings((current) => ({ ...current, questionCount: Number(event.target.value) || 3 })) : setMockSettings((current) => ({ ...current, questionCount: Math.min(12, Number(event.target.value) || 3) }))} />
            </label>
            {mode === "exam" && <label>Time limit (minutes)
              <input type="number" min="3" max="90" value={examSettings.timeLimit} onChange={(event) => setExamSettings((current) => ({ ...current, timeLimit: Number(event.target.value) || 3 }))} />
            </label>}
            <div className="practice-type-options">
              <span>Question types</span>
              {(mode === "exam" ? ["auto", "multiple_choice", "short_answer", "coding"] : ["technical", "behavioral", "role_specific", "team_problem_solving"]).map((questionType) => {
                const selected = mode === "exam" ? examSettings.questionTypes.includes(questionType) : mockSettings.questionTypes.includes(questionType);
                const label = questionType === "auto" ? "AI selected" : questionType.replaceAll("_", " ");
                return <button type="button" key={questionType} className={selected ? "active" : ""} onClick={() => {
                  if (mode === "exam") setExamSettings((current) => ({ ...current, questionTypes: current.questionTypes.includes(questionType) ? current.questionTypes.filter((item) => item !== questionType) : [...current.questionTypes, questionType] }));
                  else toggleMockQuestionType(questionType);
                }}>{label}</button>;
              })}
            </div>
          </div>
        )}

        <div className="practice-action-row">
          <p>{mode === "exam" ? "Your exam will be generated from the selected scope." : "Your mock will use the same scope and stay with this job."}</p>
          <button type="button" className="primary-action" disabled={loading} onClick={createPracticeAttempt}>{mode === "exam" ? <FileQuestion size={18} /> : <MessageSquareText size={18} />}{loading ? "Preparing…" : mode === "exam" ? "Generate practice exam" : "Create mock interview"}</button>
        </div>
      </section>

      <section className="panel page-panel practice-attempts-panel">
        <div className="practice-section-heading practice-attempts-heading">
          <div>
            <span className="eyebrow">YOUR ATTEMPTS</span>
            <h3>For {plan.job_title}</h3>
            <p>Only exams and mock interviews made for this role appear here.</p>
          </div>
        </div>
        {!attempts.length ? <div className="practice-empty-list">Create a practice exam or mock interview to begin.</div> : <>
          {readyAttempts.length > 0 && <div className="practice-attempt-group"><h4>Ready to start</h4>{readyAttempts.map((attempt) => <PracticeAttemptRow key={`${attempt.kind}-${attempt.id}`} attempt={attempt} onStart={attempt.kind === "exam" ? startExamAttempt : startMockAttempt} onReview={attempt.kind === "exam" ? openExamReview : openMockReview} onDelete={requestDeleteAttempt} loading={loading} />)}</div>}
          {completedAttempts.length > 0 && <div className="practice-attempt-group"><h4>Completed</h4>{completedAttempts.map((attempt) => <PracticeAttemptRow key={`${attempt.kind}-${attempt.id}`} attempt={attempt} onStart={attempt.kind === "exam" ? startExamAttempt : startMockAttempt} onReview={attempt.kind === "exam" ? openExamReview : openMockReview} onDelete={requestDeleteAttempt} loading={loading} />)}</div>}
        </>}
      </section>
    </section>
  );
}

function PracticeAttemptRow({ attempt, onStart, onReview, onDelete, loading }) {
  const Icon = attempt.kind === "exam" ? FileQuestion : MessageSquareText;
  const questionCount = attempt.kind === "exam" ? (attempt.exam?.questions?.length || 0) : (attempt.questionCount || 0);
  const isComplete = attempt.status === "complete";
  const score = attemptScorePercent(attempt);
  const canReview = attempt.kind === "exam" ? Boolean(attempt.review) : Boolean(attempt.interview);
  const title = attempt.kind === "exam" ? (attempt.exam?.title || "Practice exam") : "Mock interview";
  const scopeLabel = attempt.scopeLabel || (attempt.kind === "exam" ? examScopeLabel(attempt.scope, attempt.day) : mockScopeLabel(attempt.scope, attempt.day));
  return (
    <article className={`practice-attempt-row ${isComplete ? "complete" : ""}`}>
      <div className="practice-attempt-icon"><Icon size={18} /></div>
      <div className="practice-attempt-copy">
        <strong>{title}</strong>
        <span>{scopeLabel} · {capitalize(attempt.difficulty || "medium")} · {questionCount} questions</span>
      </div>
      <div className="practice-attempt-meta">
        <span className={`attempt-status ${isComplete ? "complete" : "ready"}`}>{isComplete ? "Completed" : attempt.status === "active" ? "In progress" : "Ready"}</span>
        {isComplete && score !== null && <strong className="attempt-score">Score {score}%</strong>}
      </div>
      {isComplete ? <button type="button" className="outline-action compact-action" disabled={!canReview} onClick={() => onReview(attempt)}><BookOpen size={16} />Review</button> : <button type="button" className="primary-action compact-action" disabled={loading} onClick={() => onStart(attempt)}>{attempt.status === "active" ? "Resume" : "Start"}</button>}
      <button type="button" className="icon-button compact-icon-button" aria-label={`Delete ${title}`} onClick={() => onDelete({ kind: attempt.kind, id: attempt.id })}><Trash2 size={17} /></button>
    </article>
  );
}

function attemptScorePercent(attempt) {
  const rawScore = Number(attempt?.score ?? attempt?.review?.average_score ?? attempt?.interview?.average_score ?? attempt?.interview?.overall_score);
  if (!Number.isFinite(rawScore)) return null;
  return Math.max(0, Math.min(100, Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)));
}

function LegacyExamsView({ plan, savedPlans, planSearch, setPlanSearch, loadPrepPlan, examAttempts, mockAttempts, examSettings, setExamSettings, selectedPlanDay, examResult, generateExam, scheduleMockInterviewAttempt, startExamAttempt, startMockAttempt, openExamReview, openMockReview, requestDeleteAttempt, loading, jobMarkers }) {
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
                  <span>{attempt.jobTitle} • {attempt.scopeLabel || examScopeLabel(attempt.scope, attempt.day)} • {attempt.difficulty} • {attempt.exam.questions.length} questions • {attempt.exam.time_limit_minutes} min</span>
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
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [addingEvent, setAddingEvent] = useState(false);
  const savedPlanEvents = Object.values(calendarPlanDetails).flatMap((detail) =>
    planEventsForCalendar(detail, colorForPlan(detail, jobMarkers))
  );
  const activePlanEvents = planEventsForCalendar(plan, planColor);
  const allEvents = mergeCalendarEvents([...savedPlanEvents, ...activePlanEvents, ...calendarEvents]);
  const monthDays = buildMonthDays(calendarMonth);
  const selectedDateEvents = selectedDate ? allEvents.filter((event) => event.date === selectedDate) : [];
  const today = dateKey(new Date());
  const upcomingEvents = allEvents
    .filter((event) => event.date >= today)
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(0, 6);

  function startAddingEvent(date = selectedDate || today) {
    setEventDraft({ ...eventDraft, date, color: planColor || eventDraft.color });
    setAddingEvent(true);
  }

  return (
    <section className="page-stack simple-schedule-page guided-job-analysis-direct">
      <section className="guided-analysis-summary simple-page-intro">
        <div>
          <span>Schedule</span>
          <h2>Know what is next</h2>
          <p>Interview dates, preparation work, and practice sessions in one simple timeline.</p>
        </div>
        <button type="button" className="guided-primary-button" onClick={() => addingEvent ? setAddingEvent(false) : startAddingEvent()}>
          {addingEvent ? <X size={16} /> : <Plus size={16} />}{addingEvent ? "Close" : "Add event"}
        </button>
      </section>

      {addingEvent && (
        <section className="simple-schedule-composer">
          <header><span>Add to schedule</span><h3>Create an event</h3></header>
          <form onSubmit={addCalendarEvent}>
            <label><span>Title</span><input placeholder="Mock interview or review session" value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} /></label>
            <label><span>Date</span><input type="date" value={eventDraft.date} onChange={(event) => setEventDraft({ ...eventDraft, date: event.target.value })} /></label>
            <label><span>Type</span><select value={eventDraft.type} onChange={(event) => setEventDraft({ ...eventDraft, type: event.target.value })}>
              <option value="preparation">Preparation</option>
              <option value="mock">Mock interview</option>
              <option value="real_interview">Real interview</option>
              <option value="exam">Exam</option>
            </select></label>
            <label className="simple-schedule-link"><span>Meeting link <small>optional</small></span><input placeholder="Meet or Zoom link" value={eventDraft.link} onChange={(event) => setEventDraft({ ...eventDraft, link: event.target.value })} /></label>
            <button className="guided-primary-button" disabled={!eventDraft.title.trim()}><Plus size={16} />Save event</button>
          </form>
        </section>
      )}

      <div className="guided-analysis-columns simple-schedule-overview">
        <section className="simple-upcoming-card">
          <header><span>Next up</span><h3>Upcoming</h3></header>
          <div className="simple-event-list">
            {upcomingEvents.map((event) => (
              <button type="button" key={event.id} onClick={() => setSelectedDate(event.date)}>
                <i style={{ background: event.color }} />
                <span><strong>{event.title}</strong><small>{formatCalendarDate(event.date)} · {labelForCalendarEvent(event.type)}</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
            {!upcomingEvents.length && <p className="guided-analysis-empty-copy">Nothing is scheduled yet. Add only the events that help you prepare.</p>}
          </div>
        </section>

        <section className="simple-day-agenda">
          <header><span>Selected day</span><h3>{formatCalendarDate(selectedDate)}</h3></header>
          <div className="simple-agenda-list">
            {selectedDateEvents.map((event) => (
              <article key={event.id}>
                <i style={{ background: event.color }} />
                <div><strong>{event.title}</strong><span>{labelForCalendarEvent(event.type)}</span></div>
                <div>
                  {event.day && <button type="button" onClick={() => generateExam(event.day, { planOverride: event.planDetail })}>Generate exam</button>}
                  {event.link && <a href={normalizeUrl(event.link)} target="_blank" rel="noreferrer">Open link <ExternalLink size={12} /></a>}
                  {event.source === "user" && <button type="button" className="danger" onClick={() => removeCalendarEvent(event.id)}>Remove</button>}
                </div>
              </article>
            ))}
            {!selectedDateEvents.length && <p className="guided-analysis-empty-copy">No events on this day.</p>}
          </div>
          <button type="button" className="simple-text-action" onClick={() => startAddingEvent(selectedDate)}><Plus size={14} />Add something on this day</button>
        </section>
      </div>

      <section className="simple-calendar-card">
        <header>
          <div><span>Month</span><h3>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3></div>
          <div className="simple-calendar-controls">
            <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} aria-label="Previous month">Prev</button>
            <button type="button" onClick={() => { const current = new Date(); setCalendarMonth(current); setSelectedDate(dateKey(current)); }}>Today</button>
            <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} aria-label="Next month">Next</button>
          </div>
        </header>
        <div className="simple-month-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}
          {monthDays.map((date) => {
            const key = dateKey(date);
            const dateEvents = allEvents.filter((event) => event.date === key);
            const realInterview = dateEvents.find((event) => event.type === "real_interview");
            return (
              <button
                type="button"
                className={`simple-month-day ${date.getMonth() !== calendarMonth.getMonth() ? "muted" : ""} ${dateEvents.length ? "has-events" : ""} ${key === selectedDate ? "selected" : ""} ${key === today ? "today" : ""}`}
                key={key}
                onClick={() => setSelectedDate(key)}
                style={realInterview ? { background: tintColor(realInterview.color, 0.12), borderColor: realInterview.color } : undefined}
                aria-label={`${formatCalendarDate(key)}, ${dateEvents.length} event${dateEvents.length === 1 ? "" : "s"}`}
              >
                <span>{date.getDate()}</span>
                {dateEvents.slice(0, 2).map((event) => (
                  <small key={event.id}><i style={{ background: event.color }} />{event.title}</small>
                ))}
                {dateEvents.length > 2 && <em>+{dateEvents.length - 2} more</em>}
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function NotesView({ plan, selectedJob, savedPlans, notes, noteFolders, noteDraft, setNoteDraft, importNotes, removeNote, createBlankNote, updateNote, improveSavedNote, improvingNoteId, createNoteFolder, renameNoteFolder, deleteNoteFolder, apiFetch, readApiError, allowLocalFallback, loading }) {
  // The dashboard can be opened from a saved job before App has loaded its full
  // active plan. Resolve that plan here so Notes always opens for the selected job.
  const detailedPlans = useSavedPlanDetails(savedPlans || [], plan, apiFetch);
  const activePlan = useMemo(() => {
    const selectedJobId = String(selectedJob?.id || selectedJob?.job_post_id || "");
    const matchingPlan = selectedJobId
      ? detailedPlans.find((item) => String(item.job_post_id || item.job_id || "") === selectedJobId)
      : null;
    return matchingPlan || plan || detailedPlans[0] || null;
  }, [detailedPlans, plan, selectedJob?.id, selectedJob?.job_post_id]);
  const activePlanId = String(activePlan?.prep_plan_id || activePlan?.id || activePlan?.job_id || "");
  const preparationDays = useMemo(() => buildGuidedPreparationDays(selectedJob, activePlan), [activePlan, selectedJob]);
  const todayDay = preparationDays.find((day) => day.isToday) || preparationDays[0];
  const [selectedDate, setSelectedDate] = useState("");
  const [openNoteId, setOpenNoteId] = useState("");
  const [editDraft, setEditDraft] = useState({ title: "", body: "", folder: "", color: "#ff5d42" });
  const [autosaveState, setAutosaveState] = useState("saved");
  const [folderDraftOpen, setFolderDraftOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [noteDraftFolder, setNoteDraftFolder] = useState("");
  const [newNoteName, setNewNoteName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [renamingFolder, setRenamingFolder] = useState("");
  const [folderRenameValue, setFolderRenameValue] = useState("");
  const [renamingNoteId, setRenamingNoteId] = useState("");
  const [noteRenameValue, setNoteRenameValue] = useState("");
  const [draggedNoteId, setDraggedNoteId] = useState("");
  const [dropFolder, setDropFolder] = useState("");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const autosaveTimerRef = useRef(null);
  const lastSavedDraftRef = useRef("");

  useEffect(() => {
    const nextDate = todayDay ? dateKey(todayDay.date) : dateKey(new Date());
    setSelectedDate(nextDate);
    setOpenNoteId("");
    setSelectedFolder("");
    setCollapsedFolders({});
    setFolderDraftOpen(false);
    setNoteDraftFolder("");
    setRenamingFolder("");
    setRenamingNoteId("");
  }, [activePlanId, todayDay?.day]);

  useEffect(() => {
    setNoteDraft((current) => ({ ...current, planId: activePlanId, noteDate: selectedDate, folder: normalizeNoteFolder(current.folder) }));
  }, [activePlanId, selectedDate, setNoteDraft]);

  const visibleNotes = notes.filter((note) => String(note.planId || "") === activePlanId
    && String(note.noteDate || dateKey(new Date())) === selectedDate);
  const grouped = groupNotesByFolder(visibleNotes);
  const scopedFolders = noteFolders
    .filter((folder) => matchesNoteFolder(folder, noteFolderName(folder), activePlanId, selectedDate))
    .map((folder) => normalizeNoteFolder(noteFolderName(folder)))
    .filter((folder) => folder !== GENERATED_NOTES_FOLDER || Boolean(grouped[GENERATED_NOTES_FOLDER]?.length))
    .filter(Boolean);
  const folderNames = [...new Set([...scopedFolders, ...Object.keys(grouped)])]
    .filter(Boolean);
  const openNote = visibleNotes.find((note) => note.id === openNoteId) || null;
  const interviewDate = guidedInterviewDate(selectedJob, activePlan, preparationDays.length || 1);
  const interviewDateKey = dateKey(interviewDate);
  const interviewDay = {
    date: interviewDate,
    monthDay: `Interview · ${interviewDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    shortLabel: "Interview day",
    isInterview: true,
  };
  const selectedDay = preparationDays.find((day) => dateKey(day.date) === selectedDate)
    || (selectedDate === interviewDateKey ? interviewDay : todayDay);

  useEffect(() => {
    if (!openNote) return;
    const existingFolder = normalizeNoteFolder(openNote.folder);
    const nextDraft = {
      title: openNote.title || "",
      body: openNote.body || "",
      folder: existingFolder,
      color: openNote.color || "#ff5d42",
    };
    setEditDraft(nextDraft);
    lastSavedDraftRef.current = JSON.stringify({ ...nextDraft, noteDate: selectedDate, noteId: openNote.id });
    setAutosaveState("saved");
  }, [openNoteId, openNote?.updatedAt]);

  useEffect(() => {
    if (!openNote) return undefined;
    const nextSavedDraft = {
      title: editDraft.title.trim() || "Untitled note",
      body: editDraft.body,
      folder: normalizeNoteFolder(editDraft.folder),
      noteDate: selectedDate,
      color: editDraft.color || "#ff5d42",
    };
    const snapshot = JSON.stringify({ ...nextSavedDraft, noteId: openNote.id });
    if (snapshot === lastSavedDraftRef.current) return undefined;
    setAutosaveState("saving");
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      updateNote(openNote.id, nextSavedDraft, { quiet: true });
      lastSavedDraftRef.current = snapshot;
      setAutosaveState("saved");
    }, 650);
    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [openNote, editDraft, selectedDate, updateNote]);

  function openNoteEditor(note) {
    const folder = normalizeNoteFolder(note.folder);
    setOpenNoteId(note.id);
    setSelectedFolder(folder);
    setCollapsedFolders((current) => ({ ...current, [folder]: false }));
    setNoteDraftFolder("");
    setColorPickerOpen(false);
  }

  function createFolder(event) {
    event.preventDefault();
    if (!folderName.trim()) return;
    const nextFolder = normalizeNoteFolder(folderName);
    if (!createNoteFolder(nextFolder, { planId: activePlanId, noteDate: selectedDate })) return;
    setSelectedFolder(nextFolder);
    setCollapsedFolders((current) => ({ ...current, [nextFolder]: false }));
    setFolderName("");
    setFolderDraftOpen(false);
  }

  function createNamedNote(event) {
    event.preventDefault();
    const title = newNoteName.trim();
    const requestedFolder = String(noteDraftFolder || selectedFolder || "").trim();
    if (!title || !requestedFolder) return;
    const targetFolder = normalizeNoteFolder(requestedFolder);
    const noteId = createBlankNote({ title, folder: targetFolder, planId: activePlanId, noteDate: selectedDate });
    setOpenNoteId(noteId);
    setEditDraft({ title, body: "", folder: targetFolder, color: "#ff5d42" });
    lastSavedDraftRef.current = JSON.stringify({ title, body: "", folder: targetFolder, noteDate: selectedDate, color: "#ff5d42", noteId });
    setAutosaveState("saved");
    setCollapsedFolders((current) => ({ ...current, [targetFolder]: false }));
    setNewNoteName("");
    setNoteDraftFolder("");
  }

  function startNoteCreate(folder) {
    if (!String(folder || "").trim()) return;
    const targetFolder = normalizeNoteFolder(folder);
    if (targetFolder === GENERATED_NOTES_FOLDER) return;
    setSelectedFolder(targetFolder);
    setCollapsedFolders((current) => ({ ...current, [targetFolder]: false }));
    setNoteDraftFolder(targetFolder);
    setFolderDraftOpen(false);
    setNewNoteName("");
  }

  function toggleFolder(folder) {
    setSelectedFolder(folder);
    setRenamingFolder("");
    setCollapsedFolders((current) => ({ ...current, [folder]: !(current[folder] ?? true) }));
  }

  function startFolderRename(folder) {
    if (folder === GENERATED_NOTES_FOLDER) return;
    setSelectedFolder(folder);
    setRenamingFolder(folder);
    setFolderRenameValue(folder);
  }

  function finishFolderRename(folder) {
    const renamedFolder = folderRenameValue.trim();
    setRenamingFolder("");
    if (!renamedFolder || renamedFolder === folder) return;
    if (renameNoteFolder(folder, renamedFolder, { planId: activePlanId, noteDate: selectedDate })) {
      setSelectedFolder(renamedFolder);
      setCollapsedFolders((current) => ({ ...current, [renamedFolder]: current[folder] ?? true }));
    }
  }

  function startNoteRename(note) {
    setOpenNoteId(note.id);
    setRenamingNoteId(note.id);
    setNoteRenameValue(note.title || "Untitled note");
  }

  function finishNoteRename(note) {
    const title = noteRenameValue.trim() || "Untitled note";
    setRenamingNoteId("");
    if (title !== note.title) updateNote(note.id, { title });
  }

  function confirmDeleteNote(note) {
    if (!window.confirm(`Delete note "${note.title}"? This cannot be undone.`)) return;
    removeNote(note.id);
    if (openNoteId === note.id) setOpenNoteId("");
  }

  function confirmDeleteFolder(folder, folderNotes) {
    const count = folderNotes.length;
    if (!window.confirm(`Delete folder "${folder}"? ${count ? `${count} note${count === 1 ? "" : "s"} inside it will also be deleted.` : ""} This cannot be undone.`)) return;
    deleteNoteFolder(folder, { planId: activePlanId, noteDate: selectedDate });
    if (selectedFolder === folder) setSelectedFolder("");
    if (folderNotes.some((note) => note.id === openNoteId)) setOpenNoteId("");
  }

  function moveNoteToFolder(noteId, folder) {
    if (!noteId || !folder || folder === GENERATED_NOTES_FOLDER) return;
    if (notes.find((note) => note.id === noteId)?.generated) return;
    updateNote(noteId, { folder, noteDate: selectedDate });
    setSelectedFolder(folder);
    setCollapsedFolders((current) => ({ ...current, [folder]: false }));
    setDraggedNoteId("");
    setDropFolder("");
  }

  function renderNoteRow(note) {
    if (renamingNoteId === note.id) {
      return (
        <div key={note.id} className="notes-file-rename">
          <FileText size={15} style={{ color: note.color || "var(--approved-coral)" }} />
          <input autoFocus value={noteRenameValue} aria-label="Rename note" onChange={(event) => setNoteRenameValue(event.target.value)} onBlur={() => finishNoteRename(note)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setRenamingNoteId(""); setNoteRenameValue(""); } }} />
        </div>
      );
    }

    return (
      <div key={note.id} className={`notes-file-item ${note.id === openNoteId ? "selected" : ""}`} draggable={!note.generated} onDragStart={(event) => { if (note.generated) return; event.dataTransfer.setData("text/plain", note.id); setDraggedNoteId(note.id); }} onDragEnd={() => { setDraggedNoteId(""); setDropFolder(""); }}>
        <button type="button" onClick={() => openNoteEditor(note)} onDoubleClick={() => startNoteRename(note)} className="notes-file-row" title="Double-click to rename">
          <FileText size={15} style={{ color: note.color || "var(--approved-coral)" }} /><span><strong>{note.title}</strong></span>
        </button>
        <button type="button" className="notes-file-delete" onClick={() => confirmDeleteNote(note)} aria-label={`Delete ${note.title}`} title={`Delete ${note.title}`}><Trash2 size={13} /></button>
      </div>
    );
  }

  async function askAboutNote(event) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!openNote || !submittedQuestion || asking) return;
    setAsking(true);
    setQuestion("");
    const history = openNote.qa || [];
    try {
      const response = await apiFetch("/study-notes/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_title: editDraft.title.trim() || openNote.title,
          role: activePlan?.job_title || selectedJob?.title || "",
          topics: [editDraft.title.trim() || openNote.title],
          summary: editDraft.body,
          sections: [],
          question: submittedQuestion,
          history: history.map((item) => ({ question: item.question, answer: item.answer })),
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response, "Note question"));
      const data = await response.json();
      updateNote(openNote.id, { qa: [...history, { id: crypto.randomUUID(), question: submittedQuestion, answer: data.answer, interviewUse: data.interview_use || "", source: data.source || "AI" }] });
    } catch (error) {
      const answer = allowLocalFallback
        ? "AI is unavailable right now. Keep this question saved and retry when your AI connection is available."
        : "AI is unavailable right now. Turn on local fallback in Settings if you want an offline response when the API is unavailable.";
      updateNote(openNote.id, { qa: [...history, { id: crypto.randomUUID(), question: submittedQuestion, answer, interviewUse: "", source: "AI unavailable" }] });
    } finally {
      setAsking(false);
    }
  }

  if (!activePlan) {
    return (
      <section className="page-stack" data-tour-page="notes">
        <section className="panel page-panel notes-empty-plan">
          <NotebookText size={34} />
          <h1>Notes</h1>
          <p>Select a job with a preparation plan above. Your notes will then be organized by the dates leading to that interview.</p>
        </section>
      </section>
    );
  }

  return (
    <section className="page-stack notes-page-redesign" data-tour-page="notes">
      <section className="notes-heading">
        <div>
          <h1>Notes</h1>
          <p>Keep your ideas, study notes, and interview stories together by preparation day.</p>
        </div>
        <span>{activePlan.job_title || selectedJob?.title || "Selected job"}</span>
      </section>

      <section className="notes-date-panel" aria-label="Preparation dates">
        <div className="notes-date-panel-head">
          <span><CalendarDays size={18} /><strong>Preparation days</strong></span>
          <small>Interview {interviewDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>
        </div>
        <div className="notes-date-scroll">
          {preparationDays.map((day) => {
            const dayKey = dateKey(day.date);
            const count = notes.filter((note) => String(note.planId || "") === activePlanId && String(note.noteDate || dateKey(new Date())) === dayKey).length;
            return (
              <button key={dayKey} type="button" aria-label={`${day.shortLabel}, ${count ? `${count} note${count === 1 ? "" : "s"}` : "no notes"}`} className={`notes-date-button ${dayKey === selectedDate ? "selected" : ""} ${day.isToday ? "today" : ""}`} onClick={() => { setSelectedDate(dayKey); setOpenNoteId(""); setFolderDraftOpen(false); setNoteDraftFolder(""); }}>
                <strong>{day.date.getDate()}</strong>
                <span>{day.isToday ? "Today" : day.shortLabel}</span>
              </button>
            );
          })}
          <button type="button" aria-label={`Interview day, ${interviewDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`} className={`notes-date-button interview-date ${selectedDate === interviewDateKey ? "selected" : ""}`} onClick={() => { setSelectedDate(interviewDateKey); setOpenNoteId(""); setFolderDraftOpen(false); setNoteDraftFolder(""); }}>
            <Target size={13} />
            <span>Interview</span>
            <strong>{interviewDate.getDate()}</strong>
          </button>
        </div>
      </section>

      <section className="notes-date-workspace">
        <aside className="notes-date-rail">
          <header>
            <div>
              <span>{selectedDay?.monthDay || "Preparation day"}</span>
              <strong>Folders</strong>
            </div>
            <div className="notes-rail-actions">
              <button type="button" onClick={() => { setFolderDraftOpen((current) => !current); setNoteDraftFolder(""); }} title="Create folder" aria-label="Create folder"><FolderPlus size={17} /></button>
              <button type="button" disabled={!selectedFolder || selectedFolder === GENERATED_NOTES_FOLDER} onClick={() => startNoteCreate(selectedFolder)} title={selectedFolder === GENERATED_NOTES_FOLDER ? "Generated notes are added from the preparation plan" : selectedFolder ? `Add a file to ${selectedFolder}` : "Select a folder first"} aria-label={selectedFolder === GENERATED_NOTES_FOLDER ? "Generated notes are added from the preparation plan" : selectedFolder ? `Add a file to ${selectedFolder}` : "Select a folder first"}><FilePlus2 size={17} /></button>
            </div>
          </header>
          {folderDraftOpen && (
            <form className="notes-folder-create" onSubmit={createFolder}>
              <Folder size={15} />
              <input autoFocus placeholder="Folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setFolderDraftOpen(false); }} />
              <button type="submit" aria-label="Create folder"><Check size={15} /></button>
            </form>
          )}
          <div className="notes-date-folder-list">
            {folderNames.length ? folderNames.map((folder) => {
              const folderNotes = grouped[folder] || [];
              const generatedFolder = folder === GENERATED_NOTES_FOLDER;
              const isCollapsed = collapsedFolders[folder] ?? !generatedFolder;
              const isDropTarget = dropFolder === folder;
              return (
                <section key={folder} className={`notes-date-folder ${isDropTarget ? "drop-target" : ""}`} onDragOver={(event) => { if (generatedFolder) return; event.preventDefault(); setDropFolder(folder); }} onDragLeave={() => setDropFolder("")} onDrop={(event) => { if (generatedFolder) return; event.preventDefault(); moveNoteToFolder(event.dataTransfer.getData("text/plain") || draggedNoteId, folder); }}>
                  <div className="notes-folder-label">
                    {renamingFolder === folder ? (
                      <label className="notes-folder-rename"><Folder size={16} /><input autoFocus value={folderRenameValue} aria-label="Rename folder" onChange={(event) => setFolderRenameValue(event.target.value)} onBlur={() => finishFolderRename(folder)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setRenamingFolder(""); setFolderRenameValue(""); } }} /></label>
                    ) : (
                      <button type="button" aria-expanded={!isCollapsed} className={`notes-folder-select-button ${selectedFolder === folder ? "selected" : ""}`} onClick={() => toggleFolder(folder)} onDoubleClick={() => startFolderRename(folder)} title={generatedFolder ? "AI-generated notes for this preparation day" : "Click to expand or collapse. Double-click to rename."}><ChevronRight className={isCollapsed ? "" : "expanded"} size={15} /><Folder size={16} />{folder}<small>{folderNotes.length}</small></button>
                    )}
                    <div className="notes-folder-actions">
                      {!generatedFolder && <button type="button" onClick={() => startNoteCreate(folder)} aria-label={`Add a file to ${folder}`} title={`Add a file to ${folder}`}><FilePlus2 size={13} /></button>}
                      <button type="button" onClick={() => confirmDeleteFolder(folder, folderNotes)} aria-label={`Delete ${folder}`} title={`Delete ${folder}`}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {!isCollapsed && <div className="notes-folder-notes">
                    {folderNotes.map(renderNoteRow)}
                    {noteDraftFolder === folder && (
                      <form className="notes-inline-note-create" onSubmit={createNamedNote}>
                        <FileText size={14} />
                        <input autoFocus placeholder="Name this note" value={newNoteName} onChange={(event) => setNewNoteName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setNoteDraftFolder(""); setNewNoteName(""); } }} />
                        <button type="submit" aria-label="Create note"><Check size={14} /></button>
                      </form>
                    )}
                    {!folderNotes.length && noteDraftFolder !== folder && <button type="button" className="notes-folder-empty" onClick={() => startNoteCreate(folder)}><Plus size={13} />Add a note</button>}
                  </div>}
                </section>
              );
            }) : (
              <div className="notes-folder-empty-state"><Folder size={17} /><strong>No folders yet</strong><span>Create a folder, then add notes inside it.</span><button type="button" onClick={() => setFolderDraftOpen(true)}><Plus size={13} />Create folder</button></div>
            )}
          </div>
          <label className="notes-import-control">
            <span><Plus size={16} />Import notes</span>
            <input type="file" accept=".txt,.md,.csv" onChange={importNotes} />
          </label>
        </aside>

        <article className="notes-content-pane">
          {openNote ? (
            <section className="notes-reader">
              <header className="notes-reader-head">
                <div>
                  <span>{selectedDay?.monthDay}</span>
                  <input className="notes-reader-title-input" value={editDraft.title} aria-label="Note title" placeholder="Untitled note" onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="notes-reader-actions">
                  <button type="button" className="outline-action compact-action" disabled={improvingNoteId === openNote.id} onClick={() => improveSavedNote(openNote.id, activePlan?.job_title || selectedJob?.title || "", editDraft)}>{improvingNoteId === openNote.id ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}Improve with AI</button>
                  <button type="button" className="notes-delete-note" onClick={() => confirmDeleteNote(openNote)} aria-label="Delete note" title="Delete note"><Trash2 size={15} /><span>Delete note</span></button>
                </div>
              </header>
              <div className="notes-edit-fields notes-direct-editor">
                <div className="notes-edit-toolbar">
                  <span className="notes-folder-location"><Folder size={15} />{editDraft.folder}</span>
                  <div className="notes-color-picker">
                    <button type="button" className="notes-color-trigger" aria-label="Change note color" aria-expanded={colorPickerOpen} onClick={() => setColorPickerOpen((current) => !current)}><span style={{ backgroundColor: editDraft.color || "#ff5d42" }} /></button>
                    {colorPickerOpen && <div className="notes-color-options" role="menu" aria-label="Note colors">{NOTE_COLOR_OPTIONS.map((color) => <button key={color} type="button" className={color === (editDraft.color || "#ff5d42") ? "selected" : ""} style={{ backgroundColor: color }} aria-label={`Use ${color} note color`} onClick={() => { setEditDraft((current) => ({ ...current, color })); setColorPickerOpen(false); }} />)}</div>}
                  </div>
                </div>
                <textarea value={editDraft.body} onChange={(event) => setEditDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Start writing anything you want to remember for this interview…" />
              </div>
              <section className="notes-ask-ai">
                <div><BrainCircuit size={20} /><span><strong>Ask AI about this note</strong><small>Ask for an explanation, example, or interview-ready answer.</small></span></div>
                {(openNote.qa || []).map((item) => <article key={item.id}><strong>{item.question}</strong><p>{item.answer}</p>{item.interviewUse && <small>{item.interviewUse}</small>}</article>)}
                <form className="notes-ask-form" onSubmit={askAboutNote}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about anything in this note..." /><button type="submit" disabled={!question.trim() || asking}>{asking ? <Loader2 className="spin" size={16} /> : "Ask"}</button></form>
              </section>
            </section>
          ) : (
            <section className="notes-empty-reader">
              <NotebookText size={42} />
              <h2>{visibleNotes.length ? "Choose a note to continue" : "This day is ready for your notes"}</h2>
              <p>{visibleNotes.length ? "Open a note on the left, expand a folder, or add a named note for this preparation day." : folderNames.length ? "Select a folder and create a note inside it." : "Create a folder first, then add notes inside it."}</p>
              <button type="button" className="guided-primary-button" onClick={() => { if (selectedFolder && selectedFolder !== GENERATED_NOTES_FOLDER) startNoteCreate(selectedFolder); else setFolderDraftOpen(true); }}>{selectedFolder && selectedFolder !== GENERATED_NOTES_FOLDER ? <><FilePlus2 size={17} />Create a note</> : <><FolderPlus size={17} />Create a folder</>}</button>
            </section>
          )}
        </article>
      </section>
    </section>
  );
}

function InterviewDataView({
  jobs,
  savedPlans,
  plan,
  completedTasks,
  examAttempts,
  mockAttempts,
  notes,
  generatedStudyNotes,
  calendarEvents,
  recentActivity,
  apiFetch,
  onOpenPlan,
  onOpenExams,
  onOpenNotes,
}) {
  const detailedPlans = useSavedPlanDetails(savedPlans, plan, apiFetch);
  const rows = buildInterviewDataRows({ jobs, savedPlans, detailedPlans, examAttempts, mockAttempts, notes, generatedStudyNotes, calendarEvents });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => rows[0]?.id || "general");
  const [questionFilter, setQuestionFilter] = useState("all");
  const [copied, setCopied] = useState(false);
  const filteredRows = rows.filter((row) => {
    const haystack = `${row.title} ${row.company} ${row.topics.join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  useEffect(() => {
    if (!rows.length) return;
    if (!rows.some((row) => row.id === selectedId)) setSelectedId(rows[0].id);
  }, [rows.map((row) => row.id).join("|"), selectedId]);

  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const bank = buildQuestionBank({ examAttempts, mockAttempts, scope: selected });
  const visibleBank = bank.filter((item) => questionFilter === "all" || item.kind === questionFilter);
  const dataQuality = selected ? buildDataQuality(selected) : [];
  const interviewSignals = selected ? buildInterviewSignals(selected, visibleBank) : [];

  async function copyPacket() {
    if (!selected) return;
    const packet = [
      `PrepInterview AI data packet`,
      `Role: ${selected.title}`,
      `Company: ${selected.company || "Unknown"}`,
      `Plans: ${selected.plans.length}`,
      `Notes: ${selected.noteCount}`,
      `Exams: ${selected.examAttempts.length}`,
      `Mocks: ${selected.mockAttempts.length}`,
      `Topics: ${selected.topics.join(", ") || "Not enough topic data yet"}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="page-stack interview-data-page">
      <section className="panel page-panel data-hero-panel">
        <div>
          <PanelTitle
            icon={Database}
            title="Interview Data"
            subtitle="A role-by-role preparation library built from saved jobs, prep plans, notes, exams, mocks, calendar events, and activity."
            badge={`${rows.length} job profile${rows.length === 1 ? "" : "s"}`}
          />
          <div className="data-search-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, companies, topics, or skills..." />
            <button type="button" className="outline-action compact-action" onClick={copyPacket} disabled={!selected}>
              <Save size={15} /> {copied ? "Copied" : "Copy data packet"}
            </button>
          </div>
        </div>
        <div className="data-hero-stats">
          <DataMetric label="Saved jobs" value={jobs.length} detail="Role sources" />
          <DataMetric label="Prep plans" value={savedPlans.length} detail="Generated plans" />
          <DataMetric label="Questions" value={bank.length} detail="Exam and mock bank" />
          <DataMetric label="Evidence" value={selected ? selected.evidenceCount : 0} detail="Tracked items" />
        </div>
      </section>

      <section className="data-layout">
        <aside className="panel page-panel data-library-panel">
          <div className="data-panel-head">
            <strong>Job intelligence library</strong>
            <span>{filteredRows.length} visible</span>
          </div>
          <div className="data-job-list">
            {filteredRows.map((row) => (
              <button className={row.id === selected?.id ? "selected" : ""} key={row.id} onClick={() => setSelectedId(row.id)}>
                <span className="job-color-dot" style={{ background: row.color }} />
                <div>
                  <strong>{row.title}</strong>
                  <small>{row.company || "Company not detected"} • {row.daysLabel}</small>
                  <em>{row.evidenceCount} data points</em>
                </div>
              </button>
            ))}
            {!filteredRows.length && <EmptyState text="No job data matches that search." />}
          </div>
        </aside>

        <section className="data-detail-stack">
          {selected ? (
            <>
              <section className="panel page-panel data-profile-card">
                <div className="data-profile-title">
                  <span className="job-color-dot large" style={{ background: selected.color }} />
                  <div>
                    <h2>{selected.title}</h2>
                    <p>{selected.company || "Company not detected yet"} • {selected.source}</p>
                  </div>
                </div>
                <div className="data-action-row">
                  <button type="button" className="primary" disabled={!selected.primaryPlanId} onClick={() => onOpenPlan?.(selected.primaryPlanId)}>
                    <ClipboardList size={16} /> Open prep plan
                  </button>
                  <button type="button" className="outline-action compact-action" onClick={onOpenExams}>
                    <FileQuestion size={15} /> Exams
                  </button>
                  <button type="button" className="outline-action compact-action" onClick={onOpenNotes}>
                    <NotebookText size={15} /> Notes
                  </button>
                </div>
                <div className="data-quality-grid">
                  {dataQuality.map((item) => (
                    <article key={item.label} className={item.done ? "done" : ""}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="data-grid-2">
                <article className="panel page-panel">
                  <div className="data-panel-head">
                    <strong>Role signals</strong>
                    <span>What the app knows</span>
                  </div>
                  <div className="data-signal-list">
                    {interviewSignals.map((signal) => (
                      <div key={signal.title}>
                        <strong>{signal.title}</strong>
                        <span>{signal.detail}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel page-panel">
                  <div className="data-panel-head">
                    <strong>Preparation evidence</strong>
                    <span>From real user actions</span>
                  </div>
                  <div className="evidence-grid">
                    <DataMetric label="Plans" value={selected.plans.length} detail="Connected plans" />
                    <DataMetric label="Notes" value={selected.noteCount} detail="Saved and generated" />
                    <DataMetric label="Exams" value={selected.examAttempts.length} detail="Ready or complete" />
                    <DataMetric label="Mocks" value={selected.mockAttempts.length} detail="Ready or complete" />
                  </div>
                </article>
              </section>

              <section className="panel page-panel question-bank-panel">
                <div className="data-panel-head">
                  <div>
                    <strong>Interview question bank</strong>
                    <span>Questions collected from generated exams and mock interviews for this role.</span>
                  </div>
                  <div className="data-filter-tabs">
                    {["all", "exam", "mock"].map((kind) => (
                      <button className={questionFilter === kind ? "selected" : ""} key={kind} onClick={() => setQuestionFilter(kind)}>
                        {kind === "all" ? "All" : kind}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="question-bank-list">
                  {visibleBank.slice(0, 12).map((item) => (
                    <article key={item.id}>
                      <span>{item.kind}</span>
                      <div>
                        <strong>{item.prompt}</strong>
                        <small>{item.context}</small>
                      </div>
                    </article>
                  ))}
                  {!visibleBank.length && <EmptyState text="Generate exams or mock interviews for this job and the questions will appear here." />}
                </div>
              </section>

              <section className="panel page-panel data-timeline-panel">
                <div className="data-panel-head">
                  <strong>Recent evidence trail</strong>
                  <span>Latest prep events connected to this workspace</span>
                </div>
                <div className="progress-timeline compact">
                  {recentActivity.slice(0, 8).map((item, index) => (
                    <article key={`${item.title}-${index}`}>
                      <span className={`activity-icon ${item.type}`}><Activity size={15} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <small>{item.time}</small>
                    </article>
                  ))}
                  {!recentActivity.length && <EmptyState text="Recent activity will appear after jobs, notes, exams, and mocks are created." />}
                </div>
              </section>
            </>
          ) : (
            <section className="panel page-panel">
              <EmptyState text="Save a job or generate a prep plan to build interview data." />
            </section>
          )}
        </section>
      </section>
    </section>
  );
}

function AnalyticsView({
  plan,
  savedPlans,
  jobs,
  completedTasks,
  examAttempts,
  mockAttempts,
  notes,
  generatedStudyNotes,
  calendarEvents,
  recentActivity,
  apiFetch,
  readiness,
  onOpenPlan,
  onOpenProgress,
}) {
  const detailedPlans = useSavedPlanDetails(savedPlans, plan, apiFetch);
  const readinessReports = usePlanReadinessReports(savedPlans, readiness, apiFetch);
  const [selectedPlanId, setSelectedPlanId] = useState("all");
  const selectedPlan = selectedPlanId === "all"
    ? null
    : detailedPlans.find((item) => String(item.prep_plan_id || item.id) === String(selectedPlanId)) || null;
  const scoped = buildAnalyticsScope({ selectedPlan, detailedPlans, completedTasks, examAttempts, mockAttempts, notes, generatedStudyNotes, calendarEvents, recentActivity });
  const scoreTrend = buildScoreTrend(scoped.completeAttempts);
  const topicInsights = buildTopicInsights(scoped.completeExams);
  const reviewQueue = buildReviewQueue(scoped.completeExams, scoped.completeMocks);
  const planComparisons = detailedPlans.map((item) => buildAnalyticsPlanSummary(item, completedTasks, examAttempts, mockAttempts));
  const readinessReport = selectedPlan
    ? readinessReports[String(selectedPlan.prep_plan_id || selectedPlan.id)] || emptyReadinessReport()
    : combineReadinessReports(Object.values(readinessReports));
  const nextInsight = buildAnalyticsInsight({ selectedPlan, scoped, topicInsights, reviewQueue, readinessScore: readinessReport.score });

  return (
    <section className="page-stack analytics-page">
      <section className="panel page-panel analytics-hero-panel">
        <div>
          <PanelTitle
            icon={BarChart3}
            title="Analytics"
            subtitle="A live reporting layer for readiness, scores, study coverage, weak spots, calendar pressure, and job-by-job comparison."
            badge={selectedPlan ? selectedPlan.job_title : "All prep plans"}
          />
          <div className="analytics-controls">
            <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
              <option value="all">Overall performance</option>
              {detailedPlans.map((item) => (
                <option key={item.prep_plan_id || item.id} value={item.prep_plan_id || item.id}>{item.job_title}</option>
              ))}
            </select>
            <button type="button" className="outline-action compact-action" onClick={onOpenProgress}>
              <Activity size={15} /> Open progress center
            </button>
          </div>
        </div>
        <div className="analytics-readiness-card">
          <div className="readiness-ring" style={{ "--score": readinessReport.score }}>
            <strong>{readinessReport.score}%</strong>
            <span>Ready</span>
          </div>
          <div>
            <strong>{readinessLabel(readinessReport.score)}</strong>
            <p>{nextInsight}</p>
          </div>
        </div>
      </section>

      <section className="analytics-kpi-grid">
        <DataMetric label="Jobs saved" value={jobs.length} detail="Total role sources" />
        <DataMetric label="Plans tracked" value={detailedPlans.length} detail="Generated prep plans" />
        <DataMetric label="Avg exam score" value={scoped.averageExamScore ? `${scoped.averageExamScore}%` : "N/A"} detail={`${scoped.completeExams.length} submitted exams`} />
        <DataMetric label="Avg mock score" value={scoped.averageMockScore ? `${scoped.averageMockScore}%` : "N/A"} detail={`${scoped.completeMocks.length} completed mocks`} />
        <DataMetric label="Notes completed" value={`${scoped.completedNotes}/${scoped.noteTasks.length || 0}`} detail="Checked study notes" />
        <DataMetric label="Review queue" value={reviewQueue.length} detail="Answers needing attention" />
      </section>

      <section className="analytics-grid">
        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Score trend</strong>
            <span>Exam and mock submissions over time</span>
          </div>
          <div className="score-trend">
            {scoreTrend.length ? scoreTrend.map((point) => (
              <div key={point.id}>
                <span style={{ height: `${Math.max(8, point.score)}%` }} />
                <small>{point.label}</small>
                <em>{point.score}%</em>
              </div>
            )) : <EmptyState text="Submit exams or mock interviews to see score trends." />}
          </div>
        </article>

        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Readiness formula</strong>
            <span>Weighted preparation signals</span>
          </div>
          <div className="analytics-formula-list">
            {readinessReport.components.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${item.value}%` }} /></div>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Plan comparison</strong>
            <span>Which job is furthest along</span>
          </div>
          <div className="plan-comparison-list">
            {planComparisons.map((summary) => (
              <button key={summary.id} onClick={() => { setSelectedPlanId(summary.id); onOpenPlan?.(summary.id); }}>
                <div>
                  <strong>{summary.title}</strong>
                  <span>{summary.tasksDone}/{summary.tasksTotal} tasks • {summary.attempts} attempts</span>
                </div>
                <div className="progress-mini-bar"><span style={{ width: `${summary.progress}%` }} /></div>
                <em>{summary.progress}%</em>
              </button>
            ))}
            {!planComparisons.length && <EmptyState text="Generate prep plans to compare job readiness." />}
          </div>
        </article>

        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Weak topic radar</strong>
            <span>From scored exam and mock feedback</span>
          </div>
          <div className="analytics-topic-grid">
            <ProgressPillList title="Strengths" items={topicInsights.strengths} empty="High-scoring topics will appear here." />
            <ProgressPillList title="Needs work" tone="warning" items={topicInsights.weaknesses.concat(reviewQueue.map((item) => item.title)).slice(0, 10)} empty="Weak topics will appear after graded attempts." />
          </div>
        </article>

        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Preparation funnel</strong>
            <span>From saved job to review</span>
          </div>
          <div className="analytics-funnel">
            {buildPrepFunnel({ jobs, detailedPlans, scoped, reviewQueue }).map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <div><i style={{ width: `${item.percent}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel analytics-chart-card">
          <div className="data-panel-head">
            <strong>Upcoming pressure</strong>
            <span>Calendar and interview timing</span>
          </div>
          <div className="analytics-event-list">
            {scoped.upcomingEvents.slice(0, 6).map((event) => (
              <article key={event.id || `${event.title}-${event.date}`}>
                <Calendar size={15} />
                <div>
                  <strong>{event.title}</strong>
                  <span>{event.date || event.start || "Scheduled event"}</span>
                </div>
              </article>
            ))}
            {!scoped.upcomingEvents.length && <EmptyState text="Calendar events tied to prep plans will appear here." />}
          </div>
        </article>
      </section>
    </section>
  );
}

function DataMetric({ label, value, detail }) {
  return (
    <article className="data-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

async function readDashboardApiError(response, label = "Request") {
  try {
    const body = await response.clone().json();
    if (body?.detail) return `${label} returned ${response.status}: ${body.detail}`;
  } catch {
    // Continue to text fallback.
  }
  try {
    const text = await response.clone().text();
    if (text) return `${label} returned ${response.status}: ${text}`;
  } catch {
    // Continue to generic fallback.
  }
  return `${label} returned ${response.status}`;
}

function DeveloperDashboard({ apiFetch, currentUser, onStatus }) {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) => (
      item.name?.toLowerCase().includes(query)
      || item.email?.toLowerCase().includes(query)
      || item.status?.toLowerCase().includes(query)
      || adminPresenceLabel(item).toLowerCase().includes(query)
      || item.role?.toLowerCase().includes(query)
    ));
  }, [search, users]);

  const selectedUser = selectedDetail?.user || users.find((item) => item.id === selectedUserId);
  const generationQuality = overview?.generation_quality || {};

  async function fetchUserDetail(userId) {
    if (!userId) return null;
    const response = await apiFetch(`/admin/users/${userId}`);
    if (!response.ok) throw new Error(await readDashboardApiError(response, "User detail"));
    return response.json();
  }

  async function loadAdminData() {
    setLoading(true);
    try {
      const response = await apiFetch("/admin/overview");
      if (!response.ok) throw new Error(await readDashboardApiError(response, "Developer dashboard"));
      const data = await response.json();
      const nextUsers = data.users || [];
      const nextSelectedUserId = nextUsers.some((item) => item.id === selectedUserId)
        ? selectedUserId
        : nextUsers[0]?.id || null;
      setOverview(data);
      setUsers(nextUsers);
      setSelectedUserId(nextSelectedUserId);
      setSelectedDetail(nextSelectedUserId ? await fetchUserDetail(nextSelectedUserId) : null);
      onStatus?.("Developer Dashboard Updated");
    } catch (error) {
      onStatus?.(error.message || "Could Not Load Developer Dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserDetail(userId) {
    if (!userId) {
      setSelectedDetail(null);
      return;
    }
    try {
      setSelectedDetail(await fetchUserDetail(userId));
    } catch (error) {
      onStatus?.(error.message || "Could Not Load User Detail");
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    loadUserDetail(selectedUserId);
  }, [selectedUserId]);

  async function runUserAction(user, action) {
    if (!user) return;
    const isSelf = currentUser?.id === user.id;
    if (isSelf) {
      onStatus?.("Cannot Manage Your Own Admin Account Here");
      return;
    }

    let endpoint = `/admin/users/${user.id}/${action}`;
    let options = { method: "POST" };
    let success = "User Updated";

    if (action === "block") {
      const reason = window.prompt(`Why should ${user.email} be blocked?`, "Blocked by developer review.");
      if (reason === null) return;
      options = {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || "Blocked by developer review." }),
      };
      success = "User Blocked";
    }

    if (action === "unblock") {
      if (!window.confirm(`Unblock ${user.email}?`)) return;
      success = "User Unblocked";
    }

    if (action === "delete") {
      if (!window.confirm(`Delete ${user.email} and all account data? This cannot be undone.`)) return;
      endpoint = `/admin/users/${user.id}`;
      options = { method: "DELETE" };
      success = "User Deleted";
    }

    setActionLoading(`${action}:${user.id}`);
    try {
      const response = await apiFetch(endpoint, options);
      if (!response.ok) throw new Error(await readDashboardApiError(response, success));
      onStatus?.(success);
      await loadAdminData();
      if (action === "delete") {
        setSelectedUserId(null);
        setSelectedDetail(null);
      } else {
        await loadUserDetail(user.id);
      }
    } catch (error) {
      onStatus?.(error.message || `Could Not ${success}`);
    } finally {
      setActionLoading("");
    }
  }

  return (
    <section className="page-stack simple-admin-page guided-job-analysis-direct">
      <section className="simple-page-intro simple-admin-intro">
        <div>
          <span className="guided-analysis-kicker">Admin workspace</span>
          <h2>Developer dashboard</h2>
          <p>Account health, product activity, and the few actions needed to support users.</p>
        </div>
        <button type="button" className="guided-secondary-button" onClick={loadAdminData} disabled={loading}>
          {loading ? <Loader2 className="spin" size={15} /> : <RotateCcw size={15} />}
          Refresh
        </button>
      </section>

      <section className="simple-admin-summary" aria-label="Product health summary">
        <AdminSummary
          label="Accounts"
          value={formatNumber(overview?.total_users ?? 0)}
          detail={`${overview?.active_users ?? 0} active · ${overview?.blocked_users ?? 0} blocked`}
        />
        <AdminSummary
          label="Today"
          value={formatNumber(overview?.logins_today ?? 0)}
          detail={`logins · ${overview?.accounts_created_today ?? 0} new accounts`}
        />
        <AdminSummary
          label="Estimated AI usage"
          value={formatNumber(overview?.total_api_tokens ?? 0)}
          detail={`${formatNumber(overview?.total_events ?? 0)} product actions tracked`}
        />
        <AdminSummary
          label="Generation quality"
          value={`${generationQuality.pass_rate ?? 0}%`}
          detail={`${generationQuality.success_rate ?? 100}% successful · ${generationQuality.evaluated_runs ?? 0} evaluated`}
        />
      </section>

      <section className="simple-admin-quality" aria-label="AI generation quality">
        <header className="simple-admin-section-head">
          <div><span className="guided-analysis-kicker">AI quality</span><h3>Generation health</h3></div>
          <small>{generationQuality.total_runs ?? 0} traced runs</small>
        </header>
        <div className="simple-admin-quality-metrics">
          <div><span>Quality score</span><strong>{generationQuality.average_score ?? 0}%</strong></div>
          <div><span>Average latency</span><strong>{formatDurationMs(generationQuality.average_latency_ms)}</strong></div>
          <div><span>P95 latency</span><strong>{formatDurationMs(generationQuality.p95_latency_ms)}</strong></div>
          <div><span>User feedback</span><strong>{generationQuality.helpful_rate ?? 0}% helpful</strong></div>
        </div>
        {(generationQuality.artifacts || []).length > 0 && (
          <div className="simple-admin-quality-artifacts">
            {generationQuality.artifacts.map((item) => (
              <div key={item.artifact_type}>
                <span><strong>{humanize(item.artifact_type)}</strong><small>{item.runs} runs · {item.failed_runs} failed</small></span>
                <span>{item.pass_rate}% quality pass</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="simple-admin-workspace">
        <article className="simple-admin-directory">
          <header className="simple-admin-section-head">
            <div>
              <span className="guided-analysis-kicker">Users</span>
              <h3>Accounts</h3>
            </div>
            <small>{filteredUsers.length} shown</small>
          </header>
          <label className="simple-admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              aria-label="Search users"
            />
          </label>

          <div className="simple-admin-user-list">
            {filteredUsers.map((item) => {
              const presenceClass = adminPresenceClass(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`simple-admin-user-row ${selectedUserId === item.id ? "selected" : ""}`}
                  onClick={() => setSelectedUserId(item.id)}
                  aria-pressed={selectedUserId === item.id}
                >
                  <span className={`admin-status-dot ${presenceClass}`} />
                  <span className="simple-admin-user-identity">
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                  </span>
                  <span className="simple-admin-user-state">{adminPresenceLabel(item)}</span>
                  {item.role === "admin" && <em>Admin</em>}
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              );
            })}
            {!filteredUsers.length && <EmptyState text="No users match this search." />}
          </div>
        </article>

        <article className="simple-admin-detail">
          {selectedUser ? (
            <>
              <header className="simple-admin-profile-head">
                <div>
                  <span className={`admin-status-dot ${adminPresenceClass(selectedUser)}`} />
                  <div>
                    <h3>{selectedUser.name}</h3>
                    <p>{selectedUser.email}</p>
                    <span>{adminPresenceLabel(selectedUser)} · {selectedUser.role === "admin" ? "Administrator" : "User"}</span>
                  </div>
                </div>
                <details className="simple-admin-actions">
                  <summary>Account actions</summary>
                  <div>
                    {selectedUser.status === "blocked" ? (
                      <button
                        type="button"
                        disabled={actionLoading === `unblock:${selectedUser.id}` || currentUser?.id === selectedUser.id}
                        onClick={() => runUserAction(selectedUser, "unblock")}
                      >
                        <ShieldCheck size={14} /> Unblock account
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading === `block:${selectedUser.id}` || currentUser?.id === selectedUser.id}
                        onClick={() => runUserAction(selectedUser, "block")}
                      >
                        <Ban size={14} /> Block account
                      </button>
                    )}
                    <button
                      type="button"
                      className="danger"
                      disabled={actionLoading === `delete:${selectedUser.id}` || currentUser?.id === selectedUser.id}
                      onClick={() => runUserAction(selectedUser, "delete")}
                    >
                      <Trash2 size={14} /> Delete account
                    </button>
                  </div>
                </details>
              </header>

              {selectedUser.status === "blocked" && (
                <div className="developer-warning">
                  <ShieldAlert size={16} />
                  <span>{selectedUser.block_reason || "This account is blocked."}</span>
                </div>
              )}

              <div className="simple-admin-detail-groups">
                <AdminDetailGroup
                  title="Workspace"
                  rows={[
                    ["Saved jobs", selectedUser.jobs_count ?? 0],
                    ["Prep plans", selectedUser.prep_plans_count ?? 0],
                    ["Practice", `${selectedUser.exams_count ?? 0} exams · ${selectedUser.mock_interviews_count ?? 0} mocks`],
                  ]}
                />
                <AdminDetailGroup
                  title="Usage"
                  rows={[
                    ["Tracked actions", formatNumber(selectedUser.total_events ?? 0)],
                    ["Estimated tokens", formatNumber(selectedUser.total_tokens ?? 0)],
                  ]}
                />
                <AdminDetailGroup
                  title="Account history"
                  rows={[
                    ["Created", formatDateTime(selectedUser.created_at)],
                    ["Last login", formatDateTime(selectedUser.last_login_at)],
                    ["Last seen", formatDateTime(selectedUser.last_seen_at)],
                  ]}
                />
              </div>

              <section className="simple-admin-activity">
                <header className="simple-admin-section-head">
                  <div>
                    <span className="guided-analysis-kicker">Recent</span>
                    <h3>Product activity</h3>
                  </div>
                  <small>{selectedDetail?.recent_events?.length || 0} events</small>
                </header>
                <div className="admin-event-list">
                  {(selectedDetail?.recent_events || []).map((event) => (
                    <article key={event.id} className="admin-event-row">
                      <span>
                        <strong>{humanize(event.feature)}</strong>
                        <small>{humanize(event.event_type)} · {event.provider || "app"}{event.model ? ` · ${event.model}` : ""}</small>
                      </span>
                      <span className="simple-admin-event-meta">
                        <strong>{formatNumber(event.total_tokens)} tokens</strong>
                        <small>{relativeTime(event.created_at)}</small>
                      </span>
                    </article>
                  ))}
                  {!selectedDetail?.recent_events?.length && <EmptyState text="No usage events recorded for this account yet." />}
                </div>
              </section>
            </>
          ) : (
            <EmptyState text="Select a user to inspect their account and usage." />
          )}
        </article>
      </section>
    </section>
  );
}

function AdminSummary({ label, value, detail }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AdminDetailGroup({ title, rows }) {
  return (
    <section>
      <h4>{title}</h4>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatDurationMs(value) {
  const milliseconds = Number(value || 0);
  if (!milliseconds) return "—";
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds >= 10_000 ? 0 : 1)} s`;
}

function UsersIcon(props) {
  return <UserRound {...props} />;
}

function DeveloperMeta({ label, value }) {
  return (
    <div className="developer-meta">
      <span>{label}</span>
      <strong>{value || "Not yet"}</strong>
    </div>
  );
}

const ADMIN_ACTIVE_WINDOW_MS = 10 * 60 * 1000;

function isUserRecentlyActive(user) {
  if (!user || user.status === "blocked" || !user.last_seen_at) return false;
  const lastSeen = new Date(user.last_seen_at).getTime();
  if (Number.isNaN(lastSeen)) return false;
  return Date.now() - lastSeen <= ADMIN_ACTIVE_WINDOW_MS;
}

function adminPresenceClass(user) {
  if (user?.status === "blocked") return "blocked";
  return isUserRecentlyActive(user) ? "active" : "inactive";
}

function adminPresenceLabel(user) {
  if (user?.status === "blocked") return "Blocked";
  return isUserRecentlyActive(user) ? "Active" : "Inactive";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function humanize(value) {
  if (!value) return "Unknown";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function useSavedPlanDetails(savedPlans, activePlan, apiFetch) {
  const [details, setDetails] = useState({});
  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      if (!apiFetch || !savedPlans.length) return;
      const missing = savedPlans.filter((savedPlan) => !details[savedPlan.id] && String(activePlan?.prep_plan_id || "") !== String(savedPlan.id));
      if (!missing.length) return;
      const entries = await Promise.all(missing.map(async (savedPlan) => {
        try {
          const response = await apiFetch(`/prep-plans/${savedPlan.id}`);
          if (!response.ok) return null;
          return [savedPlan.id, await response.json()];
        } catch {
          return null;
        }
      }));
      if (!cancelled) setDetails((current) => ({ ...current, ...Object.fromEntries(entries.filter(Boolean)) }));
    }
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [savedPlans.map((item) => item.id).join("|"), activePlan?.prep_plan_id]);

  return savedPlans.map((savedPlan) => {
    if (activePlan?.prep_plan_id && String(activePlan.prep_plan_id) === String(savedPlan.id)) return { ...activePlan, id: savedPlan.id };
    if (details[savedPlan.id]) return { ...details[savedPlan.id], id: savedPlan.id };
    return {
      id: savedPlan.id,
      prep_plan_id: savedPlan.id,
      job_title: savedPlan.job_title,
      job_post_id: savedPlan.job_post_id,
      days_until_interview: savedPlan.days_until_interview,
      task_count: savedPlan.task_count,
      tasks: [],
      summaryOnly: true,
    };
  });
}

function usePlanReadinessReports(savedPlans, activeReadiness, apiFetch) {
  const active = normalizeReadinessReport(activeReadiness);
  const [reports, setReports] = useState(() => active?.prep_plan_id ? { [String(active.prep_plan_id)]: active } : {});

  useEffect(() => {
    let cancelled = false;
    async function fetchReports() {
      if (!apiFetch || !savedPlans.length) {
        if (!cancelled) setReports(active?.prep_plan_id ? { [String(active.prep_plan_id)]: active } : {});
        return;
      }
      const entries = await Promise.all(savedPlans.map(async (savedPlan) => {
        if (active?.prep_plan_id && String(active.prep_plan_id) === String(savedPlan.id)) {
          return [String(savedPlan.id), active];
        }
        try {
          const response = await apiFetch(`/workspace/readiness?prep_plan_id=${savedPlan.id}`);
          if (!response.ok) return null;
          return [String(savedPlan.id), normalizeReadinessReport(await response.json())];
        } catch {
          return null;
        }
      }));
      if (!cancelled) setReports(Object.fromEntries(entries.filter(Boolean)));
    }
    fetchReports();
    return () => {
      cancelled = true;
    };
  }, [savedPlans.map((item) => item.id).join("|"), active?.prep_plan_id, active?.score]);

  return reports;
}

function ProgressView({ plan, completedTasks, examAttempts, mockAttempts, savedPlans, apiFetch, readiness, onOpenPlan }) {
  const [planDetails, setPlanDetails] = useState({});
  const [selectedProgressPlanId, setSelectedProgressPlanId] = useState(() => plan?.prep_plan_id || savedPlans[0]?.id || "");
  const readinessReports = usePlanReadinessReports(savedPlans, readiness, apiFetch);

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
  const allPlanTasks = selectedPlan ? planDays.flatMap((day) => buildDailyStudyTasks(selectedPlan, day.day)) : [];
  const noteTasks = allPlanTasks.filter((task) => task.task_type === "study_note");
  const completedNotes = countCompletedDayTasks(noteTasks, completedTasks);
  const completeExams = selectedExamAttempts.filter((attempt) => attempt.status === "complete");
  const completeMocks = selectedMockAttempts.filter((attempt) => attempt.status === "complete");
  const examAverage = averageAttemptScore(completeExams);
  const mockAverage = averageAttemptScore(completeMocks);
  const completedPlanDays = planDays.filter((day) => isPlanDayComplete(selectedPlan, day.day, completedTasks)).length;
  const planProgress = planDays.length ? Math.round((completedPlanDays / planDays.length) * 100) : 0;
  const reviewQueue = buildReviewQueue(completeExams, completeMocks);
  const readinessReport = readinessReports[String(selectedPlan?.prep_plan_id || selectedPlan?.id)] || emptyReadinessReport();
  const readinessScore = readinessReport.score;
  const generatedNextAction = getProgressNextAction({ plan: selectedPlan, planDays, completedTasks, examAttempts: selectedExamAttempts, mockAttempts: selectedMockAttempts, reviewQueue });
  const adaptiveNextAction = readinessReport.next_actions?.[0];
  const nextAction = adaptiveNextAction
    ? { title: adaptiveNextAction.title, detail: adaptiveNextAction.detail }
    : generatedNextAction;
  const competencyFocus = [...(readinessReport.competencies || [])]
    .sort((first, second) => competencyNeedRank(first) - competencyNeedRank(second))
    .slice(0, 3)
    .map((item) => ({ label: item.name, value: item.score, detail: item.next_action }));
  const focusItems = competencyFocus.length
    ? competencyFocus
    : [...readinessReport.components].sort((first, second) => first.value - second.value).slice(0, 3);
  const recentResults = [...completeExams.map((attempt) => ({ ...attempt, kind: "Exam" })), ...completeMocks.map((attempt) => ({ ...attempt, kind: "Mock" }))]
    .sort((first, second) => new Date(second.completedAt || second.updatedAt || second.createdAt || 0) - new Date(first.completedAt || first.updatedAt || first.createdAt || 0))
    .slice(0, 4);

  return (
    <section className="page-stack simple-readiness-page guided-job-analysis-direct">
      <section className="guided-analysis-summary simple-readiness-summary">
        <div className="simple-readiness-heading">
          <div><span>Readiness</span><h2>{selectedPlan?.job_title || "Choose a prep plan"}</h2></div>
          {savedPlans.length > 1 && (
            <label><span>Job</span><select value={selectedProgressPlanId} onChange={(event) => setSelectedProgressPlanId(event.target.value)}>
              {savedPlans.map((savedPlan) => <option key={savedPlan.id} value={savedPlan.id}>{savedPlan.job_title}</option>)}
            </select></label>
          )}
        </div>
        <div className="simple-readiness-score">
          <strong>{readinessScore}%</strong>
          <div><h3>{readinessLabel(readinessScore)}</h3><p>{readinessSummary(readinessScore, selectedPlan, readinessReport)}</p></div>
        </div>
        <div className="simple-readiness-track" role="progressbar" aria-label="Interview readiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow={readinessScore}><span style={{ width: `${readinessScore}%` }} /></div>
      </section>

      <section className="guided-analysis-priorities simple-next-action">
        <header><div><span>Prepare next</span><h3>Best next action</h3></div><small>Based on the selected job</small></header>
        <div><b className={readinessScore < 70 ? "priority-critical" : "priority-important"}>{readinessScore < 70 ? "Priority" : "Keep going"}</b><span><strong>{nextAction.title}</strong><p>{nextAction.detail}</p></span></div>
        {selectedPlan && <button type="button" className="guided-secondary-button" onClick={() => onOpenPlan?.(selectedPlan.prep_plan_id || selectedPlan.id)}>Open plan <ChevronRight size={15} /></button>}
      </section>

      <div className="guided-analysis-columns simple-readiness-columns">
        <section>
          <header><span>Current progress</span><h3>What is completed</h3></header>
          <div className="simple-status-list">
            <ReadinessStatusRow label="Plan days" value={`${completedPlanDays} of ${planDays.length}`} detail={`${planProgress}% complete`} />
            <ReadinessStatusRow label="Study notes" value={`${completedNotes} of ${noteTasks.length}`} detail="Completed for this job" />
            <ReadinessStatusRow label="Practice" value={`${completeExams.length + completeMocks.length}`} detail="Scored exams and mocks" />
          </div>
        </section>
        <section>
          <header><span>Practice results</span><h3>What your scores show</h3></header>
          <div className="simple-score-summary">
            <ReadinessStatusRow label="Exam average" value={examAverage === null ? "—" : `${examAverage}%`} detail={`${completeExams.length} completed`} />
            <ReadinessStatusRow label="Mock average" value={mockAverage === null ? "—" : `${mockAverage}%`} detail={`${completeMocks.length} completed`} />
            <ReadinessStatusRow label="Needs review" value={`${reviewQueue.length}`} detail="Low-scored answers" />
          </div>
          {recentResults.length > 0 && <div className="simple-recent-results">{recentResults.map((attempt) => <div key={`${attempt.kind}-${attempt.id}`}><span>{attempt.kind}</span><strong>{scorePercent(attempt.score)}%</strong></div>)}</div>}
        </section>
      </div>

      <section className="guided-analysis-topics simple-readiness-focus">
        <header><div><span>Focus areas</span><h3>What will improve readiness</h3></div><small>Lowest signals first</small></header>
        <div>
          {focusItems.map((item) => (
            <article key={item.label}>
              <b className={item.value < 50 ? "priority-critical" : item.value < 75 ? "priority-important" : "priority-supporting"}>{item.value < 50 ? "Focus" : item.value < 75 ? "Build" : "Maintain"}</b>
              <span>{item.value}%</span>
              <div><strong>{item.label}</strong><p>{item.detail || readinessComponentAdvice(item.label, item.value)}</p></div>
            </article>
          ))}
          {!focusItems.length && <p className="guided-analysis-empty-copy">Start a prep plan to see the most important readiness signals.</p>}
        </div>
      </section>

      <details className="simple-readiness-method">
        <summary>How readiness is calculated</summary>
        <p>{readinessReport.formula || READINESS_FORMULA}</p>
      </details>
    </section>
  );
}

function ReadinessStatusRow({ label, value, detail }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function averageAttemptScore(attempts) {
  if (!attempts.length) return null;
  return Math.round(attempts.reduce((total, attempt) => total + scorePercent(attempt.score), 0) / attempts.length);
}

function readinessComponentAdvice(label, value) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("plan")) return value >= 75 ? "Keep following the next scheduled plan task." : "Complete the next unfinished preparation day.";
  if (normalized.includes("learn") || normalized.includes("note")) return value >= 75 ? "Review completed notes before the interview." : "Finish the remaining job-specific study notes.";
  if (normalized.includes("mastery") || normalized.includes("competenc")) return value >= 75 ? "Confirm the role skill in one hard scenario." : "Review the weakest role skill, then retry it in practice.";
  if (normalized.includes("exam")) return value >= 75 ? "Use one harder exam to confirm your level." : "Take or review a job-specific exam.";
  if (normalized.includes("mock")) return value >= 75 ? "Run one final realistic mock interview." : "Complete a mock interview and review weak answers.";
  return value >= 75 ? "Keep a steady preparation rhythm." : "Complete one meaningful preparation activity today.";
}

function competencyNeedRank(item) {
  const priorityBonus = { critical: 25, important: 10, supporting: 0 }[item?.priority] ?? 0;
  return Number(item?.score || 0) - priorityBonus;
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

function buildInterviewDataRows({ jobs, savedPlans, detailedPlans, examAttempts, mockAttempts, notes, generatedStudyNotes, calendarEvents }) {
  const rows = new Map();
  const allPlans = detailedPlans.length ? detailedPlans : savedPlans;
  jobs.forEach((job) => {
    rows.set(`job:${job.id}`, {
      id: `job:${job.id}`,
      jobId: job.id,
      title: job.title || "Saved job",
      company: job.company || companyFromUrl(job.source_url) || "",
      color: job.color || colorForJobId(job.id),
      source: job.source_url ? companyFromUrl(job.source_url) || "Saved URL" : "Saved description",
      sourceUrl: job.source_url || "",
      daysLabel: "Saved job",
      plans: [],
      examAttempts: [],
      mockAttempts: [],
      notes: [],
      generatedNotes: [],
      calendarEvents: [],
      topics: [],
      primaryPlanId: "",
      evidenceCount: 1,
    });
  });

  allPlans.forEach((item) => {
    const planId = item.prep_plan_id || item.id;
    const jobId = item.job_post_id;
    const key = jobId && rows.has(`job:${jobId}`) ? `job:${jobId}` : `plan:${planId}`;
    if (!rows.has(key)) {
      rows.set(key, {
        id: key,
        jobId,
        title: item.job_title || "Prep plan",
        company: item.company || "",
        color: colorForJobId(jobId || planId),
        source: "Generated prep plan",
        sourceUrl: "",
        daysLabel: `${item.days_until_interview ?? 0} days left`,
        plans: [],
        examAttempts: [],
        mockAttempts: [],
        notes: [],
        generatedNotes: [],
        calendarEvents: [],
        topics: [],
        primaryPlanId: planId,
        evidenceCount: 0,
      });
    }
    const row = rows.get(key);
    row.title = item.job_title || row.title;
    row.daysLabel = `${item.days_until_interview ?? row.daysLabel} days left`;
    row.primaryPlanId ||= planId;
    row.plans.push(item);
    row.topics.push(...topicsForWholePlan(item));
  });

  const rowList = [...rows.values()];
  const findRow = (attempt) => {
    if (attempt.jobPostId) {
      const byJob = rowList.find((row) => String(row.jobId) === String(attempt.jobPostId));
      if (byJob) return byJob;
    }
    if (attempt.prepPlanId) {
      const byPlan = rowList.find((row) => row.plans.some((item) => String(item.prep_plan_id || item.id) === String(attempt.prepPlanId)));
      if (byPlan) return byPlan;
    }
    return rowList.find((row) => attempt.jobTitle && row.title === attempt.jobTitle);
  };

  examAttempts.forEach((attempt) => {
    const row = findRow(attempt);
    if (!row) return;
    row.examAttempts.push(attempt);
    row.topics.push(...attemptTopics(attempt));
  });
  mockAttempts.forEach((attempt) => {
    const row = findRow(attempt);
    if (!row) return;
    row.mockAttempts.push(attempt);
    row.topics.push(...attemptTopics(attempt));
  });
  notes.forEach((note) => {
    const row = rowList.find((item) => item.primaryPlanId && String(item.primaryPlanId) === String(note.planId));
    if (row) row.notes.push(note);
  });
  Object.values(generatedStudyNotes || {}).forEach((note) => {
    const row = rowList.find((item) => item.primaryPlanId && String(item.primaryPlanId) === String(note.planId));
    if (row) row.generatedNotes.push(note);
  });
  calendarEvents.forEach((event) => {
    const normalizedEvent = normalizeCalendarEvent(event);
    const row = rowList.find((item) => item.primaryPlanId && String(item.primaryPlanId) === String(normalizedEvent.prepPlanId));
    if (row) row.calendarEvents.push(event);
  });

  return rowList.map((row) => ({
    ...row,
    topics: [...new Set(row.topics.filter(Boolean))].slice(0, 18),
    noteCount: row.notes.length + row.generatedNotes.length,
    evidenceCount: row.plans.length + row.examAttempts.length + row.mockAttempts.length + row.notes.length + row.generatedNotes.length + row.calendarEvents.length,
  })).sort((a, b) => b.evidenceCount - a.evidenceCount || a.title.localeCompare(b.title));
}

function attemptTopics(attempt) {
  if (attempt.exam?.questions) return attempt.exam.questions.flatMap((question) => question.topics || []);
  if (attempt.interview?.questions) return attempt.interview.questions.flatMap((question) => question.topics || [question.section]).filter(Boolean);
  return attempt.topics || [];
}

function buildQuestionBank({ examAttempts, mockAttempts, scope }) {
  const matchesScope = (attempt) => {
    if (!scope) return true;
    if (scope.jobId && String(attempt.jobPostId) === String(scope.jobId)) return true;
    if (scope.primaryPlanId && String(attempt.prepPlanId) === String(scope.primaryPlanId)) return true;
    return attempt.jobTitle && attempt.jobTitle === scope.title;
  };
  const examQuestions = examAttempts.filter(matchesScope).flatMap((attempt) => (attempt.exam?.questions || []).map((question, index) => ({
    id: `${attempt.id || attempt.exam?.id}-exam-${question.id || index}`,
    kind: "exam",
    prompt: question.prompt || "Exam question",
    context: `${attempt.exam?.title || "Generated exam"} • ${(question.topics || []).join(", ") || attempt.difficulty || "practice"}`,
  })));
  const mockQuestions = mockAttempts.filter(matchesScope).flatMap((attempt) => (attempt.interview?.questions || []).map((question, index) => ({
    id: `${attempt.id || attempt.interview?.id}-mock-${question.id || index}`,
    kind: "mock",
    prompt: question.prompt || question.question || "Mock interview question",
    context: `${mockSectionLabel(question, index + 1)} • ${attempt.difficulty || "mock interview"}`,
  })));
  return [...examQuestions, ...mockQuestions];
}

function buildDataQuality(row) {
  return [
    { label: "Job source", detail: row.sourceUrl ? "URL saved" : "Description saved", done: true },
    { label: "Prep plan", detail: row.plans.length ? `${row.plans.length} generated` : "No plan yet", done: row.plans.length > 0 },
    { label: "Study notes", detail: row.noteCount ? `${row.noteCount} notes captured` : "No notes yet", done: row.noteCount > 0 },
    { label: "Scored practice", detail: `${row.examAttempts.filter((item) => item.status === "complete").length + row.mockAttempts.filter((item) => item.status === "complete").length} completed`, done: row.examAttempts.some((item) => item.status === "complete") || row.mockAttempts.some((item) => item.status === "complete") },
  ];
}

function buildInterviewSignals(row, questions) {
  const topTopics = row.topics.slice(0, 6);
  const completeAttempts = [...row.examAttempts, ...row.mockAttempts].filter((item) => item.status === "complete");
  const avgScore = averageScorePercent(completeAttempts);
  return [
    { title: "Likely interview focus", detail: topTopics.length ? topTopics.join(", ") : "Generate a prep plan or exam to extract role topics." },
    { title: "Question coverage", detail: questions.length ? `${questions.length} generated questions found for this role.` : "No questions generated yet." },
    { title: "Performance signal", detail: avgScore ? `${avgScore}% average across completed attempts.` : "Submit an exam or mock interview to create a score signal." },
    { title: "Prep evidence", detail: `${row.evidenceCount} tracked item${row.evidenceCount === 1 ? "" : "s"} connected to this job.` },
  ];
}

function buildAnalyticsScope({ selectedPlan, detailedPlans, completedTasks, examAttempts, mockAttempts, notes, generatedStudyNotes, calendarEvents, recentActivity }) {
  const planIds = selectedPlan ? new Set([String(selectedPlan.prep_plan_id || selectedPlan.id)]) : new Set(detailedPlans.map((item) => String(item.prep_plan_id || item.id)));
  const inScope = (attempt) => !planIds.size || planIds.has(String(attempt.prepPlanId));
  const scopedExamAttempts = examAttempts.filter(inScope);
  const scopedMockAttempts = mockAttempts.filter(inScope);
  const completeExams = scopedExamAttempts.filter((attempt) => attempt.status === "complete");
  const completeMocks = scopedMockAttempts.filter((attempt) => attempt.status === "complete");
  const completeAttempts = [...completeExams, ...completeMocks];
  const selectedPlans = selectedPlan ? [selectedPlan] : detailedPlans;
  const detailedSelectedPlans = selectedPlans.filter((item) => Array.isArray(item.tasks) && item.tasks.length);
  const noteTasks = detailedSelectedPlans.flatMap((item) => buildPlanMilestones(item, "").filter((day) => !day.isFinal).flatMap((day) => buildDailyStudyTasks(item, day.day)));
  const completedNotes = countCompletedDayTasks(noteTasks.filter((task) => task.task_type === "study_note"), completedTasks);
  const completedDays = detailedSelectedPlans.reduce((sum, item) => {
    const days = buildPlanMilestones(item, "").filter((day) => !day.isFinal);
    return sum + days.filter((day) => isPlanDayComplete(item, day.day, completedTasks)).length;
  }, 0);
  const totalDays = detailedSelectedPlans.reduce((sum, item) => sum + buildPlanMilestones(item, "").filter((day) => !day.isFinal).length, 0);
  const scopedPlanIds = new Set(selectedPlans.map((item) => String(item.prep_plan_id || item.id)));
  const upcomingEvents = calendarEvents
    .map((event) => normalizeCalendarEvent(event))
    .filter((event) => !scopedPlanIds.size || [...scopedPlanIds].some((planId) => eventBelongsToPlan(event, planId)))
    .sort((a, b) => String(a.date || a.start || "").localeCompare(String(b.date || b.start || "")));
  const savedGeneratedNotes = Object.values(generatedStudyNotes || {}).filter((note) => !scopedPlanIds.size || scopedPlanIds.has(String(note.planId)));
  return {
    examAttempts: scopedExamAttempts,
    mockAttempts: scopedMockAttempts,
    completeExams,
    completeMocks,
    completeAttempts,
    averageExamScore: averageScorePercent(completeExams),
    averageMockScore: averageScorePercent(completeMocks),
    noteTasks: noteTasks.filter((task) => task.task_type === "study_note"),
    completedNotes,
    planProgress: totalDays ? Math.round((completedDays / totalDays) * 100) : 0,
    notes: notes.filter((note) => !scopedPlanIds.size || scopedPlanIds.has(String(note.planId || ""))),
    generatedNotes: savedGeneratedNotes,
    upcomingEvents,
    recentActivity: selectedPlan ? recentActivity.filter((item) => activityBelongsToPlan(item, selectedPlan)) : recentActivity,
  };
}

function averageScorePercent(attempts) {
  const scores = attempts.map((attempt) => Number(attempt.score)).filter(Number.isFinite);
  if (!scores.length) return 0;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100);
}

function buildAnalyticsPlanSummary(plan, completedTasks, examAttempts, mockAttempts) {
  if (!plan?.tasks?.length) {
    const planId = plan.prep_plan_id || plan.id;
    const attempts = [...examAttempts, ...mockAttempts].filter((attempt) => String(attempt.prepPlanId) === String(planId));
    return {
      id: planId,
      title: plan.job_title || "Prep plan",
      daysLeft: plan.days_until_interview ?? 0,
      tasksDone: 0,
      tasksTotal: Number(plan.task_count || 0),
      attempts: attempts.length,
      progress: 0,
    };
  }
  return buildPlanProgressSummary(plan, completedTasks, examAttempts, mockAttempts);
}

function buildScoreTrend(attempts) {
  return attempts
    .map((attempt, index) => ({
      id: attempt.id || `${attempt.kind}-${index}`,
      label: attempt.kind === "mock" ? "Mock" : "Exam",
      score: Math.round(Number(attempt.score || 0) * 100),
      createdAt: attempt.completedAt || attempt.createdAt || "",
    }))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-10);
}

function buildAnalyticsInsight({ selectedPlan, scoped, topicInsights, reviewQueue, readinessScore }) {
  if (!selectedPlan && !scoped.completeAttempts.length) return "Start by generating a plan, reading notes, and submitting a first practice exam so analytics can measure real progress.";
  if (reviewQueue.length) return `Review queue has ${reviewQueue.length} weak answer${reviewQueue.length === 1 ? "" : "s"}. Fixing those will raise readiness faster than creating more random practice.`;
  if (topicInsights.weaknesses.length) return `Focus next on ${topicInsights.weaknesses.slice(0, 3).join(", ")}. These topics are dragging down score quality.`;
  if (readinessScore >= 80) return "The current trend is strong. Keep one final hard mock interview and a light review before the interview.";
  return "The next best move is to complete today’s notes, then submit a scoped practice exam to create a sharper feedback loop.";
}

function buildPrepFunnel({ jobs, detailedPlans, scoped, reviewQueue }) {
  const max = Math.max(1, jobs.length, detailedPlans.length, scoped.noteTasks.length, scoped.completeExams.length, scoped.completeMocks.length, reviewQueue.length);
  return [
    { label: "Saved jobs", value: jobs.length },
    { label: "Prep plans", value: detailedPlans.length },
    { label: "Note tasks", value: scoped.noteTasks.length },
    { label: "Submitted exams", value: scoped.completeExams.length },
    { label: "Completed mocks", value: scoped.completeMocks.length },
    { label: "Review items", value: reviewQueue.length },
  ].map((item) => ({ ...item, percent: Math.max(6, Math.round((item.value / max) * 100)) }));
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
  return isTaskCompleteForPlan({ prep_plan_id: task?.planId }, task, completedTasks);
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

function toLocalDateTimeInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function applyWorkspaceCollection(data, key, setter, persist) {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return;
  setter(data[key]);
  persist(data[key]);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
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
  theme,
  setTheme,
  soundVolume,
  setSoundVolume,
  allowLocalFallback,
  setAllowLocalFallback,
  deletedJobs,
  extensionState,
  restoreDeletedJob,
  clearDeletedJob,
  loading,
  onToggleExtension,
  onInstallExtension,
  onRefreshExtension,
  onDeleteAccount,
  onClose,
  onReplayOnboarding,
  onKnowMore,
}) {
  function updateSoundVolume(value) {
    const nextVolume = Math.max(0, Math.min(100, Number(value)));
    setSoundVolume(nextVolume);
    saveGlobalValue("interviewprep_sound_volume", String(nextVolume));
  }

  function updateTheme(nextTheme) {
    setTheme(nextTheme);
    saveGlobalValue("interviewprep_theme", nextTheme);
  }

  function updateFallbackPreference(nextValue) {
    setAllowLocalFallback(nextValue);
    saveGlobalValue("interviewprep_allow_local_fallback", nextValue ? "true" : "false");
  }

  return (
    <div className="settings-popover simple-settings-popover" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="simple-settings-header">
        <div>
          <strong id="settings-title">Settings</strong>
          <span>Account and workspace preferences</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={16} /></button>
      </header>
      <div className="simple-settings-account">
        <span>{initialsFor(user?.name)}</span>
        <div>
          <strong>{user?.name || "Guest"}</strong>
          <small>{user?.email || "Local workspace"}</small>
        </div>
      </div>

      <div className="settings-popover-body simple-settings-body">
        <section className="simple-settings-group">
          <span className="guided-analysis-kicker">Preferences</span>
          <div className="simple-settings-row">
            <div>
              <strong><Palette size={15} /> Appearance</strong>
              <small>{theme === "dark" ? "Dark workspace" : "Light workspace"}</small>
            </div>
            <button
              type="button"
              className={`simple-settings-switch ${theme === "dark" ? "on" : ""}`}
              onClick={() => updateTheme(theme === "dark" ? "light" : "dark")}
              aria-pressed={theme === "dark"}
              aria-label="Toggle dark mode"
            >
              <span />
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>

          <div className="simple-settings-row simple-settings-sound">
            <div>
              <strong><Volume2 size={15} /> Generation sound</strong>
              <small>{soundVolume === 0 ? "Muted" : `${soundVolume}% volume`}</small>
            </div>
            <div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={soundVolume}
                onChange={(event) => updateSoundVolume(event.target.value)}
                aria-label="Generation sound volume"
              />
              <button type="button" onClick={() => playGeneratedSound(soundVolume)}>Test</button>
            </div>
          </div>
        </section>

        <section className="simple-settings-group">
          <span className="guided-analysis-kicker">Generation</span>
          <div className="simple-settings-row">
            <div>
              <strong><BrainCircuit size={15} /> Local fallback</strong>
              <small>{allowLocalFallback ? "Offline backup content is allowed if AI fails." : "Quality-first: use the AI service only."}</small>
            </div>
            <button
              type="button"
              className={`simple-settings-switch ${allowLocalFallback ? "on" : ""}`}
              onClick={() => updateFallbackPreference(!allowLocalFallback)}
              aria-pressed={allowLocalFallback}
              aria-label="Toggle local AI fallback"
            >
              <span />
              {allowLocalFallback ? "On" : "Off"}
            </button>
          </div>
        </section>

        <section className="simple-settings-group">
          <span className="guided-analysis-kicker">Browser capture</span>
          <div className="simple-settings-row simple-extension-row">
            <div>
              <strong><Sparkles size={15} /> Chrome extension</strong>
              <small>{extensionDescription(extensionState, user)}</small>
              {extensionState?.error && <small className="extension-error">{extensionState.error}</small>}
            </div>
            <div className="simple-extension-actions">
              <button
                type="button"
                className={extensionState?.installed ? `simple-settings-switch ${extensionState?.bubbleEnabled ? "on" : ""}` : "simple-settings-action"}
                onClick={onToggleExtension}
                aria-pressed={Boolean(extensionState?.bubbleEnabled)}
              >
                {extensionState?.installed ? <><span />{extensionState.bubbleEnabled ? "On" : "Off"}</> : <>Install <ExternalLink size={12} /></>}
              </button>
              <button type="button" className="simple-settings-action" onClick={extensionState?.installed ? onRefreshExtension : onInstallExtension}>
                {extensionState?.installed ? "Refresh" : "Guide"}
              </button>
            </div>
          </div>
        </section>

        <details className="simple-settings-disclosure">
          <summary>
            <span><RotateCcw size={15} /> Workspace & recovery</span>
            <small>{deletedJobs.length ? `${deletedJobs.length} deleted` : "No deleted jobs"}</small>
          </summary>
          <div>
            <button type="button" className="simple-settings-wide-action" onClick={onReplayOnboarding}>Replay onboarding</button>
            {deletedJobs.length ? (
              <div className="deleted-job-list">
                {deletedJobs.map((job) => (
                  <article key={`${job.id}-${job.deleted_at}`}>
                    <div>
                      <strong>{job.title}</strong>
                      <span>{job.company || companyFromUrl(job.source_url) || "Deleted job"}</span>
                    </div>
                    <div className="deleted-job-actions">
                      <button type="button" disabled={loading} onClick={() => restoreDeletedJob(job.id)}><RotateCcw size={12} /> Restore</button>
                      <button type="button" disabled={loading} onClick={() => clearDeletedJob(job.id)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>Deleted jobs can be restored here for a short time.</p>
            )}
          </div>
        </details>
      </div>

      <footer className="simple-settings-footer">
        <button type="button" onClick={onKnowMore}><Info size={15} /> About PrepInterview AI</button>
        {user && <button type="button" className="danger" onClick={onDeleteAccount}><Trash2 size={14} /> Delete account</button>}
      </footer>
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
    ["an uppercase letter", /[A-Z]/.test(password)],
    ["a lowercase letter", /[a-z]/.test(password)],
    ["a number", /\d/.test(password)],
    ["a symbol", /[^A-Za-z0-9\s]/.test(password)],
  ];
  const missing = checks.filter(([, done]) => !done).map(([label]) => label);
  const missingText = missing.length === 1
    ? missing[0]
    : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return (
    <div className={`password-requirements ${missing.length ? "needed" : "met"}`} aria-live="polite">
      <span><Check size={16} />Password requirements</span>
      <p>Use 8+ characters with uppercase and lowercase letters, a number, and a symbol.</p>
      <small>{missing.length ? `Still needed: ${missingText}.` : "Password requirements complete."}</small>
    </div>
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
    {
      title: "Readiness and schedule",
      body: "The product keeps preparation focused by showing the selected job’s readiness, next action, completed work, practice results, and upcoming schedule.",
      detail: "Readiness uses real plan, learning, exam, mock, and consistency signals. Schedule keeps interview dates, preparation work, and meeting links together without duplicating the rest of the workspace.",
      visual: ["Next action", "Readiness", "Schedule"],
      metric: "06",
    },
    {
      title: "Browser capture bubble",
      body: "The extension lets users capture job descriptions while browsing job boards, save URLs, paste manually, or send selected job content into PrepInterview AI without breaking their application workflow.",
      detail: "The bubble connects to the logged-in account, saves jobs directly, and can trigger prep plan generation from the page where the opportunity was found.",
      visual: ["Capture", "Save", "Prepare"],
      metric: "07",
    },
  ];
  const pipeline = ["Job Description", "AI Analysis", "Prep Plan", "Daily Notes", "Focused Exam", "Mock Interview", "Review Loop", "Readiness"];
  return (
    <section className="about-page">
      <section className="about-hero">
        <button className="outline-action compact-action" onClick={onBack}>Back to Settings</button>
        <div className="about-hero-copy">
          <h2>PrepInterview AI</h2>
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
          <p>PrepInterview AI is built around one idea: preparation should be connected and measurable. The notes feed the exam. The exam feeds review. The mock interview matches the role. Progress shows what improved and what still needs work.</p>
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
            ["Readiness", "See one job’s score, next action, completed work, practice results, and focus areas."],
            ["Schedule", "See upcoming prep work, interviews, custom events, and plan tasks without leaving the selected job context."],
            ["Capture Bubble", "Save job descriptions or URLs from job boards through the browser extension."],
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
        <p>Make interview prep feel less random. Instead of scattered notes, generic questions, and last-minute anxiety, PrepInterview AI builds a clean loop: learn the right topics, test them realistically, speak them out loud, review what happened, and improve before interview day.</p>
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
  const planId = plan?.prep_plan_id || plan?.id || plan?.job_post_id || "unscoped";
  const planTasks = plan?.tasks?.filter((task) => displayPlanDay(plan, task.day) === Number(day)) || [];
  const difficulty = difficultyForPlanDay(plan, day);
  const studySources = planTasks
    .filter((task) => ["study", "coding", "revision"].includes(task.task_type))
    .slice(0, 3);
  const mockSources = planTasks.filter((task) => task.task_type === "mock_interview").slice(0, 1);
  const fallbackTopics = topicsForStudyDay(plan, day);
  const sources = studySources.length ? studySources : fallbackTopics.slice(0, 3).map((topic) => ({
    title: topic,
    topics: [topic],
    instructions: `Understand ${topic}, explain it clearly, and connect it to the job responsibilities.`,
  }));
  const noteTasks = sources.map((source, index) => {
    const topics = source.topics?.length ? source.topics : [source.title];
    return {
      id: `plan-${planId}-day-${day}-note-${index}-${topics.join("-")}`,
      serverTaskId: source.id,
      planId,
      day,
      title: `Read notes: ${source.title}`,
      topics,
      task_type: "study_note",
      instructions: source.instructions,
      difficulty,
      duration_minutes: source.duration_minutes,
      status: source.status,
      order: index + 1,
    };
  });
  const topics = [...new Set(noteTasks.flatMap((task) => task.topics))];
  const mockTasks = mockSources.map((source, index) => ({
    id: `plan-${planId}-day-${day}-mock-${source.id || index}`,
    serverTaskId: source.id,
    planId,
    day,
    title: source.title || `Mock interview for Day ${day}`,
    topics: source.topics?.length ? source.topics : topics,
    task_type: "mock_interview",
    instructions: source.instructions,
    difficulty,
    duration_minutes: source.duration_minutes || 45,
    status: source.status,
    order: noteTasks.length + 2,
  }));
  return [
    ...noteTasks,
    {
      id: `plan-${planId}-day-${day}-practice-exam`,
      planId,
      day,
      title: `Practice exam for Day ${day}`,
      topics,
      task_type: "practice_exam",
      difficulty,
      order: noteTasks.length + 1,
    },
    ...mockTasks,
  ];
}

function difficultyForPlanDay(plan, day) {
  const lastTaskDay = Math.max(0, ...(plan?.tasks || []).map((task) => Number(task.day || 0)));
  const totalDays = Math.max(1, Number(plan?.days_until_interview || lastTaskDay || 1));
  if (totalDays <= 1) return "medium";
  const progress = (Math.max(1, Number(day || 1)) - 1) / Math.max(1, totalDays - 1);
  if (progress < 0.34) return "easy";
  if (progress < 0.75) return "medium";
  return "hard";
}

function isPlanDayComplete(plan, day, completedTasks) {
  const dayTasks = buildDailyStudyTasks(plan, day);
  if (!dayTasks.length) return false;
  return countCompletedDayTasks(dayTasks, completedTasks) === dayTasks.length;
}

function countCompletedDayTasks(dayTasks, completedTasks) {
  return dayTasks.filter((task) => isTaskComplete(task, completedTasks)).length;
}

function topicsForStudyDay(plan, day) {
  const tasks = plan?.tasks?.filter((task) => displayPlanDay(plan, task.day) === Number(day)) || [];
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

function topicsThroughPlanDay(plan, day) {
  const seen = new Set();
  return (plan?.tasks || [])
    .filter((task) => displayPlanDay(plan, task.day) <= Number(day))
    .sort((left, right) => displayPlanDay(plan, left.day) - displayPlanDay(plan, right.day))
    .flatMap((task) => task.topics || [])
    .filter((topic) => {
      const normalized = String(topic || "").trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

function buildPlanCalendarDays(plan) {
  const interviewDate = planInterviewDate(plan);
  const today = dateKey(new Date());
  return prepTimelineForPlan({ ...plan, interview_at: interviewDate }).map(({ day, date }) => ({
    day,
    date,
    isToday: dateKey(date) === today,
    interviewDate,
  }));
}

function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

function planInterviewDate(plan) {
  const rawInterview = plan?.interview_at || plan?.interview_date;
  const fallbackDays = Math.max(Number(plan?.days_until_interview) || 0, 1);
  const fallback = startOfLocalDay(new Date());
  fallback.setDate(fallback.getDate() + fallbackDays);
  if (!rawInterview) return fallback;

  const dateOnly = String(rawInterview).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
    : new Date(rawInterview);
  return Number.isNaN(parsed.getTime()) ? fallback : startOfLocalDay(parsed);
}

function formatInterviewSchedule(plan) {
  const rawInterview = plan?.interview_at || plan?.interview_date;
  const dateOnly = String(rawInterview || "").match(/^\d{4}-\d{2}-\d{2}$/);
  const interviewDate = planInterviewDate(plan);
  const today = startOfLocalDay(new Date());
  const isToday = dateKey(interviewDate) === dateKey(today);

  if (!rawInterview || dateOnly) {
    return isToday
      ? "Interview today · time to confirm"
      : `Interview ${formatPlanDate(interviewDate)} · time to confirm`;
  }

  const moment = new Date(rawInterview);
  if (Number.isNaN(moment.getTime())) return `Interview ${formatPlanDate(interviewDate)} · time to confirm`;
  const time = moment.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return isToday
    ? `Interview today at ${time}`
    : `Interview ${moment.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} at ${time}`;
}

function preparationCalendarDayCount(plan, interviewDate = planInterviewDate(plan)) {
  return prepTimelineForPlan({ ...plan, interview_at: interviewDate }).length || 1;
}

function displayPlanDay(plan, taskDay) {
  const totalDays = preparationCalendarDayCount(plan);
  return Math.min(Math.max(Number(taskDay) || 1, 1), totalDays);
}

function formatPlanDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "scheduled date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function examScopeLabel(scope, day) {
  if (scope === "through_selected_day") return `Syllabus through Day ${day}`;
  if (scope === "custom_topics") return "Custom focus";
  return `Day ${day} only`;
}

function mockScopeLabel(scope, day) {
  if (scope === "through_selected_day") return `Topics through Day ${day}`;
  if (scope === "full_plan" || scope === "custom_topics") return "Full interview prep";
  return `Day ${day} topics`;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
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
    dashboard: "Today",
    jobs: "Jobs",
    prep: "Plan",
    exams: "Practice",
    progress: "Readiness",
    calendar: "Schedule",
    notes: "Notes",
    developer: "Developer Dashboard",
    settings: "Settings",
    about: "About",
  };
  return titles[view] || "Today";
}

function normalizeUrl(url) {
  if (!url) return "#";
  return url.startsWith("http") ? url : `https://${url}`;
}

function displayUrl(url) {
  if (!url) return "saved";
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function fullJobUrl(url) {
  if (!url) return "saved";
  return String(url).trim();
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
  const ignored = new Set(["www", "careers", "jobs", "boards", "apply", "greenhouse", "lever", "joinhandshake", "handshake", "workdayjobs", "myworkdayjobs", "linkedin", "indeed", "glassdoor", "ziprecruiter", "wellfound", "com", "org", "net", "io", "co", "us"]);
  const companyPart = parts.find((part) => !ignored.has(part.toLowerCase()) && !part.includes("myworkdayjobs"));
  if (!companyPart) return "";
  return titleCaseCompany(companyPart);
}

function normalizeJobIdentityForDisplay(title, company) {
  const stripChrome = (value) => String(value || "")
    .replace(/\s+(?:by clicking|continue to (?:join|sign in)|sign in to|join or sign in|cookie preferences).*$/i, "")
    .replace(/\s+[|•]\s+.*$/, "")
    .replace(/\s+[-–—]\s+(?:linkedin|handshake|indeed|glassdoor|ziprecruiter|wellfound).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const cleanedTitle = stripChrome(title) || "Choose a job";
  const embedded = cleanedTitle.match(/^(.{3,100}?)\s+(?:at|@)\s+(.{2,70})$/i);
  const role = (embedded?.[1] || cleanedTitle).trim();
  const providedCompany = stripChrome(company);
  const embeddedCompany = cleanCompanyCandidate(embedded?.[2]);
  const blocked = new Set(["saved job", "linkedin", "handshake", "indeed", "glassdoor", "ziprecruiter", "wellfound"]);
  const detectedCompany = providedCompany && !blocked.has(providedCompany.toLowerCase())
    ? titleCaseCompany(providedCompany)
    : embeddedCompany;
  return { role, company: detectedCompany || "" };
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
  try {
    return localStorage.getItem("interviewprep_token") || "";
  } catch {
    return "";
  }
}

function saveUserSession(user, token) {
  try {
    if (user && token) {
      localStorage.setItem("interviewprep_user", JSON.stringify(user));
      localStorage.setItem("interviewprep_token", token);
    } else {
      localStorage.removeItem("interviewprep_user");
      localStorage.removeItem("interviewprep_token");
    }
  } catch {
    // The active React session can continue even if browser storage is unavailable.
  }
}

function saveGlobalValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference changes remain active for the current browser session.
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
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // The backend workspace remains the durable source if local storage is unavailable.
  }
}

function onboardingStorageKey(userKey = "guest") {
  const safeKey = String(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `interviewprep_onboarding_${ONBOARDING_VERSION}:${safeKey}`;
}

function loadOnboardingState(userKey = "guest") {
  try {
    const parsed = JSON.parse(localStorage.getItem(onboardingStorageKey(userKey)) || "{}");
    if (parsed?.version === ONBOARDING_VERSION) {
      return {
        version: ONBOARDING_VERSION,
        dashboardTourDone: Boolean(parsed.dashboardTourDone),
        seenTabs: parsed.seenTabs && typeof parsed.seenTabs === "object" ? parsed.seenTabs : {},
        skipAll: Boolean(parsed.skipAll),
      };
    }
  } catch {
    // Malformed onboarding state should never block the app.
  }
  return { version: ONBOARDING_VERSION, dashboardTourDone: false, seenTabs: {}, skipAll: false };
}

function saveOnboardingState(userKey, state) {
  try {
    localStorage.setItem(onboardingStorageKey(userKey), JSON.stringify({ version: ONBOARDING_VERSION, ...state }));
  } catch {
    // Onboarding can safely restart if local storage is unavailable.
  }
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
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // The backend workspace remains the durable source if local storage is unavailable.
  }
}

function loadLocalValue(key) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return "";
  try {
    return localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function saveLocalValue(key, value) {
  const storageKey = scopedStorageKey(key);
  if (!storageKey) return;
  try {
    if (value === undefined || value === null || value === "") localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, String(value));
  } catch {
    // The backend workspace remains the durable source if local storage is unavailable.
  }
}

function saveCompletedTasks(tasks) {
  const key = scopedStorageKey("interviewprep_completed_tasks");
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(tasks));
  } catch {
    // The backend workspace remains the durable source if local storage is unavailable.
  }
}

function scopedStorageKey(key) {
  try {
    const token = localStorage.getItem("interviewprep_token");
    if (!token) return "";
    const user = JSON.parse(localStorage.getItem("interviewprep_user"));
    if (!user?.id && !user?.email) return "";
    const scope = String(user.id || user.email).replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${key}:${scope}`;
  } catch {
    return "";
  }
}

function loadSoundVolume() {
  try {
    const saved = Number(localStorage.getItem("interviewprep_sound_volume"));
    if (Number.isFinite(saved)) return Math.max(0, Math.min(100, saved));
  } catch {
    // Use the default below.
  }
  return 40;
}

function loadTheme() {
  try {
    return localStorage.getItem("interviewprep_theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function loadAllowLocalFallback() {
  try {
    return localStorage.getItem("interviewprep_allow_local_fallback") === "true";
  } catch {
    return false;
  }
}

function isStrongPassword(password) {
  return password.length >= 8
    && password.length <= 128
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
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
  if (!user) return "Login to PrepInterview AI so saved jobs and prep plans go to your account.";
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

function noteFolderName(folder) {
  return typeof folder === "string" ? folder : folder?.name || "";
}

function matchesNoteFolder(folder, name, planId = "", noteDate = "") {
  if (normalizeNoteFolder(noteFolderName(folder)) !== normalizeNoteFolder(name)) return false;
  if (typeof folder === "string") return !planId && !noteDate;
  return String(folder.planId || "") === String(planId || "")
    && String(folder.noteDate || "") === String(noteDate || "");
}

function hasNoteFolder(folders, name, planId = "", noteDate = "") {
  return (folders || []).some((folder) => matchesNoteFolder(folder, name, planId, noteDate));
}

function addNoteFolder(folders, name, planId = "", noteDate = "") {
  const cleanName = normalizeNoteFolder(name);
  if (!cleanName || hasNoteFolder(folders, cleanName, planId, noteDate)) return folders;
  return [{ id: crypto.randomUUID(), name: cleanName, planId: String(planId || ""), noteDate: noteDate || "" }, ...(folders || [])];
}

function prepDateForDay(plan, selectedJob, day) {
  const totalDays = Math.max(1, Number(plan?.days_until_interview) || 1);
  const interviewDate = guidedInterviewDate(selectedJob, plan, totalDays);
  const startDate = new Date(interviewDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - totalDays);
  startDate.setDate(startDate.getDate() + Math.max(0, Number(day || 1) - 1));
  return dateKey(startDate);
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
  const events = plan.tasks.map((task) => {
    const date = prepDateForPlanDay(plan, task.day);
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
  const interviewDate = planInterviewDate(plan);
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
