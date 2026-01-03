/**
 * Notifications Routes
 * Get and manage user notifications
 */

const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all notifications for current user
router.get('/', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const notifications = await db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.session.userId);

        res.json({ notifications });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND read = 0
    `).get(req.session.userId);

        res.json({ count: result.count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        await db.prepare(`
      UPDATE notifications SET read = 1 
      WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.session.userId);

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark all notifications as read
router.put('/read-all', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        await db.prepare(`
      UPDATE notifications SET read = 1 WHERE user_id = ?
    `).run(req.session.userId);

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a notification
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        await db.prepare(`
      DELETE FROM notifications WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.session.userId);

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
