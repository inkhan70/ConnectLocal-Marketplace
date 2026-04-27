
# ConnectLocal: Professional B2B & B2C Marketplace

ConnectLocal is a robust platform designed to bridge the gap between local producers, wholesalers, distributors, shopkeepers, and customers. 

## 🌟 Key Features
- **City-Specific Search:** Find exactly what you need in your immediate vicinity.
- **Proximity-Based Listings:** Automatic discovery of businesses within 100km.
- **Secure Transaction Verification:** 14-digit pickup codes for safe product retrieval.
- **Ghost Coin Rewards:** Earn loyalty coins for every 4 items purchased.
- **AI-Powered Branding:** Instant product descriptions and business slogans using Genkit AI.

## 🛠 Tech Stack
- **Framework:** Next.js (App Router)
- **Database & Auth:** Firebase (Firestore / Storage / Auth)
- **AI Integration:** Genkit AI (Google Gemini 2.0 Flash)
- **UI Components:** ShadCN UI + Tailwind CSS

## 🚀 Moving to Production (Migration Guide)
This project was prototyped in Firebase Studio and is now ready for production scaling.

### Local Development Setup
1. **Clone the Repo:** `git clone <your-repo-url>`
2. **Install Dependencies:** `npm install`
3. **Run Dev Server:** `npm run dev`
4. **Build Check:** `npm run build`

### Recommended Roadmap
1. **Payment Integration:** Set up **Stripe** or a local mobile money gateway.
2. **Mobile Support:** Convert to a **Progressive Web App (PWA)** for home-screen installation.
3. **Notifications:** Use **Firebase Cloud Messaging (FCM)** for order and chat alerts.
4. **Escrow Logic:** Implement a system to hold funds until the pickup code is verified.

---
*Created with Firebase Studio. Ready for professional development.*
