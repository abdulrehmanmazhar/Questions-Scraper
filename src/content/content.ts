import type { Msg, Status } from "../shared/messages.js";
import { NetworkTracker, sendToBackground, WaitKit } from "../shared/utils.js";
import { login } from "./automate/login.js";
import {
  calculateQuestions,
  clickNextQuestion,
  createTest,
  createTestNav,
  getActiveQbanks,
  getCheckboxesContent,
  getCurrentQuestionNumber,
  getMarkDoneQuestions,
  getTotalQuestionNumber,
  injectHook,
  markDonePendingQuestions,
  openQBank,
  selectAllItemsFilter,
  selectSafeQuestions,
  selectTutorMode,
} from "./automate/qbank.js";
import { getPageType } from "./automate/classify.js";

async function main() {
  const r = await sendToBackground<Status>({ type: "GET_STATUS" });

  if (
    !r.ok ||
    r.data === "idle" ||
    r.data === "failed" ||
    r.data === "completed"
  )
    return;
  NetworkTracker.init();

  const pageType = getPageType(window.location.href);

  console.log(pageType);

  switch (pageType) {
    case "main":
      await login();

      break;

    case "home":
      const qbanks = await getActiveQbanks();

      const target = qbanks[0];

      if (!target) throw new Error("No active qbank found");

      await WaitKit.delay(2000);

      openQBank(target);
      break;

    case "overview":
      await WaitKit.delay(2000);

      await createTestNav();
      break;

    case "create test":
      await NetworkTracker.waitForNetworkIdle(10000);

      await WaitKit.delay(2000);

      selectTutorMode();

      await WaitKit.delay(2000);

      selectAllItemsFilter();

      await WaitKit.delay(2000);

      await calculateQuestions();

      const checkBoxesContent = getCheckboxesContent();

      const scrapedQuestion = await getMarkDoneQuestions();

      if (
        checkBoxesContent.filter((cbc) => !scrapedQuestion.includes(cbc.detail))
          .length <= 1
      ) {
        await sendToBackground({ type: "SET_STATUS", status: "completed" });
        return;
      }

      const newQuestionData = selectSafeQuestions(
        checkBoxesContent,
        200,
        scrapedQuestion,
      );

      const newQuestions: Record<string, boolean> = {};

      for (let question of scrapedQuestion) {
        newQuestions[question] = true;
      }

      for (let question of newQuestionData.newQuestions) {
        newQuestions[question] = false;
      }

      const r = await sendToBackground({
        type: "SET_QUESTIONS",
        questions: newQuestions,
      });

      if (!r.ok) throw new Error("Cannot persist the questions");

      const availableQuestions = await calculateQuestions();

      if (!availableQuestions) return;

      createTest(
        availableQuestions,
        newQuestionData.newQuestions[0] || "first",
      );
      break;

    case "test":
      // Handle test page logic
      injectHook();

      const html = document.documentElement.outerHTML;

      const reply = await sendToBackground({
        type: "SERVER_PUSH",
        payload: html,
      });

      if (!reply.ok) throw new Error("Could not send the html to server");

      const totalQuestions = getTotalQuestionNumber();

      if (!totalQuestions)
        throw new Error("No questions exist in the test session");

      const currentQuestionNumber = getCurrentQuestionNumber();

      if (currentQuestionNumber <= totalQuestions) {
        if (currentQuestionNumber === totalQuestions) {
          await markDonePendingQuestions();
          await NetworkTracker.waitForNetworkIdle(10000);
          window.location.href =
            "https://app2.canadaqbank.com/member/qbank//test/create";

          break;
        }
        clickNextQuestion();
      }

      break;

    default:
      break;
  }

  // const mo = new MutationObserver(() => {});
  // mo.observe(document.documentElement, { childList: true, subtree: true });

  // initial check
}

let scraping = false;

const startScraping = () => {
  if (scraping) return;
  scraping = true;

  main()
    .catch((e) => {
      console.error(e);
      sendToBackground({ type: "SET_STATUS", status: "failed" });
    })
    .finally(() => {
      scraping = false;
    });
};

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  if (msg.type === "START_SCRAPING") {
    startScraping();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

const port = chrome.runtime.connect({ name: "content" });

port.onMessage.addListener((msg: Msg) => {
  if (msg.type === "START_SCRAPING") {
    startScraping();
  }
});

main().catch((e) => {
  console.error(e);
  sendToBackground({ type: "SET_STATUS", status: "failed" });
});
