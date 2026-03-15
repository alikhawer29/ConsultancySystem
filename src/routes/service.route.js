const express = require('express')
const router = express.Router()

const serviceController = require('../controllers/service.controller')
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../middlewares/auth.middleware')
const upload = require('../middlewares/upload.middleware')
const { ROLES } = require('../utils')

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("service").single("image"), serviceController.createService)

router.get('/get', OptionalAuthVerifier, serviceController.getService)

router.get('/get/:id', OptionalAuthVerifier, serviceController.getServiceById)

router.patch('/update/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), serviceController.updateService)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), serviceController.deleteService)

router.post('/favorite/:id', AuthVerifier, RestrictAccess([ROLES.USER]), serviceController.handleFavorite)


module.exports = router