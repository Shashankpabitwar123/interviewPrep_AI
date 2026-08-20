import React from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  ExternalLink,
  FileQuestion,
  Gauge,
  Link,
  Menu,
  MessageSquareText,
  NotebookText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "./marketing.css";

const WORKFLOW = [
  {
    title: "Add the job",
    description: "Paste a description, add a URL, or save it with the Chrome extension.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Get a plan",
    description: "Turn the role and your available time into focused daily preparation.",
    icon: CalendarDays,
  },
  {
    title: "Learn and practice",
    description: "Study detailed notes, take exams, and rehearse interview answers.",
    icon: BookOpen,
  },
  {
    title: "Track readiness",
    description: "See completed work, weak topics, and what you should do next.",
    icon: Gauge,
  },
];

const JOB_ANALYSIS = [
  ["Requirements", ["Core skills", "Experience expectations", "Tools and knowledge"]],
  ["Responsibilities", ["Day-to-day work", "Collaboration needs", "Expected outcomes"]],
  ["Interview signals", ["Likely screening focus", "Important examples", "Questions to prepare"]],
  ["Topics to study", ["Priority concepts", "Role-specific practice", "Areas to clarify"]],
];

const WORKSPACE_TOOLS = [
  [BriefcaseBusiness, "Saved jobs"],
  [ClipboardList, "Prep plans"],
  [NotebookText, "Notes"],
  [FileQuestion, "Exams"],
  [MessageSquareText, "Mock interviews"],
  [CalendarDays, "Calendar"],
];

const FAQS = [
  [
    "How does PrepInterview AI create a plan?",
    "It uses the job description, your interview date, and your available study time to organize role-specific preparation into daily work.",
  ],
  [
    "What types of roles can I prepare for?",
    "The workflow starts from the job you provide, so it can adapt preparation to technical and non-technical roles instead of forcing one fixed curriculum.",
  ],
  [
    "Do I need the Chrome extension?",
    "No. The extension is an optional shortcut. You can always paste a job description, enter a job URL, or add a job manually.",
  ],
  [
    "What can I practice inside the app?",
    "You can study generated notes, ask follow-up questions, take configurable exams, and complete voice-enabled mock interview rounds.",
  ],
  [
    "Can I keep preparation for multiple jobs?",
    "Yes. Saved jobs keep their related plans, notes, exams, interviews, calendar items, and progress organized in one workspace.",
  ],
  [
    "Why do I need an account?",
    "Your account keeps your preparation records saved and associated with you when you return to the app.",
  ],
];

function BrandMark() {
  return (
    <img
      className="brand-logo-image"
      src="/prepinterview-logo.png"
      alt=""
      aria-hidden="true"
    />
  );
}

function ArrowIcon() {
  return (
    <svg className="button-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h15M14 7l5 5-5 5" />
    </svg>
  );
}

function PreviewDisclosure() {
  return <span className="preview-disclosure">Illustrative preview</span>;
}

function closeMobileMenu(event) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

function HeroProductPreview() {
  return (
    <div className="hero-product" aria-label="Example of creating a preparation plan from a job description">
      <PreviewDisclosure />
      <div className="hero-product-step input-step">
        <span>1</span>
        <div><strong>Add the job</strong><small>Paste a description or URL</small></div>
      </div>
      <div className="hero-product-step plan-step">
        <span>2</span>
        <div><strong>Get your plan</strong><small>Personalized daily preparation</small></div>
      </div>

      <section className="product-pane input-pane">
        <div className="pane-title"><strong>Create a prep plan</strong><small>Start with the job you want.</small></div>
        <div className="preview-tabs" aria-hidden="true"><span className="active">Paste description</span><span>Job URL</span></div>
        <div className="preview-field-label">Job description</div>
        <div className="preview-textarea">Paste the full job description here...</div>
        <div className="preview-fields"><span>Interview date</span><span>Hours per day</span></div>
        <div className="preview-button">Generate prep plan</div>
      </section>

      <ArrowIcon />

      <section className="product-pane plan-pane">
        <div className="pane-title row"><div><strong>Today’s plan</strong><small>Your next preparation tasks</small></div><span>View full plan</span></div>
        <div className="today-line"><CheckCircle2 /><div><strong>Review the job</strong><small>Understand requirements and responsibilities</small></div></div>
        <div className="today-line"><BookOpen /><div><strong>Study</strong><small>Learn the concepts that matter for this role</small></div></div>
        <div className="today-line"><FileQuestion /><div><strong>Practice</strong><small>Complete focused questions and exercises</small></div></div>
        <div className="today-line"><MessageSquareText /><div><strong>Mock interview</strong><small>Rehearse answers aloud</small></div></div>
      </section>
    </div>
  );
}

function WorkflowBand() {
  return (
    <section id="how-it-works" className="workflow-band" aria-labelledby="workflow-heading">
      <h2 id="workflow-heading">From job post to interview-ready</h2>
      <ol>
        {WORKFLOW.map(({ title, description, icon: Icon }, index) => (
          <li key={title}>
            <Icon aria-hidden="true" />
            <div><strong>{title}</strong><p>{description}</p></div>
            {index < WORKFLOW.length - 1 ? <ArrowIcon /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function JobAnalysisPreview() {
  return (
    <div className="analysis-preview product-frame" aria-label="Example sections in a job description analysis">
      <PreviewDisclosure />
      <div className="frame-heading"><SearchIcon /><div><strong>Job analysis</strong><span>Based on the description you provide</span></div></div>
      <div className="analysis-columns">
        {JOB_ANALYSIS.map(([title, items]) => (
          <div key={title}><strong>{title}</strong><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>
        ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return <Sparkles aria-hidden="true" />;
}

function PlanPreview() {
  return (
    <div className="plan-preview product-frame light-frame" aria-label="Example day-by-day preparation plan">
      <PreviewDisclosure />
      <div className="plan-settings">
        <strong>Your schedule</strong>
        <div className="preview-field">Interview date<span>Choose a date</span></div>
        <div className="preview-field">Hours per day<span>2 hours</span></div>
        <small>The plan adjusts to the time you have available.</small>
      </div>
      <div className="plan-days">
        <div className="frame-heading"><CalendarDays /><div><strong>Day-by-day plan</strong><span>Focused work leading to the interview</span></div></div>
        <div><b>Today</b><span>Review the job and priority requirements</span><CheckCircle2 /></div>
        <div><b>Next</b><span>Learn core concepts and prepare examples</span><BookOpen /></div>
        <div><b>Practice</b><span>Answer questions and review weak topics</span><FileQuestion /></div>
        <div><b>Final</b><span>Complete a full interview rehearsal</span><MessageSquareText /></div>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="notes-preview product-frame" aria-label="Example study notes and Ask AI conversation">
      <PreviewDisclosure />
      <section>
        <div className="frame-heading"><NotebookText /><div><strong>Study notes</strong><span>Saved to this job</span></div></div>
        <h3>Clear explanations for every topic</h3>
        <p>Learn what to understand, why it matters for the role, how to explain it, and which mistakes to avoid.</p>
        <ul><li>Key ideas and practical examples</li><li>Interview-ready explanations</li><li>Before-the-exam checklist</li></ul>
      </section>
      <section className="ask-preview">
        <div className="frame-heading"><MessageSquareText /><div><strong>Ask AI</strong><span>Questions stay with the note</span></div></div>
        <p className="question">How should I explain this clearly in an interview?</p>
        <p className="answer">Start with the goal, explain your approach, give one concrete example, and finish with the result or tradeoff.</p>
        <div className="ask-input">Ask a follow-up question...</div>
      </section>
    </div>
  );
}

function PracticePreview() {
  return (
    <div className="practice-preview" aria-label="Practice exam and voice mock interview setup examples">
      <section className="product-frame light-frame">
        <PreviewDisclosure />
        <div className="frame-heading"><FileQuestion /><div><strong>Practice exam</strong><span>Use the topics you are studying</span></div></div>
        <div className="preview-field">Difficulty<span>Medium</span></div>
        <div className="preview-field">Questions<span>20</span></div>
        <div className="preview-field">Time limit<span>10 minutes</span></div>
        <div className="preview-button">Start practice exam</div>
      </section>
      <section className="product-frame light-frame">
        <PreviewDisclosure />
        <div className="frame-heading"><MessageSquareText /><div><strong>Voice mock interview</strong><span>Practice realistic interview rounds</span></div></div>
        <div className="preview-field">Interview focus<span>Role-specific</span></div>
        <div className="preview-field">Question delivery<span>Read aloud</span></div>
        <div className="preview-field">Session<span>Saved to Interview Data</span></div>
        <div className="preview-button">Start voice interview</div>
      </section>
    </div>
  );
}

function ReadinessPreview() {
  return (
    <div className="readiness-preview product-frame" aria-label="Example preparation progress and upcoming work">
      <PreviewDisclosure />
      <section>
        <div className="frame-heading"><Activity /><div><strong>Progress</strong><span>Work completed for this job</span></div></div>
        <div className="progress-row"><span>Plan tasks</span><i><b style={{ width: "72%" }} /></i></div>
        <div className="progress-row"><span>Notes studied</span><i><b style={{ width: "58%" }} /></i></div>
        <div className="progress-row"><span>Practice completed</span><i><b style={{ width: "44%" }} /></i></div>
      </section>
      <section>
        <div className="frame-heading"><BarChart3 /><div><strong>Needs work</strong><span>Topics to review next</span></div></div>
        <ul className="topic-list"><li>Role knowledge</li><li>Technical examples</li><li>Behavioral stories</li></ul>
      </section>
      <section>
        <div className="frame-heading"><Clock3 /><div><strong>Coming up</strong><span>Your next preparation work</span></div></div>
        <div className="upcoming-item"><b>Today</b><span>Complete study notes</span></div>
        <div className="upcoming-item"><b>Next</b><span>Take a focused exam</span></div>
        <div className="upcoming-item"><b>Later</b><span>Run a voice mock interview</span></div>
      </section>
    </div>
  );
}

function ExtensionPreview() {
  return (
    <div className="extension-preview product-frame light-frame" aria-label="Chrome extension saving a job to PrepInterview AI">
      <PreviewDisclosure />
      <div className="browser-bar"><span /><span /><span /><b>careers.company.com/job</b></div>
      <div className="job-page-preview"><strong>Open role</strong><span>Company · Location</span><i /><i /><i /></div>
      <div className="capture-panel"><BrandMark /><strong>Save to PrepInterview AI</strong><p>Carry this job into your preparation workspace.</p><button type="button">Save job</button><a href="https://github.com/Shashankpabitwar123/interviewPrep_AI/tree/main/browser-extension" target="_blank" rel="noreferrer">Extension setup <ExternalLink /></a></div>
    </div>
  );
}

function MarketingLanding({ onStart, onSignIn, workspaceMode = false, onReturn }) {
  const returnToWorkspace = onReturn || onSignIn;

  return (
    <div className={`marketing-page clarity-homepage ${workspaceMode ? "marketing-workspace-preview" : ""}`}>
      <header className="marketing-nav" aria-label="Public navigation">
        <a className="marketing-brand" href="#top" aria-label="PrepInterview AI home"><BrandMark /><span>PrepInterview AI</span></a>
        <nav aria-label="Homepage sections">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#extension">Chrome extension</a>
          <a href="#faq">FAQ</a>
        </nav>
        <details className="mobile-nav-menu">
          <summary aria-label="Open navigation menu"><Menu aria-hidden="true" /></summary>
          <div className="mobile-nav-panel">
            <a href="#how-it-works" onClick={closeMobileMenu}>How it works</a>
            <a href="#features" onClick={closeMobileMenu}>Features</a>
            <a href="#extension" onClick={closeMobileMenu}>Chrome extension</a>
            <a href="#faq" onClick={closeMobileMenu}>FAQ</a>
            <button type="button" onClick={(event) => {
              closeMobileMenu(event);
              if (workspaceMode) returnToWorkspace();
              else onSignIn();
            }}>
              {workspaceMode ? "Back to workspace" : "Sign in"}
            </button>
          </div>
        </details>
        <div className="marketing-nav-actions">
          {workspaceMode ? (
            <button type="button" className="primary-action compact" onClick={returnToWorkspace}>Back to workspace</button>
          ) : (
            <>
              <button type="button" className="text-action" onClick={onSignIn}>Sign in</button>
              <button type="button" className="primary-action compact" onClick={onStart}>Start preparing</button>
            </>
          )}
        </div>
      </header>

      <main id="top">
        <section className="clarity-hero" aria-labelledby="marketing-title">
          <div className="hero-copy">
            <h1 id="marketing-title">Prepare for your interview with a plan built from the job.</h1>
            <p>Paste a job description or URL. PrepInterview AI turns it into a personalized plan, study notes, practice exams, and voice mock interviews.</p>
            <div className="hero-actions">
              <button type="button" className="primary-action" onClick={workspaceMode ? returnToWorkspace : onStart}>
                {workspaceMode ? "Back to my workspace" : "Create my prep plan"}
              </button>
              <a className="secondary-action" href="#how-it-works">See how it works <ArrowIcon /></a>
            </div>
          </div>
          <HeroProductPreview />
        </section>

        <WorkflowBand />

        <section id="features" className="story-section dark-section" aria-labelledby="analysis-heading">
          <div className="section-copy">
            <h2 id="analysis-heading">Understand what the employer is looking for</h2>
            <p>Analyze the job description before you start studying. PrepInterview AI organizes the requirements, responsibilities, interview signals, and topics you should prepare.</p>
          </div>
          <JobAnalysisPreview />
        </section>

        <section id="plan" className="story-section light-section" aria-labelledby="plan-heading">
          <div className="section-copy">
            <h2 id="plan-heading">Know what to prepare each day</h2>
            <p>Set your interview date and available study time. Your plan distributes learning, practice, and review across the time you actually have.</p>
          </div>
          <PlanPreview />
        </section>

        <section id="notes" className="story-section dark-section" aria-labelledby="notes-heading">
          <div className="section-copy">
            <h2 id="notes-heading">Learn the topics that matter for this role</h2>
            <p>Study structured notes with practical examples, interview explanations, common mistakes, and saved Ask AI conversations.</p>
          </div>
          <NotesPreview />
        </section>

        <section id="practice" className="story-section light-section" aria-labelledby="practice-heading">
          <div className="section-copy">
            <h2 id="practice-heading">Practice before the real interview</h2>
            <p>Take configurable exams and complete voice mock interviews based on the role and the preparation topics you selected.</p>
          </div>
          <PracticePreview />
        </section>

        <section id="readiness" className="story-section dark-section" aria-labelledby="readiness-heading">
          <div className="section-copy">
            <h2 id="readiness-heading">See what is done and what needs work</h2>
            <p>Review completed tasks, preparation gaps, upcoming work, calendar activity, and study consistency without losing the job context.</p>
          </div>
          <ReadinessPreview />
        </section>

        <section id="extension" className="story-section light-section extension-section" aria-labelledby="extension-heading">
          <div className="section-copy">
            <h2 id="extension-heading">Save a job while you are viewing it</h2>
            <p>The Chrome extension can capture supported job details or save the current URL. Manual paste and URL entry remain available whenever a site blocks automatic capture.</p>
            <a className="inline-link" href="https://github.com/Shashankpabitwar123/interviewPrep_AI/tree/main/browser-extension" target="_blank" rel="noreferrer">View extension setup <ExternalLink /></a>
          </div>
          <ExtensionPreview />
        </section>

        <section id="workspace" className="workspace-band" aria-labelledby="workspace-heading">
          <div><h2 id="workspace-heading">Keep every job and preparation activity together</h2><p>Saved jobs, plans, notes, exams, interviews, and calendar items stay organized in one account-based workspace.</p></div>
          <div className="workspace-tools">
            {WORKSPACE_TOOLS.map(([Icon, label]) => <div key={label}><Icon aria-hidden="true" /><strong>{label}</strong></div>)}
          </div>
        </section>

        <section id="faq" className="trust-faq" aria-labelledby="faq-heading">
          <div className="trust-strip">
            <ShieldCheck aria-hidden="true" />
            <div><h2>Your preparation stays in your account</h2><p>Sign in to keep your jobs, plans, notes, exams, interviews, and calendar work associated with you.</p></div>
            <ul><li><Database />Account-based records</li><li><Link />Job-connected workspace</li><li><ShieldCheck />Account controls</li></ul>
          </div>
          <div className="faq-layout">
            <h2 id="faq-heading">Common questions</h2>
            <div className="faq-list">
              {FAQS.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}<ChevronDown aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-heading">
          <div><h2 id="final-heading">Start preparing for your next interview</h2><p>Bring the job description. PrepInterview AI will help you organize what to learn, practice, and review.</p></div>
          <div>
            <button type="button" className="primary-action light-action" onClick={workspaceMode ? returnToWorkspace : onStart}>
              {workspaceMode ? "Return to workspace" : "Create my prep plan"}
            </button>
            {!workspaceMode && <button type="button" className="secondary-action coral-secondary" onClick={onSignIn}>Sign in</button>}
          </div>
        </section>
      </main>

      <footer className="marketing-footer">
        <a className="marketing-brand" href="#top"><BrandMark /><span>PrepInterview AI</span></a>
        <p>Job-specific preparation from one connected workspace.</p>
        <button type="button" onClick={workspaceMode ? returnToWorkspace : onSignIn}>{workspaceMode ? "Back to workspace" : "Sign in"}</button>
      </footer>
    </div>
  );
}

export default MarketingLanding;
