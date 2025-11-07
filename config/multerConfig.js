import multer from 'multer';
import path from 'path';
import fs from 'fs';

const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(path.resolve(), 'uploads', 'voices');
    fs.mkdir(uploadPath, { recursive: true }, (error) => cb(error, uploadPath));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const voiceUpload = multer({ storage: voiceStorage });
