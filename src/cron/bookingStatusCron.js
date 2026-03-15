const cron = require('node-cron');
const Booking = require('../models/booking.model');
const Slot = require('../models/slot.model');
const { sendBookingStatusChangeNotifications } = require('../helpers/bookingNotification');

/**
 * Cron Job: Update Booking Status Based on Date/Time
 *
 * Logic:
 * 1. If booking session has ended → booking_status = 'past' (handles both 'upcoming' and 'in_progress')
 * 2. If booking is approved and session has started (but not ended) → booking_status = 'in_progress'
 *
 * Status values:
 * - status: pending, approved, requested, rejected, cancelled
 * - booking_status: upcoming, in_progress, past
 *
 * Note: All time comparisons use UTC to avoid timezone issues across different server environments
 *
 * Runs every minute
 */

const updateBookingStatuses = async () => {
    try {
        const now = new Date();
        console.log(`[CRON] Running booking status update at ${now.toISOString()}`);

        // Find all approved bookings that are not past
        const bookings = await Booking.find({
            status: 'approved',
            booking_status: { $ne: 'past' },
            deleted: false,
        }).populate('slot_id');

        let updatedToInProgress = 0;
        let updatedToPast = 0;

        for (const booking of bookings) {
            try {
                // Check if slot_id exists
                if (!booking.slot_id) {
                    console.error(`[CRON] ❌ Booking ${booking.booking_id} has no slot_id`);
                    continue;
                }

                // Get slot start and end times
                const slotStartTime = booking.slot_id.start_time; // e.g., "09:00"
                const slotEndTime = booking.slot_id.end_time;     // e.g., "10:00"

                // Parse session date - MongoDB stores dates in UTC
                const sessionDate = new Date(booking.session_date);

                // Extract UTC date components to avoid timezone issues
                const year = sessionDate.getUTCFullYear();
                const month = sessionDate.getUTCMonth();
                const day = sessionDate.getUTCDate();

                // Create session start datetime using slot start_time in UTC
                const [startHours, startMinutes] = slotStartTime.split(':').map(Number);
                const sessionStart = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));

                // Create session end datetime using slot end_time in UTC
                const [endHours, endMinutes] = slotEndTime.split(':').map(Number);
                const sessionEnd = new Date(Date.UTC(year, month, day, endHours, endMinutes, 0, 0));
                console.log(sessionStart, 'sessionStart');
                console.log(sessionEnd, 'sessionEnd');

                // Check if session has ended (handle both 'in_progress' and 'upcoming' that have already ended)
                if (now > sessionEnd) {
                    // Session has ended - mark as past regardless of current booking_status
                    if (booking.booking_status !== 'past') {
                        booking.booking_status = 'past';
                        await booking.save();

                        // Populate for notifications
                        await booking.populate([
                            { path: 'user_id', select: 'first_name last_name email' },
                            { path: 'provider_id', select: 'first_name last_name email' },
                            { path: 'service_id', select: 'name' },
                        ]);

                        // Send notifications
                        sendBookingStatusChangeNotifications(booking, 'past');

                        updatedToPast++;
                        console.log(`[CRON] ✅ Booking ${booking.booking_id} → past (session ended at ${sessionEnd.toISOString()})`);
                    }
                }
                // Check if session has started (only if not already ended)
                else if (now >= sessionStart && booking.booking_status === 'upcoming') {
                    booking.booking_status = 'in_progress';
                    await booking.save();

                    // Populate for notifications
                    await booking.populate([
                        { path: 'user_id', select: 'first_name last_name email' },
                        { path: 'provider_id', select: 'first_name last_name email' },
                        { path: 'service_id', select: 'name' },
                    ]);

                    // Send notifications
                    sendBookingStatusChangeNotifications(booking, 'in_progress');

                    updatedToInProgress++;
                    console.log(`[CRON] ✅ Booking ${booking.booking_id} → in_progress (session started at ${sessionStart.toISOString()})`);
                }

            } catch (error) {
                console.error(`[CRON] ❌ Error updating booking ${booking.booking_id}:`, error.message);
            }
        }

        console.log(`[CRON] Summary: ${updatedToInProgress} → in_progress, ${updatedToPast} → past`);

    } catch (error) {
        console.error('[CRON] ❌ Error in booking status cron job:', error);
    }
};

/**
 * Start the cron job
 */
const startBookingStatusCron = () => {
    // Run every minute
    cron.schedule('* * * * *', updateBookingStatuses);

    console.log('✅ Booking status cron job started (runs every minute)');

    // Run immediately on startup
    updateBookingStatuses();
};

module.exports = {
    startBookingStatusCron,
    updateBookingStatuses, // Export for manual testing
};

