/**
 * Tigo - Messages Page JavaScript
 * Conversations and chat functionality
 */

let messagesPageUser = null; // Use different variable name to avoid conflict with auth.js
let activeConversation = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const isLoggedIn = await checkAuth();
        if (!isLoggedIn) {
            showToast('Veuillez vous connecter pour accéder à vos messages', 'warning');
            setTimeout(() => window.location.href = '/login.html', 1500);
            return;
        }

        // Get current user
        const authRes = await fetch('/api/auth/me', { credentials: 'include' });
        const authData = await authRes.json();
        messagesPageUser = authData.user;

        await loadConversations();
        setupMessageForm();
        setupBackButton();
    } catch (error) {
        console.error('Messages init error:', error);
        showToast('Erreur de chargement', 'error');
    }
});

async function loadConversations() {
    try {
        const response = await fetch('/api/messages/conversations', { credentials: 'include' });
        const data = await response.json();

        const container = document.getElementById('conversations-list');

        if (!data.conversations || data.conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                    <p>Aucune conversation</p>
                    <p style="font-size: 0.875rem;">Vos conversations apparaîtront ici après qu'une demande de trajet soit acceptée.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = data.conversations.map(conv => `
            <div class="conversation-item" data-id="${conv.id}">
                <img src="${conv.other_user_photo || '/assets/images/default-avatar.png'}" alt="" class="conversation-avatar">
                <div class="conversation-info">
                    <div class="conversation-name">${conv.other_user_name}</div>
                    <div class="conversation-preview">${conv.last_message || 'Nouvelle conversation'}</div>
                </div>
                <div class="conversation-meta">
                    <div class="conversation-time">${conv.last_message_time ? formatTimeAgo(conv.last_message_time) : ''}</div>
                    ${conv.unread_count > 0 ? `<div class="conversation-unread">${conv.unread_count}</div>` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const convId = item.dataset.id;
                openConversation(convId);

                // Mark as active
                document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Mobile: show chat
                document.getElementById('messages-list').classList.add('has-active');
                document.getElementById('messages-chat').classList.add('active');
            });
        });

    } catch (error) {
        console.error('Error loading conversations:', error);
        const container = document.getElementById('conversations-list');
        container.innerHTML = '<p style="padding: 1rem; color: var(--error);">Erreur de chargement</p>';
    }
}

async function openConversation(conversationId) {
    activeConversation = conversationId;

    try {
        const response = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
            credentials: 'include'
        });
        const data = await response.json();

        // Update chat header
        document.getElementById('chat-name').textContent = data.otherUser.name;
        if (data.otherUser.profile_photo) {
            document.getElementById('chat-avatar').src = data.otherUser.profile_photo;
        }

        // Show chat area
        document.getElementById('chat-empty').classList.add('hidden');
        document.getElementById('chat-active').classList.remove('hidden');

        // Render messages
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = data.messages.map(msg => `
            <div class="message ${msg.sender_id === messagesPageUser.id ? 'sent' : ''}">
                <img src="${msg.sender_photo || '/assets/images/default-avatar.png'}" alt="" class="message-avatar">
                <div class="message-content">
                    <p class="message-text">${escapeHtml(msg.content)}</p>
                    <div class="message-time">${formatTimeAgo(msg.created_at)}</div>
                </div>
            </div>
        `).join('');

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Mark as read in UI
        const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
        if (convItem) {
            const unreadBadge = convItem.querySelector('.conversation-unread');
            if (unreadBadge) unreadBadge.remove();
        }

    } catch (error) {
        console.error('Error loading messages:', error);
        showToast('Erreur lors du chargement des messages', 'error');
    }
}

function setupMessageForm() {
    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = input.value.trim();
        if (!content || !activeConversation) return;

        try {
            const response = await fetch(`/api/messages/conversations/${activeConversation}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();

                // Add message to UI
                const messagesContainer = document.getElementById('chat-messages');
                const messageHtml = `
                    <div class="message sent">
                        <img src="${messagesPageUser.profile_photo || '/assets/images/default-avatar.png'}" alt="" class="message-avatar">
                        <div class="message-content">
                            <p class="message-text">${escapeHtml(content)}</p>
                            <div class="message-time">À l'instant</div>
                        </div>
                    </div>
                `;
                messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;

                // Clear input
                input.value = '';

                // Update conversation preview
                const convItem = document.querySelector(`.conversation-item[data-id="${activeConversation}"]`);
                if (convItem) {
                    convItem.querySelector('.conversation-preview').textContent = content;
                    convItem.querySelector('.conversation-time').textContent = 'À l\'instant';
                }
            } else {
                showToast('Erreur lors de l\'envoi du message', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Erreur de connexion', 'error');
        }
    });
}

function setupBackButton() {
    const backBtn = document.getElementById('chat-back');

    backBtn.addEventListener('click', () => {
        document.getElementById('messages-list').classList.remove('has-active');
        document.getElementById('messages-chat').classList.remove('active');
        activeConversation = null;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
