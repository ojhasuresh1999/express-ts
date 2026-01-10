import multer, { FileFilterCallback } from 'multer';
import { Request, RequestHandler } from 'express';
import path from 'path';
import fs from 'fs';
import config from '../config';
import { ApiError } from '../utils/ApiError';
import { StatusCodes } from 'http-status-codes';

// Ensure temp upload directory exists
const tempUploadDir = path.join(process.cwd(), 'uploads', 'temp');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// File filter for validation
const createFileFilter = (allowedTypes: string[]) => {
  return (_req: Request, file: Express.Multer.File, callback: FileFilterCallback): void => {
    if (allowedTypes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new ApiError(
          StatusCodes.UNSUPPORTED_MEDIA_TYPE,
          `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
        )
      );
    }
  };
};

// Memory storage for small files (processed in-memory)
const memoryStorage = multer.memoryStorage();

// Disk storage for large files
const diskStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, tempUploadDir);
  },
  filename: (_req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Image upload middleware (memory storage for compression)
export const uploadImage = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.upload.maxImageSizeMB * 1024 * 1024,
  },
  fileFilter: createFileFilter(config.upload.allowedImageTypes),
});

// Video upload middleware (disk storage for large files)
export const uploadVideo = multer({
  storage: diskStorage,
  limits: {
    fileSize: config.upload.maxVideoSizeMB * 1024 * 1024,
  },
  fileFilter: createFileFilter(config.upload.allowedVideoTypes),
});

// Document upload middleware
export const uploadDocument = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: createFileFilter(config.upload.allowedDocumentTypes),
});

// Any file type (with size limit)
export const uploadAny = multer({
  storage: diskStorage,
  limits: {
    fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
  },
  fileFilter: createFileFilter([
    ...config.upload.allowedImageTypes,
    ...config.upload.allowedVideoTypes,
    ...config.upload.allowedDocumentTypes,
  ]),
});

// Single image upload
export const singleImage: RequestHandler = uploadImage.single('image');

// Multiple images upload (max 10)
export const multipleImages: RequestHandler = uploadImage.array('images', 10);

// Single video upload
export const singleVideo: RequestHandler = uploadVideo.single('video');

// Single document upload
export const singleDocument: RequestHandler = uploadDocument.single('document');

// Mixed file upload (images and documents)
export const mixedUpload: RequestHandler = uploadAny.fields([
  { name: 'images', maxCount: 10 },
  { name: 'documents', maxCount: 5 },
  { name: 'video', maxCount: 1 },
]);

// Cleanup temporary files after request
export const cleanupTempFiles = async (filePaths: string[]): Promise<void> => {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error(`Failed to cleanup temp file: ${filePath}`, error);
    }
  }
};
