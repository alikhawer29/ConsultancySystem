const ChatRoom = require('../models/chatRoom.model');
const ChatMessage = require('../models/chatMessage.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const { ROLES, paginationHandler, getSearchQuery } = require('../utils');

// ============================
// Create Support Chat
// ============================
const createSupportChat = async (req, res) => {
    try {
        const { decoded } = req;
        const userId = decoded.id;

        // Find an admin user
        const admin = await User.findOne({ role: ROLES.ADMIN, active: true });
        if (!admin) {
            throw new Error('No admin available for support chat');
        }

        // Check if support chat already exists
        let chatRoom = await ChatRoom.findOne({
            chat_type: 'support',
            user_id: userId,
            other_user_id: admin._id,
        });

        if (chatRoom) {
            // Reactivate if inactive
            if (!chatRoom.is_active) {
                chatRoom.is_active = true;
                await chatRoom.save();
            }

            await chatRoom.populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
            ]);

            return res.status(200).send({
                success: true,
                message: 'Support chat retrieved',
                data: chatRoom,
            });
        }

        // Create new support chat
        const unreadCountMap = new Map();
        unreadCountMap.set(userId, 0);
        unreadCountMap.set(admin._id.toString(), 0);

        chatRoom = new ChatRoom({
            chat_type: 'support',
            user_id: userId,
            other_user_id: admin._id,
            participants: [userId, admin._id],
            is_active: true,
            unread_count: unreadCountMap,
        });

        await chatRoom.save();

        await chatRoom.populate([
            { path: 'user_id', select: 'first_name last_name email picture role' },
            { path: 'other_user_id', select: 'first_name last_name email picture role' },
        ]);

        return res.status(201).send({
            success: true,
            message: 'Support chat created successfully',
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
// Create Appointment Chat
// ============================
const createAppointmentChat = async (req, res) => {
    try {
        const { decoded } = req;
        const { booking_id } = req.body;

        if (!booking_id) {
            throw new Error('Booking ID is required');
        }

        // Verify booking exists and user has access
        const booking = await Booking.findById(booking_id)
            .populate('user_id', 'first_name last_name email picture')
            .populate('provider_id', 'first_name last_name email picture');

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Verify user is part of this booking
        const userId = decoded.id;
        if (
            booking.user_id._id.toString() !== userId &&
            booking.provider_id?._id.toString() !== userId
        ) {
            throw new Error('Unauthorized: You are not part of this booking');
        }

        // Check if booking status allows chat
        if (booking.booking_status !== 'in_progress') {
            throw new Error('Chat is only available when appointment is in progress');
        }

        // Check if chat already exists
        let chatRoom = await ChatRoom.findOne({
            chat_type: 'appointment',
            booking_id: booking_id,
        });

        if (chatRoom) {
            await chatRoom.populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
                { path: 'booking_id', select: 'booking_id status booking_status session_date session_time' },
            ]);

            return res.status(200).send({
                success: true,
                message: 'Appointment chat retrieved',
                data: chatRoom,
            });
        }

        // Create new appointment chat
        const user1 = booking.user_id._id;
        const user2 = booking.provider_id._id;

        const unreadCountMap = new Map();
        unreadCountMap.set(user1.toString(), 0);
        unreadCountMap.set(user2.toString(), 0);

        chatRoom = new ChatRoom({
            chat_type: 'appointment',
            user_id: user1,
            other_user_id: user2,
            participants: [user1, user2],
            booking_id: booking_id,
            is_active: true,
            auto_close_on_completion: true,
            unread_count: unreadCountMap,
        });

        await chatRoom.save();

        await chatRoom.populate([
            { path: 'user_id', select: 'first_name last_name email picture role' },
            { path: 'other_user_id', select: 'first_name last_name email picture role' },
            { path: 'booking_id', select: 'booking_id status booking_status session_date session_time' },
        ]);

        return res.status(201).send({
            success: true,
            message: 'Appointment chat created successfully',
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
// Get User's Chat List
// ============================
const getUserChats = async (req, res) => {
    try {
        const { decoded } = req;
        const { page, per_page, chat_type } = req.query;
        const userId = decoded.id;

        let options = paginationHandler(page, per_page);
        let filter = {
            participants: userId,
            is_active: true,
        };

        if (chat_type) {
            filter.chat_type = chat_type;
        }

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

        return res.status(200).send({
            success: true,
            total,
            data: chatsWithUnread,
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
// Search Chats
// ============================
const searchChats = async (req, res) => {
    try {
        const { decoded } = req;
        const { query, page, per_page } = req.query;
        const userId = decoded.id;

        if (!query) {
            throw new Error('Search query is required');
        }

        let options = paginationHandler(page, per_page);

        // Search in messages or user names
        const chatRooms = await ChatRoom.find({
            participants: userId,
            is_active: true,
        })
            .populate([
                { path: 'user_id', select: 'first_name last_name email picture role' },
                { path: 'other_user_id', select: 'first_name last_name email picture role' },
            ])
            .lean({ virtuals: true });

        // Filter by provider name or last message
        const filtered = chatRooms.filter(chat => {
            const otherUser = chat.user_id._id.toString() === userId ? chat.other_user_id : chat.user_id;
            const fullName = `${otherUser.first_name} ${otherUser.last_name}`.toLowerCase();
            const searchQuery = query.toLowerCase();

            return (
                fullName.includes(searchQuery) ||
                (chat.last_message_text && chat.last_message_text.toLowerCase().includes(searchQuery))
            );
        });

        return res.status(200).send({
            success: true,
            total: filtered.length,
            data: filtered,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


module.exports = {
    createSupportChat,
    createAppointmentChat,
    getChatRoom,
    getUserChats,
    searchChats,
};

