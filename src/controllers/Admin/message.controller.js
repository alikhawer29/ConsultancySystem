const ChatRoom = require('../../models/chatRoom.model');
const ChatMessage = require('../../models/chatMessage.model');
const Booking = require('../../models/booking.model');
const { paginationHandler, normalize } = require('../../utils');
const { getIO } = require('../../helpers/socket');
const path = require('path');
const ResponseHandler = require('../../utils/response');

// ============================
// Send Message (WhatsApp-like: text + files)
// ============================
const sendMessage = async (req, res) => {
    try {
        const { decoded, files } = req;
        const { chat_room_id, message_text } = req.body;
        const userId = decoded.id;

        if (!chat_room_id) {
            throw new Error('Chat room ID is required');
        }

        // Must have either text or files
        if (!message_text && (!files || files.length === 0)) {
            throw new Error('Message text or files are required');
        }

        // Verify chat room exists and user is participant
        const chatRoom = await ChatRoom.findById(chat_room_id);
        if (!chatRoom) {
            throw new Error('Chat room not found');
        }

        if (!chatRoom.participants.some(p => p.toString() === userId)) {
            throw new Error('Unauthorized: You are not part of this chat');
        }

        // For appointment chats, verify booking is still in progress
        if (chatRoom.chat_type === 'appointment') {
            const booking = await Booking.findById(chatRoom.booking_id);
            if (!booking || booking.booking_status !== 'in_progress') {
                throw new Error('Appointment chat is only available when booking is in progress');
            }
        }

        // Determine receiver
        const receiverId = chatRoom.participants.find(p => p.toString() !== userId).toString();

        // Process attachments
        const attachments = [];
        if (files && files.length > 0) {
            for (const file of files) {
                const filePath = normalize(file.path);
                const mimeType = file.mimetype;
                const fileType = mimeType.startsWith('image/') ? 'image' : 'file';

                attachments.push({
                    file_url: filePath,
                    file_name: file.originalname,
                    file_size: file.size,
                    file_type: fileType,
                    mime_type: mimeType,
                });
            }
        }

        // Create message
        const message = new ChatMessage({
            chat_room_id,
            sender_id: userId,
            receiver_id: receiverId,
            message_text: message_text || null,
            attachments,
            status: 'sent',
        });

        await message.save();

        // Update chat room last message
        chatRoom.last_message = message._id;

        // Set last message text
        if (message_text) {
            chatRoom.last_message_text = message_text;
        } else if (attachments.length > 0) {
            const fileType = attachments[0].file_type;
            chatRoom.last_message_text = fileType === 'image' ? '📷 Photo' : '📎 File';
        }

        chatRoom.last_message_time = new Date();
        chatRoom.last_message_sender = userId;

        // Increment unread count for receiver
        if (!chatRoom.unread_count) {
            chatRoom.unread_count = new Map();
        }
        const currentUnread = chatRoom.unread_count.get(receiverId) || 0;
        chatRoom.unread_count.set(receiverId, currentUnread + 1);

        await chatRoom.save();

        // Populate message
        await message.populate([
            { path: 'sender_id', select: 'first_name last_name picture role' },
            { path: 'receiver_id', select: 'first_name last_name picture role' },
        ]);

        // Emit via Socket.IO
        const io = getIO();
        io.to(chat_room_id).emit('receive_message', message);
        io.to(receiverId).emit('new_message_notification', {
            chat_room_id,
            message,
            unread_count: chatRoom.unread_count.get(receiverId),
        });

        return ResponseHandler.success(res, "Message sent successfully", message);


    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};


// ============================
// Get Messages
// ============================
const getMessages = async (req, res) => {
    try {
        const { decoded } = req;
        const { chatId } = req.params;
        const { page, per_page } = req.query;

        // Verify chat room exists and user is participant
        const chatRoom = await ChatRoom.findById(chatId);
        if (!chatRoom) {
            throw new Error('Chat room not found');
        }

        const userId = decoded.id;
        if (!chatRoom.participants.some(p => p.toString() === userId)) {
            throw new Error('Unauthorized: You are not part of this chat');
        }

        let options = paginationHandler(page, per_page);

        const messages = await ChatMessage.find({
            chat_room_id: chatId,
            deleted_for: { $ne: userId },
        }, {}, options)
            .populate([
                { path: 'sender_id', select: 'first_name last_name picture role' },
                { path: 'receiver_id', select: 'first_name last_name picture role' },
            ])
            .sort({ createdAt: 1 })
            .lean({ virtuals: true });

        const total = await ChatMessage.countDocuments({
            chat_room_id: chatId,
            deleted_for: { $ne: userId },
        });

        return ResponseHandler.success(res, "Messages retrieved successfully", messages, ResponseHandler.HTTP_OK, { total });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};


// ============================
// Mark Messages as Read
// ============================
const markAsRead = async (req, res) => {
    try {
        const { decoded } = req;
        const { messageId } = req.params;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            throw new Error('Message not found');
        }

        const userId = decoded.id;

        // Only receiver can mark as read
        if (message.receiver_id.toString() !== userId) {
            throw new Error('Unauthorized: Only receiver can mark message as read');
        }

        if (!message.is_read) {
            message.is_read = true;
            message.read_at = new Date();
            message.status = 'read';
            await message.save();

            // Update unread count in chat room
            const chatRoom = await ChatRoom.findById(message.chat_room_id);
            if (chatRoom) {
                if (!chatRoom.unread_count) {
                    chatRoom.unread_count = new Map();
                }
                const currentCount = chatRoom.unread_count.get(userId) || 0;
                chatRoom.unread_count.set(userId, Math.max(0, currentCount - 1));
                await chatRoom.save();
            }

            // Emit read receipt via Socket.IO
            const io = getIO();
            io.to(message.sender_id.toString()).emit('message_read', {
                message_id: messageId,
                read_at: message.read_at,
                chat_room_id: message.chat_room_id,
            });
        }

        return res.status(200).send({
            success: true,
            message: 'Message marked as read',
            data: message,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Mark All Messages as Read in Chat
// ============================
const markChatAsRead = async (req, res) => {
    try {
        const { decoded } = req;
        const { chatId } = req.params;

        const userId = decoded.id;

        // Verify chat room
        const chatRoom = await ChatRoom.findById(chatId);
        if (!chatRoom) {
            throw new Error('Chat room not found');
        }

        if (!chatRoom.participants.some(p => p.toString() === userId)) {
            throw new Error('Unauthorized: You are not part of this chat');
        }

        // Mark all unread messages as read
        const result = await ChatMessage.updateMany(
            {
                chat_room_id: chatId,
                receiver_id: userId,
                is_read: false,
            },
            {
                $set: {
                    is_read: true,
                    read_at: new Date(),
                    status: 'read',
                },
            }
        );

        // Reset unread count
        if (!chatRoom.unread_count) {
            chatRoom.unread_count = new Map();
        }
        chatRoom.unread_count.set(userId, 0);
        await chatRoom.save();

        // Emit read receipt
        const io = getIO();
        const otherUserId = chatRoom.participants.find(p => p.toString() !== userId).toString();
        io.to(otherUserId).emit('chat_read', {
            chat_room_id: chatId,
            read_by: userId,
            read_at: new Date(),
        });

        return ResponseHandler.success(res, `${result.modifiedCount} messages marked as read`, result);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};


// ============================
// Delete Message
// ============================
const deleteMessage = async (req, res) => {
    try {
        const { decoded } = req;
        const { messageId } = req.params;
        const { delete_for_everyone } = req.body;

        const message = await ChatMessage.findById(messageId);
        if (!message) {
            throw new Error('Message not found');
        }

        const userId = decoded.id;

        // Only sender can delete
        if (message.sender_id.toString() !== userId) {
            throw new Error('Unauthorized: Only sender can delete message');
        }

        if (delete_for_everyone) {
            // Hard delete for everyone
            message.deleted = true;
            message.deletedAt = new Date();
            await message.save();

            // Emit deletion event
            const io = getIO();
            io.to(message.chat_room_id.toString()).emit('message_deleted', {
                message_id: messageId,
                chat_room_id: message.chat_room_id,
            });
        } else {
            // Delete for sender only
            if (!message.deleted_for) {
                message.deleted_for = [];
            }
            if (!message.deleted_for.includes(userId)) {
                message.deleted_for.push(userId);
                await message.save();
            }
        }

        return res.status(200).send({
            success: true,
            message: 'Message deleted successfully',
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get Overview Messages (Admin Only)
// ============================
const getOverviewMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page, per_page } = req.query;

        // Verify chat room exists
        const chatRoom = await ChatRoom.findById(chatId);
        if (!chatRoom) {
            throw new Error('Chat room not found');
        }

        // Admin can view all appointment chats
        if (chatRoom.chat_type !== 'appointment') {
            throw new Error('This endpoint is only for appointment chats');
        }

        let options = paginationHandler(page, per_page);

        const messages = await ChatMessage.find({
            chat_room_id: chatId,
            deleted: false  // Don't show deleted messages
        }, {}, options)
            .populate([
                { path: 'sender_id', select: 'first_name last_name picture role' },
                { path: 'receiver_id', select: 'first_name last_name picture role' },
            ])
            .sort({ createdAt: 1 })
            .lean({ virtuals: true });

        const total = await ChatMessage.countDocuments({
            chat_room_id: chatId,
            deleted: false
        });

        return ResponseHandler.success(res, "Messages retrieved successfully", messages);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};


module.exports = {
    sendMessage,
    getMessages,
    markAsRead,
    markChatAsRead,
    deleteMessage,
    getOverviewMessages,
};
