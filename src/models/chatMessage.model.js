const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const dotenv = require('dotenv');

dotenv.config();

const chatMessageSchema = new mongoose.Schema(
    {
        // Reference to chat room
        chat_room_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatRoom',
            required: true,
            index: true,
        },

        // Sender
        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Receiver
        receiver_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        // Message content (text)
        message_text: {
            type: String,
            trim: true,
        },

        // Attachments (images/files)
        attachments: [{
            file_url: {
                type: String,
                required: true,
            },
            file_name: {
                type: String,
            },
            file_size: {
                type: Number,
            },
            file_type: {
                type: String, // 'image' or 'file'
                enum: ['image', 'file'],
            },
            mime_type: {
                type: String, // e.g., 'image/jpeg', 'application/pdf'
            },
        }],

        // Message status
        status: {
            type: String,
            enum: ['sent', 'delivered', 'read'],
            default: 'sent',
            index: true,
        },

        // Read receipt
        is_read: {
            type: Boolean,
            default: false,
        },

        read_at: {
            type: Date,
        },

        // Delivered receipt
        is_delivered: {
            type: Boolean,
            default: false,
        },

        delivered_at: {
            type: Date,
        },

        // Soft delete
        deleted: {
            type: Boolean,
            default: false,
        },

        deletedAt: {
            type: Date,
        },

        // Deleted for specific users (user can delete for themselves)
        deleted_for: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
    },
    {
        timestamps: true,
    }
);

// --- Plugins ---
chatMessageSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
chatMessageSchema.index({ chat_room_id: 1, createdAt: -1 });
chatMessageSchema.index({ sender_id: 1, receiver_id: 1 });
chatMessageSchema.index({ status: 1 });
chatMessageSchema.index({ is_read: 1 });

// --- Virtuals ---
// Add full URLs to attachments
chatMessageSchema.virtual('attachments_with_urls').get(function () {
    if (!this.attachments || this.attachments.length === 0) return [];

    const baseUrl = process.env.BASE_URL.replace(/\/$/, '');

    return this.attachments.map(attachment => {
        // Handle both Mongoose documents and plain objects
        const attachmentObj = attachment.toObject ? attachment.toObject() : attachment;

        return {
            ...attachmentObj,
            full_url: attachmentObj.file_url.startsWith('http')
                ? attachmentObj.file_url
                : `${baseUrl}/${attachmentObj.file_url.replace(/^\//, '')}`,
        };
    });
});

// --- Pre Hooks ---
chatMessageSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance Methods ---
chatMessageSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

// --- Model Export ---
module.exports = mongoose.model('ChatMessage', chatMessageSchema);

