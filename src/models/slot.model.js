const mongoose = require("mongoose");
const mongooseLeanVirtuals = require("mongoose-lean-virtuals");
const dotenv = require("dotenv");

dotenv.config();

const slotSchema = new mongoose.Schema(
    {
        day: {
            type: String,
            required: true,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            index: true,
        },

        start_time: {
            type: String,
            required: true,
            trim: true,
        },

        end_time: {
            type: String,
            required: true,
            trim: true,
        },

        // Slot status
        is_active: {
            type: Boolean,
            default: true,
        },

        // Created by admin
        created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Soft delete fields
        deleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
    },
    { timestamps: true }
);

// --- Plugins ---
slotSchema.plugin(mongooseLeanVirtuals);

// --- Indexes ---
slotSchema.index({ day: 1, start_time: 1 });
slotSchema.index({ is_active: 1 });

// --- Pre Hooks for queries ---
slotSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

slotSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false });
    } else {
        delete this.getFilter().deleted;
    }
    next();
});

// --- Instance methods ---
slotSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
};

slotSchema.methods.restore = async function () {
    this.deleted = false;
    this.deletedAt = null;
    await this.save();
};

// --- Virtuals ---
// Note: These virtual fields show UTC times (as stored in database)
// They are automatically recalculated with converted timezone times when using
// convertSlotTimesFromUTC() helper in controllers
slotSchema.virtual('time_range').get(function () {
    return `${this.start_time} - ${this.end_time}`;
});

slotSchema.virtual('time_range_new').get(function () {
    const formatTime = (time) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${period}`;
    };

    return `${formatTime(this.start_time)} - ${formatTime(this.end_time)}`;
});

// --- Model export ---
module.exports = mongoose.model("Slot", slotSchema);

