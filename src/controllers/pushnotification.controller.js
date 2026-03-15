const PushNotification = require('../models/pushnotifications.model')
const User = require('../models/user.model')
const { sendBulkNotification } = require('../helpers/notification')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createPushNotification = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let push_notification = new PushNotification(body)
        await push_notification.save()

        let notification = {
            title: body?.title,
            body: body?.message
        }

        let filter = {}

        if (body && body?.user_type && body?.user_type !== "" && body?.user_type !== "all") {
            filter.role = body?.user_type
        }

        const users = await User.find(filter)
        sendBulkNotification(notification, users.map(item => item._id))

        return res.status(200).send({
            success: true,
            message: "Push Notification Successfully Saved",
            data: push_notification
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const resendPushNotification = (async (req, res) => {
    try {

        let { params } = req

        let push_notification = await PushNotification.findById(params?.id)

        let notification = {
            title: push_notification?.title,
            body: push_notification?.message
        }

        let filter = {}

        if (push_notification?.user_type !== "all") {
            filter.role = push_notification?.user_type
        }

        const users = await User.find(filter)
        sendBulkNotification(notification, users.map(item => item._id))

        return res.status(200).send({
            success: true,
            message: "Push Notification Resent Successfully"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPushNotification = (async (req, res) => {
    try {

        let { page, per_page, search, from, to, sortBy } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, $or: [{ title: getSearchQuery(search) }, { message: getSearchQuery(search) }] }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let push_notifications = await PushNotification.find(filter, projection, options).sort(sort)

        let total = await PushNotification.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: push_notifications
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getPushNotificationById = (async (req, res) => {
    try {

        let id = req.params.id

        let push_notification = await PushNotification.findById(id)

        return res.status(200).send({
            success: true,
            data: push_notification
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deletePushNotification = (async (req, res) => {
    try {

        let { id } = req.params

        await PushNotification.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "Push Notification has been deleted successfully."
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createPushNotification,
    resendPushNotification,
    getPushNotification,
    getPushNotificationById,
    deletePushNotification
}