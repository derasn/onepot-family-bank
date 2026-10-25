const express = require('express');
const router = express.Router();
const contributionsController = require('../controllers/contributionsController');
const { authenticate, requireFamily } = require('../middleware/auth');

router.post('/initialize', authenticate, requireFamily, contributionsController.initializeContribution);
router.post('/verify', authenticate, requireFamily, contributionsController.verifyContribution);
router.post('/manual', authenticate, requireFamily, contributionsController.manualContribution);
router.get('/', authenticate, requireFamily, contributionsController.getContributions);
router.get('/stats', authenticate, requireFamily, contributionsController.getContributionStats);

module.exports = router;

