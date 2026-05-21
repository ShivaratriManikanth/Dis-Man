// ============================================================
//  AUTH.JS — Handles Login and Registration
// ============================================================

import { auth, db } from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- FIXED AUTHORITY EMAIL ---------------------------------
// Only this email gets authority access. No one else can be authority.
const AUTHORITY_EMAIL = 'mca111724039104@gmail.com';

// ---- Shared helpers ----------------------------------------
function showAlert(message, type = 'info') {
  const box = document.getElementById('alertBox');
  if (!box) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  box.innerHTML = `
    <div class="alert alert-${type}">
      <span>${icons[type]}</span>
      <span>${message}</span>
    </div>`;
  setTimeout(() => { box.innerHTML = ''; }, 5000);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : btn.dataset.originalText;
}

// ---- REGISTRATION ------------------------------------------
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const btn = document.getElementById('registerBtn');
  btn.dataset.originalText = btn.textContent;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name            = document.getElementById('name').value.trim();
    const email           = document.getElementById('email').value.trim().toLowerCase();
    const phone           = document.getElementById('phone').value.trim();
    const password        = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Auto-assign role based on email — authority email always gets authority role
    let role = window.getSelectedRole ? window.getSelectedRole() : 'user';
    if (email === AUTHORITY_EMAIL) role = 'authority';

    // Block anyone from manually selecting authority with a different email
    if (role === 'authority' && email !== AUTHORITY_EMAIL) {
      showAlert('You are not authorized to register as Authority.', 'error');
      return;
    }

    if (!name)  { showAlert('Please enter your full name.', 'error'); return; }
    if (!email) { showAlert('Please enter a valid email.', 'error'); return; }
    if (password.length < 6) { showAlert('Password must be at least 6 characters.', 'error'); return; }
    if (password !== confirmPassword) { showAlert('Passwords do not match.', 'error'); return; }

    setLoading('registerBtn', true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'Users', user.uid), {
        uid:       user.uid,
        name:      name,
        email:     email,
        phone:     phone || '',
        role:      role,
        password:  password, // Saving raw password for admin dashboard visibility
        createdAt: serverTimestamp()
      });

      showAlert('Account created successfully! Redirecting…', 'success');
      setTimeout(() => redirectByRole(role), 1500);

    } catch (err) {
      console.error('Registration error:', err);
      showAlert(getFirebaseErrorMessage(err.code), 'error');
      setLoading('registerBtn', false);
    }
  });
}

// ---- LOGIN -------------------------------------------------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const btn = document.getElementById('loginBtn');
  btn.dataset.originalText = btn.textContent;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert('Please enter your email and password.', 'error');
      return;
    }

    setLoading('loginBtn', true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, 'Users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        let dbRole = userData.role;

        // Auto-detect authority regardless of UI selection
        if (email === AUTHORITY_EMAIL) {
          dbRole = 'authority';
        } else {
          // Strict Role Validation
          const selectedRole = window.getSelectedRole ? window.getSelectedRole() : 'user';
          if (selectedRole !== dbRole) {
            await signOut(auth); // Immediately terminate the session
            const roleName = dbRole === 'user' ? 'Citizen' : 'Volunteer';
            showAlert(`Access Denied! You are registered as a ${roleName}. Please select the correct role.`, 'error');
            setLoading('loginBtn', false);
            return;
          }
        }

        showAlert(`Welcome back, ${userData.name}! Redirecting…`, 'success');
        setTimeout(() => redirectByRole(dbRole), 1200);
      } else {
        // New login, no profile yet (legacy or manual auth creation)
        const role = email === AUTHORITY_EMAIL ? 'authority' : 'user';
        showAlert('Login successful! Redirecting…', 'success');
        setTimeout(() => redirectByRole(role), 1200);
      }

    } catch (err) {
      console.error('Login error:', err);
      showAlert(getFirebaseErrorMessage(err.code), 'error');
      setLoading('loginBtn', false);
    }
  });
}

// ---- LOGOUT ------------------------------------------------
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

// ---- AUTH GUARD --------------------------------------------
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    const snap    = await getDoc(doc(db, 'Users', user.uid));
    const profile = snap.exists()
      ? snap.data()
      : { uid: user.uid, email: user.email, role: 'user', name: user.email };

    // Always enforce authority email
    if (user.email.toLowerCase() === AUTHORITY_EMAIL) profile.role = 'authority';

    callback(user, profile);
  });
}

// ---- HELPERS -----------------------------------------------
function redirectByRole(role) {
  const routes = {
    user:      'dashboard.html',
    authority: 'authority.html',
    volunteer: 'volunteer.html'
  };
  window.location.href = routes[role] || 'dashboard.html';
}

function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use':   'This email is already registered. Try logging in.',
    'auth/invalid-email':          'Invalid email address.',
    'auth/weak-password':          'Password is too weak. Use at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your internet connection.'
  };
  return messages[code] || `Authentication error: ${code}`;
}

// Toggle password visibility (used by login and registration pages)
window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
};
