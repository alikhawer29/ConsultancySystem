const express = require('express')
const router = express.Router()

const notificationController = require('../../controllers/Admin/notification.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')

// Admin Routes
router.get('/', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.getAdminNotifications)
router.patch('/read/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.markAsRead)
router.patch('/read-all', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.markAllAsRead)

module.exports = router