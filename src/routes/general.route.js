const express = require('express')
const router = express.Router()

const generalController = require('../controllers/general.controller')
const upload = require('../middlewares/upload.middleware')

router.post('/upload-image', upload("images").single("image"), generalController.upload)

router.post('/upload-quiz-media', upload("quiz").single("media"), generalController.upload)

router.post('/upload-document', upload("documents").single("document"), generalController.upload)

router.post('/upload-chat-media', upload("chat").single("media"), generalController.upload)

router.get('/get-data', generalController.getData)

router.get('/get-content', generalController.getContent)

module.exports = router