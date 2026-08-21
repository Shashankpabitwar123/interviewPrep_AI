# Job identity selector design QA

- Source visual truth: `/var/folders/cm/gk1zyspd5gddzb07hjj31v_40000gn/T/TemporaryItems/NSIRD_screencaptureui_bnM4vv/Screenshot 2026-08-20 at 10.08.18 PM.png`
- Implementation screenshot: `/tmp/prepinterview-job-selector-page-desktop.png`
- Responsive screenshot: `/tmp/prepinterview-job-selector-mobile.png`
- Desktop viewport: 1280 x 720 CSS pixels
- Mobile viewport: 390 x 844 CSS pixels
- Source pixels: 2504 x 216; treated as a high-density capture representing approximately 1252 x 108 CSS pixels
- Implementation pixels: 1280 x 720 at the browser viewport density; active context row measured 1220 x 76 CSS pixels
- State: authenticated Today page with one selected job; switch-job menu also tested expanded

## Full-view comparison evidence

The source showed the role, company, and browser sign-in text merged into one large title. The implementation shows the role as the primary line, the company as a separate secondary line, and interview timing as a third line. The surrounding card shape, dark surface, coral icon/accent, dropdown affordance, and adjacent Add a job action remain consistent with the existing product.

## Focused-region comparison evidence

The source image contains only the target context row, so a second crop was not needed. The browser DOM independently confirmed three semantic text nodes in the control: `Junior Data Analyst`, `Morgan Stanley`, and `Interview August 30 · 10 days away`. The expanded menu preserved separate role and company lines.

## Required fidelity surfaces

- Fonts and typography: Public Sans hierarchy remains consistent; role uses the strongest weight, company is distinct but subordinate, and timing is smaller without losing contrast.
- Spacing and layout rhythm: three lines fit without clipping at desktop and 390 px mobile; the adjacent action remains aligned and reachable.
- Colors and tokens: existing approved canvas, surface, line, text, soft-text, muted-text, and coral tokens are reused.
- Image and icon fidelity: the existing Lucide briefcase, chevron, and plus icons are preserved; no placeholder or fabricated asset was introduced.
- Copy and content: role, company, and interview timing are no longer concatenated. Unknown company state uses the explicit copy `Company not detected` rather than a fabricated employer.

## Findings and comparison history

- Earlier P1: browser chrome could appear inside the role title, making the selected job unreadable. Fixed with backend identity sanitization plus a defensive display normalizer. Post-fix browser evidence shows only the role in the title line.
- Earlier P2: role and company were combined into one truncated line. Fixed with separate semantic lines and responsive spacing. Post-fix desktop and mobile captures show no clipping or overlap.
- No remaining P0, P1, or P2 visual findings.
- P3 follow-up: a later iteration could add an inline correction action when identity confidence is low, but it is not required for the requested readable card.

## Interaction and runtime checks

- Page identity and meaningful content passed.
- Switch-job control expanded and exposed the saved job without navigation or layout shift.
- Desktop and mobile states passed.
- Browser console contained no errors or warnings during the checked flow.

final result: passed
