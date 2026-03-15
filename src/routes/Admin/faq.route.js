// routes/faq.js
const express = require('express')
const router = express.Router()

const faqController = require('../../controllers/Admin/faq.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')
const upload = require('../../middlewares/upload.middleware')

router.get('/', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.get)
router.get('/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.getById)
router.post('/', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload('faq').fields([
    { name: 'answer_image', maxCount: 1 },
    { name: 'answer_video', maxCount: 1 }
]), faqController.add)
router.patch('/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload('faq').fields([
    { name: 'answer_image', maxCount: 1 },
    { name: 'answer_video', maxCount: 1 }
]), faqController.edit)
router.delete('/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), faqController.remove)

module.exports = router