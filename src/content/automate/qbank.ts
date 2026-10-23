import {
  NetworkTracker,
  sendToBackground,
  WaitKit,
} from "../../shared/utils.js";

export async function getActiveQbanks() {
  await NetworkTracker.waitForNetworkIdle(10000);

  await WaitKit.waitForSelector("#div_status_active");

  const activeQbanks = document.querySelectorAll("#div_status_active");

  console.log(activeQbanks);

  return Array.from(activeQbanks);
}

export function openQBank(qbank: Element) {
  const openButton = qbank.querySelector<HTMLButtonElement>(
    "button[class='open_qbank']",
  );

  if (!openButton)
    throw new Error("Open button not found for the selected qbank");

  openButton.click();
}

export async function createTestNav() {
  await NetworkTracker.waitForNetworkIdle(10000);
  await WaitKit.waitForSelector(".nav-item");

  const navItems = document.querySelectorAll(".nav-item");

  const createTestItem = Array.from(navItems).find((item) =>
    item.innerHTML?.includes("Create Test"),
  );

  if (createTestItem) {
    const clickableButton = createTestItem.querySelector("button");
    clickableButton?.click();
  }

  await NetworkTracker.waitForNetworkIdle(10000);
}

function extractNumber(str: string) {
  const match = str.match(/\((\d+)\)\s*$/);
  return match ? Number(match[1]) : null;
}

export const getCheckboxesContent = () => {
  const allDisciplineCheckboxes = Array.from(
    document.querySelectorAll('input[type="checkbox"][name^="category"]'),
  )
    .filter(
      (checkbox, index) =>
        index === 0 || checkbox.parentElement?.localName === "li",
    )
    .map((cb, i) => {
      const detail = cb.parentElement?.childNodes[1]?.textContent?.trim() || "";
      return {
        detail: `[${i}]-${detail}`,
        numberOfQuestions: extractNumber(
          cb.parentElement?.childNodes[1]?.textContent?.trim() || "",
        ),
        checkbox: cb as HTMLInputElement,
      };
    });
  return allDisciplineCheckboxes;
};

export const selectSafeQuestions = (
  checkboxes: ReturnType<typeof getCheckboxesContent>,
  safeNumber: number = 200,
  scrapedQuestions: string[],
) => {
  const newQuestions: string[] = [];
  let questionCount = 0;

  for (let i = 0; i < checkboxes.length; i++) {
    const cb = checkboxes[i];

    // console.log(cb.checkbox);

    if (i === 0 && cb.checkbox.checked) cb.checkbox.click();

    if (
      questionCount <= safeNumber &&
      cb.numberOfQuestions !== null &&
      questionCount + cb.numberOfQuestions <= safeNumber &&
      !scrapedQuestions.includes(cb.detail)
    ) {
      newQuestions.push(cb.detail);
      questionCount += cb.numberOfQuestions;
      !cb.checkbox.checked && cb.checkbox.click();
    } else {
      cb.checkbox.checked && i !== 0 && cb.checkbox.click();
    }
  }

  return {
    newQuestions,
    questionCount,
  };
};

export const selectTutorMode = () => {
  const select = document.querySelector(
    "select[id='test_style']",
  ) as HTMLSelectElement;

  if (!select) throw new Error("No Test Mode selector was located");

  const tutorIndex = Array.from(select.options).findIndex(
    (o) => o.text === "Tutor",
  );

  if (tutorIndex === -1) throw new Error("No Tutor Mode was located");

  select.selectedIndex = tutorIndex;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

export const selectAllItemsFilter = () => {
  const select = document.querySelector(
    "select[id='reuse_mode']",
  ) as HTMLSelectElement;

  if (!select) throw new Error("No Filter selector was located");

  const tutorIndex = Array.from(select.options).findIndex(
    (o) => o.text === "All Items",
  );

  if (tutorIndex === -1) throw new Error("No All Items filter was located");

  select.selectedIndex = tutorIndex;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

export const calculateQuestions = async () => {
  const calculateButton = document.querySelector(
    "button[id='button_calculate']",
  ) as HTMLButtonElement;

  const questionCountElement = document.querySelector(
    "input[id='available_questions']",
  ) as HTMLInputElement;

  if (!calculateButton || !questionCountElement)
    throw new Error("Calculate button or question count element not found");

  const previousQuestionCount = questionCountElement.value;
  calculateButton.click();

  console.log("Clicked calculate button, waiting for the question count...");

  await WaitKit.waitForFunction(
    () => {
      const count = Number.parseInt(questionCountElement.value, 10);
      return (
        questionCountElement.value !== previousQuestionCount &&
        Number.isFinite(count)
      );
    },
    { timeout: 10000, polling: 100 },
  );

  const questionCount = parseInt(questionCountElement.value, 10);

  return questionCount;
};

export const createTest = (questions: number, testName: string) => {
  const numberOfQuestionsInput = document.querySelector(
    "input[id='number_of_question']",
  ) as HTMLInputElement;

  const testNameInput = document.querySelector(
    "input[id='test_name']",
  ) as HTMLInputElement;

  const createTestButton = document.querySelector(
    "button[id='button_create_test']",
  ) as HTMLButtonElement;

  if (!numberOfQuestionsInput || !testNameInput || !createTestButton)
    throw new Error(
      "Either of the required element for creating test was not located",
    );

  numberOfQuestionsInput.value = questions.toString();
  testNameInput.value = testName;
  numberOfQuestionsInput.dispatchEvent(new Event("input", { bubbles: true }));
  numberOfQuestionsInput.dispatchEvent(new Event("change", { bubbles: true }));
  testNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  testNameInput.dispatchEvent(new Event("change", { bubbles: true }));

  createTestButton.click();

  console.log(
    `Test creation initiated with ${questions} questions and name "${testName}"`,
  );
};

export const injectHook = () => {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content/injected-hook.js");
  script.type = "module";
  document.head.appendChild(script);
};

export const jumpToQuestion = (questionNumber: number) => {
  const questionHorizontal = document.querySelector(
    "ul[id='div_horizontal_questions']",
  );
  const maxQuestions = questionHorizontal?.childElementCount;

  if (!maxQuestions) throw new Error("No questions found");

  if (questionNumber < 1 || questionNumber > maxQuestions) {
    throw new Error(
      `Question number ${questionNumber} is out of range. Valid range is 1 to ${maxQuestions}.`,
    );
  }

  const questionButton = questionHorizontal.querySelector(
    `question_${questionNumber - 1}`,
  ) as HTMLButtonElement;

  questionButton.click();
};

export const getCurrentQuestionNumber = () => {
  const questionHorizontal = document.querySelector(
    "ul[id='div_horizontal_questions']",
  );
  const currentTile = questionHorizontal?.querySelector(
    "li[class='q-now']",
  ) as HTMLUListElement;

  if (!currentTile) throw new Error("Cannot find current question number tile");

  return parseInt(currentTile.innerText, 10);
};

export const getTotalQuestionNumber = () => {
  const questionHorizontal = document.querySelector(
    "ul[id='div_horizontal_questions']",
  );
  const maxQuestions = questionHorizontal?.childElementCount;

  return maxQuestions;
};

export const clickNextQuestion = () => {
  const nextButton = Array.from(
    document.querySelectorAll("button[class='btn blue-btn']"),
  ).find((el) => el.textContent.includes("Next")) as HTMLButtonElement;

  if (!nextButton) throw new Error("Cannot locate the next button");

  nextButton.click();
};

export const markDonePendingQuestions = async () => {
  const pendingQuestions = await sendToBackground<Record<string, boolean>>({
    type: "GET_QUESTIONS",
  });

  if (!pendingQuestions.ok || !pendingQuestions.data) return;

  const questions = Object.fromEntries(
    Object.entries(pendingQuestions.data).map(([key, _value]) => [key, true]),
  );

  const r = await sendToBackground({ type: "SET_QUESTIONS", questions });

  if (!r.ok) throw new Error("Cannot save the question");
};

export const getMarkDoneQuestions = async () => {
  const pendingQuestions = await sendToBackground<Record<string, boolean>>({
    type: "GET_QUESTIONS",
  });

  if (!pendingQuestions.ok || !pendingQuestions.data) return [];

  const questions = Object.entries(pendingQuestions.data).filter(
    ([_key, value]) => value,
  );

  return questions.map(([key, _value]) => key);
};
