/**
 * Prism - GitHub PR Menu Bar App
 * Main Application Logic
 */

// Get Tauri APIs
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

// State
let isAuthenticated = false;
let pullRequests = {
  needsReview: [],
  approved: [],
  waitingForReviewers: [],
  drafts: [],
};

// DOM Elements
const elements = {
  app: null,
  connectionScreen: null,
  mainView: null,
  loading: null,
  connectBtn: null,
  refreshBtn: null,
  openGithubBtn: null,
  quitBtn: null,
  reviewList: null,
  approvedList: null,
  waitingList: null,
  draftsList: null,
  connectionCodeDisplay: null,
  deviceCode: null,
};

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeElements();
  setupEventListeners();
  checkAuthStatus();
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
  elements.app = document.getElementById("app");
  elements.connectionScreen = document.getElementById("connection-screen");
  elements.mainView = document.getElementById("main-view");
  elements.loading = document.getElementById("loading");
  elements.connectBtn = document.getElementById("connect-btn");
  elements.refreshBtn = document.getElementById("refresh-btn");
  elements.openGithubBtn = document.getElementById("open-github-btn");
  elements.quitBtn = document.getElementById("quit-btn");
  elements.reviewList = document.getElementById("review-list");
  elements.approvedList = document.getElementById("approved-list");
  elements.waitingList = document.getElementById("waiting-list");
  elements.draftsList = document.getElementById("drafts-list");
  elements.connectionCodeDisplay = document.getElementById(
    "connection-code-display"
  );
  elements.deviceCode = document.getElementById("device-code");
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Connect button
  elements.connectBtn?.addEventListener("click", handleConnect);

  // Refresh button
  elements.refreshBtn?.addEventListener("click", handleRefresh);

  // Open GitHub button
  elements.openGithubBtn?.addEventListener("click", handleOpenGitHub);

  // Quit button
  elements.quitBtn?.addEventListener("click", handleQuit);

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.metaKey && e.key === "q") {
      e.preventDefault();
      handleQuit();
    }
    if (e.metaKey && e.key === "r") {
      e.preventDefault();
      handleRefresh();
    }
  });
}

/**
 * Check if user is authenticated
 */
async function checkAuthStatus() {
  try {
    const token = await invoke("get_github_token");
    if (token) {
      isAuthenticated = true;
      showMainView();
      await fetchPullRequests();
    } else {
      showConnectionScreen();
    }
  } catch (error) {
    console.log("Not authenticated, showing connection screen");
    showConnectionScreen();
  }
}

/**
 * Handle GitHub connection
 */
async function handleConnect() {
  // UI Setup for Code Flow
  elements.connectBtn.classList.add("hidden");
  elements.connectionCodeDisplay.classList.remove("hidden");
  elements.deviceCode.textContent = "Loading...";

  try {
    // 1. Request Code
    const authParams = await invoke("request_device_code");

    // 2. Display Code
    elements.deviceCode.textContent = authParams.user_code;

    // 3. Poll for Token
    const token = await invoke("poll_for_token", {
      deviceCode: authParams.device_code,
      interval: authParams.interval,
      expiresIn: authParams.expires_in,
    });

    if (token) {
      isAuthenticated = true;
      showMainView();
      await fetchPullRequests();
    } else {
      throw new Error("No token received");
    }
  } catch (error) {
    console.error("Authentication failed:", error);

    // Reset UI
    elements.connectBtn.classList.remove("hidden");
    elements.connectionCodeDisplay.classList.add("hidden");

    // Temporarily show error in connection title
    const title = document.querySelector(".connection-title");
    const originalText = title.textContent;
    title.textContent = "Connection Failed. Try again.";
    title.style.color = "var(--status-failure)";
    setTimeout(() => {
      title.textContent = originalText;
      title.style.color = "";
    }, 3000);
  }
}

/**
 * Handle refresh
 */
async function handleRefresh() {
  if (!isAuthenticated) return;

  const refreshIcon = elements.refreshBtn?.querySelector("svg");
  refreshIcon?.classList.add("pulse");

  try {
    await fetchPullRequests();
  } finally {
    refreshIcon?.classList.remove("pulse");
  }
}

/**
 * Handle open GitHub
 */
async function handleOpenGitHub() {
  try {
    await invoke("open_github");
  } catch (error) {
    // Fallback: open in default browser
    window.open("https://github.com/pulls", "_blank");
  }
}

/**
 * Handle quit
 */
async function handleQuit() {
  try {
    await invoke("quit_app");
  } catch (error) {
    console.error("Failed to quit:", error);
  }
}

/**
 * Fetch pull requests from GitHub
 */
async function fetchPullRequests() {
  try {
    const prs = await invoke("fetch_pull_requests");

    pullRequests = {
      needsReview: prs.needs_review || [],
      approved: prs.approved || [],
      waitingForReviewers: prs.waiting_for_reviewers || [],
      drafts: prs.drafts || [],
    };

    renderPullRequests();
  } catch (error) {
    console.error("Failed to fetch PRs:", error);
    if (error.includes("Not authenticated") || error.includes("401")) {
      isAuthenticated = false;
      showConnectionScreen();
    }
  }
}

/**
 * Render pull requests to the DOM
 */
function renderPullRequests() {
  // Get section elements
  const reviewSection = document.getElementById("section-review");
  const approvedSection = document.getElementById("section-approved");
  const waitingSection = document.getElementById("section-waiting");
  const draftsSection = document.getElementById("section-drafts");

  // Render each section
  renderPRList(
    elements.reviewList,
    pullRequests.needsReview,
    "needs-review",
    reviewSection
  );
  renderPRList(
    elements.approvedList,
    pullRequests.approved,
    "approved",
    approvedSection
  );
  renderPRList(
    elements.waitingList,
    pullRequests.waitingForReviewers,
    "waiting",
    waitingSection
  );
  renderPRList(
    elements.draftsList,
    pullRequests.drafts,
    "draft",
    draftsSection
  );
}

/**
 * Render a list of PRs
 */
function renderPRList(container, prs, type, section) {
  if (!container) return;

  if (prs.length === 0) {
    // Hide the entire section if there are no PRs
    if (section) {
      section.classList.add("hidden");
    }
    return;
  }

  // Show the section if it has PRs
  if (section) {
    section.classList.remove("hidden");
  }

  container.innerHTML = prs.map((pr) => createPRItem(pr, type)).join("");

  // Add click handlers
  container.querySelectorAll(".pr-item").forEach((item, index) => {
    item.addEventListener("click", () => {
      openPR(prs[index].url);
    });
  });
}

/**
 * Create PR item HTML
 */
function createPRItem(pr, type) {
  const statusBadge =
    pr.status === "approved"
      ? '<svg class="pr-status-check" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : pr.status === "changes_requested"
      ? '<span class="pr-status-badge changes">Changes</span>'
      : "";

  return `
    <div class="pr-item ${type} fade-in">
      <div class="pr-title">${escapeHtml(pr.title)}</div>
      ${statusBadge}
    </div>
  `;
}

/**
 * Open a PR URL
 */
async function openPR(url) {
  try {
    await invoke("open_url", { url });
  } catch (error) {
    window.open(url, "_blank");
  }
}

/**
 * Show connection screen
 */
function showConnectionScreen() {
  elements.connectionScreen?.classList.remove("hidden");
  elements.mainView?.classList.add("hidden");
}

/**
 * Show main view
 */
function showMainView() {
  elements.connectionScreen?.classList.add("hidden");
  elements.mainView?.classList.remove("hidden");
}

/**
 * Show/hide loading state
 */
function showLoading(show) {
  if (show) {
    elements.loading?.classList.remove("hidden");
  } else {
    elements.loading?.classList.add("hidden");
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Auto-refresh every 5 minutes
setInterval(() => {
  if (isAuthenticated) {
    fetchPullRequests();
  }
}, 5 * 60 * 1000);
