const mongoose = require('mongoose')
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')
const { ENUM_CONTENT_TYPES, ENUM_MEDIA_TYPES, MEDIA_TYPES } = require('../utils')

dotenv.config()

const contentSchema = mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ENUM_CONTENT_TYPES
    },
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    media: {
        type: String,
        required: true,
    },
    media_type: {
        type: String,
        required: true,
        enum: ENUM_MEDIA_TYPES
    },
    media_thumbnail: {
        type: String,
        required: function () {
            return this.media_type === MEDIA_TYPES.VIDEO
        }
    },
    active: {
        type: Boolean,
        default: true
    },
    no_of_views: {
        type: Number,
        default: 5
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

contentSchema.virtual('media_url').get(function () {
    if (!this.media) {
        return null
    }
    if (this.media.startsWith('http')) {
        return this.media
    }
    // Remove trailing slash from BASE_URL and add leading slash to path if needed
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '')
    const path = this.media.startsWith('/') ? this.media : `/${this.media}`
    return `${baseUrl}${path}`
})

contentSchema.virtual('media_thumbnail_url').get(function () {
    if (!this.media_thumbnail) {
        return null
    }
    if (this.media_thumbnail.startsWith('http')) {
        return this.media_thumbnail
    }
    // Remove trailing slash from BASE_URL and add leading slash to path if needed
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '')
    const path = this.media_thumbnail.startsWith('/') ? this.media_thumbnail : `/${this.media_thumbnail}`
    return `${baseUrl}${path}`
})

contentSchema.plugin(mongooseLeanVirtuals)

// --- Instance methods ---
contentSchema.methods.trash = async function () {
    this.deleted = true;
    this.deletedAt = new Date();
    await this.save();
}

module.exports = mongoose.model('Content', contentSchema)
