import { Request, Response, NextFunction } from 'express';
import { UAParser } from 'ua-parser-js';
import { IDeviceInfo } from '../models/Session';

/**
 * Extended request with device info
 */
declare global {
  namespace Express {
    interface Request {
      deviceInfo?: IDeviceInfo;
    }
  }
}

/**
 * Get client IP address from request
 */
const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.socket.remoteAddress || 'unknown';
};

/**
 * Device info extraction middleware
 * Parses user agent and attaches device information to request
 */
export const extractDeviceInfo = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const deviceInfo: IDeviceInfo = {
    deviceName: result.device.model || result.device.vendor || 'Desktop',
    deviceType: result.device.type || 'desktop',
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    ip: getClientIp(req),
  };

  req.deviceInfo = deviceInfo;
  next();
};

export default extractDeviceInfo;
