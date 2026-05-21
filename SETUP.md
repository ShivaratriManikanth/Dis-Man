# Smart Disaster Response — Setup Instructions

## 1. Install Node.js Dependencies

```bash
cd Dis-web
npm install
```

## 2. Set Up Firebase

1. Go to https://console.firebase.google.com
2. Click **Add Project** → give it a name → Create
3. In the left panel → **Build** → **Authentication**
   - Click **Get Started**
   - Enable **Email/Password** provider
4. In the left panel → **Build** → **Firestore Database**
   - Click **Create Database**
   - Choose **Start in test mode** (for development)
   - Select a location → Done
5. In **Project Settings** (gear icon) → **Your apps** → click `</>` (Web)
   - Register the app
   - Copy the `firebaseConfig` object

6. Open `public/js/firebase-config.js`
   - Paste your config values (replace the placeholder strings)

## 3. Set Up Google Maps API

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable the **Maps JavaScript API**
4. Create an API key under **Credentials**
5. Replace `YOUR_GOOGLE_MAPS_API_KEY` in:
   - `public/emergency.html`
   - `public/authority.html`
   - `public/volunteer.html`

## 4. Firestore Security Rules (Test Mode is fine for dev)

For production, update Firestore rules in Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own profile
    match /Users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    // Authenticated users can create requests
    // Authorities/volunteers can read & update all requests
    match /Requests/{requestId} {
      allow create: if request.auth != null;
      allow read:   if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

## 5. Run the Application

```bash
npm start
# or for hot-reload during development:
npm run dev
```

Open http://localhost:3000 in your browser.

## 6. Usage Flow

| Role       | Register As | Dashboard       | Can Do                              |
|------------|-------------|-----------------|-------------------------------------|
| Citizen    | user        | dashboard.html  | Submit emergency requests           |
| Authority  | authority   | authority.html  | View all requests, mark completed   |
| Volunteer  | volunteer   | volunteer.html  | View tasks, get directions, mark done |

## Pages

| Page                | File                   |
|---------------------|------------------------|
| Login               | public/index.html      |
| Register            | public/register.html   |
| User Dashboard      | public/dashboard.html  |
| Emergency Request   | public/emergency.html  |
| Authority Dashboard | public/authority.html  |
| Volunteer Dashboard | public/volunteer.html  |
