const prisma = require('../utils/prismaClient');

// Create a new User and initialize their wallets
const createUser = async (req, res) => {
    try {
        const { username, email, password_hash } = req.body;

        const user = await prisma.user.create({
            data: {
                username,
                email,
                password_hash,
                wallets: {
                    create: [
                        { currency: 'THB', balance: 0 },
                        { currency: 'USD', balance: 0 },
                        { currency: 'BTC', balance: 0 },
                        { currency: 'ETH', balance: 0 },
                        { currency: 'XRP', balance: 0 },
                        { currency: 'DOGE', balance: 0 }
                    ]
                }
            },
            include: {
                wallets: true
            }
        });

        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a user with their wallets
const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: Number(id) },
            include: { wallets: true }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createUser,
    getUser
};
