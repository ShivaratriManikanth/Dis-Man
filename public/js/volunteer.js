// ============================================================
//  VOLUNTEER.JS
//  - Auth guard (volunteer role only)
//  - "My Tasks" tab: tasks assigned to this volunteer
//  - "Available" tab: unassigned pending tasks to self-accept
//  - Allow volunteer to mark their assigned tasks as completed
// ============================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- State -------------------------------------------------
let allTasks         = [];
let currentVolunteer = null;
let currentView      = 'mine'; // 'mine' | 'available'

// ---- Auth Guard --------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  const snap    = await getDoc(doc(db, 'Users', user.uid));
  const profile = snap.exists() ? snap.data() : null;

  if (!profile || profile.role !== 'volunteer') {
    alert('Access denied. This page is for Volunteers only.');
    window.location.href = 'index.html';
    return;
  }

  // Verification Check
  if (profile.verified !== true) {
    alert('Access denied. Your profile is pending verification by the administrator.');
    await signOut(auth);
    window.location.href = 'index.html';
    return;
  }

  currentVolunteer = { name: profile.name, email: user.email, uid: user.uid };

  document.getElementById('volunteerName').textContent =
    `Welcome, ${profile.name}! 🤝`;

  fetchTasks();
});

// ---- Tab switching -----------------------------------------
window.switchTab = function (view) {
  currentView = view;
  document.getElementById('tabMine').classList.toggle('active', view === 'mine');
  document.getElementById('tabAvailable').classList.toggle('active', view === 'available');
  document.getElementById('taskSectionTitle').textContent =
    view === 'mine' ? 'My Assigned Tasks' : 'Available Tasks (Unassigned)';
  applyFilters();
};

// ---- Fetch Tasks -------------------------------------------
async function fetchTasks() {
  const spinner   = document.getElementById('loadingSpinner');
  const container = document.getElementById('tasksContainer');
  spinner.style.display = 'block';
  container.innerHTML   = '';

  try {
    const q    = query(collection(db, 'Requests'));
    const snap = await getDocs(q);

    allTasks = [];
    snap.forEach(d => allTasks.push({ id: d.id, ...d.data() }));

    spinner.style.display = 'none';
    updateStats(allTasks);
    applyFilters();

  } catch (err) {
    console.error('Fetch error:', err);
    spinner.style.display = 'none';
    showAlert('Failed to load tasks: ' + err.message, 'error');
  }
}

// ---- Render Tasks as Cards ---------------------------------
function renderTasks(tasks) {
  const container = document.getElementById('tasksContainer');

  if (tasks.length === 0) {
    const msg = currentView === 'mine'
      ? 'No tasks are assigned to you yet. Please wait for the administrator to assign a task.'
      : 'No unassigned tasks available right now.';
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${currentView === 'mine' ? '📋' : '🎉'}</div>
        <p>${msg}</p>
      </div>`;
    return;
  }

  const severityColors = {
    Critical: '#e63946',
    High:     '#f4a261',
    Medium:   '#ffc107',
    Low:      '#2dc653'
  };

  const typeEmojis = {
    'Flood':             '🌊',
    'Fire':              '🔥',
    'Earthquake':        '🌍',
    'Cyclone':           '🌀',
    'Landslide':         '⛰️',
    'Medical Emergency': '🏥',
    'Building Collapse': '🏚️',
    'Chemical Spill':    '☣️',
    'Tsunami':           '🌊',
    'Other':             '🔶'
  };

  let html = '<div class="requests-grid">';

  tasks.forEach(t => {
    const isCompleted = t.status === 'Completed';
    const date        = t.createdAt
      ? new Date(t.createdAt.seconds * 1000).toLocaleString()
      : 'Unknown time';
    const emoji       = typeEmojis[t.type] || '🔶';
    const sevColor    = severityColors[t.severity] || '#888';
    const hasLocation = t.latitude && t.longitude;

    const mapsUrl = hasLocation
      ? `https://www.google.com/maps/dir/?api=1&destination=${t.latitude},${t.longitude}`
      : null;

    let actionBtn = '';
    if (currentView === 'available') {
      actionBtn = `<span style="color:#64748b;font-size:0.83rem;font-weight:600;background:#f1f5f9;padding:6px 12px;border-radius:6px;display:inline-block;">⏳ Awaiting Assignment</span>`;
    } else if (!isCompleted) {
      actionBtn = `<button class="btn btn-success" style="padding:7px 14px;font-size:0.83rem;"
                     onclick="window.completeTask('${t.id}', this)">
                     ✅ Mark Completed
                   </button>`;
    } else {
      actionBtn = `<span style="color:#2dc653;font-size:0.85rem;font-weight:600;">✅ Task Completed</span>`;
    }

    html += `
      <div class="task-card ${isCompleted ? 'completed' : ''}">
        <div class="task-header">
          <div>
            <div class="task-type">${emoji} ${t.type}</div>
            <h3>${t.description.substring(0, 55)}${t.description.length > 55 ? '…' : ''}</h3>
          </div>
          <span class="badge ${isCompleted ? 'badge-completed' : 'badge-pending'}">
            ${isCompleted ? '✅' : '⏳'} ${t.status}
          </span>
        </div>

        <p>${t.description}</p>

        <div class="task-detail-row">
          <span>
            <strong style="color:${sevColor};">●</strong>
            ${t.severity || 'Medium'} severity
          </span>
          <span>📅 ${date}</span>
          ${hasLocation
            ? `<span>📍 ${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)}</span>`
            : '<span>📍 No GPS</span>'}
          ${t.contactName  ? `<span>👤 ${t.contactName}</span>`  : ''}
          ${t.contactPhone ? `<span>📞 ${t.contactPhone}</span>` : ''}
        </div>

        <div class="card-actions">
          ${hasLocation
            ? `<a href="${mapsUrl}" target="_blank"
                 class="btn btn-secondary" style="padding:7px 14px;font-size:0.83rem;">
                 🗺️ Get Directions
               </a>`
            : ''}
          ${actionBtn}
          <span style="font-size:0.75rem;color:#ccc;margin-left:auto;align-self:center;">
            #${t.id.substring(0, 8)}
          </span>
        </div>
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ---- Accept an unassigned task -----------------------------
window.acceptTask = async function (taskId, btn) {
  btn.disabled    = true;
  btn.textContent = '⏳…';

  try {
    await updateDoc(doc(db, 'Requests', taskId), {
      assignedTo:      currentVolunteer.uid,
      assignedToName:  currentVolunteer.name,
      assignedToEmail: currentVolunteer.email,
      updatedAt:       serverTimestamp()
    });

    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      allTasks[idx].assignedTo      = currentVolunteer.uid;
      allTasks[idx].assignedToName  = currentVolunteer.name;
      allTasks[idx].assignedToEmail = currentVolunteer.email;
    }

    showAlert('Task accepted! You can find it under "My Tasks".', 'success');
    updateStats(allTasks);
    window.switchTab('mine');

  } catch (err) {
    console.error('Accept error:', err);
    showAlert('Failed to accept task: ' + err.message, 'error');
    alert('Error accepting task: ' + err.message);
    btn.disabled    = false;
    btn.textContent = '🙋 Accept Task';
  }
};

// ---- Mark Task as Completed --------------------------------
window.completeTask = async function (taskId, btn) {
  btn.disabled    = true;
  btn.textContent = '⏳ Updating…';

  try {
    await updateDoc(doc(db, 'Requests', taskId), {
      status:           'Completed',
      updatedAt:        serverTimestamp(),
      completedBy:      currentVolunteer?.name  || 'Volunteer',
      completedByEmail: currentVolunteer?.email || '',
      completedByUid:   currentVolunteer?.uid   || ''
    });

    const idx = allTasks.findIndex(t => t.id === taskId);
    if (idx !== -1) allTasks[idx].status = 'Completed';

    showAlert('Task marked as completed. Great work! 🎉', 'success');
    updateStats(allTasks);
    applyFilters();

  } catch (err) {
    console.error('Update error:', err);
    showAlert('Failed to update task: ' + err.message, 'error');
    alert('Error marking completed: ' + err.message);
    btn.disabled    = false;
    btn.textContent = '✅ Mark Completed';
  }
};

// ---- Stats -------------------------------------------------
function updateStats(tasks) {
  const myTasks   = tasks.filter(t => t.assignedTo === currentVolunteer?.uid);
  const available = tasks.filter(t => !t.assignedTo && t.status === 'Pending');

  document.getElementById('statTotal').textContent     = myTasks.length;
  document.getElementById('statPending').textContent   = myTasks.filter(t => t.status === 'Pending').length;
  document.getElementById('statCompleted').textContent = myTasks.filter(t => t.status === 'Completed').length;
  document.getElementById('statAvailable').textContent = available.length;
}

// ---- Filters -----------------------------------------------
function applyFilters() {
  const status   = document.getElementById('filterStatus').value;
  const severity = document.getElementById('filterSeverity').value;
  const type     = document.getElementById('filterType').value;

  let filtered = allTasks;

  if (currentView === 'mine') {
    filtered = filtered.filter(t => t.assignedTo === currentVolunteer?.uid);
  } else {
    filtered = filtered.filter(t => !t.assignedTo && t.status === 'Pending');
  }

  if (status   !== 'all') filtered = filtered.filter(t => t.status   === status);
  if (severity !== 'all') filtered = filtered.filter(t => t.severity === severity);
  if (type     !== 'all') filtered = filtered.filter(t => t.type     === type);

  renderTasks(filtered);
}

document.getElementById('filterStatus').addEventListener('change',   applyFilters);
document.getElementById('filterSeverity').addEventListener('change', applyFilters);
document.getElementById('filterType').addEventListener('change',     applyFilters);
document.getElementById('refreshBtn').addEventListener('click',      fetchTasks);

// ---- Alert helper ------------------------------------------
function showAlert(message, type = 'info') {
  const box = document.getElementById('alertBox');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  box.innerHTML = `
    <div class="alert alert-${type}">
      <span>${icons[type]}</span>
      <span>${message}</span>
    </div>`;
  setTimeout(() => { box.innerHTML = ''; }, 5000);
}
