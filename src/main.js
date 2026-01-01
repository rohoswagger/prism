/**
 * Prism - GitHub PR Menu Bar App
 * Main Application Logic
 */

// Get Tauri APIs
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

const MAX_WINDOW_HEIGHT = 400;
const MIN_WINDOW_HEIGHT = 200;

/**
 * Resize window to fit content
 */
async function resizeWindowToContent() {
  try {
    const appContainer = document.querySelector(".app-container");
    if (!appContainer) return;

    // Calculate content height
    const contentHeight = appContainer.scrollHeight;
    const targetHeight = Math.min(
      Math.max(contentHeight, MIN_WINDOW_HEIGHT),
      MAX_WINDOW_HEIGHT
    );

    const win = getCurrentWindow();
    const size = await win.innerSize();

    if (Math.abs(size.height - targetHeight) > 5) {
      await win.setSize({ width: 340, height: targetHeight });
    }
  } catch (e) {
    console.log("Could not resize window:", e);
  }
}

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
  reviewCount: null,
  approvedCount: null,
  waitingCount: null,
  draftsCount: null,
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
  elements.reviewCount = document.getElementById("review-count");
  elements.approvedCount = document.getElementById("approved-count");
  elements.waitingCount = document.getElementById("waiting-count");
  elements.draftsCount = document.getElementById("drafts-count");
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
  // DEV_MODE: Set to true to preview UI with mock data
  const DEV_MODE = true;

  if (DEV_MODE) {
    isAuthenticated = true;
    showMainView();
    useMockData();
    return;
  }

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
  showLoading(true);

  try {
    // Start OAuth flow
    await invoke("start_github_oauth");
    isAuthenticated = true;
    showMainView();
    await fetchPullRequests();
  } catch (error) {
    console.error("Failed to connect:", error);
    showConnectionScreen();
    // Could show error toast here
  } finally {
    showLoading(false);
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
    // Use mock data for development
    useMockData();
  }
}

/**
 * Use mock data for development/preview
 */
function useMockData() {
  pullRequests = {
    needsReview: [
      {
        number: 17603,
        title: "feat(keyboard): Add employees-only preference for keyboard ads",
        repo: "company/app",
        author: "alice",
        avatar: "https://avatars.githubusercontent.com/u/1?v=4",
        url: "https://github.com/company/app/pull/17603",
      },
      {
        number: 17601,
        title:
          "chore(websubmit): switch around flex layout to avoid explicit margin",
        repo: "company/app",
        author: "bob",
        avatar: "https://avatars.githubusercontent.com/u/2?v=4",
        url: "https://github.com/company/app/pull/17601",
      },
      {
        number: 17591,
        title: "fix(websubmit): use consistent ordering for reviewer list",
        repo: "company/app",
        author: "carol",
        avatar: "https://avatars.githubusercontent.com/u/3?v=4",
        url: "https://github.com/company/app/pull/17591",
      },
      {
        number: 17586,
        title: "refactor: split out reviewer into a reusable component",
        repo: "company/app",
        author: "david",
        avatar: "https://avatars.githubusercontent.com/u/4?v=4",
        url: "https://github.com/company/app/pull/17586",
      },
    ],
    approved: [
      {
        number: 17254,
        title: "make server dockerfile use same calling directory as local env",
        repo: "company/server",
        author: "eve",
        avatar: "https://avatars.githubusercontent.com/u/5?v=4",
        url: "https://github.com/company/server/pull/17254",
        status: "approved",
      },
    ],
    waitingForReviewers: [],
    drafts: [],
  };

  renderPullRequests();
}

/**
 * Render pull requests to the DOM
 */
function renderPullRequests() {
  // Update counts
  elements.reviewCount.textContent = `(${pullRequests.needsReview.length})`;
  elements.approvedCount.textContent = `(${pullRequests.approved.length})`;
  elements.waitingCount.textContent = `(${pullRequests.waitingForReviewers.length})`;
  elements.draftsCount.textContent = `(${pullRequests.drafts.length})`;

  // Render each section
  renderPRList(elements.reviewList, pullRequests.needsReview, "needs-review");
  renderPRList(elements.approvedList, pullRequests.approved, "approved");
  renderPRList(
    elements.waitingList,
    pullRequests.waitingForReviewers,
    "waiting"
  );
  renderPRList(elements.draftsList, pullRequests.drafts, "draft");

  // Resize window to fit content
  setTimeout(resizeWindowToContent, 50);
}

/**
 * Render a list of PRs
 */
function renderPRList(container, prs, type) {
  if (!container) return;

  if (prs.length === 0) {
    container.innerHTML = `<div class="empty-state">None</div>`;
    return;
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
