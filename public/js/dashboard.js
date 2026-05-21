// ============================================================
//  DASHBOARD.JS — User Dashboard
//  Loads user profile and their submitted requests
// ============================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- Auth Guard -------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Load profile
  const userSnap = await getDoc(doc(db, 'Users', user.uid));
  const profile  = userSnap.exists() ? userSnap.data() : { name: user.email, role: 'user' };

  // Redirect if wrong role lands here
  if (profile.role === 'authority') { window.location.href = 'authority.html'; return; }
  if (profile.role === 'volunteer') { window.location.href = 'volunteer.html'; return; }

  // Update welcome banner
  document.getElementById('welcomeName').textContent  = `Welcome, ${profile.name} 👋`;
  document.getElementById('welcomeEmail').textContent = `Signed in as ${user.email} · Role: Citizen`;

  // Load requests
  loadMyRequests(user.uid);
});

// ---- Load user's requests ----------------------------------
async function loadMyRequests(uid) {
  const spinner   = document.getElementById('loadingSpinner');
  const container = document.getElementById('requestsContainer');

  try {
    const q    = query(
      collection(db, 'Requests'),
      where('userId', '==', uid)
    );
    const snap = await getDocs(q);

    spinner.style.display = 'none';

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>You have not submitted any emergency requests yet.</p>
          <a href="emergency.html" class="btn btn-primary mt-2">Submit First Request</a>
        </div>`;
      updateStats(0, 0, 0);
      return;
    }

    let total = 0, pending = 0, completed = 0;
    let cards  = '';

    snap.forEach(docSnap => {
      const r = docSnap.data();
      const id = docSnap.id;
      total++;
      if (r.status === 'Completed') completed++;
      else pending++;

      const date = r.createdAt
        ? new Date(r.createdAt.seconds * 1000).toLocaleString()
        : 'Just now';

      cards += `
        <div class="request-card ${r.status === 'Completed' ? 'completed' : ''}">
          <div class="request-type">${getSeverityEmoji(r.severity)} ${r.type}</div>
          <h3>${r.description.substring(0, 60)}${r.description.length > 60 ? '…' : ''}</h3>
          <p>${r.description}</p>
          <div class="meta">
            <span>📅 ${date}</span>
            <span>🌐 ${r.latitude ? r.latitude.toFixed(4) : 'N/A'}, ${r.longitude ? r.longitude.toFixed(4) : 'N/A'}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span class="badge ${r.status === 'Completed' ? 'badge-completed' : 'badge-pending'}">
              ${r.status === 'Completed' ? '✅' : '⏳'} ${r.status}
            </span>
            <span class="badge badge-active" style="font-size:0.75rem;">ID: ${id.substring(0, 8)}…</span>
          </div>
          ${r.latitude ? `
          <div class="card-actions mt-2">
            <a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}"
               target="_blank" class="btn btn-outline" style="font-size:0.82rem;padding:6px 12px;">
              🗺️ View on Map
            </a>
          </div>` : ''}
        </div>`;
    });

    updateStats(total, pending, completed);
    container.innerHTML = `<div class="requests-grid">${cards}</div>`;

  } catch (err) {
    console.error('Error loading requests:', err);
    spinner.style.display = 'none';
    container.innerHTML = `
      <div class="alert alert-error">
        ❌ Failed to load requests. Please refresh the page.
      </div>`;
  }
}

function updateStats(total, pending, completed) {
  document.getElementById('totalRequests').textContent     = total;
  document.getElementById('pendingRequests').textContent   = pending;
  document.getElementById('completedRequests').textContent = completed;
}

function getSeverityEmoji(severity) {
  const map = { Low: '🟢', Medium: '🟡', High: '🔴', Critical: '🚨' };
  return map[severity] || '🔶';
}
