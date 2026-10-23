# Canada Qbank Scraper

A Chrome Extension (Manifest V3) that automates navigation and question scraping on [Canada QBank](https://app2.canadaqbank.com). It handles login, test creation, question progression, and pushes scraped page HTML to a local server for further processing.

## Features

- **Automated login** to Canada QBank via browser prompts
- **Automatic test creation** in Tutor Mode with question filtering
- **Question-by-question navigation** through test sessions
- **HTML scraping** of each test page, pushed to `http://localhost:8787/files`
- **Popup UI** with Start button and live status display
- **Status tracking** across popup, background, and content script via Chrome storage

## Project Structure

```
canada-qbank-scraper/
├── manifest.json              # Chrome Extension manifest (Manifest V3)
├── package.json               # Node dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── scripts/
│   └── copy-static.mjs        # Copies static assets to dist/
├── public/
│   └── popup.css              # Styles for the extension popup
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Background service worker (orchestrator)
│   ├── content/
│   │   ├── bootstrap.js       # Entry point that loads the ES module graph
│   │   ├── content.ts         # Content script (page automation logic)
│   │   ├── injected-hook.ts   # Injected page hook (overrides window.confirm)
│   │   └── automate/
│   │       ├── classify.ts    # URL-based page type classification
│   │       ├── login.ts       # Login automation
│   │       └── qbank.ts       # QBank navigation & question selection
│   ├── popup/
│   │   ├── popup.html         # Popup UI
│   │   └── popup.ts           # Popup logic (start scraping, status display)
│   └── shared/
│       ├── messages.ts        # Shared message types (Msg, Reply, Status)
│       └── utils.ts           # Messaging helper, WaitKit, NetworkTracker
└── dist/                      # Build output (generated)
```

## Tech Stack

- **TypeScript** — type-safe source code
- **Chrome Extension MV3** — service worker, content scripts, popup
- **tsx** — TypeScript execution for development
- **archiver** — for packaging/zipping
- **jsdom** — DOM manipulation utilities
- **xlsx** — Excel spreadsheet handling

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- A Chrome/Chromium-based browser
- A local server running at `http://localhost:8787` with a `POST /files` endpoint (the extension POSTs scraped HTML here)

### Install Dependencies

```bash
npm install
```

### Development

Run the extension in watch mode (requires `tsx`):

```bash
npm run dev
```

### Build

Compile TypeScript and copy static assets to `dist/`:

```bash
npm run build
```

The `dist/` folder contains the unpacked extension ready to load in Chrome.

### Load the Extension in Chrome

1. Build the project (`npm run build`)
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `dist/` folder
5. The extension icon will appear in your toolbar

## Usage

1. Navigate to [https://app2.canadaqbank.com](https://app2.canadaqbank.com)
2. Click the extension icon to open the popup
3. Click **Start** to begin automation
4. When prompted, enter your Canada QBank email and password
5. The extension will:
   - Log you in
   - Find an active QBank
   - Create a test in Tutor Mode
   - Scrape each question page and push HTML to your local server
   - Continue until all questions are processed

The popup displays the current status (`idle`, `started`, `processing`, `completed`, `failed`).

## How It Works

| Component | Responsibility |
|-----------|----------------|
| `popup.ts` | UI controls: Start button, status display, communicates with background |
| `service-worker.ts` | Orchestrates the flow: opens tabs, waits for page loads, routes messages, pushes HTML to server |
| `content.ts` | Runs in the page context: detects page type, runs automation steps (login, test creation, question navigation) |
| `login.ts` | Prompts for credentials and submits the login form |
| `qbank.ts` | QBank-specific DOM interactions (open QBank, create test, select questions, navigate) |
| `classify.ts` | Classifies the current page type from the URL (`main`, `home`, `overview`, `create test`, `test`) |
| `injected-hook.ts` | Injected into the page to override `window.confirm` (auto-dismisses dialogs) |
| `utils.ts` | `sendToBackground` messaging, `WaitKit` (waitForSelector/waitForFunction/delay), `NetworkTracker` (waitForNetworkIdle) |

### Page Flow

```
main (login) → home (select QBank) → overview (create test nav)
  → create test (configure tutor mode) → test (scrape each question)
    → repeat until complete
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode using `tsx watch src/index.ts` |
| `npm run build` | Compile TypeScript and copy static assets to `dist/` |
| `npm start` | Run the built extension from `dist/index.js` |

## Configuration

### Target URL

The background worker opens `https://app2.canadaqbank.com` at the start of scraping (`QBANK_URL` in `service-worker.ts`).

### Server Endpoint

Scraped HTML is POSTed to `http://localhost:8787/files` with a JSON body:

```json
{
  "filename": "file-<timestamp>.html",
  "content": "<html>...</html>"
}
```

### Safe Question Limit

`selectSafeQuestions` in `qbank.ts` defaults to a `safeNumber` of `200` questions per batch.

## Notes

- Login credentials are entered via browser `prompt()` dialogs and are **not stored** persistently.
- The extension requires a local receiver at `localhost:8787` to accept scraped HTML; without it, `SERVER_PUSH` will fail.
- Manifest declares `host_permissions: ["<all_urls>"]` and `http://127.0.0.1:8787/*`.

## License

ISC