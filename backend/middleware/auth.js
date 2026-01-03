/**
 * Authentication Middleware
 * Check if user is logged in
 */

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

function optionalAuth(req, res, next) {
    // Just continue, session may or may not have userId
    next();
}

module.exports = { requireAuth, optionalAuth };
