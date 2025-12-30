import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { User, Session } from '../models';
import config from './index';
import logger from '../utils/logger';

/**
 * Configure JWT Strategy for Passport
 * Used for bearer token authentication
 */
passport.use(
  'jwt',
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.accessSecret,
      algorithms: ['HS256'],
      passReqToCallback: true,
    },
    async (req: any, payload: any, done) => {
      try {
        // 1. Verify Session
        if (!payload.sessionId) {
          return done(null, false, { message: 'Invalid token: missing session ID' });
        }

        const session = await Session.findById(payload.sessionId);
        if (!session || session.isRevoked) {
          return done(null, false, { message: 'Session expired or revoked' });
        }

        // Optional: Check if session belongs to user (should match)
        if (session.userId.toString() !== payload.userId) {
          return done(null, false, { message: 'Invalid session for user' });
        }

        // Attach session to request
        req.session = session;

        // 2. Verify User
        // Payload contains userId from token
        const user = await User.findById(payload.userId).select('+isActive +isEmailVerified');

        if (!user) {
          return done(null, false, { message: 'User not found' });
        }

        if (!user.isActive) {
          return done(null, false, { message: 'User account is deactivated' });
        }

        return done(null, user);
      } catch (error) {
        logger.error('Passport JWT verification error:', error);
        return done(error, false);
      }
    }
  )
);

// Note: Serialization/deserialization is not needed for JWT-only authentication.

export default passport;
