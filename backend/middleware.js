const jwt = require('jsonwebtoken');
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'); next(); }
  catch { res.status(401).json({ message: 'Authentication required' }); }
}
module.exports = { auth };
