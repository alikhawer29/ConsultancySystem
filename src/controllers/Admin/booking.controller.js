const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../../models/booking.model');
const Payment = require('../../models/payment.model');
const User = require('../../models/user.model');
const {
    ERRORS,
    objectValidator,
    paginationHandler,
    getSearchQuery,
    getDateRangeQuery,
    ROLES,
    normalize,
    paginateResponse
} = require('../../utils');
const getNextSequence = require('../../helpers/getNextSequence');
const ResponseHandler = require('../../utils/response');
const {
    sendBookingCreatedNotifications,
    sendBookingRejectedNotifications,
    sendBookingRescheduledNotifications,
    sendProviderAssignedNotifications,
    sendBookingCancelledNotifications,
    sendRescheduleResponseNotifications,
} = require('../../helpers/bookingNotification');

dotenv.config();


// ============================
// Get All Bookings (with filters)
// ============================
const getBookings = async (req, res) => {
    try {
        const { decoded, query } = req;
        const { page, per_page, search, from, to, sortBy, status, booking_status, is_requested } = query;

        const options = paginationHandler(page, per_page);
        let filter = {};
        let sort = { createdAt: -1 };

        // Status filter - always apply if provided
        if (status) {
            filter.status = status;
        }

        // is_requested filter: true = not approved (pending/rejected/cancelled), false = approved only
        // This only applies if status is not explicitly set
        if (is_requested !== undefined && !status) {
            if (is_requested === 'true') {
                filter.status = { $ne: 'approved' }; // Show all except approved
            } else {
                filter.status = 'approved'; // Show only approved
            }
        }

        // Filtering
        if (search) {
            filter = {
                ...filter,
                $or: [
                    { 'contact_details.first_name': getSearchQuery(search) },
                    { 'contact_details.last_name': getSearchQuery(search) },
                    { booking_id: getSearchQuery(search) },
                ],
            };
        }

        if (from || to) {
            filter = { ...filter, session_date: getDateRangeQuery(from, to) };
        }

        if (booking_status) {
            filter.booking_status = booking_status;
        }

        if (sortBy) {
            sort = { [sortBy]: 1 };
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "slots",
                    localField: "slot_id",
                    foreignField: "_id",
                    as: "slot",
                },
            },
            { $unwind: { path: "$slot", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    booking_id: 1,
                    user_first_name: "$user.first_name",
                    user_last_name: "$user.last_name",
                    user_phone: "$user.phone",
                    user_dialing_code: "$user.dialing_code",
                    session_date: 1,
                    slot: {
                        _id: "$slot._id",
                        day: "$slot.day",
                        start_time: "$slot.start_time",
                        end_time: "$slot.end_time"
                    },
                    booking_status: 1,
                    status: 1,
                    price_type: 1
                }
            },
            { $sort: sort },
        ];

        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const bookings = await Booking.aggregate(pipeline);
        const total = await Booking.countDocuments(filter);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: bookings
        });

        return ResponseHandler.success(res, "Bookings retrieved successfully", paginated);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Get Single Booking by ID
// ============================
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id)
            .populate([
                { path: "user_id", select: "first_name last_name email picture certifications" },
                { path: "service_id", select: "name price image" },
                { path: "category_id", select: "name" },
                { path: "provider_id", select: "first_name last_name email picture certifications dialing_code phone provider_lat provider_lng provider_address" },
                { path: "slot_id", select: "start_time end_time" },
            ])
            .lean({ virtuals: true });

        if (!booking) {
            throw new Error(ERRORS.NOT_FOUND);
        }

        // Get reviews for this booking with user details
        const Review = require('../../models/review.model');
        const reviews = await Review.find({ booking: id })
            .populate({ path: 'user', select: 'first_name last_name email picture' })
            .select('rating review createdAt')
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });

        // Check if this booking has been reported
        const Report = require('../../models/report.model');
        const reportExists = await Report.findOne({
            booking: id,
            deleted: false
        });

        // Check if booking is in progress
        // const now = new Date();
        // const bookingDate = new Date(booking.session_date);
        // const [startHour, startMin] = booking?.slot_id?.start_time.split(':');
        // const [endHour, endMin] = booking?.slot_id?.end_time.split(':');
        // const bookingStartTime = new Date(bookingDate);
        // bookingStartTime.setHours(parseInt(startHour), parseInt(startMin), 0);

        // const bookingEndTime = new Date(bookingDate);
        // bookingEndTime.setHours(parseInt(endHour), parseInt(endMin), 0);

        // // Update booking_status to 'in-progress' if current time is between start and end time
        // console.log(now, 'now', bookingStartTime, 'start', bookingEndTime, 'end', booking.booking_status, 'status');
        // if (now >= bookingStartTime && now <= bookingEndTime && booking.booking_status !== 'completed') {
        //     booking.booking_status = 'in_progress';
        // }

        // Add reviews and report flag to booking data
        booking.reviews = reviews;
        booking.is_reported = !!reportExists;
        booking.report_id = reportExists ? reportExists._id : null;

        return ResponseHandler.success(res, "Booking retrieved successfully", booking);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Update Booking
// ============================
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req;

        const booking = await Booking.findByIdAndUpdate(id, { $set: body }, { new: true });

        return ResponseHandler.success(res, "Booking Updated Successfully", booking);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Delete Booking (Soft Delete)
// ============================
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            throw new Error(ERRORS.NOT_FOUND);
        }

        await booking.trash();

        return ResponseHandler.success(res, "Booking Deleted Successfully");

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Assign Provider to Booking (Admin Only)
// ============================
const assignProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const { provider_id } = req.body;

        if (!provider_id) {
            throw new Error('Provider ID is required');
        }

        // Find booking
        const booking = await Booking.findById(id);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if booking is paid
        if (booking.payment_status !== 'paid') {
            throw new Error('Cannot assign provider to unpaid booking');
        }

        // Verify provider exists and has PROVIDER role
        const provider = await User.findById(provider_id);
        if (!provider) {
            throw new Error('Provider not found');
        }

        if (provider.role !== ROLES.PROVIDER) {
            throw new Error('Selected user is not a provider');
        }

        // Assign provider and update status
        booking.provider_id = provider_id;
        booking.status = 'approved';
        booking.booking_status = 'upcoming';

        await booking.save();

        await booking.populate([
            { path: 'user_id', select: 'first_name last_name email phone_number picture certifications' },
            { path: 'service_id', select: 'name price image' },
            { path: 'provider_id', select: 'first_name last_name email phone_number picture certifications' },
            { path: 'slot_id' },
        ]);

        // Send notifications
        sendProviderAssignedNotifications(booking);

        return ResponseHandler.success(res, "Provider Assigned Successfully", booking);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Get Appointment Requests (Pending Bookings - Admin)
// ============================
const getAppointmentRequests = async (req, res) => {
    try {
        const { query } = req;
        const { page, per_page, search, from, to, sortBy } = query;

        const options = paginationHandler(page, per_page);
        let filter = {
            payment_status: 'paid',
            status: 'pending', // Only pending bookings
        };
        let sort = { createdAt: -1 };

        // Filtering
        if (search) {
            filter = {
                ...filter,
                $or: [
                    { 'contact_details.first_name': getSearchQuery(search) },
                    { 'contact_details.last_name': getSearchQuery(search) },
                    { booking_id: getSearchQuery(search) },
                ],
            };
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
        }

        if (sortBy) {
            sort = { [sortBy]: 1 };
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "services",
                    localField: "service_id",
                    foreignField: "_id",
                    as: "service",
                },
            },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "slots",
                    localField: "slot_id",
                    foreignField: "_id",
                    as: "slot",
                },
            },
            { $unwind: { path: "$slot", preserveNullAndEmptyArrays: true } },
            { $sort: sort },
        ];

        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const bookings = await Booking.aggregate(pipeline);
        const total = await Booking.countDocuments(filter);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: bookings
        });

        return ResponseHandler.success(res, "Appointment Requests", paginated);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Get Appointment Management (Approved/Assigned Bookings - Admin)
// ============================
const getAppointmentManagement = async (req, res) => {
    try {
        const { query } = req;
        const { page, per_page, search, from, to, sortBy, booking_status } = query;

        const options = paginationHandler(page, per_page);
        let filter = {
            payment_status: 'paid',
            status: 'approved', // Only approved bookings
        };
        let sort = { createdAt: -1 };

        // Filtering
        if (search) {
            filter = {
                ...filter,
                $or: [
                    { 'contact_details.first_name': getSearchQuery(search) },
                    { 'contact_details.last_name': getSearchQuery(search) },
                    { booking_id: getSearchQuery(search) },
                ],
            };
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
        }

        if (booking_status) {
            filter.booking_status = booking_status; // upcoming, in_progress, completed
        }

        if (sortBy) {
            sort = { [sortBy]: 1 };
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "services",
                    localField: "service_id",
                    foreignField: "_id",
                    as: "service",
                },
            },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "provider_id",
                    foreignField: "_id",
                    as: "provider",
                },
            },
            { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "slots",
                    localField: "slot_id",
                    foreignField: "_id",
                    as: "slot",
                },
            },
            { $unwind: { path: "$slot", preserveNullAndEmptyArrays: true } },
            { $sort: sort },
        ];

        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const bookings = await Booking.aggregate(pipeline);
        const total = await Booking.countDocuments(filter);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: bookings
        });

        return ResponseHandler.success(res, "Appointment Management", paginated);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Reject Booking (Admin Only)
// ============================
const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        const booking = await Booking.findById(id)
            .populate('user_id', 'first_name last_name email')
            .populate('provider_id', 'first_name last_name email')
            .populate('service_id', 'name');

        if (!booking) {
            throw new Error('Booking not found');
        }

        booking.status = 'rejected';
        if (rejection_reason) {
            booking.notes = rejection_reason;
        }

        await booking.save();

        // Send notifications
        sendBookingRejectedNotifications(booking);

        return ResponseHandler.success(res, "Booking Rejected Successfully", booking);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};




// ============================
// Cancel Booking with Refund
// ============================
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;
        const { cancellation_reason } = req.body;

        // Find the booking
        const booking = await Booking.findById(id)
            .populate('user_id', 'first_name last_name email stripe_customer_id')
            .populate('provider_id', 'first_name last_name email')
            .populate('service_id', 'name');

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if user owns this booking or is admin
        if (booking.user_id._id.toString() !== decoded.id && decoded.role !== 'admin') {
            throw new Error('Unauthorized to cancel this booking');
        }

        // Check if booking can be cancelled
        if (booking.status === 'cancelled') {
            throw new Error('Booking is already cancelled');
        }

        if (booking.booking_status === 'past') {
            throw new Error('Cannot cancel a past booking');
        }

        // Check if payment exists and was paid
        if (!booking.payment_id) {
            throw new Error('No payment found for this booking');
        }

        const payment = await Payment.findById(booking.payment_id);

        if (!payment) {
            throw new Error('Payment record not found');
        }

        if (payment.payment_status !== 'succeeded') {
            throw new Error('Cannot refund unpaid booking');
        }

        // Calculate time difference between now and session date+time
        const sessionDateTime = new Date(`${booking.session_date.toISOString().split('T')[0]}T${booking.session_time}:00`);
        const now = new Date();
        const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);

        let refundAmount = 0;
        let providerCompensation = 0;
        let refundType = 'none';
        let refundPolicy = '';

        // Case 1: Less than 24 hours before event - 50% refund
        if (hoursUntilSession < 24 && hoursUntilSession > 0) {
            refundAmount = booking.price * 0.5;
            providerCompensation = booking.price * 0.5;
            refundType = 'partial';
            refundPolicy = 'Less than 24 hours before session - 50% refund to user, 50% to provider';
        }
        // Case 2: More than 24 hours but less than 7 days - 100% refund
        else if (hoursUntilSession >= 24 && hoursUntilSession < (7 * 24)) {
            refundAmount = booking.price;
            providerCompensation = 0;
            refundType = 'full';
            refundPolicy = 'More than 24 hours before session - 100% refund to user';
        }
        // Case 3: More than 7 days - 100% refund
        else if (hoursUntilSession >= (7 * 24)) {
            refundAmount = booking.price;
            providerCompensation = 0;
            refundType = 'full';
            refundPolicy = 'More than 7 days before session - 100% refund to user';
        }
        // Case 4: Session already passed
        else {
            throw new Error('Cannot cancel booking - session time has already passed');
        }

        // Process refund through Stripe
        const { createRefund, transferToAdmin } = require('../helpers/stripe');

        let stripeRefund = null;
        if (refundAmount > 0) {
            // Stripe only accepts: 'duplicate', 'fraudulent', or 'requested_by_customer'
            stripeRefund = await createRefund(
                payment.stripe_payment_intent_id,
                refundAmount,
                'requested_by_customer'  // Always use this for user cancellations
            );
        }

        // Update payment record
        payment.payment_status = 'refunded';
        payment.refund_amount = refundAmount;
        payment.refund_status = refundType;
        payment.stripe_refund_id = stripeRefund?.id || null;
        payment.refund_reason = cancellation_reason || 'User requested cancellation';
        payment.refunded_at = new Date();
        payment.provider_compensation_amount = providerCompensation;
        payment.provider_compensation_status = providerCompensation > 0 ? 'pending' : 'none';
        await payment.save();

        // Update booking status
        booking.status = 'cancelled';
        booking.payment_status = 'refunded';
        booking.notes = `Cancelled: ${cancellation_reason || 'User requested cancellation'}. ${refundPolicy}`;
        await booking.save();

        // If provider compensation exists, transfer to admin account
        if (providerCompensation > 0) {
            await transferToAdmin(
                providerCompensation,
                `Provider compensation for cancelled booking ${booking.booking_id}`
            );
        }

        // Determine who cancelled (user or provider)
        const cancelledBy = decoded.role === ROLES.PROVIDER ? 'provider' : 'user';

        // Send comprehensive notifications with refund info
        sendBookingCancelledNotifications(
            booking,
            cancelledBy,
            cancellation_reason || 'User requested cancellation',
            {
                refundAmount,
                refundType,
                providerCompensation,
            }
        );

        return ResponseHandler.success(res, "Booking cancelled successfully", {
            booking_id: booking._id,
            booking_number: booking.booking_id,
            status: booking.status,
            refund_policy: refundPolicy,
            refund_amount: refundAmount,
            refund_type: refundType,
            provider_compensation: providerCompensation,
            hours_until_session: hoursUntilSession.toFixed(2),
            stripe_refund_id: stripeRefund?.id || null,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Reschedule Booking (Admin Only)
// ============================
const rescheduleBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;
        const { proposed_session_date, proposed_session_time, proposed_slot_id, reschedule_reason } = req.body;

        // Validate required fields
        if (!proposed_session_date || !proposed_session_time) {
            throw new Error('Proposed session date and time are required');
        }

        // Find the booking
        const booking = await Booking.findById(id)
            .populate('user_id', 'first_name last_name email')
            .populate('provider_id', 'first_name last_name email');

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if booking can be rescheduled
        if (booking.status === 'cancelled') {
            throw new Error('Cannot reschedule a cancelled booking');
        }

        if (booking.booking_status === 'past') {
            throw new Error('Cannot reschedule a past booking');
        }

        if (booking.reschedule_requested && booking.reschedule_response === 'pending') {
            throw new Error('Booking already has a pending reschedule request');
        }

        // Validate proposed slot if provided
        if (proposed_slot_id) {
            const Slot = require('../../models/slot.model');
            const slot = await Slot.findById(proposed_slot_id);

            if (!slot) {
                throw new Error('Proposed slot not found');
            }

            if (slot.is_booked) {
                throw new Error('Proposed slot is already booked');
            }
        }

        // Store original values for notification
        const originalDate = booking.session_date;
        const originalTime = booking.session_time;

        // Update booking with proposed reschedule details (keep status as approved)
        booking.reschedule_requested = true;
        booking.proposed_session_date = new Date(proposed_session_date);
        booking.proposed_session_time = proposed_session_time;
        booking.proposed_slot_id = proposed_slot_id || null;
        booking.reschedule_reason = reschedule_reason || 'Admin requested reschedule';
        booking.reschedule_response = 'pending';
        booking.notes = `Reschedule requested by admin. Original: ${originalDate.toISOString().split('T')[0]} ${originalTime}. Proposed: ${proposed_session_date} ${proposed_session_time}`;

        await booking.save();

        // Send comprehensive reschedule notifications
        sendBookingRescheduledNotifications(booking);

        return ResponseHandler.success(res, "Booking reschedule request sent to user", {
            booking_id: booking._id,
            booking_number: booking.booking_id,
            status: booking.status,
            original_session_date: originalDate,
            original_session_time: originalTime,
            proposed_session_date: booking.proposed_session_date,
            proposed_session_time: booking.proposed_session_time,
            reschedule_reason: booking.reschedule_reason,
            reschedule_response: booking.reschedule_response,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Get Providers (Admin Only)
// ============================
const getProviders = async (req, res) => {
    try {
        const { query } = req;
        const { booking_category, search } = query;

        let filter = { role: 'provider' };

        // Filter by booking_category (normal or premium)
        if (booking_category) {
            if (!['normal', 'premium'].includes(booking_category)) {
                return ResponseHandler.error(res, "booking_category must be 'normal' or 'premium'", 400);
            }
            filter.booking_category = booking_category;
        }

        // Search by name or email
        if (search) {
            filter.$or = [
                { first_name: getSearchQuery(search) },
                { last_name: getSearchQuery(search) },
                { email: getSearchQuery(search) }
            ];
        }

        // Fetch all providers (no pagination)
        const providers = await User.find(filter, {
            first_name: 1,
            last_name: 1,
            email: 1,
            phone: 1,
            dialing_code: 1,
            picture: 1,
            booking_category: 1,
            provider_services: 1,
            is_verified: 1,
            active: 1,
            createdAt: 1
        })
            .sort({ createdAt: -1 })
            .lean();

        // Map providers to include full image URL
        const providersWithImageUrl = providers.map(provider => ({
            ...provider,
            image_url: provider.picture
                ? (provider.picture.startsWith('http')
                    ? provider.picture
                    : `${process.env.BASE_URL}${provider.picture}`)
                : `${process.env.BASE_URL}uploads/user/dummy.jpg`
        }));

        return ResponseHandler.success(res, "Providers retrieved successfully", providersWithImageUrl);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


module.exports = {
    getBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    assignProvider,
    getAppointmentRequests,
    getAppointmentManagement,
    rejectBooking,
    cancelBooking,
    rescheduleBooking,
    getProviders,
};
