const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [50, 'Team name cannot be more than 50 characters']
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Team captain is required']
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sport: {
    type: String,
    required: [true, 'Sport is required'],
    enum: ['football', 'basketball', 'volleyball']
  },
  maxMembers: {
    type: Number,
    required: true,
    default: function() {
      // Set max members based on sport
      switch (this.sport) {
        case 'football':
          return 7;
        case 'basketball':
        case 'volleyball':
          return 5;
        default:
          return 5;
      }
    }
  },
  profileImage: {
    type: String,
    default: null
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot be more than 200 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure captain is always in members array
teamSchema.pre('save', function(next) {
  if (this.isModified('captain') && this.captain) {
    if (!this.members.includes(this.captain)) {
      this.members.push(this.captain);
    }
  }
  next();
});

// Virtual for current member count
teamSchema.virtual('currentMemberCount').get(function() {
  return this.members.length;
});

// Virtual for available spots
teamSchema.virtual('availableSpots').get(function() {
  return this.maxMembers - this.members.length;
});

// Method to check if user can join team
teamSchema.methods.canUserJoin = function(userId) {
  // Check if team is full
  if (this.members.length >= this.maxMembers) {
    return { canJoin: false, reason: 'Team is full' };
  }
  
  // Check if user is already a member
  if (this.members.includes(userId)) {
    return { canJoin: false, reason: 'User is already a member' };
  }
  
  return { canJoin: true, reason: 'Can join' };
};

// Method to add member to team
teamSchema.methods.addMember = function(userId) {
  const canJoin = this.canUserJoin(userId);
  if (!canJoin.canJoin) {
    throw new Error(canJoin.reason);
  }
  
  this.members.push(userId);
  return this.save();
};

// Method to remove member from team
teamSchema.methods.removeMember = function(userId) {
  // Captain cannot be removed
  if (this.captain.equals(userId)) {
    throw new Error('Captain cannot be removed from team');
  }
  
  this.members = this.members.filter(memberId => !memberId.equals(userId));
  return this.save();
};

// Index for efficient queries
teamSchema.index({ captain: 1 });
teamSchema.index({ members: 1 });
teamSchema.index({ sport: 1 });
teamSchema.index({ isActive: 1 });

module.exports = mongoose.model('Team', teamSchema);