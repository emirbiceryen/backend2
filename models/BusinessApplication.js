const mongoose = require('mongoose');

const businessApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  taxNumber: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  documents: [{
    type: String, // File paths or URLs
    default: []
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Creates createdAt and updatedAt automatically
});

// Indexes for better query performance
businessApplicationSchema.index({ userId: 1, status: 1 });
businessApplicationSchema.index({ status: 1, createdAt: -1 });
businessApplicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BusinessApplication', businessApplicationSchema);

