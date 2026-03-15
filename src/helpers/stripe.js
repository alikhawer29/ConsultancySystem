const dotenv = require('dotenv')
const User = require("../models/user.model");
const Payment = require("../models/payment.model");
const Booking = require("../models/booking.model");
const { sendNotification } = require('./notification');

dotenv.config()

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const webhook = async (req, res) => {
    let event;

    try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_KEY);
    } catch (err) {
        console.error("⚠️ Webhook signature verification failed.", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle subscription invoice paid
    if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        let user = await User.findOne({ stripe_customer_id: invoice?.customer })
        console.log("✅ Invoice Paid: user", user);
        sendNotification({ title: "Subscription Success", body: "Success", data: { type: "subscription_success" } }, user?._id, false)
    }

    // Handle payment intent succeeded
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log("✅ Payment Intent Succeeded:", paymentIntent.id);

        try {
            // Find payment record
            const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });

            if (payment) {
                // Update payment status
                payment.payment_status = 'succeeded';
                payment.transaction_id = paymentIntent.id;
                payment.payment_method = paymentIntent.payment_method;
                await payment.save();

                // Update booking payment status
                const booking = await Booking.findById(payment.booking_id);
                if (booking) {
                    booking.payment_status = 'paid';
                    await booking.save();

                    // Send notification to user
                    sendNotification(
                        {
                            title: "Payment Success",
                            body: `Payment for booking ${booking.booking_id} completed successfully`,
                            data: { type: "payment_success", booking_id: booking._id.toString() }
                        },
                        payment.user_id,
                        false
                    );
                }
            }
        } catch (error) {
            console.error("Error updating payment status:", error);
        }
    }

    // Handle payment intent failed
    if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        console.log("❌ Payment Intent Failed:", paymentIntent.id);

        try {
            // Find payment record
            const payment = await Payment.findOne({ stripe_payment_intent_id: paymentIntent.id });

            if (payment) {
                // Update payment status
                payment.payment_status = 'failed';
                await payment.save();

                // Send notification to user
                sendNotification(
                    {
                        title: "Payment Failed",
                        body: "Your payment could not be processed. Please try again.",
                        data: { type: "payment_failed", booking_id: payment.booking_id.toString() }
                    },
                    payment.user_id,
                    false
                );
            }
        } catch (error) {
            console.error("Error updating payment status:", error);
        }
    }

    res.json({ received: true });
}

const createProduct = async (name, description, prices = [], metadata) => {
    try {

        const product = await stripe.products.create({ name, description, metadata });
        let p = []

        for (let index = 0; index < prices.length; index++) {

            const element = prices[index];

            const price = await stripe.prices.create({
                product: product.id,
                unit_amount: Math.round(element.amount * 100),
                currency: 'usd',
                recurring: { interval: element.interval },
            });

            p.push(price)

        }

        return { product, prices: p };

    } catch (error) {
        throw error;
    }
};

const createCustomer = async (email, name) => {
    try {
        const customer = await stripe.customers.create({ email, name });
        return customer.id;
    } catch (error) {
        throw error;
    }
};

const createSubscription = async (id, price_id) => {
    try {

        let customer_id = null;

        const user = await User.findById(id)

        if (user?.stripe_customer_id && user?.stripe_customer_id !== null) {
            customer_id = user.stripe_customer_id
        } else {
            customer_id = await createCustomer(user?.email, user?.name)
            user.stripe_customer_id = customer_id
            await user.save()
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            metadata: {
                user_id: user?._id?.toString(),
                user_name: user?.name,
            },
            customer: customer_id,
            success_url: `https://projectstagingzone.com/success`,
            cancel_url: `https://projectstagingzone.com/cancel`,
        });

        return session.url;

    } catch (error) {
        throw error;
    }
};

const getCurrentSubscription = async (id) => {
    try {

        let user = await User.findById(id)

        if (user && user?.stripe_customer_id) {
            const subscriptions = await stripe.subscriptions.list({ customer: user?.stripe_customer_id, status: 'active' });
            return subscriptions.data[0] || null;
        }

        return null

    } catch (error) {
        throw error;
    }
};

const getAllPaymentLogs = async () => {
    try {

        const subscriptions = (
            await stripe.subscriptions.list({
                expand: ['data.items.data.price', 'data.latest_invoice']
            })
        ).data

        const productIds = new Set()
        const customerIds = new Set()

        subscriptions.forEach(sub => {
            const price = sub.items.data[0]?.price
            if (price?.product) productIds.add(price.product)
            if (sub.customer) customerIds.add(sub.customer)
        })

        const productsMap = {}
        await Promise.all(
            Array.from(productIds).map(async productId => {
                const product = await stripe.products.retrieve(productId)
                productsMap[productId] = product.name
            })
        )

        const users = await User.find({
            stripe_customer_id: { $in: Array.from(customerIds) }
        })
            .select('name email picture _id stripe_customer_id')
            .lean()

        const usersMap = {}
        users.forEach(user => {
            usersMap[user.stripe_customer_id] = user
        })

        return subscriptions.map(sub => {

            const price = sub.items.data[0]?.price

            return {
                subscription_id: sub.id,
                active: sub.status === 'active',
                customer_id: sub.customer,
                user: usersMap[sub.customer] || null,
                amount: price?.unit_amount / 100,
                currency: sub.currency.toUpperCase(),
                interval: price?.recurring?.interval
                    ? price.recurring.interval.charAt(0).toUpperCase() +
                    price.recurring.interval.slice(1) + 'ly'
                    : null,
                start_date: new Date(sub.start_date * 1000).toISOString(),
                current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
                current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                invoice_link: sub.latest_invoice?.hosted_invoice_url || null,
                package_name: price?.product ? productsMap[price.product] : null
            }
        })


    } catch (error) {
        throw error;
    }
};

const getUserPaymentLogs = async (id) => {
    try {

        let user = await User.findById(id)

        if (user && user?.stripe_customer_id) {
            return (await stripe.subscriptions.list({ customer: user?.stripe_customer_id })).data;
        }

        return []

    } catch (error) {
        throw error;
    }
};

const getAllProductsWithPrices = async () => {
    try {

        const products = await stripe.products.list();
        const prices = await stripe.prices.list();
        return products.data.map(product => ({
            ...product,
            prices: prices.data.filter(price => price.product === product.id),
        }));

    } catch (error) {
        throw error;
    }
};

const getProductWithPrices = async (id) => {
    try {

        const product = await stripe.products.retrieve(id);
        const prices = await stripe.prices.list({ product: id });
        return {
            ...product,
            prices: prices.data,
        }

    } catch (error) {
        throw error;
    }
};

const updateProduct = async (id, payload) => {
    try {

        let product = await stripe.products.update(id, payload)

        return product

    } catch (error) {
        throw error;
    }
};

const getTotalSubscriptionRevenue = async () => {

    try {
        const subscriptions = (
            await stripe.subscriptions.list({
                expand: ['data.items.data.price', 'data.latest_invoice']
            })
        ).data;

        let total = 0;

        subscriptions.forEach(sub => {

            const price = sub.items.data[0]?.price;
            const amount = price?.unit_amount / 100 || 0;

            if (sub.status === 'active') {
                total += amount;
            }
        });

        return total

    } catch (error) {
        throw error;
    }
}

const createPaymentIntent = async (userId, amount, currency = 'usd', metadata = {}) => {
    try {
        let customer_id = null;

        const user = await User.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        // Get or create Stripe customer
        if (user?.stripe_customer_id && user?.stripe_customer_id !== null) {
            customer_id = user.stripe_customer_id;
        } else {
            customer_id = await createCustomer(user?.email, `${user?.first_name} ${user?.last_name}`);
            user.stripe_customer_id = customer_id;
            await user.save();
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency,
            customer: customer_id,
            metadata: metadata,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            customerId: customer_id,
        };

    } catch (error) {
        throw error;
    }
};

/**
 * Create a refund for a payment intent
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {number} amount - Amount to refund in dollars (will be converted to cents)
 * @param {string} reason - Reason for refund (must be: 'duplicate', 'fraudulent', or 'requested_by_customer')
 * @returns {object} - Refund object from Stripe
 */
const createRefund = async (paymentIntentId, amount, reason = 'requested_by_customer') => {
    try {
        // Stripe only accepts these specific reasons
        const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
        const stripeReason = validReasons.includes(reason) ? reason : 'requested_by_customer';

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: Math.round(amount * 100), // Convert to cents
            reason: stripeReason,
        });

        return refund;
    } catch (error) {
        console.error('Error creating refund:', error);
        throw error;
    }
};

/**
 * Transfer money to admin account (for provider compensation)
 * Note: This requires Stripe Connect to be set up
 * For now, we'll just track it in the database
 * @param {number} amount - Amount to transfer
 * @param {string} description - Description of transfer
 */
const transferToAdmin = async (amount, description) => {
    try {
        // TODO: Implement actual Stripe transfer when Connect is set up
        // For now, just log it
        console.log(`💰 Admin compensation: $${amount} - ${description}`);

        // In production, you would do:
        // const transfer = await stripe.transfers.create({
        //     amount: Math.round(amount * 100),
        //     currency: 'usd',
        //     destination: process.env.ADMIN_STRIPE_ACCOUNT_ID,
        //     description: description,
        // });

        return {
            success: true,
            amount: amount,
            description: description,
        };
    } catch (error) {
        console.error('Error transferring to admin:', error);
        throw error;
    }
};

module.exports = {
    webhook,
    createProduct,
    createCustomer,
    createSubscription,
    getCurrentSubscription,
    getAllPaymentLogs,
    getUserPaymentLogs,
    getAllProductsWithPrices,
    getProductWithPrices,
    updateProduct,
    getTotalSubscriptionRevenue,
    createPaymentIntent,
    createRefund,
    transferToAdmin
};
