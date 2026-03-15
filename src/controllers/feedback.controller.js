const Feedback = require('../models/feedback.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils');

const createFeedback = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        const userId = req.decoded?.id || req.decoded?._id || null;

        console.log(userId, 'userId')

        // Add authenticated user ID if available
        let feedbackData = {
            ...body,
            user_id: userId || null
        };


        let feedback = new Feedback(feedbackData);

        await feedback.save();

        // Send database notification to admin (for web)
        try {
            const admins = await User.find({ role: ROLES.ADMIN });
            const adminIds = admins.map(admin => admin._id);

            if (adminIds.length > 0) {
                const notification = new Notification({
                    notification: {
                        title: '💬 New Feedback Received',
                        body: `${feedbackData.name} (${feedbackData.email}) submitted feedback: ${feedbackData.subject}`,
                        data: {
                            type: 'new_feedback',
                            feedback_id: feedback._id.toString(),
                            user_id: userId,
                            subject: feedbackData.subject,
                        },
                    },
                    recipients: adminIds,
                });
                await notification.save();
                console.log(`✅ Feedback notification sent to ${adminIds.length} admins`);
            }
        } catch (error) {
            console.error('❌ Error sending feedback notification:', error);
        }

        return res.status(200).send({
            success: true,
            message: "Feedback Successfully Saved",
            data: feedback
        });

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFeedback = async (req, res) => {
    try {
        let { page, per_page, search, from, to, sortBy } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let feedbacks = await Feedback.find(filter, projection, options)
            .populate({
                path: "user_id",
                select: "name email picture role",
                // Handle case where user might be deleted but feedback remains
                options: { strictPopulate: false }
            })
            .sort(sort)
            .lean() // Convert to plain JavaScript objects

        let total = await Feedback.countDocuments(filter)

        // Transform data to include user type and handle guest users
        const transformedFeedbacks = feedbacks.map(feedback => {
            let userType = 'guest';
            let userInfo = null;

            if (feedback.user_id && typeof feedback.user_id === 'object') {
                userType = feedback.user_id.role || 'user'; // Default to 'user' if role not set
                userInfo = {
                    name: feedback.user_id.name,
                    email: feedback.user_id.email,
                    picture: feedback.user_id.picture
                }
            } else if (feedback.user_id) {
                // If user_id exists but population failed (user deleted)
                userType = 'deleted_user';
            }

            return {
                _id: feedback._id,
                name: feedback.name,
                email: feedback.email,
                subject: feedback.subject,
                message: feedback.message,
                user_info: userInfo, // User details (null for guests)
                user_type: userType, // 'guest', 'user', 'provider', or 'deleted_user'
                createdAt: feedback.createdAt,
                updatedAt: feedback.updatedAt
            }
        })

        res.status(200).send({
            success: true,
            total,
            data: transformedFeedbacks
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

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
            return res.status(404).send({
                success: false,
                message: "Feedback not found"
            })
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

        res.status(200).send({
            success: true,
            data: transformedFeedback
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

module.exports = {
    createFeedback,
    getFeedback,
    getFeedbackById
}