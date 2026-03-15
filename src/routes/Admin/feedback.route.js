const express = require('express')
const router = express.Router()

const feedbackController = require('../../controllers/Admin/feedback.controller')
const { AuthVerifier, OptionalAuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')

router.get('/', AuthVerifier, RestrictAccess([ROLES.ADMIN]), feedbackController.getFeedback)

router.get('/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), feedbackController.getFeedbackById)

module.exports = router