const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { ZipArchive } = require("archiver");

const headers = [
  "Question",
  "Correct Answer",
  "Other Options",
  "Tags",
  "Explanation",
  "Media",
  "QBank",
  "Chapter Path",
];

function safeFolderName(name) {
  return (
    name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[. ]+$/g, "") ||
    "Uncategorized"
  );
}

function createArchive(folderPath, archivePath) {
  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.once("close", resolve);
    output.once("error", reject);
    archive.once("error", (error) => {
      output.destroy();
      reject(error);
    });

    archive.pipe(output);
    archive.directory(folderPath, false);
    archive.finalize().catch(reject);
  });
}

async function packQbanks(mode = "separated") {
  if (mode !== "combined" && mode !== "separated") {
    throw new Error(
      `Unknown packaging mode: ${mode}. Use "combined" or "separated".`,
    );
  }

  const rootDirectory = __dirname;
  const outputDirectory = path.join(rootDirectory, "qbanks");
  const inputPath = path.join(rootDirectory, "qbanks.json");
  const qbanks = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const groupedQuestions = new Map();

  for (const question of Object.values(qbanks)) {
    const subject = String(question.subject || "Uncategorized").trim();
    if (!groupedQuestions.has(subject)) {
      groupedQuestions.set(subject, []);
    }
    groupedQuestions.get(subject).push(question);
  }

  await fs.mkdir(outputDirectory, { recursive: true });

  if (mode === "combined") {
    const bankName = "MCCQE1 Core";
    const subjectDirectory = path.join(outputDirectory, bankName);
    const questions = [...groupedQuestions.values()].flat();
    await fs.mkdir(subjectDirectory, { recursive: true });

    const rows = [
      headers,
      ...questions.map((question) => [
        question.question ?? "",
        question.correctAnswer ?? "",
        Array.isArray(question.otherChoices)
          ? question.otherChoices.join(";")
          : "",
        // bankName.toLowerCase(),
        `${[question.subject, question.subCategory, question.topic]
          .filter(Boolean)
          .map((t) => t.toLowerCase())
          .join(";")}`,
        question.explanation ?? "",
        "",
        bankName,
        `${[question.subject, question.subCategory, question.topic].filter(Boolean).join(">")}`,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, path.join(subjectDirectory, "questions.xlsx"));

    const sentiaMetadata = {
      format: "sentia-qbank",
      version: 1,
      bankName,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(subjectDirectory, "sentia.json"),
      JSON.stringify(sentiaMetadata, null, 2),
      "utf8",
    );

    for (const mediaDirectory of ["audios", "videos", "images"]) {
      await fs.mkdir(path.join(subjectDirectory, mediaDirectory), {
        recursive: true,
      });
    }

    await createArchive(
      subjectDirectory,
      path.join(outputDirectory, `${bankName}.st`),
    );
    return;
  }

  for (const [subject, questions] of groupedQuestions) {
    const folderName = safeFolderName(subject);
    const subjectDirectory = path.join(outputDirectory, folderName);
    await fs.mkdir(subjectDirectory, { recursive: true });

    const rows = [
      headers,
      ...questions.map((question) => [
        question.question ?? "",
        question.correctAnswer ?? "",
        Array.isArray(question.otherChoices)
          ? question.otherChoices.join(";")
          : "",
        `${question.subject ?? subject}`,
        question.explanation ?? "",
        question.subject ?? subject,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, path.join(subjectDirectory, "question.xlsx"));

    const sentiaMetadata = {
      format: "sentia-qbank",
      version: 1,
      bankName: subject,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(subjectDirectory, "sentia.json"),
      JSON.stringify(sentiaMetadata, null, 2),
      "utf8",
    );

    for (const mediaDirectory of ["audios", "videos", "images"]) {
      await fs.mkdir(path.join(subjectDirectory, mediaDirectory), {
        recursive: true,
      });
    }

    await createArchive(
      subjectDirectory,
      path.join(outputDirectory, `${folderName}.st`),
    );
  }
}

if (require.main === module) {
  packQbanks(process.argv[2] || "separated").catch((error) => {
    console.error("Failed to package qbanks:", error);
    process.exitCode = 1;
  });
}

module.exports = { packQbanks };
