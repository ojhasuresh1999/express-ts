import cloudinary from '../config/cloudinary';
import config from '../config';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import logger from '../utils/logger';

// Types for upload options and responses
export interface UploadOptions {
  folder?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: object[];
  eager?: object[];
  tags?: string[];
  context?: Record<string, string>;
  overwrite?: boolean;
  invalidate?: boolean;
}

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  duration?: number;
  createdAt: string;
  etag: string;
  originalFilename?: string;
}

export interface TransformationPreset {
  name: string;
  transformations: object;
}

// Predefined transformation presets for production use
const TRANSFORMATION_PRESETS: Record<string, TransformationPreset> = {
  thumbnail: {
    name: 'thumbnail',
    transformations: { width: 150, height: 150, crop: 'thumb', gravity: 'face' },
  },
  medium: {
    name: 'medium',
    transformations: { width: 500, height: 500, crop: 'limit' },
  },
  large: {
    name: 'large',
    transformations: { width: 1200, height: 1200, crop: 'limit' },
  },
  avatar: {
    name: 'avatar',
    transformations: { width: 200, height: 200, crop: 'thumb', gravity: 'face', radius: 'max' },
  },
  banner: {
    name: 'banner',
    transformations: { width: 1920, height: 600, crop: 'fill', gravity: 'auto' },
  },
  videoPreview: {
    name: 'videoPreview',
    transformations: { width: 480, quality: 'auto:low', format: 'mp4' },
  },
};

class CloudinaryService {
  private defaultFolder: string;

  constructor() {
    this.defaultFolder = 'uploads';
  }

  /**
   * Upload an image to Cloudinary with optional compression
   */
  async uploadImage(
    file: Express.Multer.File | Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || `${this.defaultFolder}/images`,
        public_id: options.publicId || uuidv4(),
        resource_type: 'image' as const,
        overwrite: options.overwrite ?? true,
        invalidate: options.invalidate ?? true,
        transformation: options.transformation || [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
        eager: options.eager || [
          TRANSFORMATION_PRESETS.thumbnail.transformations,
          TRANSFORMATION_PRESETS.medium.transformations,
        ],
        eager_async: true,
        tags: options.tags || [],
        context: options.context,
      };

      let result;
      if (Buffer.isBuffer(file)) {
        result = await this.uploadFromBuffer(file, uploadOptions);
      } else if (typeof file === 'string') {
        // File path or URL
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        // Multer file
        result = await this.uploadFromBuffer(file.buffer, uploadOptions);
      }

      return this.formatUploadResult(result);
    } catch (error) {
      logger.error('Cloudinary image upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload a video to Cloudinary with optimization
   */
  async uploadVideo(
    file: Express.Multer.File | Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || `${this.defaultFolder}/videos`,
        public_id: options.publicId || uuidv4(),
        resource_type: 'video' as const,
        overwrite: options.overwrite ?? true,
        invalidate: options.invalidate ?? true,
        eager: options.eager || [
          { streaming_profile: 'auto', format: 'm3u8' }, // HLS adaptive streaming
          TRANSFORMATION_PRESETS.videoPreview.transformations,
        ],
        eager_async: true,
        tags: options.tags || [],
        context: options.context,
      };

      let result;
      if (Buffer.isBuffer(file)) {
        result = await this.uploadFromBuffer(file, uploadOptions);
      } else if (typeof file === 'string') {
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        result = await this.uploadFromBuffer(file.buffer, uploadOptions);
      }

      return this.formatUploadResult(result);
    } catch (error) {
      logger.error('Cloudinary video upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload any file type (raw) to Cloudinary
   */
  async uploadRaw(
    file: Express.Multer.File | Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const uploadOptions = {
        folder: options.folder || `${this.defaultFolder}/files`,
        public_id: options.publicId || uuidv4(),
        resource_type: 'raw' as const,
        overwrite: options.overwrite ?? true,
        invalidate: options.invalidate ?? true,
        tags: options.tags || [],
        context: options.context,
      };

      let result;
      if (Buffer.isBuffer(file)) {
        result = await this.uploadFromBuffer(file, uploadOptions);
      } else if (typeof file === 'string') {
        result = await cloudinary.uploader.upload(file, uploadOptions);
      } else {
        result = await this.uploadFromBuffer(file.buffer, uploadOptions);
      }

      return this.formatUploadResult(result);
    } catch (error) {
      logger.error('Cloudinary raw upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload large files using chunked upload (for files > 100MB)
   */
  async uploadLargeFile(filePath: string, options: UploadOptions = {}): Promise<UploadResult> {
    try {
      const resourceType = options.resourceType || this.detectResourceType(filePath);
      const chunkSize = config.upload.tusChunkSizeMB * 1024 * 1024; // Convert MB to bytes

      const uploadOptions = {
        folder: options.folder || `${this.defaultFolder}/large`,
        public_id: options.publicId || uuidv4(),
        resource_type: resourceType,
        chunk_size: chunkSize,
        overwrite: options.overwrite ?? true,
        invalidate: options.invalidate ?? true,
        tags: options.tags || [],
        context: options.context,
      };

      logger.info(`Starting large file upload: ${filePath}`);

      const result = await cloudinary.uploader.upload_large(filePath, uploadOptions);
      const uploadResult = result as unknown as Record<string, unknown>;

      logger.info(`Large file upload completed: ${uploadResult.public_id}`);
      return this.formatUploadResult(uploadResult);
    } catch (error) {
      logger.error('Cloudinary large file upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload from stream (useful for piping data)
   */
  async uploadFromStream(stream: Readable, options: UploadOptions = {}): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const resourceType = options.resourceType || 'auto';

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || this.defaultFolder,
          public_id: options.publicId || uuidv4(),
          resource_type: resourceType,
          overwrite: options.overwrite ?? true,
          tags: options.tags || [],
          context: options.context,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary stream upload failed:', error);
            reject(error);
          } else if (result) {
            resolve(this.formatUploadResult(result));
          } else {
            reject(new Error('Upload failed: No result returned'));
          }
        }
      );

      stream.pipe(uploadStream);
    });
  }

  /**
   * Delete a media asset from Cloudinary
   */
  async deleteMedia(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<{ success: boolean; result: string }> {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      return {
        success: result.result === 'ok',
        result: result.result,
      };
    } catch (error) {
      logger.error('Cloudinary delete failed:', error);
      throw error;
    }
  }

  /**
   * Delete multiple media assets
   */
  async deleteMultipleMedia(
    publicIds: string[],
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<{ deleted: Record<string, string>; partial: boolean }> {
    try {
      const result = await cloudinary.api.delete_resources(publicIds, {
        resource_type: resourceType,
        invalidate: true,
      });

      return {
        deleted: result.deleted,
        partial: result.partial,
      };
    } catch (error) {
      logger.error('Cloudinary bulk delete failed:', error);
      throw error;
    }
  }

  /**
   * Get media information/metadata
   */
  async getMediaInfo(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image'
  ): Promise<UploadResult> {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });

      return this.formatUploadResult(result);
    } catch (error) {
      logger.error('Cloudinary get resource failed:', error);
      throw error;
    }
  }

  /**
   * Generate a signed upload URL for direct client-side uploads
   */
  generateSignedUploadUrl(options: {
    folder?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    maxFileSize?: number;
    allowedFormats?: string[];
  }): {
    signature: string;
    timestamp: number;
    cloudName: string;
    apiKey: string;
    uploadPreset?: string;
  } {
    const timestamp = Math.round(Date.now() / 1000);

    const params = {
      timestamp,
      folder: options.folder || this.defaultFolder,
      resource_type: options.resourceType || 'auto',
    };

    const signature = cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret);

    return {
      signature,
      timestamp,
      cloudName: config.cloudinary.cloudName,
      apiKey: config.cloudinary.apiKey,
    };
  }

  /**
   * Generate transformation URL
   */
  getTransformationUrl(
    publicId: string,
    preset: keyof typeof TRANSFORMATION_PRESETS,
    resourceType: 'image' | 'video' = 'image'
  ): string {
    const presetConfig = TRANSFORMATION_PRESETS[preset];
    if (!presetConfig) {
      throw new Error(`Unknown transformation preset: ${preset}`);
    }

    return cloudinary.url(publicId, {
      transformation: presetConfig.transformations,
      resource_type: resourceType,
      secure: true,
    });
  }

  /**
   * Helper: Upload from buffer
   */
  private uploadFromBuffer(
    buffer: Buffer,
    options: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) reject(error);
        else if (result) resolve(result as unknown as Record<string, unknown>);
        else reject(new Error('Upload failed: No result returned'));
      });

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Helper: Format Cloudinary response to our standard format
   */
  private formatUploadResult(result: Record<string, unknown>): UploadResult {
    return {
      publicId: result.public_id as string,
      url: result.url as string,
      secureUrl: result.secure_url as string,
      resourceType: result.resource_type as string,
      format: result.format as string,
      width: result.width as number | undefined,
      height: result.height as number | undefined,
      bytes: result.bytes as number,
      duration: result.duration as number | undefined,
      createdAt: result.created_at as string,
      etag: result.etag as string,
      originalFilename: result.original_filename as string | undefined,
    };
  }

  /**
   * Helper: Detect resource type from file extension
   */
  private detectResourceType(filePath: string): 'image' | 'video' | 'raw' {
    const ext = filePath.toLowerCase().split('.').pop() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tiff'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    return 'raw';
  }
}

// Export singleton instance
export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
