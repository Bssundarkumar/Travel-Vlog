# CLAUDE.md — Travel-Vlog Project Guide

This file provides context, structure, and conventions for AI assistants (Claude and others) working in this repository. Keep this file up to date as the project evolves.

---

## Project Overview

**Travel-Vlog** is a web application for creating, publishing, and discovering travel vlog content. It enables travelers to document journeys, share multimedia posts (text, photos, videos), and build a community around travel experiences.

---

## Repository State

> **Note:** This repository is freshly initialized. No source files exist yet. This CLAUDE.md serves as the foundational planning and convention document. Update all sections as the project is built out.

---

## Recommended Project Structure

```
Travel-Vlog/
├── CLAUDE.md                   # This file — AI assistant guide
├── README.md                   # Human-facing project documentation
├── .gitignore                  # Git ignore rules
├── .env.example                # Example environment variables (never commit .env)
│
├── frontend/                   # Client-side application
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Route-level page components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── store/              # State management (Redux/Zustand/Context)
│   │   ├── services/           # API client functions
│   │   ├── utils/              # Pure utility functions
│   │   ├── types/              # TypeScript type definitions
│   │   └── styles/             # Global styles / theme tokens
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                    # Server-side application
│   ├── src/
│   │   ├── routes/             # Express/Fastify route handlers
│   │   ├── controllers/        # Business logic
│   │   ├── models/             # Database models / schemas
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── services/           # External integrations (storage, email, etc.)
│   │   └── config/             # App configuration and env parsing
│   ├── tests/                  # Backend tests
│   └── package.json
│
├── database/
│   ├── migrations/             # Ordered migration files
│   └── seeds/                  # Seed data for development
│
├── infra/                      # Infrastructure / deployment config
│   ├── docker-compose.yml
│   └── Dockerfile
│
└── .github/
    └── workflows/              # CI/CD pipelines
```

---

## Technology Stack (Planned)

Update this section once technology choices are finalized.

| Layer        | Technology         | Notes                                |
|--------------|--------------------|--------------------------------------|
| Frontend     | React + TypeScript | Vite or Next.js for bundling         |
| Styling      | Tailwind CSS       | Utility-first, consistent design     |
| State        | Zustand or Redux   | Choose based on complexity needs     |
| Backend      | Node.js (Express)  | REST or GraphQL API                  |
| Database     | PostgreSQL         | Relational; use Prisma ORM           |
| Auth         | JWT + refresh tokens | Optionally OAuth (Google, GitHub)  |
| File Storage | AWS S3 / Cloudflare R2 | For images and video uploads     |
| CI/CD        | GitHub Actions     | Lint, test, deploy on push           |

---

## Key Domain Concepts

Understanding these terms is critical for working in this codebase:

- **Vlog Post** — A travel entry containing title, body content, media (photos/videos), location metadata, and tags.
- **Trip** — A collection of vlog posts grouped under a single travel journey (e.g., "Japan 2025").
- **Author** — A registered user who creates and publishes vlog posts.
- **Location** — Geographic metadata attached to a post (country, city, coordinates).
- **Media** — Images and videos uploaded by an author, associated with posts.
- **Tag** — User-defined labels for categorizing posts (e.g., #backpacking, #foodie).
- **Feed** — A paginated, filterable stream of vlog posts for a user or the public.

---

## Core Data Models

These are the primary entities the application manages. Expand as the project is built.

### User
```
id          UUID, primary key
username    string, unique
email       string, unique
password    hashed string
avatar_url  string (nullable)
bio         text (nullable)
created_at  timestamp
```

### Trip
```
id          UUID, primary key
author_id   FK → User
title       string
description text (nullable)
cover_image string (nullable)
created_at  timestamp
updated_at  timestamp
```

### VlogPost
```
id          UUID, primary key
trip_id     FK → Trip (nullable)
author_id   FK → User
title       string
body        text (rich content / markdown)
location    string (nullable)
latitude    float (nullable)
longitude   float (nullable)
published   boolean (default: false)
created_at  timestamp
updated_at  timestamp
```

### Media
```
id          UUID, primary key
post_id     FK → VlogPost
url         string
type        enum: 'image' | 'video'
caption     string (nullable)
order       integer
```

---

## Development Workflows

### Initial Setup

```bash
# Clone the repository
git clone <repo-url>
cd Travel-Vlog

# Install dependencies (once project files exist)
cd frontend && npm install
cd ../backend && npm install

# Copy env files
cp .env.example .env
# Fill in values in .env

# Start development services
docker-compose up -d       # Start DB and other services
cd backend && npm run dev  # Start backend dev server
cd frontend && npm run dev # Start frontend dev server
```

### Common Commands

```bash
# Frontend
npm run dev        # Start dev server (hot reload)
npm run build      # Production build
npm run lint       # ESLint check
npm run typecheck  # TypeScript type check
npm test           # Run unit tests

# Backend
npm run dev        # Start with nodemon
npm run build      # Compile TypeScript
npm run lint       # ESLint check
npm test           # Run tests
npm run migrate    # Run database migrations
npm run seed       # Seed development data

# Database
npm run migrate:make <name>   # Create a new migration
npm run migrate:rollback      # Roll back last migration
```

### Git Workflow

- **main** — Production-ready code. Direct pushes are not allowed.
- **develop** — Integration branch. Merge feature branches here.
- **feature/<name>** — Individual feature branches, branched from `develop`.
- **fix/<name>** — Bug fix branches.
- **claude/<description>** — Branches created by Claude for AI-driven tasks.

**Branch naming examples:**
```
feature/user-authentication
feature/vlog-post-editor
fix/media-upload-error
claude/add-search-functionality
```

**Commit message format (Conventional Commits):**
```
<type>(<scope>): <short description>

Types: feat, fix, docs, style, refactor, test, chore
Examples:
  feat(auth): add Google OAuth login
  fix(posts): correct pagination offset calculation
  docs(api): update endpoint documentation
  refactor(components): extract PostCard into shared component
```

### Pull Request Process

1. Branch from `develop` (or `main` for hotfixes).
2. Make changes with focused, atomic commits.
3. Run linters and tests locally before pushing.
4. Open a PR with a clear description of the change and why.
5. Link any related issues.
6. At least one review required before merging.

---

## API Conventions

When building the REST API, follow these conventions:

### URL Structure
```
GET    /api/v1/posts              # List posts (paginated)
POST   /api/v1/posts              # Create a post
GET    /api/v1/posts/:id          # Get a single post
PUT    /api/v1/posts/:id          # Full update of a post
PATCH  /api/v1/posts/:id          # Partial update of a post
DELETE /api/v1/posts/:id          # Delete a post

GET    /api/v1/trips              # List trips
GET    /api/v1/trips/:id/posts    # List posts within a trip
```

### Response Format
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  },
  "error": null
}
```

### Error Format
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": [...]
  }
}
```

### HTTP Status Codes
- `200` — Success
- `201` — Created
- `400` — Bad Request (validation errors)
- `401` — Unauthorized (missing/invalid auth token)
- `403` — Forbidden (authenticated but not permitted)
- `404` — Not Found
- `422` — Unprocessable Entity
- `500` — Internal Server Error

---

## Code Conventions

### TypeScript
- Enable strict mode (`"strict": true` in tsconfig).
- Prefer `interface` over `type` for object shapes.
- Avoid `any`; use `unknown` when type is genuinely unknown.
- Export types from a central `types/` directory.

### React Components
- Use functional components with hooks only.
- One component per file; filename matches component name in PascalCase.
- Co-locate component-specific styles and tests with the component file.
- Prefer composition over complex prop drilling; use Context or state management for deep data.

### API / Backend
- Validate all incoming request data at the route level (use Zod or Joi).
- Never trust client-provided IDs for authorization — verify ownership in the controller.
- Do not leak stack traces or internal error details to API consumers.
- Use environment variables for all secrets and configuration; never hardcode values.

### Database
- All schema changes go through migrations — never modify the database directly.
- Use transactions for operations that span multiple tables.
- Add database indexes for columns used in WHERE, JOIN, and ORDER BY clauses.
- Soft-delete sensitive records (add `deleted_at` timestamp) rather than hard-deleting.

---

## Testing Strategy

| Level        | Tool            | Location                    | Purpose                            |
|--------------|-----------------|-----------------------------|------------------------------------|
| Unit         | Vitest / Jest   | `__tests__/` next to source | Test individual functions/modules  |
| Integration  | Jest + Supertest| `backend/tests/`            | Test API endpoints end-to-end      |
| Component    | Testing Library | `frontend/src/`             | Test React components in isolation |
| E2E          | Playwright      | `e2e/`                      | Full browser workflow tests        |

**Run tests before every PR.** CI will block merges if tests fail.

---

## Environment Variables

Document all required environment variables here. Never commit `.env` files.

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/travel_vlog

# Authentication
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<strong-random-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# File Storage
STORAGE_PROVIDER=s3          # 's3' | 'r2' | 'local'
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=

# Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

---

## Security Requirements

- Passwords must be hashed with bcrypt (min 12 rounds).
- All API endpoints that modify data require authentication.
- File uploads must validate MIME type and enforce size limits server-side.
- Sanitize rich text/HTML content before storing or rendering to prevent XSS.
- Rate-limit authentication endpoints to prevent brute-force attacks.
- Use HTTPS in all non-local environments.
- Store secrets in environment variables or a secrets manager — never in source code.

---

## Media Uploads

- **Accepted image formats:** JPEG, PNG, WebP
- **Accepted video formats:** MP4, MOV, WebM
- **Max file size:** 10 MB for images, 500 MB for videos
- Upload flow: client → backend (validates) → cloud storage (S3/R2) → return URL stored in DB
- Generate thumbnails server-side for video posts.
- Use signed URLs for private or premium content access.

---

## AI Assistant Instructions

When Claude or another AI assistant works in this repository:

1. **Read this file first.** Understand domain concepts and conventions before making changes.
2. **Prefer editing existing files** over creating new ones unless the task explicitly requires a new file.
3. **Follow naming conventions** established in the Code Conventions section.
4. **Validate changes make sense** in context — check related files before modifying a module.
5. **Run lint and tests** after making code changes before committing.
6. **Use Conventional Commits** for all commit messages.
7. **Do not commit `.env` files**, credentials, or API keys.
8. **Update this CLAUDE.md** whenever the project structure or conventions change significantly.
9. **Scope changes tightly** — avoid refactoring unrelated code unless explicitly asked.
10. **Ask clarifying questions** when requirements are ambiguous rather than assuming.

---

## Updating This File

This file should be updated when:

- New technology choices are finalized (replace "Planned" entries).
- New top-level directories are added to the project.
- API conventions change.
- New environment variables are required.
- Team conventions evolve.

The goal is for any AI assistant or new developer to be fully productive by reading only this file and the README.
