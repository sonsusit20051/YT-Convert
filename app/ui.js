import { dom } from "./dom.js";

let currentActionHandler = null;

function hideStatusAction() {
  dom.statusAction.classList.add("hidden");
  dom.statusAction.textContent = "";
  dom.statusAction.onclick = null;
  currentActionHandler = null;
}

export function setBusy(isBusy) {
  dom.createBtn.disabled = isBusy;
  dom.pasteBtn.disabled = isBusy;
  dom.copyBtn.disabled = isBusy;

  if (isBusy) {
    dom.createBtn.querySelector("span").textContent = "Đang xử lý...";
  } else {
    dom.createBtn.querySelector("span").textContent = "Tạo Link Ngay";
  }
}

export function clearInputError() {
  dom.inputError.textContent = "";
}

export function showInputError(message) {
  dom.inputError.textContent = message || "";
}

export function hideStatus() {
  dom.statusBanner.classList.add("hidden");
  dom.statusBanner.classList.remove("success", "warning", "error");
  dom.statusText.textContent = "";
  hideStatusAction();
}

export function showStatus(type, message, options = {}) {
  dom.statusBanner.classList.remove("hidden", "success", "warning", "error");
  dom.statusBanner.classList.add(type);
  dom.statusText.textContent = message;

  if (options.actionLabel && typeof options.onAction === "function") {
    currentActionHandler = options.onAction;
    dom.statusAction.textContent = options.actionLabel;
    dom.statusAction.classList.remove("hidden");
    dom.statusAction.onclick = () => {
      if (currentActionHandler) {
        currentActionHandler();
      }
    };
  } else {
    hideStatusAction();
  }
}

export function showResult(link) {
  dom.resultLink.href = link;
  dom.resultLink.textContent = link;
  dom.resultBox.classList.remove("hidden");
}

export function hideResult() {
  dom.resultBox.classList.add("hidden");
  dom.resultLink.href = "#";
  dom.resultLink.textContent = "";
}

export function setBuyEnabled(enabled) {
  dom.buyBtn.disabled = !enabled;
}
