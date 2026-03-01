import { convertViaSyncApi, hasBackendEndpoint } from "./api.js";
import { readClipboardText } from "./clipboard.js";
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

function requiredDomReady() {
  return Boolean(
    dom.sourceInput &&
      dom.pasteBtn &&
      dom.createBtn &&
      dom.buyBtn &&
      dom.inputError &&
      dom.resultText &&
      dom.statusToast
  );
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
  if (state.busy) {
    return;
  }

  clearInputError();
  hideStatus();

  try {
    const text = await readClipboardText();
    if (!text || !text.trim()) {
      showStatus("error", "Clipboard đang trống.");
      return;
    }
    dom.sourceInput.value = text.trim();
    dom.sourceInput.focus();
  } catch {
    dom.sourceInput.focus();
    showStatus("error", "Không đọc được clipboard. Hãy dán thủ công bằng Ctrl/Cmd+V.");
  }
}

async function handleCreateClick(event) {
  event?.preventDefault?.();
  if (state.busy) {
    return;
  }

  clearInputError();
  hideStatus();
  resetOutput();

  const validation = parseAndValidateInput(dom.sourceInput.value);
  if (!validation.ok) {
    showInputError(validation.error);
    return;
  }

  if (!hasBackendEndpoint()) {
    showStatus(
      "error",
      "Chưa cấu hình backend public. Mở web với ?api=https://your-backend-domain rồi thử lại."
    );
    return;
  }

  setProcessing(true);
  try {
    const payload = await convertViaSyncApi(validation.url.toString(), "yt");
    const link = String(payload?.affiliateLink || "").trim();
    if (!link) {
      throw new Error("Không nhận được affiliate link.");
    }

    state.currentAffiliateLink = link;
    showResult(link);
    setBuyEnabled(true);
    showStatus("success", "Tạo link thành công");
  } catch (error) {
    console.error(error);
    showStatus("error", "Tạo link thất bại");
  } finally {
    setProcessing(false);
  }
}

function handleOpenClick(event) {
  event?.preventDefault?.();
  if (state.busy || !state.currentAffiliateLink) {
    return;
  }

  const popup = window.open(state.currentAffiliateLink, "_blank", "noopener,noreferrer");
  if (!popup) {
    showStatus("error", "Trình duyệt chặn mở tab mới. Hãy cho phép pop-up.");
  }
}

function bindEvents() {
  dom.pasteBtn.addEventListener("click", handlePasteClick);
  dom.createBtn.addEventListener("click", handleCreateClick);
  dom.buyBtn.addEventListener("click", handleOpenClick);
  dom.sourceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleCreateClick(event);
    }
  });
  dom.sourceInput.addEventListener("input", () => {
    clearInputError();
  });
}

function init() {
  if (!requiredDomReady()) {
    // Keep UI unchanged if DOM is incomplete; avoid white screen replacement.
    console.error("DOM chưa sẵn sàng, kiểm tra index.html IDs.");
    return;
  }
  hideStatus();
  clearInputError();
  setBusy(false);
  resetOutput();
  bindEvents();
}

init();
