const express = require('express');

const router = express.Router();

const { createOrder, getOpenOrders, executeTrade } = require('../controllers/orderController');

router.post('/', createOrder);
router.get('/', getOpenOrders);
router.post('/trade', executeTrade);

module.exports = router;
