import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
cpSync("manifest.json", "dist/manifest.json");
cpSync("public", "dist/public", { recursive: true });
cpSync("src/popup/popup.html", "dist/popup/popup.html");
cpSync("src/content/bootstrap.js", "dist/content/bootstrap.js");
