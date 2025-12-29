import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { User } from '../models';
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
    },
    async (payload: any, done) => {
      try {
        // Payload contains userId from token
        const user = await User.findById(payload.userId).select('+isActive +isEmailVerified');

        if (!user) {
          return done(null, false);
        }

        if (!user.isActive) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        logger.error('Passport JWT verification error:', error);
        return done(error);
      }
    }
  )
);

// Note: Serialization/deserialization is not needed for JWT-only authentication.

export default passport;
