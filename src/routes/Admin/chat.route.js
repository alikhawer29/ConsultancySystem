const express = require('express');
const router = express.Router();

const chatController = require('../../controllers/Admin/chat.controller');
const messageController = require('../../controllers/Admin/message.controller');
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const { ROLES } = require('../../utils');

// Get Support Chat List
router.get(
    '/',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    chatController.getSupportChats
);

// Get Overview Chat List - MUST be before /:chatId
router.get(
    '/overview',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    chatController.getOverviewChats
);

// Get Messages in Chat
router.get(
    '/:chatId',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.getMessages
);


// Send Message (with optional file attachments)
router.post(
    '/send',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    upload('chat').any(),
    messageController.sendMessage
);

// ✅ MARK ALL MESSAGES AS READ - PUT THIS FIRST!
router.put(
    '/:chatId/read-all',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.markChatAsRead
);



// Mark Single Message as Read
router.put(
    '/messages/:messageId/read',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.markAsRead
);

// Delete Message
router.delete(
    '/messages/:messageId',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.deleteMessage
);


// Get Overview Messages in Chat
router.get(
    '/overview/:chatId',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.getOverviewMessages
);

module.exports = router;