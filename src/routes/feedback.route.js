const express = require('express')
const router = express.Router()

const feedbackController = require('../controllers/feedback.controller')
const { AuthVerifier, OptionalAuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.post('/create', OptionalAuthVerifier, feedbackController.createFeedback)

router.get('/get', AuthVerifier, RestrictAccess([ROLES.ADMIN]), feedbackController.getFeedback)

router.get('/get/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), feedbackController.getFeedbackById)

module.exports = router