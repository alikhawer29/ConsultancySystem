const ChatRoom = require('../../models/chatRoom.model');
const ChatMessage = require('../../models/chatMessage.model');
const Booking = require('../../models/booking.model');
const User = require('../../models/user.model');
const { ROLES, paginationHandler, getSearchQuery } = require('../../utils');
const ResponseHandler = require('../../utils/response');


// ============================
// Get Chat Room by ID
// ============================
const getChatRoom = async (req, res) => {
    try {
        const { decoded } = req;
        const { chatId } = req.params;

        const chatRoom = await ChatRoom.findById(chatId)
            .populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
                { path: 'booking_id', select: 'booking_id status booking_status session_date session_time' },
                { path: 'last_message' },
            ])
            .lean({ virtuals: true });

        if (!chatRoom) {
            throw new Error('Chat room not found');
        }

        // Verify user is participant
        const userId = decoded.id;
        if (!chatRoom.participants.some(p => p.toString() === userId)) {
            throw new Error('Unauthorized: You are not part of this chat');
        }

        return res.status(200).send({
            success: true,
            data: chatRoom,
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
// Get Support Chat List
// ============================
const getSupportChats = async (req, res) => {
    try {
        const { decoded } = req;
        const { page, per_page, chat_type } = req.query;
        const userId = decoded.id;

        let options = paginationHandler(page, per_page);
        let filter = {
            participants: userId,
            is_active: true,
        };

        filter.chat_type = 'support';

        const chatRooms = await ChatRoom.find(filter, {}, options)
            .populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
                { path: 'booking_id', select: 'booking_id status booking_status session_date session_time' },
                { path: 'last_message_sender', select: 'first_name last_name' },
            ])
            .lean({ virtuals: true });

        // Add unread count for current user and determine other user
        const chatsWithUnread = chatRooms.map(chat => {
            // When using lean(), Map is converted to plain object
            const unreadCount = chat.unread_count instanceof Map
                ? chat.unread_count.get(userId)
                : (chat.unread_count?.[userId] || 0);

            // Determine if chat is active
            const isChatActive =
                chat.chat_type === 'appointment' &&
                    chat.booking_id?.status === 'completed'
                    ? false
                    : true;

            return {
                ...chat,
                is_chat_active: isChatActive,
                my_unread_count: unreadCount,
                other_user: chat.user_id._id.toString() === userId ? chat.other_user_id : chat.user_id,
            };
        });

        // Sort: Support chat first, then by last message time
        chatsWithUnread.sort((a, b) => {
            // Support chats always first
            if (a.chat_type === 'support' && b.chat_type !== 'support') return -1;
            if (a.chat_type !== 'support' && b.chat_type === 'support') return 1;

            // Then sort by last message time (most recent first)
            const timeA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
            const timeB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
            return timeB - timeA;
        });

        const total = await ChatRoom.countDocuments(filter);

        return ResponseHandler.success(res, "Chats retrieved successfully", chatsWithUnread);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};

const getOverviewChats = async (req, res) => {
    try {
        const { decoded } = req;
        const { page, per_page } = req.query;

        let options = paginationHandler(page, per_page);

        // Admin views all appointment chats (between users and providers)
        const chatRooms = await ChatRoom.find({
            is_active: true,
            chat_type: 'appointment'  // Only appointment chats
        }, {}, options)
            .populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
                { path: 'booking_id', select: 'booking_id status booking_status session_date session_time' },
                { path: 'last_message_sender', select: 'first_name last_name' },
            ])
            .sort({ last_message_time: -1 })  // Sort by most recent message
            .lean({ virtuals: true });

        const total = await ChatRoom.countDocuments({
            is_active: true,
            chat_type: 'appointment'  // Only appointment chats
        });

        return ResponseHandler.success(res, "Appointment chats retrieved successfully", chatRooms);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message);
    }
};


module.exports = {
    getChatRoom,
    getSupportChats,
    getOverviewChats,
};

