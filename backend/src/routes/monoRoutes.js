const express = require('express');
const router = express.Router();
const monoController = require('../controllers/monoController');
const { authenticate, requireFamily } = require('../middleware/auth');

router.post('/link', authenticate, requireFamily, monoController.linkAccount);
router.get('/accounts', authenticate, requireFamily, monoController.getLinkedAccounts);

module.exports = router;

