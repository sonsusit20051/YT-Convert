const ALLOWED_QUERY_KEYS = new Set(["gads_t_sig", "extraparams"]);

const defaults = {
  enabled: true,
  serverBaseUrl: "http://localhost:8787",
  workerToken: "dev-worker-token",
  workerId: `ext-${crypto.randomUUID().slice(0, 8)}`,
  workerName: "chrome-worker",
  affiliateId: "17391540096",
  subId: "YT3",
  baseRedirect: "https://s.shopee.vn/an_redir",
};

const runtimeState = {
  polling: false,
  lastPollAt: 0,
  lastSuccessAt: 0,
  lastError: "",
  lastJobId: "",
  lastJobStatus: "idle",
  lastHealthAt: 0,
  serverOnline: null,
  queueSize: null,
  workersOnline: null,
  workersTotal: null,
};

async function getSettings() {
  const stored = await chrome.storage.local.get(defaults);
  return { ...defaults, ...stored };
}

async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}

function normalizeBaseUrl(base) {
  return String(base || "").replace(/\/$/, "");
}

function isShortlinkHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "shope.ee" || host.endsWith(".shp.ee") || host.startsWith("s.shopee.");
}

function isShopeeHost(hostname) {
  return /^([a-z0-9-]+\.)*shopee\.[a-z.]{2,}$/i.test(String(hostname || "").toLowerCase());
}

function hasGadsSig(urlObj) {
  return Boolean(urlObj.searchParams.get("gads_t_sig"));
}

function extractProductIds(pathname) {
  const path = String(pathname || "");
  const slugMatch = path.match(/-i\.(\d+)\.(\d+)(?:\/)?$/i);
  if (slugMatch?.[1] && slugMatch?.[2]) {
    return { shopId: slugMatch[1], itemId: slugMatch[2] };
  }

  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2) {
    const itemId = parts[parts.length - 1];
    const shopId = parts[parts.length - 2];
    if (/^\d+$/.test(shopId) && /^\d+$/.test(itemId)) {
      return { shopId, itemId };
    }
  }

  return null;
}

function cleanLandingUrl(urlObj) {
  const ids = extractProductIds(urlObj.pathname);
  if (!ids) {
    throw new Error("Không trích xuất được shop_id/item_id để chuẩn hóa path /product.");
  }

  const cleaned = new URL(urlObj.toString());
  cleaned.hash = "";
  cleaned.protocol = "https:";
  cleaned.pathname = `/product/${ids.shopId}/${ids.itemId}`;

  const next = new URLSearchParams();
  cleaned.searchParams.forEach((value, key) => {
    if (ALLOWED_QUERY_KEYS.has(key.toLowerCase())) {
      next.append(key, value);
    }
  });

  const q = next.toString();
  cleaned.search = q ? `?${q}` : "";
  return cleaned.toString();
}

function buildAffiliateLink(cleanUrl, settings, affiliateId) {
  const origin = encodeURIComponent(cleanUrl);
  const aid = encodeURIComponent(String(affiliateId || ""));
  const sid = encodeURIComponent(String(settings.subId || "YT3"));
  return `${settings.baseRedirect}?affiliate_id=${aid}&sub_id=${sid}&origin_link=${origin}`;
}

async function detectAffiliateIdFromTabs() {
  const tabs = await chrome.tabs.query({ url: "https://affiliate.shopee.vn/*" });

  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }

    try {
      const result = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_AFFILIATE_ID" });
      if (result?.affiliateId) {
        return String(result.affiliateId);
      }
    } catch {
      // Tab may not have content script ready.
    }
  }

  return "";
}

async function getAffiliateId(settings) {
  if (String(settings.affiliateId || "").trim()) {
    return String(settings.affiliateId);
  }

  const detected = await detectAffiliateIdFromTabs();
  if (detected) {
    await saveSettings({ affiliateId: detected });
    return detected;
  }

  const fallback = String(defaults.affiliateId || "").trim();
  if (fallback) {
    await saveSettings({ affiliateId: fallback });
    return fallback;
  }

  throw new Error(
    "Không tìm thấy affiliate id. Hãy mở tab affiliate.shopee.vn và đăng nhập, hoặc nhập tay trong Options."
  );
}

async function resolveLanding(inputUrl) {
  const parsed = new URL(inputUrl);
  if (!isShortlinkHost(parsed.hostname)) {
    return parsed;
  }

  const response = await fetch(parsed.toString(), {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    credentials: "include",
  });

  if (!response?.url) {
    throw new Error("Không resolve được shortlink.");
  }

  return new URL(response.url);
}

async function convertJob(job, settings) {
  const landingUrl = await resolveLanding(job.url);
  if (!isShopeeHost(landingUrl.hostname)) {
    throw new Error("URL đích không thuộc domain Shopee.");
  }

  if (!hasGadsSig(landingUrl)) {
    throw new Error("Landing URL thiếu gads_t_sig.");
  }

  const cleanUrl = cleanLandingUrl(landingUrl);
  const affiliateId = await getAffiliateId(settings);
  const affiliateLink = buildAffiliateLink(cleanUrl, settings, affiliateId);

  return {
    affiliateLink,
    landingUrl: landingUrl.toString(),
    cleanLandingUrl: cleanUrl,
  };
}

async function postWorker(path, payload, settings) {
  const base = normalizeBaseUrl(settings.serverBaseUrl);
  if (!base) {
    throw new Error("Thiếu serverBaseUrl trong options.");
  }

  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Token": settings.workerToken,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }

  return data;
}

async function fetchHealth(settings, timeoutMs = 2500) {
  const base = normalizeBaseUrl(settings.serverBaseUrl);
  if (!base) {
    throw new Error("Thiếu serverBaseUrl trong options.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}/api/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `HTTP ${response.status}`);
    }

    runtimeState.serverOnline = true;
    runtimeState.queueSize = Number.isFinite(payload.queueSize) ? payload.queueSize : null;
    runtimeState.workersOnline = Number.isFinite(payload?.workers?.online)
      ? payload.workers.online
      : null;
    runtimeState.workersTotal = Number.isFinite(payload?.workers?.total)
      ? payload.workers.total
      : null;
    runtimeState.lastHealthAt = Date.now();
  } catch (error) {
    runtimeState.serverOnline = false;
    runtimeState.lastHealthAt = Date.now();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function scheduleNextPoll(seconds = 0.8) {
  const delayMs = Math.max(seconds * 1000, 500);
  chrome.alarms.create("queuePollOnce", { when: Date.now() + delayMs });
}

async function pollOnce({ forceHealth = false } = {}) {
  if (runtimeState.polling) {
    return;
  }

  runtimeState.polling = true;
  runtimeState.lastPollAt = Date.now();

  try {
    const settings = await getSettings();

    if (!settings.enabled) {
      runtimeState.lastJobStatus = "disabled";
      runtimeState.lastError = "";
      if (forceHealth || Date.now() - runtimeState.lastHealthAt > 8000) {
        try {
          await fetchHealth(settings);
        } catch {
          // ignore health error while disabled
        }
      }
      return;
    }

    if (forceHealth || Date.now() - runtimeState.lastHealthAt > 8000) {
      try {
        await fetchHealth(settings);
      } catch {
        // continue to poll endpoint for better signal
      }
    }

    const polled = await postWorker(
      "/worker/poll",
      {
        workerId: settings.workerId,
        workerName: settings.workerName,
        affiliateId: settings.affiliateId,
        subId: settings.subId,
      },
      settings
    );

    runtimeState.serverOnline = true;
    runtimeState.lastError = "";
    runtimeState.lastPollAt = Date.now();

    if (polled.workerId && polled.workerId !== settings.workerId) {
      await saveSettings({ workerId: polled.workerId });
    }

    if (!polled.job) {
      runtimeState.lastJobStatus = "idle";
      return;
    }

    runtimeState.lastJobId = polled.job.id || "";
    runtimeState.lastJobStatus = "processing";

    try {
      const result = await convertJob(polled.job, settings);
      await postWorker(
        "/worker/submit",
        {
          workerId: polled.workerId || settings.workerId,
          jobId: polled.job.id,
          success: true,
          ...result,
        },
        settings
      );
      runtimeState.lastJobStatus = "success";
      runtimeState.lastSuccessAt = Date.now();
      runtimeState.lastError = "";
    } catch (err) {
      await postWorker(
        "/worker/submit",
        {
          workerId: polled.workerId || settings.workerId,
          jobId: polled.job.id,
          success: false,
          message: err?.message || "Extension convert failed.",
        },
        settings
      );
      runtimeState.lastJobStatus = "error";
      runtimeState.lastError = err?.message || "Extension convert failed.";
    }
  } catch (error) {
    runtimeState.serverOnline = false;
    runtimeState.lastError = error?.message || "Worker poll failed.";
  } finally {
    runtimeState.polling = false;
  }
}

async function getStatusPayload({ forceHealth = false } = {}) {
  const settings = await getSettings();

  if (forceHealth || Date.now() - runtimeState.lastHealthAt > 5000) {
    try {
      await fetchHealth(settings);
    } catch {
      // keep runtimeState error markers
    }
  }

  return {
    enabled: Boolean(settings.enabled),
    polling: Boolean(runtimeState.polling),
    lastPollAt: runtimeState.lastPollAt,
    lastSuccessAt: runtimeState.lastSuccessAt,
    lastError: runtimeState.lastError,
    lastJobId: runtimeState.lastJobId,
    lastJobStatus: runtimeState.lastJobStatus,
    serverOnline: runtimeState.serverOnline,
    queueSize: runtimeState.queueSize,
    workers: {
      online: runtimeState.workersOnline,
      total: runtimeState.workersTotal,
    },
    worker: {
      id: settings.workerId,
      name: settings.workerName,
      affiliateId: settings.affiliateId || "(auto)",
      subId: settings.subId,
    },
    serverBaseUrl: settings.serverBaseUrl,
    now: Date.now(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATUS") {
    (async () => {
      const status = await getStatusPayload({ forceHealth: Boolean(message.forceHealth) });
      sendResponse({ ok: true, status });
    })().catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Không lấy được trạng thái worker." });
    });
    return true;
  }

  if (message?.type === "FORCE_POLL") {
    (async () => {
      await pollOnce({ forceHealth: true });
      scheduleNextPoll(0.8);
      const status = await getStatusPayload({ forceHealth: true });
      sendResponse({ ok: true, status });
    })().catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Không thể force poll." });
    });
    return true;
  }

  if (message?.type === "SET_ENABLED") {
    (async () => {
      const enabled = Boolean(message.enabled);
      await saveSettings({ enabled });
      if (enabled) {
        runtimeState.lastError = "";
        scheduleNextPoll(0.5);
      } else {
        runtimeState.lastJobStatus = "disabled";
      }
      const status = await getStatusPayload({ forceHealth: true });
      sendResponse({ ok: true, status });
    })().catch((error) => {
      sendResponse({ ok: false, message: error?.message || "Không cập nhật được trạng thái enabled." });
    });
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(defaults);
  await chrome.storage.local.set({ ...defaults, ...current });
  chrome.alarms.create("queuePoll", { periodInMinutes: 1 });
  scheduleNextPoll(0.8);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("queuePoll", { periodInMinutes: 1 });
  scheduleNextPoll(0.8);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "queuePoll" || alarm.name === "queuePollOnce") {
    await pollOnce();
    scheduleNextPoll(0.8);
  }
});
