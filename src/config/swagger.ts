import swaggerJsdoc from 'swagger-jsdoc';
import config from './index';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express TS API',
      version: packageJson.version,
      description: 'Production-ready Express.js API with TypeScript',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://${config.host}:${config.port}${config.api.prefix}`,
        description: 'Local Development Server',
      },
      {
        url: `https://express-ts-api-w5c6.onrender.com${config.api.prefix}`,
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/docs/*.ts', './src/models/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
