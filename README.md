# Express TypeScript API

A production-ready Express.js REST API built with TypeScript, featuring enterprise-grade architecture, security, and Docker support.

## 🚀 Features

- **TypeScript** - Full type safety with strict mode
- **Express.js** - Fast, minimalist web framework
- **Security** - Helmet, CORS, rate limiting
- **Logging** - Winston with daily rotation
- **Validation** - express-validator integration
- **Error Handling** - Global async error handler
- **Docker** - Multi-stage production build
- **Code Quality** - ESLint + Prettier

## 📁 Project Structure

```
├── src/
│   ├── config/          # Configuration management
│   ├── controllers/     # Route handlers
│   ├── middlewares/     # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── validators/      # Request validation
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── logs/                # Application logs
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose setup
└── package.json         # Dependencies
```

## 🛠️ Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Check TypeScript types |

## 🐳 Docker

### Build and Run

```bash
# Build image
docker build -t express-ts-api .

# Run container
docker run -p 3000:3000 express-ts-api
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

## 📚 API Endpoints

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health status |
| GET | `/api/health/ready` | Readiness probe |
| GET | `/api/health/live` | Liveness probe |

## 🔧 Configuration

Environment variables (`.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | development | Environment |
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Server host |
| `API_PREFIX` | /api | API prefix |
| `CORS_ORIGIN` | * | CORS origin |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Rate limit |
| `LOG_LEVEL` | debug | Log level |

## 📝 License

MIT
