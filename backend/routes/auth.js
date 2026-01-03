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

// Generate random token
function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// Forgot Password - Request reset link
router.post('/forgot-password', async (req, res) => {
    try {
        const db = await getDb();
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Find user
        const user = await db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);

        // Always return success (security: don't reveal if email exists)
        if (!user) {
            return res.json({ message: 'If an account exists, a reset link has been sent' });
        }

        // Generate token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Save token to database
        await db.prepare(`
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `).run(user.id, token, expiresAt.toISOString());

        // Build reset URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

        // Send email (only if RESEND_API_KEY is set)
        if (process.env.RESEND_API_KEY) {
            try {
                const { Resend } = require('resend');
                const resend = new Resend(process.env.RESEND_API_KEY);

                await resend.emails.send({
                    from: process.env.FROM_EMAIL || 'Tigo <onboarding@resend.dev>',
                    to: email,
                    subject: 'Réinitialisation de votre mot de passe Tigo',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #10b981;">🚗 Tigo</h2>
                            <p>Bonjour ${user.name},</p>
                            <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                                    Réinitialiser mon mot de passe
                                </a>
                            </p>
                            <p style="color: #666; font-size: 14px;">Ce lien expire dans 1 heure.</p>
                            <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">Cet email a été envoyé par Tigo - Covoiturage & Livraison</p>
                        </div>
                    `
                });
                console.log('Password reset email sent to:', email);
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                // Don't fail the request, just log the error
            }
        } else {
            // Development mode: log the reset URL to console
            console.log('\n========================================');
            console.log('🔐 PASSWORD RESET LINK (dev mode):');
            console.log(resetUrl);
            console.log('========================================\n');
        }

        res.json({ message: 'If an account exists, a reset link has been sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset Password - Change password with token
router.post('/reset-password', async (req, res) => {
    try {
        const db = await getDb();
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Find valid token
        const resetToken = await db.prepare(`
            SELECT * FROM password_reset_tokens 
            WHERE token = ? AND used = 0 AND expires_at > ?
        `).get(token, new Date().toISOString());

        if (!resetToken) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user password
        await db.prepare('UPDATE users SET password = ? WHERE id = ?')
            .run(hashedPassword, resetToken.user_id);

        // Mark token as used
        await db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
            .run(resetToken.id);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

