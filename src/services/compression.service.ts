import sharp from 'sharp';
import fs from 'fs';
import config from '../config';
import logger from '../utils/logger';

// Types for compression options
export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  progressive?: boolean;
  preserveMetadata?: boolean;
}

export interface CompressionResult {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  width: number;
  height: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  orientation?: number;
}

class CompressionService {
  private defaultQuality: number;

  constructor() {
    this.defaultQuality = config.upload.compressionQuality;
  }

  /**
   * Compress an image with quality and size optimization
   */
  async compressImage(
    input: Buffer | string,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      const originalSize = inputBuffer.length;
      const quality = options.quality || this.defaultQuality;
      const format = options.format || 'jpeg';

      let sharpInstance = sharp(inputBuffer);

      // Resize if max dimensions are specified
      if (options.maxWidth || options.maxHeight) {
        sharpInstance = sharpInstance.resize({
          width: options.maxWidth,
          height: options.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Apply format-specific compression
      switch (format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({
            quality,
            progressive: options.progressive ?? true,
            mozjpeg: true, // Use mozjpeg for better compression
          });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({
            quality,
            progressive: options.progressive ?? true,
            compressionLevel: 9,
            adaptiveFiltering: true,
          });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({
            quality,
            lossless: false,
            nearLossless: quality > 90,
            smartSubsample: true,
          });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({
            quality,
            lossless: false,
            effort: 6, // Balance between quality and speed
          });
          break;
      }

      // Remove metadata unless explicitly preserved
      if (!options.preserveMetadata) {
        sharpInstance = sharpInstance.withMetadata({});
      }

      const { data: compressedBuffer, info } = await sharpInstance.toBuffer({
        resolveWithObject: true,
      });

      const compressionRatio = ((originalSize - compressedBuffer.length) / originalSize) * 100;

      logger.info(
        `Image compressed: ${originalSize} -> ${compressedBuffer.length} bytes (${compressionRatio.toFixed(1)}% reduction)`
      );

      return {
        buffer: compressedBuffer,
        originalSize,
        compressedSize: compressedBuffer.length,
        compressionRatio,
        format: info.format,
        width: info.width,
        height: info.height,
      };
    } catch (error) {
      logger.error('Image compression failed:', error);
      throw error;
    }
  }

  /**
   * Resize an image while maintaining aspect ratio
   */
  async resizeImage(
    input: Buffer | string,
    width: number,
    height?: number,
    options: {
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
      format?: 'jpeg' | 'png' | 'webp';
    } = {}
  ): Promise<Buffer> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      let sharpInstance = sharp(inputBuffer).resize({
        width,
        height,
        fit: options.fit || 'inside',
        withoutEnlargement: true,
      });

      // Apply format if specified
      if (options.format) {
        switch (options.format) {
          case 'jpeg':
            sharpInstance = sharpInstance.jpeg({ quality: this.defaultQuality });
            break;
          case 'png':
            sharpInstance = sharpInstance.png();
            break;
          case 'webp':
            sharpInstance = sharpInstance.webp({ quality: this.defaultQuality });
            break;
        }
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      logger.error('Image resize failed:', error);
      throw error;
    }
  }

  /**
   * Convert image to a different format
   */
  async convertFormat(
    input: Buffer | string,
    targetFormat: 'jpeg' | 'png' | 'webp' | 'avif',
    quality?: number
  ): Promise<CompressionResult> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      const originalSize = inputBuffer.length;
      const outputQuality = quality || this.defaultQuality;

      let sharpInstance = sharp(inputBuffer);

      switch (targetFormat) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality: outputQuality, mozjpeg: true });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality: outputQuality, compressionLevel: 9 });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality: outputQuality });
          break;
        case 'avif':
          sharpInstance = sharpInstance.avif({ quality: outputQuality });
          break;
      }

      const { data: convertedBuffer, info } = await sharpInstance.toBuffer({
        resolveWithObject: true,
      });

      const compressionRatio = ((originalSize - convertedBuffer.length) / originalSize) * 100;

      return {
        buffer: convertedBuffer,
        originalSize,
        compressedSize: convertedBuffer.length,
        compressionRatio,
        format: info.format,
        width: info.width,
        height: info.height,
      };
    } catch (error) {
      logger.error('Image format conversion failed:', error);
      throw error;
    }
  }

  /**
   * Get image metadata without processing
   */
  async getImageMetadata(input: Buffer | string): Promise<ImageMetadata> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      const metadata = await sharp(inputBuffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: inputBuffer.length,
        hasAlpha: metadata.hasAlpha || false,
        orientation: metadata.orientation,
      };
    } catch (error) {
      logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  /**
   * Generate multiple sizes of an image (thumbnails)
   */
  async generateThumbnails(
    input: Buffer | string,
    sizes: { name: string; width: number; height?: number }[]
  ): Promise<{ name: string; buffer: Buffer; width: number; height: number }[]> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      const results = await Promise.all(
        sizes.map(async (size) => {
          const { data: buffer, info } = await sharp(inputBuffer)
            .resize({
              width: size.width,
              height: size.height,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: this.defaultQuality, mozjpeg: true })
            .toBuffer({ resolveWithObject: true });

          return {
            name: size.name,
            buffer,
            width: info.width,
            height: info.height,
          };
        })
      );

      return results;
    } catch (error) {
      logger.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  /**
   * Auto-orient image based on EXIF data
   */
  async autoOrient(input: Buffer | string): Promise<Buffer> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      return await sharp(inputBuffer)
        .rotate() // Auto-rotate based on EXIF data
        .toBuffer();
    } catch (error) {
      logger.error('Auto-orient failed:', error);
      throw error;
    }
  }

  /**
   * Apply watermark to an image
   */
  async applyWatermark(
    input: Buffer | string,
    watermark: Buffer | string,
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
    _opacity: number = 0.5
  ): Promise<Buffer> {
    try {
      const inputBuffer = Buffer.isBuffer(input) ? input : await fs.promises.readFile(input);

      const watermarkBuffer = Buffer.isBuffer(watermark)
        ? watermark
        : await fs.promises.readFile(watermark);

      // Get input image dimensions
      const inputMeta = await sharp(inputBuffer).metadata();

      // Calculate watermark size (max 20% of image dimension)
      const maxWatermarkWidth = Math.floor((inputMeta.width || 0) * 0.2);
      const watermarkResized = await sharp(watermarkBuffer)
        .resize({ width: maxWatermarkWidth, fit: 'inside' })
        .ensureAlpha()
        .modulate({ brightness: 1, saturation: 1 })
        .toBuffer();

      // Calculate position
      let gravity: string;
      switch (position) {
        case 'center':
          gravity = 'center';
          break;
        case 'top-left':
          gravity = 'northwest';
          break;
        case 'top-right':
          gravity = 'northeast';
          break;
        case 'bottom-left':
          gravity = 'southwest';
          break;
        case 'bottom-right':
          gravity = 'southeast';
          break;
        default:
          gravity = 'southeast';
      }

      return await sharp(inputBuffer)
        .composite([
          {
            input: watermarkResized,
            gravity: gravity as 'center' | 'northwest' | 'northeast' | 'southwest' | 'southeast',
            blend: 'over',
          },
        ])
        .toBuffer();
    } catch (error) {
      logger.error('Watermark application failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const compressionService = new CompressionService();
export default compressionService;
