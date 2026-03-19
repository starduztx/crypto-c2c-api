const express = require('express');
const { transfer, getUserTransactions, transferExternal, swapCurrency } = require('../controllers/transactionController');
const RATES = require('../utils/rates');

const router = express.Router();

// 5. โอนเงิน/เหรียญ (ภายใน)
router.post('/transfer', transfer);

// 5.1 โอนเงิน/เหรียญ (ภายนอก)
router.post('/transfer-external', transferExternal);

// 6. ดูประวัติการทำธุรกรรมของ User
router.get('/user/:id', getUserTransactions);

// 8. Swap Currency (THB <-> USD)
router.post('/swap', swapCurrency);

// ของแถม (โบนัสคะแนน): API ดูเรตราคาอ้างอิง
router.get('/rates', (req, res) => {
    res.json(RATES);
});

module.exports = router;
