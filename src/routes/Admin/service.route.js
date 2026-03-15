const express = require('express')
const router = express.Router()

const serviceController = require('../../controllers/Admin/service.controller')
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')
const upload = require('../../middlewares/upload.middleware')


router.get('/', OptionalAuthVerifier, serviceController.getService)

router.get('/categories', serviceController.getActiveCategories)

router.get('/appointments', AuthVerifier, RestrictAccess([ROLES.ADMIN]), serviceController.getServiceAppointments)

router.get('/:id', OptionalAuthVerifier, serviceController.getServiceById)

router.post('/create', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("service").single("image"), serviceController.createService)

router.patch('/update/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), upload("service").single("image"), serviceController.updateService)

router.delete('/delete/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), serviceController.deleteService)

router.patch('/status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), serviceController.toggleServiceStatus)

module.exports = router