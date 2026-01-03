/**
 * Tigo - Messages Page JavaScript
 * Conversations and chat functionality
 */

let messagesPageUser = null;
let activeConversation = null;
let messagePollInterval = null;

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

        // Poll conversations list every 10 seconds to update unread counts and last message
        setInterval(loadConversations, 10000);

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

        // Don't redraw if container is missing (e.g. navigated away)
        if (!container) return;

        if (!data.conversations || data.conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                    <p>Aucune conversation</p>
                    <p style="font-size: 0.875rem;">Vos conversations apparaîtront ici après qu'une demande de trajet soit acceptée.</p>
                </div>
            `;
            return;
        }

        // Only update if content changed to avoid breaking clicks or selection (simple implementation: fully re-render but re-add active class)
        // For auto-refresh without disrupting user interaction, we'd need more complex DOM diffing. 
        // For now, simpler: re-render is fine as long as we preserve active state.

        const currentActive = activeConversation;

        container.innerHTML = data.conversations.map(conv => `
            <div class="conversation-item ${currentActive == conv.id ? 'active' : ''}" data-id="${conv.id}">
                <img src="${conv.other_user_photo || '/assets/images/default-avatar.svg'}" alt="" class="conversation-avatar">
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
        // Don't show error toast on background poll
    }
}

async function openConversation(conversationId) {
    if (activeConversation === conversationId) return; // Prevent reload if already active (unless forced)

    activeConversation = conversationId;

    // Clear previous poll
    if (messagePollInterval) clearInterval(messagePollInterval);

    // Initial load
    await loadMessages(conversationId, true);

    // Start polling every 3 seconds
    messagePollInterval = setInterval(() => loadMessages(conversationId, false), 3000);
}

async function loadMessages(conversationId, isInitialLoad = false) {
    if (activeConversation != conversationId) return;

    try {
        const response = await fetch(`/api/messages/conversations/${conversationId}/messages`, {
            credentials: 'include'
        });
        const data = await response.json();

        // Update chat header (only needs to be done once really, but safe to redo)
        if (isInitialLoad) {
            document.getElementById('chat-name').textContent = data.otherUser.name;
            if (data.otherUser.profile_photo) {
                document.getElementById('chat-avatar').src = data.otherUser.profile_photo;
            }

            // Show chat area
            document.getElementById('chat-empty').classList.add('hidden');
            document.getElementById('chat-active').classList.remove('hidden');
        }

        const messagesContainer = document.getElementById('chat-messages');

        // Simple rendering: replace all. 
        // To prevent scroll jumping when user is reading history, we only scroll to bottom if:
        // 1. It's initial load
        // 2. User was already at bottom

        const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;

        messagesContainer.innerHTML = data.messages.map(msg => `
            <div class="message ${msg.sender_id === messagesPageUser.id ? 'sent' : ''}">
                <img src="${msg.sender_photo || '/assets/images/default-avatar.svg'}" alt="" class="message-avatar">
                <div class="message-content">
                    <p class="message-text">${escapeHtml(msg.content)}</p>
                    <div class="message-time">${formatTimeAgo(msg.created_at)}</div>
                </div>
            </div>
        `).join('');

        // Scroll to bottom rules
        if (isInitialLoad || isAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Mark as read in UI (remove badge from list)
        const convItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
        if (convItem) {
            const unreadBadge = convItem.querySelector('.conversation-unread');
            if (unreadBadge) unreadBadge.remove();
        }

    } catch (error) {
        console.error('Error loading messages:', error);
        if (isInitialLoad) {
            showToast('Erreur lors du chargement des messages', 'error');
        }
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

                // Immediately reload messages to show the new one (and any others)
                loadMessages(activeConversation, false);

                // Clear input
                input.value = '';

                // Update conversation preview in list
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
        if (messagePollInterval) {
            clearInterval(messagePollInterval);
            messagePollInterval = null;
        }

        // Refresh list to clear unread status if needed
        loadConversations();
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
