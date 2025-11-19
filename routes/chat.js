const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// Get all chats for the current user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id
    })
    .populate('participants', 'name profileImage')
    .populate('messages.sender', 'name profileImage')
    .sort({ lastMessage: -1 });

    // Format chats to include unread count and last message
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
      
      // Format profile image URL
      const formattedProfileImage = otherParticipant?.profileImage 
        ? otherParticipant.profileImage
        : null;
      
      const unreadCount = chat.messages.filter(msg => 
        msg.sender.toString() !== req.user._id.toString() && !msg.isRead
      ).length;
      const lastMessage = chat.messages[chat.messages.length - 1];

      return {
        _id: chat._id,
        otherParticipant: {
          ...otherParticipant.toObject(),
          profileImage: formattedProfileImage
        },
        unreadCount,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          sender: lastMessage.sender
        } : null,
        lastMessageTime: chat.lastMessage
      };
    });

    res.json({ success: true, chats: formattedChats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get chat with a specific user
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find or create chat
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, userId] }
    })
    .populate('participants', 'name profileImage')
    .populate('messages.sender', 'name profileImage');

    if (!chat) {
      // Create new chat
      chat = new Chat({
        participants: [req.user._id, userId],
        messages: []
      });
      await chat.save();
      
      // Populate the new chat
      chat = await Chat.findById(chat._id)
        .populate('participants', 'name profileImage')
        .populate('messages.sender', 'name profileImage');
    }

    // Mark messages as read for the current user
    await Chat.updateOne(
      { _id: chat._id },
      { 
        $set: { 
          'messages.$[elem].isRead': true 
        }
      },
      {
        arrayFilters: [
          { 'elem.sender': { $ne: req.user._id } }
        ]
      }
    );

    // Format profile image URLs for participants
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedParticipants = chat.participants.map(participant => {
      const formattedProfileImage = participant.profileImage 
        ? participant.profileImage
        : null;
      
      return {
        ...participant.toObject(),
        profileImage: formattedProfileImage
      };
    });

    const formattedChat = {
      ...chat.toObject(),
      participants: formattedParticipants
    };

    res.json({ success: true, chat: formattedChat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send a message
router.post('/:userId/message', [
  auth,
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    const { content } = req.body;

    // Check if user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find or create chat
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, userId] }
    });

    if (!chat) {
      chat = new Chat({
        participants: [req.user._id, userId],
        messages: []
      });
    }

    // Add message
    chat.messages.push({
      sender: req.user._id,
      content,
      timestamp: new Date()
    });

    chat.lastMessage = new Date();
    await chat.save();

    // Populate the updated chat
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name profileImage')
      .populate('messages.sender', 'name profileImage');

    // Format profile image URLs for participants
    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const formattedParticipants = populatedChat.participants.map(participant => {
      const formattedProfileImage = participant.profileImage 
        ? participant.profileImage
        : null;
      
      return {
        ...participant.toObject(),
        profileImage: formattedProfileImage
      };
    });

    const formattedChat = {
      ...populatedChat.toObject(),
      participants: formattedParticipants
    };

    res.json({ success: true, chat: formattedChat });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get potential chat users (matched users)
router.get('/potential/users', auth, async (req, res) => {
  try {
    // Get users that the current user has matched with
    const Match = require('../models/Match');
    const matches = await Match.find({
      $or: [
        { user1: req.user._id, status: 'mutual' },
        { user2: req.user._id, status: 'mutual' }
      ]
    }).populate('user1 user2', 'name profileImage');

    const host = process.env.NODE_ENV === 'production' 
      ? 'https://backend-production-7063.up.railway.app'
      : `${req.protocol}://${req.get('host')}`;
    const potentialUsers = matches.map(match => {
      const otherUser = match.user1._id.toString() === req.user._id.toString() ? match.user2 : match.user1;
      
      // Format profile image URL
      const formattedProfileImage = otherUser.profileImage 
        ? otherUser.profileImage
        : null;
      
      return {
        _id: otherUser._id,
        name: otherUser.name,
        profileImage: formattedProfileImage
      };
    });

    res.json({ success: true, users: potentialUsers });
  } catch (error) {
    console.error('Error fetching potential chat users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router; 