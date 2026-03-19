const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL
});

async function main() {
    console.log(`Start seeding ...`);

    // เคลียร์ข้อมูลเก่าออกก่อนเริ่ม seed ใหม่
    await prisma.transaction.deleteMany();
    await prisma.order.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.user.deleteMany();

    // สร้าง User คนที่ 1 พร้อมกระเป๋าเงิน THB และ BTC
    const user1 = await prisma.user.create({
        data: {
            username: 'Kittith_Trader',
            email: 'kittituch@test.com',
            password_hash: 'hashed_pwd_123',
            kyc_status: 'VERIFIED',
            wallets: {
                create: [
                    { currency: 'THB', balance: 3000000.00 },
                    { currency: 'USD', balance: 0 },
                    { currency: 'BTC', balance: 0 },
                    { currency: 'ETH', balance: 0 },
                    { currency: 'XRP', balance: 0 },
                    { currency: 'DOGE', balance: 0 }
                ]
            }
        }
    });

    // สร้าง User คนที่ 2 พร้อมกระเป๋าเงิน BTC และ THB
    const user2 = await prisma.user.create({
        data: {
            username: 'Crypto_Whale',
            email: 'whale@test.com',
            password_hash: 'hashed_pwd_456',
            kyc_status: 'VERIFIED',
            wallets: {
                create: [
                    { currency: 'THB', balance: 0 },
                    { currency: 'USD', balance: 0 },
                    { currency: 'BTC', balance: 2.5 }, // มี 2.5 BTC
                    { currency: 'ETH', balance: 0 },
                    { currency: 'XRP', balance: 0 },
                    { currency: 'DOGE', balance: 0 }
                ]
            }
        }
    });

    // ให้ Crypto_Whale ตั้งออเดอร์ขาย 1.0 BTC ในราคา 2,500,000 THB
    const order1 = await prisma.order.create({
        data: {
            user_id: user2.id, // คนขายคือ Crypto_Whale
            order_type: 'SELL',
            crypto_currency: 'BTC',
            fiat_currency: 'THB',
            price: 2500000, // 2,500,000 THB per BTC
            amount: 0.1,    // Selling 0.1 BTC
            status: 'OPEN'
        }
    });

    // 3. Create an Order (Kittituch wants to buy 0.05 BTC for 125,000 THB)
    const order2 = await prisma.order.create({
        data: {
            user_id: user1.id,
            order_type: 'BUY',
            crypto_currency: 'BTC',
            fiat_currency: 'THB',
            price: 2500000,
            amount: 0.05,
            status: 'OPEN'
        }
    });

    console.log(`Seeding finished.`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
