const express = require('express')
const router = express.Router()

const categoryController = require('../controllers/category.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), categoryController.createCategory)

router.get('/get', AuthVerifier, categoryController.getCategory)

router.get('/get-all-active', AuthVerifier, categoryController.getAllActiveCategories)

router.get('/get/:id', AuthVerifier, categoryController.getCategoryById)

router.patch('/update/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), categoryController.updateCategory)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), categoryController.deleteCategory)

module.exports = router