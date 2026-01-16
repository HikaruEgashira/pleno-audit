import type { AttackResult, AttackTest } from "../types";

async function simulateBlobDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const maliciousContent = "#!/bin/bash\necho 'This could be malicious'";
    const blob = new Blob([maliciousContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const downloadId = await chrome.downloads.download({
      url,
      filename: "test-payload.sh",
      saveAs: false,
    });

    URL.revokeObjectURL(url);

    if (downloadId) {
      await chrome.downloads.cancel(downloadId);
      await chrome.downloads.erase({ id: downloadId });
    }

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "Blob URL download initiated successfully (then cancelled)",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Blob download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateDataURLDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const content = "malicious payload content";
    const base64 = btoa(content);
    const dataUrl = `data:application/octet-stream;base64,${base64}`;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: "test-data-payload.txt",
      saveAs: false,
    });

    if (downloadId) {
      await chrome.downloads.cancel(downloadId);
      await chrome.downloads.erase({ id: downloadId });
    }

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "Data URL download initiated successfully (then cancelled)",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Data URL download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

async function simulateSuspiciousFileDownload(): Promise<AttackResult> {
  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      return {
        blocked: true,
        detected: true,
        executionTime: performance.now() - startTime,
        details: "No active tab for download simulation",
      };
    }

    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        const link = document.createElement("a");
        link.href = "data:text/plain;base64,dGVzdA==";
        link.download = "suspicious-file.exe";
        return true;
      },
    });

    const executionTime = performance.now() - startTime;

    return {
      blocked: false,
      detected: false,
      executionTime,
      details: "Suspicious file download link created in page",
    };
  } catch (error) {
    const executionTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      blocked: true,
      detected: true,
      executionTime,
      details: `Suspicious download blocked: ${errorMessage}`,
      error: errorMessage,
    };
  }
}

export const downloadAttacks: AttackTest[] = [
  {
    id: "download-blob",
    name: "Blob URL Download",
    category: "download",
    description: "Attempts to download a dynamically generated malicious file via Blob URL",
    severity: "high",
    simulate: simulateBlobDownload,
  },
  {
    id: "download-dataurl",
    name: "Data URL Download",
    category: "download",
    description: "Attempts to download a Base64-encoded payload via Data URL",
    severity: "high",
    simulate: simulateDataURLDownload,
  },
  {
    id: "download-suspicious",
    name: "Suspicious File Download",
    category: "download",
    description: "Attempts to trigger download of a suspicious executable file",
    severity: "critical",
    simulate: simulateSuspiciousFileDownload,
  },
];
