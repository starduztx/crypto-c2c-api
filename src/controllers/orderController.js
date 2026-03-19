const prisma = require('../utils/prismaClient');

// Create a new C2C order
const createOrder = async (req, res) => {
    try {
        const { user_id, order_type, crypto_currency, fiat_currency, price, amount } = req.body;

        // ตรวจสอบยอดเงิน (Balance Validation) ก่อนเปิดออเดอร์
        if (order_type === 'SELL') {
            const cryptoWallet = await prisma.wallet.findFirst({
                where: { user_id, currency: crypto_currency }
            });
            
            // เช็กว่ามีกระเป๋าเหรียญไหม และยอดพอกับจำนวนที่ต้องการขายหรือไม่
            if (!cryptoWallet || Number(cryptoWallet.balance) < Number(amount)) {
                return res.status(400).json({ error: "Insufficient crypto balance" });
            }
        } else if (order_type === 'BUY') {
            const requiredFiat = Number(price) * Number(amount); // จำนวนเงิน Fiats ที่ต้องใช้ทั้งหมด
            const fiatWallet = await prisma.wallet.findFirst({
                where: { user_id, currency: fiat_currency }
            });
            
            // เช็กว่ามีกระเป๋าเงินเฟียตไหม และยอดเงินพอซื้อไหม
            if (!fiatWallet || Number(fiatWallet.balance) < requiredFiat) {
                return res.status(400).json({ error: "Insufficient fiat balance" });
            }
        }

        const order = await prisma.order.create({
            data: {
                user_id,
                order_type, // "BUY" or "SELL"
                crypto_currency,
                fiat_currency,
                price,
                amount,
                status: 'OPEN'
            }
        });

        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Open orders
const getOpenOrders = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { status: 'OPEN' },
            include: { user: { select: { username: true } } }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Match and execute an order
const executeTrade = async (req, res) => {
    try {
        const { order_id, buyer_id } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch the Order
            const order = await tx.order.findUnique({ where: { id: order_id } });
            if (!order) throw new Error("Order not found");
            if (order.status !== 'OPEN') throw new Error("Order is not open for trading");
            if (order.order_type !== 'SELL') throw new Error("Only SELL orders are supported for direct buy currently");

            const seller_id = order.user_id;
            if (buyer_id === seller_id) throw new Error("Cannot buy your own order");

            // Calculate total flat amount needed
            const totalFiatNeeded = Number(order.price) * Number(order.amount);
            const cryptoAmount = Number(order.amount);

            // 2. Fetch Wallets
            const buyerFiatWallet = await tx.wallet.findFirst({
                where: { user_id: buyer_id, currency: order.fiat_currency }
            });
            const buyerCryptoWallet = await tx.wallet.findFirst({
                where: { user_id: buyer_id, currency: order.crypto_currency }
            });

            const sellerFiatWallet = await tx.wallet.findFirst({
                where: { user_id: seller_id, currency: order.fiat_currency }
            });
            const sellerCryptoWallet = await tx.wallet.findFirst({
                where: { user_id: seller_id, currency: order.crypto_currency }
            });

            if (!buyerFiatWallet || Number(buyerFiatWallet.balance) < totalFiatNeeded) {
                throw new Error("Insufficient Fiat balance for buyer");
            }
            if (!sellerCryptoWallet || Number(sellerCryptoWallet.balance) < cryptoAmount) {
                throw new Error("Insufficient Crypto balance for seller");
            }

            // 3. Update Wallets (Deduct & Add)
            // Buyer pays Fiat, gets Crypto
            await tx.wallet.update({
                where: { id: buyerFiatWallet.id },
                data: { balance: { decrement: totalFiatNeeded } }
            });
            await tx.wallet.update({
                where: { id: buyerCryptoWallet.id },
                data: { balance: { increment: cryptoAmount } }
            });

            // Seller gets Fiat, pays Crypto
            await tx.wallet.update({
                where: { id: sellerFiatWallet.id },
                data: { balance: { increment: totalFiatNeeded } }
            });
            await tx.wallet.update({
                where: { id: sellerCryptoWallet.id },
                data: { balance: { decrement: cryptoAmount } }
            });

            // 4. Record Transaction
            const transaction = await tx.transaction.create({
                data: {
                    order_id: order.id,
                    from_user_id: buyer_id,
                    to_user_id: seller_id,
                    currency: order.crypto_currency,
                    amount: cryptoAmount,
                    transaction_type: 'TRADE'
                }
            });

            // 5. Close Order
            await tx.order.update({
                where: { id: order.id },
                data: { status: 'COMPLETED' }
            });

            return transaction;
        });

        res.json({ message: "Trade executed successfully", transaction: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createOrder,
    getOpenOrders,
    executeTrade
};
