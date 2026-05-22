const multer = require('multer');

// Configure Multer to use memory storage (we will upload the buffer to Cloudinary directly)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
