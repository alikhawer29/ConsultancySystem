const dotenv = require('dotenv');
const Report = require('../models/report.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils');
const { sendNotification } = require('../helpers/notification');
const { sendReportToAdminNotification } = require('../helpers/bookingNotification');

dotenv.config();

// ============================
// Create Report for Service
// ============================
const createReport = async (req, res) => {
    try {
        const { body, decoded, files } = req;

        // Validate required fields
        const validate = objectValidator(body);
        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD);
        }

        const { reason, booking } = body;

        console.log(body, 'body');

        let bookingExists = null;
        let serviceExists = null;

        // 1️⃣ If booking exists → validate booking & service
        if (booking) {
            bookingExists = await Booking.findById(booking);

            if (!bookingExists) {
                throw new Error('Booking not found');
            }

            // Check if booking belongs to logged-in user
            if (bookingExists.user_id.toString() !== decoded.id) {
                throw new Error('Unauthorized: This booking does not belong to you');
            }

            // Fetch service
            serviceExists = await Service.findById(bookingExists.service_id);
            if (!serviceExists) {
                throw new Error('Service not found');
            }
        }

        // 2️⃣ Handle file attachments
        let attachments = [];
        if (files && files.length > 0) {
            attachments = files.map(file => file.path);
        }

        // 3️⃣ Build payload
        const payload = {
            user: decoded.id,
            service: serviceExists ? serviceExists._id : null,
            reason,
            booking,
            attachments,
            status: 'pending',
        };

        // 4️⃣ Create report
        const report = new Report(payload);
        await report.save();

        // 5️⃣ Populate referenced fields
        await report.populate([
            { path: 'user', select: 'first_name last_name email picture' },
            { path: 'service', select: 'name image' },
            { path: 'booking', select: 'booking_id' },
        ]);

        // 6️⃣ Send notification to admin (database notification for web)
        sendReportToAdminNotification({
            user: report.user,
            booking: report.booking,
            report_reason: report.reason,
            report_description: body.description || '',
        });

        return res.status(200).send({
            success: true,
            message: 'Report successfully submitted',
            data: report,
        });

    } catch (e) {
        console.log('Error Message :: ', e.message);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// ============================
// Get All Reports
// ============================
const getReports = async (req, res) => {
    try {
        let { page, per_page, search, from, to, sortBy, service, user, status } = req.query;
        let { decoded } = req;

        let options = paginationHandler(page, per_page);

        let filter = {};
        let sort = { createdAt: -1 }; // Default sort by newest

        // If user is not admin, only show their own reports
        if (decoded.role !== ROLES.ADMIN) {
            filter.user = decoded.id;
        } else {
            // Admin can filter by user
            if (user) {
                filter.user = user;
            }
        }

        if (search) {
            filter.$or = [
                { reason: getSearchQuery(search) },
                { description: getSearchQuery(search) },
            ];
        }

        if (service) {
            filter.service = service;
        }

        if (status) {
            filter.status = status;
        }

        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        if (sortBy) {
            sort = { [sortBy]: -1 };
        }

        let reports = await Report.find(filter, {}, options)
            .populate({ path: 'user', select: 'first_name last_name picture email' })
            .populate({ path: 'service', select: 'name image category' })
            .populate({ path: 'booking', select: 'booking_id status' })
            .populate({ path: 'resolved_by', select: 'first_name last_name email' })
            .sort(sort)
            .lean({ virtuals: true });

        let total = await Report.countDocuments(filter);

        return res.status(200).send({
            success: true,
            total,
            data: reports,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// ============================
// Get Report by ID
// ============================
const getReportById = async (req, res) => {
    try {
        let { id } = req.params;
        let { decoded } = req;

        let report = await Report.findById(id)
            .populate({ path: 'user', select: 'first_name last_name picture email phone' })
            .populate({ path: 'service', select: 'name image category rating' })
            .populate({ path: 'booking', select: 'booking_id status session_date session_time' })
            .populate({ path: 'resolved_by', select: 'first_name last_name email' })
            .lean({ virtuals: true });

        if (!report) {
            throw new Error('Report not found');
        }

        // Check if user has access to this report
        if (decoded.role !== ROLES.ADMIN && report.user._id.toString() !== decoded.id) {
            throw new Error('Unauthorized');
        }

        return res.status(200).send({
            success: true,
            data: report,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// ============================
// Update Report Status (Admin Only)
// ============================
const updateReportStatus = async (req, res) => {
    try {
        let { id } = req.params;
        let { body, decoded } = req;

        const report = await Report.findById(id);

        if (!report) {
            throw new Error('Report not found');
        }

        const { status, admin_response } = body;

        // Validate status
        const validStatuses = ['pending', 'under_review', 'resolved', 'rejected'];
        if (status && !validStatuses.includes(status)) {
            throw new Error('Invalid status');
        }

        if (status) {
            report.status = status;
        }

        if (admin_response) {
            report.admin_response = admin_response;
        }

        if (status === 'resolved' || status === 'rejected') {
            report.resolved_by = decoded.id;
            report.resolved_at = new Date();
        }

        await report.save();

        // Send notification to user
        if (status) {
            const notificationMessages = {
                under_review: 'Your report is now under review',
                resolved: 'Your report has been resolved',
                rejected: 'Your report has been rejected',
            };

            if (notificationMessages[status]) {
                sendNotification(
                    {
                        title: 'Report Status Update',
                        body: notificationMessages[status],
                        data: { type: 'report_status', report_id: report._id.toString(), status },
                    },
                    report.user,
                    false
                );
            }
        }

        await report.populate([
            { path: 'user', select: 'first_name last_name email' },
            { path: 'service', select: 'name image' },
            { path: 'resolved_by', select: 'first_name last_name email' },
        ]);

        return res.status(200).send({
            success: true,
            message: 'Report status updated successfully',
            data: report,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// ============================
// Delete Report
// ============================
const deleteReport = async (req, res) => {
    try {
        let { id } = req.params;
        let { decoded } = req;

        const report = await Report.findById(id);

        if (!report) {
            throw new Error('Report not found');
        }

        // Check if report belongs to the user or user is admin
        if (report.user.toString() !== decoded.id && decoded.role !== ROLES.ADMIN) {
            throw new Error('Unauthorized');
        }

        // Soft delete
        await report.trash();

        return res.status(200).send({
            success: true,
            message: 'Report successfully deleted',
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

// ============================
// Get Report Statistics (Admin Only)
// ============================
const getReportStatistics = async (req, res) => {
    try {
        const totalReports = await Report.countDocuments();
        const pendingReports = await Report.countDocuments({ status: 'pending' });
        const underReviewReports = await Report.countDocuments({ status: 'under_review' });
        const resolvedReports = await Report.countDocuments({ status: 'resolved' });
        const rejectedReports = await Report.countDocuments({ status: 'rejected' });

        // Get most reported services
        const mostReportedServices = await Report.aggregate([
            { $match: { deleted: false } },
            { $group: { _id: '$service', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'services',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'service',
                },
            },
            { $unwind: '$service' },
            {
                $project: {
                    service: { name: 1, image: 1, _id: 1 },
                    count: 1,
                },
            },
        ]);

        return res.status(200).send({
            success: true,
            data: {
                total: totalReports,
                pending: pendingReports,
                under_review: underReviewReports,
                resolved: resolvedReports,
                rejected: rejectedReports,
                most_reported_services: mostReportedServices,
            },
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

module.exports = {
    createReport,
    getReports,
    getReportById,
    updateReportStatus,
    deleteReport,
    getReportStatistics,
};

