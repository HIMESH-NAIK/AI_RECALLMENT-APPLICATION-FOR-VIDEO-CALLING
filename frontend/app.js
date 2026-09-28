/**
 * Hindsight AI Agent Frontend Application Logic
 * HackwithHyderabad 3.0
 */

// Application State
let currentUserId = "user_dev";
let currentSessionId = "sess_" + Math.random().toString(36).substring(2, 9);
let interactionCounter = 0;

// DOM Elements
const backendStatusPill = document.getElementById("backendStatusPill");
const backendStatusText = document.getElementById("backendStatusText");
const llmStatusPill = document.getElementById("llmStatusPill");
const llmStatusText = document.getElementById("llmStatusText");
const hindsightStatusPill = document.getElementById("hindsightStatusPill");
const hindsightStatusText = document.getElementById("hindsightStatusText");
const btnRefreshHealth = document.getElementById("btnRefreshHealth");

const currentUserIdDisplay = document.getElementById("currentUserIdDisplay");
const currentSessionIdDisplay = document.getElementById("currentSessionIdDisplay");
const interactionCounterDisplay = document.getElementById("interactionCounter");
const messagesContainer = document.getElementById("messagesContainer");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const btnSend = document.getElementById("btnSend");
const sendBtnText = document.getElementById("sendBtnText");
const sendSpinner = document.getElementById("sendSpinner");
const btnClearChat = document.getElementById("btnClearChat");

// Inspector elements
const recalledCountBadge = document.getElementById("recalledCountBadge");
const recalledItemsContainer = document.getElementById("recalledItemsContainer");
const retainedStatusBadge = document.getElementById("retainedStatusBadge");
const retainedContainer = document.getElementById("retainedContainer");

// Manual tools elements
const manualRetainForm = document.getElementById("manualRetainForm");
const manualRetainInput = document.getElementById("manualRetainInput");
const retainResultFeedback = document.getElementById("retainResultFeedback");
const manualRecallForm = document.getElementById("manualRecallForm");
const manualRecallQuery = document.getElementById("manualRecallQuery");
const manualRecallResults = document.getElementById("manualRecallResults");

// Config elements
const inputUserId = document.getElementById("inputUserId");
const cfgBankName = document.getElementById("cfgBankName");
const cfgHindsightUrl = document.getElementById("cfgHindsightUrl");
const cfgLlmProvider = document.getElementById("cfgLlmProvider");
const cfgLlmModel = document.getElementById("cfgLlmModel");

// Demo Modal elements
const demoModal = document.getElementById("demoModal");
const btnOpenDemo = document.getElementById("btnOpenDemo");
const btnCloseDemo = document.getElementById("btnCloseDemo");
const modalBackdrop = document.getElementById("modalBackdrop");
const btnResetDemoData = document.getElementById("btnResetDemoData");
const resetFeedback = document.getElementById("resetFeedback");

// ==============================================================================
// 1. Initialization and Health Polling
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  updateUserDisplay();
  checkHealth();
  setupTabs();
  setupEventListeners();
});

function updateUserDisplay() {
  currentUserIdDisplay.textContent = currentUserId;
  currentSessionIdDisplay.textContent = currentSessionId;
  cfgBankName.textContent = `bank_${currentUserId}`;
  inputUserId.value = currentUserId;
}

async function checkHealth() {
  backendStatusText.textContent = "Checking...";
  llmStatusText.textContent = "Checking...";
  hindsightStatusText.textContent = "Checking...";

  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Health check returned status " + res.status);
    const data = await res.json();

    // Backend
    updatePill(backendStatusPill, backendStatusText, "Online", "green");

    // LLM
    const llmStatus = data.llm ? data.llm.status : "unknown";
    const llmModel = data.llm && data.llm.details ? (data.llm.details.model || data.llm.model) : "local";
    if (llmStatus === "connected") {
      updatePill(llmStatusPill, llmStatusText, `Online (${llmModel})`, "green");
    } else if (llmStatus === "degraded") {
      updatePill(llmStatusPill, llmStatusText, "Degraded", "yellow");
    } else {
      updatePill(llmStatusPill, llmStatusText, "Offline", "red");
    }

    // Hindsight
    const hindsightStatus = data.hindsight ? data.hindsight.status : "unknown";
    if (hindsightStatus === "connected") {
      const ver = (data.hindsight.details && data.hindsight.details.version) ? data.hindsight.details.version : "v1";
      updatePill(hindsightStatusPill, hindsightStatusText, `Active (${ver})`, "green");
    } else {
      updatePill(hindsightStatusPill, hindsightStatusText, "Offline", "yellow");
    }

    // Update config displays if available
    if (data.hindsight && data.hindsight.url) cfgHindsightUrl.textContent = data.hindsight.url;
    if (data.llm && data.llm.provider) cfgLlmProvider.textContent = data.llm.provider;
    if (data.llm && data.llm.model) cfgLlmModel.textContent = data.llm.model;

  } catch (err) {
    updatePill(backendStatusPill, backendStatusText, "Offline", "red");
    updatePill(llmStatusPill, llmStatusText, "Unknown", "yellow");
    updatePill(hindsightStatusPill, hindsightStatusText, "Unknown", "yellow");
  }
}

function updatePill(pillEl, textEl, label, color) {
  textEl.textContent = label;
  const dot = pillEl.querySelector(".status-dot");
  if (dot) {
    dot.className = `status-dot ${color}`;
  }
}

// ==============================================================================
// 2. Chat Logic & UI Rendering
// ==============================================================================
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  await sendMessage(text);
});

// Support Enter to submit, Shift+Enter for newline
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event("submit"));
  }
});

async function sendMessage(text) {
  // Clear input
  messageInput.value = "";

  // Render User Message
  renderUserMessage(text);
  setLoading(true);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: currentUserId,
        session_id: currentSessionId,
        message: text
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Server error: " + res.status);
    }

    const data = await res.json();

    // Render Assistant Message with memory badges
    renderAssistantMessage(data);

    // Update Live Inspector Panel
    updateInspector(data);

    // Update interaction count
    if (data.interaction_count) {
      interactionCounter = data.interaction_count;
      interactionCounterDisplay.textContent = interactionCounter;
    }

  } catch (err) {
    renderErrorMessage("Error communicating with agent: " + err.message);
  } finally {
    setLoading(false);
  }
}

function renderUserMessage(text) {
  const row = document.createElement("div");
  row.className = "message-row user";
  row.innerHTML = `
    <div class="message-bubble">${escapeHtml(text)}</div>
    <div class="message-meta"><span>You</span> • <span>${new Date().toLocaleTimeString()}</span></div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
}

function renderAssistantMessage(data) {
  const row = document.createElement("div");
  row.className = "message-row assistant";

  const recalledCount = (data.memories_recalled && data.memories_recalled.length) || 0;
  const memoryBadgeHtml = recalledCount > 0
    ? `<span class="memory-pill-toggle" onclick="toggleDetails(this)">🧠 Recalled ${recalledCount} memories ▾</span>`
    : `<span class="badge">No prior memories recalled</span>`;

  let detailsHtml = "";
  if (recalledCount > 0) {
    const itemsList = data.memories_recalled
      .map(m => `• ${escapeHtml(m.text)}`)
      .join("<br>");
    detailsHtml = `<div class="collapsible-memory-details" style="display:none;">${itemsList}</div>`;
  }

  row.innerHTML = `
    <div class="message-bubble">${escapeHtml(data.response)}</div>
    <div class="memory-badges-row">
      ${memoryBadgeHtml}
      <span class="badge">Model: ${escapeHtml(data.llm_model || "local")}</span>
    </div>
    ${detailsHtml}
    <div class="message-meta">
      <span>Agent</span> • <span>${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
}

function renderErrorMessage(errorText) {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  row.innerHTML = `
    <div class="message-bubble" style="background:#451a1a; border-color:#7f1d1d; color:#fca5a5;">
      ⚠️ ${escapeHtml(errorText)}
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
}

function toggleDetails(btn) {
  const parent = btn.closest(".message-row");
  const details = parent.querySelector(".collapsible-memory-details");
  if (!details) return;
  if (details.style.display === "none") {
    details.style.display = "block";
    btn.innerHTML = btn.innerHTML.replace("▾", "▴");
  } else {
    details.style.display = "none";
    btn.innerHTML = btn.innerHTML.replace("▴", "▾");
  }
}

function updateInspector(data) {
  // Update Recalled Memories
  const recalled = data.memories_recalled || [];
  recalledCountBadge.textContent = `${recalled.length} items`;

  if (recalled.length === 0) {
    recalledItemsContainer.innerHTML = `<div class="empty-state">No past memories matched this query.</div>`;
  } else {
    recalledItemsContainer.innerHTML = recalled.map(m => `
      <div class="memory-card-item">
        <div class="memory-card-text">${escapeHtml(m.text)}</div>
        <div class="memory-card-meta">
          <span>Type: ${escapeHtml(m.type || "fact")}</span>
          <span>Score: ${m.score ? m.score.toFixed(3) : "N/A"}</span>
        </div>
      </div>
    `).join("");
  }

  // Update Retained Memory
  if (data.memory_retained) {
    retainedStatusBadge.textContent = "Saved";
    retainedStatusBadge.className = "badge badge-success";
    retainedContainer.textContent = data.memory_retained;
  }
}

function setLoading(isLoading) {
  if (isLoading) {
    btnSend.disabled = true;
    sendBtnText.classList.add("hidden");
    sendSpinner.classList.remove("hidden");
  } else {
    btnSend.disabled = false;
    sendBtnText.classList.remove("hidden");
    sendSpinner.classList.add("hidden");
    messageInput.focus();
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==============================================================================
// 3. Tab Switching & Event Listeners
// ==============================================================================
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });
}

function setupEventListeners() {
  btnRefreshHealth.addEventListener("click", checkHealth);

  btnClearChat.addEventListener("click", () => {
    messagesContainer.innerHTML = "";
  });

  inputUserId.addEventListener("change", (e) => {
    currentUserId = e.target.value.trim() || "user_dev";
    updateUserDisplay();
  });

  // Manual Retain Form
  manualRetainForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = manualRetainInput.value.trim();
    if (!content) return;

    retainResultFeedback.textContent = "Storing into Hindsight...";
    retainResultFeedback.style.color = "var(--text-muted)";

    try {
      const res = await fetch("/api/memory/retain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          content: content
        })
      });
      const data = await res.json();
      if (data.success) {
        retainResultFeedback.textContent = `✓ Stored in bank: ${data.bank_id}`;
        retainResultFeedback.style.color = "var(--accent-green)";
        manualRetainInput.value = "";
      } else {
        retainResultFeedback.textContent = `Error: ${data.message}`;
        retainResultFeedback.style.color = "var(--accent-red)";
      }
    } catch (err) {
      retainResultFeedback.textContent = `Error: ${err.message}`;
      retainResultFeedback.style.color = "var(--accent-red)";
    }
  });

  // Manual Recall Form
  manualRecallForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = manualRecallQuery.value.trim();
    if (!q) return;

    manualRecallResults.innerHTML = `<div class="empty-state">Searching Hindsight...</div>`;

    try {
      const res = await fetch("/api/memory/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          query: q,
          limit: 5
        })
      });
      const data = await res.json();
      const items = data.memories || [];
      if (items.length === 0) {
        manualRecallResults.innerHTML = `<div class="empty-state">No matching memories found for query.</div>`;
      } else {
        manualRecallResults.innerHTML = items.map(m => `
          <div class="memory-card-item">
            <div class="memory-card-text">${escapeHtml(m.text)}</div>
            <div class="memory-card-meta">
              <span>${escapeHtml(m.type || "fact")}</span>
              <span>Score: ${m.score ? m.score.toFixed(3) : "N/A"}</span>
            </div>
          </div>
        `).join("");
      }
    } catch (err) {
      manualRecallResults.innerHTML = `<div class="empty-state" style="color:var(--accent-red);">Search failed: ${err.message}</div>`;
    }
  });

  // Demo Modal triggers
  btnOpenDemo.addEventListener("click", () => {
    demoModal.classList.remove("hidden");
  });
  btnCloseDemo.addEventListener("click", () => {
    demoModal.classList.add("hidden");
  });
  modalBackdrop.addEventListener("click", () => {
    demoModal.classList.add("hidden");
  });

  // Step runner buttons in Demo Modal
  document.querySelectorAll(".btn-run-step").forEach(btn => {
    btn.addEventListener("click", async () => {
      const step = btn.getAttribute("data-step");
      const sampleText = btn.parentElement.querySelector(".sample-prompt").textContent.replace(/"/g, "");
      demoModal.classList.add("hidden");
      await sendMessage(sampleText);
    });
  });

  // Reset Demo Data
  btnResetDemoData.addEventListener("click", async () => {
    resetFeedback.textContent = "Resetting...";
    try {
      const res = await fetch(`/api/demo/reset?user_id=${encodeURIComponent(currentUserId)}`, { method: "POST" });
      const data = await res.json();
      resetFeedback.textContent = "✓ Memory logs reset";
      resetFeedback.style.color = "var(--accent-green)";
      interactionCounter = 0;
      interactionCounterDisplay.textContent = "0";
      setTimeout(() => { resetFeedback.textContent = ""; }, 3000);
    } catch (err) {
      resetFeedback.textContent = "Failed to reset";
      resetFeedback.style.color = "var(--accent-red)";
    }
  });
}
