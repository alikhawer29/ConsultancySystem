const express = require('express');
const router = express.Router();

const bookingController = require('../../controllers/Admin/booking.controller');
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../../middlewares/auth.middleware');
const { ROLES } = require('../../utils');


// Get All Bookings (with filters)
router.get(
    '/',
    OptionalAuthVerifier,
    bookingController.getBookings
);

// Get Providers (Admin Only) - MUST be before /:id route
router.get(
    '/providers',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.getProviders
);

// Get Booking by ID
router.get(
    '/:id',
    OptionalAuthVerifier,
    bookingController.getBookingById
);

// Update Booking
router.patch(
    '/update/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN, ROLES.USER]), // both admin and user can update their booking
    bookingController.updateBooking
);

// Delete Booking (soft delete)
router.delete(
    '/delete/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.deleteBooking
);

// Cancel Booking with Refund (User or Admin)
router.post(
    '/cancel/:id',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    bookingController.cancelBooking
);

// Reschedule Booking (Admin Only)
router.post(
    '/reschedule/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.rescheduleBooking
);

// ============================
// Admin Appointment Management Routes
// ============================

// Assign Provider to Booking (Admin Only)
router.post(
    '/assign-provider/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.assignProvider
);

// Reject Booking (Admin Only)
router.post(
    '/reject/:id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.rejectBooking
);

// Get Appointment Requests (Pending Bookings - Admin Only)
router.get(
    '/appointment-requests',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.getAppointmentRequests
);

// Get Appointment Management (Approved Bookings - Admin Only)
router.get(
    '/appointment-management',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    bookingController.getAppointmentManagement
);

// ============================
// Payment Routes
// ============================


module.exports = router;
