const moment = require('moment-timezone');

/**
 * Timezone Utility Helper
 * Handles conversion between local timezones and UTC
 */

// Default timezone from environment variable, fallback to UTC for global apps
// Set DEFAULT_TIMEZONE in your .env file (e.g., DEFAULT_TIMEZONE=Asia/Karachi)
const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'UTC';

/**
 * Get timezone from request header or user profile
 * @param {Object} req - Express request object
 * @param {Object} user - User object (optional, from database)
 * @returns {String} IANA timezone string (e.g., 'Asia/Karachi', 'America/New_York', 'UTC')
 * 
 * Priority:
 * 1. User profile timezone (user.timezone from database) - Most reliable
 * 2. Request header (X-Timezone or timezone) - If frontend sends it
 * 3. Default timezone (from .env or UTC) - Fallback
 * 
 * Note: Frontend needs to send timezone header if you want to override user's profile timezone
 * Example header: X-Timezone: America/New_York
 */
const getUserTimezone = (req, user = null) => {
    // Priority: 1. User profile (from DB), 2. Request header (if frontend sends), 3. Default
    const timezone =
        user?.timezone ||
        req?.headers?.['x-timezone'] ||
        req?.headers?.['timezone'] ||
        DEFAULT_TIMEZONE;

    // Validate timezone
    try {
        moment.tz.zone(timezone);
        return timezone;
    } catch (error) {
        console.warn(`Invalid timezone: ${timezone}, using default: ${DEFAULT_TIMEZONE}`);
        return DEFAULT_TIMEZONE;
    }
};

/**
 * Convert a time string from user's timezone to UTC
 * @param {String} timeStr - Time string in format "HH:mm" (e.g., "16:00")
 * @param {String} timezone - IANA timezone string (e.g., 'Asia/Karachi')
 * @param {Date} date - Date object for reference (defaults to today)
 * @returns {String} Time string in UTC format "HH:mm"
 */
const convertTimeToUTC = (timeStr, timezone, date = new Date()) => {
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);

        // Create a moment in the user's timezone with the given time
        const localMoment = moment.tz(date, timezone)
            .hour(hours)
            .minute(minutes || 0)
            .second(0)
            .millisecond(0);

        // Convert to UTC
        const utcMoment = localMoment.utc();

        // Return in HH:mm format
        return utcMoment.format('HH:mm');
    } catch (error) {
        console.error(`Error converting time to UTC: ${error.message}`);
        return timeStr; // Return original if conversion fails
    }
};

/**
 * Convert a time string from UTC to user's timezone
 * @param {String} utcTimeStr - Time string in UTC format "HH:mm" (e.g., "11:00")
 * @param {String} timezone - IANA timezone string (e.g., 'Asia/Karachi')
 * @param {Date} date - Date object for reference (defaults to today)
 * @returns {String} Time string in user's timezone format "HH:mm"
 */
const convertTimeFromUTC = (utcTimeStr, timezone, date = new Date()) => {
    try {
        const [hours, minutes] = utcTimeStr.split(':').map(Number);

        // Create a moment in UTC with the given time
        const utcMoment = moment.utc(date)
            .hour(hours)
            .minute(minutes || 0)
            .second(0)
            .millisecond(0);

        // Convert to user's timezone
        const localMoment = utcMoment.tz(timezone);

        // Return in HH:mm format
        return localMoment.format('HH:mm');
    } catch (error) {
        console.error(`Error converting time from UTC: ${error.message}`);
        return utcTimeStr; // Return original if conversion fails
    }
};

/**
 * Format time in 12-hour format with AM/PM
 * @param {String} timeStr - Time string in format "HH:mm"
 * @returns {String} Formatted time (e.g., "4:00 AM")
 */
const formatTime12Hour = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
};

/**
 * Convert slot times in an object from UTC to user's timezone
 * @param {Object} slot - Slot object with start_time and end_time
 * @param {String} timezone - IANA timezone string
 * @param {Date} date - Date object for reference (defaults to today)
 * @returns {Object} Slot object with converted times and virtual fields
 */
const convertSlotTimesFromUTC = (slot, timezone, date = new Date()) => {
    if (!slot) return slot;

    const converted = { ...slot };

    if (slot.start_time) {
        converted.start_time = convertTimeFromUTC(slot.start_time, timezone, date);
    }

    if (slot.end_time) {
        converted.end_time = convertTimeFromUTC(slot.end_time, timezone, date);
    }

    // Update virtual fields with converted times
    if (converted.start_time && converted.end_time) {
        converted.time_range = `${converted.start_time} - ${converted.end_time}`;
        converted.time_range_new = `${formatTime12Hour(converted.start_time)} - ${formatTime12Hour(converted.end_time)}`;
    }

    return converted;
};

/**
 * Convert slot times in an object from user's timezone to UTC
 * @param {Object} slot - Slot object with start_time and end_time
 * @param {String} timezone - IANA timezone string
 * @param {Date} date - Date object for reference (defaults to today)
 * @returns {Object} Slot object with converted times
 */
const convertSlotTimesToUTC = (slot, timezone, date = new Date()) => {
    if (!slot) return slot;

    const converted = { ...slot };

    if (slot.start_time) {
        converted.start_time = convertTimeToUTC(slot.start_time, timezone, date);
    }

    if (slot.end_time) {
        converted.end_time = convertTimeToUTC(slot.end_time, timezone, date);
    }

    return converted;
};

/**
 * Convert array of slots from UTC to user's timezone
 * @param {Array} slots - Array of slot objects
 * @param {String} timezone - IANA timezone string
 * @param {Date} date - Date object for reference (defaults to today)
 * @returns {Array} Array of slots with converted times
 */
const convertSlotsArrayFromUTC = (slots, timezone, date = new Date()) => {
    if (!Array.isArray(slots)) return slots;

    return slots.map(slot => {
        // Handle Mongoose documents
        const slotObj = slot.toObject ? slot.toObject({ virtuals: true }) : slot;
        return convertSlotTimesFromUTC(slotObj, timezone, date);
    });
};

module.exports = {
    getUserTimezone,
    convertTimeToUTC,
    convertTimeFromUTC,
    convertSlotTimesFromUTC,
    convertSlotTimesToUTC,
    convertSlotsArrayFromUTC,
    DEFAULT_TIMEZONE,
};

