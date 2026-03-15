const express = require('express');
const router = express.Router();

const reportController = require('../controllers/report.controller');
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const { ROLES } = require('../utils');

// Create Report for Service (with file attachments)
router.post(
    '/create',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    upload('reports').array('attachments', 5), // Max 5 files
    reportController.createReport
);

// Get All Reports (User sees their own, Admin sees all)
router.get(
    '/get',
    AuthVerifier,
    reportController.getReports
);

// Get Report by ID
router.get(
    '/get/:id',
    AuthVerifier,
    reportController.getReportById
);

// Update Report Status (Admin Only)
router.patch(
    '/update-status/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    reportController.updateReportStatus
);

// Delete Report
router.delete(
    '/delete/:id',
    AuthVerifier,
    reportController.deleteReport
);

// Get Report Statistics (Admin Only)
router.get(
    '/statistics',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    reportController.getReportStatistics
);

module.exports = router;

