/**
 * Messages Routes
 * Conversations and messaging between users
 */

const express = require('express');
const { getDb } = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all conversations for current user
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const userId = req.session.userId;

        const conversations = await db.prepare(`
      SELECT c.*, 
             tr.status as request_status,
             t.departure_city, t.arrival_city, t.date as trip_date,
             CASE WHEN c.user1_id = ? THEN u2.name ELSE u1.name END as other_user_name,
             CASE WHEN c.user1_id = ? THEN u2.profile_photo ELSE u1.profile_photo END as other_user_photo,
             CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as other_user_id,
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND read = 0) as unread_count
      FROM conversations c
      JOIN trip_requests tr ON c.trip_request_id = tr.id
      JOIN trips t ON tr.trip_id = t.id
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY last_message_time DESC
    `).all(userId, userId, userId, userId, userId, userId);

        res.json({ conversations });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get messages in a conversation
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const userId = req.session.userId;
        const conversationId = req.params.id;

        // Check if user is part of this conversation
        // Check if user is part of this conversation
        const conversation = await db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, userId, userId);

        if (!conversation) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Mark messages as read
        await db.prepare(`
      UPDATE messages SET read = 1 
      WHERE conversation_id = ? AND sender_id != ?
    `).run(conversationId, userId);

        // Get messages
        const messages = await db.prepare(`
      SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `).all(conversationId);

        // Get conversation info
        const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
        const otherUser = await db.prepare('SELECT id, name, profile_photo FROM users WHERE id = ?').get(otherUserId);

        res.json({ messages, conversation, otherUser });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send a message
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const userId = req.session.userId;
        const conversationId = req.params.id;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Check if user is part of this conversation
        // Check if user is part of this conversation
        const conversation = await db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, userId, userId);

        if (!conversation) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Insert message
        const result = await db.prepare(`
      INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)
    `).run(conversationId, userId, content.trim());

        // Create notification for other user
        const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
        const sender = await db.prepare('SELECT name FROM users WHERE id = ?').get(userId);

        await db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (?, 'new_message', 'Nouveau message', ?, '/messages.html')
    `).run(otherUserId, `${sender.name}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);

        // Get the inserted message
        const message = await db.prepare(`
      SELECT m.*, u.name as sender_name, u.profile_photo as sender_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json({ message });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get unread message count
router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        const db = await getDb();
        const result = await db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user1_id = ? OR c.user2_id = ?) 
        AND m.sender_id != ? 
        AND m.read = 0
    `).get(req.session.userId, req.session.userId, req.session.userId);

        res.json({ count: result.count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
