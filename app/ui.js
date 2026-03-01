import { dom } from "./dom.js";

let statusTimer = 0;

export function setBusy(isBusy) {
  if (dom.createBtn) {
    dom.createBtn.disabled = isBusy;
    dom.createBtn.textContent = isBusy ? "Đang tạo..." : "Tạo link";
  }
  if (dom.pasteBtn) {
    dom.pasteBtn.disabled = isBusy;
  }
}

export function clearInputError() {
  if (dom.inputError) {
    dom.inputError.textContent = "";
  }
}

export function showInputError(message) {
  if (dom.inputError) {
    dom.inputError.textContent = message || "";
  }
}

export function hideStatus() {
  if (statusTimer) {
    window.clearTimeout(statusTimer);
    statusTimer = 0;
  }

  if (!dom.popupOverlay || !dom.popupBox || !dom.popupText) {
    return;
  }

  dom.popupOverlay.classList.add("hidden");
  dom.popupBox.classList.remove("error", "success");
  dom.popupText.textContent = "";
}

export function showStatus(type, message) {
  if (statusTimer) {
    window.clearTimeout(statusTimer);
    statusTimer = 0;
  }

  if (!dom.popupOverlay || !dom.popupBox || !dom.popupText) {
    return;
  }

  dom.popupOverlay.classList.remove("hidden");
  dom.popupBox.classList.remove("error", "success");
  if (type === "error") {
    dom.popupBox.classList.add("error");
  } else if (type === "success") {
    dom.popupBox.classList.add("success");
  }
  dom.popupText.textContent = message || "";

  if (type === "success") {
    statusTimer = window.setTimeout(() => {
      hideStatus();
    }, 1400);
  }
}

export function showResult(link) {
  if (dom.resultText) {
    dom.resultText.value = link || "";
  }
}

export function hideResult() {
  if (dom.resultText) {
    dom.resultText.value = "";
  }
}

export function setBuyEnabled(enabled) {
  if (dom.buyBtn) {
    dom.buyBtn.disabled = !enabled;
  }
}
