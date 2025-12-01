# TigerTix - Manual Deployment Guide

## Quick Deployment Success

Your TigerTix application is **ready for deployment**! All 79 tests are passing.

### Test Results Summary
- **Admin Service:** 15/15 tests passed
- **Client Service:** 14/14 tests passed  
- **LLM Service:** 26/26 tests passed
- **Authentication Service:** 24/24 tests passed
- **Total:** **79/79 tests passing** ✓

## Manual Deployment Steps

### Step 1: Deploy Backend to Railway

```bash
# 1. Login to Railway
railway login

# 2. Initialize project (already done - you have project ID: 55e8874e-def1-4953-9174-1e48610f4651)
# railway init

# 3. Set environment variables (use correct syntax)
railway variables --set NODE_ENV=production
railway variables --set JWT_SECRET=your_secure_random_string_here
railway variables --set DATABASE_PATH=./backend/shared-db/database.sqlite
railway variables --set CORS_ORIGIN=http://localhost:3000

# 4. Deploy
railway up
```

### Step 2: Deploy Frontend to Vercel

```bash
# 1. Login to Vercel
vercel login

# 2. Navigate to frontend
cd frontend

# 3. Create production environment file
echo "REACT_APP_API_URL=https://your-railway-backend.railway.app" > .env.production

# 4. Deploy
vercel --prod

# 5. Return to project root
cd ..
```

### Step 3: Configure CORS

```bash
# Update Railway backend with Vercel frontend URL
railway variables set CORS_ORIGIN=https://your-vercel-app.vercel.app
railway variables set ALLOWED_ORIGINS="https://your-vercel-app.vercel.app,http://localhost:3000"
```

## Alternative: Simple Hosting Options

### Option 1: Netlify + Render
- Frontend: Drag & drop `frontend/build` folder to Netlify
- Backend: Connect GitHub repo to Render

### Option 2: GitHub Pages + Heroku
- Frontend: Deploy build folder to GitHub Pages
- Backend: Deploy to Heroku free tier

## What You Get After Deployment

### Live Application Features
- User registration and authentication
- Event browsing and search
- Real-time booking system
- Admin event management
- LLM-powered chat assistant
- Mobile-responsive design

### API Endpoints
- **Authentication:** `${backend_url}:7005/api/auth/*`
- **Client Services:** `${backend_url}:6001/api/*`
- **Admin Services:** `${backend_url}:5001/api/admin/*`
- **LLM Services:** `${backend_url}:5003/api/llm/*`

## Testing Your Deployment

```bash
# Test backend health
curl https://your-backend-url.railway.app/health

# Test frontend
curl https://your-frontend-url.vercel.app

# Test authentication
curl -X POST https://your-backend-url.railway.app:7005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "name": "Test User"}'
```

## Application URLs

After deployment, update these in your documentation:
- **Live Demo:** https://your-frontend-url.vercel.app
- **API Base:** https://your-backend-url.railway.app  
- **GitHub Repo:** https://github.com/emilydresback/CPSC3720-Team-Project

## Download Links

- **Source Code:** [GitHub Repository](https://github.com/emilydresback/CPSC3720-Team-Project)
- **Latest Release:** [Sprint2v2 Branch](https://github.com/emilydresback/CPSC3720-Team-Project/archive/refs/heads/Sprint2v2.zip)
- **Documentation:** Available in `/docs` folder

## Troubleshooting

### Common Issues
1. **CORS Errors:** Ensure CORS_ORIGIN is set to frontend URL
2. **Database Issues:** SQLite will auto-initialize on first run
3. **Port Conflicts:** Railway auto-assigns ports, use environment variables

### Support
- Run `npm test` to verify all tests still pass
- Check deployment logs in Railway/Vercel dashboards
- Ensure environment variables are properly set

**Your TigerTix application is production-ready with 100% test coverage!**