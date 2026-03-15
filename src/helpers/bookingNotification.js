const { sendNotification, sendBulkNotification } = require('./notification');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const { ROLES } = require('../utils');

/**
 * Booking Notification Helper
 * Handles all booking-related notifications
 * - Mobile notifications via Firebase (for users and providers)
 * - Database notifications (for admin using web)
 */

/**
 * Helper to send database notification to all admins
 */
const sendAdminDatabaseNotification = async (notification) => {
    try {
        const admins = await User.find({ role: ROLES.ADMIN });
        const adminIds = admins.map(admin => admin._id);

        if (adminIds.length > 0) {
            const dbNotification = new Notification({
                notification,
                recipients: adminIds,
            });
            await dbNotification.save();
            console.log(`Database notification saved for ${adminIds.length} admins`);
        }
    } catch (error) {
        console.error('Error sending admin database notification:', error);
    }
};

// ============================
// 1️⃣ User Books Appointment
// ============================
const sendBookingCreatedNotifications = async (booking) => {
    try {
        const user = booking.user_id;
        const service = booking.service_id;
        const sessionDate = new Date(booking.session_date).toLocaleDateString();
        const sessionTime = booking.session_time;

        // To User: Confirmation
        await sendNotification(
            {
                title: 'Appointment Request Submitted',
                body: `Your appointment request for ${service.name} on ${sessionDate} at ${sessionTime} has been received and is pending approval.`,
                data: {
                    type: 'booking_created',
                    booking_id: booking._id.toString(),
                    status: 'pending',
                },
            },
            user._id,
            true
        );

        // To Admin: New Request (Database notification for web)
        await sendAdminDatabaseNotification({
            title: 'New Appointment Request',
            body: `${user.first_name} ${user.last_name} requested ${service.name} on ${sessionDate} at ${sessionTime}.`,
            data: {
                type: 'new_booking_request',
                booking_id: booking._id.toString(),
                user_id: user._id.toString(),
                status: 'pending',
            },
        });

        console.log(`Booking created notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending booking created notifications:', error);
    }
};

// ============================
// 2️⃣ Admin Rejects Appointment
// ============================
const sendBookingRejectedNotifications = async (booking) => {
    try {
        const user = booking.user_id;
        const service = booking.service_id;
        const sessionDate = new Date(booking.session_date).toLocaleDateString();
        const sessionTime = booking.session_time;

        // To User: Rejection Notice
        await sendNotification(
            {
                title: 'Appointment Rejected',
                body: `Your appointment for ${service.name} on ${sessionDate} at ${sessionTime} has been rejected.`,
                data: {
                    type: 'booking_rejected',
                    booking_id: booking._id.toString(),
                    status: 'rejected',
                },
            },
            user._id,
            true
        );

        // To Provider (if already assigned): Cancellation Notice
        if (booking.provider_id) {
            await sendNotification(
                {
                    title: 'Appointment Cancelled by Admin',
                    body: `The appointment for ${service.name} on ${sessionDate} at ${sessionTime} has been cancelled by admin.`,
                    data: {
                        type: 'booking_cancelled_by_admin',
                        booking_id: booking._id.toString(),
                        status: 'rejected',
                    },
                },
                booking.provider_id._id,
                true
            );
        }

        console.log(`Booking rejected notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending booking rejected notifications:', error);
    }
};

// ============================
// 3️⃣ Admin Reschedules Appointment
// ============================
const sendBookingRescheduledNotifications = async (booking) => {
    try {
        const user = booking.user_id;
        const provider = booking.provider_id;
        const service = booking.service_id;
        const newDate = new Date(booking.proposed_session_date).toLocaleDateString();
        const newTime = booking.proposed_session_time;

        // To User: Reschedule Request
        await sendNotification(
            {
                title: 'Appointment Rescheduled',
                body: `Your appointment for ${service.name} has been rescheduled to ${newDate} at ${newTime}. Please review and confirm.`,
                data: {
                    type: 'booking_rescheduled',
                    booking_id: booking._id.toString(),
                    new_date: booking.proposed_session_date,
                    new_time: booking.proposed_session_time,
                    status: 'reschedule_pending',
                },
            },
            user._id,
            true
        );

        // To Provider: Reschedule Notice
        if (provider) {
            await sendNotification(
                {
                    title: 'Appointment Rescheduled',
                    body: `Your assigned appointment for ${service.name} has been rescheduled to ${newDate} at ${newTime}.`,
                    data: {
                        type: 'booking_rescheduled',
                        booking_id: booking._id.toString(),
                        new_date: booking.proposed_session_date,
                        new_time: booking.proposed_session_time,
                    },
                },
                provider._id,
                true
            );
        }

        console.log(`Booking rescheduled notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending booking rescheduled notifications:', error);
    }
};

// ============================
// 4️⃣ Admin Assigns Provider
// ============================
const sendProviderAssignedNotifications = async (booking) => {
    try {
        const user = booking.user_id;
        const provider = booking.provider_id;
        const service = booking.service_id;
        const sessionDate = new Date(booking.session_date).toLocaleDateString();
        const sessionTime = booking.session_time;

        // To Provider: New Assignment
        await sendNotification(
            {
                title: 'New Appointment Assigned to You',
                body: `You have been assigned an appointment for ${service.name} with ${user.first_name} ${user.last_name} on ${sessionDate} at ${sessionTime}.`,
                data: {
                    type: 'provider_assigned',
                    booking_id: booking._id.toString(),
                    customer_name: `${user.first_name} ${user.last_name}`,
                    service_name: service.name,
                    session_date: booking.session_date,
                    session_time: booking.session_time,
                },
            },
            provider._id,
            true
        );

        // To User: Provider Assigned (Optional)
        await sendNotification(
            {
                title: 'Provider Assigned',
                body: `Your appointment for ${service.name} has been approved and assigned to ${provider.first_name} ${provider.last_name}.`,
                data: {
                    type: 'booking_approved',
                    booking_id: booking._id.toString(),
                    provider_name: `${provider.first_name} ${provider.last_name}`,
                    status: 'approved',
                },
            },
            user._id,
            true
        );

        console.log(`Provider assigned notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending provider assigned notifications:', error);
    }
};

// ============================
// 5️⃣ Provider/User Cancels Appointment with Refund
// ============================
const sendBookingCancelledNotifications = async (booking, cancelledBy, reason = '', refundInfo = {}) => {
    try {
        const user = booking.user_id;
        const provider = booking.provider_id;
        const service = booking.service_id;
        const sessionDate = new Date(booking.session_date).toLocaleDateString();
        const sessionTime = booking.session_time;

        const { refundAmount = 0, refundType = '', providerCompensation = 0 } = refundInfo;

        if (cancelledBy === 'provider') {
            // To User: Provider Cancelled with Refund Info
            await sendNotification(
                {
                    title: 'Appointment Cancelled by Provider',
                    body: `Your appointment for ${service.name} on ${sessionDate} at ${sessionTime} has been cancelled by the provider.${refundAmount > 0 ? ` Refund: $${refundAmount.toFixed(2)}` : ''}${reason ? ` Reason: ${reason}` : ''}`,
                    data: {
                        type: 'booking_cancelled_by_provider',
                        booking_id: booking._id.toString(),
                        reason: reason,
                        status: 'cancelled',
                        refund_amount: refundAmount,
                        refund_type: refundType,
                    },
                },
                user._id,
                true
            );

            // To Admin: Provider Cancelled (Database notification for web)
            await sendAdminDatabaseNotification({
                title: 'Provider Cancelled Appointment',
                body: `${provider.first_name} ${provider.last_name} cancelled appointment for ${service.name} on ${sessionDate}. Please reassign or reschedule.`,
                data: {
                    type: 'provider_cancelled_booking',
                    booking_id: booking._id.toString(),
                    provider_id: provider._id.toString(),
                    reason: reason,
                    status: 'cancelled',
                },
            });
        } else if (cancelledBy === 'user') {
            // To User: Cancellation Confirmation with Refund Info
            await sendNotification(
                {
                    title: 'Appointment Cancelled',
                    body: `Your appointment for ${service.name} has been cancelled.${refundAmount > 0 ? ` Refund: $${refundAmount.toFixed(2)} (${refundType})` : ''}`,
                    data: {
                        type: 'booking_cancelled',
                        booking_id: booking._id.toString(),
                        status: 'cancelled',
                        refund_amount: refundAmount,
                        refund_type: refundType,
                    },
                },
                user._id,
                true
            );

            // To Provider: User Cancelled with Compensation Info
            if (provider) {
                await sendNotification(
                    {
                        title: 'Appointment Cancelled by Customer',
                        body: `The appointment for ${service.name} on ${sessionDate} at ${sessionTime} has been cancelled by the customer.${providerCompensation > 0 ? ` Compensation: $${providerCompensation.toFixed(2)}` : ''}${reason ? ` Reason: ${reason}` : ''}`,
                        data: {
                            type: 'booking_cancelled_by_user',
                            booking_id: booking._id.toString(),
                            reason: reason,
                            status: 'cancelled',
                            compensation: providerCompensation,
                        },
                    },
                    provider._id,
                    true
                );
            }

            // To Admin: User Cancelled (Database notification for web)
            await sendAdminDatabaseNotification({
                title: 'Appointment Cancelled by User',
                body: `${user.first_name} ${user.last_name} cancelled appointment for ${service.name} on ${sessionDate}. Refund: $${refundAmount.toFixed(2)}`,
                data: {
                    type: 'user_cancelled_booking',
                    booking_id: booking._id.toString(),
                    user_id: user._id.toString(),
                    reason: reason,
                    status: 'cancelled',
                    refund_amount: refundAmount,
                    refund_type: refundType,
                    provider_compensation: providerCompensation,
                },
            });
        }

        console.log(`Booking cancelled notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending booking cancelled notifications:', error);
    }
};

// ============================
// 6️⃣ User Approves/Rejects Reschedule
// ============================
const sendRescheduleResponseNotifications = async (booking, response) => {
    try {
        const user = booking.user_id;
        const provider = booking.provider_id;
        const service = booking.service_id;
        const sessionDate = new Date(booking.session_date).toLocaleDateString();
        const sessionTime = booking.session_time;

        if (response === 'approved') {
            // To Admin: Reschedule Approved (Database notification for web)
            await sendAdminDatabaseNotification({
                title: 'Reschedule Approved',
                body: `${user.first_name} ${user.last_name} approved the reschedule for ${service.name} to ${sessionDate} at ${sessionTime}.`,
                data: {
                    type: 'reschedule_approved',
                    booking_id: booking._id.toString(),
                    user_id: user._id.toString(),
                    status: 'rescheduled',
                },
            });

            // To Provider: Reschedule Approved
            if (provider) {
                await sendNotification(
                    {
                        title: 'Reschedule Confirmed',
                        body: `The rescheduled appointment for ${service.name} on ${sessionDate} at ${sessionTime} has been confirmed.`,
                        data: {
                            type: 'reschedule_approved',
                            booking_id: booking._id.toString(),
                            status: 'rescheduled',
                        },
                    },
                    provider._id,
                    true
                );
            }
        } else if (response === 'rejected') {
            // To Admin: Reschedule Rejected (Database notification for web)
            await sendAdminDatabaseNotification({
                title: 'Reschedule Rejected',
                body: `${user.first_name} ${user.last_name} rejected the reschedule for ${service.name}. Reason: ${booking.reschedule_rejection_reason || 'Not specified'}`,
                data: {
                    type: 'reschedule_rejected',
                    booking_id: booking._id.toString(),
                    user_id: user._id.toString(),
                    rejection_reason: booking.reschedule_rejection_reason,
                    status: 'approved',
                },
            });
        }

        console.log(`Reschedule response notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending reschedule response notifications:', error);
    }
};

// ============================
// 7️⃣ Booking Status Changes (Cron Job)
// ============================
const sendBookingStatusChangeNotifications = async (booking, newStatus) => {
    try {
        const user = booking.user_id;
        const provider = booking.provider_id;
        const service = booking.service_id;

        if (newStatus === 'in_progress') {
            // To User: Session Started
            await sendNotification(
                {
                    title: 'Your Appointment is In Progress',
                    body: `Your appointment for ${service.name} has started.`,
                    data: {
                        type: 'booking_in_progress',
                        booking_id: booking._id.toString(),
                        status: 'in_progress',
                    },
                },
                user._id,
                true
            );

            // To Provider: Session Started
            if (provider) {
                await sendNotification(
                    {
                        title: 'Appointment In Progress',
                        body: `Your appointment for ${service.name} is now in progress.`,
                        data: {
                            type: 'booking_in_progress',
                            booking_id: booking._id.toString(),
                            status: 'in_progress',
                        },
                    },
                    provider._id,
                    true
                );
            }
        } else if (newStatus === 'past') {
            // To User: Session Completed
            await sendNotification(
                {
                    title: 'Appointment Completed',
                    body: `Your appointment for ${service.name} has been completed. Please leave a review!`,
                    data: {
                        type: 'booking_completed',
                        booking_id: booking._id.toString(),
                        booking_status: 'past',
                    },
                },
                user._id,
                true
            );

            // To Provider: Session Completed
            if (provider) {
                await sendNotification(
                    {
                        title: 'Appointment Completed',
                        body: `Your appointment for ${service.name} has been completed.`,
                        data: {
                            type: 'booking_completed',
                            booking_id: booking._id.toString(),
                            booking_status: 'past',
                        },
                    },
                    provider._id,
                    true
                );
            }
        }

        console.log(`Booking status change notifications sent for booking ${booking.booking_id}`);
    } catch (error) {
        console.error('Error sending booking status change notifications:', error);
    }
};

// ============================
// 8️⃣ User Sends Feedback/Review to Admin
// ============================
const sendFeedbackToAdminNotification = async (feedbackData) => {
    try {
        const { user, booking, rating, review_text, type = 'review' } = feedbackData;

        // To Admin: New Feedback (Database notification for web)
        await sendAdminDatabaseNotification({
            title: type === 'review' ? 'New Review Submitted' : 'New Feedback Received',
            body: `${user.first_name} ${user.last_name} submitted a ${rating}-star ${type}${booking ? ` for booking #${booking.booking_id}` : ''}.`,
            data: {
                type: type === 'review' ? 'new_review' : 'new_feedback',
                user_id: user._id.toString(),
                booking_id: booking?._id?.toString() || null,
                rating: rating,
                review_text: review_text,
            },
        });

        console.log(`Feedback notification sent to admin from user ${user._id}`);
    } catch (error) {
        console.error('Error sending feedback notification:', error);
    }
};

// ============================
// 9️⃣ User Reports Booking to Admin
// ============================
const sendReportToAdminNotification = async (reportData) => {
    try {
        const { user, booking, report_reason, report_description } = reportData;

        // To Admin: New Report (Database notification for web)
        await sendAdminDatabaseNotification({
            title: 'New Booking Report',
            body: `${user.first_name} ${user.last_name} reported booking #${booking.booking_id}. Reason: ${report_reason}`,
            data: {
                type: 'booking_reported',
                user_id: user._id.toString(),
                booking_id: booking._id.toString(),
                report_reason: report_reason,
                report_description: report_description,
            },
        });

        console.log(`Report notification sent to admin from user ${user._id}`);
    } catch (error) {
        console.error('Error sending report notification:', error);
    }
};

module.exports = {
    sendBookingCreatedNotifications,
    sendBookingRejectedNotifications,
    sendBookingRescheduledNotifications,
    sendProviderAssignedNotifications,
    sendBookingCancelledNotifications,
    sendRescheduleResponseNotifications,
    sendBookingStatusChangeNotifications,
    sendFeedbackToAdminNotification,
    sendReportToAdminNotification,
};


