import { Router, type Router as RouterType } from 'express';
import uploadController from '../controllers/upload.controller';
import {
  singleImage,
  multipleImages,
  singleVideo,
  singleDocument,
  uploadAny,
} from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate';
import {
  uploadImageValidation,
  uploadVideoValidation,
  deleteMediaValidation,
  getMediaInfoValidation,
  getUploadStatusValidation,
} from '../validators/upload.validators';

const router: RouterType = Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Media upload management
 */

/**
 * @swagger
 * /upload/image:
 *   post:
 *     summary: Upload a single image with optional compression
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               folder:
 *                 type: string
 *               quality:
 *                 type: integer
 *               compress:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 */
router.post('/image', singleImage, validate(uploadImageValidation), uploadController.uploadImage);

/**
 * @swagger
 * /upload/images:
 *   post:
 *     summary: Upload multiple images
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 */
router.post(
  '/images',
  multipleImages,
  validate(uploadImageValidation),
  uploadController.uploadMultipleImages
);

/**
 * @swagger
 * /upload/video:
 *   post:
 *     summary: Upload a video file
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Video uploaded successfully
 */
router.post('/video', singleVideo, validate(uploadVideoValidation), uploadController.uploadVideo);

/**
 * @swagger
 * /upload/document:
 *   post:
 *     summary: Upload a document
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 */
router.post('/document', singleDocument, uploadController.uploadDocument);

/**
 * @swagger
 * /upload/large:
 *   post:
 *     summary: Upload a large file using chunked upload
 *     tags: [Upload]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Large file uploaded successfully
 */
router.post('/large', uploadAny.single('file'), uploadController.uploadLargeFile);

/**
 * @swagger
 * /upload/resumable/info:
 *   get:
 *     summary: Get resumable upload endpoint information
 *     tags: [Upload]
 *     responses:
 *       200:
 *         description: Resumable upload info retrieved
 */
router.get('/resumable/info', uploadController.getResumableUploadInfo);

/**
 * @swagger
 * /upload/resumable/status/{uploadId}:
 *   get:
 *     summary: Get status of a resumable upload
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Upload status retrieved
 */
router.get(
  '/resumable/status/:uploadId',
  validate(getUploadStatusValidation),
  uploadController.getUploadStatus
);

/**
 * @swagger
 * /upload/signed-url:
 *   get:
 *     summary: Get signed URL for client-side upload
 *     tags: [Upload]
 *     parameters:
 *       - in: query
 *         name: folder
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *           enum: [image, video, raw, auto]
 *     responses:
 *       200:
 *         description: Signed URL generated
 */
router.get('/signed-url', uploadController.getSignedUploadUrl);

/**
 * @swagger
 * /upload/{publicId}:
 *   delete:
 *     summary: Delete a media file
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *           enum: [image, video, raw]
 *     responses:
 *       200:
 *         description: Media deleted successfully
 */
router.delete('/:publicId', validate(deleteMediaValidation), uploadController.deleteMedia);

/**
 * @swagger
 * /upload/{publicId}:
 *   get:
 *     summary: Get media information
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: resourceType
 *         schema:
 *           type: string
 *           enum: [image, video, raw]
 *     responses:
 *       200:
 *         description: Media info retrieved
 */
router.get('/:publicId', validate(getMediaInfoValidation), uploadController.getMediaInfo);

export default router;
