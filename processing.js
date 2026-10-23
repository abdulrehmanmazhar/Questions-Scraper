const fs = require("node:fs/promises");
const path = require("node:path");
const { JSDOM } = require("jsdom");

function extractAnswer(sentence) {
  const match = sentence.match(/answer is\s+([a-zA-Z])/i);
  return match ? match[1].toLowerCase() : null;
}

function splitOption(str) {
  const match = str.trim().match(/^([a-zA-Z])[\s.)\-:]+(.+)$/);
  return match ? [match[1].toLowerCase(), match[2].trim()] : null;
}

function parseString(str) {
  // Normalize whitespace: replace tabs/newlines with single spaces
  const normalized = str.replace(/\s+/g, " ").trim();

  // Define the keys we want to extract (in the order they appear)
  const keys = [
    "Topic",
    "Sub-Category",
    "Subject",
    "Type",
    "Dimensions of Care",
    "Physician Activities",
    "Difficulty",
  ];

  // Build a regex that matches "Key: value" up to the next key or end of string
  const keyPattern = keys
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // escape regex chars
    .join("|");

  const regex = new RegExp(
    `(${keyPattern})\\s*:\\s*(.*?)(?=\\s*(?:${keyPattern})\\s*:|$)`,
    "gi",
  );

  const result = {};
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    result[toCamelCase(key)] = value;
  }

  return result;
}

function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
}

function extractQuestionData(html, filename) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // const question = `<p>${document.querySelector("#question")?.textContent?.trim() ?? ""}</p>`;
  const question = `<p>${document.querySelector("#question")?.innerHTML ?? ""}</p>`;

  const choices = Object.fromEntries(
    Array.from(document.querySelectorAll(".select-ans li label"), (element) =>
      splitOption(element.textContent.trim()),
    ),
  );

  const correctAnswerKey = extractAnswer(
    Array.from(document.querySelectorAll("div[id='div_details'] p strong"))
      .filter((st) => st.textContent.trim().includes("The correct answer is"))
      .at(0)
      .textContent.trim(),
  );

  // const explanation = `<p>${document.querySelector("#explanation")?.textContent?.trim() ?? ""}</p>`;

  const explanation = `<p>${document.querySelector("#explanation")?.innerHTML ?? ""}</p>`;

  const paragraphs = Array.from(
    document.querySelectorAll("div[id='div_details'] p"),
  ).map((p) => p.textContent);

  let subject = "";
  let dimensionsOfCare = "";
  let physicianActivities = "";
  let subCategory = "";
  let topic = "";

  for (const para of paragraphs) {
    const parsed = parseString(para);
    if (
      parsed.subject != null &&
      parsed.dimensionsOfCare != null &&
      parsed.physicianActivities != null &&
      parsed.subCategory !== null &&
      parsed.topic !== null
    ) {
      ({ subject, dimensionsOfCare, physicianActivities, subCategory, topic } =
        parsed);
      break;
    }
  }

  const otherChoices = Object.entries(choices)
    .filter(([k, v]) => k !== correctAnswerKey)
    .map(([k, v]) => v);

  // console.log({
  //   question,
  //   choices,
  //   correctAnswer: choices[correctAnswerKey],
  //   otherChoices,
  //   explanation,
  //   subject,
  //   dimensionsOfCare,
  //   physicianActivities,
  //   topic,
  //   subCategory,
  //   images: [],
  // });
  return {
    question,
    choices,
    correctAnswer: choices[correctAnswerKey],
    otherChoices,
    explanation,
    subject,
    dimensionsOfCare,
    physicianActivities,
    topic,
    subCategory,
    images: [],
  };
}

async function processHtmlFiles() {
  const filesDirectory = path.join(__dirname, "files");
  const filenames = (await fs.readdir(filesDirectory)).filter(
    (filename) => path.extname(filename).toLowerCase() === ".html",
  );
  const qbanks = {};

  for (let index = 0; index < filenames.length; index += 1) {
    const filename = filenames[index];
    const html = await fs.readFile(path.join(filesDirectory, filename), "utf8");
    qbanks[filename] = await extractQuestionData(html, filename);

    const percentage = Math.round(((index + 1) / filenames.length) * 100);
    process.stdout.write(
      `\rProcessing HTML files: ${percentage}% (${index + 1}/${filenames.length})`,
    );
  }

  if (filenames.length > 0) {
    process.stdout.write("\n");
  }

  await fs.writeFile(
    path.join(__dirname, "qbanks.json"),
    JSON.stringify(qbanks, null, 2),
    "utf8",
  );

  return qbanks;
}

if (require.main === module) {
  processHtmlFiles().catch((error) => {
    console.error("Failed to process HTML files:", error);
    process.exitCode = 1;
  });
}

module.exports = { processHtmlFiles, extractQuestionData };
