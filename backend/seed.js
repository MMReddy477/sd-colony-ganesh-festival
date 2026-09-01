try { require('dotenv').config(); } catch {}
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./models');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ganesh_utsav');
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'change-me-now';
  await User.findOneAndUpdate({ username }, { username, password: await bcrypt.hash(password, 12), role: 'admin' }, { upsert: true });
  console.log(`Admin seeded: ${username}`);
  await mongoose.disconnect();
})();
