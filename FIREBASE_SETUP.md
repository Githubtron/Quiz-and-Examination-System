# Firebase Authentication Setup Guide

Follow these steps **once** to connect Firebase to your project.
After setup the login page will support Google, Email/Password, and Phone/OTP sign-in.

---

## Step 1 — Create a Firebase project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **Add project**
3. Give it a name (e.g. `QuizMaster`)
4. You can disable Google Analytics — click **Create project**

---

## Step 2 — Enable sign-in methods

1. In the left sidebar go to **Build → Authentication**
2. Click **Get started**
3. Under the **Sign-in method** tab, enable the following providers:

| Provider | How to enable |
|---|---|
| **Google** | Toggle on → add a support email → Save |
| **Email/Password** | Toggle on → Save |
| **Phone** | Toggle on → Save |

---

## Step 3 — Add your web app & get the frontend config

1. Click the gear icon (top-left) → **Project settings**
2. Scroll down to **Your apps** → click the web icon `</>`
3. Register your app with any nickname (e.g. `quiz-frontend`) → click **Register app**
4. Copy the `firebaseConfig` object — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "12345...",
  appId: "1:12345...:web:abc..."
};
```

5. In the `quiz-exam-frontend/` folder, copy `.env.local.example` to `.env.local`:

```bash
cd quiz-exam-frontend
cp .env.local.example .env.local
```

6. Open `.env.local` and paste in the values from your `firebaseConfig`:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=12345...
VITE_FIREBASE_APP_ID=1:12345...:web:abc...
```

---

## Step 4 — Add the backend service account

1. Still in **Project settings**, click the **Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. A JSON file downloads — rename it to:

   ```
   firebase-service-account.json
   ```

4. Move it into the backend resources folder:

   ```
   online-quiz-exam-system/src/main/resources/firebase-service-account.json
   ```

5. **IMPORTANT**: Make sure this file is in `.gitignore` so it is never committed.
   Open `online-quiz-exam-system/.gitignore` (or the root `.gitignore`) and add:

   ```
   firebase-service-account.json
   ```

---

## Step 5 — Install the Firebase npm package

```bash
cd quiz-exam-frontend
npm install firebase
```

---

## Step 6 — Start both servers

```bash
# Terminal 1 — backend
cd online-quiz-exam-system
mvn spring-boot:run

# Terminal 2 — frontend
cd quiz-exam-frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the new login page.

---

## How it works (the full flow)

```
User clicks "Continue with Google"
        ↓
Firebase SDK opens a popup → user signs in → Firebase issues an ID token
        ↓
Frontend sends: POST /api/auth/firebase-login  { idToken: "..." }
        ↓
Backend verifies the token with Firebase Admin SDK
        ↓
Backend finds (or auto-creates) the user in MySQL
  • First-time users get role STUDENT — an admin can promote them later
        ↓
Backend issues its own JWT and returns { token, userId, username, role, email }
        ↓
Frontend stores the session in localStorage (qm_session) — everything else works as before
```

---

## Notes

- **Existing accounts**: users who already registered with username/password still work — the `/api/auth/login` endpoint is unchanged.
- **Phone users**: because phone auth doesn't provide an email, a placeholder email is auto-generated (`phone_<uid>@firebase.quizmaster.local`) so the account maps cleanly into your User table.
- **Role assignment**: all new Firebase sign-ins default to `STUDENT`. Promote to `PROFESSOR` or `ADMIN` via the Admin dashboard.
