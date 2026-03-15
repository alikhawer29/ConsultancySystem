const mongoose = require('mongoose')
const { ENUM_PUSH_USER_TYPES, PUSH_USER_TYPES } = require('../utils')

const pushnotificationSchema = mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    user_type: {
        type: String,
        enum: ENUM_PUSH_USER_TYPES,
        default: PUSH_USER_TYPES.ALL
    },
    metadata: {
        type: Object,
    },
}, { timestamps: true })

module.exports = mongoose.model('pushnotification', pushnotificationSchema)