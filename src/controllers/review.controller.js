const dotenv = require('dotenv');
const Review = require('../models/review.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery, ROLES } = require('../utils');
const { sendFeedbackToAdminNotification } = require('../helpers/bookingNotification');

dotenv.config();

// ============================
// Create Review/Rating for Service
// ============================
const createReview = async (req, res) => {
    try {
        const { body, decoded } = req;
        const { rating, review, booking } = body;

        // ✅ Validate required fields
        if (!rating || !review || !booking) {
            throw new Error('Rating, review, and booking are required');
        }

        // ✅ Validate rating range
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }

        // ✅ Verify booking existence and ownership
        const bookingExists = await Booking.findById(booking);
        if (!bookingExists) {
            throw new Error('Booking not found');
        }

        if (bookingExists.user_id.toString() !== decoded.id) {
            throw new Error('Unauthorized: This booking does not belong to you');
        }

        // ✅ Ensure booking is completed and paid
        if (bookingExists.payment_status !== 'paid') {
            throw new Error('You can only review a service after payment is completed');
        }

        // ✅ Check if service exists
        const serviceExists = await Service.findById(bookingExists.service_id);
        if (!serviceExists) {
            throw new Error('Service not found');
        }

        // ✅ Check if the user already reviewed this service
        const existingReview = await Review.findOne({
            user: decoded.id,
            service: bookingExists.service_id,
            booking,
        });

        if (existingReview) {
            throw new Error('You have already reviewed this service');
        }

        // ✅ Create review payload
        const payload = {
            user: decoded.id,
            service: bookingExists.service_id,
            rating,
            review,
            booking,
        };

        const newReview = new Review(payload);
        await newReview.save();

        // ✅ Update average rating for the service
        await updateServiceRating(bookingExists.service_id);

        // ✅ Populate user details before returning
        await newReview.populate([
            { path: 'user', select: 'first_name last_name picture email' },
            { path: 'booking', select: 'booking_id' },
        ]);

        // ✅ Send notification to admin (database notification for web)
        sendFeedbackToAdminNotification({
            user: newReview.user,
            booking: newReview.booking,
            rating: newReview.rating,
            review_text: newReview.review,
            type: 'review',
        });

        return res.status(200).send({
            success: true,
            message: 'Review successfully created',
            data: newReview,
        });

    } catch (e) {
        console.error('Error Message ::', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get All Reviews
// ============================
const getReview = async (req, res) => {
    try {
        let { page, per_page, search, from, to, sortBy, service, user, rating } = req.query;

        let options = paginationHandler(page, per_page);

        let filter = {};
        let sort = { createdAt: -1 }; // Default sort by newest

        if (search) {
            filter = { ...filter, review: getSearchQuery(search) };
        }

        if (service) {
            filter = { ...filter, service };
        }

        if (user) {
            filter = { ...filter, user };
        }

        if (rating) {
            filter = { ...filter, rating: parseInt(rating) };
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
        }

        if (sortBy) {
            sort = { [sortBy]: -1 };
        }

        let reviews = await Review.find(filter, {}, options)
            .populate({ path: 'user', select: 'first_name last_name picture email' })
            .populate({ path: 'service', select: 'name image category' })
            .populate({ path: 'booking', select: 'booking_id status' })
            .sort(sort)
            .lean({ virtuals: true });

        let total = await Review.countDocuments(filter);

        return res.status(200).send({
            success: true,
            total,
            data: reviews,
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
// Get Review by ID
// ============================
const getReviewById = async (req, res) => {
    try {
        let { id } = req.params;

        let review = await Review.findById(id)
            .populate({ path: 'user', select: 'first_name last_name picture email' })
            .populate({ path: 'service', select: 'name image category rating' })
            .populate({ path: 'booking', select: 'booking_id status session_date' })
            .lean({ virtuals: true });

        if (!review) {
            throw new Error('Review not found');
        }

        return res.status(200).send({
            success: true,
            data: review,
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
// Update Review
// ============================
const updateReview = async (req, res) => {
    try {
        let { id } = req.params;
        let { body, decoded } = req;

        const review = await Review.findById(id);

        if (!review) {
            throw new Error('Review not found');
        }

        // Check if review belongs to the user
        if (review.user.toString() !== decoded.id) {
            throw new Error('Unauthorized: You can only update your own reviews');
        }

        const { rating, review: reviewText } = body;

        // Validate rating if provided
        if (rating && (rating < 1 || rating > 5)) {
            throw new Error('Rating must be between 1 and 5');
        }

        if (rating) review.rating = rating;
        if (reviewText !== undefined) review.review = reviewText;

        await review.save();

        // Update service average rating
        await updateServiceRating(review.service);

        await review.populate({ path: 'user', select: 'first_name last_name picture email' });

        return res.status(200).send({
            success: true,
            message: 'Review successfully updated',
            data: review,
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
// Delete Review
// ============================
const deleteReview = async (req, res) => {
    try {
        let { id } = req.params;
        let { decoded } = req;

        const review = await Review.findById(id);

        if (!review) {
            throw new Error('Review not found');
        }

        // Check if review belongs to the user or user is admin
        if (review.user.toString() !== decoded.id && decoded.role !== ROLES.ADMIN) {
            throw new Error('Unauthorized');
        }

        const serviceId = review.service;

        // Soft delete
        await review.trash();

        // Update service average rating
        await updateServiceRating(serviceId);

        return res.status(200).send({
            success: true,
            message: 'Review successfully deleted',
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
// Get Service Reviews with Statistics
// ============================
const getServiceReviews = async (req, res) => {
    try {
        let { id } = req.params; // service id
        let { page, per_page, rating } = req.query;

        let options = paginationHandler(page, per_page);

        let filter = { service: id };

        if (rating) {
            filter.rating = parseInt(rating);
        }

        // Get reviews
        let reviews = await Review.find(filter, {}, options)
            .populate({ path: 'user', select: 'first_name last_name picture email' })
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });

        let total = await Review.countDocuments(filter);

        // Calculate rating statistics
        const allReviews = await Review.find({ service: id });

        const stats = {
            total_reviews: allReviews.length,
            average_rating: 0,
            rating_distribution: {
                5: 0,
                4: 0,
                3: 0,
                2: 0,
                1: 0,
            },
        };

        if (allReviews.length > 0) {
            const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
            stats.average_rating = parseFloat((totalRating / allReviews.length).toFixed(1));

            // Count rating distribution
            allReviews.forEach(review => {
                stats.rating_distribution[review.rating]++;
            });
        }

        return res.status(200).send({
            success: true,
            total,
            stats,
            data: reviews,
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
// Helper: Update Service Average Rating
// ============================
const updateServiceRating = async (serviceId) => {
    try {
        const reviews = await Review.find({ service: serviceId });

        let averageRating = 0;
        if (reviews.length > 0) {
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            averageRating = parseFloat((totalRating / reviews.length).toFixed(1));
        }

        await Service.findByIdAndUpdate(serviceId, { rating: averageRating });
    } catch (error) {
        console.error('Error updating service rating:', error);
    }
};

module.exports = {
    createReview,
    getReview,
    getReviewById,
    updateReview,
    deleteReview,
    getServiceReviews,
};