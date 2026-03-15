const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const paymentSchema = new mongoose.Schema(
    {
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
        },

        currency: {
            type: String,
            default: "usd",
        },

        payment_mode: {
            type: String,
            enum: ["card", "wallet", "cash"],
            default: "card",
        },

        payment_status: {
            type: String,
            enum: ["pending", "succeeded", "failed", "refunded"],
            default: "pending",
        },

        // Stripe payment intent ID
        stripe_payment_intent_id: {
            type: String,
        },

        // Stripe client secret (for frontend)
        stripe_client_secret: {
            type: String,
        },

        // Stripe customer ID
        stripe_customer_id: {
            type: String,
        },

        // Transaction details
        transaction_id: {
            type: String,
        },

        payment_method: {
            type: String,
        },

        // Metadata
        metadata: {
            type: Object,
        },

        // Refund details
        refund_amount: {
            type: Number,
            default: 0,
        },

        refund_status: {
            type: String,
            enum: ["none", "partial", "full"],
            default: "none",
        },

        stripe_refund_id: {
            type: String,
        },

        refund_reason: {
            type: String,
        },

        refunded_at: {
            type: Date,
        },

        // Provider compensation (for late cancellations)
        provider_compensation_amount: {
            type: Number,
            default: 0,
        },

        provider_compensation_status: {
            type: String,
            enum: ["none", "pending", "completed"],
            default: "none",
        },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

// --- Plugins ---
paymentSchema.plugin(mongooseLeanVirtuals);

// --- Pre Hooks for queries ---
paymentSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

paymentSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
paymentSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

paymentSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Model export ---
module.exports = mongoose.model("Payment", paymentSchema);

