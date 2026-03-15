// authentication.route.js
const express = require('express')
const router = express.Router()

const authController = require('../../controllers/Admin/authentication.controller')

router.post('/login', authController.login)

router.post('/forget-password', authController.forgetPassword)

router.post('/verify-otp', authController.verifyOtp)

router.post('/reset-password', authController.resetPassword)

module.exports = router