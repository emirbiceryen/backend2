const multer = require('multer');
const path = require('path');

// Use memory storage instead of disk storage
// Files will be stored in memory and uploaded to Firebase Storage
const storage = multer.memoryStorage();

// File filter to only allow images and common file types
const fileFilter = (req, file, cb) => {
  // Allow images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  }
  // Allow common file types
  else if (file.mimetype === 'application/pdf' || 
           file.mimetype === 'text/plain' || 
           file.mimetype === 'application/msword' ||
           file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    cb(null, true);
  }
  else {
    cb(new Error('Invalid file type. Only images and common document types are allowed.'), false);
  }
};

// Configure multer with memory storage
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files per post
  }
});

module.exports = upload; 