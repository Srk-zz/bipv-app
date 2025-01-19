const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.post('/upload', upload.single('cityModel'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.json({
    success: true,
    filename: req.file.filename
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});