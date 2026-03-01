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

  if (!dom.statusToast) {
    return;
  }

  dom.statusToast.classList.add("hidden");
  dom.statusToast.classList.remove("error", "success");
  dom.statusToast.textContent = "";
}

export function showStatus(type, message) {
  if (statusTimer) {
    window.clearTimeout(statusTimer);
    statusTimer = 0;
  }

  if (!dom.statusToast) {
    return;
  }

  dom.statusToast.classList.remove("hidden", "error", "success");
  if (type === "error") {
    dom.statusToast.classList.add("error");
  } else if (type === "success") {
    dom.statusToast.classList.add("success");
  }
  dom.statusToast.textContent = message || "";

  if (type === "success" || type === "error") {
    statusTimer = window.setTimeout(() => {
      hideStatus();
    }, 2200);
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
