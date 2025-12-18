const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Payment = require('../models/Payment');
const { logChange } = require('./auditController');

// Helper to sanitize payment for response
const sanitizePayment = (payment) => {
    return {
        id: payment._id,
        userId: payment.userId,
        userEmail: payment.userEmail,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        date: payment.createdAt,
    };
};

// Create Checkout Session
exports.createCheckoutSession = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const user = await User.findOne({ email: userEmail });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isPremium) {
            return res.status(400).json({ message: 'User is already premium' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'bdt',
                        product_data: {
                            name: 'LifeCherry Premium Membership',
                            description: 'Lifetime access to all premium features',
                            images: ['https://lifecherry.com/logo.png'], // Replace with actual logo URL if available
                        },
                        unit_amount: 1500 * 100, // 1500 BDT in paisa
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
            customer_email: userEmail,
            metadata: {
                userId: user._id.toString(),
                userEmail: userEmail,
            },
        });

        // Create a pending payment record
        await Payment.create({
            stripeSessionId: session.id,
            userId: user._id,
            userEmail: userEmail,
            amount: 1500,
            currency: 'BDT',
            status: 'pending',
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe Session Error:', error);
        res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
    }
};

// Webhook Handler
exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // req.rawBody must be available (we need to configure express for this)
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            await handleCheckoutSessionCompleted(session);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
};

const handleCheckoutSessionCompleted = async (session) => {
    const payment = await Payment.findOne({ stripeSessionId: session.id });

    if (payment) {
        payment.status = 'completed';
        payment.paymentMethod = session.payment_method_types[0];
        await payment.save();

        // Update user to premium
        const user = await User.findById(payment.userId);
        if (user) {
            user.isPremium = true;
            await user.save();

            await logChange({
                actorEmail: 'system',
                actorName: 'System (Stripe)',
                actorRole: 'admin',
                targetType: 'user',
                targetId: user._id.toString(),
                targetOwnerEmail: user.email,
                action: 'payment-success',
                summary: 'User upgraded to Premium via Stripe',
                metadata: { sessionId: session.id, amount: payment.amount }
            });
        }
    } else {
        console.error('Payment record not found for session:', session.id);
        // Fallback: try to find user by metadata if payment record creation failed (unlikely but possible)
        if (session.metadata && session.metadata.userId) {
            await User.findByIdAndUpdate(session.metadata.userId, { isPremium: true });
        }
    }
};

// Get All Payments (Admin)
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find().sort({ createdAt: -1 }).lean();
        res.json({ payments: payments.map(sanitizePayment) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
    }
};

// Verify Payment Success (Frontend Polling/Confirm)
exports.verifyPayment = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { sessionId } = req.body;

        if (!sessionId) return res.status(400).json({ message: 'Session ID required' });

        // 1. Check local DB first
        let payment = await Payment.findOne({ stripeSessionId: sessionId });

        // 2. If status is pending or payment not found, check Stripe directly
        // This is crucial for localhost where webhooks might fail/not be configured
        if (!payment || payment.status !== 'completed') {
            try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);

                if (session.payment_status === 'paid') {
                    // Update/Create Payment
                    if (payment) {
                        payment.status = 'completed';
                        payment.paymentMethod = session.payment_method_types[0] || 'card';
                        await payment.save();
                    } else {
                        // Should have been created, but just in case
                        payment = await Payment.create({
                            stripeSessionId: session.id,
                            userId: req.user._id, // Assume current user if not found
                            userEmail: userEmail,
                            amount: session.amount_total / 100,
                            currency: session.currency.toUpperCase(),
                            status: 'completed',
                            paymentMethod: session.payment_method_types[0] || 'card',
                        });
                    }

                    // Update User
                    const user = await User.findOne({ email: userEmail });
                    if (user && !user.isPremium) {
                        user.isPremium = true;
                        await user.save();

                        // Log audit only if we are taking action
                        await logChange({
                            actorEmail: userEmail,
                            actorName: user.name || 'User',
                            actorRole: 'user',
                            targetType: 'user',
                            targetId: user._id.toString(),
                            targetOwnerEmail: userEmail,
                            action: 'payment-success-verify',
                            summary: 'User upgraded to Premium via verification (fallback)',
                            metadata: { sessionId, amount: payment.amount }
                        });
                    }
                }
            } catch (stripeError) {
                console.error('Stripe Verification Error:', stripeError);
                // Continue to return current state if stripe fails
            }
        }

        // Refetch user to get latest status
        const updatedUser = await User.findOne({ email: userEmail });
        const finalPayment = await Payment.findOne({ stripeSessionId: sessionId });

        res.json({
            success: finalPayment?.status === 'completed',
            isPremium: !!updatedUser?.isPremium
        });
    } catch (error) {
        console.error('Verification generic error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
}
