
# 🚀 Step-by-Step GitHub Export Guide

Follow these 3 simple steps to move your project from Firebase Studio to your GitHub account and start automatic deployments.

### Step 1: Create your GitHub Password (Token)
Since GitHub doesn't allow regular passwords in the terminal, you need a "Personal Access Token":
1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new).
2. Name it: `ConnectLocal-Deploy`.
3. Set Expiration to **No Expiration**.
4. **IMPORTANT:** Check the box that says **`repo`**.
5. Click **Generate Token** and **COPY it immediately**. You will use this as your password in Step 3.

### Step 2: Prepare your GitHub Repository
1. Go to GitHub and create a **New Repository**.
2. Name it (e.g., `ConnectLocal-Marketplace`).
3. Leave it empty (do not add a README or License yet).
4. Copy the URL of your new repository (it looks like `https://github.com/your-username/your-repo.git`).

### Step 3: Run these commands in the Terminal
Open the terminal at the bottom of the screen and paste these commands one by one. Replace `<YOUR_REPO_URL>` with the URL you copied in Step 2.

```bash
# 1. Initialize your project
git init

# 2. Add your GitHub repository as the destination
# (If you see an error about 'origin' existing, run 'git remote remove origin' first)
git remote add origin <YOUR_REPO_URL>

# 3. Save all your current code
git add .
git commit -m "Initial export from Firebase Studio"

# 4. Upload your code to GitHub
# When prompted for a USERNAME, enter your GitHub username.
# When prompted for a PASSWORD, PASTE the token you copied in Step 1.
git push -u origin master --force
```

### What happens next?
Once your code is on GitHub, go to the [Firebase Console](https://console.firebase.google.com/), select **App Hosting**, and connect your repository. Every time you push new code to GitHub in the future, your app will update automatically!
