const express = require('express');
const router = express.Router();
const bowlsController = require('../controllers/bowlsController');
const { authenticate, requireFamily, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, requireFamily, bowlsController.getBowls);
router.get('/unallocated-pot', authenticate, requireFamily, bowlsController.getUnallocatedPot);

// Admin-only management endpoints
router.post('/', authenticate, requireFamily, requireAdmin, bowlsController.createBowl);
router.put('/:id', authenticate, requireFamily, requireAdmin, bowlsController.updateBowl);
router.delete('/:id', authenticate, requireFamily, requireAdmin, bowlsController.deleteBowl);
router.post('/allocate', authenticate, requireFamily, requireAdmin, bowlsController.allocateFunds);

module.exports = router;

