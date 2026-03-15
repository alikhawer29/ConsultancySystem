const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
    notification: {
        title: String,
        body: String,
        data: Object
    },
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    for_all: {
        type: Boolean,
        default: false
    },
    for_admins: {
        type: Boolean,
        default: false
    },
    read: {
        type: Boolean,
        default: false
    },
    // Optional: Track which users have read this notification
    read_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
})


module.exports = mongoose.model('Notification', notificationSchema)