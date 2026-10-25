const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate, requireFamily } = require('../middleware/auth');

router.get('/summary', authenticate, requireFamily, dashboardController.getDashboardSummary);
router.get('/report', authenticate, requireFamily, dashboardController.getPeriodicReport);

module.exports = router;

