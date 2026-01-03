/**
 * Tigo - Trips Page JavaScript
 * Handles trips listing and filtering
 */

document.addEventListener('DOMContentLoaded', () => {
    loadTrips();
    setupFilters();
});

async function loadTrips(filters = {}) {
    const grid = document.getElementById('trips-grid');
    const loading = document.getElementById('trips-loading');
    const empty = document.getElementById('trips-empty');

    // Show loading
    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    grid.innerHTML = '';
    grid.appendChild(loading);

    try {
        // Build query string
        const params = new URLSearchParams();
        if (filters.departure) params.append('departure', filters.departure);
        if (filters.arrival) params.append('arrival', filters.arrival);
        if (filters.date) params.append('date', filters.date);
        if (filters.type && filters.type !== 'all') params.append('type', filters.type);
        if (filters.capacity) params.append('capacity', filters.capacity);

        const response = await fetch(`/api/trips?${params.toString()}`);
        const data = await response.json();

        loading.classList.add('hidden');

        if (data.trips.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        grid.innerHTML = data.trips.map(trip => createTripCard(trip)).join('');

    } catch (error) {
        console.error('Error loading trips:', error);
        loading.classList.add('hidden');
        grid.innerHTML = '<p style="text-align: center; color: var(--error);">Erreur lors du chargement des trajets</p>';
    }
}

function setupFilters() {
    const filterBtn = document.getElementById('filter-btn');

    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const filters = {
                departure: document.getElementById('filter-departure').value,
                arrival: document.getElementById('filter-arrival').value,
                date: document.getElementById('filter-date').value,
                type: document.getElementById('filter-type').value,
                capacity: document.getElementById('filter-capacity').value
            };
            loadTrips(filters);
        });
    }

    // Also filter on Enter key
    const filterInputs = document.querySelectorAll('.filter-input, .filter-select');
    filterInputs.forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterBtn.click();
            }
        });
    });
}
