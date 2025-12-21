# Docker Setup Guide

This project is fully containerized using Docker, allowing you to run the entire application stack (API, Database, Cache) with a single command.

## Quick Summary

- **`Dockerfile`**: A recipe for baking your application code into a standalone, portable image. It handles installing dependencies, compiling TypeScript, and setting up the production environment.
- **`docker-compose.yml`**: An orchestration file that runs your application **along with its dependencies** (database, cache, tools) so you don't have to install them manually on your machine.
- **`.dockerignore`**: Tells Docker what **not** to copy into the container (like large `node_modules` or sensitive `.env` files).

---

## 1. The `Dockerfile` (The Blueprint)

The `Dockerfile` uses a **Multi-Stage Build** to keep the production image small and secure.

### Stage 1: `builder`
- **Purpose**: Prepares the code. Installs **all** dependencies (including dev tools like TypeScript) and builds the project.
- **Key Steps**:
  - Uses `node:22-alpine` (lightweight Node.js).
  - Installs dependencies via `pnpm install`.
  - Compiles TypeScript to JavaScript (`pnpm run build`).

### Stage 2: `production`
- **Purpose**: Runs the app. Copies *only* the built files from the `builder` stage, discarding source code and dev dependencies.
- **Key Features**:
  - **Security**: Runs as a non-root user (`nodejs`) to restrict system permissions.
  - **Efficiency**: Installs only production dependencies (`pnpm install --prod`).
  - **Healthcheck**: Periodically pings `/api/health` to ensure the app is responsive.

---

## 2. `docker-compose.yml` (The Orchestra)

This file manages the 4 services that make up the application stack.

| Service Name | Purpose | Port Mapping (Host:Container) | Details |
| :--- | :--- | :--- | :--- |
| **`app`** | Express API | **3000:3000** | Your main application. Accessible at `http://localhost:3000`. |
| **`mongo`** | Database | **27018:27017** | MongoDB database. Connect manually via port **27018**. |
| **`redis`** | Cache | **6381:6379** | Redis for caching/sessions. Access via port **6381**. |
| **`mongo-express`** | DB GUI | **8081:8081** | Web interface to view/edit Mongo data. Open in browser at `http://localhost:8081`. |

- **Networks**: All services run on `app-network` and can communicate internally by service name.
- **Volumes**: `mongo-data` persists database files so data is not lost when containers are stopped.

---

## 3. Common Commands

| Goal | Command |
| :--- | :--- |
| **Start Everything** | `docker compose up -d` (Runs in background) |
| **Stop Everything** | `docker compose down` |
| **Rebuild App** | `docker compose up -d --build` (Use after code/package changes) |
| **View Logs** | `docker compose logs -f app` (Real-time API logs) |
| **Clean Up** | `docker compose down -v` (**WARNING**: Deletes database data) |

### usage Workflow

1.  Run `docker compose up -d`.
2.  Wait for images to pull and containers to start.
3.  Access the API at `http://localhost:3000`.
4.  Manage the database at `http://localhost:8081`.
