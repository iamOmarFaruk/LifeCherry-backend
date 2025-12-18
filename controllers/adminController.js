const Lesson = require('../models/Lesson');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Get Weekly Progress (Last 7 Days)
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const [weeklyUsers, weeklyLessons] = await Promise.all([
            User.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            Lesson.aggregate([
                {
                    $match: {
                        createdAt: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Format weekly data to ensure all 7 days are represented
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = days[d.getDay()];

            const userCount = weeklyUsers.find(u => u._id === dateStr)?.count || 0;
            const lessonCount = weeklyLessons.find(l => l._id === dateStr)?.count || 0;

            last7Days.push({
                day: dayName,
                date: dateStr,
                users: userCount,
                lessons: lessonCount
            });
        }

        // 2. Get Revenue Trend (Last 6 Months)
        // For now, since we don't have a Transaction model, we calculate based on Premium users
        // and mock historical data if there's no data.
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const premiumPrice = 1500;

        // In a real app, we'd query a Transactions collection. 
        // Here we'll group premium users by their subscription date (if available) or createdAt.
        const monthlyRevenue = await User.aggregate([
            {
                $match: {
                    isPremium: true,
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const revenueTrend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today);
            d.setMonth(d.getMonth() - i);
            const monthKey = d.toISOString().slice(0, 7);
            const monthName = months[d.getMonth()];

            const premiumInMonth = monthlyRevenue.find(m => m._id === monthKey)?.count || 0;

            // If no data, use a small growth pattern for demonstration if it's past month
            // but if it's the current month, use real count.
            // This is a bridge between mock and real until full payment system is in.
            let revenue = premiumInMonth * premiumPrice;

            revenueTrend.push({
                month: monthName,
                revenue: revenue,
                subscriptions: premiumInMonth
            });
        }

        // 3. Overall Stats (Redundant but convenient for one-call fetch)
        const [totalUsers, totalLessons, totalReports, premiumUsers] = await Promise.all([
            User.countDocuments({}),
            Lesson.countDocuments({}),
            Lesson.countDocuments({ reportCount: { $gt: 0 } }),
            User.countDocuments({ isPremium: true })
        ]);

        res.status(200).json({
            summary: {
                totalUsers,
                totalLessons,
                totalReports,
                premiumUsers,
                premiumPrice
            },
            weeklyStats: last7Days,
            revenueTrend: revenueTrend
        });

    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error.message });
    }
};
