import type { Status } from "../shared/messages.js";
import { sendToBackground } from "../shared/utils.js";

export const getStatus = async () => {
  const r = await sendToBackground<Status>({ type: "GET_STATUS" });

  if (!r?.ok) throw new Error(r?.error ?? "No response from background");

  return (r.data ?? "idle") as Status;
};

const out = document.getElementById("out")!;

function renderStatus(status: string) {
  out.textContent = status;
}

const port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener((msg) => {
  if (msg.type === "STATUS_UPDATE") {
    renderStatus(msg.status);
  }
});

void getStatus()
  .then(renderStatus)
  .catch((e) => renderStatus(`error: ${(e as Error).message}`));

const startScraping = async () => {
  try {
    const status = await getStatus();
    if (status === "processing") return;

    const r = await sendToBackground({ type: "START_SCRAPING" });
    if (!r.ok) throw new Error(r.error);
  } catch (e) {
    renderStatus(`error: ${(e as Error).message}`);
  }
};

document.getElementById("start")!.addEventListener("click", () => {
  void startScraping();
});
