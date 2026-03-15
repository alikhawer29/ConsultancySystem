const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const reviewSchema = new mongoose.Schema(
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

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        review: {
            type: String,
            trim: true,
        },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

// --- Plugins ---
reviewSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
reviewSchema.index({ user: 1, service: 1 });
reviewSchema.index({ service: 1, rating: -1 });

// --- Pre Hooks for queries ---
reviewSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

reviewSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
reviewSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

reviewSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Model export ---
module.exports = mongoose.model("Review", reviewSchema);

