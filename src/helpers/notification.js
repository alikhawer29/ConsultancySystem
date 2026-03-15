const Notification = require('../models/notification.model')
const admin = require('../configs/firebase')
const User = require('../models/user.model')

const sendNotification = (async (notification, id, savable = true) => {

    let user = await User.findById(id).lean()

    if (savable) {

        let notifications = new Notification({
            notification,
            recipients: [id]
        })

        await notifications.save()

    }

    if (user?.device_ids?.length > 0) {
        // Convert all data values to strings for Firebase compatibility
        const data = notification?.data ?? {}
        const stringifiedData = {}
        Object.keys(data).forEach(key => {
            stringifiedData[key] = String(data[key])
        })

        const result = await admin.messaging().sendEachForMulticast({
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: stringifiedData,
            tokens: user?.device_ids
        })

        // Log notification results
        console.log(`📱 Firebase Notification Results for user ${id}:`)
        console.log(`   Total tokens: ${result.failureCount + result.successCount}`)
        console.log(`   ✅ Success: ${result.successCount}`)
        console.log(`   ❌ Failed: ${result.failureCount}`)

        if (result.failureCount > 0) {
            console.log('   Failed tokens and errors:')
            result.responses.forEach((response, index) => {
                if (!response.success) {
                    console.log(`   Token ${index + 1}: ${user.device_ids[index]} - ${response.error?.message || 'Unknown error'}`)
                }
            })
        }

        return result
    }

})

const sendBulkNotification = (async (notification, ids = [], savable = true) => {

    let users = await User.find({ _id: { $in: ids } }).lean()
    let tokens = []
    users.forEach((item) => {
        item.device_ids.forEach(token => {
            tokens.push(token)
        })
    })

    if (savable) {

        let notifications = new Notification({
            notification,
            recipients: ids
        })

        await notifications.save()

    }

    if (tokens?.length > 0) {
        // Convert all data values to strings for Firebase compatibility
        const data = notification?.data ?? {}
        const stringifiedData = {}
        Object.keys(data).forEach(key => {
            stringifiedData[key] = String(data[key])
        })

        const payload = {
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: stringifiedData,
            tokens
        }

        const result = await admin.messaging().sendEachForMulticast(payload)

        // Log notification results
        console.log(`📱 Firebase Bulk Notification Results:`)
        console.log(`   Total tokens: ${result.failureCount + result.successCount}`)
        console.log(`   ✅ Success: ${result.successCount}`)
        console.log(`   ❌ Failed: ${result.failureCount}`)

        if (result.failureCount > 0) {
            console.log('   Failed tokens and errors:')
            result.responses.forEach((response, index) => {
                if (!response.success) {
                    console.log(`   Token ${index + 1}: ${tokens[index]} - ${response.error?.message || 'Unknown error'}`)
                }
            })
        }

        return result
    }

})

const sendStatusChangeNotification = async (user, newStatus, adminUser) => {
    try {
        const statusText = newStatus ? 'activated' : 'deactivated'
        const adminName = adminUser?.name || 'Administrator'

        const notification = {
            title: `Account ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
            body: `Your account has been ${statusText} by ${adminName}.`,
            data: {
                type: 'account_status_change',
                user_id: user._id.toString(),
                previous_status: !newStatus,
                new_status: newStatus,
                changed_by: adminUser?.id || 'system',
                changed_at: new Date().toISOString(),
                action: 'status_update'
            }
        }

        // Send notification using your existing helper
        const result = await sendNotification(notification, user._id, true)

        // Log result
        if (result) {
            console.log(`✅ Status change notification sent to user ${user.email}`)
            if (result.failureCount > 0) {
                console.log(`⚠️  ${result.failureCount} out of ${result.failureCount + result.successCount} notifications failed`)
            }
        } else {
            console.log(`ℹ️  No device tokens found for user ${user.email}`)
        }

    } catch (error) {
        console.error('Error sending status change notification:', error)
        // Don't throw error - notification failure shouldn't break the main function
    }
}

module.exports = {
    sendNotification,
    sendBulkNotification,
    sendStatusChangeNotification
}