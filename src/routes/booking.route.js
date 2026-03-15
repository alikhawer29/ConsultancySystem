const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/booking.controller');
const paymentController = require('../controllers/payment.controller');
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils');

// Create Booking
router.post(
    '/create',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]), // users or admins can create bookings
    bookingController.createBooking
);

// Get All Bookings (with filters)
router.get(
    '/get',
    OptionalAuthVerifier,
    bookingController.getBookings
);

// Get Booking by ID
router.get(
    '/get/:id',
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

// User Response to Reschedule (Approve/Reject)
router.post(
    '/reschedule-response/:id',
    AuthVerifier,
    RestrictAccess([ROLES.USER]),
    bookingController.respondToReschedule
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

// Create Payment Intent for Booking
router.post(
    '/payment/create',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    paymentController.createBookingPayment
);

// Get Payment by ID
router.get(
    '/payment/:id',
    AuthVerifier,
    paymentController.getPaymentById
);

// Update Payment Status
router.post(
    '/payment/update/:id',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    paymentController.updatePaymentStatus
);

// Get All Payments (Admin only)
router.get(
    '/payments/all',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    paymentController.getAllPayments
);

module.exports = router;
