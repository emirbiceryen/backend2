const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config({ path: './config.env' });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const hobbyRoutes = require('./routes/hobbies');
const matchingRoutes = require('./routes/matching');
const forumRoutes = require('./routes/forum');
const chatRoutes = require('./routes/chat');
const profileRoutes = require('./routes/profile');
const ratingRoutes = require('./routes/ratings');
const subscriptionRoutes = require('./routes/subscription');
const teamRoutes = require('./routes/teams');

// WebSocket connection management
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their user ID
  socket.on('join', (userId) => {
    connectedUsers.set(userId, socket.id);
    socket.userId = userId;
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  // Handle matching requests
  socket.on('send_match_request', (data) => {
    const { targetUserId, requesterId, requesterName, requesterImage } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('new_match_request', {
        requesterId,
        requesterName,
        requesterImage,
        timestamp: new Date()
      });
      console.log(`Match request sent from ${requesterId} to ${targetUserId}`);
    }
  });

  // Handle match acceptance
  socket.on('accept_match', (data) => {
    const { targetUserId, accepterId, accepterName } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('match_accepted', {
        accepterId,
        accepterName,
        timestamp: new Date()
      });
      console.log(`Match accepted by ${accepterId} for ${targetUserId}`);
    }
  });

  // Handle match rejection
  socket.on('reject_match', (data) => {
    const { targetUserId, rejecterId } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('match_rejected', {
        rejecterId,
        timestamp: new Date()
      });
      console.log(`Match rejected by ${rejecterId} for ${targetUserId}`);
    }
  });

  // Handle new message
  socket.on('send_message', (data) => {
    const { targetUserId, message, senderId, senderName, senderImage } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('new_message', {
        message,
        senderId,
        senderName,
        senderImage,
        timestamp: new Date()
      });
      console.log(`Message sent from ${senderId} to ${targetUserId}`);
    }
  });

  // Handle typing indicator
  socket.on('typing_start', (data) => {
    const { targetUserId, senderId } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('user_typing', {
        senderId,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const { targetUserId, senderId } = data;
    const targetSocketId = connectedUsers.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('user_typing', {
        senderId,
        isTyping: false
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hobbies', hobbyRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/teams', teamRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hubi Backend is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is ready for connections`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
}); 