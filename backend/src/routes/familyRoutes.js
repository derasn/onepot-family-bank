const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const { authenticate, requireFamily, requireAdmin } = require('../middleware/auth');

router.post('/create', authenticate, familyController.createFamily);
router.post('/join', authenticate, familyController.joinFamily);

router.get('/details', authenticate, requireFamily, familyController.getFamilyDetails);
router.get('/members', authenticate, requireFamily, familyController.getFamilyMembers);

// Admin-only endpoints
router.put('/members/:memberId/role', authenticate, requireFamily, requireAdmin, familyController.updateMemberRole);
router.delete('/members/:memberId', authenticate, requireFamily, requireAdmin, familyController.removeMember);
router.post('/regenerate-invite', authenticate, requireFamily, requireAdmin, familyController.regenerateInviteCode);
router.put('/settings', authenticate, requireFamily, requireAdmin, familyController.updateFamilySettings);

module.exports = router;

