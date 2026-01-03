/**
 * Tigo - Main Application JavaScript
 * Common utilities and functions
 */

// Format date to French locale
function formatDate(dateString) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
}

// Format date short
function formatDateShort(dateString) {
  const options = { day: 'numeric', month: 'short' };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
}

// Show toast notification
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navbar-toggle');
  const nav = document.getElementById('navbar-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('active');
    });
  }
});

// Notification dropdown
document.addEventListener('DOMContentLoaded', () => {
  const notifBtn = document.getElementById('notifications-btn');
  const notifDropdown = document.getElementById('notification-dropdown');

  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target)) {
        notifDropdown.classList.remove('active');
      }
    });
  }
});

// Capacity labels
const capacityLabels = {
  small: 'Petit colis',
  medium: 'Moyen colis',
  large: 'Grand colis'
};

// Availability type labels
const availabilityLabels = {
  both: 'Livraison & Récupération',
  delivery: 'Livraison',
  pickup: 'Récupération'
};

// Create trip card HTML
function createTripCard(trip) {
  return `
    <a href="/trip-detail.html?id=${trip.id}" class="trip-card">
      <div class="trip-card-header">
        <div class="trip-route">
          <div class="trip-city">
            <span class="trip-city-marker departure"></span>
            <span class="trip-city-name">${trip.departure_city}</span>
          </div>
          <svg class="trip-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12,5 19,12 12,19"/>
          </svg>
          <div class="trip-city">
            <span class="trip-city-marker arrival"></span>
            <span class="trip-city-name">${trip.arrival_city}</span>
          </div>
        </div>
      </div>
      <div class="trip-card-body">
        <div class="trip-info">
          <div class="trip-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${formatDateShort(trip.date)}
          </div>
          <div class="trip-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            ${trip.time}
          </div>
        </div>
      </div>
      <div class="trip-card-footer">
        <div class="trip-driver">
          <img src="${trip.driver_photo || '/assets/images/default-avatar.svg'}" alt="" class="trip-driver-avatar">
          <span class="trip-driver-name">${trip.driver_name}</span>
        </div>
        <span class="trip-capacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          ${capacityLabels[trip.capacity] || trip.capacity}
        </span>
      </div>
    </a>
  `;
}
