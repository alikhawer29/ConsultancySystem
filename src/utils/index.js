const path = require("path")

const MONTHS = [`January`, `February`, `March`, `April`, `May`, `June`, `July`, `August`, `September`, `October`, `November`, `December`]

const COMMISSION = 10

const ROLES = {
    USER: "user",
    PROVIDER: "provider",
    ADMIN: "admin"
}

const WORKING_TIME = {
    MORNING: "Morning (9AM - 12 AM)",
    AFTERNOON: "Afternoon (12PM - 3PM)",
    EVENING: "Evening (3PM - 6PM)"
}

const GENERAL_STATUS = {
    PENDING: "pending",
    REJECTED: "rejected",
    APPROVED: "approved",
}

const TASK_STATUS = {
    PENDING: "pending",
    INPROGRESS: "in-progress",
    COMPLETED: "completed",
}

// Booking Status Constants
const BOOKING_STATUS = {
    // Status: Overall booking state
    PENDING: "pending",
    APPROVED: "approved",
    REQUESTED: "requested",
    REJECTED: "rejected",
    CANCELLED: "cancelled",
}

const BOOKING_TIME_STATUS = {
    // Booking Status: Time-based state (managed by cron job)
    UPCOMING: "upcoming",
    IN_PROGRESS: "in_progress",
    PAST: "past",
}

const MESSAGE_STATUS = {
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read"
}

const CONTENT_TYPES = {
    ARTICLE: "article",
    VIDEO: "video",
}

const AUTH_TYPES = {
    EMAIL: "email",
    GOOGLE: "google",
    APPLE: "apple",
}

const MEDIA_TYPES = {
    VIDEO: "video",
    IMAGE: "image"
}

const PUSH_USER_TYPES = {
    ALL: "all",
    MANAGER: "manager",
    EMPLOYEE: "employee"
}

const ERRORS = {
    NULL_FIELD: "Fields cannot be empty or null",
    UNKNOWN_FIELD: "Unknown Field Error",
    REQUIRED_FIELD: "All Fields are Required",
    USER_NOTEXIST: "User doesn't exist",
    USER_EXIST: "User already exists",
    INVALID_CREDENTIALS: "Invalid Credentials",
    BLOCKEDBY_ADMIN: "You are blocked by Admin. Please contact admin",
    UNAUTHORIZED: "Access denied",
    SERVICE_NOTEXIST: "Service doesn't exist",
    CATEGORY_NOTEXIST: "Category doesn't exist"
}

const SLOTS = [
    {
        id: 1,
        label: "Morning (9AM - 12 PM)",
        from: "9:00",
        to: "12:00"
    },
    {
        id: 2,
        label: "Afternoon (12PM - 3PM)",
        from: "12:00",
        to: "15:00"
    },
    {
        id: 3,
        label: "Evening (3PM - 6PM)",
        from: "15:00",
        to: "18:00"
    },
]

const ENUM_ROLES = Object.values(ROLES)
const ENUM_WORKING_TIME = Object.values(WORKING_TIME)
const ENUM_BOOKING_STATUS = Object.values(BOOKING_STATUS)
const ENUM_GENERAL_STATUS = Object.values(GENERAL_STATUS)
const ENUM_TASK_STATUS = Object.values(TASK_STATUS)
const ENUM_MESSAGE_STATUS = Object.values(MESSAGE_STATUS)
const ENUM_CONTENT_TYPES = Object.values(CONTENT_TYPES)
const ENUM_AUTH_TYPES = Object.values(AUTH_TYPES)
const ENUM_MEDIA_TYPES = Object.values(MEDIA_TYPES)
const ENUM_PUSH_USER_TYPES = Object.values(PUSH_USER_TYPES)

const generateOTP = async () => {
    var digits = '0123456789'
    let OTP = ''
    for (let i = 0; i < 4; i++) {
        OTP += digits[Math.floor(Math.random() * 10)]
    }

    return OTP
}

const paginationHandler = (page, per_page) => {

    let paginationOptions = {}

    if (page && typeof page !== 'undefined' && per_page && typeof per_page !== 'undefined') {

        const pageNumber = parseInt(page);
        const limit = parseInt(per_page);
        const skip = (pageNumber - 1) * limit;

        paginationOptions = { limit, skip }

    }

    return paginationOptions

}

function paginateResponse({ page, per_page, total, baseUrl, data, earnings = null }) {

    page = Number(page);
    per_page = Number(per_page);
    const last_page = Math.ceil(total / per_page);

    // Build links array (Laravel style)
    let links = [];

    // Previous Link
    links.push({
        url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        label: "&laquo; Previous",
        active: false
    });

    // Page number links
    for (let i = 1; i <= last_page && i <= 10; i++) {
        links.push({
            url: `${baseUrl}?page=${i}`,
            label: `${i}`,
            active: i === page
        });
    }

    // Next Link
    links.push({
        url: page < last_page ? `${baseUrl}?page=${page + 1}` : null,
        label: "Next &raquo;",
        active: false
    });

    return {
        current_page: page,
        data,
        first_page_url: `${baseUrl}?page=1`,
        from: (page - 1) * per_page + 1,
        last_page,
        last_page_url: `${baseUrl}?page=${last_page}`,
        links,
        next_page_url: page < last_page ? `${baseUrl}?page=${page + 1}` : null,
        path: baseUrl,
        per_page,
        prev_page_url: page > 1 ? `${baseUrl}?page=${page - 1}` : null,
        to: (page - 1) * per_page + data.length,
        total,
        earnings
    };
}



const objectValidator = (object) => {

    if (object) {

        let result = Object.entries(object).map(item => {
            if ((typeof item[1] !== 'boolean' && !item[1]) || item[1] === null || item[1] === undefined) {
                return false
            } else {
                return true
            }
        })

        return !result.includes(false)

    }

    return false

}

const getMonths = (year, month) => {

    let months = MONTHS.slice(0, month)

    return months.map(item => `${item} ${year.toString().slice(2)}`)
}

const getMinMax = (arr) => {

    let min = arr[0]
    let max = arr[0]

    for (let i = 0; i < arr.length; i++) {
        if (min > arr[i]) {
            min = arr[i]
        }

        if (max < arr[i]) {
            max = arr[i]
        }
    }

    return { min, max }

}

const getSearchQuery = (value) => ({ "$regex": value, "$options": "i" })

const getDateRangeQuery = (from, to) => {

    let fromDate, toDate;
    let rangeFilter = {}

    if (from) {
        fromDate = new Date(new Date(from).setHours(0, 0, 0, 0))
        rangeFilter = { ...rangeFilter, $gte: fromDate }
    }

    if (to) {
        toDate = new Date(new Date(to).setHours(23, 59, 59, 999))
        rangeFilter = { ...rangeFilter, $lte: toDate }
    }

    return rangeFilter
}

const getRange = (from_value, to_value) => {

    let range = {}

    if (from_value) {
        range = { ...range, $gte: from_value }
    }

    if (to_value) {
        range = { ...range, $lte: to_value }
    }

    return range
}

const getWeek = (week) => {

    let today = new Date();
    let day = today.getDay();
    let t = day - 1;
    let monday, sunday;

    if (week === 'last') {
        monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t - 6);
        sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t);
    } else {
        monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - t + 1);
        sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - t) + 1);
    }

    return [monday, sunday];

}

const generatePassword = (length = 12) => {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+[]{}<>?';

    const allChars = upper + lower + numbers + symbols;

    const getRandom = (set) => set[Math.floor(Math.random() * set.length)];

    let password = [
        getRandom(upper),
        getRandom(lower),
        getRandom(numbers),
        getRandom(symbols)
    ];

    for (let i = 4; i < length; i++) {
        password.push(getRandom(allChars));
    }

    password = password.sort(() => 0.5 - Math.random());

    return password.join('');
}

const getFileType = (url) => {

    if (url) {

        const extension = url.split('.').pop().split(/\#|\?/)[0].toLowerCase();

        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const videoTypes = ['mp4', 'webm', 'ogg', 'avi', 'mov'];
        const audioTypes = ['mp3', 'wav', 'aac', 'flac', 'm4a'];

        if (imageTypes.includes(extension)) return 'image';
        if (videoTypes.includes(extension)) return 'video';
        if (audioTypes.includes(extension)) return 'audio';

        return 'unknown';

    }

    return null

}

const getOrdinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const normalize = (link) => {

    if (!link) return ''

    const normalized = path.normalize(link)
    return normalized.split(path.sep).join('/')

}

module.exports = {
    COMMISSION,
    SLOTS,
    MONTHS,
    ROLES,
    WORKING_TIME,
    ERRORS,
    BOOKING_STATUS,
    GENERAL_STATUS,
    TASK_STATUS,
    ENUM_ROLES,
    MESSAGE_STATUS,
    CONTENT_TYPES,
    AUTH_TYPES,
    PUSH_USER_TYPES,
    MEDIA_TYPES,
    ENUM_WORKING_TIME,
    ENUM_BOOKING_STATUS,
    ENUM_GENERAL_STATUS,
    ENUM_TASK_STATUS,
    ENUM_MESSAGE_STATUS,
    ENUM_CONTENT_TYPES,
    ENUM_AUTH_TYPES,
    ENUM_MEDIA_TYPES,
    ENUM_PUSH_USER_TYPES,
    BOOKING_TIME_STATUS,
    generateOTP,
    paginationHandler,
    objectValidator,
    getMonths,
    getMinMax,
    getSearchQuery,
    getDateRangeQuery,
    getWeek,
    generatePassword,
    getRange,
    getFileType,
    getOrdinal,
    normalize,
    paginateResponse
};