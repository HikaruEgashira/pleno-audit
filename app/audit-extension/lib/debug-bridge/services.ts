import type { DebugHandlerResult } from "./types.js";

export async function getServices(): Promise<DebugHandlerResult> {
  const storage = await chrome.storage.local.get("services");
  return { success: true, data: storage.services || {} };
}

export async function getService(params: { domain: string }): Promise<DebugHandlerResult> {
  const storage = await chrome.storage.local.get("services");
  const services = storage.services || {};
  return { success: true, data: services[params.domain] || null };
}

export async function clearServices(): Promise<DebugHandlerResult> {
  await chrome.storage.local.remove("services");
  return { success: true };
}
