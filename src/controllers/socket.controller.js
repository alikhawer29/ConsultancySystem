const ChatRoom = require('../models/chatRoom.model');
const ChatMessage = require('../models/chatMessage.model');
const UserOnlineStatus = require('../models/userOnlineStatus.model');
const Booking = require('../models/booking.model');

const socketController = (socket, io) => {
    const userId = socket.user_id;

    console.log(`User ${userId} connected with socket ${socket.id}`);

    // ============================
    // Update User Online Status
    // ============================
    const updateOnlineStatus = async (isOnline) => {
        try {
            if (isOnline) {
                await UserOnlineStatus.findOneAndUpdate(
                    { user_id: userId },
                    {
                        is_online: true,
                        socket_id: socket.id,
                        last_seen: new Date(),
                        $push: {
                            active_sockets: {
                                socket_id: socket.id,
                                connected_at: new Date(),
                            },
                        },
                    },
                    { upsert: true, new: true }
                );

                // Broadcast online status to all chat participants
                io.emit('user_online_status', {
                    user_id: userId,
                    is_online: true,
                    last_seen: new Date(),
                });
            } else {
                const status = await UserOnlineStatus.findOne({ user_id: userId });
                if (status) {
                    // Remove this socket from active sockets
                    status.active_sockets = status.active_sockets.filter(
                        s => s.socket_id !== socket.id
                    );

                    // If no more active sockets, mark as offline
                    if (status.active_sockets.length === 0) {
                        status.is_online = false;
                        status.last_seen = new Date();
                    }

                    await status.save();

                    // Broadcast offline status
                    io.emit('user_online_status', {
                        user_id: userId,
                        is_online: status.is_online,
                        last_seen: status.last_seen,
                    });
                }
            }
        } catch (e) {
            console.error('Error updating online status:', e);
        }
    };

    // Set user online on connection
    updateOnlineStatus(true);

    // ============================
    // Join Chat Room
    // ============================
    socket.on('join_chat', async (payload) => {
        try {
            const { chat_room_id } = payload;

            if (!chat_room_id) {
                socket.emit('error', { message: 'Chat room ID is required' });
                return;
            }

            // Verify chat room exists and user is participant
            const chatRoom = await ChatRoom.findById(chat_room_id);
            if (!chatRoom) {
                socket.emit('error', { message: 'Chat room not found' });
                return;
            }

            if (!chatRoom.participants.some(p => p.toString() === userId)) {
                socket.emit('error', { message: 'Unauthorized: You are not part of this chat' });
                return;
            }

            // Join the room
            socket.join(chat_room_id);
            console.log(`User ${userId} joined chat room ${chat_room_id}`);

            socket.emit('joined_chat', {
                chat_room_id,
                message: 'Successfully joined chat room',
            });

        } catch (e) {
            console.error('Error joining chat:', e);
            socket.emit('error', { message: e.message });
        }
    });

    // ============================
    // Leave Chat Room
    // ============================
    socket.on('leave_chat', (payload) => {
        try {
            const { chat_room_id } = payload;
            socket.leave(chat_room_id);
            console.log(`User ${userId} left chat room ${chat_room_id}`);

            socket.emit('left_chat', {
                chat_room_id,
                message: 'Successfully left chat room',
            });

        } catch (e) {
            console.error('Error leaving chat:', e);
            socket.emit('error', { message: e.message });
        }
    });

    // ============================
    // Send Message (Real-time)
    // Note: For file uploads, use REST API endpoint instead
    // Socket.IO is for text messages only
    // ============================
    socket.on('send_message', async (payload) => {
        try {
            console.log(payload, 'payload');
            const { chat_room_id, message_text, attachments } = payload;

            if (!chat_room_id) {
                socket.emit('error', { message: 'Chat room ID is required' });
                return;
            }

            if (!message_text && (!attachments || attachments.length === 0)) {
                socket.emit('error', { message: 'Message text or attachments are required' });
                return;
            }

            // Verify chat room
            const chatRoom = await ChatRoom.findById(chat_room_id);
            if (!chatRoom) {
                socket.emit('error', { message: 'Chat room not found' });
                return;
            }

            if (!chatRoom.participants.some(p => p.toString() === userId)) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // For appointment chats, verify booking status
            if (chatRoom.chat_type === 'appointment') {
                const booking = await Booking.findById(chatRoom.booking_id);
                if (!booking || booking.booking_status !== 'in_progress') {
                    socket.emit('error', {
                        message: 'Appointment chat is only available when booking is in progress',
                    });
                    return;
                }
            }

            // Determine receiver
            const receiverId = chatRoom.participants.find(p => p.toString() !== userId).toString();

            // Create message
            const message = new ChatMessage({
                chat_room_id,
                sender_id: userId,
                receiver_id: receiverId,
                message_text: message_text || null,
                attachments: attachments || [],
                status: 'sent',
            });

            await message.save();

            // Update chat room
            chatRoom.last_message = message._id;

            // Set last message text
            if (message_text) {
                chatRoom.last_message_text = message_text;
            } else if (attachments && attachments.length > 0) {
                const fileType = attachments[0].file_type;
                chatRoom.last_message_text = fileType === 'image' ? '📷 Photo' : '📎 File';
            }

            chatRoom.last_message_time = new Date();
            chatRoom.last_message_sender = userId;

            const unreadCount = chatRoom.unread_count || new Map();
            unreadCount.set(receiverId, (unreadCount.get(receiverId) || 0) + 1);
            chatRoom.unread_count = unreadCount;

            await chatRoom.save();

            // Populate message
            await message.populate([
                { path: 'sender_id', select: 'first_name last_name picture role' },
                { path: 'receiver_id', select: 'first_name last_name picture role' },
            ]);

            // Emit to chat room
            io.to(chat_room_id).emit('receive_message', message);

            // Emit notification to receiver
            io.to(receiverId).emit('new_message_notification', {
                chat_room_id,
                message,
                unread_count: unreadCount.get(receiverId),
            });

        } catch (e) {
            console.error('Error sending message:', e);
            socket.emit('error', { message: e.message });
        }
    });

    // ============================
    // Message Delivered
    // ============================
    socket.on('message_delivered', async (payload) => {
        try {
            const { message_id } = payload;

            const message = await ChatMessage.findById(message_id);
            if (message && !message.is_delivered) {
                message.is_delivered = true;
                message.delivered_at = new Date();
                message.status = 'delivered';
                await message.save();

                // Notify sender
                io.to(message.sender_id.toString()).emit('message_delivered_ack', {
                    message_id,
                    delivered_at: message.delivered_at,
                });
            }

        } catch (e) {
            console.error('Error marking message as delivered:', e);
        }
    });

    // ============================
    // Message Read
    // ============================
    socket.on('message_read', async (payload) => {
        try {
            const { message_id } = payload;

            const message = await ChatMessage.findById(message_id);
            if (message && message.receiver_id.toString() === userId && !message.is_read) {
                message.is_read = true;
                message.read_at = new Date();
                message.status = 'read';
                await message.save();

                // Update unread count
                const chatRoom = await ChatRoom.findById(message.chat_room_id);
                if (chatRoom) {
                    const unreadCount = chatRoom.unread_count || new Map();
                    const currentCount = unreadCount.get(userId) || 0;
                    unreadCount.set(userId, Math.max(0, currentCount - 1));
                    chatRoom.unread_count = unreadCount;
                    await chatRoom.save();
                }

                // Notify sender
                io.to(message.sender_id.toString()).emit('message_read_ack', {
                    message_id,
                    read_at: message.read_at,
                    chat_room_id: message.chat_room_id,
                });
            }

        } catch (e) {
            console.error('Error marking message as read:', e);
        }
    });

    // ============================
    // User Typing
    // ============================
    socket.on('user_typing', (payload) => {
        try {
            const { chat_room_id, is_typing } = payload;

            // Broadcast to other participants in the chat
            socket.to(chat_room_id).emit('user_typing_status', {
                chat_room_id,
                user_id: userId,
                is_typing,
            });

        } catch (e) {
            console.error('Error broadcasting typing status:', e);
        }
    });

    // ============================
    // Disconnect
    // ============================
    socket.on('disconnect', () => {
        console.log(`User ${userId} disconnected from socket ${socket.id}`);
        updateOnlineStatus(false);
    });

    // ============================
    // Legacy Support (Old conversation system)
    // ============================
    socket.on('join', (payload) => {
        let { conversation } = payload;
        console.log(`Joining room :: ${conversation}`);
        socket.join(conversation);
    });

    socket.on('message', async (payload) => {
        console.log(`Received message from ${socket.id}`);

        let roomName = payload.conversation;

        let data = {
            conversation: payload.conversation,
            sender: socket.user_id,
            message: payload.message,
        };

        io.to(roomName).emit('message', {
            ...data,
            sender: {
                _id: socket.user_id,
            },
            id: socket.id,
            createdAt: new Date(),
        });
    });
};

module.exports = socketController;