const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  raterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Allow multiple ratings per user (for different matches)
// No unique constraint - users can rate each other multiple times

module.exports = mongoose.model('Rating', ratingSchema); 