
# 🚀 Step-by-Step GitHub Export Guide

Follow these steps exactly to move your project to GitHub.

### Step 1: Create your GitHub Password (Token)
1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new).
2. Name it: `ConnectLocal-Deploy`.
3. Set Expiration to **No Expiration**.
4. **IMPORTANT:** Check the box that says **`repo`**.
5. Click **Generate Token** and **COPY it immediately**. You will use this as your password in the terminal.

### Step 2: Prepare your GitHub Repository
1. Go to GitHub and create a **New Repository**.
2. Name it: `ConnectLocal-Marketplace`.
3. Leave it empty (do not add a README or License yet).
4. Copy the URL of your new repository (e.g., `https://github.com/your-username/ConnectLocal-Marketplace.git`).

### Step 3: Run these commands in the Terminal
Copy and paste these commands **one by one** into the terminal at the bottom of your screen. 
*Note: Replace `<YOUR_REPO_URL>` with the URL you copied in Step 2.*

```bash
# 1. Prepare the connection
git remote add origin <YOUR_REPO_URL>

# 2. Save your code
git add .
git commit -m "Final production-ready export"

# 3. Upload to GitHub
# When prompted for a USERNAME, enter your GitHub username.
# When prompted for a PASSWORD, PASTE the token you copied in Step 1.
git push -u origin master --force
```

### What happens next?
Once your code is on GitHub, go to the [Firebase Console](https://console.firebase.google.com/), select **App Hosting**, and connect your repository. Your app will build and deploy automatically!
