const Feedback = require('../../models/feedback.model');
const { paginationHandler, getSearchQuery, getDateRangeQuery, paginateResponse } = require('../../utils');
const ResponseHandler = require('../../utils/response');
const response = require('../../utils/response')


const getFeedback = async (req, res) => {
    try {
        let { page = 1, per_page = 10, search, from, to, sortBy } = req.query;

        let options = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};
        let projection = {};

        if (search) {
            filter.name = getSearchQuery(search);
        }

        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        if (sortBy) {
            sort[sortBy] = 1;
        }

        // Fetch paginated feedbacks
        const feedbacks = await Feedback.find(filter, projection, options)
            .populate({
                path: "user_id",
                select: "name email picture role",
                options: { strictPopulate: false }
            })
            .sort(sort)
            .lean();

        const total = await Feedback.countDocuments(filter);

        // Transform feedbacks
        const transformedFeedbacks = feedbacks.map((feedback) => {
            let userType = "guest";
            let userInfo = null;

            if (feedback.user_id && typeof feedback.user_id === "object") {
                userType = feedback.user_id.role || "user";
                userInfo = {
                    name: feedback.user_id.name,
                    email: feedback.user_id.email,
                    picture: feedback.user_id.picture,
                };
            } else if (feedback.user_id) {
                userType = "deleted_user";
            }

            return {
                _id: feedback._id,
                name: feedback.name,
                email: feedback.email,
                subject: feedback.subject,
                message: feedback.message,
                user_info: userInfo,
                user_type: userType,
                createdAt: feedback.createdAt,
                updatedAt: feedback.updatedAt,
            };
        });

        // Final paginated response
        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;
        const paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: transformedFeedbacks,
        });

        return ResponseHandler.success(res, "Feedbacks retrieved successfully", paginated);

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


const getFeedbackById = async (req, res) => {
    try {
        let id = req.params.id

        let feedback = await Feedback.findById(id)
            .populate({
                path: "user_id",
                select: "name email picture role",
                options: { strictPopulate: false }
            })
            .lean()

        if (!feedback) {
            throw new Error("Feedback not found")
        }

        // Determine user type
        let userType = 'guest';
        let userInfo = null;

        if (feedback.user_id && typeof feedback.user_id === 'object') {
            userType = feedback.user_id.role || 'user';
            userInfo = {
                name: feedback.user_id.name,
                email: feedback.user_id.email,
                picture: feedback.user_id.picture
            }
        } else if (feedback.user_id) {
            userType = 'deleted_user';
        }

        const transformedFeedback = {
            _id: feedback._id,
            name: feedback.name,
            email: feedback.email,
            subject: feedback.subject,
            message: feedback.message,
            user_info: userInfo,
            user_type: userType,
            createdAt: feedback.createdAt,
            updatedAt: feedback.updatedAt
        }

        return ResponseHandler.success(res, "Feedback retrieved successfully", transformedFeedback);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

module.exports = {
    getFeedback,
    getFeedbackById
}