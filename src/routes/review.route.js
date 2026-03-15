const express = require('express');
const router = express.Router();

const reviewController = require('../controllers/review.controller');
const { AuthVerifier, RestrictAccess, OptionalAuthVerifier } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils');

// Create Review/Rating for Service
router.post(
    '/create',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    reviewController.createReview
);

// Get All Reviews
router.get(
    '/get',
    OptionalAuthVerifier,
    reviewController.getReview
);

// Get Review by ID
router.get(
    '/get/:id',
    OptionalAuthVerifier,
    reviewController.getReviewById
);

// Get Service Reviews with Statistics
router.get(
    '/service/:id',
    OptionalAuthVerifier,
    reviewController.getServiceReviews
);

// Update Review
router.patch(
    '/update/:id',
    AuthVerifier,
    RestrictAccess([ROLES.USER, ROLES.ADMIN]),
    reviewController.updateReview
);

// Delete Review
router.delete(
    '/delete/:id',
    AuthVerifier,
    reviewController.deleteReview
);

module.exports = router;