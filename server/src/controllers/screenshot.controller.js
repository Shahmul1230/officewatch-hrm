const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../config/prisma");

const screenshotDir = path.join(__dirname, "..", "uploads", "screenshots");

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

function getExpiryDate() {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

function getFilePathFromImageUrl(imageUrl) {
  if (!imageUrl) return null;

  const filename = path.basename(imageUrl);
  return path.join(screenshotDir, filename);
}

function safeDeleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("File delete failed:", error.message);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, screenshotDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || ".jpg") || ".jpg";
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const uploadScreenshot = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can upload screenshots.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Screenshot file is required.",
      });
    }

    const imageUrl = `/uploads/screenshots/${req.file.filename}`;

    const screenshot = await prisma.screenshot.create({
      data: {
        employeeId: req.user.employee.id,
        imageUrl,
        pcName: req.body.pcName || req.user.employee.pcName,
        isSaved: false,
        expiresAt: getExpiryDate(),
      },
    });

    await prisma.employee.update({
      where: { id: req.user.employee.id },
      data: {
        pcName: req.body.pcName || req.user.employee.pcName,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Screenshot uploaded successfully.",
      screenshot,
    });
  } catch (error) {
    console.error("Upload screenshot error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while uploading screenshot.",
      error: error.message,
    });
  }
};

const uploadScreenshotBase64 = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can upload screenshots.",
      });
    }

    const { imageBase64, pcName } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: "imageBase64 is required.",
      });
    }

    const match = imageBase64.match(/^data:image\/(png|jpg|jpeg);base64,(.+)$/);

    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Invalid screenshot format.",
      });
    }

    const imageType = match[1] === "png" ? "png" : "jpg";
    const cleanBase64 = match[2];
    const buffer = Buffer.from(cleanBase64, "base64");

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid screenshot image.",
      });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${imageType}`;
    const filePath = path.join(screenshotDir, filename);

    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/screenshots/${filename}`;

    const screenshot = await prisma.screenshot.create({
      data: {
        employeeId: req.user.employee.id,
        imageUrl,
        pcName: pcName || req.user.employee.pcName,
        isSaved: false,
        expiresAt: getExpiryDate(),
      },
    });

    await prisma.employee.update({
      where: { id: req.user.employee.id },
      data: {
        pcName: pcName || req.user.employee.pcName,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Screenshot uploaded successfully.",
      screenshot,
    });
  } catch (error) {
    console.error("Base64 screenshot upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while uploading base64 screenshot.",
      error: error.message,
    });
  }
};

const getEmployeeScreenshots = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const screenshots = await prisma.screenshot.findMany({
      where: {
        employeeId,
        OR: [
          { isSaved: true },
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: {
        capturedAt: "desc",
      },
    });

    return res.json({
      success: true,
      screenshots,
    });
  } catch (error) {
    console.error("Get screenshots error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching screenshots.",
      error: error.message,
    });
  }
};

const saveScreenshot = async (req, res) => {
  try {
    const { screenshotId } = req.params;

    const screenshot = await prisma.screenshot.findUnique({
      where: { id: screenshotId },
    });

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        message: "Screenshot not found.",
      });
    }

    const updated = await prisma.screenshot.update({
      where: { id: screenshotId },
      data: {
        isSaved: true,
        savedAt: new Date(),
        expiresAt: null,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action: "SAVE_SCREENSHOT",
        targetId: screenshotId,
      },
    });

    return res.json({
      success: true,
      message: "Screenshot saved permanently.",
      screenshot: updated,
    });
  } catch (error) {
    console.error("Save screenshot error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while saving screenshot.",
      error: error.message,
    });
  }
};

const deleteScreenshot = async (req, res) => {
  try {
    const { screenshotId } = req.params;

    const screenshot = await prisma.screenshot.findUnique({
      where: { id: screenshotId },
    });

    if (!screenshot) {
      return res.status(404).json({
        success: false,
        message: "Screenshot not found.",
      });
    }

    const filePath = getFilePathFromImageUrl(screenshot.imageUrl);

    await prisma.screenshot.delete({
      where: { id: screenshotId },
    });

    safeDeleteFile(filePath);

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action: "DELETE_SCREENSHOT",
        targetId: screenshotId,
      },
    });

    return res.json({
      success: true,
      message: "Screenshot deleted successfully.",
    });
  } catch (error) {
    console.error("Delete screenshot error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting screenshot.",
      error: error.message,
    });
  }
};

const cleanupExpiredScreenshots = async () => {
  try {
    const expiredScreenshots = await prisma.screenshot.findMany({
      where: {
        isSaved: false,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (expiredScreenshots.length === 0) {
      console.log("Screenshot cleanup: no expired screenshots.");
      return;
    }

    for (const screenshot of expiredScreenshots) {
      const filePath = getFilePathFromImageUrl(screenshot.imageUrl);

      await prisma.screenshot.delete({
        where: { id: screenshot.id },
      });

      safeDeleteFile(filePath);
    }

    console.log(
      `Screenshot cleanup: deleted ${expiredScreenshots.length} expired screenshots.`
    );
  } catch (error) {
    console.error("Screenshot cleanup failed:", error.message);
  }
};

module.exports = {
  upload,
  uploadScreenshot,
  uploadScreenshotBase64,
  getEmployeeScreenshots,
  saveScreenshot,
  deleteScreenshot,
  cleanupExpiredScreenshots,
};