// GitHub API Integration
// Uses Device Flow OAuth (no server required) and GraphQL API

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const GITHUB_CLIENT_ID: &str = "Ov23liUkXjGnMzhLzpLr"; // Prism OAuth App - replace with your own
const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const GRAPHQL_URL: &str = "https://api.github.com/graphql";

#[derive(Debug, Serialize, Deserialize)]
pub struct PullRequestData {
    pub needs_review: Vec<PullRequest>,
    pub approved: Vec<PullRequest>,
    pub waiting_for_reviewers: Vec<PullRequest>,
    pub drafts: Vec<PullRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequest {
    pub number: i32,
    pub title: String,
    pub repo: String,
    pub author: String,
    pub avatar: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: i32,
    interval: i32,
}

#[derive(Debug, Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

fn get_token_path() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(".prism").join("token")
}

/// Get stored GitHub token
pub fn get_stored_token() -> Option<String> {
    let path = get_token_path();
    fs::read_to_string(path).ok()
}

/// Store GitHub token securely
fn store_token(token: &str) -> Result<(), String> {
    let path = get_token_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, token).map_err(|e| e.to_string())
}

/// Start GitHub Device Flow OAuth
/// This works entirely locally - user gets a code to enter on GitHub's website
pub async fn start_device_flow() -> Result<String, String> {
    let client = reqwest::Client::new();

    // Step 1: Request device and user codes
    let response = client
        .post(DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo read:user")])
        .send()
        .await
        .map_err(|e| format!("Failed to request device code: {}", e))?;

    let device_response: DeviceCodeResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse device code response: {}", e))?;

    // Step 2: Open browser for user to enter the code
    let _ = open::that(&device_response.verification_uri);

    println!(
        "Please enter code: {} at {}",
        device_response.user_code, device_response.verification_uri
    );

    // Step 3: Poll for access token
    let interval = std::time::Duration::from_secs(device_response.interval as u64);
    let max_attempts = device_response.expires_in / device_response.interval;

    for _ in 0..max_attempts {
        tokio::time::sleep(interval).await;

        let token_response = client
            .post(ACCESS_TOKEN_URL)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", GITHUB_CLIENT_ID),
                ("device_code", &device_response.device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await
            .map_err(|e| format!("Failed to request access token: {}", e))?;

        let token_data: AccessTokenResponse = token_response
            .json()
            .await
            .map_err(|e| format!("Failed to parse access token response: {}", e))?;

        if let Some(token) = token_data.access_token {
            store_token(&token)?;
            return Ok(token);
        }

        // If error is not "authorization_pending", stop polling
        if let Some(error) = &token_data.error {
            if error != "authorization_pending" && error != "slow_down" {
                return Err(format!("OAuth error: {}", error));
            }
        }
    }

    Err("OAuth flow timed out".to_string())
}

/// Fetch pull requests from GitHub using GraphQL
pub async fn fetch_pull_requests() -> Result<PullRequestData, String> {
    let token = get_stored_token().ok_or("Not authenticated")?;
    let client = reqwest::Client::new();

    // GraphQL query to fetch PRs
    let query = r#"
    query {
      viewer {
        login
        pullRequests(first: 50, states: [OPEN], orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            number
            title
            url
            isDraft
            repository {
              nameWithOwner
            }
            author {
              login
              avatarUrl
            }
            reviewRequests(first: 10) {
              totalCount
            }
            reviews(first: 10, states: [APPROVED, CHANGES_REQUESTED]) {
              nodes {
                state
              }
            }
          }
        }
      }
      search(query: "is:pr is:open review-requested:@me", type: ISSUE, first: 50) {
        nodes {
          ... on PullRequest {
            number
            title
            url
            isDraft
            repository {
              nameWithOwner
            }
            author {
              login
              avatarUrl
            }
          }
        }
      }
    }
    "#;

    let response = client
        .post(GRAPHQL_URL)
        .header("Authorization", format!("Bearer {}", token))
        .header("User-Agent", "Prism-App")
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch PRs: {}", e))?;

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Parse the response
    let mut needs_review = Vec::new();
    let mut approved = Vec::new();
    let mut waiting_for_reviewers = Vec::new();
    let mut drafts = Vec::new();

    // PRs that need my review (from search)
    if let Some(nodes) = data["data"]["search"]["nodes"].as_array() {
        for node in nodes {
            if let Some(pr) = parse_pr_node(node) {
                needs_review.push(pr);
            }
        }
    }

    // My PRs
    if let Some(nodes) = data["data"]["viewer"]["pullRequests"]["nodes"].as_array() {
        for node in nodes {
            if let Some(mut pr) = parse_pr_node(node) {
                let is_draft = node["isDraft"].as_bool().unwrap_or(false);
                let has_approval = node["reviews"]["nodes"]
                    .as_array()
                    .map(|reviews| reviews.iter().any(|r| r["state"] == "APPROVED"))
                    .unwrap_or(false);
                let has_review_requests =
                    node["reviewRequests"]["totalCount"].as_i64().unwrap_or(0) > 0;

                if is_draft {
                    drafts.push(pr);
                } else if has_approval {
                    pr.status = Some("approved".to_string());
                    approved.push(pr);
                } else if has_review_requests {
                    waiting_for_reviewers.push(pr);
                } else {
                    waiting_for_reviewers.push(pr);
                }
            }
        }
    }

    Ok(PullRequestData {
        needs_review,
        approved,
        waiting_for_reviewers,
        drafts,
    })
}

fn parse_pr_node(node: &serde_json::Value) -> Option<PullRequest> {
    Some(PullRequest {
        number: node["number"].as_i64()? as i32,
        title: node["title"].as_str()?.to_string(),
        repo: node["repository"]["nameWithOwner"].as_str()?.to_string(),
        author: node["author"]["login"].as_str()?.to_string(),
        avatar: node["author"]["avatarUrl"].as_str()?.to_string(),
        url: node["url"].as_str()?.to_string(),
        status: None,
    })
}
