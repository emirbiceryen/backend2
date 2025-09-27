const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sharedHobbies: [{
    type: String,
    ref: 'Hobby'
  }],
  // Track who liked whom
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['pending', 'mutual', 'rejected', 'ended'],
    default: 'pending'
  },
  matchedAt: {
    type: Date,
    default: Date.now
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Track which users have rated each other
  ratings: {
    user1Rated: {
      type: Boolean,
      default: false
    },
    user2Rated: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Ensure unique matches between users
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });

// Method to get the other user in the match
matchSchema.methods.getOtherUser = function(userId) {
  return this.user1.equals(userId) ? this.user2 : this.user1;
};

module.exports = mongoose.model('Match', matchSchema); 