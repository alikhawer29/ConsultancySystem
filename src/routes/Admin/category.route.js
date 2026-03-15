const express = require('express')
const router = express.Router()

const categoryController = require('../../controllers/Admin/category.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')
const upload = require('../../middlewares/upload.middleware')

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("service").single("image"), categoryController.createCategory)

router.get('/', AuthVerifier, categoryController.getCategory)

router.get('/:id', AuthVerifier, categoryController.getCategoryById)

router.patch('/update/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("service").single("image"), categoryController.updateCategory)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), categoryController.deleteCategory)

module.exports = router