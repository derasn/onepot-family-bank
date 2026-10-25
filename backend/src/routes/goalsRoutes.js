const express = require('express');
const router = express.Router();
const goalsController = require('../controllers/goalsController');
const { authenticate, requireFamily, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireFamily, goalsController.getGoals);
router.post('/', authenticate, requireFamily, goalsController.createGoal);
router.post('/:id/contribute', authenticate, requireFamily, goalsController.contributeToGoal);
router.put('/:id/unlock', authenticate, requireFamily, requireAdmin, goalsController.unlockGoal);

module.exports = router;

