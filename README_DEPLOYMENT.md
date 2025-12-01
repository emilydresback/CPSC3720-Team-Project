# TigerTix - Public Deployment Guide

## Live Application

**Your TigerTix application is ready for deployment!**

### Quick Deploy (One Command)
```bash
./deploy.sh
```

This automated script will:
- Run all 138 tests
- Deploy backend to Railway (Free)
- Deploy frontend to Vercel (Free)
- Configure API endpoints
- Generate deployment summary

---

## Application Features

### Core Functionality
- **User Authentication** - Secure login/register system
- **Event Management** - Browse and search events
- **Booking System** - Reserve tickets with real-time availability
- **Admin Dashboard** - Manage events and bookings
- **LLM Chat Assistant** - AI-powered event recommendations
- **Responsive Design** - Mobile and desktop optimized

### Technical Stack
- **Frontend:** React 18 + CSS3
- **Backend:** Node.js + Express (4 microservices)
- **Database:** SQLite
- **Authentication:** JWT tokens
- **Testing:** 138 automated tests (100% passing)

---

## Deployment Options

### Option 1: Automatic Deployment (Recommended)
```bash
# Clone the repository
git clone https://github.com/your-username/CPSC3720-Team-Project.git
cd CPSC3720-Team-Project

# Run automated deployment
./deploy.sh
```

### Option 2: Manual Deployment

#### Backend (Railway/Render)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy backend
railway login
railway deploy
```

#### Frontend (Vercel)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

---

## Environment Configuration

### Backend Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_here
DATABASE_PATH=./backend/shared-db/database.sqlite
CORS_ORIGIN=https://your-frontend-url.vercel.app
AUTH_PORT=7005
ADMIN_PORT=5001
CLIENT_PORT=6001
LLM_PORT=5003
```

### Frontend Environment Variables
```env
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

---

## Quality Assurance

### Automated Testing Suite
- **Total Tests:** 138 tests across 8 test files
- **Coverage:** Authentication, booking, admin, LLM services
- **Status:** 100% passing
- **CI/CD:** GitHub Actions integration

### Test Categories
- Unit tests for all controllers
- Integration tests for API endpoints
- Frontend component testing
- Database concurrency testing

---

## Expected Live URLs

After deployment, your application will be available at:

- **Frontend:** `https://tigertix-[random].vercel.app`
- **Backend API:** `https://tigertix-backend-[random].railway.app`
- **GitHub Repo:** Your repository URL for downloads

---

## Download & Access

### Source Code Access
1. **GitHub Repository:** Clone or download ZIP
2. **Live Demo:** Access via deployed frontend URL
3. **Documentation:** Complete guides in `/docs` folder
4. **API Documentation:** Available after deployment

### Demo Credentials (After Deployment)
- Create new account via registration
- Or use admin features with proper authentication

---

## Key Benefits

### For Users
- **Fast & Responsive** - Optimized for all devices
- **Secure** - JWT authentication & data protection  
- **Intelligent** - AI-powered event recommendations
- **Reliable** - 100% test coverage ensures stability

### For Developers
- **Modern Stack** - React + Node.js microservices
- **CI/CD Ready** - Automated testing & deployment
- **Scalable Architecture** - Modular service design
- **Well Documented** - Comprehensive guides & tests

---

## Ready to Deploy?

1. **Run Tests:** `npm test` (Verify 138/138 passing)
2. **Deploy:** `./deploy.sh` (Automated deployment)
3. **Access:** Visit your live URLs
4. **Share:** Send live URLs to users

**Deployment Time:** ~5-10 minutes for complete setup

---

## Support

- **Documentation:** See `/docs` folder
- **Issues:** Check GitHub Issues
- **Testing:** Run `npm test` for validation

**Your TigerTix application is production-ready with full automation!**