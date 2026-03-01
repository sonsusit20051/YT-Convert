import { convertViaSyncApi, hasBackendEndpoint } from "./api.js";
import { copyText, readClipboardText } from "./clipboard.js";
import { dom } from "./dom.js";
import {
  clearInputError,
  hideResult,
  hideStatus,
  setBusy,
  setBuyEnabled,
  showInputError,
  showResult,
  showStatus,
} from "./ui.js";
import { parseAndValidateInput } from "./validators.js";

const state = {
  busy: false,
  currentAffiliateLink: "",
};

function renderFatalMessage(message) {
  const safeText = String(message || "Lỗi không xác định.");
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f8fb;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#172332;">
      <section style="max-width:560px;width:100%;background:#fff;border:1px solid #e6ecf5;border-radius:16px;padding:18px;">
        <h1 style="margin:0 0 10px;font-size:20px;">UI không khởi tạo được</h1>
        <p style="margin:0;color:#b23a2c;white-space:pre-wrap;">${safeText}</p>
        <p style="margin:12px 0 0;color:#667085;">Hãy hard reload (Ctrl/Cmd+Shift+R). Nếu vẫn lỗi, mở <code>debug.html</code> để kiểm tra backend.</p>
      </section>
    </main>
  `;
}

function ensureDomReady() {
  const requiredKeys = [
    "sourceInput",
    "pasteBtn",
    "createBtn",
    "inputError",
    "statusBanner",
    "statusText",
    "statusAction",
    "resultBox",
    "resultLink",
    "copyBtn",
    "buyBtn",
  ];

  const missing = requiredKeys.filter((key) => !dom[key]);
  if (missing.length > 0) {
    const message = `Thiếu DOM nodes: ${missing.join(", ")}.`;
    renderFatalMessage(message);
    throw new Error(message);
  }
}

function installGlobalErrorGuards() {
  window.addEventListener("error", (event) => {
    const msg = event?.error?.message || event?.message || "Runtime error";
    if (dom?.statusBanner && dom?.statusText) {
      showStatus("error", `Lỗi runtime: ${msg}`);
      return;
    }
    renderFatalMessage(`Lỗi runtime: ${msg}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || "Unhandled promise rejection");
    if (dom?.statusBanner && dom?.statusText) {
      showStatus("error", `Lỗi promise: ${msg}`);
      return;
    }
    renderFatalMessage(`Lỗi promise: ${msg}`);
  });
}

function resetOutput() {
  state.currentAffiliateLink = "";
  hideResult();
  setBuyEnabled(false);
}

function setProcessing(nextBusy) {
  state.busy = nextBusy;
  setBusy(nextBusy);
}

async function handlePasteClick(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (state.busy) {
    return;
  }

  hideStatus();
  clearInputError();

  try {
    const text = await readClipboardText();
    if (!text || !text.trim()) {
      showStatus("warning", "Clipboard đang trống.");
      return;
    }
    dom.sourceInput.value = text.trim();
    dom.sourceInput.focus();
  } catch {
    dom.sourceInput.focus();
    showStatus("warning", "Không thể đọc clipboard. Hãy dùng Ctrl/Cmd+V để dán thủ công.");
  }
}

async function handleCreateClick(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (state.busy) {
    return;
  }

  hideStatus();
  clearInputError();
  resetOutput();

  const validation = parseAndValidateInput(dom.sourceInput.value);
  if (!validation.ok) {
    showInputError(validation.error);
    return;
  }

  if (!hasBackendEndpoint()) {
    showStatus("error", "Chưa cấu hình backend queue endpoint.");
    return;
  }

  setProcessing(true);

  try {
    showStatus("warning", "Đang xử lý và tạo link...");
    const sync = await convertViaSyncApi(validation.url.toString(), "yt");
    const affiliateLink = sync.affiliateLink || "";
    if (!affiliateLink) {
      throw new Error("Worker không trả affiliate link hợp lệ.");
    }

    state.currentAffiliateLink = affiliateLink;
    showStatus("success", "Tạo link thành công");
    showResult(affiliateLink);
    setBuyEnabled(true);
  } catch (error) {
    showStatus("error", error?.message || "Đã xảy ra lỗi khi tạo link. Vui lòng thử lại.");
  } finally {
    setProcessing(false);
  }
}

async function handleCopyClick(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!state.currentAffiliateLink || state.busy) {
    return;
  }

  try {
    await copyText(state.currentAffiliateLink);
    showStatus("success", "Đã copy link affiliate.");
  } catch {
    showStatus("error", "Không thể copy tự động. Vui lòng copy thủ công.");
  }
}

function handleBuyClick(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  if (!state.currentAffiliateLink || state.busy) {
    return;
  }

  const popup = window.open(state.currentAffiliateLink, "_blank", "noopener,noreferrer");
  if (!popup) {
    showStatus("warning", "Trình duyệt đang chặn mở tab mới. Hãy cho phép popup và thử lại.");
  }
}

function bindEvents() {
  // Defensive guard: block accidental form-like navigation from click/Enter.
  document.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  dom.sourceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateClick(event);
    }
  });

  dom.pasteBtn.addEventListener("click", handlePasteClick);
  dom.createBtn.addEventListener("click", handleCreateClick);
  dom.copyBtn.addEventListener("click", handleCopyClick);
  dom.buyBtn.addEventListener("click", handleBuyClick);
  dom.sourceInput.addEventListener("input", () => {
    clearInputError();
  });
}

function init() {
  ensureDomReady();
  installGlobalErrorGuards();
  setBusy(false);
  hideStatus();
  resetOutput();
  bindEvents();
}

init();
