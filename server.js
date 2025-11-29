const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 中间件
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 数据库初始化
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    )
  `);

    // 创建清理过期消息的索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp)`);
}

// 48小时消息清理函数
function cleanOldMessages() {
    const fortyEightHoursAgo = moment().subtract(48, 'hours').format('YYYY-MM-DD HH:mm:ss');

    db.run(
        'DELETE FROM messages WHERE timestamp < ?',
        [fortyEightHoursAgo],
        function (err) {
            if (err) {
                console.error('Error cleaning old messages:', err);
            } else {
                console.log(`Cleaned ${this.changes} old messages`);
            }
        }
    );
}

// 每30分钟清理一次过期消息
setInterval(cleanOldMessages, 30 * 60 * 1000);

// Socket.io 连接处理
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 获取客户端IP
    const clientIp = socket.handshake.headers['x-forwarded-for'] ||
        socket.handshake.address;

    // 发送最近的聊天历史
    db.all(
        `SELECT username, content, timestamp 
     FROM messages 
     WHERE timestamp > datetime('now', '-48 hours') 
     ORDER BY timestamp DESC 
     LIMIT 100`,
        (err, rows) => {
            if (!err) {
                socket.emit('chat history', rows.reverse());
            }
        }
    );

    // 处理新消息
    socket.on('chat message', (data) => {
        const { username, content } = data;

        if (!username || !content || content.trim() === '') {
            socket.emit('error', '用户名和消息内容不能为空');
            return;
        }

        // 限制消息长度
        if (content.length > 500) {
            socket.emit('error', '消息长度不能超过500字符');
            return;
        }

        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

        // 保存到数据库
        db.run(
            'INSERT INTO messages (username, content, timestamp, ip_address) VALUES (?, ?, ?, ?)',
            [username.substring(0, 20), content.substring(0, 500), timestamp, clientIp],
            function (err) {
                if (err) {
                    console.error('Error saving message:', err);
                    socket.emit('error', '发送消息失败');
                } else {
                    // 广播消息给所有用户
                    const messageData = {
                        id: this.lastID,
                        username: username.substring(0, 20),
                        content: content.substring(0, 500),
                        timestamp: timestamp
                    };

                    io.emit('chat message', messageData);
                    console.log('Message saved:', messageData);
                }
            }
        );
    });

    // 处理用户断开连接
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// 获取在线用户数量
app.get('/api/online-users', (req, res) => {
    res.json({ count: io.engine.clientsCount });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    cleanOldMessages(); // 启动时立即清理一次
});