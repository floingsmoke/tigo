/**
 * Tigo Server
 * Main Express server with all routes
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: 'tigo-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Import routes
const authRoutes = require('./routes/auth');
const tripsRoutes = require('./routes/trips');
const messagesRoutes = require('./routes/messages');
const notificationsRoutes = require('./routes/notifications');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);

// Serve index.html for all other routes (SPA-like behavior)
app.get('*', (req, res) => {
    // If it's an API route that wasn't matched, return 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Route not found' });
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════════════╗
  ║                                        ║
  ║   🚗 TIGO Server Running               ║
  ║                                        ║
  ║   Local: http://localhost:${PORT}        ║
  ║                                        ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = app;
