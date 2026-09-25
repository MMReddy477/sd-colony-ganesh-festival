const jwt = require('jsonwebtoken');
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (!['admin', 'party'].includes(req.user.role)) return res.status(403).json({ message: 'Finance access required' });
    req.user.scope = req.user.scope || (req.user.role === 'party' ? 'party' : 'ganesh');
    next();
  }
  catch { res.status(401).json({ message: 'Authentication required' }); }
}
module.exports = { auth };
