const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const bookingSchema = new mongoose.Schema(
    {
        booking_id: {
            type: String,
            required: true,
            unique: true,
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        service_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
        },

        category_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
        },

        provider_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        slot_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Slot",
        },

        price_type: {
            type: String,
            enum: ["normal", "premium"],
            default: "normal",
        },

        price: {
            type: Number,
            required: true,
        },

        // Address
        address: {
            full_address: { type: String },
            lat: { type: Number },
            lng: { type: Number },
            floor: { type: String },
        },

        // Contact Details
        contact_details: {
            first_name: { type: String },
            last_name: { type: String },
            country_code: { type: String },
            phone_number: { type: String },
            email: { type: String },
        },

        session_date: { type: Date, required: true },
        session_time: { type: String, required: true },

        // Booking workflow
        // Status: Overall booking state
        status: {
            type: String,
            enum: ["pending", "approved", "requested", "rejected", "cancelled"],
            default: "pending",
        },

        // Booking Status: Time-based state (managed by cron job)
        booking_status: {
            type: String,
            enum: ["upcoming", "in_progress", "past"],
            default: "upcoming",
        },

        payment_status: {
            type: String,
            enum: ["paid", "unpaid", "refunded"],
            default: "unpaid",
        },

        notes: { type: String },

        // Reschedule tracking
        reschedule_requested: { type: Boolean, default: false },
        reschedule_count: { type: Number, default: 0 },

        // Proposed reschedule details (set by admin)
        proposed_session_date: { type: Date },
        proposed_session_time: { type: String },
        proposed_slot_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Slot",
        },
        reschedule_reason: { type: String },

        // User response to reschedule
        reschedule_response: {
            type: String,
            enum: ["pending", "approved", "rejected"],
        },
        reschedule_rejection_reason: { type: String },
        reschedule_responded_at: { type: Date },

        // Reference to payment
        payment_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
        },

        // Cancellation fields
        cancellation_reason: { type: String },
        cancelled_by: {
            type: String,
            enum: ['user', 'provider', 'admin'],
        },
        cancelled_at: { type: Date },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        visit_type: {
            type: String,
            enum: ["provider_visits_user", "user_visits_provider", 'both'],
        },
    },
    { timestamps: true }
);

// --- Plugins ---
bookingSchema.plugin(mongooseLeanVirtuals);

// --- Pre Hooks for queries ---
bookingSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

bookingSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
bookingSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

bookingSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Virtuals ---
bookingSchema.virtual("user_full_name").get(function () {
    const { first_name, last_name } = this.contact_details || {};
    return `${first_name || ""} ${last_name || ""}`.trim();
});

bookingSchema.virtual("session_datetime").get(function () {
    if (!this.session_date || !this.session_time) return null;
    return `${this.session_date.toISOString().split("T")[0]} ${this.session_time}`;
});

// --- Model export ---
module.exports = mongoose.model("Booking", bookingSchema);
