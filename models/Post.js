const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const eventApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  username: {
    type: String,
    trim: true
  },
  userProfileImage: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
});

const eventDetailsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  maxParticipants: {
    type: Number,
    required: true,
    min: 1
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  applications: [eventApplicationSchema],
  hobbyType: {
    type: String,
    trim: true
  },
  price: {
    type: String,
    trim: true
  }
});

const pollOptionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  votes: {
    type: Number,
    default: 0
  },
  votedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
});

const postSchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['general', 'event', 'activity', 'sponsored'],
    default: 'general'
  },
  tags: [{
    type: String,
    trim: true
  }],
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  media: [{
    type: String // URLs to images/videos
  }],
  isPoll: {
    type: Boolean,
    default: false
  },
  isSingleChoice: {
    type: Boolean,
    default: true
  },
  pollOptions: [pollOptionSchema],
  isEvent: {
    type: Boolean,
    default: false
  },
  eventDetails: eventDetailsSchema,
  createdByType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'individual'
  },
  isBusinessEvent: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
postSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better query performance
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ isEvent: 1, createdAt: -1 });
postSchema.index({ isBusinessEvent: 1, createdAt: -1 });
postSchema.index({ createdByType: 1, createdAt: -1 });
postSchema.index({ authorId: 1, isEvent: 1, isBusinessEvent: 1, createdAt: -1 }); // Compound index for business events query
postSchema.index({ tags: 1 });
postSchema.index({ createdAt: -1 }); // General sorting index

module.exports = mongoose.model('Post', postSchema); 