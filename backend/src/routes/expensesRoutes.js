const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expensesController');
const { authenticate, requireFamily, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireFamily, expensesController.getExpenses);
router.post('/', authenticate, requireFamily, expensesController.createExpense);
router.post('/emergency-borrow', authenticate, requireFamily, expensesController.requestEmergencyBorrow);
router.get('/:id', authenticate, requireFamily, expensesController.getExpenseById);

// Admin-only decision endpoint (Approve / Reject)
router.put('/:id/decision', authenticate, requireFamily, requireAdmin, expensesController.decideExpense);

module.exports = router;

