/**
 * Tigo - Calendar Page JavaScript
 * Monthly calendar view with trips
 */

let currentDate = new Date();
let tripsData = [];

let calendarUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const authRes = await fetch('/api/auth/check', { credentials: 'include' });
    const authData = await authRes.json();
    if (authData.authenticated) {
      calendarUser = authData.user;
    }
  } catch (e) {
    console.error('Auth check error:', e);
  }

  setupCalendarNav();
  loadCalendarTrips();
  setupModal();
});

function setupCalendarNav() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

async function loadCalendarTrips() {
  try {
    const response = await fetch('/api/trips/calendar');
    const data = await response.json();
    tripsData = data.trips;
    renderCalendar();
  } catch (error) {
    console.error('Error loading calendar trips:', error);
  }
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update header
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  // Generate calendar days
  const daysContainer = document.getElementById('calendar-days');
  daysContainer.innerHTML = '';

  // Previous month days
  const prevMonth = new Date(year, month, 0);
  const prevMonthDays = prevMonth.getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const dayEl = createDayElement(day, true, new Date(year, month - 1, day));
    daysContainer.appendChild(dayEl);
  }

  // Current month days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = date.toDateString() === today.toDateString();
    const dayEl = createDayElement(day, false, date, isToday);
    daysContainer.appendChild(dayEl);
  }

  // Next month days
  const totalCells = startDay + daysInMonth;
  const nextMonthDays = 42 - totalCells; // 6 rows * 7 days = 42
  for (let day = 1; day <= nextMonthDays && totalCells + day <= 42; day++) {
    const dayEl = createDayElement(day, true, new Date(year, month + 1, day));
    daysContainer.appendChild(dayEl);
  }
}

function createDayElement(day, isOtherMonth, date, isToday = false) {
  const dayEl = document.createElement('div');
  dayEl.className = `calendar-day${isOtherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}`;

  // Get trips for this day
  const dateStr = date.toISOString().split('T')[0];
  const dayTrips = tripsData.filter(trip => trip.date === dateStr);

  dayEl.innerHTML = `
    <span class="calendar-day-number">${day}</span>
    ${dayTrips.length > 0 ? `
      <div class="calendar-day-trips">
        ${dayTrips.slice(0, 3).map(trip => {
    const isMine = calendarUser && trip.user_id === calendarUser.id;
    const style = isMine ? 'background: var(--primary); color: white;' : '';
    return `<div class="calendar-trip-dot" style="${style}">${trip.departure_city} → ${trip.arrival_city}</div>`;
  }).join('')}
        ${dayTrips.length > 3 ? `<div class="calendar-trip-dot" style="background: var(--gray-400);">+${dayTrips.length - 3} autres</div>` : ''}
      </div>
    ` : ''}
  `;

  // Add click handler if there are trips
  if (dayTrips.length > 0) {
    dayEl.style.cursor = 'pointer';
    dayEl.addEventListener('click', () => {
      showDayModal(date, dayTrips);
    });
  }

  return dayEl;
}

function setupModal() {
  const modal = document.getElementById('day-modal');
  const closeBtn = document.getElementById('modal-close');

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

function showDayModal(date, trips) {
  const modal = document.getElementById('day-modal');
  const modalDate = document.getElementById('modal-date');
  const modalTrips = document.getElementById('modal-trips');

  modalDate.textContent = `Trajets du ${formatDate(date.toISOString())}`;

  modalTrips.innerHTML = trips.map(trip => {
    const isMine = calendarUser && trip.user_id === calendarUser.id;
    return `
    <a href="/trip-detail.html?id=${trip.id}" class="trip-card" style="margin-bottom: var(--spacing-md); ${isMine ? 'border: 1px solid var(--primary);' : ''}">
      <div class="trip-card-header">
        <div class="trip-route">
          <div class="trip-city">
            <span class="trip-city-marker departure"></span>
            <span class="trip-city-name">${trip.departure_city}</span>
          </div>
          <span style="margin: 0 0.5rem; color: var(--gray-400);">→</span>
          <div class="trip-city">
            <span class="trip-city-marker arrival"></span>
            <span class="trip-city-name">${trip.arrival_city}</span>
          </div>
        </div>
        ${isMine ? '<span class="badge badge-primary">Moi</span>' : ''}
      </div>
      <div class="trip-card-body">
        <div class="trip-info">
          <div class="trip-info-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            ${trip.time}
          </div>
          <div class="trip-info-item">
            👤 ${trip.driver_name}
          </div>
        </div>
      </div>
    </a>
  `}).join('');

  modal.classList.add('active');
}
