try { require('dotenv').config(); } catch {}
process.env.COMMITTEE_NAME = process.env.COMMITTEE_NAME || 'SD Colony Ganesh Utsav Committee';
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { User } = require('./models');
const api = require('./routes/api');

const app = express();
const port = process.env.PORT || 5002;
if (process.env.NODE_ENV === 'production' && (!process.env.MONGODB_URI || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET)) {
  throw new Error('Missing production environment configuration');
}
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, '..', 'frontend'), { setHeaders: response => response.setHeader('Cache-Control', 'no-store') }));
app.get('/ganesh-logo.png', (_req, res) => res.sendFile(path.join(__dirname, '..', 'ganesh-logo.png')));
app.get('/GaneshIdol_detail.jpeg', (_req, res) => res.sendFile(path.join(__dirname, '..', 'GaneshIdol_detail.jpeg')));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ganesh-utsav' }));
app.use('/api', api);
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ganesh_utsav')
  .then(async () => {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'change-me-now';
    await User.findOneAndUpdate(
      { username },
      { username, password: await bcrypt.hash(password, 12), role: 'admin' },
      { upsert: true, setDefaultsOnInsert: true }
    );
    app.listen(port, () => console.log(`Ganesh Utsav running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
