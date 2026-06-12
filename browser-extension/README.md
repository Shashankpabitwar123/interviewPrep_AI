# InterviewPrep AI Chrome Extension

This extension saves the current job page to the local InterviewPrep AI backend.

## How It Works

When you click **Save current job**, the extension sends:

- current tab title
- current tab URL
- visible page text

to:

```text
POST http://127.0.0.1:8000/jobs/analyze
```

Sending visible page text is important for sites like LinkedIn or Handshake because the backend may not be logged in, but your browser tab already is.

## Local Install

1. Start the backend at `http://127.0.0.1:8000`.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on Developer mode.
5. Click **Load unpacked**.
6. Select this `browser-extension` folder.

