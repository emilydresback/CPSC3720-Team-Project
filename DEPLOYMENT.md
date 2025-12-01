# TigerTix - Deployment Configuration

## Environment Variables for Production

### Required Environment Variables

```env
# Database Configuration
DATABASE_PATH=./backend/shared-db/database.sqlite

# JWT Configuration
JWT_SECRET=your_production_jwt_secret_here_make_it_long_and_secure_123456789
JWT_EXPIRES_IN=24h

# Service Ports (Auto-assigned by hosting provider)
AUTH_PORT=7005
ADMIN_PORT=5001
CLIENT_PORT=6001
LLM_PORT=5003

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.vercel.app
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app,http://localhost:3000

# Environment
NODE_ENV=production

# Frontend Configuration
REACT_APP_API_URL=https://your-backend-domain.onrender.com
```

## Deployment Steps

### 1. Deploy Backend to Railway/Render

1. **Railway Deployment:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Deploy
   railway deploy
   ```

2. **Render Deployment:**
   - Connect GitHub repository
   - Set build command: `npm install`
   - Set start command: `node backend/server.js`
   - Add environment variables from above

### 2. Deploy Frontend to Vercel

1. **Automatic Deployment:**
   - Connect GitHub repository to Vercel
   - Vercel will auto-deploy on push to main branch

2. **Manual Deployment:**
   ```bash
   # Install Vercel CLI
   npm install -g vercel
   
   # Deploy
   cd frontend
   vercel --prod
   ```

### 3. Environment Configuration

1. **Backend Environment Variables:**
   - Set `CORS_ORIGIN` to your Vercel frontend URL
   - Set `JWT_SECRET` to a secure random string
   - Configure `NODE_ENV=production`

2. **Frontend Environment Variables:**
   - Set `REACT_APP_API_URL` to your backend deployment URL

### 4. Database Setup

The SQLite database will be initialized automatically on first run. For persistent storage:

1. **Railway:** Database persists in the container
2. **Render:** Use Render's persistent disk feature or upgrade to PostgreSQL

## Live URLs

After deployment, update these URLs:

- **Frontend:** `https://tigertix-frontend.vercel.app`
- **Backend:** `https://tigertix-backend.onrender.com`
- **API Endpoints:**
  - Auth: `https://tigertix-backend.onrender.com:7005`
  - Admin: `https://tigertix-backend.onrender.com:5001`
  - Client: `https://tigertix-backend.onrender.com:6001`
  - LLM: `https://tigertix-backend.onrender.com:5003`

## Testing Deployed Application

```bash
# Test backend health
curl https://your-backend-domain.onrender.com/health

# Test frontend
curl https://your-frontend-domain.vercel.app

# Test authentication
curl -X POST https://your-backend-domain.onrender.com:7005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123"}'
```

## CI/CD Pipeline

The GitHub Actions workflow will:
1. Run all 138 tests
2. Build frontend for production
3. Deploy backend to Railway/Render
4. Deploy frontend to Vercel

## Download Links

- **Source Code:** [GitHub Repository](https://github.com/your-username/CPSC3720-Team-Project)
- **Live Demo:** [TigerTix App](https://tigertix-frontend.vercel.app)
- **Documentation:** Available in `/docs` folder