/**
 * Tigo - Map Page JavaScript
 * Interactive France map with Leaflet.js
 */

let map;
let markers = [];
let polylines = [];

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadTripsOnMap();
});

function initMap() {
    // Center on France
    map = L.map('map').setView([46.603354, 1.888334], 6);

    // Add OpenStreetMap tiles with custom style
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

async function loadTripsOnMap() {
    try {
        const response = await fetch('/api/trips');
        const data = await response.json();

        // Update sidebar
        const tripsList = document.getElementById('map-trips-list');
        const tripsCount = document.getElementById('trips-count');

        tripsCount.textContent = `${data.trips.length} trajets`;

        if (data.trips.length === 0) {
            tripsList.innerHTML = '<p style="text-align: center; color: var(--gray-500); padding: 1rem;">Aucun trajet disponible</p>';
            return;
        }

        // Render sidebar list
        tripsList.innerHTML = data.trips.map(trip => `
      <div class="map-trip-item" data-trip-id="${trip.id}">
        <div class="map-trip-route">${trip.departure_city} → ${trip.arrival_city}</div>
        <div class="map-trip-date">${formatDateShort(trip.date)} à ${trip.time}</div>
      </div>
    `).join('');

        // Add click handlers to sidebar items
        document.querySelectorAll('.map-trip-item').forEach(item => {
            item.addEventListener('click', () => {
                const tripId = item.dataset.tripId;
                const trip = data.trips.find(t => t.id == tripId);
                if (trip) {
                    highlightTrip(trip, item);
                }
            });
        });

        // Add markers and polylines for each trip
        data.trips.forEach(trip => {
            addTripToMap(trip);
        });

    } catch (error) {
        console.error('Error loading trips on map:', error);
        document.getElementById('map-trips-list').innerHTML = '<p style="color: red; padding: 1rem;">Erreur de chargement</p>';
    }
}

function addTripToMap(trip) {
    // Default coordinates for French cities (approximate)
    const cityCoords = getCityCoordinates(trip);

    if (!cityCoords.departure || !cityCoords.arrival) return;

    // Create custom icon
    const greenIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
      width: 24px;
      height: 24px;
      background: #36c36b;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    // Add markers
    const depMarker = L.marker(cityCoords.departure, { icon: greenIcon }).addTo(map);
    const arrMarker = L.marker(cityCoords.arrival, { icon: greenIcon }).addTo(map);

    // Add popup
    const popupContent = `
    <div class="map-popup">
      <div class="map-popup-title">${trip.departure_city} → ${trip.arrival_city}</div>
      <div class="map-popup-info">
        📅 ${formatDateShort(trip.date)} à ${trip.time}<br>
        👤 ${trip.driver_name}
      </div>
      <a href="/trip-detail.html?id=${trip.id}" class="map-popup-btn">Voir le trajet</a>
    </div>
  `;

    depMarker.bindPopup(popupContent);
    arrMarker.bindPopup(popupContent);

    // Add polyline
    const polyline = L.polyline([cityCoords.departure, cityCoords.arrival], {
        color: '#36c36b',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(map);

    polyline.bindPopup(popupContent);

    markers.push(depMarker, arrMarker);
    polylines.push(polyline);

    // Store trip data for highlighting
    depMarker.tripId = trip.id;
    arrMarker.tripId = trip.id;
    polyline.tripId = trip.id;
}

function highlightTrip(trip, item) {
    // Remove active class from all items
    document.querySelectorAll('.map-trip-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    // Get coordinates
    const coords = getCityCoordinates(trip);
    if (coords.departure && coords.arrival) {
        // Fit map to trip bounds
        const bounds = L.latLngBounds([coords.departure, coords.arrival]);
        map.fitBounds(bounds, { padding: [100, 100] });

        // Highlight polyline
        polylines.forEach(p => {
            if (p.tripId == trip.id) {
                p.setStyle({ color: '#2aa85a', weight: 5, opacity: 1 });
            } else {
                p.setStyle({ color: '#36c36b', weight: 3, opacity: 0.5 });
            }
        });
    }
}

function getCityCoordinates(trip) {
    // If trip has coordinates, use them
    if (trip.departure_lat && trip.departure_lng && trip.arrival_lat && trip.arrival_lng) {
        return {
            departure: [trip.departure_lat, trip.departure_lng],
            arrival: [trip.arrival_lat, trip.arrival_lng]
        };
    }

    // Otherwise use predefined city coordinates
    const cities = {
        'paris': [48.8566, 2.3522],
        'lyon': [45.7640, 4.8357],
        'marseille': [43.2965, 5.3698],
        'toulouse': [43.6047, 1.4442],
        'nice': [43.7102, 7.2620],
        'nantes': [47.2184, -1.5536],
        'bordeaux': [44.8378, -0.5792],
        'lille': [50.6292, 3.0573],
        'rennes': [48.1173, -1.6778],
        'strasbourg': [48.5734, 7.7521],
        'montpellier': [43.6108, 3.8767],
        'grenoble': [45.1885, 5.7245],
        'rouen': [49.4432, 1.0999],
        'toulon': [43.1242, 5.9280],
        'dijon': [47.3220, 5.0415],
        'angers': [47.4784, -0.5632],
        'orleans': [47.9029, 1.9093],
        'clermont-ferrand': [45.7772, 3.0870],
        'gap': [44.5594, 6.0797],
        'brest': [48.3904, -4.4861]
    };

    const depCity = trip.departure_city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const arrCity = trip.arrival_city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return {
        departure: cities[depCity] || null,
        arrival: cities[arrCity] || null
    };
}
