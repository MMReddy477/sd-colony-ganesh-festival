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
mongoose.set('bufferCommands', false);
if (process.env.NODE_ENV === 'production' && (!process.env.MONGODB_URI || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET)) {
  throw new Error('Missing production environment configuration');
}
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
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
app.use('/uploads', express.static(uploadDir, {
  maxAge: 0,
  etag: true,
  lastModified: true,
  setHeaders: response => {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
  }
}));
app.use(express.static(path.join(__dirname, '..', 'frontend'), { setHeaders: response => response.setHeader('Cache-Control', 'no-store') }));
app.get('/phonepe-qr.jpeg', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'phonepe-qr.jpeg')));
app.get('/ganesh-logo.png', (_req, res) => res.sendFile(path.join(__dirname, '..', 'ganesh-logo.png')));
app.get('/GaneshIdol_detail.jpeg', (_req, res) => res.sendFile(path.join(__dirname, '..', 'GaneshIdol_detail.jpeg')));
app.get('/beautiful-lord-ganesha-ganesh.jpg', (_req, res) => res.sendFile(path.join(__dirname, '..', 'beautiful-lord-ganesha-ganesh.jpg')));
app.get('/api/health', (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ ok: mongoose.connection.readyState === 1, service: 'ganesh-utsav', database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' }));
app.use('/api', (req, res, next) => {
  const publicRoutes = ['/public', '/auth/login'];
  const shouldSkipDbCheck = publicRoutes.includes(req.path) || req.path.startsWith('/receipts/') || req.path.startsWith('/reports/');
  if (shouldSkipDbCheck) return next();
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database unavailable. Start MongoDB to enable admin data.' });
  next();
});
app.use('/api', api);
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

app.listen(port, () => console.log(`Ganesh Utsav running on http://localhost:${port}`));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ganesh_utsav')
  .then(async () => {
    try {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'change-me-now';
      if (mongoose.connection.readyState !== 1) return;
      const existingUser = await User.findOne({ username });
      if (!existingUser) {
        await User.create({ username, password: await bcrypt.hash(password, 12), role: 'admin' });
      }
    } catch (error) {
      console.error('Default admin initialization failed:', error.message);
    }
  })
  .catch((error) => {
    console.error('MongoDB connection failed; database features are unavailable:', error.message);
  });
