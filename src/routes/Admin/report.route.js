const express = require('express');
const router = express.Router();

const reportController = require('../../controllers/Admin/report.controller');
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../utils');


// Get All Reports (User sees their own, Admin sees all)
router.get(
    '/',
    AuthVerifier,
    reportController.getReports
);

// Get Report by ID
router.get(
    '/:id',
    AuthVerifier,
    reportController.getReportById
);

// Update Report Status (Admin Only)
router.post(
    '/update-status/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    reportController.updateReportStatus
);


module.exports = router;

