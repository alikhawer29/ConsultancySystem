const express = require('express')
const router = express.Router()

const userRoutes = require('./user.route')
const authRoutes = require('./authentication.route')
const feedbackRoutes = require('./feedback.route')
const generalRoutes = require('./general.route')
const categoryRoutes = require('./category.route')
const conversationRoutes = require('./conversation.route')
const notificationRoutes = require('./notification.route')
const packageRoutes = require('./package.route')
const serviceRoutes = require('./service.route')
const bookingRoutes = require('./booking.route')
const pushnotificationRoutes = require('./pushnotification.route')
const contentRoutes = require('./content.route')
const reviewRoutes = require('./review.route')
const reportRoutes = require('./report.route')
const slotRoutes = require('./slot.route')
const faqRoutes = require('./faq.route')
const chatRoutes = require('./chat.route')

const adminServiceRoutes = require('./Admin/service.route')
const adminCategoryRoutes = require('./Admin/category.route')
const adminContentRoutes = require('./Admin/content.route')
const adminBookingRoutes = require('./Admin/booking.route')
const adminAuthRoutes = require('./Admin/authentication.route')
const adminUserRoutes = require('./Admin/user.route')
const adminNotificationRoutes = require('./Admin/notification.route')
const adminSlotRoutes = require('./Admin/slot.route')
const adminFeedbackRoutes = require('./Admin/feedback.route')
const adminPaymentRoutes = require('./Admin/payment.route')
const adminReportRoutes = require('./Admin/report.route')
const adminFaqRoutes = require('./Admin/faq.route')
const adminChatRoutes = require('./Admin/chat.route')

//ADMIN

router.use('/admin/services', adminServiceRoutes)

router.use('/admin/categories', adminCategoryRoutes)

router.use('/admin/content', adminContentRoutes)

router.use('/admin/auth', adminAuthRoutes)

router.use('/admin/booking', adminBookingRoutes)

router.use('/admin/', adminUserRoutes)

router.use('/admin/notifications', adminNotificationRoutes)

router.use('/admin/slots', adminSlotRoutes)

router.use('/admin/feedback', adminFeedbackRoutes)

router.use('/admin/payments', adminPaymentRoutes)

router.use('/admin/reports', adminReportRoutes)

router.use('/admin/faq', adminFaqRoutes)

router.use('/admin/chat', adminChatRoutes)

//USER

router.use('/user', userRoutes)

router.use('/auth', authRoutes)

router.use('/feedback', feedbackRoutes)

router.use('/general', generalRoutes)

router.use('/category', categoryRoutes)

router.use('/conversation', conversationRoutes)

router.use('/notification', notificationRoutes)

router.use('/package', packageRoutes)

router.use('/service', serviceRoutes)

router.use('/booking', bookingRoutes)

router.use('/push-notification', pushnotificationRoutes)

router.use('/content', contentRoutes)

router.use('/review', reviewRoutes)

router.use('/report', reportRoutes)

router.use('/slot', slotRoutes)

router.use('/faq', faqRoutes)

router.use('/chat', chatRoutes)

module.exports = router