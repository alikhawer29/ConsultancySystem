const express = require('express')
const router = express.Router()

const conversationController = require('../controllers/conversation.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.get('/get/:id', AuthVerifier, RestrictAccess([ROLES.USER, ROLES.PROVIDER, ROLES.ADMIN]), conversationController.getConversationById)

router.post('/message', AuthVerifier, RestrictAccess([ROLES.USER, ROLES.PROVIDER, ROLES.ADMIN]), conversationController.sendMessage)

module.exports = router