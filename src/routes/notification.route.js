const express = require('express')
const router = express.Router()

const notificationController = require('../controllers/notification.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

// User/Service Provider Routes
router.get('/user', AuthVerifier, RestrictAccess([ROLES.USER, ROLES.PROVIDER]), notificationController.getUserNotifications)
router.patch('/user/read/:id', AuthVerifier, RestrictAccess([ROLES.USER, ROLES.PROVIDER]), notificationController.markAsRead)
router.patch('/user/read-all', AuthVerifier, RestrictAccess([ROLES.USER, ROLES.PROVIDER]), notificationController.markAllAsRead)

// Admin Routes
router.get('/admin', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.getAdminNotifications)
router.patch('/admin/read/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.markAsRead)
router.patch('/admin/read-all', AuthVerifier, RestrictAccess([ROLES.ADMIN]), notificationController.markAllAsRead)

module.exports = router