const mongoose = require('mongoose')
const { ENUM_MESSAGE_STATUS, MESSAGE_STATUS } = require('../utils')

const messageSchema = mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: {
        type: String
    },
    media: {
        type: String
    },
    status: {
        type: String,
        enum: ENUM_MESSAGE_STATUS,
        default: MESSAGE_STATUS.SENT,
    },
}, { timestamps: true })

module.exports = mongoose.model('Message', messageSchema)