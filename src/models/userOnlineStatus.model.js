const mongoose = require('mongoose');

const userOnlineStatusSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },

        is_online: {
            type: Boolean,
            default: false,
        },

        last_seen: {
            type: Date,
            default: Date.now,
        },

        socket_id: {
            type: String,
        },

        // For multiple device support
        active_sockets: [
            {
                socket_id: String,
                connected_at: Date,
            },
        ],
    },
    {
        timestamps: true,
    }
);

// --- Indexes ---
userOnlineStatusSchema.index({ user_id: 1 });
userOnlineStatusSchema.index({ is_online: 1 });

// --- Model Export ---
module.exports = mongoose.model('UserOnlineStatus', userOnlineStatusSchema);

