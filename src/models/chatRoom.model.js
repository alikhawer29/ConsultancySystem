const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const dotenv = require('dotenv');

dotenv.config();

const chatRoomSchema = new mongoose.Schema(
    {
        // Chat type: 'support' or 'appointment'
        chat_type: {
            type: String,
            enum: ['support', 'appointment'],
            required: true,
            index: true,
        },

        // Participants (always 2 users in one-to-one chat)
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true,
            },
        ],

        // For support chat: user/provider with admin
        // For appointment chat: user with provider
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Provider or Admin (depending on chat type)
        other_user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // For appointment chats only
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            index: true,
        },

        // Last message for chat list display
        last_message: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatMessage',
        },

        last_message_text: {
            type: String,
        },

        last_message_time: {
            type: Date,
        },

        last_message_sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // Unread count for each participant
        unread_count: {
            type: Map,
            of: Number,
            default: () => new Map(),
        },

        // Chat status
        is_active: {
            type: Boolean,
            default: true,
        },

        // For appointment chats - auto-deactivate when appointment completes
        auto_close_on_completion: {
            type: Boolean,
            default: false,
        },

        // Soft delete
        deleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// --- Virtual Fields ---
// is_chat_active: For appointment chats, active only when booking is in_progress
// For support chats, always active
chatRoomSchema.virtual('is_chat_active').get(function () {
    if (this.chat_type === 'support') {
        return this.is_active;
    }

    if (this.chat_type === 'appointment') {
        // If booking is populated, check its booking_status
        if (this.booking_id && typeof this.booking_id === 'object' && this.booking_id.booking_status) {
            return this.booking_id.booking_status === 'in_progress' && this.is_active;
        }
        // If booking is not populated, we can't determine, so return is_active
        return this.is_active;
    }

    return this.is_active;
});

// --- Plugins ---
chatRoomSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
chatRoomSchema.index({ user_id: 1, other_user_id: 1, chat_type: 1 });
chatRoomSchema.index({ booking_id: 1 });
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ last_message_time: -1 });
chatRoomSchema.index({ chat_type: 1, is_active: 1 });

// --- Pre Hooks ---
chatRoomSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

chatRoomSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance Methods ---
chatRoomSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

chatRoomSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Model Export ---
module.exports = mongoose.model('ChatRoom', chatRoomSchema);

