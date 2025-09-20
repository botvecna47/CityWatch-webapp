const express = require('express');
const router = express.Router();

// Import route modules here when they are created
router.use('/auth', require('./auth'));
router.use('/reports', require('./reports'));
router.use('/cities', require('./cities'));
router.use('/users', require('./users'));
router.use('/comments', require('./comments'));
router.use('/attachments', require('./attachments'));
router.use('/notifications', require('./notifications'));
router.use('/admin', require('./admin'));
router.use('/alerts', require('./alerts'));
router.use('/events', require('./events'));
router.use('/ai', require('./ai'));
router.use('/analytics', require('./analytics'));
router.use('/city-change', require('./cityChange'));
router.use('/user-reports', require('./userReports'));

module.exports = router;
