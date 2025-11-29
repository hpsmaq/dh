class ChatApp {
    constructor() {
        this.socket = io();
        this.username = '';
        this.isConnected = false;

        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadUsername();
    }

    initializeElements() {
        this.usernameInput = document.getElementById('username');
        this.messageInput = document.getElementById('message');
        this.sendButton = document.getElementById('send-btn');
        this.messagesContainer = document.getElementById('messages');
        this.onlineCount = document.getElementById('online-count');
    }

    setupEventListeners() {
        // 发送消息事件
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 用户名保存
        this.usernameInput.addEventListener('change', () => {
            this.saveUsername();
        });

        // 输入验证
        this.messageInput.addEventListener('input', () => {
            this.validateInputs();
        });

        this.usernameInput.addEventListener('input', () => {
            this.validateInputs();
        });
    }

    setupSocketListeners() {
        // 接收聊天历史
        this.socket.on('chat history', (messages) => {
            this.messagesContainer.innerHTML = '';
            messages.forEach(message => this.displayMessage(message));
            this.scrollToBottom();
        });

        // 接收新消息
        this.socket.on('chat message', (message) => {
            this.displayMessage(message);
            this.scrollToBottom();
        });

        // 错误处理
        this.socket.on('error', (error) => {
            this.showError(error);
        });

        // 连接状态
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.updateOnlineCount();
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.showSystemMessage('与服务器断开连接，正在尝试重连...');
        });

        this.socket.on('reconnect', () => {
            this.showSystemMessage('重新连接到服务器');
            this.updateOnlineCount();
        });
    }

    sendMessage() {
        const username = this.usernameInput.value.trim();
        const content = this.messageInput.value.trim();

        if (!username) {
            this.showError('请输入昵称');
            this.usernameInput.focus();
            return;
        }

        if (!content) {
            this.showError('请输入消息内容');
            this.messageInput.focus();
            return;
        }

        if (this.isConnected) {
            this.socket.emit('chat message', {
                username: username,
                content: content
            });

            this.messageInput.value = '';
            this.validateInputs();
        } else {
            this.showError('未连接到服务器，请稍后重试');
        }
    }

    displayMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';

        const timestamp = new Date(message.timestamp).toLocaleString('zh-CN');

        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${this.escapeHtml(message.username)}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;

        this.messagesContainer.appendChild(messageElement);
    }

    showSystemMessage(content) {
        const systemElement = document.createElement('div');
        systemElement.className = 'system-message';
        systemElement.textContent = content;
        this.messagesContainer.appendChild(systemElement);
        this.scrollToBottom();
    }

    showError(message) {
        // 移除现有错误消息
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;

        this.messagesContainer.parentNode.insertBefore(
            errorElement,
            this.messagesContainer.nextSibling
        );

        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 5000);
    }

    validateInputs() {
        const hasUsername = this.usernameInput.value.trim().length > 0;
        const hasMessage = this.messageInput.value.trim().length > 0;

        this.sendButton.disabled = !hasUsername || !hasMessage || !this.isConnected;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    saveUsername() {
        const username = this.usernameInput.value.trim();
        if (username) {
            localStorage.setItem('chat_username', username);
        }
    }

    loadUsername() {
        const savedUsername = localStorage.getItem('chat_username');
        if (savedUsername) {
            this.usernameInput.value = savedUsername;
        }
        this.validateInputs();
    }

    async updateOnlineCount() {
        try {
            const response = await fetch('/api/online-users');
            const data = await response.json();
            this.onlineCount.textContent = data.count;
        } catch (error) {
            console.error('Error fetching online count:', error);
        }
    }
}

// 初始化聊天应用
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});