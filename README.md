
# ConnectLocal: Professional B2B Marketplace

Welcome to **ConnectLocal**, a high-scale B2B platform connecting producers, wholesalers, distributors, and shopkeepers. This project is ready for professional scaling and production deployment.

## 🚀 Getting Started Locally

To continue building ConnectLocal on your own machine, follow these simple steps:

1.  **Clone the Repo:** `git clone <your-repo-url>`
2.  **Install Dependencies:** `npm install`
3.  **Run Development Server:** `npm run dev`
4.  **Build for Production:** `npm run build`

## 🛠 Project Roadmap

### Phase 1: Commercial Foundations
*   **Secure Payments:** Integrate [Stripe](https://stripe.com) to handle B2B transactions.
*   **Escrow System:** Implement logic to release funds only when the 14-digit pickup code is verified.

### Phase 2: Mobile Engagement
*   **PWA:** Add a `manifest.json` and service worker to make the app installable on Android and iOS.
*   **FCM Notifications:** Use Firebase Cloud Messaging to alert users of new chat messages and order updates.

### Phase 3: AI-Driven Logistics
*   **Smart Sourcing:** Use Genkit to analyze price trends and suggest the cheapest distributors.
*   **Auto-Inventory:** Use Gemini to scan invoices/receipts to update product counts automatically.

## 📦 Tech Stack
*   **Framework:** Next.js (App Router)
*   **Styling:** Tailwind CSS + ShadCN UI
*   **Database & Auth:** Firebase (Firestore / Auth / Storage)
*   **AI:** Genkit AI (Gemini 2.0 Flash)

---

## 🏗 Migration Guide (Post-Firebase Studio)

If you are seeing authentication errors when pushing to GitHub from the terminal, follow these steps:

1.  **Create a GitHub PAT:** Go to GitHub Settings -> Developer Settings -> Personal Access Tokens (Classic). Create a token with **`repo`** scopes.
2.  **Use as Password:** When `git push` asks for your password, paste the token instead.
3.  **Local Tools:** We highly recommend using **Cursor IDE** for the best AI-assisted development experience.
