/**
 * Authentication Routes
 * Register, Login, Logout, Get Current User
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/profiles'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password, name, phone } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        // Check if user exists
        const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await db.prepare(`
      INSERT INTO users (email, password, name, phone) VALUES (?, ?, ?, ?)
    `).run(email, hashedPassword, name, phone || null);

        // Set session
        req.session.userId = result.lastInsertRowid;

        res.status(201).json({
            message: 'Account created successfully',
            user: {
                id: result.lastInsertRowid,
                email,
                name,
                phone
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Set session
        req.session.userId = user.id;

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                profile_photo: user.profile_photo
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const user = await db.prepare(`
      SELECT id, email, name, phone, profile_photo, created_at 
      FROM users WHERE id = ?
    `).get(req.session.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update profile
router.put('/profile', requireAuth, upload.single('profile_photo'), async (req, res) => {
    try {
        console.log('PUT /profile called');
        console.log('Body:', req.body);
        console.log('File:', req.file);

        const db = await getDb();
        const { name, phone, email, password } = req.body;
        const userId = req.session.userId;

        // Fetch current user to compare values
        const currentUser = await db.prepare('SELECT email FROM users WHERE id = ?').get(userId);

        // 1. Handle Email Change
        let emailChanged = false;
        if (email && email !== currentUser.email) {
            // Check if new email is taken
            const emailTaken = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
            if (emailTaken) {
                return res.status(400).json({ error: 'Cet email est déjà utilisé' });
            }
            emailChanged = true;
        }

        // 2. Prepare Update Query
        let updateFields = ['name = ?', 'phone = ?'];
        let params = [name, phone];

        if (email) {
            updateFields.push('email = ?');
            params.push(email);
        }

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateFields.push('password = ?');
            params.push(hashedPassword);
        }

        if (req.file) {
            updateFields.push('profile_photo = ?');
            params.push('/uploads/profiles/' + req.file.filename);
        }

        // 3. Execute Update
        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(userId);

        await db.prepare(query).run(...params);

        // 4. Return updated user
        const updatedUserQuery = `
            SELECT id, email, name, phone, profile_photo 
            FROM users WHERE id = ?
        `;
        const updatedUser = await db.prepare(updatedUserQuery).get(userId);

        res.json({
            message: 'Profil mis à jour avec succès',
            user: updatedUser,
            emailChanged: emailChanged
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check session status (for frontend)
router.get('/check', async (req, res) => {
    try {
        if (req.session.userId) {
            const db = await getDb();
            const user = await db.prepare(`
          SELECT id, email, name, phone, profile_photo FROM users WHERE id = ?
        `).get(req.session.userId);
            res.json({ authenticated: true, user });
        } else {
            res.json({ authenticated: false });
        }
    } catch (error) {
        console.error('Check session error:', error);
        res.json({ authenticated: false });
    }
});

module.exports = router;
