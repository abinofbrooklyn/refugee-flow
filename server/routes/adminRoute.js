const express = require('express');
const multer = require('multer');
const adminAuth = require('../middleware/adminAuth');
const { csvPreview, csvCommit, triggerIngestion } = require('../controllers/admin/adminController');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.use(express.json());
router.use(adminAuth);

router.post('/csv/preview', upload.single('file'), csvPreview);
router.post('/csv/commit', csvCommit);
router.post('/trigger/:source', triggerIngestion);

module.exports = router;
