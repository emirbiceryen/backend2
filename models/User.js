const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  username: {
    type: String,
    required: false, // Temporarily make optional for existing users
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot be more than 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  hobbies: [{
    type: String,
    ref: 'Hobby'
  }],
  firstName: {
    type: String,
    trim: true,
    maxlength: [25, 'First name cannot be more than 25 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [25, 'Last name cannot be more than 25 characters']
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot be more than 500 characters']
  },
  skills: [{
    type: String,
    trim: true,
    maxlength: [50, 'Skill cannot be more than 50 characters']
  }],
  profileImage: {
    type: String,
    default: null
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  location: {
    city: {
      type: String,
      maxlength: [100, 'City cannot be more than 100 characters']
    },
    state: {
      type: String,
      maxlength: [100, 'State cannot be more than 100 characters']
    },
    country: {
      type: String,
      maxlength: [100, 'Country cannot be more than 100 characters']
    }
  },
  age: {
    type: Number,
    min: [13, 'Age must be at least 13'],
    max: [120, 'Age cannot be more than 120']
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'es', 'de', 'tr'],
    default: 'en'
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  subscriptionType: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  captainOfTeams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  accountType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'individual'
  },
  businessName: {
    type: String,
    trim: true,
    maxlength: [100, 'Business name cannot be more than 100 characters']
  },
  businessType: {
    type: String,
    trim: true,
    maxlength: [50, 'Business type cannot be more than 50 characters']
  },
  contactInfo: {
    type: String,
    trim: true,
    maxlength: [200, 'Contact info cannot be more than 200 characters']
  },
  workingHours: {
    type: String,
    trim: true,
    maxlength: [50, 'Working hours cannot be more than 50 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  }
}, {
  timestamps: true
});

// Split name into firstName and lastName before saving
userSchema.pre('save', function(next) {
  if (this.isModified('name') && this.name && !this.firstName && !this.lastName) {
    const nameParts = this.name.trim().split(' ');
    this.firstName = nameParts[0] || '';
    this.lastName = nameParts.slice(1).join(' ') || '';
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get user without password
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema); 