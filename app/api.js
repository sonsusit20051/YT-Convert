import {
  BACKEND_BASE_URL,
  JOB_POLL_INTERVAL_MS,
  JOB_POLL_TIMEOUT_MS,
  RESOLVE_TIMEOUT_MS,
} from "./config.js";

function toAbsoluteEndpoint(path) {
  return `${String(BACKEND_BASE_URL || "").replace(/\/$/, "")}${path}`;
}

const CONVERT_ENDPOINT = toAbsoluteEndpoint("/api/convert");
const SYNC_CONVERT_ENDPOINT = toAbsoluteEndpoint("/");

function jobEndpoint(jobId) {
  return toAbsoluteEndpoint(`/api/jobs/${encodeURIComponent(jobId)}`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = RESOLVE_TIMEOUT_MS + 3000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.message || `HTTP ${response.status}`);
    }

    return payload || {};
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Backend xử lý quá lâu hoặc không phản hồi.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function hasBackendEndpoint() {
  return Boolean(BACKEND_BASE_URL);
}

export async function submitConvertJob(inputText) {
  if (!BACKEND_BASE_URL) {
    throw new Error("Backend endpoint chưa được cấu hình.");
  }

  const payload = await fetchJsonWithTimeout(
    CONVERT_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: inputText }),
    },
    RESOLVE_TIMEOUT_MS + 4000
  );

  if (!payload?.ok || !payload?.jobId) {
    throw new Error(payload?.message || "Backend không trả về job hợp lệ.");
  }

  return payload;
}

export async function convertViaSyncApi(inputText, mode = "yt") {
  if (!BACKEND_BASE_URL) {
    throw new Error("Backend endpoint chưa được cấu hình.");
  }

  const query = new URLSearchParams({
    url: String(inputText || ""),
    yt: mode === "yt" ? "1" : "0",
  });

  const payload = await fetchJsonWithTimeout(
    `${SYNC_CONVERT_ENDPOINT}?${query.toString()}`,
    { method: "GET", cache: "no-store" },
    RESOLVE_TIMEOUT_MS + 80000
  );

  if (!payload?.success || !payload?.affiliateLink) {
    throw new Error(payload?.message || "Backend sync API trả về dữ liệu không hợp lệ.");
  }

  return payload;
}

export async function getJob(jobId) {
  const payload = await fetchJsonWithTimeout(jobEndpoint(jobId), {
    method: "GET",
  });

  if (!payload?.ok || !payload?.job?.id) {
    throw new Error(payload?.message || "Không đọc được trạng thái job.");
  }

  return payload.job;
}

export async function waitForJobResult(jobId, options = {}) {
  const timeoutMs = options.timeoutMs || JOB_POLL_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs || JOB_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const job = await getJob(jobId);
    if (typeof options.onProgress === "function") {
      options.onProgress(job);
    }

    if (job.status === "success") {
      return job;
    }

    if (job.status === "error" || job.status === "expired") {
      throw new Error(job.message || "Worker không thể tạo link.");
    }

    await sleep(pollIntervalMs);
  }

  throw new Error("Hết thời gian chờ worker xử lý. Vui lòng thử lại.");
}
