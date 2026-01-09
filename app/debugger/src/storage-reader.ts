import puppeteer, { type Browser } from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorageData } from "@service-policy-controller/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, "../../extension/dist/chrome-mv3");

async function launchBrowserWithExtension(): Promise<Browser> {
  return puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
}

async function getExtensionId(browser: Browser): Promise<string> {
  const targets = await browser.targets();
  const extensionTarget = targets.find(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith("chrome-extension://")
  );

  if (!extensionTarget) {
    throw new Error("Extension service worker not found. Is the extension built?");
  }

  const url = extensionTarget.url();
  const match = url.match(/chrome-extension:\/\/([^/]+)/);
  if (!match) {
    throw new Error("Could not extract extension ID");
  }

  return match[1];
}

async function readStorageFromExtension(browser: Browser): Promise<StorageData> {
  const extensionId = await getExtensionId(browser);
  const page = await browser.newPage();

  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: "networkidle0",
  }).catch(() => {
    // popup.html may not exist, that's ok
  });

  const data = await page.evaluate(async () => {
    return new Promise<StorageData>((resolve) => {
      chrome.storage.local.get(["services", "events"], (result) => {
        resolve({
          services: result.services || {},
          events: result.events || [],
        });
      });
    });
  });

  await page.close();
  return data;
}

export async function readExtensionStorage(): Promise<StorageData> {
  const browser = await launchBrowserWithExtension();

  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return await readStorageFromExtension(browser);
  } finally {
    await browser.close();
  }
}

export async function watchExtensionStorage(
  callback: (data: StorageData) => void,
  intervalMs = 2000
): Promise<never> {
  const browser = await launchBrowserWithExtension();

  console.log("Browser launched. You can browse websites to generate data.");
  console.log("Storage will be polled every", intervalMs / 1000, "seconds.\n");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const poll = async () => {
    try {
      const data = await readStorageFromExtension(browser);
      callback(data);
    } catch (error) {
      console.error("Error reading storage:", error);
    }
  };

  await poll();
  setInterval(poll, intervalMs);

  await new Promise(() => {});
  throw new Error("unreachable");
}
