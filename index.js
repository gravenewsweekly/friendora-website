// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC36uiUsT2ff_lzqmADYKtAPM6HDY7fUmk",
    authDomain: "qans-60db9.firebaseapp.com",
    databaseURL: "https://qans-60db9-default-rtdb.firebaseio.com",
    projectId: "qans-60db9",
    storageBucket: "qans-60db9.firebasestorage.app",
    messagingSenderId: "801823158288",
    appId: "1:801823158288:web:dfb251f82510316cdf9a95"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM elements
const elements = {
    postForm: document.getElementById('postForm'),
    postsList: document.getElementById('postsList'),
    modal: document.getElementById('commentsModal'),
    closeBtn: document.querySelector('.close'),
    commentForm: document.getElementById('commentForm'),
    commentsList: document.getElementById('commentsList'),
    likeBtn: document.getElementById('likeBtn'),
    dislikeBtn: document.getElementById('dislikeBtn'),
    likeCount: document.getElementById('likeCount'),
    dislikeCount: document.getElementById('dislikeCount'),
    commentsCount: document.getElementById('commentsCount'),
    modalTitle: document.getElementById('modalTitle'),
    modalDescription: document.getElementById('modalDescription'),
    modalUsername: document.getElementById('modalUsername'),
    modalTimestamp: document.getElementById('modalTimestamp'),
    sortBy: document.getElementById('sortBy'),
    postSubmitBtn: document.getElementById('postSubmitBtn'),
    commentSubmitBtn: document.getElementById('commentSubmitBtn')
};

let currentPostId = null;
let postsData = {};

// Initialize app
function init() {
    setupEventListeners();
    setupRealTimeListeners();
}

// Setup event listeners
function setupEventListeners() {
    elements.postForm.addEventListener('submit', handlePostSubmit);
    elements.commentForm.addEventListener('submit', handleCommentSubmit);
    elements.closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });
    elements.likeBtn.addEventListener('click', () => handleReaction('like'));
    elements.dislikeBtn.addEventListener('click', () => handleReaction('dislike'));
    elements.sortBy.addEventListener('change', renderPosts);
}

// Setup real-time listeners
function setupRealTimeListeners() {
    database.ref('posts').on('value', (snapshot) => {
        postsData = snapshot.val() || {};
        renderPosts();
    }, handleError);
}

// Handle post submission
async function handlePostSubmit(e) {
    e.preventDefault();
    const username = sanitizeInput(elements.postForm.username.value.trim());
    const title = sanitizeInput(elements.postForm.title.value.trim());
    const description = sanitizeInput(elements.postForm.description.value.trim());

    if (!validateInput(username, 'Username', 3, 30)) return;
    if (!validateInput(title, 'Title', 5, 100)) return;
    if (!validateInput(description, 'Description', 10, 1000)) return;

    disableButton(elements.postSubmitBtn);
    try {
        const postData = {
            username,
            title,
            description,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            likes: 0,
            dislikes: 0,
            commentsCount: 0,
            reactions: {}
        };

        await database.ref('posts').push(postData);
        elements.postForm.reset();
    } catch (error) {
        handleError(error);
    } finally {
        enableButton(elements.postSubmitBtn);
    }
}

// Render posts
function renderPosts() {
    if (!postsData || Object.keys(postsData).length === 0) {
        elements.postsList.innerHTML = '<p class="no-posts">No questions yet. Be the first to ask!</p>';
        return;
    }

    const postsArray = Object.entries(postsData).map(([id, post]) => ({ id, ...post }));
    sortPosts(postsArray);

    elements.postsList.innerHTML = postsArray.map(post => `
        <div class="post">
            <h3>${escapeHtml(post.title)}</h3>
            <p class="post-description">${truncateText(escapeHtml(post.description), 150)}</p>
            <div class="post-meta">
                <span>Posted by: ${escapeHtml(post.username)}</span>
                <span>${formatDate(post.timestamp)}</span>
            </div>
            <div class="post-actions">
                <button class="view-comments" data-postid="${post.id}">
                    View Comments (${post.commentsCount || 0})
                </button>
                <div class="reactions-preview">
                    <span>👍 ${post.likes || 0}</span>
                    <span>👎 ${post.dislikes || 0}</span>
                </div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.view-comments').forEach(btn => {
        btn.addEventListener('click', (e) => openCommentsModal(e.target.dataset.postid));
    });
}

// Sort posts based on selection
function sortPosts(postsArray) {
    const sortOption = elements.sortBy.value;
    postsArray.sort((a, b) => {
        switch (sortOption) {
            case 'newest': return b.timestamp - a.timestamp;
            case 'oldest': return a.timestamp - b.timestamp;
            case 'mostLiked': return (b.likes || 0) - (a.likes || 0);
            case 'mostCommented': return (b.commentsCount || 0) - (a.commentsCount || 0);
        }
    });
}

// Open comments modal
function openCommentsModal(postId) {
    currentPostId = postId;
    elements.modal.style.display = 'block';
    
    const post = postsData[postId];
    if (!post) {
        closeModal();
        return alert('Post not found');
    }

    elements.modalTitle.textContent = escapeHtml(post.title);
    elements.modalDescription.textContent = escapeHtml(post.description);
    elements.modalUsername.textContent = `Posted by: ${escapeHtml(post.username)}`;
    elements.modalTimestamp.textContent = formatDate(post.timestamp);
    elements.likeCount.textContent = post.likes || 0;
    elements.dislikeCount.textContent = post.dislikes || 0;
    elements.commentsCount.textContent = post.commentsCount || 0;

    setupRealTimeComments(postId);
}

// Setup real-time comments
function setupRealTimeComments(postId) {
    database.ref(`posts/${postId}/comments`).off(); // Remove previous listeners
    database.ref(`posts/${postId}/comments`).on('value', (snapshot) => {
        const comments = snapshot.val() || {};
        renderComments(comments);
    }, handleError);
}

// Render comments
function renderComments(comments) {
    elements.commentsList.innerHTML = Object.entries(comments).length === 0
        ? '<p class="no-comments">No comments yet</p>'
        : Object.entries(comments)
            .map(([id, comment]) => `
                <div class="comment">
                    <p class="comment-text">${escapeHtml(comment.text)}</p>
                    <div class="comment-meta">
                        <span>By: ${escapeHtml(comment.username)}</span>
                        <span>${formatDate(comment.timestamp)}</span>
                    </div>
                </div>
            `)
            .sort((a, b) => b.timestamp - a.timestamp)
            .join('');
}

// Handle comment submission
async function handleCommentSubmit(e) {
    e.preventDefault();
    const username = sanitizeInput(elements.commentForm.commentUsername.value.trim());
    const text = sanitizeInput(elements.commentForm.commentText.value.trim());

    if (!validateInput(username, 'Username', 3, 30)) return;
    if (!validateInput(text, 'Comment', 5, 500)) return;

    disableButton(elements.commentSubmitBtn);
    try {
        const commentData = {
            username,
            text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await Promise.all([
            database.ref(`posts/${currentPostId}/comments`).push(commentData),
            database.ref(`posts/${currentPostId}/commentsCount`).transaction(count => (count || 0) + 1)
        ]);
        elements.commentForm.reset();
    } catch (error) {
        handleError(error);
    } finally {
        enableButton(elements.commentSubmitBtn);
    }
}

// Handle reactions
async function handleReaction(type) {
    const username = sanitizeInput(elements.commentForm.commentUsername.value.trim() || 
                                 elements.postForm.username.value.trim());
    
    if (!validateInput(username, 'Username', 3, 30)) {
        return alert('Please enter a valid username to react');
    }

    try {
        await database.ref(`posts/${currentPostId}`).transaction(post => {
            if (!post) return post;
            post.reactions = post.reactions || {};
            
            const reactionKey = Object.keys(post.reactions).find(
                key => post.reactions[key].username === username
            );
            
            if (reactionKey && post.reactions[reactionKey].type === type) {
                delete post.reactions[reactionKey];
                post[type + 's'] = (post[type + 's'] || 0) - 1;
            } else if (reactionKey) {
                const oldType = post.reactions[reactionKey].type;
                post.reactions[reactionKey].type = type;
                post[oldType + 's'] = (post[oldType + 's'] || 0) - 1;
                post[type + 's'] = (post[type + 's'] || 0) + 1;
            } else {
                const newKey = database.ref().push().key;
                post.reactions[newKey] = { username, type };
                post[type + 's'] = (post[type + 's'] || 0) + 1;
            }
            return post;
        });
    } catch (error) {
        handleError(error);
    }
}

// Close modal
function closeModal() {
    elements.modal.style.display = 'none';
    currentPostId = null;
    database.ref(`posts/${currentPostId}/comments`).off();
}

// Helper functions
function formatDate(timestamp) {
    return timestamp ? new Date(timestamp).toLocaleString() : '';
}

function validateInput(value, field, min, max) {
    if (!value || value.length < min || value.length > max) {
        alert(`${field} must be between ${min} and ${max} characters`);
        return false;
    }
    return true;
}

function sanitizeInput(input) {
    return input.replace(/[<>&'"]/g, char => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&#39;',
        '"': '&quot;'
    }[char]));
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, max) {
    return text.length > max ? text.substring(0, max) + '...' : text;
}

function disableButton(btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
}

function enableButton(btn) {
    btn.disabled = false;
    btn.textContent = btn.id === 'postSubmitBtn' ? 'Post Question' : 'Post Comment';
}

function handleError(error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
}

// Start app
document.addEventListener('DOMContentLoaded', init);
