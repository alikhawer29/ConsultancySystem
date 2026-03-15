const dotenv = require('dotenv');
const Payment = require('../../models/payment.model');
const ResponseHandler = require('../../utils/response');

dotenv.config();

// ============================
// Get All Payments (Admin)
// ============================
const getAllPayments = async (req, res) => {
    try {
        const {
            page = 1,
            per_page = 10,
            booking_from,
            booking_to,
            payment_from,
            payment_to,
            price_type,
            search
        } = req.query;

        const { paginationHandler, getSearchQuery, getDateRangeQuery, paginateResponse } = require('../../utils');
        const Booking = require('../../models/booking.model');

        const options = paginationHandler(page, per_page);
        let filter = {};

        // Build aggregation pipeline
        const pipeline = [
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking_id",
                    foreignField: "_id",
                    as: "booking"
                }
            },
            { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } }
        ];

        // Only show payments where booking status is 'approved'
        filter['booking.status'] = 'approved';

        // Filter by price_type from booking
        if (price_type) {
            filter['booking.price_type'] = price_type;
        }

        // Filter by booking date range (session_date from booking)
        if (booking_from || booking_to) {
            filter['booking.session_date'] = getDateRangeQuery(booking_from, booking_to);
        }

        // Filter by payment date range (createdAt from payment)
        if (payment_from || payment_to) {
            filter.createdAt = getDateRangeQuery(payment_from, payment_to);
        }

        // Search by booking_id or amount
        if (search) {
            filter.$or = [
                { 'booking.booking_id': getSearchQuery(search) },
                { amount: isNaN(search) ? -1 : Number(search) }
            ];
        }

        // Add match stage if filters exist
        if (Object.keys(filter).length > 0) {
            pipeline.push({ $match: filter });
        }

        // Project only required fields
        pipeline.push({
            $project: {
                booking_id: "$booking.booking_id",
                price_type: "$booking.price_type",
                booking_charges: "$amount",
                booking_date: "$booking.session_date",
                payment_date: "$createdAt"
            }
        });


        // Sort by payment date (newest first)
        pipeline.push({ $sort: { payment_date: -1 } });

        // Count total before pagination
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await Payment.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        // Calculate total earnings (sum of amounts where booking status is 'approved')
        const earningsPipeline = [
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking_id",
                    foreignField: "_id",
                    as: "booking"
                }
            },
            { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
            {
                $match: {
                    'booking.status': 'approved'
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: "$amount" }
                }
            }
        ];

        const earningsResult = await Payment.aggregate(earningsPipeline);
        const totalEarnings = earningsResult.length > 0 ? earningsResult[0].totalEarnings : 0;

        // Add pagination
        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const payments = await Payment.aggregate(pipeline);

        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        const paginated = paginateResponse({
            page: Number(page),
            per_page: Number(per_page),
            total,
            baseUrl,
            data: payments,
            earnings: totalEarnings
        });

        return ResponseHandler.success(res, "Payments retrieved successfully", paginated);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

module.exports = {
    getAllPayments,
};

