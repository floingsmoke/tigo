/**
 * Trips Routes
 * CRUD operations for trips and trip requests
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for trip photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/trips'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'trip-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Get all trips with filters
router.get('/', optionalAuth, async (req, res) => {
    try {
        const db = await getDb();
        const { departure, arrival, date, type, capacity } = req.query;

        let query = `
      SELECT t.*, u.name as driver_name, u.profile_photo as driver_photo
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
    `;
        const params = [];

        if (departure) {
            query += ` AND LOWER(t.departure_city) LIKE ?`;
            params.push(`%${departure.toLowerCase()}%`);
        }

        if (arrival) {
            query += ` AND LOWER(t.arrival_city) LIKE ?`;
            params.push(`%${arrival.toLowerCase()}%`);
        }

        if (date) {
            query += ` AND t.date = ?`;
            params.push(date);
        }

        if (type && type !== 'all') {
            query += ` AND (t.availability_type = ? OR t.availability_type = 'both')`;
            params.push(type);
        }

        if (capacity) {
            query += ` AND t.capacity = ?`;
            params.push(capacity);
        }

        query += ` ORDER BY t.date ASC, t.time ASC`;

        const trips = await db.prepare(query).all(...params);
        res.json({ trips });
    } catch (error) {
        console.error('Get trips error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get trips by date range (for calendar)
router.get('/calendar', async (req, res) => {
    try {
        const db = await getDb();
        const { start, end } = req.query;

        const trips = await db.prepare(`
      SELECT t.*, u.name as driver_name
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'active'
      AND t.date BETWEEN ? AND ?
      ORDER BY t.date ASC, t.time ASC
    `).all(start || '2000-01-01', end || '2100-12-31');

        res.json({ trips });
    } catch (error) {
        console.error('Get calendar trips error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single trip
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const db = await getDb();
        const trip = await db.prepare(`
      SELECT t.*, u.name as driver_name, u.email as driver_email, 
             u.phone as driver_phone, u.profile_photo as driver_photo
      FROM trips t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(req.params.id);

        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        // Check if current user has already requested this trip
        let hasRequested = false;
        let requestStatus = null;
        if (req.session.userId) {
            const existingRequest = await db.prepare(`
        SELECT status FROM trip_requests 
        WHERE trip_id = ? AND requester_id = ?
      `).get(req.params.id, req.session.userId);

            if (existingRequest) {
                hasRequested = true;
                requestStatus = existingRequest.status;
            }
        }

        res.json({ trip, hasRequested, requestStatus });
    } catch (error) {
        console.error('Get trip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new trip
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        const db = await getDb();
        const {
            departure_city, departure_lat, departure_lng,
            arrival_city, arrival_lat, arrival_lng,
            date, time, description, availability_type, capacity
        } = req.body;

        const photo = req.file ? '/uploads/trips/' + req.file.filename : null;

        const result = await db.prepare(`
      INSERT INTO trips (
        user_id, departure_city, departure_lat, departure_lng,
        arrival_city, arrival_lat, arrival_lng,
        date, time, description, availability_type, capacity, photo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            req.session.userId,
            departure_city, departure_lat || null, departure_lng || null,
            arrival_city, arrival_lat || null, arrival_lng || null,
            date, time, description || null, availability_type || 'both', capacity || 'medium', photo
        );

        res.status(201).json({
            message: 'Trip created successfully',
            tripId: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create trip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update trip
router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
    try {
        const db = await getDb();
        // Check ownership
        const trip = await db.prepare('SELECT user_id FROM trips WHERE id = ?').get(req.params.id);
        if (!trip || trip.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const {
            departure_city, arrival_city, date, time,
            description, availability_type, capacity
        } = req.body;

        let updateQuery = `
      UPDATE trips SET 
        departure_city = ?, arrival_city = ?, date = ?, time = ?,
        description = ?, availability_type = ?, capacity = ?
    `;
        let params = [departure_city, arrival_city, date, time, description, availability_type, capacity];

        if (req.file) {
            updateQuery += ', photo = ?';
            params.push('/uploads/trips/' + req.file.filename);
        }

        updateQuery += ' WHERE id = ?';
        params.push(req.params.id);

        await db.prepare(updateQuery).run(...params);
        res.json({ message: 'Trip updated' });
    } catch (error) {
        console.error('Update trip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete trip
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const trip = await db.prepare('SELECT user_id FROM trips WHERE id = ?').get(req.params.id);
        if (!trip || trip.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
        res.json({ message: 'Trip deleted' });
    } catch (error) {
        console.error('Delete trip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's own trips
router.get('/user/my-trips', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const trips = await db.prepare(`
      SELECT * FROM trips WHERE user_id = ? ORDER BY date DESC
    `).all(req.session.userId);

        res.json({ trips });
    } catch (error) {
        console.error('Get my trips error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Request a trip
router.post('/:id/request', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const tripId = req.params.id;
        const { message } = req.body;

        // Get trip info
        const trip = await db.prepare(`
      SELECT t.*, u.id as driver_id, u.name as driver_name 
      FROM trips t JOIN users u ON t.user_id = u.id 
      WHERE t.id = ?
    `).get(tripId);

        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        if (trip.driver_id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot request your own trip' });
        }

        // Check if already requested
        const existingRequest = await db.prepare(`
      SELECT id FROM trip_requests WHERE trip_id = ? AND requester_id = ?
    `).get(tripId, req.session.userId);

        if (existingRequest) {
            return res.status(400).json({ error: 'You have already requested this trip' });
        }

        // Create request
        const result = await db.prepare(`
      INSERT INTO trip_requests (trip_id, requester_id, message) VALUES (?, ?, ?)
    `).run(tripId, req.session.userId, message || null);

        // Get requester name
        const requester = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);

        // Create notification for driver
        await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, 'request_received', 'Nouvelle demande de trajet', ?, ?)
    `).run(
            trip.driver_id,
            `${requester.name} souhaite participer à votre trajet ${trip.departure_city} → ${trip.arrival_city}`,
            `/trip-detail.html?id=${tripId}`
        );

        res.status(201).json({ message: 'Request sent successfully' });
    } catch (error) {
        console.error('Request trip error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get requests for a trip (for trip owner)
router.get('/:id/requests', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const trip = await db.prepare('SELECT user_id FROM trips WHERE id = ?').get(req.params.id);
        if (!trip || trip.user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const requests = await db.prepare(`
      SELECT tr.*, u.name as requester_name, u.profile_photo as requester_photo
      FROM trip_requests tr
      JOIN users u ON tr.requester_id = u.id
      WHERE tr.trip_id = ?
      ORDER BY tr.created_at DESC
    `).all(req.params.id);

        res.json({ requests });
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Accept/Reject a request
router.put('/requests/:requestId/respond', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const { status } = req.body; // 'accepted' or 'rejected'
        const requestId = req.params.requestId;

        // Get request and trip info
        const request = await db.prepare(`
      SELECT tr.*, t.user_id as driver_id, t.departure_city, t.arrival_city
      FROM trip_requests tr
      JOIN trips t ON tr.trip_id = t.id
      WHERE tr.id = ?
    `).get(requestId);

        if (!request || request.driver_id !== req.session.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update request status
        await db.prepare('UPDATE trip_requests SET status = ? WHERE id = ?').run(status, requestId);

        // Get driver name
        const driver = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);

        // Notify requester
        const notifTitle = status === 'accepted' ? 'Demande acceptée !' : 'Demande refusée';
        const notifMessage = status === 'accepted'
            ? `${driver.name} a accepté votre demande pour le trajet ${request.departure_city} → ${request.arrival_city}`
            : `${driver.name} a refusé votre demande pour le trajet ${request.departure_city} → ${request.arrival_city}`;

        await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(
            request.requester_id,
            status === 'accepted' ? 'request_accepted' : 'request_rejected',
            notifTitle,
            notifMessage,
            '/messages.html'
        );

        // If accepted, create conversation
        if (status === 'accepted') {
            await db.prepare(`
        INSERT INTO conversations (trip_request_id, user1_id, user2_id)
        VALUES (?, ?, ?)
      `).run(requestId, req.session.userId, request.requester_id);
        }

        res.json({ message: `Request ${status}` });
    } catch (error) {
        console.error('Respond to request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
