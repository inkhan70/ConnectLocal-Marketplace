
# 🚀 Step-by-Step GitHub Export Guide

Follow these simple steps to move your project from Firebase Studio to a professional local development environment.

### Step 1: Create your GitHub Personal Access Token (PAT)
1. Go to your [GitHub Settings](https://github.com/settings/tokens/new).
2. Give it a name (e.g., `ConnectLocal-Export`).
3. Set Expiration to **No Expiration**.
4. **IMPORTANT:** Check the box next to **`repo`**.
5. Click **Generate Token** and **COPY it immediately**. You will use this as your password.

### Step 2: Open the Terminal in Firebase Studio
Copy and paste these commands one by one into the terminal at the bottom of the screen. Replace `<your-repo-url>` with your actual GitHub repository URL.

```bash
# 1. Initialize git
git init

# 2. Add your GitHub as the destination
# (If you see an error about 'origin' existing, run 'git remote remove origin' first)
git remote add origin <your-repo-url>

# 3. Stage and save your code
git add .
git commit -m "Final migration from Firebase Studio"

# 4. Push to GitHub
# When prompted for a password, PASTE your Personal Access Token (PAT).
git push -u origin master --force
```

### Step 3: Start Building Locally
Once your code is on GitHub:
1. Download [Cursor](https://cursor.com/) or VS Code.
2. Clone your repository to your machine.
3. Open a terminal in the folder and type `npm install`.
4. Run `npm run build` to verify everything is perfect!
