// ============================================================
//  FIREBASE CONFIGURATION
//  Replace all values below with your own Firebase project
//  credentials from: https://console.firebase.google.com
//
//  Steps:
//  1. Go to Firebase Console → Create Project
//  2. Add a Web App  →  copy the firebaseConfig object
//  3. Paste values here
//  4. Enable Email/Password under Authentication → Sign-in method
//  5. Create a Firestore Database (Start in test mode for dev)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCCpOXkg_8y9l4fOFBlFwY0bXvH9WEDMC8",
  authDomain:        "dis-web-d0891.firebaseapp.com",
  projectId:         "dis-web-d0891",
  storageBucket:     "dis-web-d0891.firebasestorage.app",
  messagingSenderId: "878532863493",
  appId:             "1:878532863493:web:a251dd0a077752767f1e6c",
  measurementId:     "G-KGXPDXKE6M"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
