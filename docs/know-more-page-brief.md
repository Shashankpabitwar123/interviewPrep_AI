# PrepInterview AI Know More Page Brief

## Product Identity

PrepInterview AI is a live AI interview-preparation platform built by Shashank Pabitwar. The product helps a candidate turn a job description or job URL into a complete preparation system: saved jobs, AI-generated prep plans, deep study notes, practice exams, mock interviews, calendar events, progress analytics, and a browser capture bubble.

Primary website: https://prepinterviewai.com  
Backend API: https://interviewprep-ai-api.onrender.com  
Repository: https://github.com/Shashankpabitwar123/interviewPrep_AI

## Core Story

Most candidates save job posts in scattered tabs, notes, screenshots, and reminders. PrepInterview AI turns that messy process into one workflow. A user captures a role, the system reads the job carefully, extracts the role requirements, builds a multi-day prep plan, teaches the daily topics, tests the user with exams, simulates interviews, and tracks readiness until interview day.

The Know More page should feel like a premium product website, not a generic feature list. It should explain the product as a complete interview-preparation operating system.

## Main Audience

- Computer science students applying to internships or new-grad roles.
- Early-career professionals preparing for technical and behavioral interviews.
- Users who save jobs from Handshake, LinkedIn, company career pages, and job boards.
- Candidates who want a structured plan instead of randomly studying topics.

## Suggested Hero Copy

Headline:
Prepare for every interview like the job description was written into your study plan.

Subheadline:
PrepInterview AI reads job posts, builds daily prep plans, generates study notes, creates role-specific exams, simulates mock interviews, and tracks your readiness until interview day.

Primary CTA:
Start preparing

Secondary CTA:
See how it works

Trust line:
Built with React, FastAPI, PostgreSQL, OpenAI, Tavily, Resend, Vercel, Render, and a Chrome capture extension.

## User Flow To Explain

1. Capture a role
   - Paste a job description, paste a job URL, save manually, or use the browser bubble on another website.
   - AI detects job title, company, responsibilities, requirements, interview signals, and must-prepare topics.

2. Generate a plan
   - User adds the interview date and hours per day.
   - AI creates a day-by-day plan from today until the interview.
   - Each day includes study notes and a practice exam.

3. Study with context
   - Notes explain what to understand, why it matters for the job, how to explain it in an interview, mistakes to avoid, and deeper material.
   - Ask AI lets users ask follow-up questions about the note or job.

4. Test readiness
   - Exams can be easy, medium, hard, or custom.
   - Daily exams focus only on the notes for that day.
   - Full exams can cover the complete plan.
   - Review explains correct answers, expected answers, and improvement areas.

5. Practice speaking
   - Mock interviews include technical, behavioral, team problem-solving, and role-specific sections.
   - Questions can be read aloud.
   - Feedback and score are saved for review.

6. Track progress
   - Dashboard, calendar, progress page, analytics, and recent activity show what the user has done and what remains.

## Feature Sections

### AI Job Understanding

The app does more than store a job post. It analyzes the full job description and creates a structured brief with:

- Job title and company.
- Role summary.
- Requirements.
- Responsibilities.
- What the company is really looking for.
- Interview signals.
- Must-prepare topics.
- Questions to ask the interviewer.
- Unknowns or red flags.

Design idea:
Show a job post transforming into clean AI cards. Use a soft scanning animation that highlights keywords and sends them into a structured brief.

### Personalized Prep Plans

Prep plans are generated based on interview date, time available, job requirements, and extracted topics. The plan should feel like a timeline from today to interview day.

Design idea:
Horizontal timeline cards with day nodes. As the page scrolls, the timeline fills with blue progress, and daily tasks animate into place.

### Deep Study Notes

Each note should feel like an interview coach wrote it for that specific role. Notes explain the topic, connect it to the job, provide examples, teach how to speak about it, and suggest deeper study paths.

Design idea:
Use a split section: a note editor on one side and an AI explanation panel on the other. Animate sections such as "What to understand", "How to explain it", and "Before the exam" sliding into view.

### Role-Specific Exams

Exams are adaptive. Easy, medium, and hard modes change question count, time, depth, and question types. AI chooses question formats based on the role: coding, MCQ, short answer, one-word, explanation, or scenario-based.

Design idea:
Show an exam interface with a timer, question navigator, answer states, and a review score card. Keep it clean and intense, like a real assessment.

### Mock Interviews

Mock interviews simulate an interviewer. Questions can be read aloud, and the user can answer one question at a time. The system grades responses and provides feedback.

Design idea:
Use a conversational stage: interviewer card, user response card, voice pulse, mute button, timer, and a final feedback report.

### Calendar And Progress

The calendar turns prep plans into scheduled events. Progress shows readiness, completed notes, exams, mock interviews, scores, streaks, and recent work.

Design idea:
Use a calendar grid with subtle colored dots matching job colors. Use animated progress rings and small trend charts.

### Browser Capture Bubble

The Chrome extension adds a floating PrepInterview AI bubble on job websites. Users can capture visible content, paste manually, copy URL, save a job, or generate a prep plan without leaving the page.

Design idea:
Show a floating bubble with the brain logo. On hover, menu actions open in a half circle with smooth motion. After saving, a small success toast appears.

### Account And Developer Operations

The platform includes account creation, login, email OTP verification, per-user data, and a developer dashboard for monitoring accounts, usage, blocking users, deleting users, and reviewing token usage.

Design idea:
Use a secure operations section with account cards, token usage charts, status badges, and admin controls.

## Brand And Visual Direction

### Light Theme

The light theme should feel clean, calm, and work-focused.

Suggested colors:

- Primary blue: #1677ff
- Deep blue: #2563eb
- Text navy: #101828
- Muted text: #667085
- Light background: #f4f7fb
- Card background: #ffffff
- Border: #d7e0ee
- Success green: #22c55e
- Warning amber: #f59e0b
- Danger red: #ef4444

Style:

- White or very light blue panels.
- 8px border radius for app cards.
- Clean Lucide-style line icons.
- Subtle shadows, not heavy glass effects.

### Premium Dark Theme

The dark theme should feel like a premium AI workspace.

Suggested colors:

- Page background: #050914
- Main panel: #0b1424
- Elevated panel: #111b32
- Border: #22304f
- Bright blue: #1677ff
- Electric blue: #0a84ff
- Text: #f8fafc
- Muted text: #a8b3cf
- Success green: #22c55e
- Danger red: #ef4444
- Soft purple accent: #6d5dfc

Style:

- No large white boxes in dark mode.
- Cards should use dark navy/blue shades.
- Inputs should be dark with visible borders.
- Text contrast must stay high.
- Use subtle blue glow only for important active states.

## Animation Direction

Use subtle, polished animations:

- Hero background: slow moving grid or gradient light, not distracting.
- Job capture: text scan line moving down a job card.
- Plan generation: nodes appearing one by one on a timeline.
- Notes: sections reveal with slight upward motion.
- Exam: timer and answer progress animate smoothly.
- Mock interview: voice wave pulses when reading questions.
- Calendar: events fade into date cells.
- Progress: readiness ring counts up.
- Browser bubble: spring-like radial menu opening around the bubble.

Avoid:

- Overly playful cartoon graphics.
- Too many gradients.
- Large decorative blobs.
- Animations that fight readability.

## Page Structure For Know More

1. Hero: product promise, CTA, animated dashboard preview.
2. Problem: job prep is scattered and generic.
3. Solution: one workflow from job post to interview readiness.
4. Capture section: paste, URL, saved jobs, extension bubble.
5. AI analysis section: job brief and role extraction.
6. Prep plan section: daily plan until interview day.
7. Study notes section: deep AI notes and Ask AI.
8. Exams section: adaptive tests and review.
9. Mock interview section: realistic interview practice.
10. Progress and calendar section: readiness over time.
11. Security/account section: per-user workspace and OTP login.
12. Tech credibility section: stack and production deployment.
13. Final CTA: start preparing at prepinterviewai.com.

## Text Material For Feature Cards

Capture jobs instantly:
Save a role from a job board, pasted description, URL, or browser bubble. PrepInterview AI keeps the job, company, description, and preparation workflow together.

Understand what matters:
AI extracts requirements, responsibilities, interview signals, must-prepare topics, and likely focus areas from the job description.

Plan every day:
Set your interview date and available hours. The platform builds a realistic preparation plan with notes and exams distributed across the remaining days.

Study smarter:
Generated notes explain each topic in interview language, with examples, mistakes to avoid, deeper explanations, and Ask AI support.

Practice under pressure:
Role-specific exams include MCQ, short-answer, coding, scenario, and explanation questions with review after submission.

Simulate the interview:
Mock interviews ask technical, behavioral, and problem-solving questions, read prompts aloud, and score your responses.

Track readiness:
Progress, calendar, recent activity, streaks, and analytics show what has been completed and what still needs attention.

## Image And Visual Asset Ideas

- Dashboard mockup showing Create Prep Plan, Saved Jobs, Prep Plan, Recent Activity.
- Job description analysis cards.
- AI notes modal with sections.
- Exam attempt modal with timer.
- Mock interview voice interface.
- Calendar with colored job events.
- Browser extension bubble on a job website.
- Developer dashboard usage monitoring for founder/admin story.

## Technical Foundation

Frontend:
React, Vite, JavaScript, CSS, Lucide icons.

Backend:
FastAPI, SQLAlchemy, Alembic, JWT authentication, bcrypt, PostgreSQL.

AI and data:
OpenAI for planning, notes, exams, mock interview feedback, job description analysis, and Ask AI. Tavily for research enrichment. Local fallback is optional and controlled from settings.

Production:
Frontend on Vercel, backend on Render, database on Neon PostgreSQL, OTP email through Resend with verified domain prepinterviewai.com.

Browser extension:
Chrome extension with content script, background script, popup, draggable bubble, and authenticated website connection.

## Tone

Confident, practical, and ambitious. The product should sound like it helps users prepare seriously for real interviews, not like a generic AI wrapper.

Use language such as:

- "Turn a job post into a preparation system."
- "Study what the role actually asks for."
- "Practice with questions shaped by the job description."
- "Track readiness until interview day."
- "Capture roles without breaking your flow."

Avoid language such as:

- "Magic."
- "Guaranteed job."
- "Perfect answers."
- "One-click success."

