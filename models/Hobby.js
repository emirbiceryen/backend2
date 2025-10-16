const mongoose = require('mongoose');

const hobbySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hobby name is required'],
    unique: true,
    trim: true,
    maxlength: [50, 'Hobby name cannot be more than 50 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Sports & Fitness', 'Creative Arts', 'Technology', 'Outdoor Activities', 'Social Activities', 'Learning & Education', 'Food & Cooking', 'Music & Entertainment', 'Travel & Adventure', 'Other']
  },
  icon: {
    type: String,
    required: [true, 'Icon is required'],
    maxlength: [10, 'Icon cannot be more than 10 characters']
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot be more than 200 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    required: true,
    unique: true
  }
}, {
  timestamps: true
});

// Index for better query performance
hobbySchema.index({ category: 1, name: 1 });

module.exports = mongoose.model('Hobby', hobbySchema); 