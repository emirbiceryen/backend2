const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Post = require('../models/Post');
const BusinessApplication = require('../models/BusinessApplication');

/**
 * @route   GET /admin/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    
    // Filter by role if provided
    if (role && ['user', 'business_pending', 'business_owner', 'admin'].includes(role)) {
      query.role = role;
    }

    // Search by name, email, or username
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /admin/users/:id
 * @desc    Get user details (Admin only)
 * @access  Private (Admin)
 */
router.get('/users/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('hobbies', 'name description');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   DELETE /admin/users/:id
 * @desc    Delete user (Admin only)
 * @access  Private (Admin)
 */
router.delete('/users/:id', [auth, admin], async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /admin/users/ban/:id
 * @desc    Ban user (Admin only)
 * @access  Private (Admin)
 */
router.post('/users/ban/:id', [auth, admin], async (req, res) => {
  try {
    const userId = req.params.id;
    const { days, reason } = req.body || {};

    // Prevent admin from banning themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot ban your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent banning other admins
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot ban admin users'
      });
    }

    const bannedUntil = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000) : null;
    user.status = 'banned';
    user.bannedUntil = bannedUntil;
    user.banReason = reason || null;
    user.timeoutUntil = null;
    user.timeoutReason = null;
    
    // Fix location if it's an object (convert to string)
    if (user.location && typeof user.location === 'object') {
      const loc = user.location;
      const locationString = loc.city ? `${loc.city}${loc.state ? ', ' + loc.state : ''}${loc.country ? ', ' + loc.country : ''}`.trim() : JSON.stringify(loc);
      user.set('location', locationString);
      user.markModified('location');
    }
    
    await user.save();

    res.json({
      success: true,
      message: 'User banned successfully',
      user: {
        id: user._id,
        status: user.status,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason
      }
    });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /admin/users/unban/:id
 * @desc    Unban user (Admin only)
 * @access  Private (Admin)
 */
router.post('/users/unban/:id', [auth, admin], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.status = 'active';
    user.bannedUntil = null;
    user.banReason = null;
    user.timeoutUntil = null;
    user.timeoutReason = null;
    await user.save();

    res.json({
      success: true,
      message: 'User unbanned successfully'
    });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /admin/users/timeout/:id
 * @desc    Timeout user for X minutes (Admin only)
 * @access  Private (Admin)
 */
router.post('/users/timeout/:id', [auth, admin], async (req, res) => {
  try {
    const { minutes = 60, reason } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot timeout admin users' });
    }

    const timeoutUntil = new Date(Date.now() + Number(minutes) * 60 * 1000);
    user.timeoutUntil = timeoutUntil;
    user.timeoutReason = reason || null;
    user.status = 'active';
    user.bannedUntil = null;
    user.banReason = null;
    
    // Fix location if it's an object (convert to string)
    if (user.location && typeof user.location === 'object') {
      const loc = user.location;
      user.location = loc.city ? `${loc.city}${loc.state ? ', ' + loc.state : ''}${loc.country ? ', ' + loc.country : ''}`.trim() : JSON.stringify(loc);
    }
    
    await user.save();

    res.json({
      success: true,
      message: `User timed out for ${minutes} minutes`,
      timeoutUntil
    });
  } catch (error) {
    console.error('Error timing out user:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /admin/users/premium/:id
 * @desc    Grant premium to user for N days (default 30)
 * @access  Private (Admin)
 */
router.post('/users/premium/:id', [auth, admin], async (req, res) => {
  try {
    const { days = 30 } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const expiresAt = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    user.subscriptionType = 'premium';
    user.premiumExpiresAt = expiresAt;
    
    // Fix location if it's an object (convert to string)
    if (user.location && typeof user.location === 'object') {
      const loc = user.location;
      const locationString = loc.city ? `${loc.city}${loc.state ? ', ' + loc.state : ''}${loc.country ? ', ' + loc.country : ''}`.trim() : JSON.stringify(loc);
      user.set('location', locationString);
      user.markModified('location');
    }
    
    await user.save();

    res.json({
      success: true,
      message: `Premium granted for ${days} days`,
      premiumExpiresAt: expiresAt
    });
  } catch (error) {
    console.error('Error granting premium:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /admin/posts
 * @desc    List posts for moderation (Admin only)
 * @access  Private (Admin)
 */
router.get('/posts', [auth, admin], async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('authorId', 'name email username role');

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error listing posts:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /admin/posts/:id
 * @desc    Remove a post (soft delete) (Admin only)
 * @access  Private (Admin)
 */
router.delete('/posts/:id', [auth, admin], async (req, res) => {
  try {
    const { reason } = req.body || {};
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.isRemoved = true;
    post.removedAt = new Date();
    post.removedBy = req.user._id;
    post.removeReason = reason || null;
    await post.save();

    res.json({ success: true, message: 'Post removed successfully' });
  } catch (error) {
    console.error('Error removing post:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /admin/business/applications
 * @desc    Get all business applications (Admin only)
 * @access  Private (Admin)
 */
router.get('/business/applications', [auth, admin], async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }

    const applications = await BusinessApplication.find(query)
      .populate('userId', 'name email username profileImage')
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
router.get('/business/applications/:id', [auth, admin], async (req, res) => {
  try {
    const application = await BusinessApplication.findById(req.params.id)
      .populate('userId', 'name email username profileImage accountType businessName businessType')
      .populate('reviewedBy', 'name email');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Business application not found'
      });
    }

    res.json({
      success: true,
      application
    });
  } catch (error) {
    console.error('Error fetching business application:', error);
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
router.post('/business/approve/:id', [auth, admin], async (req, res) => {
  try {
    const application = await BusinessApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Business application not found'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Application is not pending'
      });
    }

    application.status = 'approved';
    application.reviewedAt = new Date();
    application.reviewedBy = req.user._id;
    await application.save();

    const user = await User.findById(application.userId);
    if (user) {
      user.role = 'business_owner';
      user.accountType = 'business';
      if (application.businessName) {
        user.businessName = application.businessName;
      }
      await user.save();
    }

    res.json({
      success: true,
      message: 'Business application approved',
      application
    });
  } catch (error) {
    console.error('Error approving business application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /admin/business/reject/:id
 * @desc    Reject business application (Admin only)
 * @access  Private (Admin)
 */
router.post('/business/reject/:id', [auth, admin], async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const application = await BusinessApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Business application not found'
      });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Application is not pending'
      });
    }

    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = req.user._id;
    if (rejectionReason) {
      application.rejectionReason = rejectionReason;
    }
    await application.save();

    const user = await User.findById(application.userId);
    if (user) {
      user.role = 'user';
      await user.save();
    }

    res.json({
      success: true,
      message: 'Business application rejected',
      application
    });
  } catch (error) {
    console.error('Error rejecting business application:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /admin/stats
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin)
 */
router.get('/stats', [auth, admin], async (req, res) => {
  try {
    const [
      totalUsers,
      totalBusinessOwners,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      bannedUsers
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'business_owner' }),
      BusinessApplication.countDocuments({ status: 'pending' }),
      BusinessApplication.countDocuments({ status: 'approved' }),
      BusinessApplication.countDocuments({ status: 'rejected' }),
      User.countDocuments({ isBanned: true })
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalBusinessOwners,
        pendingApplications,
        approvedApplications,
        rejectedApplications,
        bannedUsers
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

