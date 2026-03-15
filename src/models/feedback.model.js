const mongoose = require('mongoose')

const feedbackSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // No required: true, so it's nullable
    },

}, { timestamps: true })

module.exports = mongoose.model('Feedback', feedbackSchema)