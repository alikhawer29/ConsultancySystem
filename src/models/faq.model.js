// models/faq.model.js
const mongoose = require('mongoose')

const faqSchema = mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer_type: {
        type: String,
        enum: ['text', 'image', 'video'],
        default: 'text'
    },
    answer_text: {
        type: String,
        required: function () {
            return this.answer_type === 'text'
        }
    },
    answer_image: {
        type: String,
        required: function () {
            return this.answer_type === 'image'
        }
    },
    answer_video: {
        type: String,
        required: function () {
            return this.answer_type === 'video'
        }
    },
    category: {
        type: String,
        default: 'general'
    },
    order: {
        type: Number,
        default: 0
    },
    is_active: {
        type: Boolean,
        default: true
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Virtual for answer URL based on type - FIXED PATH CONSTRUCTION
faqSchema.virtual('answer_url').get(function () {
    if (this.answer_type === 'image' && this.answer_image) {
        if (this.answer_image.startsWith('http')) {
            return this.answer_image
        }
        const baseUrl = process.env.BASE_URL?.replace(/\/$/, '') || ''
        // Remove the extra slash - just concatenate properly
        return `${baseUrl}/uploads/${this.answer_image}`
    }

    if (this.answer_type === 'video' && this.answer_video) {
        if (this.answer_video.startsWith('http')) {
            return this.answer_video
        }
        const baseUrl = process.env.BASE_URL?.replace(/\/$/, '') || ''
        // Remove the extra slash - just concatenate properly
        return `${baseUrl}/uploads/${this.answer_video}`
    }

    return null
})

// Virtual for answer content
faqSchema.virtual('answer_content').get(function () {
    return {
        type: this.answer_type,
        text: this.answer_text,
        image_url: this.answer_type === 'image' ? this.answer_url : null,
        video_url: this.answer_type === 'video' ? this.answer_url : null
    }
})

module.exports = mongoose.model('FAQ', faqSchema)