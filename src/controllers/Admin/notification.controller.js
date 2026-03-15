const Notification = require('../../models/notification.model')
const { getSearchQuery, getDateRangeQuery, paginationHandler } = require('../../utils')
const { ROLES } = require('../../utils')
const ResponseHandler = require('../../utils/response')

// User/Service Provider: Get notifications
const getUserNotifications = async (req, res) => {
    try {
        let { query, decoded } = req
        let { page, per_page, search, from, to, sortBy, status } = query

        let options = paginationHandler(page, per_page)

        // Filter for user/provider notifications only
        let filter = {
            $or: [
                {
                    recipients: {
                        $in: [decoded.id]
                    }
                },
                {
                    for_all: true
                }
            ],
            // Exclude admin-only notifications
            for_admins: { $ne: true }
        }

        // Add status filter (all, read, unread) - using 'read' boolean field
        if (status && status !== 'all') {
            if (status === 'read') {
                filter.read = true
            } else if (status === 'unread') {
                filter.read = false
            }
        }

        let sort = { createdAt: -1 }
        let projection = {}

        if (search) {
            filter = { ...filter, 'notification.title': getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let notifications = await Notification.find(filter, projection, options).sort(sort)

        let total = await Notification.countDocuments(filter)

        return ResponseHandler.success(res, "Notifications retrieved successfully", {
            total,
            data: notifications
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

// Admin: Get notifications
const getAdminNotifications = async (req, res) => {
    try {
        let { query, decoded } = req
        let { page, per_page, search, from, to, sortBy, status } = query

        let options = paginationHandler(page, per_page)

        // Filter for admin notifications only
        let filter = {
            $or: [
                {
                    recipients: {
                        $in: [decoded.id]
                    }
                },
                {
                    for_admins: true
                },
                {
                    for_all: true
                }
            ]
        }

        // Add status filter (all, read, unread) - using 'read' boolean field
        if (status && status !== 'all') {
            if (status === 'read') {
                filter.read = true
            } else if (status === 'unread') {
                filter.read = false
            }
        }

        let sort = { createdAt: -1 }
        let projection = {}

        if (search) {
            filter = { ...filter, 'notification.title': getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let notifications = await Notification.find(filter, projection, options).sort(sort)

        let total = await Notification.countDocuments(filter)

        return ResponseHandler.success(res, "Notifications retrieved successfully", {
            total,
            data: notifications
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params
        const { decoded } = req

        const notification = await Notification.findById(id)

        if (!notification) {
            return ResponseHandler.error(res, "Notification not found", 404);
        }

        // Check if user has access to this notification
        const hasAccess = notification.recipients.includes(decoded.id) ||
            notification.for_all ||
            (decoded.role === ROLES.ADMIN && notification.for_admins)

        if (!hasAccess) {
            return ResponseHandler.error(res, "Access denied to this notification", 403);
        }

        // Update the read status
        const updatedNotification = await Notification.findByIdAndUpdate(
            id,
            { read: true },
            { new: true }
        )

        return ResponseHandler.success(res, "Notification marked as read", updatedNotification);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const { decoded } = req

        // Find all unread notifications for this user
        let filter = {
            $or: [
                { recipients: { $in: [decoded.id] } },
                { for_all: true }
            ],
            read: false // Using boolean read field
        }

        // Add role-specific filters
        if (decoded.role === ROLES.ADMIN) {
            filter.$or.push({ for_admins: true })
        } else {
            filter.for_admins = { $ne: true }
        }

        // Update all matching notifications
        const result = await Notification.updateMany(
            filter,
            { read: true }
        )

        return ResponseHandler.success(res, `Marked ${result.modifiedCount} notifications as read`, {
            marked_count: result.modifiedCount
        });

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

module.exports = {
    getUserNotifications,
    getAdminNotifications,
    markAsRead,
    markAllAsRead
}