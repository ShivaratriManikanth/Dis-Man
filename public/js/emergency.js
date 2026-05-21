// ============================================================
//  EMERGENCY.JS
//  - Auth guard
//  - Browser Geolocation API → lat/lng
//  - Google Maps JS API → show pin
//  - Submit request to Firestore
// ============================================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---- State -------------------------------------------------
let currentUser    = null;
let userProfile    = null;
let map            = null;   // Google Maps instance
let marker         = null;   // Map marker
let userLat        = null;
let userLng        = null;

// ---- Auth Guard --------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;

  // Load profile (for name pre-fill)
  const snap = await getDoc(doc(db, 'Users', user.uid));
  userProfile = snap.exists() ? snap.data() : null;

  if (userProfile) {
    const contactField = document.getElementById('contactName');
    const phoneField   = document.getElementById('contactPhone');
    if (contactField && !contactField.value) contactField.value = userProfile.name || '';
    if (phoneField   && !phoneField.value)   phoneField.value   = userProfile.phone || '';
  }

  // Start geolocation
  detectLocation();
});

// ---- Google Maps callback (called by Maps script) ----------
window.initMap = function () {
  // Default center: world view
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 20, lng: 0 },
    zoom: 2,
    mapTypeControl: false,
    streetViewControl: false
  });
};

// ---- Geolocation -------------------------------------------
function detectLocation() {
  const dot  = document.getElementById('locationDot');
  const text = document.getElementById('locationText');

  if (!navigator.geolocation) {
    dot.className  = 'location-dot error';
    text.textContent = '❌ Geolocation not supported by this browser.';
    return;
  }

  dot.className  = 'location-dot';
  text.textContent = 'Detecting your location…';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLat = position.coords.latitude;
      userLng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      // Update hidden inputs
      document.getElementById('latitude').value  = userLat;
      document.getElementById('longitude').value = userLng;

      // Update status bar
      dot.className    = 'location-dot active';
      text.textContent = `✅ Location captured (±${accuracy}m accuracy)`;

      // Update coords display
      document.getElementById('coordsDisplay').textContent =
        `Lat: ${userLat.toFixed(6)}, Lng: ${userLng.toFixed(6)}`;

      // Update map
      updateMap(userLat, userLng);
    },
    (error) => {
      dot.className  = 'location-dot error';
      text.textContent = `⚠️ ${getGeoErrorMessage(error.code)} — Please allow location access.`;
      document.getElementById('coordsDisplay').textContent = 'Location unavailable';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function updateMap(lat, lng) {
  if (!map) return;   // Map not loaded yet — it will initialize with correct coords

  const pos = { lat, lng };
  map.setCenter(pos);
  map.setZoom(15);

  // Remove existing marker
  if (marker) marker.setMap(null);

  marker = new google.maps.Marker({
    position: pos,
    map:      map,
    title:    'Your Location',
    animation: google.maps.Animation.DROP,
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
  });

  // Info window
  const infoWindow = new google.maps.InfoWindow({
    content: `<div style="font-size:13px;padding:4px;">
      <strong>📍 Emergency Location</strong><br>
      Lat: ${lat.toFixed(6)}<br>
      Lng: ${lng.toFixed(6)}
    </div>`
  });
  marker.addListener('click', () => infoWindow.open(map, marker));
}

// Refresh location button
document.getElementById('refreshLocationBtn').addEventListener('click', detectLocation);

// ---- FORM SUBMIT -------------------------------------------
document.getElementById('emergencyForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showAlert('You must be logged in to submit a request.', 'error');
    return;
  }

  const type         = document.getElementById('disasterType').value;
  const description  = document.getElementById('description').value.trim();
  const severity     = document.getElementById('severity').value;
  const contactName  = document.getElementById('contactName').value.trim();
  const contactPhone = document.getElementById('contactPhone').value.trim();

  // Validation
  if (!type)        { showAlert('Please select a disaster type.', 'error'); return; }
  if (!description) { showAlert('Please describe the emergency.', 'error'); return; }

  if (!userLat || !userLng) {
    const proceed = confirm(
      'Location was not detected. Submit anyway without location data?'
    );
    if (!proceed) return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled    = true;
  btn.textContent = '⏳ Submitting…';

  try {
    // Save to Firestore: Requests/{auto-id}
    const docRef = await addDoc(collection(db, 'Requests'), {
      userId:       currentUser.uid,
      userName:     userProfile ? userProfile.name : 'Unknown',
      userEmail:    currentUser.email,
      type:         type,
      description:  description,
      severity:     severity,
      contactName:  contactName,
      contactPhone: contactPhone,
      latitude:     userLat  || null,
      longitude:    userLng  || null,
      status:       'Pending',
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp()
    });

    showAlert(`✅ Emergency request submitted! Request ID: ${docRef.id}`, 'success');

    // Reset form
    document.getElementById('emergencyForm').reset();
    userLat = null;
    userLng = null;
    document.getElementById('locationDot').className = 'location-dot';
    document.getElementById('locationText').textContent = 'Location cleared — click Refresh to detect again.';
    document.getElementById('coordsDisplay').textContent = '—';

    // Re-fill contact from profile
    if (userProfile) {
      document.getElementById('contactName').value  = userProfile.name  || '';
      document.getElementById('contactPhone').value = userProfile.phone || '';
    }

    // Redirect to dashboard after 2s
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);

  } catch (err) {
    console.error('Submit error:', err);
    showAlert(`❌ Failed to submit request: ${err.message}`, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '🆘 Submit Emergency Request';
  }
});

// ---- Helpers -----------------------------------------------
function showAlert(message, type = 'info') {
  const box = document.getElementById('alertBox');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  box.innerHTML = `
    <div class="alert alert-${type}">
      <span>${icons[type]}</span>
      <span>${message}</span>
    </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => { box.innerHTML = ''; }, 6000);
}

function getGeoErrorMessage(code) {
  const map = {
    1: 'Location permission denied',
    2: 'Location unavailable',
    3: 'Location request timed out'
  };
  return map[code] || 'Unknown location error';
}
