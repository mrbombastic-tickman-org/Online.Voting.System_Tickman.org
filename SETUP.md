# 🚀 Complete Setup Guide - VoteSecure India

A comprehensive guide to setting up, configuring, and deploying the VoteSecure India online voting platform.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Database Configuration](#database-configuration)
4. [Environment Variables](#environment-variables)
5. [Face Recognition Models](#face-recognition-models)
6. [Running the Application](#running-the-application)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Security Checklist](#security-checklist)

---

## Prerequisites

### Required Software

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 18.x or higher | https://nodejs.org/ |
| npm | 9.x or higher | Comes with Node.js |
| Git | Latest | https://git-scm.com/ |

### Optional (for database)

| Software | Purpose |
|----------|---------|
| PostgreSQL 14+ | Local database development |
| Docker | Containerized database setup |

### Verify Installation

```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
git --version     # Should show latest version
```

---

## Local Development Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/mrbombastic-tickman-org/Online.Voting.System_Tickman.org.git
cd Online.Voting.System_Tickman.org
```

### Step 2: Install Dependencies

```bash
npm install
```

This will:
- Install all npm packages
- Run `prisma generate` automatically (via postinstall hook)
- Download required face-api.js model files

### Step 3: Verify Node Modules

```bash
ls node_modules/@prisma/client  # Should exist
ls public/models                # Face-api models should exist
```

---

## Database Configuration

### Option A: Using Neon (Recommended for Production)

1. Create a free account at [Neon.tech](https://neon.tech/)
2. Create a new project
3. Get your connection string from the dashboard
4. Format: `postgresql://username:password@host.neon.tech/database?sslmode=require`

### Option B: Using Local PostgreSQL

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL service
sudo service postgresql start

# Create database
sudo -u postgres createdb votesecure
sudo -u postgres createuser -P votesecure_user
```

### Option C: Using Docker

```bash
# Run PostgreSQL in Docker
docker run --name votesecure-db \
  -e POSTGRES_USER=votesecure \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=votesecure \
  -p 5432:5432 \
  -d postgres:15
```

---

## Environment Variables

### Step 1: Create Environment File

```bash
cp .env.example .env
```

### Step 2: Configure Required Variables

Edit `.env` with your values:

```env
# ============================================
# DATABASE (Required)
# ============================================
# Neon PostgreSQL URL format:
DATABASE_URL="postgresql://username:password@host.neon.tech/database?sslmode=require"

# Local PostgreSQL format:
# DATABASE_URL="postgresql://votesecure_user:password@localhost:5432/votesecure"

# ============================================
# SECURITY (Required for Production)
# ============================================
# Generate a secure session key:
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET_KEY="your-64-character-hex-string-here-generated-with-crypto"

# Admin email addresses (comma-separated)
ADMIN_EMAILS="admin@example.com,admin2@example.com"

# ============================================
# BIOMETRICS (Required for Face++)
# ============================================
FACEPLUSPLUS_API_KEY="your-faceplusplus-api-key"
FACEPLUSPLUS_API_SECRET="your-faceplusplus-api-secret"

# ============================================
# OPTIONAL CONFIGURATION
# ============================================
# Environment mode
NODE_ENV="development"

# Public origin used for WebAuthn origin checks
# APP_ORIGIN="https://votesecure.example.com"

# Trusted proxies (for production behind nginx/Cloudflare)
# TRUSTED_PROXIES="10.0.0.1,192.168.1.1"
```

### Step 3: Validate Environment

```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# On Windows PowerShell:
# $env:DATABASE_URL
```

---

## Database Migration & Seeding

### Step 1: Push Schema to Database

```bash
npx prisma db push
```

Expected output:
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database
🚀 Your database is now in sync with your Prisma schema.
```

### Step 2: Verify Database Tables

```bash
npx prisma studio
```

This opens Prisma Studio at http://localhost:5555

### Step 3: Seed Test Data

```bash
npx prisma db seed
```

This creates:
- 100+ government records with unique Aadhaar-style IDs
- Sample election with candidates
- Admin user account

**Sample credentials output:**
```
Admin user created: admin@votesecure.in / admin123
Sample voter IDs: AADHAAR-1001-2001-3001, AADHAAR-1002-2002-3002, ...
```

---

## Face Recognition Models

The application uses face-api.js for facial recognition. Models should be automatically downloaded during `npm install`.

### Verify Models Exist

```bash
ls public/models/
```

Expected files:
```
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model.bin
face_landmark_68_model-weights_manifest.json
face_landmark_68_model.bin
face_recognition_model-weights_manifest.json
face_recognition_model.bin
```

### Manual Model Download (if needed)

```bash
mkdir -p public/models
cd public/models

# Download models from face-api.js repository
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model.bin
# ... repeat for other model files
```

---

## Running the Application

### Development Mode

```bash
npm run dev
```

- App: http://localhost:3000
- Prisma Studio: http://localhost:5555 (if running `npx prisma studio`)

> ⚠️ **Important:** Camera access requires `localhost`. Do NOT use IP addresses like `192.168.x.x` as browsers block `getUserMedia` on non-HTTPS origins.

### Production Build (Local Testing)

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Verify Application is Running

```bash
curl http://localhost:3000/api/health
# Should return application status
```

---

## Production Deployment

### Option 1: Vercel (Recommended)

1. Push code to GitHub (already done)
2. Import project at [vercel.com](https://vercel.com/)
3. Configure environment variables in Vercel dashboard
4. Add build command: `npx prisma generate && next build`

```bash
# Deploy via Vercel CLI
npm i -g vercel
vercel --prod
```

### Option 2: Railway/Render

1. Connect GitHub repository
2. Set environment variables
3. Set build command: `npm run postinstall && npm run build`
4. Set start command: `npm start`

### Option 3: Self-Hosted (VPS)

```bash
# On your server
git clone <repo-url>
cd Online.Voting.System_Tickman.org
npm install --production

# Set environment variables
export DATABASE_URL="your-production-db-url"
export SESSION_SECRET_KEY="your-production-secret"
export NODE_ENV="production"

# Build
npm run build

# Start with PM2 for process management
npm i -g pm2
pm2 start npm --name "votesecure" -- start
```

### Production Checklist

- [ ] Generate strong `SESSION_SECRET_KEY` (64 hex characters)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `TRUSTED_PROXIES` if behind reverse proxy
- [ ] Enable SSL/HTTPS
- [ ] Set up database backups
- [ ] Configure firewall rules

---

## Troubleshooting

### Database Connection Issues

**Error:** `Can't reach database server`

```bash
# Check database URL format
echo $DATABASE_URL

# Test connection manually
npx prisma db pull
```

**Fix:**
- Verify DATABASE_URL is correct
- Check if database server is running
- Ensure SSL mode is correct for your provider

### Face Recognition Not Working

**Error:** `Camera access denied` or `Face model loading failed`

**Fix:**
1. Ensure using `localhost` (not IP address)
2. Check browser camera permissions
3. Verify model files exist in `public/models/`
4. Clear browser cache and reload

### Build Errors

**Error:** `Module not found: @prisma/client`

```bash
# Regenerate Prisma client
npx prisma generate

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Session/Login Issues

**Error:** `Session validation failed`

**Fix:**
- Check `SESSION_SECRET_KEY` is set
- Verify key is at least 32 characters
- Clear browser cookies

### Port Already in Use

**Error:** `Port 3000 is already in use`

```bash
# Kill process on port 3000 (Linux/Mac)
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

---

## Security Checklist

Before deploying to production:

- [ ] Changed default admin credentials
- [ ] Generated unique `SESSION_SECRET_KEY`
- [ ] Configured `ADMIN_EMAILS` with real admin addresses
- [ ] Set `NODE_ENV=production`
- [ ] Enabled HTTPS/SSL
- [ ] Database passwords are strong
- [ ] Removed test data from production
- [ ] Configured CORS properly
- [ ] Set up rate limiting
- [ ] Enabled database encryption at rest
- [ ] Configured automated backups

---

## Useful Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Database
npx prisma studio        # Open database GUI
npx prisma db push       # Push schema changes
npx prisma db seed       # Seed test data
npx prisma migrate dev   # Create migration
npx prisma generate      # Regenerate client

# Debugging
npx tsx scripts/db-inspect.mjs  # Inspect database
```

---

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/mrbombastic-tickman-org/Online.Voting.System_Tickman.org/issues)
- Documentation: See README.md

---

<p align="center">Made with 🇮🇳 for India — <strong>VoteSecure</strong> © 2026</p>
