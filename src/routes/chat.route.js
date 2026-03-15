const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chat.controller');
const messageController = require('../controllers/message.controller');
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { ROLES } = require('../utils');

// ============================
// Chat Room Routes
// ============================

// Create Support Chat (User/Provider with Admin)
router.post(
    '/support',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.PROVIDER]),
    chatController.createSupportChat
);

// Create Appointment Chat (User with Provider)
router.post(
    '/appointment',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.PROVIDER]),
    chatController.createAppointmentChat
);

// Get User's Chat List
router.get(
    '/user-chats',
    AuthVerifier,
    chatController.getUserChats
);

// Search Chats
router.get(
    '/search/query',
    AuthVerifier,
    chatController.searchChats
);

// Get Specific Chat Room - MOVE THIS DOWN
router.get(
    '/:chatId',
    AuthVerifier,
    chatController.getChatRoom
);

// ============================
// Message Routes
// ============================

// Send Message (with optional file attachments)
router.post(
    '/messages/send',
    AuthVerifier,
    upload('chat').any(),
    messageController.sendMessage
);

// ✅ MARK ALL MESSAGES AS READ - PUT THIS FIRST!
router.put(
    '/messages/chat/:chatId/read-all',
    AuthVerifier,
    messageController.markChatAsRead
);

// Get Messages in Chat - MOVE THIS AFTER SPECIFIC ROUTES
router.get(
    '/messages/:chatId',
    AuthVerifier,
    messageController.getMessages
);

// Mark Single Message as Read
router.put(
    '/messages/:messageId/read',
    AuthVerifier,
    messageController.markAsRead
);

// Delete Message
router.delete(
    '/messages/:messageId',
    AuthVerifier,
    messageController.deleteMessage
);

module.exports = router;