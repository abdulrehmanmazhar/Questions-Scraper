import type { Msg, Reply, Status } from "../shared/messages.js";

const QBANK_URL = "https://app2.canadaqbank.com";

async function openTab(url: string, active = false) {
  return chrome.tabs.create({ url, active });
}

async function updateUrl(url: string, active = true) {
  return chrome.tabs.update({ url, active });
}

function serverPush(payload: string) {
  return fetch("http://localhost:8787/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: `file-${Date.now()}.html`,
      content: payload,
    }),
  });
}

function waitForTabComplete(tabId: number, timeoutMs = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(
        new Error(`Tab ${tabId} did not finish loading in ${timeoutMs}ms`),
      );
    }, timeoutMs);

    function onUpdated(
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);

    // Tab may already be complete by the time we attach the listener
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    });
  });
}

/* ---------- Message routing ---------- */
chrome.runtime.onMessage.addListener(
  (msg: Msg, _sender, sendResponse: (r: Reply) => void) => {
    (async () => {
      try {
        switch (msg.type) {
          case "SERVER_PUSH": {
            if (typeof msg.payload !== "string") {
              sendResponse({
                ok: false,
                error: "Cannot proceed with something other than string",
              });
              break;
            }
            const res = await serverPush(msg.payload);

            if (!res.ok) {
              sendResponse({
                ok: false,
                error: "Failed to send file",
              });
              break;
            }

            sendResponse({ ok: true, data: res });
            break;
          }

          case "OPEN_TAB": {
            const tab = await openTab(msg.url, true);
            sendResponse({ ok: true, data: tab.id });
            break;
          }

          case "UPDATE_URL": {
            await updateUrl(msg.url);
            sendResponse({ ok: true });
            break;
          }

          case "GET_STATUS": {
            const result = await chrome.storage.session.get("status");
            sendResponse({
              ok: true,
              data: (result.status as Status | undefined) ?? "idle",
            });
            break;
          }

          case "SET_STATUS": {
            await setStatus(msg.status);
            sendResponse({ ok: true });
            break;
          }

          case "SET_QUESTIONS": {
            const questions = await setQuestions(msg.questions);
            sendResponse({ ok: true, data: questions });
            break;
          }

          case "GET_QUESTIONS": {
            const questions = await chrome.storage.local.get("questions");
            sendResponse({ ok: true, data: questions.questions });
            break;
          }

          case "START_SCRAPING": {
            await startScraping();
            sendResponse({ ok: true });
            break;
          }

          default:
            sendResponse({ ok: false, error: "unknown message" });
        }
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  },
);

const popupPorts = new Set<chrome.runtime.Port>();
const contentPorts = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  switch (port.name) {
    case "popup":
      popupPorts.add(port);
      port.onDisconnect.addListener(() => popupPorts.delete(port));
      break;

    case "content":
      contentPorts.add(port);
      port.onDisconnect.addListener(() => contentPorts.delete(port));
      break;

    default:
      console.warn("Unknown port name:", port.name);
  }
});

function broadcastToPopups(message: Msg) {
  for (const port of popupPorts) {
    try {
      port.postMessage(message);
    } catch (e) {
      popupPorts.delete(port);
    }
  }
}

function broadcastToContent(message: Msg) {
  for (const port of contentPorts) {
    try {
      port.postMessage(message);
    } catch (e) {
      contentPorts.delete(port);
    }
  }
}

async function setStatus(status: Status) {
  await chrome.storage.session.set({ status });
  broadcastToPopups({ type: "STATUS_UPDATE", status });
  broadcastToContent({ type: "STATUS_UPDATE", status });
  return status;
}

async function setQuestions(questions: Record<string, boolean>) {
  await chrome.storage.local.set({ questions });
  return questions;
}

async function sendStartToTab(tabId: number, attempts = 10) {
  let lastError: Error | undefined;

  for (let i = 0; i < attempts; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "START_SCRAPING" } as Msg);
      return;
    } catch (e) {
      lastError = e as Error;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  throw (
    lastError ?? new Error("Content script did not respond to START_SCRAPING")
  );
}

async function startScraping() {
  await setStatus("started");

  try {
    const tab = await openTab(QBANK_URL, true);
    if (tab.id === undefined) {
      throw new Error("Failed to open QBank tab");
    }

    await waitForTabComplete(tab.id);
    await sendStartToTab(tab.id);
  } catch (e) {
    await setStatus("failed");
    throw e;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void setStatus("idle");
});
