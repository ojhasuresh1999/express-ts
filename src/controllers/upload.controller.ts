import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import cloudinaryService, { UploadOptions } from '../services/cloudinary.service';
import compressionService from '../services/compression.service';
import tusService from '../services/tus.service';
import { cleanupTempFiles } from '../middlewares/upload.middleware';
import { sendSuccess, sendError } from '../utils/response';
import logger from '../utils/logger';
import config from '../config';

/**
 * Upload single image with optional compression
 */
export const uploadImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No image file provided', StatusCodes.BAD_REQUEST);
      return;
    }

    const { folder, quality, maxWidth, maxHeight, format, compress } = req.body;
    let fileBuffer = req.file.buffer;
    let compressionResult = null;

    // Apply compression if requested (default: true for images)
    const shouldCompress = compress !== 'false' && compress !== false;

    if (shouldCompress) {
      const compressionOptions = {
        quality: quality ? parseInt(quality, 10) : config.upload.compressionQuality,
        maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
        maxHeight: maxHeight ? parseInt(maxHeight, 10) : undefined,
        format: format || 'jpeg',
      };

      compressionResult = await compressionService.compressImage(fileBuffer, compressionOptions);
      fileBuffer = compressionResult.buffer;
    }

    // Upload to Cloudinary
    const uploadOptions: UploadOptions = {
      folder: folder || 'images',
    };

    const result = await cloudinaryService.uploadImage(fileBuffer, uploadOptions);

    sendSuccess(
      res,
      {
        ...result,
        compression: compressionResult
          ? {
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.compressedSize,
              compressionRatio: compressionResult.compressionRatio.toFixed(2) + '%',
            }
          : null,
      },
      'Image uploaded successfully'
    );
  } catch (error) {
    logger.error('Image upload failed:', error);
    next(error);
  }
};

/**
 * Upload multiple images
 */
export const uploadMultipleImages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      sendError(res, 'No image files provided', StatusCodes.BAD_REQUEST);
      return;
    }

    const { folder, compress } = req.body;
    const shouldCompress = compress !== 'false' && compress !== false;
    const results = [];

    for (const file of files) {
      let fileBuffer = file.buffer;
      let compressionResult = null;

      if (shouldCompress) {
        compressionResult = await compressionService.compressImage(fileBuffer, {
          quality: config.upload.compressionQuality,
        });
        fileBuffer = compressionResult.buffer;
      }

      const result = await cloudinaryService.uploadImage(fileBuffer, {
        folder: folder || 'images',
      });

      results.push({
        ...result,
        originalFilename: file.originalname,
        compression: compressionResult
          ? {
              originalSize: compressionResult.originalSize,
              compressedSize: compressionResult.compressedSize,
              compressionRatio: compressionResult.compressionRatio.toFixed(2) + '%',
            }
          : null,
      });
    }

    sendSuccess(res, { images: results }, `${results.length} images uploaded successfully`);
  } catch (error) {
    logger.error('Multiple image upload failed:', error);
    next(error);
  }
};

/**
 * Upload single video
 */
export const uploadVideo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      sendError(res, 'No video file provided', StatusCodes.BAD_REQUEST);
      return;
    }

    const { folder } = req.body;

    // For large videos, use chunked upload
    const fileSizeMB = req.file.size / (1024 * 1024);
    let result;

    if (fileSizeMB > 100) {
      // Use large file upload for videos > 100MB
      result = await cloudinaryService.uploadLargeFile(req.file.path, {
        folder: folder || 'videos',
        resourceType: 'video',
      });
    } else {
      result = await cloudinaryService.uploadVideo(req.file.path, {
        folder: folder || 'videos',
      });
    }

    // Cleanup temp file
    if (tempFilePath) {
      await cleanupTempFiles([tempFilePath]);
    }

    sendSuccess(
      res,
      {
        ...result,
        originalFilename: req.file.originalname,
        originalSize: req.file.size,
      },
      'Video uploaded successfully'
    );
  } catch (error) {
    // Cleanup temp file on error
    if (tempFilePath) {
      await cleanupTempFiles([tempFilePath]);
    }
    logger.error('Video upload failed:', error);
    next(error);
  }
};

/**
 * Upload document/raw file
 */
export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, 'No document file provided', StatusCodes.BAD_REQUEST);
      return;
    }

    const { folder } = req.body;

    const result = await cloudinaryService.uploadRaw(req.file.buffer, {
      folder: folder || 'documents',
      publicId: req.file.originalname.replace(/\.[^/.]+$/, ''), // Remove extension
    });

    sendSuccess(
      res,
      {
        ...result,
        originalFilename: req.file.originalname,
        originalSize: req.file.size,
      },
      'Document uploaded successfully'
    );
  } catch (error) {
    logger.error('Document upload failed:', error);
    next(error);
  }
};

/**
 * Upload large file with chunked upload
 */
export const uploadLargeFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      sendError(res, 'No file provided', StatusCodes.BAD_REQUEST);
      return;
    }

    const { folder, resourceType } = req.body;

    const result = await cloudinaryService.uploadLargeFile(req.file.path, {
      folder: folder || 'large-files',
      resourceType: resourceType || 'auto',
    });

    // Cleanup temp file
    if (tempFilePath) {
      await cleanupTempFiles([tempFilePath]);
    }

    sendSuccess(
      res,
      {
        ...result,
        originalFilename: req.file.originalname,
        originalSize: req.file.size,
      },
      'Large file uploaded successfully'
    );
  } catch (error) {
    // Cleanup temp file on error
    if (tempFilePath) {
      await cleanupTempFiles([tempFilePath]);
    }
    logger.error('Large file upload failed:', error);
    next(error);
  }
};

/**
 * Delete media from Cloudinary
 */
export const deleteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { publicId } = req.params;
    const resourceType = (req.query.resourceType as 'image' | 'video' | 'raw') || 'image';

    const result = await cloudinaryService.deleteMedia(publicId, resourceType);

    if (result.success) {
      sendSuccess(res, result, 'Media deleted successfully');
    } else {
      sendError(res, 'Media not found or already deleted', StatusCodes.NOT_FOUND);
    }
  } catch (error) {
    logger.error('Media deletion failed:', error);
    next(error);
  }
};

/**
 * Get media information
 */
export const getMediaInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { publicId } = req.params;
    const resourceType = (req.query.resourceType as 'image' | 'video' | 'raw') || 'image';

    const result = await cloudinaryService.getMediaInfo(publicId, resourceType);

    sendSuccess(res, result, 'Media info retrieved');
  } catch (error) {
    logger.error('Get media info failed:', error);
    next(error);
  }
};

/**
 * Get resumable upload endpoint info
 */
export const getResumableUploadInfo = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    sendSuccess(
      res,
      {
        endpoint: tusService.getEndpoint(),
        maxSize: config.upload.maxFileSizeMB * 1024 * 1024,
        chunkSize: config.upload.tusChunkSizeMB * 1024 * 1024,
        allowedTypes: [
          ...config.upload.allowedImageTypes,
          ...config.upload.allowedVideoTypes,
          ...config.upload.allowedDocumentTypes,
        ],
      },
      'Resumable upload info'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get resumable upload status
 */
export const getUploadStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { uploadId } = req.params;

    const result = await tusService.getUploadResult(uploadId);

    if (result.status === 'not_found') {
      sendError(res, 'Upload not found', StatusCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, result, 'Upload status retrieved');
  } catch (error) {
    logger.error('Get upload status failed:', error);
    next(error);
  }
};

/**
 * Generate signed upload URL for client-side uploads
 */
export const getSignedUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { folder, resourceType, maxFileSize } = req.query;

    const signedData = cloudinaryService.generateSignedUploadUrl({
      folder: folder as string,
      resourceType: resourceType as 'image' | 'video' | 'raw' | 'auto',
      maxFileSize: maxFileSize ? parseInt(maxFileSize as string, 10) : undefined,
    });

    sendSuccess(res, signedData, 'Signed upload URL generated');
  } catch (error) {
    logger.error('Generate signed URL failed:', error);
    next(error);
  }
};

export default {
  uploadImage,
  uploadMultipleImages,
  uploadVideo,
  uploadDocument,
  uploadLargeFile,
  deleteMedia,
  getMediaInfo,
  getResumableUploadInfo,
  getUploadStatus,
  getSignedUploadUrl,
};
