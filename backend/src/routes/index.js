const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const familyRoutes = require('./familyRoutes');
const bowlsRoutes = require('./bowlsRoutes');
const contributionsRoutes = require('./contributionsRoutes');
const expensesRoutes = require('./expensesRoutes');
const goalsRoutes = require('./goalsRoutes');
const monoRoutes = require('./monoRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const notificationsRoutes = require('./notificationsRoutes');

// API Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'OnePot Family Bank API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
router.use('/auth', authRoutes);
router.use('/family', familyRoutes);
router.use('/bowls', bowlsRoutes);
router.use('/contributions', contributionsRoutes);
router.use('/expenses', expensesRoutes);
router.use('/goals', goalsRoutes);
router.use('/mono', monoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);

module.exports = router;

