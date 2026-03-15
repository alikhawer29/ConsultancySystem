const express = require('express')
const router = express.Router()

const packageController = require('../controllers/package.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, packageController.createPackage)

router.put('/handle-status/:id', AuthVerifier, packageController.handleStatus)

router.get('/get', AuthVerifier, packageController.getPackages)

router.get('/get/:id', AuthVerifier, packageController.getPackageById)

router.post('/subscribe/:id', AuthVerifier, packageController.subscribe)

router.get('/payment-logs', AuthVerifier, packageController.getPaymentLogs)

module.exports = router