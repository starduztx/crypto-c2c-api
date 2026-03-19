const prisma = require('../utils/prismaClient');

// 5. Internal Transfer: Transfer Money/Crypto to another user
const transfer = async (req, res) => {
    try {
        // from_user_id (คนโอน), to_user_id (คนรับ), currency (THB, BTC, etc.), amount (จำนวน)
        const { from_user_id, to_user_id, currency, amount } = req.body;

        if (from_user_id === to_user_id) throw new Error("Cannot transfer to yourself");
        if (amount <= 0) throw new Error("Amount must be greater than zero");

        const result = await prisma.$transaction(async (tx) => {
            // Check sender's wallet
            const senderWallet = await tx.wallet.findFirst({
                where: { user_id: from_user_id, currency }
            });
            if (!senderWallet || Number(senderWallet.balance) < amount) {
                throw new Error(`Insufficient ${currency} balance to transfer`);
            }

            // Check or create receiver's wallet
            let receiverWallet = await tx.wallet.findFirst({
                where: { user_id: to_user_id, currency }
            });

            // If receiver doesn't have a wallet for this currency, create it!
            if (!receiverWallet) {
                receiverWallet = await tx.wallet.create({
                    data: { user_id: to_user_id, currency, balance: 0 }
                });
            }

            // Deduct from Sender
            await tx.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount } }
            });

            // Add to Receiver
            await tx.wallet.update({
                where: { id: receiverWallet.id },
                data: { balance: { increment: amount } }
            });

            // Record the transaction!
            const transactionRecord = await tx.transaction.create({
                data: {
                    from_user_id,
                    to_user_id,
                    currency,
                    amount,
                    transaction_type: 'TRANSFER_INTERNAL'
                }
            });

            return transactionRecord;
        });

        res.json({ message: "Transfer successful", transaction: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 6. Get User Transactions (History)
const getUserTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);

        // ดึงประวัติทั้งหมดที่ user คนนี้เป็นคนส่ง หรือ คนรับ
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [
                    { from_user_id: userId },
                    { to_user_id: userId }
                ]
            },
            orderBy: { created_at: 'desc' }
        });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 7. External Transfer: Transfer Money/Crypto outside
const transferExternal = async (req, res) => {
    try {
        const { from_user_id, external_address, currency, amount } = req.body;

        if (!external_address) throw new Error("External address is required");
        if (amount <= 0) throw new Error("Amount must be greater than zero");

        const result = await prisma.$transaction(async (tx) => {
            const senderWallet = await tx.wallet.findFirst({
                where: { user_id: from_user_id, currency }
            });
            if (!senderWallet || Number(senderWallet.balance) < amount) {
                throw new Error(`Insufficient ${currency} balance to transfer externally`);
            }

            // Deduct from Sender
            await tx.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount } }
            });

            // Record the transaction!
            const transactionRecord = await tx.transaction.create({
                data: {
                    from_user_id,
                    external_address,
                    currency,
                    amount,
                    transaction_type: 'TRANSFER_EXTERNAL'
                }
            });

            return transactionRecord;
        });

        res.json({ message: "External transfer successful", transaction: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// 8. Swap Currency (THB <-> USD)
const swapCurrency = async (req, res) => {
    try {
        const { user_id, from_currency, to_currency, amount } = req.body;

        if (amount <= 0) throw new Error("Amount must be greater than zero");

        // Basic Rate System
        let rate = 1; 
        if (from_currency === 'THB' && to_currency === 'USD') {
            rate = 1 / 35; // 35 THB = 1 USD
        } else if (from_currency === 'USD' && to_currency === 'THB') {
            rate = 35; // 1 USD = 35 THB
        } else {
            throw new Error("Currency pair not supported for direct swap (Only THB <-> USD supported currently)");
        }

        const receiveAmount = amount * rate;

        const result = await prisma.$transaction(async (tx) => {
            const senderWallet = await tx.wallet.findFirst({
                where: { user_id, currency: from_currency }
            });
            if (!senderWallet || Number(senderWallet.balance) < amount) {
                throw new Error(`Insufficient ${from_currency} balance to swap`);
            }

            let receiverWallet = await tx.wallet.findFirst({
                where: { user_id, currency: to_currency }
            });
            if (!receiverWallet) {
                receiverWallet = await tx.wallet.create({
                    data: { user_id, currency: to_currency, balance: 0 }
                });
            }

            // Deduct
            await tx.wallet.update({
                where: { id: senderWallet.id },
                data: { balance: { decrement: amount } }
            });
            // Add
            await tx.wallet.update({
                where: { id: receiverWallet.id },
                data: { balance: { increment: receiveAmount } }
            });

            const transactionRecord = await tx.transaction.create({
                data: {
                    from_user_id: user_id,
                    to_user_id: user_id,
                    currency: `${from_currency}_TO_${to_currency}`,
                    amount: amount,
                    transaction_type: 'SWAP'
                }
            });

            return transactionRecord;
        });

        res.json({ 
            message: "Swap successful", 
            transaction: result, 
            received: receiveAmount, 
            currency: to_currency 
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    transfer,
    getUserTransactions,
    transferExternal,
    swapCurrency
};
