function detectAffiliateId() {
  const patterns = [
    /(?:affiliate[_\s-]?id|publisher[_\s-]?id)\D{0,20}(\d{6,})/i,
    /"affiliate_id"\s*:\s*"?(\d{6,})"?/i,
  ];

  const sources = [
    document.body?.innerText || "",
    document.documentElement?.outerHTML || "",
  ];

  for (const source of sources) {
    for (const p of patterns) {
      const m = source.match(p);
      if (m?.[1]) {
        return m[1];
      }
    }
  }

  return "";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "DETECT_AFFILIATE_ID") {
    sendResponse({ affiliateId: detectAffiliateId() });
    return;
  }
});
