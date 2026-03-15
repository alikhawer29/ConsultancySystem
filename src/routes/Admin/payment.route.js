
const express = require('express')
const router = express.Router()

const paymentController = require('../../controllers/Admin/payment.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')

router.get('/', AuthVerifier, RestrictAccess([ROLES.ADMIN]), paymentController.getAllPayments) // Get All Payments (Admin only)

module.exports = router