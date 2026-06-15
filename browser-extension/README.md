# InterviewPrep AI Capture Extension

This browser extension adds a draggable InterviewPrep AI bubble to job pages so a logged-in user can capture a role without copy/pasting back into the dashboard.

## What Works

- **Website control**: InterviewPrep AI Settings can detect the installed extension and switch the capture bubble on or off.
- **Website session sync**: after a user logs into InterviewPrep AI, the website can connect that session to the extension.
- **Auto copy description**: click the bubble and let the extension detect visible job content.
- **Copy selected text**: highlight a job description, click the bubble, then choose selected text.
- **Copy URL**: use the current page URL when a site blocks page text capture.
- **Save Job / Generate Prep Plan**: use the panel buttons after capturing or pasting a description.
- **Immediate website preview**: the bubble can appear on InterviewPrep AI itself after the Settings toggle is switched on.
- **Account connection**: the popup login uses the same InterviewPrep AI account as the website.

## Chrome Install

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

```text
/Users/shashankpabitwar/Downloads/InterviewPrep AI/browser-extension
```

6. Pin the extension.
7. Open InterviewPrep AI and login.
8. Go to **Settings** and switch **Hovering extension** on.
9. Open a job page on Handshake, LinkedIn, or a company careers page.
10. Use the bubble to auto-copy the description, copy selected text, or copy the URL. Then save the job or generate the prep plan.

You can still click the extension icon directly if you want to edit API settings or login from the popup.

## Production Defaults

The extension points to the live services by default:

```text
Backend API: https://interviewprep-ai-api.onrender.com
Website URL: https://interview-prep-ai-sable.vercel.app
```

You can edit those in the extension popup if testing local services.

## Safari Support

Safari supports WebExtensions, but it requires conversion and signing through Xcode before it can be installed or distributed.

From the project root, run:

```bash
xcrun safari-web-extension-converter "/Users/shashankpabitwar/Downloads/InterviewPrep AI/browser-extension"
```

Then open the generated Xcode project, run it locally, and later sign it with an Apple Developer account for distribution. Chrome is the primary development target right now; Safari should be tested after conversion because a few extension APIs can behave slightly differently.

## Notes

- Some sites render job descriptions inside protected containers or iframes. In those cases, use selected text or URL mode.
- The extension saves jobs and prep plans to the logged-in account through the backend.
- Recent activity on the website is still mostly app-side state. A future backend activity log will make extension-created actions appear everywhere instantly.
