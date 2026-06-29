const express = require("express");
const {
  upload,
  uploadScreenshot,
  uploadScreenshotBase64,
  getEmployeeScreenshots,
  saveScreenshot,
  deleteScreenshot,
} = require("../controllers/screenshot.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/upload",
  protect,
  allowRoles("EMPLOYEE"),
  upload.single("screenshot"),
  uploadScreenshot
);

router.post(
  "/upload-base64",
  protect,
  allowRoles("EMPLOYEE"),
  uploadScreenshotBase64
);

router.get(
  "/employee/:employeeId",
  protect,
  allowRoles("ADMIN"),
  getEmployeeScreenshots
);

router.patch(
  "/:screenshotId/save",
  protect,
  allowRoles("ADMIN"),
  saveScreenshot
);

router.delete(
  "/:screenshotId",
  protect,
  allowRoles("ADMIN"),
  deleteScreenshot
);

module.exports = router;