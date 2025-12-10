const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    // Check ban/timeout status
    const now = new Date();
    if (user.status === 'banned' || (user.bannedUntil && user.bannedUntil > now)) {
      return res.status(403).json({
        success: false,
        message: 'Account is banned.',
        bannedUntil: user.bannedUntil
      });
    }

    if (user.timeoutUntil && user.timeoutUntil > now) {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily restricted.',
        timeoutUntil: user.timeoutUntil
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error.' 
    });
  }
};

module.exports = auth; 