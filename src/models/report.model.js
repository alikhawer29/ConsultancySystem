const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const reportSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
            index: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
        },

        reason: {
            type: String,
            required: true,
            trim: true,
        },

        // description: {
        //     type: String,
        //     required: true,
        //     trim: true,
        // },

        // File attachments (PDF, Docx, JPG)
        attachments: [{
            type: String,
        }],

        // Report status
        status: {
            type: String,
            enum: ["pending", "under_review", "resolved", "rejected"],
            default: "pending",
        },

        // Admin response
        admin_response: {
            type: String,
            trim: true,
        },

        resolved_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        resolved_at: {
            type: Date,
        },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

// --- Plugins ---
reportSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
reportSchema.index({ user: 1, service: 1 });
reportSchema.index({ status: 1 });

// --- Pre Hooks for queries ---
reportSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

reportSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
reportSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

reportSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Virtuals ---
reportSchema.virtual('attachments_urls').get(function () {
    if (!this.attachments || this.attachments.length === 0) return [];

    return this.attachments.map(attachment => {
        if (!attachment) {
            return null;
        }
        if (attachment.startsWith('http')) {
            return attachment;
        }
        // Remove trailing slash from BASE_URL and add leading slash to path if needed
        const baseUrl = process.env.BASE_URL.replace(/\/$/, '');
        const path = attachment.startsWith('/') ? attachment : `/${attachment}`;
        return `${baseUrl}${path}`;
    });
});


// --- Model export ---
module.exports = mongoose.model("Report", reportSchema);

