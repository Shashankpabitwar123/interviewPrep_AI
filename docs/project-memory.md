# PrepInterview AI Project Memory

Last updated: June 21, 2026

This is the source-of-truth handoff for future Codex chats working on PrepInterview AI. Read this before making changes.

## Identity

- Product name in code/UI history: InterviewPrep AI, PrepInterview AI.
- Current public domain: https://prepinterviewai.com
- Previous/secondary Vercel domain: https://interview-prep-ai-sable.vercel.app
- GitHub repo: https://github.com/Shashankpabitwar123/interviewPrep_AI.git
- Local project root: `/Users/shashankpabitwar/Downloads/InterviewPrep AI`
- Founder/developer: Shashank Pabitwar.

PrepInterview AI is a live AI interview-preparation platform. Users paste a job description or URL, save jobs, generate day-by-day AI prep plans, study AI notes, take role-specific exams, run mock interviews, track progress, view calendar events, and capture jobs from external websites with a Chrome extension bubble.

The product is no longer just a prototype. Treat changes as production work.

## Production Services

- Frontend: Vercel project `interview-prep-ai`.
- Backend: Render web service `interviewprep-ai-api`.
- Backend URL: `https://interviewprep-ai-api.onrender.com`
- Database: Neon PostgreSQL.
- Email/OTP provider: Resend.
- Verified email domain: `prepinterviewai.com`.
- Main AI provider: OpenAI.
- Web research provider: Tavily.
- Gemini was explored earlier but is not the active dependency for production.

Keep secrets out of code. API keys belong only in local env vars or Render/Vercel dashboard env vars.

## Repository Layout

```text
InterviewPrep AI/
  backend/             FastAPI backend, SQLAlchemy models, routers, services, tests
  frontend/            React/Vite frontend, currently concentrated in src/main.jsx and src/styles.css
  browser-extension/   Chrome WebExtension capture bubble
  docs/                project notes, deployment docs, handoff docs
  tools/               helper scripts used during documentation work
  render.yaml          Render blueprint for backend
  RUN_LOCALLY.md       local setup commands
```

Backend reading order:

1. `backend/app/main.py`
2. `backend/app/config.py`
3. `backend/app/database.py`
4. `backend/app/models/interview.py`
5. `backend/app/routers/auth.py`
6. `backend/app/routers/jobs.py`
7. `backend/app/routers/prep_plans.py`
8. `backend/app/routers/study_notes.py`
9. `backend/app/routers/exams.py`
10. `backend/app/routers/mock_interviews.py`
11. `backend/app/routers/experiences.py`
12. `backend/app/services/job_analyzer.py`
13. `backend/app/services/planner.py`
14. `backend/app/services/study_note_service.py`
15. `backend/app/services/exam_service.py`
16. `backend/app/services/mock_interview_service.py`
17. `backend/app/services/research_service.py`
18. `backend/app/services/email_service.py`
19. `backend/app/services/auth_service.py`
20. `backend/tests`

Frontend reading order:

1. `frontend/src/main.jsx`
2. `frontend/src/styles.css`
3. `frontend/package.json`
4. `frontend/vercel.json`

Extension reading order:

1. `browser-extension/manifest.json`
2. `browser-extension/background.js`
3. `browser-extension/content.js`
4. `browser-extension/content.css`
5. `browser-extension/popup.html`
6. `browser-extension/popup.js`
7. `browser-extension/popup.css`
8. `browser-extension/README.md`

## Local Development Commands

Backend:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If dependencies need reinstalling:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
pip install -e ".[dev]"
```

Frontend:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/frontend"
npm install
npm run dev
```

Frontend usually opens at `http://127.0.0.1:5173`, sometimes `http://127.0.0.1:5174` if 5173 is busy.

Backend docs:

```text
http://127.0.0.1:8000/docs
```

Run backend tests:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
pytest
```

Build frontend:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/frontend"
npm run build
```

Chrome extension local install:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Load unpacked.
4. Select `/Users/shashankpabitwar/Downloads/InterviewPrep AI/browser-extension`.
5. Pin the extension.
6. Login on the website.
7. In website Settings, enable the hovering extension bubble.

## Environment Variables

Backend production on Render:

```text
APP_ENV=production
REQUIRE_AUTH=true
DATABASE_URL=<Neon PostgreSQL URL>
FRONTEND_ORIGINS=https://prepinterviewai.com,https://interview-prep-ai-sable.vercel.app
AUTH_SECRET_KEY=<long random secret>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-4o-mini
TAVILY_API_KEY=<secret>
EMAIL_PROVIDER=resend
RESEND_API_KEY=<secret>
EMAIL_FROM=InterviewPrep AI <onboarding@prepinterviewai.com>
REGISTRATION_OTP_REQUIRED=true
EMAIL_OTP_DEV_MODE=false
EMAIL_OTP_EXPIRE_MINUTES=10
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
EMAIL_OTP_HOURLY_LIMIT=5
```

Frontend production on Vercel:

```text
VITE_API_URL=https://interviewprep-ai-api.onrender.com
```

Local env vars are per terminal session unless placed in a `.env`, shell profile, or exported again.

## Current Product Features

### Dashboard

- Starts blank for a new user or guest. Do not show sample saved jobs or fake recent activity for new users.
- Create prep plan from pasted description or job URL.
- Job title and company can be left blank; AI should infer both from the full description.
- Date picker should not allow dates before today.
- Current date should be highlighted in interview-date calendar UI.
- Save Job stores the job without generating a plan.
- Generate Prep Plan creates a saved job and prep plan.
- Saved Jobs panel can load jobs into the form and should switch the visible prep plan when one exists.
- Recent Activity should reflect real user actions.
- Backend status indicator should be a simple green/red mark, not a big “Backend Connected” pill.

### Jobs

- Saved jobs support manual add, job URL, description, company/title, and subtle unique job color dots.
- Job colors should follow related plans, exams, mock interviews, and calendar events.
- Jobs support single delete, bulk delete, and restore from the Settings bin.
- Deleted jobs bin keeps the last 10 deletes.
- Removing a job should keep user experience coherent and avoid orphaned UI state.
- Each saved job can open an AI-generated job description review.
- Description reviews must be saved and not regenerated every time.
- Description review should be carefully structured per job:
  - company/title summary
  - requirements
  - responsibilities
  - what they are really looking for
  - interview signals
  - likely screen/interview focus
  - must-prepare topics
  - questions to ask the interviewer
  - red flags or unknowns
- Ask AI inside job description should allow repeated questions, stack Q&A history, persist after reopening, and answer based on that job description with enough detail.

### Prep Plans

- AI-generated from the job description and days until interview.
- Local fallback should be off by default for quality. Settings includes “use local fallback if AI is not responding.”
- If fallback is off and AI fails, return a clear error instead of low-quality local content.
- Each day should have 2-3 study-note tasks and a practice exam as the final task.
- Practice exam for a day must use only that day’s notes/topics.
- Full prep plan page should show limited day cards and allow horizontal scroll without widening the full page.
- Dashboard prep plan cards should not use arrow buttons; direct click/scroll is enough.
- Day selection and task cards should stay in sync: clicking a day highlights its task card, and scrolling/clicking task cards should keep the selected day correct.
- Saved prep plans should load by clicking the plan, not by a separate load button.

### Notes

- Notes are core. Quality matters.
- Notes should be strong interview-preparation material, not shallow bullet points.
- Generated notes should include:
  - title and topic
  - what to understand
  - why the topic matters for this job
  - key ideas
  - examples
  - how to explain it in an interview
  - common mistakes
  - deeper/in-depth explanation
  - related topics and resource/search links
  - before-the-exam checklist
- Tavily may enrich notes with search/research, but notes must not fail if Tavily fails.
- Ask AI inside notes uses OpenAI and should allow multiple questions, stack Q&A, persist Q&A, and answer in enough detail.
- Once a note is generated, the corresponding task button should say Open instead of Start.
- Generated notes must be saved. Reopening should not regenerate.
- Mark Done should be idempotent: clicking Mark Done again should not uncheck completion. Only the manual checkbox should undo completion.
- Notes tab is a professional notes workspace:
  - job-first navigation
  - collapsible VS Code-like tree
  - job title with dropdown arrow
  - folder-plus and note-plus icons near job/folder
  - hover shows small bin icon
  - folder delete also deletes notes inside, with confirmation
  - note delete asks confirmation
  - click a note to open an editor on the right
  - note editor supports color tag, writing/editing, autosave, AI improve/organize
  - no “Quick Notes” category

### Exams

- Exams are one of the most important parts of the product.
- Exam generation should be thoughtful and high quality.
- If generated from a day, questions are based only on that day’s notes/topics.
- If generated from Exams tab, use all relevant selected job/prep plan topics.
- Difficulty presets:
  - Easy: 10 questions, 5 minutes
  - Medium: 20 questions, 10 minutes
  - Hard: 40 questions, 30 minutes
- User can modify question count, time, topics, and question types for that specific exam.
- AI should choose question types that fit the job:
  - MCQ
  - one word
  - one line
  - short answer
  - multi-select
  - coding/fill-in/code reasoning
  - explanation questions for theory-heavy roles
- Exam-taking UI is a large real-exam modal:
  - timer
  - question navigator
  - previous/next
  - submit exam button
  - answered questions marked green
  - clean readable options in dark and light mode
- Scores must be calculated against all questions. Unanswered questions count as wrong/incomplete, so answering one question cannot produce 100% for a 20-question exam.
- Submit should show a loading/submitting animation.
- Main exam page should show score and status only. Correct answers/expected answers belong in Review.
- Review should show user answer, correct/expected answer, feedback, and exit option.
- Exams and reviews must sync with dark mode.
- Each attempt card should have a small bin icon with confirmation.

### Mock Interviews

- Mock interviews should start from Exams/attempts flow, not directly inside dashboard prep plan.
- Real interview-like modal:
  - auto reads questions aloud
  - mute toggle
  - timer/random time per question by difficulty
  - sections such as behavioral, technical, team problem solving, role-specific scenarios
  - generated from job description
  - user can exit midway
  - partial scoring if exited early
  - review available later
- Submit/exit returns user to Exams section, not directly into review.
- Attempt cards should have delete confirmation.

### Calendar

- Google Calendar-like month/year view.
- Calendar must persist after refresh.
- Events can include prep tasks, notes, exams, mock interviews, real interviews.
- Clicking a date with events opens a popup listing those events and actions.
- User can add/edit/delete events, add colors, mark actual interview dates, and add Zoom/Google Meet links.
- Job-related events should use the job’s subtle color.

### Progress

- Progress section must be live and functional, not dummy UI.
- It should have an uncluttered flow: basics first, expandable details.
- It should support multiple prep plans and overall performance.
- Show:
  - overall readiness formula
  - per-plan readiness
  - completed notes
  - completed tasks
  - exam scores
  - mock interview scores
  - streak consistency
  - upcoming risk areas
  - recent improvements
  - weak topics
- Formula should be grounded in real state rather than fixed 10%.
- The text “Selected notes” was changed conceptually to “Completed notes.”

### Analytics

- Analytics should no longer be a dead placeholder if it is being actively developed.
- It should summarize real app behavior:
  - plans generated
  - notes completed
  - exams taken
  - score trends
  - mock interview progress
  - active days/streak
  - role/topic distribution
  - time-to-interview preparedness.
- If a portion is still incomplete, say “still in development” cleanly and visibly in both themes.

### Interview Data

This section is intended to collect real interview knowledge over time:

- company
- role
- interview round
- topics asked
- actual questions
- difficulty
- notes
- outcome/lessons
- source/user contribution

Future AI should use this data to make prep plans, questions, notes, and mock interviews better. Keep this data user-safe and avoid exposing one user’s private data to another.

### Settings

- Opens as a professional popover near the lower-left Settings button, not as a full page.
- Must not overlap dashboard fields; settings popover needs correct z-index/backdrop/positioning.
- Can close by X, Settings button again, Escape/click outside.
- Includes:
  - account info
  - dark mode toggle
  - generation sound volume slider/test
  - hovering extension toggle
  - local fallback toggle
  - deleted jobs bin/recover last 10
  - delete account with confirmation
  - Know More button
- Dark mode toggle should visually switch on/off clearly.
- Extension bubble toggle should turn green/on when enabled.

### Dark Mode

- Premium dark dashboard style inspired by dark SaaS dashboards.
- Avoid large white boxes in dark mode.
- Cards/inputs/modals should use deep navy/blue surfaces, readable borders, white or soft-blue text.
- Fix all low-contrast text:
  - headings
  - note editor
  - recent activity
  - calendar
  - progress rings
  - analytics placeholder text
  - exam and mock interview modals
  - login/create-account buttons
  - import notes button.
- Do a whole-page color sweep after dark mode changes.

### Know More Page

- Should feel like a professional product website, not a bullet list.
- Explain:
  - what PrepInterview AI is
  - founder story/why it exists
  - job capture flow
  - AI prep planning
  - notes
  - exams
  - mock interviews
  - calendar/progress/analytics
  - browser bubble extension
  - privacy/security idea
  - future roadmap.
- Use refined sections, visual hierarchy, and subtle animation if suitable.

### Browser Extension Bubble

- The extension is a major product feature.
- Chrome is primary. Safari WebExtension support is future work requiring Xcode conversion/signing.
- Website Settings has “Hovering extension”/capture bubble toggle.
- Professional install flow:
  - if extension not installed: show Install Extension/guide
  - if installed: show Bubble On/Off
  - extension syncs website login token.
- Bubble should appear immediately when enabled, including on PrepInterview AI itself, not only external job sites.
- Bubble is draggable and uses the same brain/logo icon as the website.
- Clicking anywhere on bubble opens sub-functions.
- Hover should open sub-functions; leaving closes them.
- Clicking bubble again or clicking outside closes sub-functions.
- Sub-functions should open smoothly in a half-circle around the bubble without overlapping.
- Current desired actions:
  - Paste manually
  - Auto copy description
  - Copy URL
- “Copy selected text” was unreliable on Handshake/protected sites and should not be the primary path.
- Paste manually opens a text box.
- Auto copy tries visible job description extraction.
- Copy URL fills the textbox/current URL and should only show Save URL, not Generate Plan.
- Textbox/panel moves with the bubble when dragged.
- If job description text is saved/generated through bubble, backend should receive exactly that text and AI should infer job title/company.
- After Save Job or Generate Prep Plan, sub-functions close and show a success message. Generation sound should play.
- Extension actions should update app state/recent activity without forcing manual refresh where possible.
- Some sites block DOM scraping or selection; manual paste and URL save are expected fallback paths.

### Auth And OTP

- Accounts use token/session auth with JWT/bearer token.
- Registration has password criteria: at least 8 characters, letter, number.
- Create account should not have Shashank prefilled.
- Gmail-style OTP was requested, implemented with email verification flow using Resend rather than direct Gmail.
- Resend domain `prepinterviewai.com` was purchased/configured through Vercel and verified in Resend.
- Use from address similar to `InterviewPrep AI <onboarding@prepinterviewai.com>`.
- OTP should work for all users after Resend production sender/domain config is verified and Render env vars are correct.
- OTP should be rate-limited:
  - expiry about 10 minutes
  - resend cooldown about 60 seconds
  - hourly limit around 5
- Account deletion exists in settings with confirmation. It previously had 405/failed fetch bugs; fixes included supporting the request shape expected by frontend and deployment to Render.

## Design Standards From Shashank

- Build like a senior software engineer and designer.
- Prefer real working functionality over dummy UI.
- Keep UI professional, polished, and minimal.
- Avoid clutter: show basics first, use expandable details for depth.
- Use soft transitions, sharp icons, and refined spacing.
- Dark mode must be complete, not half-done.
- Make features resilient: if Tavily fails, notes should still work if OpenAI can answer.
- Avoid “local fallback” quality unless the user explicitly enables it.
- Keep code readable with simple comments, because Shashank reviews code manually.
- For bug fixes, check the whole affected flow, not only the single button.

## Deployment Workflow

Typical flow for production changes:

1. Inspect local code and current git state.
2. Make scoped edits.
3. Run backend tests where backend changed.
4. Run frontend build where frontend changed.
5. Commit and push to GitHub main.
6. Vercel should deploy frontend automatically.
7. Render should deploy backend from GitHub/Blueprint; if not, trigger Render manual deploy.
8. Verify:
   - `https://prepinterviewai.com`
   - backend `/health`
   - create/login/account flow
   - save job
   - generate prep plan
   - generate note
   - ask note AI
   - generate/submit exam
   - open job description
   - extension bubble if relevant.

Use Render/Vercel/Neon plugins when available. If a plugin is not callable, guide Shashank through the UI clearly.

## Known Sensitive Areas

- Do not print or commit API keys.
- Do not rely on sample jobs for real users.
- AI company detection has been a recurring problem. Prefer giving full text to OpenAI with explicit structured JSON extraction for title/company rather than brittle regex-only parsing.
- Job description brief generation has had 503 failures when AI/local fallback policy was strict. Fix the AI path instead of silently downgrading quality unless user enables fallback.
- Note Ask AI and job-description Ask AI should preserve conversation history.
- Bubble extension must keep content script, popup, and background behavior consistent; avoid fixing only the website-injected bubble.
- Dark mode regressions are common. Check all modals and panels.
- Exam score calculation must count unanswered questions.
- Calendar persistence broke once on refresh; preserve source-of-truth state.

## Resume/Positioning Context

This project is also a portfolio/resume centerpiece. The resume wording positions it as:

- `PrepInterview AI | prepinterviewai.com`
- Founder-built AI platform for converting job descriptions and URLs into personalized prep plans, notes, exams, mock interviews, progress analytics, and calendar workflows.
- Stack includes React/Vite, FastAPI, PostgreSQL/Neon, SQLAlchemy, Alembic, JWT auth, OpenAI API, Tavily API, Resend, Vercel, Render.

## Future Chat Instruction

If a future Codex chat is asked to work on PrepInterview AI:

1. Open this file first.
2. Open `README.md` and `RUN_LOCALLY.md`.
3. Inspect current git status.
4. Read the specific frontend/backend/extension files for the requested feature.
5. Do not assume old implementation details are still true; verify locally.
6. Implement, test/build, and summarize exactly what changed.
