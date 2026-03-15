// routes/faq.js
const express = require('express')
const router = express.Router()

const faqController = require('../controllers/faq.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')
const upload = require('../middlewares/upload.middleware')

// Admin Routes
router.get('/admin', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.getAdminFAQs)
router.get('/admin/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.getFAQById)
router.post('/admin', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload('faq').fields([
    { name: 'answer_image', maxCount: 1 },
    { name: 'answer_video', maxCount: 1 }
]), faqController.addFAQ)
router.patch('/admin/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload('faq').fields([
    { name: 'answer_image', maxCount: 1 },
    { name: 'answer_video', maxCount: 1 }
]), faqController.editFAQ)
router.delete('/admin/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.deleteFAQ)

// User Routes (Public or Authenticated)
router.get('/user', faqController.getUserFAQs)

module.exports = router