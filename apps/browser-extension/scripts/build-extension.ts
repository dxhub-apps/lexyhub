import { createWriteStream } from "node:fs";
import { mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import archiver from "archiver";

import { getExtensionConfig } from "@/lib/extension-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const distDir = path.join(extensionRoot, "dist");
const buildDir = path.join(extensionRoot, "build");
const manifestFiles = ["manifest.json", "background.js", "content.js"];

async function prepareOutputDirectories() {
  await rm(distDir, { recursive: true, force: true });
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await mkdir(buildDir, { recursive: true });
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function writeConfigFile() {
  const config = getExtensionConfig();
  if (!nonEmptyString(config.apiBaseUrl)) {
    throw new Error(
      "BROWSER_EXTENSION_API_BASE_URL must be defined to build the browser extension.",
    );
  }

  const configPath = path.join(distDir, "config.json");
  await writeFile(
    configPath,
    JSON.stringify(
      {
        apiBaseUrl: config.apiBaseUrl,
        allowUserTelemetryDefault: config.allowUserTelemetryDefault,
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function copyStaticFiles() {
  await Promise.all(
    manifestFiles.map(async (file) => {
      const source = path.join(extensionRoot, file);
      const target = path.join(distDir, file);
      await copyFile(source, target);
    }),
  );
}

async function createArchive() {
  const archivePath = path.join(buildDir, "lexyhub-browser-extension.zip");
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    output.on("error", (error) => reject(error));
    archive.on("error", (error) => reject(error));

    archive.pipe(output);
    archive.directory(distDir, false);
    void archive.finalize();
  });

  return archivePath;
}

async function build() {
  await prepareOutputDirectories();
  await copyStaticFiles();
  await writeConfigFile();
  const archivePath = await createArchive();
  console.log(`Browser extension packaged at ${archivePath}`);
}

void build();
