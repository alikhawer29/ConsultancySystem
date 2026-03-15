const express = require('express')
const router = express.Router()

const pushnotificationController = require('../controllers/pushnotification.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), pushnotificationController.createPushNotification)

router.post('/resend/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), pushnotificationController.resendPushNotification)

router.get('/get', AuthVerifier, RestrictAccess([ROLES.ADMIN]), pushnotificationController.getPushNotification)

router.get('/get/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), pushnotificationController.getPushNotificationById)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), pushnotificationController.deletePushNotification)

module.exports = router