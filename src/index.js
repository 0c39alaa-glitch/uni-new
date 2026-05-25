const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// إعداد مجلد الملفات الثابتة مع إيقاف الفهرسة التلقائية لمنع فتح صفحة الأدمن تلقائياً
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// =====================
// الاتصال بقاعدة البيانات
// =====================
const db = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// إنشاء الجداول عند التشغيل
const createTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'student'
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      ticket_id INTEGER REFERENCES tickets(id),
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('Tables ready!');

  // إضافة المستخدمين الافتراضيين
  const adminExists = await db.query('SELECT id FROM users WHERE email = $1', ['admin@university.com']);
  if (adminExists.rows.length === 0) {
    const adminPass = await bcrypt.hash('admin123', 10);
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      ['Admin', 'admin@university.com', adminPass, 'admin']
    );
    console.log('Admin user created!');
  }

  const studentExists = await db.query('SELECT id FROM users WHERE email = $1', ['sara@university.com']);
  if (studentExists.rows.length === 0) {
    const studentPass = await bcrypt.hash('123456', 10);
    await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      ['Sara', 'sara@university.com', studentPass, 'student']
    );
    console.log('Student user created!');
  }
};

// =====================
// Middleware - التحقق من التوكن
// =====================
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  next();
};

// =====================
// Base Route (إصلاح خطأ ENOENT وتوجيه المشروع للملف الصحيح)
// =====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================
// Auth Routes
// =====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role || 'student']
    );
    return res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // إرسال رابط التوجيه الصحيح بناءً على رتبة المستخدم
    const redirectUrl = user.role === 'admin' ? '/admin.html' : '';

    return res.json({ 
      message: 'Login successful', 
      token, 
      redirectUrl,
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// =====================
// Ticket Routes
// =====================

app.post('/api/tickets', authenticate, async (req, res) => {
  try {
    const { title, description, type } = req.body;
    const result = await db.query(
      'INSERT INTO tickets (title, description, type, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, description, type, req.user.id]
    );
    return res.status(201).json({ message: 'Ticket created successfully', ticket: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/tickets/my', authenticate, async (req, res) => {
  try {
    const tickets = await db.query('SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    for (let ticket of tickets.rows) {
      const replies = await db.query('SELECT * FROM replies WHERE ticket_id = $1', [ticket.id]);
      ticket.Replies = replies.rows;
    }
    return res.json(tickets.rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.get('/api/tickets', authenticate, isAdmin, async (req, res) => {
  try {
    const tickets = await db.query(`
      SELECT tickets.*, users.name AS "userName", users.email AS "userEmail"
      FROM tickets
      JOIN users ON tickets.user_id = users.id
      ORDER BY tickets.created_at DESC
    `);
    for (let ticket of tickets.rows) {
      const replies = await db.query('SELECT * FROM replies WHERE ticket_id = $1', [ticket.id]);
      ticket.Replies = replies.rows;
      ticket.User = { name: ticket.userName, email: ticket.userEmail };
    }
    return res.json(tickets.rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put('/api/tickets/:id/status', authenticate, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.query('UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });
    return res.json({ message: 'Status updated', ticket: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/tickets/:id/reply', authenticate, isAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const ticket = await db.query('SELECT id FROM tickets WHERE id = $1', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });

    const result = await db.query(
      'INSERT INTO replies (message, ticket_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [message, req.params.id, req.user.id]
    );
    return res.status(201).json({ message: 'Reply added', reply: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const start = async () => {
  await createTables();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};
start();