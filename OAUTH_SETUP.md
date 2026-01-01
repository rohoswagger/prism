# Setting up GitHub OAuth for Prism

To make the "Connect to GitHub" feature work, you need to register a GitHub OAuth App and provide its Client ID.

## 1. Create a GitHub OAuth App

1. Go to **GitHub Settings** > **Developer settings** > **OAuth Apps**.
   - Direct link: [https://github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**.
3. Fill in the form:
   - **Application Name**: `Prism` (or whatever you prefer)
   - **Homepage URL**: `http://localhost:1420`
   - **Authorization callback URL**: `http://localhost:1420` (This is not used for Device Flow, but required)
   - **Enable Device Flow**: **CRITICAL!** You must check "Enable Device Flow" option (it might be in a separate box or you might need to enable it after creation in the app settings -- look for "Device flow" checkbox).

## 2. Get the Client ID

1. After creating the app, copy the **Client ID** (it looks like `Ov23...`).
2. You do **NOT** need a Client Secret for Device Flow.

## 3. Configure Prism

1. Open `src-tauri/src/github.rs`.
2. Find the line:
   ```rust
   const GITHUB_CLIENT_ID: &str = "YOUR_CLIENT_ID_HERE";
   ```
   (Currently it might be a placeholder).
3. Replace the string with your new Client ID.

## 4. Run the App

1. Restart the development server: `npm run tauri dev`.
2. Click "Connect to GitHub".
3. A browser window should open with an activation code.
4. Enter the code shown in your terminal (or it might verify automatically if the link is correct).
