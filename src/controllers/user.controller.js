const User = require('../models/user.model')
const Booking = require('../models/booking.model')
const Service = require('../models/service.model')
const Payment = require('../models/payment.model')
const Conversation = require('../models/conversation.model')
const Review = require('../models/review.model')
const response = require('../utils/response');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose')


const {
    paginateResponse,
    paginationHandler,
    objectValidator,
    getSearchQuery,
    getDateRangeQuery,
    ERRORS,
    GENERAL_STATUS,
    normalize,
} = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendNotification, sendStatusChangeNotification } = require('../helpers/notification')
const { removeImage } = require('../helpers/image')

const completeProfile = (async (req, res) => {
    try {

        let { decoded, body } = req

        let user = await User.findById(decoded.id)

        if (!user) {
            throw new Error("Invalid User")
        }

        if (user?.details) {
            throw new Error("Profile already completed")
        }

        let payload = {
            ...body,
            user: decoded.id
        }

        user.details = details._id
        await user.save()

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

// const getUser = async (req, res) => {
//     try {
//         let { page, per_page, role, search, from, to, sortBy, status, active } = req.query

//         let options = paginationHandler(page, per_page)

//         let filter = {}
//         let sort = {}

//         // Filter by role - if role is provided, use it; otherwise default to 'user'
//         if (role && role !== 'undefined') {
//             filter.role = role
//         } else {
//             // Default to showing only users with role 'user'
//             filter.role = 'user'
//         }

//         if (search) {
//             filter = { ...filter, name: getSearchQuery(search) }
//         }

//         if (status) {
//             if (status === GENERAL_STATUS.PENDING) {
//                 filter = {
//                     ...filter,
//                     status,
//                     details: { $exists: true }
//                 }
//             } else {
//                 filter = { ...filter, status }
//             }
//         }

//         if (req?.query?.hasOwnProperty("active") && active != null) {
//             filter.active = active
//         }

//         if (from || to) {
//             filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
//         }

//         if (sortBy) {
//             sort = { [sortBy]: -1 }
//         }

//         let projection = {
//             password: 0
//         }

//         let users = await User.find(filter, projection, options)
//             .sort(sort)
//             .lean()

//         let total = await User.countDocuments(filter)

//         return res.status(200).send({
//             success: true,
//             total,
//             data: users
//         })

//     } catch (e) {
//         console.log("Error Message :: ", e)
//         return res.status(400).send({
//             success: false,
//             message: e.message
//         })
//     }
// }

//Admin
const getUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active, new_requests } = req.query;

        let { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};

        // Role filter
        filter.role = role && role !== 'undefined' ? role : 'user';

        // Search filter
        // if (search) {
        //     filter = { ...filter, name: getSearchQuery(search) };
        // }

        if (search) {
            filter.$or = [
                { first_name: getSearchQuery(search) },
                { last_name: getSearchQuery(search) }
            ];
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter = {
                    ...filter,
                    status,
                    details: { $exists: true }
                };
            } else {
                filter = { ...filter, status };
            }
        }

        //for provider new requests
        if (new_requests) {
            filter.is_verified = new_requests === 'true' ? false : true
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active != null) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // Fetch data
        let users = await User.find(filter, { password: 0 })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await User.countDocuments(filter);

        // Build base URL (same as Laravel)
        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: users
        });

        return res.json(response.success("User Listing", paginated));

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.json(response.error(e.message, 400, "User Listing"));
    }
};

//Admin
const getUserById = async (req, res) => {
    try {
        const { decoded, params } = req
        let { id } = params

        let user = await User.findById(id).select('-password').exec()

        res.json(response.success("User Details", user));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "User Details"));
    }
}

const verifyUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_verified, reject_reason, service_id, booking_category } = req.body;

        // Validate is_verified is boolean
        if (typeof is_verified !== "boolean") {
            return res.status(400).send({
                success: false,
                message: "is_verified must be boolean"
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // If verification is false, reject_reason is required
        if (is_verified === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return res.status(400).send({
                    success: false,
                    message: "reject_reason is required when is_verified is false"
                });
            }
        }

        // If verification is true, service_id and booking_category are required
        if (is_verified === true) {
            if (!service_id || !Array.isArray(service_id) || service_id.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "service_id array is required when is_verified is true"
                });
            }

            if (!booking_category || !['normal', 'premium'].includes(booking_category)) {
                return res.status(400).send({
                    success: false,
                    message: "booking_category is required and must be 'normal' or 'premium'"
                });
            }
        }

        // Update user verification status
        user.is_verified = is_verified;

        if (is_verified === false) {
            // Reject user
            user.reject_reason = reject_reason;
            user.active = false; // Deactivate rejected user
            user.provider_services = []; // Clear any previously assigned services
        } else {
            // Approve user
            user.reject_reason = null; // Clear rejection reason
            user.active = true; // Activate user
            user.provider_services = service_id; // Assign services to provider
            user.booking_category = booking_category; // Store booking category
        }

        await user.save();

        const message = is_verified
            ? "Provider approved successfully with assigned services"
            : "Provider rejected successfully";

        return res.json(response.success(message, {
            id: user._id,
            is_verified: user.is_verified,
            active: user.active,
            reject_reason: user.reject_reason || null,
            provider_services: user.provider_services || [],
            booking_category: user.booking_category || null
        }
        ));



    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};


const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params

        // Find user and toggle status in one operation
        const user = await User.findById(id)

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            })
        }

        const previousStatus = user.active
        const newStatus = !previousStatus

        // Toggle and save
        user.active = newStatus
        await user.save()

        // Send notification to user
        await sendStatusChangeNotification(user, newStatus, req.decoded)

        // Convert to object and remove password
        const userData = user.toObject()
        delete userData.password

        return res.status(200).send({
            success: true,
            message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            data: userData
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}



const updateUser = async (req, res) => {
    try {
        let { decoded, body, files } = req; // files instead of file

        // Validate input fields
        if (!objectValidator(body)) throw new Error(ERRORS.NULL_FIELD);

        // Prevent role/email/password edits
        if (body?.role || body?.email || body?.password) {
            throw new Error("Email, password, or role cannot be edited");
        }

        let payload = { ...body };

        // Handle profile picture update
        if (files) {
            const profileFile = files.find(f => f.fieldname === "image");
            if (profileFile) {
                let user = await User.findById(decoded.id);
                if (user?.picture && !user.picture.includes("dummy")) {
                    // Check if file exists before trying to delete it
                    if (fs.existsSync(user.picture)) {
                        fs.unlinkSync(user.picture);
                    }
                }
                payload.picture = profileFile.path.replace(/\\/g, "/");
            }
        }

        const currentUser = await User.findById(decoded.id);

        // Handle provider certifications
        if (currentUser.role === "provider" && body.certifications) {
            let certifications = [];

            // Parse certifications
            let parsedCerts;
            try {
                parsedCerts =
                    typeof body.certifications === "string"
                        ? JSON.parse(body.certifications)
                        : body.certifications;

                if (!Array.isArray(parsedCerts)) throw new Error();
            } catch {
                throw new Error("Invalid certifications format");
            }

            // Handle files for certifications
            const certFiles = files
                ? files.filter(
                    f =>
                        f.fieldname.startsWith("certifications[") &&
                        f.fieldname.includes("certificate_picture")
                )
                : [];

            parsedCerts.forEach((cert, index) => {
                const certFile = certFiles.find(f =>
                    f.fieldname.includes(`[${index}]`)
                );

                const certData = {
                    institution_name: cert.institution_name,
                    certificate_title: cert.certificate_title,
                    certificate_picture:
                        cert.certificate_picture || null,
                };

                if (certFile) {
                    // Remove old file if exists
                    const oldCert = currentUser.certifications[index];
                    if (oldCert?.certificate_picture && fs.existsSync(oldCert.certificate_picture)) {
                        fs.unlinkSync(oldCert.certificate_picture);
                    }

                    // Rename new file
                    const ext = path.extname(certFile.originalname);
                    const newFileName = `certifications_${index}_certificate_picture-${Date.now()}${ext}`;
                    const newPath = path.join("uploads/user", newFileName);

                    fs.renameSync(certFile.path, newPath);
                    certData.certificate_picture = newPath.replace(/\\/g, "/");
                }

                certifications.push(certData);
            });

            payload.certifications = certifications;
        }

        // Update user in DB
        const user = await User.findByIdAndUpdate(decoded.id, { $set: payload }, { new: true }).lean({ virtuals: true });

        return res.status(200).send({
            success: true,
            message: "User Successfully Updated",
            data: user,
        });
    } catch (e) {
        console.error("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// Admin - User Appointments
const getAppointmentsByUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // User filter (parent/user appointments)
        filter.user_id = id;

        // Role filter
        if (role && role !== "undefined") {
            filter.role = role;
        }

        // Search filter
        if (search) {
            filter.name = getSearchQuery(search);
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter.status = status;
                filter.details = { $exists: true };
            } else {
                filter.status = status;
            }
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active !== undefined) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        let sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Booking.countDocuments(filter);

        // Base URL
        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: appointments
        });

        return res.json(response.success("User Appointments", paginated));

    } catch (e) {
        console.log("Error :: ", e);
        return res.json(response.error(e.message, 400, "User Appointments"));
    }
};

// Admin - Provider Appointments
const getAppointmentsByProvider = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // User filter (parent/user appointments)
        filter.provider_id = id;

        // Role filter
        if (role && role !== "undefined") {
            filter.role = role;
        }

        // Search filter
        if (search) {
            filter.name = getSearchQuery(search);
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter.status = status;
                filter.details = { $exists: true };
            } else {
                filter.status = status;
            }
        }

        if (status) {
            // Always filter by main status first
            filter.status = GENERAL_STATUS.APPROVED;

            // If booking is approved, apply booking_status filter
            if (status === GENERAL_STATUS.APPROVED && booking_status) {
                if (
                    booking_status === BOOKING_TIME_STATUS.UPCOMING ||
                    booking_status === BOOKING_TIME_STATUS.IN_PROGRESS ||
                    booking_status === BOOKING_TIME_STATUS.PAST
                ) {
                    filter.booking_status = booking_status;
                }
            }
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active !== undefined) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        let sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Booking.countDocuments(filter);

        // Base URL
        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: appointments
        });

        return res.json(response.success("User Appointments", paginated));

    } catch (e) {
        console.log("Error :: ", e);
        return res.json(response.error(e.message, 400, "User Appointments"));
    }
};


//Admin
const handleStatus = (async (req, res) => {
    try {

        let { body, params } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let update_payload = {}

        if (body?.status) {
            update_payload.status = body?.status
        }

        if (body?.hasOwnProperty("active")) {
            update_payload.active = body?.active
        }

        let user = await User.findByIdAndUpdate(params.id, { $set: update_payload }, { new: true }).lean()

        if (!body?.hasOwnProperty("active")) {
            if (user?.status === GENERAL_STATUS.APPROVED) {
                sendNotification({ title: "Profile Approved", body: "Your profile has been approved by admin" }, user?._id, false)
            } else if (user?.status === GENERAL_STATUS.REJECTED) {
                sendNotification({ title: "Profile Rejected", body: "Your profile has been rejected by admin" }, user?._id, false)
            }
        }

        return res.status(200).send({
            success: true,
            message: "User Successfully Updated",
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteUser = (async (req, res) => {
    try {

        let { id } = req.decoded

        await User.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "User Successfully Deleted"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const changePassword = (async (req, res) => {
    try {

        let { id } = req.decoded
        let { current_password, new_password } = req.body

        if (!current_password || !new_password) {
            throw new Error("Current Password or New Password is not provided")
        }

        let user = await User.findById(id)

        let validPassword = await comparePassword(current_password, user.password)

        if (!validPassword) {
            throw new Error("Current Password doesn't match")
        }

        await User.findOneAndUpdate({ _id: id }, { password: new_password })

        return res.status(200).send({
            success: true,
            message: "Password reset successfully"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

// const getMyProfile = (async (req, res) => {
//     try {

//         let { id } = req.decoded

//         let projection = {
//             password: 0,
//             __v: 0
//         }

//         let user = await User.findById(id, projection).populate("manager").lean()

//         let active_subscription = await getCurrentSubscription(user?._id)
//         user.active_subscription = active_subscription

//         let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
//         user.conversation = conversation._id

//         return res.status(200).send({
//             success: true,
//             data: user
//         })

//     } catch (e) {
//         console.log("Error Message :: ", e)
//         return res.status(400).send({
//             success: false,
//             message: e.message
//         })
//     }
// })

const getMyProfile = async (req, res) => {
    try {
        let { id } = req.decoded

        let projection = {
            password: 0,
            __v: 0
        }

        let user = await User.findById(id, projection).lean({ virtuals: true })

        // let active_subscription = await getCurrentSubscription(user?._id)
        // user.active_subscription = active_subscription

        let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
        user.conversation = conversation?._id || null

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}
//User
const getHome = (async (req, res) => {
    try {

        let { id } = req.decoded

        let total_users = await User.countDocuments({ role: 'user' })
        let total_providers = await User.countDocuments({ role: 'provider' })
        let new_bookings = await Booking.countDocuments({ status: GENERAL_STATUS.PENDING })
        let earningsData = await Payment.aggregate([
            {
                $match: {
                    payment_status: "succeeded",   // include only successful payments
                    deleted: false            // if you use soft delete
                }
            },
            {
                $group: {
                    _id: null,
                    total_earnings: { $sum: "$amount" }
                }
            }
        ]);

        let total_earnings = earningsData.length ? earningsData[0].total_earnings : 0;

        let data = {
            total_users,
            total_providers,
            new_bookings,
            total_earnings,
        }

        return res.json(response.success("Home Data", data));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "Home Data"));
    }
})

//Provider
const getHomeProvider = async (req, res) => {
    try {
        const { decoded, query } = req;
        const { year } = query;
        const providerId = decoded.id;

        // Get current year if not provided
        const currentYear = year ? parseInt(year) : new Date().getFullYear();

        // Get total bookings count for the provider
        const totalAmount = await Booking.aggregate([
            {
                $match: {
                    provider_id: new mongoose.Types.ObjectId(providerId),
                    payment_status: "paid",   // optional but recommended
                    deleted: false
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$price" }
                }
            }
        ]);

        const totalBookingsAmount = totalAmount[0]?.totalAmount || 0;


        // Get monthly booking data for the specified year
        const monthlyBookings = await Booking.aggregate([
            {
                $match: {
                    provider_id: new mongoose.Types.ObjectId(providerId),
                    createdAt: {
                        $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                        $lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Create array for all 12 months with 0 bookings for months with no data
        const monthlyData = Array.from({ length: 12 }, (_, index) => {
            const monthData = monthlyBookings.find(item => item._id === index + 1);
            return {
                month: index + 1,
                monthName: new Date(currentYear, index).toLocaleString('default', { month: 'short' }),
                bookings: monthData ? monthData.count : 0
            };
        });

        // Get available years for filter (years when provider had bookings)
        const availableYears = await Booking.aggregate([
            {
                $match: {
                    provider_id: new mongoose.Types.ObjectId(providerId)
                }
            },
            {
                $group: {
                    _id: { $year: "$createdAt" }
                }
            },
            {
                $sort: { _id: -1 }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id"
                }
            }
        ]);

        const data = {
            totalBookingsAmount,
            monthlyBookings: monthlyData,
            selectedYear: currentYear,
            availableYears: availableYears.map(item => item.year)
        };

        return res.status(200).send({
            success: true,
            message: "Provider home data retrieved successfully",
            data
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const getServiceLogs = async (req, res) => {
    try {
        const { decoded, query } = req;
        const providerId = decoded.id;
        const { page = 1, limit = 10, status, date_from, date_to } = query;

        // Build filter conditions
        const filter = { provider_id: new mongoose.Types.ObjectId(providerId) };

        // if (status) {
        filter.status = 'approved';
        // filter.booking_status = 'upcoming';
        // }

        if (date_from || date_to) {
            filter.session_date = {};
            if (date_from) {
                filter.session_date.$gte = new Date(date_from);
            }
            if (date_to) {
                filter.session_date.$lte = new Date(date_to);
            }
        }

        // Get total count for pagination
        const total = await Booking.countDocuments(filter);

        // Get service logs with pagination
        const serviceLogs = await Booking.find(filter)
            .select('id session_date session_time status booking_status booking_id')
            .sort({ session_date: -1, session_time: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        // Format the response data
        const formattedLogs = serviceLogs.map(log => ({
            id: log._id,
            booking_id: log.booking_id,
            session_date: log.session_date,
            session_time: log.session_time,
            booking_status: log.booking_status
        }));

        // Pagination response
        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_records: total,
            records_per_page: parseInt(limit)
        };

        return res.status(200).send({
            success: true,
            message: "Service logs retrieved successfully",
            data: {
                service_logs: formattedLogs,
                pagination
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const getProviderServices = async (req, res) => {
    try {
        const { decoded, query } = req;
        const providerId = decoded.id;
        const { page = 1, limit = 10, status, category_id } = query;

        // Get provider user with populated services
        const provider = await User.findById(providerId)
            .populate({
                path: 'provider_services',
                populate: {
                    path: 'category',
                    select: 'name description'
                },
                match: status ? { status } : {},
                options: { virtuals: true }
            })
            .lean({ virtuals: true });

        if (!provider) {
            return res.status(404).send({
                success: false,
                message: "Provider not found"
            });
        }

        let services = provider.provider_services || [];

        // Filter by category if provided
        if (category_id) {
            services = services.filter(service =>
                service.category && service.category._id.toString() === category_id
            );
        }

        // Calculate ratings for each service
        const servicesWithRatings = await Promise.all(
            services.map(async (service) => {
                // Get reviews for this service
                const reviews = await Review.find({
                    service: service._id,
                    deleted: false
                }).select('rating');

                // Calculate average rating
                const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
                const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : '0.0';
                const reviewCount = reviews.length;

                return {
                    id: service._id,
                    name: service.name,
                    description: service.description,
                    price: service.price,
                    price_type: service.price_type,
                    duration: service.duration,
                    status: service.status,
                    category: service.category,
                    service_type: service.service_type,
                    // image: service.image,
                    image_url: service.image_url,
                    rating: {
                        average: parseFloat(averageRating),
                        count: reviewCount
                    },
                    created_at: service.createdAt,
                    updated_at: service.updatedAt
                };
            })
        );

        // Apply pagination
        const total = servicesWithRatings.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedServices = servicesWithRatings.slice(startIndex, endIndex);

        // Pagination response
        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_records: total,
            records_per_page: parseInt(limit)
        };

        return res.status(200).send({
            success: true,
            message: "Provider services retrieved successfully",
            data: {
                services: paginatedServices,
                pagination
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const handleFavoriteServices = (async (req, res) => {
    try {

        return res.status(200).send({
            success: true,
            message: "Service Removed From Favorites"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFavoriteServices = (async (req, res) => {
    try {

        let { decoded, query } = req
        let { id } = decoded

        let user = await User.findById(id).populate({ path: "favorite_services", populate: "category" }).select("favorite_services")

        let services = (user?.favorite_services || []).map(item => {
            let service = item.toObject()
            service.is_favorite = true
            return service
        })

        if (query?.categories && query?.categories?.length > 0) {
            services = services.filter(service => query?.categories?.includes(service?.category?._id?.toString()))
        }

        if (query?.search && query?.search.trim() !== "") {
            const name = query.search.trim().toLowerCase()
            services = services.filter(item => item?.name?.toLowerCase().includes(name))
        }

        return res.status(200).send({
            success: true,
            data: services || []
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const logout = (async (req, res) => {
    try {

        let { id } = req.decoded

        await User.findByIdAndUpdate(id, { $set: { device_ids: [] } })

        return res.status(200).send({
            success: true,
            message: "Logged Out"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const scheduleInterview = async (req, res) => {
    try {
        let { body, params } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let user = await User.findById(params?.id)

        if (!user) {
            throw new Error("User not found")
        }

        console.log(user.interview, 'user.interview')

        // Check if interview already exists and is scheduled
        if (user.interview && user.interview.status === 'scheduled') {
            throw new Error("User already has a scheduled interview")
        }

        // Convert date string to Date object
        const [day, month, year] = body.date.split('-')
        const interviewDate = new Date(`${year}-${month}-${day}`)

        // Validate date
        if (isNaN(interviewDate.getTime())) {
            throw new Error("Invalid date format. Use DD-MM-YYYY")
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        if (!timeRegex.test(body.start_time) || !timeRegex.test(body.end_time)) {
            throw new Error("Invalid time format. Use HH:MM (24-hour format)")
        }

        // Validate end time is after start time
        const startTime = new Date(`1970-01-01T${body.start_time}:00`)
        const endTime = new Date(`1970-01-01T${body.end_time}:00`)
        if (endTime <= startTime) {
            throw new Error("End time must be after start time")
        }

        // Create/Update interview object
        user.interview = {
            date: interviewDate,
            start_time: body.start_time,
            end_time: body.end_time,
            description: body.description,
            status: 'scheduled',
            scheduled_at: new Date(),
            updated_at: new Date()
        }

        await user.save()

        return res.json(response.success("Interview scheduled successfully", {
            interview: {
                date: body.date, // Return original format
                start_time: user.interview.start_time,
                end_time: user.interview.end_time,
                description: user.interview.description,
                status: user.interview.status,
                scheduled_at: user.interview.scheduled_at
            }
        }));

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const upgradeAccountRequest = async (req, res) => {
    try {
        const { decoded, body, files } = req;
        const { no_of_completed_appointments, years_of_exp, no_of_languages } = body;

        // Validate user is provider
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (user.role !== 'provider') {
            return res.status(403).send({
                success: false,
                message: "Only providers can request account upgrade"
            });
        }

        console.log(user.upgrade_request, 'user.upgrade_request')

        // Check if upgrade request already exists
        if (user.upgrade_request &&
            typeof user.upgrade_request === 'object' &&
            user.upgrade_request.status === 'pending') {
            return res.status(400).send({
                success: false,
                message: "Upgrade request already submitted"
            });
        }

        // Validate required fields
        if (!no_of_completed_appointments || !years_of_exp || !no_of_languages) {
            return res.status(400).send({
                success: false,
                message: "All fields are required: no_of_completed_appointments, years_of_exp, no_of_languages"
            });
        }

        console.log('Request files:', files);
        console.log('Request body:', body);

        // Handle certificate file
        let certificate_path = null;
        const certificateFile = files && files.find(file => file.fieldname === 'certificate');
        if (certificateFile) {
            console.log('Processing certificate file:', certificateFile);
            const ext = path.extname(certificateFile.originalname);
            const newFileName = `upgrade_certificate_${decoded.id}-${Date.now()}${ext}`;
            const newPath = path.join("uploads/upgrade_requests", newFileName);

            // Create directory if it doesn't exist
            const dir = path.dirname(newPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.renameSync(certificateFile.path, newPath);
            certificate_path = newPath.replace(/\\/g, "/");
            console.log('Certificate saved to:', certificate_path);
        } else {
            console.log('No certificate file found');
        }

        // Handle license file
        let license_path = null;
        const licenseFile = files && files.find(file => file.fieldname === 'license');
        if (licenseFile) {
            console.log('Processing license file:', licenseFile);
            const ext = path.extname(licenseFile.originalname);
            const newFileName = `upgrade_license_${decoded.id}-${Date.now()}${ext}`;
            const newPath = path.join("uploads/upgrade_requests", newFileName);

            // Create directory if it doesn't exist
            const dir = path.dirname(newPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.renameSync(licenseFile.path, newPath);
            license_path = newPath.replace(/\\/g, "/");
            console.log('License saved to:', license_path);
        } else {
            console.log('No license file found');
        }

        // Create upgrade request object
        const upgradeRequest = {
            no_of_completed_appointments: parseInt(no_of_completed_appointments),
            years_of_exp: parseInt(years_of_exp),
            no_of_languages: parseInt(no_of_languages),
            certificate: certificate_path,
            license: license_path,
            requested_at: new Date(),
            status: 'pending'
        };

        // Update user with upgrade request
        await User.findByIdAndUpdate(decoded.id, {
            $set: { upgrade_request: upgradeRequest }
        });

        return res.status(200).send({
            success: true,
            message: "Upgrade request submitted successfully",
            data: upgradeRequest
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const upgradeAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved, reject_reason } = req.body;

        // Validate is_approved is boolean
        if (typeof is_approved !== "boolean") {
            return res.status(400).send({
                success: false,
                message: "is_approved must be boolean"
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // If approval is false, reject_reason is required
        if (is_approved === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return res.status(400).send({
                    success: false,
                    message: "reject_reason is required when is_approved is false"
                });
            }
        }

        // Update user's account approval status
        user.booking_category = is_approved ? 'premium' : 'normal';
        user.upgrade_reject_reason = reject_reason || null;
        await user.save();

        const message = is_approved
            ? "Account upgraded successfully"
            : "Account upgrade request rejected";

        return res.json(response.success(message, {
            id: user._id,
            booking_category: user.booking_category,
            reject_reason: user.upgrade_reject_reason || null
        }
        ));

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const cancelBookingByProvider = async (req, res) => {
    try {
        const { decoded, body } = req;
        const providerId = decoded.id;
        const { booking_id, cancellation_reason } = body;

        // Validate required fields
        if (!booking_id) {
            return res.status(400).send({
                success: false,
                message: "booking_id is required"
            });
        }

        if (!cancellation_reason || cancellation_reason.trim() === '') {
            return res.status(400).send({
                success: false,
                message: "cancellation_reason is required"
            });
        }

        // Find the booking
        const booking = await Booking.findOne({
            _id: booking_id,
            provider_id: new mongoose.Types.ObjectId(providerId)
        });

        if (!booking) {
            return res.status(404).send({
                success: false,
                message: "Booking not found or you don't have permission to cancel this booking"
            });
        }

        // Check if booking can be cancelled (not already cancelled, completed, or rejected)
        if (booking.status === 'cancelled') {
            return res.status(400).send({
                success: false,
                message: "Booking is already cancelled"
            });
        }

        if (booking.status === 'completed') {
            return res.status(400).send({
                success: false,
                message: "Cannot cancel a completed booking"
            });
        }

        if (booking.status === 'rejected') {
            return res.status(400).send({
                success: false,
                message: "Cannot cancel a rejected booking"
            });
        }

        // Update booking status and add cancellation reason
        booking.status = 'cancelled';
        booking.cancellation_reason = cancellation_reason.trim();
        booking.cancelled_by = 'provider';
        booking.cancelled_at = new Date();

        await booking.save();

        // Send notification to user about cancellation
        try {
            await sendNotification(
                booking.user_id,
                'booking_cancelled',
                `Your booking ${booking_id} has been cancelled by the provider`,
                {
                    booking_id: booking_id,
                    cancellation_reason: cancellation_reason,
                    cancelled_by: 'provider'
                }
            );
        } catch (notificationError) {
            console.log("Notification error:", notificationError);
            // Continue even if notification fails
        }

        return res.status(200).send({
            success: true,
            message: "Booking cancelled successfully",
            data: {
                booking_id: booking.booking_id,
                status: booking.status,
                cancellation_reason: booking.cancellation_reason,
                cancelled_by: booking.cancelled_by,
                cancelled_at: booking.cancelled_at
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const getProviderApprovedAppointments = async (req, res) => {
    try {
        const { decoded, query } = req;
        const providerId = decoded.id;
        const { page = 1, limit = 10, from, to, booking_status, search } = query;

        // Build filter conditions for approved bookings
        const filter = {
            provider_id: new mongoose.Types.ObjectId(providerId),
            status: 'approved'
        };

        // Date range filter
        if (from || to) {
            filter.session_date = {};
            if (from) {
                filter.session_date.$gte = new Date(from);
            }
            if (to) {
                filter.session_date.$lte = new Date(to);
            }
        }

        // Booking status filter
        if (booking_status && booking_status !== 'all') {
            filter.booking_status = booking_status;
        }

        // Search filter - search in booking_id, user details, and service name
        let searchFilter = {};
        if (search) {
            searchFilter = {
                $or: [
                    { booking_id: { $regex: search, $options: 'i' } },
                    { 'user_id.first_name': { $regex: search, $options: 'i' } },
                    { 'user_id.last_name': { $regex: search, $options: 'i' } },
                    { 'user_id.email': { $regex: search, $options: 'i' } },
                    { 'service_id.name': { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Get total count for pagination
        const total = await Booking.countDocuments(filter);

        // Get approved bookings with pagination and filters
        let approvedBookings;

        if (search) {
            // Use aggregation for search functionality
            const pipeline = [
                { $match: filter },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'user_id',
                        pipeline: [
                            { $project: { first_name: 1, last_name: 1, email: 1, phone: 1, picture: 1 } }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: 'services',
                        localField: 'service_id',
                        foreignField: '_id',
                        as: 'service_id',
                        pipeline: [
                            { $project: { name: 1, description: 1, price: 1, duration: 1, image_url: 1 } }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category_id',
                        foreignField: '_id',
                        as: 'category_id',
                        pipeline: [
                            { $project: { name: 1, description: 1 } }
                        ]
                    }
                },
                { $unwind: { path: '$user_id', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$service_id', preserveNullAndEmptyArrays: true } },
                { $unwind: { path: '$category_id', preserveNullAndEmptyArrays: true } },
                {
                    $match: {
                        $or: [
                            { booking_id: { $regex: search, $options: 'i' } },
                            { 'user_id.first_name': { $regex: search, $options: 'i' } },
                            { 'user_id.last_name': { $regex: search, $options: 'i' } },
                            { 'user_id.email': { $regex: search, $options: 'i' } },
                            { 'service_id.name': { $regex: search, $options: 'i' } }
                        ]
                    }
                },
                {
                    $project: {
                        booking_id: 1,
                        session_date: 1,
                        session_time: 1,
                        status: 1,
                        booking_status: 1,
                        payment_status: 1,
                        address: 1,
                        contact_details: 1,
                        notes: 1,
                        user_id: 1,
                        service_id: 1,
                        category_id: 1
                    }
                },
                { $sort: { session_date: -1, session_time: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit * 1 }
            ];

            approvedBookings = await Booking.aggregate(pipeline);
        } else {
            // Regular query without search
            approvedBookings = await Booking.find(filter)
                .populate('user_id', 'first_name last_name email phone picture')
                .populate('service_id', 'name description price duration image_url')
                .populate('category_id', 'name description')
                .select('booking_id session_date session_time status booking_status payment_status address contact_details notes')
                .sort({ session_date: -1, session_time: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .lean();
        }

        // Format the response data
        const formattedAppointments = approvedBookings.map(booking => ({
            id: booking._id,
            booking_id: booking.booking_id,
            session_date: booking.session_date,
            session_time: booking.session_time,
            status: booking.status,
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,
            user: booking.user_id,
            service: booking.service_id,
            category: booking.category_id,
            address: booking.address,
            contact_details: booking.contact_details,
            notes: booking.notes
        }));

        // Pagination response
        const pagination = {
            current_page: parseInt(page),
            total_pages: Math.ceil(total / limit),
            total_records: total,
            records_per_page: parseInt(limit)
        };

        return res.status(200).send({
            success: true,
            message: "Provider approved appointments retrieved successfully",
            data: {
                appointments: formattedAppointments,
                pagination
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const getApprovedProvider = async (req, res) => {
    try {
        const { decoded } = req;
        const providerId = decoded.id;

        // Find the provider with approved status
        const provider = await User.findById(providerId)
            .select('first_name last_name email picture phone role is_verified booking_category')
            .lean();

        if (!provider) {
            return res.status(404).send({
                success: false,
                message: "Provider not found"
            });
        }

        // Check if user is a provider
        if (provider.role !== 'provider') {
            return res.status(403).send({
                success: false,
                message: "User is not a provider"
            });
        }

        // Check if provider is verified (approved)
        if (!provider.is_verified) {
            return res.status(403).send({
                success: false,
                message: "Provider is not approved"
            });
        }

        return res.status(200).send({
            success: true,
            message: "Approved provider retrieved successfully",
            data: provider
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

const updateDeviceInfo = async (req, res) => {
    try {
        const { decoded, body } = req;
        const { device_id, device_type } = body;

        if (!device_id) {
            return res.status(400).send({
                success: false,
                message: "device_id is required"
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // Handle device_id
        if (!user.device_ids) {
            user.device_ids = [];
        }

        // Add device_id to array if it doesn't already exist
        if (!user.device_ids.includes(device_id)) {
            user.device_ids.push(device_id);
        }

        // Update device_type if provided and valid
        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            user.device_type = device_type;
        }

        await user.save();

        return res.status(200).send({
            success: true,
            message: "Device information updated successfully",
            data: {
                device_ids: user.device_ids,
                device_type: user.device_type
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};

module.exports = {
    completeProfile,
    getUser,
    getUserById,
    updateUser,
    deleteUser,
    changePassword,
    getMyProfile,
    getHome,
    getHomeProvider,
    handleFavoriteServices,
    getFavoriteServices,
    handleStatus,
    logout,
    updateUserStatus,
    getAppointmentsByUser,
    getAppointmentsByProvider,
    verifyUser,
    scheduleInterview,
    upgradeAccountRequest,
    upgradeAccount,
    getServiceLogs,
    getProviderServices,
    cancelBookingByProvider,
    getProviderApprovedAppointments,
    getApprovedProvider,
    updateDeviceInfo
}