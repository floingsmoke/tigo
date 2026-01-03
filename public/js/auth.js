/**
 * Tigo - Authentication JavaScript
 * Handles user session and navbar state
 */

let currentUser = null;

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data.user;
            updateNavbarForLoggedIn(data.user);
            loadNotifications();
            loadUnreadMessages();
            return true;
        } else {
            updateNavbarForLoggedOut();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        updateNavbarForLoggedOut();
        return false;
    }
}

function updateNavbarForLoggedIn(user) {
    // Hide auth buttons
    const authDiv = document.getElementById('navbar-auth');
    if (authDiv) authDiv.classList.add('hidden');

    // Show user menu
    const userDiv = document.getElementById('navbar-user');
    if (userDiv) {
        userDiv.classList.remove('hidden');
        document.getElementById('navbar-username').textContent = user.name.split(' ')[0];
        if (user.profile_photo) {
            document.getElementById('navbar-avatar').src = user.profile_photo;
        }
    }

    // Show notifications
    const notifDiv = document.getElementById('navbar-notifications');
    if (notifDiv) notifDiv.classList.remove('hidden');

    // Show messages
    const messagesBtn = document.getElementById('messages-btn');
    if (messagesBtn) messagesBtn.classList.remove('hidden');

    // Show post trip button
    const postTripBtn = document.getElementById('post-trip-btn');
    if (postTripBtn) postTripBtn.classList.remove('hidden');
}

function updateNavbarForLoggedOut() {
    // Show auth buttons
    const authDiv = document.getElementById('navbar-auth');
    if (authDiv) authDiv.classList.remove('hidden');

    // Hide user menu
    const userDiv = document.getElementById('navbar-user');
    if (userDiv) userDiv.classList.add('hidden');

    // Hide notifications
    const notifDiv = document.getElementById('navbar-notifications');
    if (notifDiv) notifDiv.classList.add('hidden');

    // Hide messages
    const messagesBtn = document.getElementById('messages-btn');
    if (messagesBtn) messagesBtn.classList.add('hidden');

    // Hide post trip button
    const postTripBtn = document.getElementById('post-trip-btn');
    if (postTripBtn) postTripBtn.classList.add('hidden');
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications', { credentials: 'include' });
        const data = await response.json();

        const countBadge = document.getElementById('notification-count');
        const unread = data.notifications.filter(n => !n.read).length;

        if (unread > 0) {
            countBadge.textContent = unread;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }

        // Populate dropdown
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.innerHTML = `
        <div class="notification-dropdown-header">
          <span class="notification-dropdown-title">Notifications</span>
          <button class="btn btn-ghost btn-sm" onclick="markAllNotificationsRead()">Tout marquer lu</button>
        </div>
        <div class="notification-dropdown-body">
          ${data.notifications.length === 0 ?
                    '<p style="padding: 1rem; text-align: center; color: var(--gray-500);">Aucune notification</p>' :
                    data.notifications.slice(0, 10).map(notif => `
              <div class="notification-item ${notif.read ? '' : 'unread'}" onclick="handleNotificationClick(${notif.id}, '${notif.link || ''}')">
                <div class="notification-icon">
                  ${notif.type === 'request_received' ? '📨' :
                            notif.type === 'request_accepted' ? '✅' :
                                notif.type === 'request_rejected' ? '❌' : '💬'}
                </div>
                <div class="notification-content">
                  <div class="notification-title">${notif.title}</div>
                  <div class="notification-message">${notif.message}</div>
                  <div class="notification-time">${formatTimeAgo(notif.created_at)}</div>
                </div>
              </div>
            `).join('')
                }
        </div>
      `;
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

async function loadUnreadMessages() {
    try {
        const response = await fetch('/api/messages/unread-count', { credentials: 'include' });
        const data = await response.json();

        const countBadge = document.getElementById('message-count');
        if (countBadge) {
            if (data.count > 0) {
                countBadge.textContent = data.count;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Failed to load message count:', error);
    }
}

async function handleNotificationClick(notifId, link) {
    // Mark as read
    await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PUT',
        credentials: 'include'
    });

    // Navigate if link provided
    if (link) {
        window.location.href = link;
    } else {
        loadNotifications();
    }
}

async function markAllNotificationsRead() {
    await fetch('/api/notifications/read-all', {
        method: 'PUT',
        credentials: 'include'
    });
    loadNotifications();
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
    return formatDateShort(dateString);
}

// Global logout function
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/';
    } catch (e) {
        console.error('Logout error:', e);
        window.location.href = '/';
    }
}

// Check auth on page load
document.addEventListener('DOMContentLoaded', checkAuth);
