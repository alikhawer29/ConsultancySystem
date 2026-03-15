const express = require('express')
const router = express.Router()

const contentController = require('../controllers/content.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')
const upload = require('../middlewares/upload.middleware')

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("content").fields([{ name: 'media', maxCount: 1 }, { name: 'media_thumbnail', maxCount: 1 },]), contentController.createContent)

router.get('/get', AuthVerifier, contentController.getContent)

router.get('/get/:id', AuthVerifier, contentController.getContentById)

router.patch('/update/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), contentController.updateContent)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), contentController.deleteContent)

module.exports = router