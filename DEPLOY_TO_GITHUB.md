# 🚀 Simple GitHub Export Guide

Follow these steps to move your project from Firebase Studio to GitHub.

### Step 1: Copy your GitHub Personal Access Token (PAT)
If you don't have one, follow the instructions in the "Migration" section of your `README.md`. It takes 1 minute to create.

### Step 2: Run these commands in the terminal below
Copy and paste these commands one by one. Replace `<your-repo-url>` with your actual GitHub URL (e.g., `https://github.com/yourname/ConnectLocal.git`).

```bash
# 1. Initialize git
git init

# 2. Add your GitHub as the destination
# (If you get an error saying 'origin' exists, run: git remote remove origin first)
git remote add origin <your-repo-url>

# 3. Save your code
git add .
git commit -m "Migration from Firebase Studio"

# 4. Push to GitHub
# When prompted for a password, PASTE your Personal Access Token (PAT).
git push -u origin master --force
```

### Step 3: Start Building Locally
Once the code is on GitHub:
1. Download [Cursor](https://cursor.com/).
2. Click "Clone Repository" and paste your GitHub URL.
3. Open the terminal in Cursor and type `npm install`.
4. Run `npm run dev` to see your app live!
