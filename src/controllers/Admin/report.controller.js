const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Report = require('../../models/report.model');
const Service = require('../../models/service.model');
const Booking = require('../../models/booking.model');
const { paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../../utils');
const ResponseHandler = require('../../utils/response');

dotenv.config();

// ============================
// Get All Reports
// ============================
const getReports = async (req, res) => {
    try {
        const {
            page = 1,
            per_page = 10,
            search,
            from,
            to,
            price_type,
            status
        } = req.query;
        const { decoded } = req;

        const { paginateResponse } = require('../../utils');
        const options = paginationHandler(page, per_page);

        let filter = {};

        // Build aggregation pipeline
        const pipeline = [
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking",
                    foreignField: "_id",
                    as: "booking_data"
                }
            },
            { $unwind: { path: "$booking_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user_data"
                }
            },
            { $unwind: { path: "$user_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "booking_data.provider_id",
                    foreignField: "_id",
                    as: "provider_data"
                }
            },
            { $unwind: { path: "$provider_data", preserveNullAndEmptyArrays: true } }
        ];

        // If user is not admin, only show their own reports
        if (decoded.role !== 'admin') {
            filter.user = new mongoose.Types.ObjectId(decoded.id);
        }

        // Filter by price_type from booking
        if (price_type) {
            filter['booking_data.price_type'] = price_type;
        }

        // Filter by status
        if (status) {
            filter.status = status;
        }

        // Filter by booking date range (session_date from booking)
        if (from || to) {
            filter['booking_data.session_date'] = getDateRangeQuery(from, to);
        }

        // Search by booking_id or user name
        if (search) {
            filter.$or = [
                { 'booking_data.booking_id': getSearchQuery(search) },
                { 'user_data.first_name': getSearchQuery(search) },
                { 'user_data.last_name': getSearchQuery(search) }
            ];
        }

        // Add match stage if filters exist
        if (Object.keys(filter).length > 0) {
            pipeline.push({ $match: filter });
        }

        // Project only required fields
        pipeline.push({
            $project: {
                booking_id: "$booking_data.booking_id",
                user_name: {
                    $concat: ["$user_data.first_name", " ", "$user_data.last_name"]
                },
                provider_name: {
                    $concat: ["$provider_data.first_name", " ", "$provider_data.last_name"]
                },
                price_type: "$booking_data.price_type",
                booking_date: "$booking_data.session_date",
                status: 1,
                reason: 1,
                createdAt: 1
            }
        });

        // Sort by creation date (newest first)
        pipeline.push({ $sort: { createdAt: -1 } });

        // Count total before pagination
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await Report.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        // Add pagination
        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const reports = await Report.aggregate(pipeline);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: reports
        });

        return ResponseHandler.success(res, "Reports retrieved successfully", paginated);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Get Report by ID
// ============================
const getReportById = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;

        // Build aggregation pipeline for detailed report
        const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(id) } },
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking",
                    foreignField: "_id",
                    as: "booking_data"
                }
            },
            { $unwind: { path: "$booking_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "service_data"
                }
            },
            { $unwind: { path: "$service_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "categories",
                    localField: "service_data.category",
                    foreignField: "_id",
                    as: "category_data"
                }
            },
            { $unwind: { path: "$category_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "user_data"
                }
            },
            { $unwind: { path: "$user_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "booking_data.provider_id",
                    foreignField: "_id",
                    as: "provider_data"
                }
            },
            { $unwind: { path: "$provider_data", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    // Service details
                    service_name: "$service_data.name",
                    category: "$category_data.name",
                    price_type: "$booking_data.price_type",
                    price: "$booking_data.price",

                    // User details (report creator)
                    user_name: {
                        $concat: ["$user_data.first_name", " ", "$user_data.last_name"]
                    },
                    user_image: "$user_data.picture",
                    user_id: "$user_data._id",

                    // Provider details
                    provider_name: {
                        $concat: ["$provider_data.first_name", " ", "$provider_data.last_name"]
                    },
                    provider_email: "$provider_data.email",
                    provider_phone: "$provider_data.phone",
                    provider_dialing_code: "$provider_data.dialing_code",
                    provider_image: "$provider_data.picture",
                    provider_id: "$provider_data._id",

                    // Report status
                    status: 1,

                    // Booking details
                    booking_id: "$booking_data.booking_id",
                    booking_date: "$booking_data.session_date",
                    booking_time: "$booking_data.session_time",
                    booking_user_name: {
                        $concat: [
                            "$booking_data.contact_details.first_name",
                            " ",
                            "$booking_data.contact_details.last_name"
                        ]
                    },
                    booking_user_email: "$booking_data.contact_details.email",
                    booking_user_phone: "$booking_data.contact_details.phone_number",
                    booking_user_country_code: "$booking_data.contact_details.country_code",
                    booking_user_address: "$booking_data.address.full_address",

                    // Report details
                    report_date: "$createdAt",
                    report_reason: "$reason"
                }
            }
        ];

        const reports = await Report.aggregate(pipeline);

        if (!reports || reports.length === 0) {
            throw new Error('Report not found');
        }

        const report = reports[0];

        // Check if user has access to this report
        if (decoded.role !== 'admin' && report.user_id.toString() !== decoded.id) {
            throw new Error('Unauthorized');
        }

        // Add full image URL for user
        if (report.user_image) {
            report.user_image_url = report.user_image.startsWith('http')
                ? report.user_image
                : `${process.env.BASE_URL}${report.user_image}`;
        }

        // Add full image URL for provider
        if (report.provider_image) {
            report.provider_image_url = report.provider_image.startsWith('http')
                ? report.provider_image
                : `${process.env.BASE_URL}${report.provider_image}`;
        }

        return ResponseHandler.success(res, "Report retrieved successfully", report);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Update Report Status (Admin Only)
// ============================
const updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;

        const report = await Report.findById(id);

        if (!report) {
            throw new Error('Report not found');
        }

        // Update status to resolved
        report.status = 'resolved';
        report.resolved_by = decoded.id;
        report.resolved_at = new Date();

        await report.save();

        return ResponseHandler.success(res, "Report status updated to resolved", {
            report_id: report._id,
            status: report.status
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


module.exports = {
    getReports,
    getReportById,
    updateReportStatus,
};

