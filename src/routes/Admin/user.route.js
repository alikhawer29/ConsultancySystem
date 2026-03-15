// user.route.js
const express = require('express')
const router = express.Router()

const userController = require('../../controllers/Admin/user.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const upload = require('../../middlewares/upload.middleware')
const { ROLES } = require('../../utils')


//ACCOUNT
router.post('/change-password', AuthVerifier, userController.changePassword)

router.get('/profile', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getMyProfile)

router.get('/home', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getHome)

//UPGRADE REQUESTS - Move to top to prevent route conflicts
router.get('/upgrade-requests', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getUpgradeRequests)

router.get('/upgrade-requests/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getUpgradeRequestDetails)

//USERS
router.get('/users', AuthVerifier, userController.getUser)

router.get('/users/upgrade-requests', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getUpgradeRequests)

router.get('/users/upgrade-requests/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getUpgradeRequestDetails)

router.get('/users/:id', AuthVerifier, userController.getUserById)

router.patch('/users/status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.updateUserStatus) //Update user status

router.get('/user-appointments/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getAppointmentsByUser) //only admin can access this route

//PROVIDERS
router.get('/provider-appointments/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getAppointmentsByProvider) //only admin can access this route

router.patch('/provider/verify/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.verifyUser)

router.patch('/provider/schedule-interview/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.scheduleInterview)

router.patch('/provider/upgrade-account/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.upgradeAccount)

router.get('/unassigned-services', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getUnassignedServices)

router.post('/assign-service/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.assignServiceToProvider)

router.patch('/handle-status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.handleStatus)

router.put('/update', AuthVerifier, upload("user").single("image"), userController.updateUser)

router.delete('/delete', AuthVerifier, userController.deleteUser)

router.put('/handle-favorite/:id', AuthVerifier, userController.handleFavoriteServices)

router.get('/favorites', AuthVerifier, userController.getFavoriteServices)

router.get('/analytics', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getAnalytics)

router.post('/logout', AuthVerifier, userController.logout)

module.exports = router