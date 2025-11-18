const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const BusinessApplication = require('../models/BusinessApplication');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/business-documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'business-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and common document formats
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and document files are allowed'));
    }
  }
});

/**
 * @route   POST /business/apply
 * @desc    Submit business application
 * @access  Private
 */
router.post('/apply', [
  auth,
  upload.array('documents', 5), // Max 5 documents
  body('businessName').trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be between 2 and 100 characters'),
  body('taxNumber').trim().isLength({ min: 1 }).withMessage('Tax number is required'),
  body('phone').trim().isLength({ min: 10 }).withMessage('Phone number is required'),
  body('address').trim().isLength({ min: 5 }).withMessage('Address is required'),
  body('website').optional().isURL().withMessage('Website must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if user already has a pending or approved application
    const existingApplication = await BusinessApplication.findOne({
      userId: req.user._id,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: existingApplication.status === 'pending' 
          ? 'You already have a pending application'
          : 'You already have an approved business account'
      });
    }

    // Get uploaded document paths
    const documents = req.files ? req.files.map(file => `/uploads/business-documents/${file.filename}`) : [];

    // Create business application
    const application = new BusinessApplication({
      userId: req.user._id,
      businessName: req.body.businessName,
      taxNumber: req.body.taxNumber,
      phone: req.body.phone,
      address: req.body.address,
      website: req.body.website || '',
      documents: documents,
      status: 'pending'
    });

    await application.save();

    // Update user role to business_pending
    await User.findByIdAndUpdate(req.user._id, {
      role: 'business_pending'
    });

    res.status(201).json({
      success: true,
      message: 'Business application submitted successfully',
      application: {
        id: application._id,
        businessName: application.businessName,
        status: application.status,
        createdAt: application.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting business application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /business/apply/status
 * @desc    Get current user's business application status
 * @access  Private
 */
router.get('/apply/status', auth, async (req, res) => {
  try {
    const application = await BusinessApplication.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('status businessName createdAt rejectionReason');

    if (!application) {
      return res.json({
        success: true,
        hasApplication: false
      });
    }

    res.json({
      success: true,
      hasApplication: true,
      application: {
        id: application._id,
        status: application.status,
        businessName: application.businessName,
        createdAt: application.createdAt,
        rejectionReason: application.rejectionReason
      }
    });
  } catch (error) {
    console.error('Error fetching application status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /admin/business/applications
 * @desc    Get all business applications (Admin only)
 * @access  Private (Admin)
 */
router.get('/admin/business/applications', [auth, admin], async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const applications = await BusinessApplication.find(query)
      .populate('userId', 'name email username')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await BusinessApplication.countDocuments(query);

    res.json({
      success: true,
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching business applications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /admin/business/applications/:id
 * @desc    Get business application details (Admin only)
 * @access  Private (Admin)
 */
router.get('/admin/business/applications/:id', [auth, admin], async (req, res) => {
  try {
    const application = await BusinessApplication.findById(req.params.id)
      .populate('userId', 'name email username profileImage createdAt')
      .populate('reviewedBy', 'name email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Format document URLs
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    
    const documents = application.documents.map(doc => 
      doc.startsWith('http') ? doc : `${host}${doc}`
    );

    res.json({
      success: true,
      application: {
        ...application.toObject(),
        documents
      }
    });
  } catch (error) {
    console.error('Error fetching application details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /admin/business/approve/:id
 * @desc    Approve business application (Admin only)
 * @access  Private (Admin)
 */
router.post('/admin/business/approve/:id', [auth, admin], async (req, res) => {
  try {
    const application = await BusinessApplication.findById(req.params.id)
      .populate('userId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    // Update application status
    application.status = 'approved';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Update user role to business_owner
    await User.findByIdAndUpdate(application.userId._id, {
      role: 'business_owner',
      accountType: 'business'
    });

    res.json({
      success: true,
      message: 'Business application approved successfully',
      application: {
        id: application._id,
        status: application.status,
        reviewedAt: application.reviewedAt
      }
    });
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /admin/business/reject/:id
 * @desc    Reject business application (Admin only)
 * @access  Private (Admin)
 */
router.post('/admin/business/reject/:id', [
  auth,
  admin,
  body('rejectionReason').optional().trim().isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const application = await BusinessApplication.findById(req.params.id)
      .populate('userId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Application is already ${application.status}`
      });
    }

    // Update application status
    application.status = 'rejected';
    application.rejectionReason = req.body.rejectionReason || '';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Update user role back to user
    await User.findByIdAndUpdate(application.userId._id, {
      role: 'user'
    });

    res.json({
      success: true,
      message: 'Business application rejected',
      application: {
        id: application._id,
        status: application.status,
        rejectionReason: application.rejectionReason,
        reviewedAt: application.reviewedAt
      }
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

