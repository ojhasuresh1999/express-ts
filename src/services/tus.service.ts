import { Server, Upload } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { Application, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import config from '../config';
import cloudinaryService from './cloudinary.service';
import logger from '../utils/logger';

class TusService {
  private server: Server | null = null;
  private uploadDir: string;
  private tusPath: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'tus-temp');
    this.tusPath = '/api/upload/resumable';
    this.ensureUploadDir();
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info(`Created TUS upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * Initialize TUS server and attach to Express app
   */
  initialize(app: Application): void {
    // Create file store
    const fileStore = new FileStore({
      directory: this.uploadDir,
    });

    // Create TUS server
    this.server = new Server({
      path: this.tusPath,
      datastore: fileStore,
      maxSize: config.upload.maxFileSizeMB * 1024 * 1024,
      respectForwardedHeaders: true,
      namingFunction: () => {
        // Generate unique upload ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        return `${timestamp}-${random}`;
      },
      onUploadCreate: async (_req, upload) => {
        logger.info(`TUS upload created: ${upload.id}, size: ${upload.size}`);

        // Validate file type from metadata if available
        const metadata = upload.metadata;
        if (metadata?.filetype) {
          const allowedTypes = [
            ...config.upload.allowedImageTypes,
            ...config.upload.allowedVideoTypes,
            ...config.upload.allowedDocumentTypes,
          ];

          if (!allowedTypes.includes(metadata.filetype)) {
            throw { status_code: 415, body: `File type not allowed: ${metadata.filetype}` };
          }
        }

        return {};
      },
      onUploadFinish: async (_req, upload) => {
        logger.info(`TUS upload finished: ${upload.id}`);

        // Process completed upload
        try {
          await this.processCompletedUpload(upload);
        } catch (error) {
          logger.error('Failed to process completed upload:', error);
          // Don't throw - we'll let the client know through other means
        }

        return {};
      },
    });

    // Mount TUS server handler
    app.all(`${this.tusPath}/*`, (req: Request, res: Response) => {
      if (!this.server) {
        return res.status(500).json({ error: 'TUS server not initialized' });
      }
      return this.server.handle(req, res);
    });

    app.all(this.tusPath, (req: Request, res: Response) => {
      if (!this.server) {
        return res.status(500).json({ error: 'TUS server not initialized' });
      }
      return this.server.handle(req, res);
    });

    logger.info(`TUS server initialized at ${this.tusPath}`);
  }

  /**
   * Process completed upload - transfer to Cloudinary
   */
  private async processCompletedUpload(upload: Upload): Promise<void> {
    const filePath = path.join(this.uploadDir, upload.id);

    if (!fs.existsSync(filePath)) {
      logger.error(`Completed upload file not found: ${filePath}`);
      return;
    }

    try {
      const metadata = upload.metadata || {};
      const filename = metadata.filename || upload.id;
      const filetype = metadata.filetype || 'application/octet-stream';

      logger.info(`Processing TUS upload: ${filename}, type: ${filetype}`);

      // Determine upload type based on file type
      let result;
      if (filetype.startsWith('image/')) {
        result = await cloudinaryService.uploadImage(filePath, {
          folder: 'resumable/images',
          tags: ['resumable', 'tus'],
          context: { original_filename: filename },
        });
      } else if (filetype.startsWith('video/')) {
        // Use uploadVideo which handles videos properly
        result = await cloudinaryService.uploadVideo(filePath, {
          folder: 'resumable/videos',
          tags: ['resumable', 'tus'],
          context: { original_filename: filename },
        });
      } else {
        result = await cloudinaryService.uploadRaw(filePath, {
          folder: 'resumable/files',
          tags: ['resumable', 'tus'],
          context: { original_filename: filename },
        });
      }

      logger.info(`Upload transferred to Cloudinary: ${result.publicId}, URL: ${result.secureUrl}`);

      // Store the Cloudinary result for client retrieval
      const resultPath = path.join(this.uploadDir, `${upload.id}.result.json`);
      await fs.promises.writeFile(resultPath, JSON.stringify(result, null, 2));

      // Clean up local file after successful upload
      await this.cleanupFile(upload.id);
    } catch (error) {
      logger.error(`Failed to transfer upload to Cloudinary: ${upload.id}`, error);
      throw error;
    }
  }

  /**
   * Get upload status and result
   */
  async getUploadResult(
    uploadId: string,
    shouldCleanup: boolean = false
  ): Promise<{
    status: 'pending' | 'completed' | 'not_found';
    result?: Record<string, unknown>;
    progress?: number;
  }> {
    const resultPath = path.join(this.uploadDir, `${uploadId}.result.json`);
    const filePath = path.join(this.uploadDir, uploadId);
    const infoPath = path.join(this.uploadDir, `${uploadId}.json`);

    // Check if result exists (upload completed and processed)
    if (fs.existsSync(resultPath)) {
      const result = JSON.parse(await fs.promises.readFile(resultPath, 'utf-8'));

      if (shouldCleanup) {
        try {
          await fs.promises.unlink(resultPath);
          logger.info(`Cleaned up result file for upload: ${uploadId}`);
        } catch (error) {
          logger.error(`Failed to cleanup result file for: ${uploadId}`, error);
        }
      }

      return { status: 'completed', result };
    }

    // Check if upload is in progress
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(await fs.promises.readFile(infoPath, 'utf-8'));
        const stats = fs.statSync(filePath);
        const progress = info.size ? (stats.size / info.size) * 100 : 0;
        return { status: 'pending', progress };
      } catch {
        return { status: 'pending', progress: 0 };
      }
    }

    return { status: 'not_found' };
  }

  /**
   * Clean up temporary files
   */
  async cleanupFile(uploadId: string): Promise<void> {
    const filePath = path.join(this.uploadDir, uploadId);
    const infoPath = path.join(this.uploadDir, `${uploadId}.json`);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      if (fs.existsSync(infoPath)) {
        await fs.promises.unlink(infoPath);
      }
      logger.info(`Cleaned up TUS files for: ${uploadId}`);
    } catch (error) {
      logger.error(`Failed to cleanup TUS files for: ${uploadId}`, error);
    }
  }

  /**
   * Clean up old/stale uploads (run periodically)
   */
  async cleanupStaleUploads(maxAgeHours: number = 24): Promise<number> {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    try {
      const files = await fs.promises.readdir(this.uploadDir);

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.promises.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          await fs.promises.unlink(filePath);
          cleanedCount++;
        }
      }

      logger.info(`Cleaned up ${cleanedCount} stale TUS files`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup stale uploads:', error);
      throw error;
    }
  }

  /**
   * Get TUS endpoint URL
   */
  getEndpoint(): string {
    return this.tusPath;
  }
}

// Export singleton instance
export const tusService = new TusService();
export default tusService;
