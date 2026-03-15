const dotenv = require('dotenv');
const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const { createPaymentIntent } = require('../helpers/stripe');

dotenv.config();

// ============================
// Create Payment Intent for Booking
// ============================
const createBookingPayment = async (req, res) => {
    try {
        const { booking_id } = req.body;
        const { decoded } = req;

        // Validate booking_id
        if (!booking_id) {
            throw new Error('Booking ID is required');
        }

        // Find the booking
        const booking = await Booking.findById(booking_id);

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if booking belongs to the user
        if (booking.user_id.toString() !== decoded.id) {
            throw new Error('Unauthorized: This booking does not belong to you');
        }

        // Check if booking is already paid
        if (booking.payment_status === 'paid') {
            throw new Error('Booking is already paid');
        }

        // Check if payment already exists for this booking
        let existingPayment = await Payment.findOne({
            booking_id: booking_id,
            payment_status: { $in: ['pending', 'succeeded'] }
        });

        if (existingPayment && existingPayment.payment_status === 'succeeded') {
            throw new Error('Payment already completed for this booking');
        }

        // If there's a pending payment, return the existing client secret
        if (existingPayment && existingPayment.payment_status === 'pending') {
            return res.status(200).send({
                success: true,
                message: 'Payment intent already exists',
                data: {
                    clientSecret: existingPayment.stripe_client_secret,
                    paymentId: existingPayment._id,
                    amount: existingPayment.amount,
                    currency: existingPayment.currency,
                },
            });
        }

        // Create Stripe payment intent
        const { paymentIntentId, clientSecret, customerId } = await createPaymentIntent(
            decoded.id,
            booking.price,
            'usd',
            {
                booking_id: booking._id.toString(),
                booking_number: booking.booking_id,
                user_id: decoded.id,
            }
        );

        // Create payment record
        const payment = new Payment({
            booking_id: booking._id,
            user_id: decoded.id,
            amount: booking.price,
            currency: 'usd',
            payment_mode: 'card',
            payment_status: 'pending',
            stripe_payment_intent_id: paymentIntentId,
            stripe_client_secret: clientSecret,
            stripe_customer_id: customerId,
            metadata: {
                booking_number: booking.booking_id,
                service_id: booking.service_id,
            },
        });

        await payment.save();

        // Update booking with payment reference
        booking.payment_id = payment._id;
        await booking.save();

        return res.status(200).send({
            success: true,
            message: 'Payment intent created successfully',
            data: {
                clientSecret: clientSecret,
                paymentId: payment._id,
                amount: payment.amount,
                currency: payment.currency,
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

// ============================
// Get Payment by ID
// ============================
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;

        const payment = await Payment.findById(id)
            .populate('booking_id')
            .populate('user_id', 'first_name last_name email');

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if payment belongs to the user (or user is admin)
        if (payment.user_id._id.toString() !== decoded.id && decoded.role !== 'admin') {
            throw new Error('Unauthorized');
        }

        return res.status(200).send({
            success: true,
            data: payment,
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
// Update Payment Status (Webhook or manual)
// ============================
const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status, transaction_id, payment_method } = req.body;

        const payment = await Payment.findById(id);

        if (!payment) {
            throw new Error('Payment not found');
        }

        // Update payment status
        if (payment_status) {
            payment.payment_status = payment_status;
        }

        if (transaction_id) {
            payment.transaction_id = transaction_id;
        }

        if (payment_method) {
            payment.payment_method = payment_method;
        }

        await payment.save();

        // Update booking payment status if payment succeeded
        if (payment_status === 'succeeded') {
            const booking = await Booking.findById(payment.booking_id);
            if (booking) {
                booking.payment_status = 'paid';
                // Status remains 'pending' until admin assigns provider
                // booking_status and status will be updated when provider is assigned
                await booking.save();
            }
        }

        return res.status(200).send({
            success: true,
            message: 'Payment status updated successfully',
            data: payment,
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
// Get All Payments (Admin)
// ============================
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, per_page = 10, payment_status } = req.query;

        const options = {
            skip: (page - 1) * per_page,
            limit: parseInt(per_page),
        };

        let filter = {};

        if (payment_status) {
            filter.payment_status = payment_status;
        }

        const payments = await Payment.find(filter, {}, options)
            .populate('booking_id')
            .populate('user_id', 'first_name last_name email')
            .sort({ createdAt: -1 });

        const total = await Payment.countDocuments(filter);

        return res.status(200).send({
            success: true,
            total,
            data: payments,
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
    createBookingPayment,
    getPaymentById,
    updatePaymentStatus,
    getAllPayments,
};

