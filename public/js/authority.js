// ============================================================
//  AUTHORITY.JS
//  - Auth guard (authority role only)
//  - Fetch ALL requests from Firestore
//  - Render in table with filters
//  - Update status: Pending → Completed
//  - Show all locations on Google Maps
// ============================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- Fixed authority email ---------------------------------
const AUTHORITY_EMAIL = 'mca111724039104@gmail.com';

// ---- State -------------------------------------------------
let allRequests   = [];
let allVolunteers = [];
let allCitizens   = [];
let authorityMap = null;

// ---- Auth Guard --------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }

  const snap = await getDoc(doc(db, 'Users', user.uid));
  const profile = snap.exists() ? snap.data() : null;

  const isAuthority = user.email.toLowerCase() === AUTHORITY_EMAIL || profile?.role === 'authority';
  if (!isAuthority) {
    alert('Access denied. This page is for the Authority only.');
    window.location.href = 'index.html';
    return;
  }

  const displayName = profile?.name || 'Authority';
  document.getElementById('authorityName').textContent =
    `Signed in as ${displayName} (${user.email})`;

  fetchAllRequests();
  fetchDeletedData();
});



// ---- Fetch Users (Citizens & Volunteers) -------------------
async function fetchAllUsers() {
  try {
    const snap = await getDocs(query(collection(db, 'Users')));
    allVolunteers = [];
    allCitizens   = [];
    
    snap.forEach(d => {
      const data = d.data();
      const userObj = { 
        uid: d.id, 
        name: data.name || 'Unknown', 
        email: data.email || '—', 
        phone: data.phone || '—', 
        role: data.role,
        createdAt: data.createdAt,
        password: data.password
      };
      
      if (data.role === 'volunteer') {
        allVolunteers.push(userObj);
      } else if (data.role === 'user' || !data.role) {
        // Assume 'user' means citizen, or fallback to citizen if role is undefined
        allCitizens.push(userObj);
      }
    });
    
    renderUsersList('volunteersContainer', allVolunteers);
    renderUsersList('citizensContainer', allCitizens);
    
  } catch (err) {
    console.error('Failed to load users:', err);
    document.getElementById('volunteersContainer').innerHTML = '<p style="color:red">Failed to load</p>';
    document.getElementById('citizensContainer').innerHTML = '<p style="color:red">Failed to load</p>';
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderUsersList(containerId, usersList) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (usersList.length === 0) {
    container.innerHTML = '<p style="color:#888;font-size:0.85rem;padding:20px;">No users found.</p>';
    return;
  }

  let html = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th>NAME</th><th>EMAIL</th><th>PHONE</th>
          <th>JOINED</th><th>PASSWORD</th><th>ACTIONS</th>
        </tr>
      </thead>
      <tbody>
  `;

  usersList.forEach(u => {
    const d = u.createdAt ? new Date(u.createdAt.seconds * 1000) : null;
    const joinedDate = d
      ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
      : 'N/A';

    const pwdCell = u.password
      ? `<div style="display:flex;align-items:center;gap:6px;">
           <input type="password" value="${esc(u.password)}" readonly id="pwd-${u.uid}"
                  style="border:none;background:transparent;width:90px;outline:none;font-size:13px;color:#475569;padding:0;pointer-events:none;">
           <button data-action="toggle-pwd" data-uid="${u.uid}"
                   style="background:none;border:none;cursor:pointer;font-size:14px;padding:0;color:#64748b;" title="Show/Hide">👁️</button>
         </div>`
      : '<span style="color:#94a3b8;font-size:0.8rem;">Not stored</span>';

    html += `
      <tr>
        <td data-label="NAME"><strong>${esc(u.name)}</strong></td>
        <td data-label="EMAIL" style="color:#2563eb;">${esc(u.email)}</td>
        <td data-label="PHONE" style="color:#475569;">${esc(u.phone || '—')}</td>
        <td data-label="JOINED" style="color:#64748b;">${joinedDate}</td>
        <td data-label="PASSWORD">${pwdCell}</td>
        <td data-label="ACTIONS">
          <div style="display:flex;gap:6px;">
            <button data-action="edit" data-uid="${u.uid}"
                    class="btn" style="background:#f1f5f9;color:#475569;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #cbd5e1;font-weight:600;">Edit</button>
            <button data-action="delete" data-uid="${u.uid}"
                    class="btn" style="background:#fee2e2;color:#ef4444;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #fecaca;font-weight:600;">Delete</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // Single delegated listener — works reliably from module scripts
  container.querySelector('table').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, uid } = btn.dataset;

    if (action === 'toggle-pwd') {
      const input = document.getElementById(`pwd-${uid}`);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁️' : '🙈';
    }
    if (action === 'edit')   openEditModal(uid);
    if (action === 'delete') deleteUser(uid, btn);
  });
}

// ---- Edit User Modal ---------------------------------------
window.openEditModal = function (uid) {
  const user = [...allCitizens, ...allVolunteers].find(u => u.uid === uid);
  if (!user) return;

  document.getElementById('editUserId').value        = uid;
  document.getElementById('editName').value          = user.name  || '';
  document.getElementById('editPhone').value         = user.phone || '';
  document.getElementById('editPassword').value      = user.password || '';
  document.getElementById('editPassword').type       = 'password';
  document.getElementById('toggleEditPwd').textContent = '👁️';
  document.getElementById('editModalAlert').innerHTML  = '';

  document.getElementById('editUserModal').style.display = 'flex';
};

window.closeEditModal = function () {
  document.getElementById('editUserModal').style.display = 'none';
};

window.saveUser = async function () {
  const uid      = document.getElementById('editUserId').value;
  const name     = document.getElementById('editName').value.trim();
  const phone    = document.getElementById('editPhone').value.trim();
  const password = document.getElementById('editPassword').value;

  if (!name) {
    document.getElementById('editModalAlert').innerHTML =
      '<p style="color:#e63946;font-size:0.82rem;margin-top:8px;">Name cannot be empty.</p>';
    return;
  }

  const saveBtn = document.getElementById('saveUserBtn');
  saveBtn.disabled    = true;
  saveBtn.textContent = '⏳ Saving…';

  try {
    const payload = { name, phone, updatedAt: serverTimestamp() };
    if (password) payload.password = password;

    await updateDoc(doc(db, 'Users', uid), payload);

    const patchLocal = (arr) => {
      const idx = arr.findIndex(u => u.uid === uid);
      if (idx !== -1) {
        arr[idx].name  = name;
        arr[idx].phone = phone;
        if (password) arr[idx].password = password;
      }
    };
    patchLocal(allCitizens);
    patchLocal(allVolunteers);

    window.closeEditModal();
    showAlert('User updated successfully.', 'success');
    renderUsersList('citizensContainer',   allCitizens);
    renderUsersList('volunteersContainer', allVolunteers);

  } catch (err) {
    console.error('Save error:', err);
    document.getElementById('editModalAlert').innerHTML =
      `<p style="color:#e63946;font-size:0.82rem;margin-top:8px;">Failed: ${err.message}</p>`;
  } finally {
    saveBtn.disabled    = false;
    saveBtn.textContent = '💾 Save Changes';
  }
};

function deleteUser(uid, btn) {
  const user = [...allCitizens, ...allVolunteers].find(u => u.uid === uid);
  const name = user ? user.name : 'this user';
  
  window.showConfirmModal(
    'Archive User',
    `Are you sure you want to delete ${name}? They will be moved to the Deleted Archive (Recycle Bin).`,
    async () => {
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = '…'; }

      try {
        if (!user) {
          throw new Error('User data not found in local cache');
        }
        
        // 1. Save copy to DeletedUsers
        await setDoc(doc(db, 'DeletedUsers', uid), {
          ...user,
          deletedAt: serverTimestamp()
        });

        // 2. Delete from active Users
        await deleteDoc(doc(db, 'Users', uid));

        // 3. Update active cache and UI
        allCitizens   = allCitizens.filter(u => u.uid !== uid);
        allVolunteers = allVolunteers.filter(u => u.uid !== uid);
        renderUsersList('citizensContainer',   allCitizens);
        renderUsersList('volunteersContainer', allVolunteers);
        showAlert('User moved to Deleted Archive.', 'success');

        // 4. Refresh archive
        fetchDeletedData();
      } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete user: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    },
    'Yes, Archive'
  );
}

// ---- User Search Event Listeners ---------------------------
document.getElementById('searchCitizens').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allCitizens.filter(u => 
    u.name.toLowerCase().includes(term) || 
    u.email.toLowerCase().includes(term) ||
    u.phone.toLowerCase().includes(term)
  );
  renderUsersList('citizensContainer', filtered);
});

document.getElementById('searchVolunteers').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allVolunteers.filter(u => 
    u.name.toLowerCase().includes(term) || 
    u.email.toLowerCase().includes(term) ||
    u.phone.toLowerCase().includes(term)
  );
  renderUsersList('volunteersContainer', filtered);
});

// ---- Fetch Requests ----------------------------------------
async function fetchAllRequests() {
  const spinner   = document.getElementById('loadingSpinner');
  const container = document.getElementById('tableContainer');
  spinner.style.display = 'block';
  container.innerHTML   = '';

  try {
    await fetchAllUsers();

    const q    = query(collection(db, 'Requests'));
    const snap = await getDocs(q);

    allRequests = [];
    snap.forEach(d => allRequests.push({ id: d.id, ...d.data() }));

    spinner.style.display = 'none';
    renderTable(allRequests);
    updateStats(allRequests);
    plotMapMarkers(allRequests);

  } catch (err) {
    console.error('Fetch error:', err);
    spinner.style.display = 'none';
    showAlert('Failed to load requests: ' + err.message, 'error');
  }
}

// ---- Render Table ------------------------------------------
function renderTable(requests) {
  const container = document.getElementById('tableContainer');

  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No requests match the selected filters.</p>
      </div>`;
    return;
  }

  let rows = '';
  requests.forEach(r => {
    const _rd  = r.createdAt ? new Date(r.createdAt.seconds * 1000) : null;
    const date = _rd
      ? `${String(_rd.getDate()).padStart(2,'0')}/${String(_rd.getMonth()+1).padStart(2,'0')}/${_rd.getFullYear()}`
      : '—';
    const mapLink = (r.latitude && r.longitude)
      ? `<a href="https://www.google.com/maps?q=${r.latitude},${r.longitude}" target="_blank"
           style="color:#457b9d;font-size:0.75rem;">🗺️ Map</a>`
      : '<span style="color:#ccc;font-size:0.75rem;">No GPS</span>';

    const coords = (r.latitude && r.longitude)
      ? `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`
      : '—';

    const severityColors = {
      Critical: '#e63946', High: '#f4a261', Medium: '#ffc107', Low: '#2dc653'
    };
    const severityColor = severityColors[r.severity] || '#888';

    const volOpts = allVolunteers.map(v =>
      `<option value="${v.uid}" ${r.assignedTo === v.uid ? 'selected' : ''}>${v.name}</option>`
    ).join('');

    const assignCell = r.status === 'Completed'
      ? `<span style="font-size:0.75rem;color:#2dc653;">${r.assignedToName ? `✓ ${r.assignedToName}` : '—'}</span>`
      : allVolunteers.length === 0
        ? `<span style="font-size:0.75rem;color:#ccc;">No volunteers</span>`
        : `<div style="display:flex;flex-direction:column;gap:2px;">
             <div style="display:flex;gap:3px;align-items:center;">
               <select id="vol-${r.id}" style="font-size:0.72rem;padding:2px;border-radius:4px;border:1px solid #ddd;max-width:90px;">
                 <option value="">— Select —</option>
                 ${volOpts}
               </select>
               <button class="btn" style="padding:2px 6px;font-size:0.7rem;background:#457b9d;color:#fff;border-radius:4px;"
                 onclick="assignVolunteer('${r.id}', this)">
                 ${r.assignedTo ? '↩' : 'Assign'}
               </button>
             </div>
             ${r.assignedToName ? `<span style="font-size:0.7rem;color:#2dc653;">✓ ${r.assignedToName}</span>` : ''}
           </div>`;

    rows += `
      <tr>
        <td data-label="ID" style="font-size:0.72rem;color:#888;">${r.id.substring(0, 5)}…</td>
        <td data-label="Type" style="font-size:0.8rem;"><strong>${r.type}</strong></td>
        <td data-label="Description" style="max-width:130px;font-size:0.78rem;word-break:break-word;line-height:1.2;">
          ${r.description.substring(0, 45)}${r.description.length > 45 ? '…' : ''}
        </td>
        <td data-label="Severity" style="font-size:0.8rem;">
          <span style="color:${severityColor};font-weight:700;">${r.severity || 'Medium'}</span>
        </td>
        <td data-label="Location" style="font-size:0.75rem;line-height:1.2;">
          ${coords}<br>${mapLink}
        </td>
        <td data-label="Contact" style="font-size:0.75rem;line-height:1.2;">
          <span style="font-size:0.85rem;">${r.contactName || r.userName || '—'}</span><br>
          <span style="font-size:0.78rem;color:#888;">${r.contactPhone || r.userEmail || ''}</span>
        </td>
        <td data-label="Date" style="font-size:0.82rem;white-space:nowrap;">${date}</td>
        <td data-label="Status">
          <span class="badge ${r.status === 'Completed' ? 'badge-completed' : 'badge-pending'}">
            ${r.status === 'Completed' ? '✅' : '⏳'} ${r.status}
          </span>
        </td>
        <td data-label="Assign To">${assignCell}</td>
        <td data-label="Action">
          <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
            ${r.status === 'Pending'
              ? `<button class="btn btn-success"
                   style="padding:6px 12px;font-size:0.8rem;"
                   onclick="markCompleted('${r.id}', this)">
                   ✅ Mark Done
                 </button>`
              : `<span style="color:#2dc653;font-size:0.82rem;">Resolved</span>
                 ${r.completedBy
                   ? `<span style="font-size:0.75rem;color:#888;">by ${r.completedBy}<br>${r.completedByEmail || ''}</span>`
                   : ''}`
            }
            <button class="btn" style="background:#fee2e2; color:#ef4444; padding:4px 8px; font-size:0.75rem; border-radius:4px; border:1px solid #fecaca; font-weight:600;"
                    onclick="deleteRequest('${r.id}', this)">
              🗑️ Delete
            </button>
          </div>
        </td>
      </tr>`;
  });

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Description</th>
          <th>Severity</th>
          <th>Location</th>
          <th>Contact</th>
          <th>Date</th>
          <th>Status</th>
          <th>Assign To</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---- Mark as Completed -------------------------------------
window.markCompleted = function (requestId, btn) {
  window.showConfirmModal(
    'Complete Request',
    'Are you sure you want to mark this request as completed?',
    async () => {
      btn.disabled    = true;
      btn.textContent = '⏳ Updating…';

      try {
        await updateDoc(doc(db, 'Requests', requestId), {
          status:    'Completed',
          updatedAt: serverTimestamp()
        });

        // Update local cache
        const idx = allRequests.findIndex(r => r.id === requestId);
        if (idx !== -1) allRequests[idx].status = 'Completed';

        showAlert('Request marked as Completed.', 'success');
        applyFilters();   // Re-render
        updateStats(allRequests);

      } catch (err) {
        console.error('Update error:', err);
        showAlert('Failed to update: ' + err.message, 'error');
        btn.disabled    = false;
        btn.textContent = '✅ Mark Done';
      }
    },
    'Yes, Complete'
  );
};

// ---- Delete Request ----------------------------------------
window.deleteRequest = function (requestId, btn) {
  window.showConfirmModal(
    'Archive Request',
    'Are you sure you want to delete this request? It will be moved to the Deleted Archive (Recycle Bin).',
    async () => {
      const origText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '⏳...';

      try {
        const reqData = allRequests.find(r => r.id === requestId);
        if (!reqData) {
          throw new Error('Request not found in local cache');
        }

        // 1. Save copy to DeletedRequests
        await setDoc(doc(db, 'DeletedRequests', requestId), {
          ...reqData,
          deletedAt: serverTimestamp()
        });

        // 2. Delete from active Requests
        await deleteDoc(doc(db, 'Requests', requestId));
        
        // 3. Update local cache
        allRequests = allRequests.filter(r => r.id !== requestId);
        
        showAlert('Request moved to Deleted Archive.', 'success');
        applyFilters();   // Re-render
        updateStats(allRequests);

        // 4. Refresh archive
        fetchDeletedData();
      } catch (err) {
        console.error('Delete error:', err);
        showAlert('Failed to delete: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    },
    'Yes, Archive'
  );
};

// ---- Assign Volunteer --------------------------------------
window.assignVolunteer = async function (requestId, btn) {
  const select = document.getElementById(`vol-${requestId}`);
  const uid    = select?.value;
  if (!uid) { showAlert('Please select a volunteer first.', 'info'); return; }

  const volunteer = allVolunteers.find(v => v.uid === uid);
  if (!volunteer) return;

  const prev = btn.textContent;
  btn.disabled    = true;
  btn.textContent = '⏳';

  try {
    await updateDoc(doc(db, 'Requests', requestId), {
      assignedTo:      uid,
      assignedToName:  volunteer.name,
      assignedToEmail: volunteer.email,
      updatedAt:       serverTimestamp()
    });

    const idx = allRequests.findIndex(r => r.id === requestId);
    if (idx !== -1) {
      allRequests[idx].assignedTo      = uid;
      allRequests[idx].assignedToName  = volunteer.name;
      allRequests[idx].assignedToEmail = volunteer.email;
    }

    showAlert(`Assigned to ${volunteer.name} successfully.`, 'success');
    applyFilters();

  } catch (err) {
    console.error('Assign error:', err);
    showAlert('Failed to assign: ' + err.message, 'error');
    btn.disabled    = false;
    btn.textContent = prev;
  }
};

// ---- Stats -------------------------------------------------
function updateStats(requests) {
  const total     = requests.length;
  const pending   = requests.filter(r => r.status === 'Pending').length;
  const completed = requests.filter(r => r.status === 'Completed').length;
  const critical  = requests.filter(r => r.severity === 'Critical').length;

  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statPending').textContent   = pending;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statCritical').textContent  = critical;
}

// ---- Map Markers -------------------------------------------
window.plotMapMarkersGlobal = plotMapMarkers;

function plotMapMarkers(requests) {
  if (!window.authorityMap) {
    window.pendingRequestsToPlot = requests;
    return;
  }

  // Clear existing markers (simple approach: re-init map)
  const bounds = new google.maps.LatLngBounds();
  let hasMarkers = false;

  requests.forEach(r => {
    if (!r.latitude || !r.longitude) return;

    const pos = { lat: r.latitude, lng: r.longitude };

    const iconUrl = r.status === 'Completed'
      ? 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
      : (r.severity === 'Critical' || r.severity === 'High')
        ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
        : 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png';

    const mkr = new google.maps.Marker({
      position: pos,
      map:      window.authorityMap,
      title:    `${r.type} — ${r.status}`,
      icon:     { url: iconUrl }
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-size:13px;line-height:1.6;padding:4px;max-width:200px;">
          <strong>${r.type}</strong><br>
          ${r.description.substring(0, 80)}${r.description.length > 80 ? '…' : ''}<br>
          <span style="color:${r.status === 'Completed' ? '#2dc653' : '#e63946'};">
            ● ${r.status}
          </span>
        </div>`
    });

    mkr.addListener('click', () => infoWindow.open(window.authorityMap, mkr));
    bounds.extend(pos);
    hasMarkers = true;
  });

  if (hasMarkers) {
    window.authorityMap.fitBounds(bounds);
    // Don't zoom in too close
    google.maps.event.addListenerOnce(window.authorityMap, 'bounds_changed', () => {
      if (window.authorityMap.getZoom() > 14) window.authorityMap.setZoom(14);
    });
  }
}

// ---- Filters -----------------------------------------------
function applyFilters() {
  const status   = document.getElementById('filterStatus').value;
  const type     = document.getElementById('filterType').value;
  const severity = document.getElementById('filterSeverity').value;

  let filtered = allRequests;
  if (status   !== 'all') filtered = filtered.filter(r => r.status   === status);
  if (type     !== 'all') filtered = filtered.filter(r => r.type     === type);
  if (severity !== 'all') filtered = filtered.filter(r => r.severity === severity);

  renderTable(filtered);
}

document.getElementById('filterStatus').addEventListener('change',   applyFilters);
document.getElementById('filterType').addEventListener('change',     applyFilters);
document.getElementById('filterSeverity').addEventListener('change', applyFilters);
document.getElementById('refreshBtn').addEventListener('click',      fetchAllRequests);

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

// ---- DELETED ARCHIVE OPERATIONS ----------------------------
let deletedRequests = [];
let deletedUsers = [];

async function fetchDeletedData() {
  try {
    // 1. Fetch deleted requests
    const reqSnap = await getDocs(collection(db, 'DeletedRequests'));
    deletedRequests = [];
    reqSnap.forEach(d => {
      deletedRequests.push({ id: d.id, ...d.data() });
    });

    // 2. Fetch deleted users
    const userSnap = await getDocs(collection(db, 'DeletedUsers'));
    deletedUsers = [];
    userSnap.forEach(d => {
      deletedUsers.push({ uid: d.id, ...d.data() });
    });

    renderDeletedRequests();
    renderDeletedUsers();
  } catch (err) {
    console.error('Failed to fetch deleted archive:', err);
  }
}
window.fetchDeletedData = fetchDeletedData;

function renderDeletedRequests() {
  const container = document.getElementById('deletedRequestsContainer');
  if (!container) return;

  if (deletedRequests.length === 0) {
    container.innerHTML = '<p style="color:#888;font-size:0.85rem;padding:20px;">No deleted requests.</p>';
    return;
  }

  let html = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th>ID</th><th>TYPE</th><th>SEVERITY</th><th>DELETED AT</th><th>ACTIONS</th>
        </tr>
      </thead>
      <tbody>
  `;

  deletedRequests.forEach(r => {
    const d = r.deletedAt ? new Date(r.deletedAt.seconds * 1000) : null;
    const deletedDate = d
      ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      : 'N/A';

    html += `
      <tr>
        <td data-label="ID" style="font-size:0.72rem;color:#888;">${r.id.substring(0, 5)}…</td>
        <td data-label="TYPE"><strong>${esc(r.type)}</strong></td>
        <td data-label="SEVERITY"><span style="font-weight:bold;color:${r.severity === 'Critical' ? '#e63946' : '#f4a261'}">${esc(r.severity || 'Medium')}</span></td>
        <td data-label="DELETED AT" style="color:#64748b;">${deletedDate}</td>
        <td data-label="ACTIONS">
          <div style="display:flex;gap:6px;">
            <button onclick="restoreRequest('${r.id}', this)" class="btn" style="background:#f1f5f9;color:#1d3557;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #cbd5e1;font-weight:600;">Restore</button>
            <button onclick="permanentlyDeleteRequest('${r.id}', this)" class="btn" style="background:#fee2e2;color:#ef4444;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #fecaca;font-weight:600;">Delete Permanently</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderDeletedUsers() {
  const citizensContainer = document.getElementById('deletedCitizensContainer');
  const volunteersContainer = document.getElementById('deletedVolunteersContainer');
  
  const deletedCitizens = deletedUsers.filter(u => u.role === 'user' || !u.role);
  const deletedVolunteers = deletedUsers.filter(u => u.role === 'volunteer');

  const renderList = (container, list) => {
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = '<p style="color:#888;font-size:0.85rem;padding:20px;">No users in this archive.</p>';
      return;
    }

    let html = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>NAME</th><th>EMAIL</th><th>PHONE</th><th>DELETED AT</th><th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
    `;

    list.forEach(u => {
      const d = u.deletedAt ? new Date(u.deletedAt.seconds * 1000) : null;
      const deletedDate = d
        ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        : 'N/A';

      html += `
        <tr>
          <td data-label="NAME"><strong>${esc(u.name)}</strong></td>
          <td data-label="EMAIL" style="color:#2563eb;">${esc(u.email)}</td>
          <td data-label="PHONE" style="color:#475569;">${esc(u.phone || '—')}</td>
          <td data-label="DELETED AT" style="color:#64748b;">${deletedDate}</td>
          <td data-label="ACTIONS">
            <div style="display:flex;gap:6px;">
              <button onclick="restoreUser('${u.uid}', this)" class="btn" style="background:#f1f5f9;color:#1d3557;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #cbd5e1;font-weight:600;">Restore</button>
              <button onclick="permanentlyDeleteUser('${u.uid}', this)" class="btn" style="background:#fee2e2;color:#ef4444;padding:5px 12px;font-size:11px;border-radius:4px;border:1px solid #fecaca;font-weight:600;">Delete Permanently</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  };

  renderList(citizensContainer, deletedCitizens);
  renderList(volunteersContainer, deletedVolunteers);
}

// Restore Request
window.restoreRequest = async function (requestId, btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    const item = deletedRequests.find(r => r.id === requestId);
    if (!item) throw new Error('Data not found');

    const { deletedAt, ...activeData } = item;

    // 1. Write back to active collection
    await setDoc(doc(db, 'Requests', requestId), activeData);

    // 2. Delete from archive
    await deleteDoc(doc(db, 'DeletedRequests', requestId));

    showAlert('Request restored successfully.', 'success');
    fetchAllRequests();
    fetchDeletedData();
  } catch (err) {
    console.error('Restore error:', err);
    showAlert('Restore failed: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = orig;
  }
};

// Permanently Delete Request
window.permanentlyDeleteRequest = function (requestId, btn) {
  window.showConfirmModal(
    'Permanently Delete',
    'Are you sure you want to permanently delete this request? This action cannot be undone.',
    async () => {
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳';

      try {
        await deleteDoc(doc(db, 'DeletedRequests', requestId));
        showAlert('Request permanently deleted.', 'success');
        fetchDeletedData();
      } catch (err) {
        console.error('Permanent delete error:', err);
        showAlert('Delete failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = orig;
      }
    },
    'Yes, Purge'
  );
};

// Restore User
window.restoreUser = async function (uid, btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳';

  try {
    const item = deletedUsers.find(u => u.uid === uid);
    if (!item) throw new Error('Data not found');

    const { deletedAt, ...activeData } = item;

    // 1. Write back to active collection
    await setDoc(doc(db, 'Users', uid), activeData);

    // 2. Delete from archive
    await deleteDoc(doc(db, 'DeletedUsers', uid));

    showAlert('User restored successfully.', 'success');
    fetchAllRequests();
    fetchDeletedData();
  } catch (err) {
    console.error('Restore error:', err);
    showAlert('Restore failed: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = orig;
  }
};

// Permanently Delete User
window.permanentlyDeleteUser = function (uid, btn) {
  const user = deletedUsers.find(u => u.uid === uid);
  const name = user ? user.name : 'this user';

  window.showConfirmModal(
    'Permanently Delete',
    `Are you sure you want to permanently delete ${name}? This action cannot be undone.`,
    async () => {
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳';

      try {
        await deleteDoc(doc(db, 'DeletedUsers', uid));
        showAlert('User permanently deleted.', 'success');
        fetchDeletedData();
      } catch (err) {
        console.error('Permanent delete error:', err);
        showAlert('Delete failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = orig;
      }
    },
    'Yes, Purge'
  );
};
