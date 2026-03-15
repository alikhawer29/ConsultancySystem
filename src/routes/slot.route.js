const express = require('express');
const router = express.Router();

const slotController = require('../controllers/slot.controller');
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils');

// ============================
// Admin Routes (Create, Update, Delete)
// ============================

// Create Slots (Admin Only) - Supports multiple days and times
router.post(
    '/create',
    AuthVerifier,
    // RestrictAccess([ROLES.ADMIN]),
    slotController.createSlot
);

// Update Slot (Admin Only)
router.patch(
    '/update',
    AuthVerifier,
    // RestrictAccess([ROLES.ADMIN]),
    slotController.updateSlot
);

// Delete Slot (Admin Only)
router.delete(
    '/delete/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    slotController.deleteSlot
);

// Toggle Slot Status (Admin Only)
router.patch(
    '/toggle-status/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    slotController.toggleSlotStatus
);

// ============================
// Public/User Routes (View Only)
// ============================

// Get All Slots
router.get(
    '/get',
    OptionalAuthVerifier,
    slotController.getSlots
);

// Get Slot by ID
router.get(
    '/get/:id',
    OptionalAuthVerifier,
    slotController.getSlotById
);

// Get Slots by Day
router.get(
    '/day/:day',
    OptionalAuthVerifier,
    slotController.getSlotsByDay
);

// Get Weekly Schedule
router.get(
    '/weekly-schedule',
    OptionalAuthVerifier,
    slotController.getWeeklySchedule
);

// Get Slots by Date
router.get(
    '/date/:date',
    OptionalAuthVerifier,
    slotController.getSlotsByDate
);

module.exports = router;

