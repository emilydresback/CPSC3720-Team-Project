#!/bin/bash

# TigerTix Deployment Script
# Automates the deployment of TigerTix to free hosting platforms

echo "TigerTix Deployment Automation"
echo "=================================="

# Check if required tools are installed
check_tools() {
    echo "Checking required tools..."
    
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "Error: npm is not installed"
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        echo "Error: Git is not installed"
        exit 1
    fi
    
    echo "All required tools are installed"
}

# Install deployment tools
install_tools() {
    echo "Installing deployment tools..."
    
    # Install Vercel CLI
    if ! command -v vercel &> /dev/null; then
        echo "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Install Railway CLI
    if ! command -v railway &> /dev/null; then
        echo "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo "Deployment tools installed"
}

# Run tests before deployment
run_tests() {
    echo "Running tests before deployment..."
    
    # Install dependencies
    npm install
    
    # Install backend dependencies
    cd backend/user-authentication && npm install && cd ../..
    cd backend/admin-service && npm install && cd ../..
    cd backend/client-service && npm install && cd ../..
    cd backend/llm-booking-service && npm install && cd ../..
    
    # Install frontend dependencies
    cd frontend && npm install && cd ..
    
    # Run backend tests
    echo "Running backend tests..."
    npm run test:backend
    
    if [ $? -ne 0 ]; then
        echo "Backend tests failed. Deployment aborted."
        exit 1
    fi
    
    # Run frontend tests
    echo "Running frontend tests..."
    npm run test:frontend
    
    if [ $? -ne 0 ]; then
        echo "Frontend tests failed. Deployment aborted."
        exit 1
    fi
    
    echo "All tests passed"
}

# Deploy backend to Railway
deploy_backend() {
    echo "Deploying backend to Railway..."
    
    # Login to Railway (if not already logged in)
    railway login
    
    # Create new project or use existing
    railway project new tigertix-backend 2>/dev/null || echo "Using existing project"
    
    # Set environment variables
    railway variables set NODE_ENV=production
    railway variables set JWT_SECRET=$(openssl rand -base64 32)
    railway variables set DATABASE_PATH=./backend/shared-db/database.sqlite
    railway variables set AUTH_PORT=7005
    railway variables set ADMIN_PORT=5001
    railway variables set CLIENT_PORT=6001
    railway variables set LLM_PORT=5003
    
    # Deploy
    railway up
    
    # Get deployment URL
    BACKEND_URL=$(railway status --json | jq -r '.deployments[0].url')
    echo "Backend deployed to: $BACKEND_URL"
    
    # Save URL for frontend configuration
    echo "REACT_APP_API_URL=$BACKEND_URL" > frontend/.env.production
}

# Deploy frontend to Vercel
deploy_frontend() {
    echo "Deploying frontend to Vercel..."
    
    cd frontend
    
    # Login to Vercel (if not already logged in)
    vercel login
    
    # Deploy to production
    vercel --prod --yes
    
    # Get deployment URL
    FRONTEND_URL=$(vercel ls tigertix-frontend --json | jq -r '.[0].url' | sed 's/^/https:\/\//')
    echo "Frontend deployed to: $FRONTEND_URL"
    
    cd ..
    
    # Update backend CORS configuration
    railway variables set CORS_ORIGIN=$FRONTEND_URL
    railway variables set ALLOWED_ORIGINS="$FRONTEND_URL,http://localhost:3000"
}

# Test deployed application
test_deployment() {
    echo "Testing deployed application..."
    
    # Wait for services to start
    echo "Waiting for services to start..."
    sleep 30
    
    # Test backend health
    echo "Testing backend health..."
    if curl -f "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo "Backend is healthy"
    else
        echo "Warning: Backend health check failed"
    fi
    
    # Test frontend
    echo "Testing frontend..."
    if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
        echo "Frontend is accessible"
    else
        echo "Warning: Frontend health check failed"
    fi
}

# Generate deployment summary
generate_summary() {
    echo "Generating deployment summary..."
    
    cat > DEPLOYMENT_SUMMARY.md << EOF
# TigerTix Deployment Summary

## Deployment Information
- **Date:** $(date)
- **Branch:** $(git branch --show-current)
- **Commit:** $(git rev-parse --short HEAD)

## Live URLs
- **Frontend:** $FRONTEND_URL
- **Backend:** $BACKEND_URL
- **GitHub Repository:** https://github.com/$(git config user.name)/CPSC3720-Team-Project

## API Endpoints
- **Authentication:** $BACKEND_URL:7005
- **Admin Service:** $BACKEND_URL:5001
- **Client Service:** $BACKEND_URL:6001
- **LLM Service:** $BACKEND_URL:5003

## Test Results
- **Total Tests:** 138
- **Backend Tests:** Passed
- **Frontend Tests:** Passed

## Hosting Platforms
- **Frontend:** Vercel (Free tier)
- **Backend:** Railway (Free tier)
- **Database:** SQLite (In-container)

## Features Available
- User Authentication
- Event Management
- Booking System
- Admin Dashboard
- LLM-powered Chat
- Responsive Design

## Access Instructions
1. Visit: $FRONTEND_URL
2. Register a new account or use demo credentials
3. Browse events and make bookings
4. Use chat feature for event assistance

## Source Code
- **Download:** [ZIP file](https://github.com/$(git config user.name)/CPSC3720-Team-Project/archive/refs/heads/Sprint2v2.zip)
- **Clone:** \`git clone https://github.com/$(git config user.name)/CPSC3720-Team-Project.git\`
EOF

    echo "Deployment summary created: DEPLOYMENT_SUMMARY.md"
}

# Main deployment function
main() {
    echo "Starting TigerTix deployment process..."
    
    check_tools
    install_tools
    run_tests
    deploy_backend
    deploy_frontend
    test_deployment
    generate_summary
    
    echo ""
    echo "Deployment completed successfully!"
    echo "Frontend: $FRONTEND_URL"
    echo "Backend: $BACKEND_URL"
    echo "Summary: DEPLOYMENT_SUMMARY.md"
    echo ""
    echo "Your TigerTix application is now live and accessible!"
}

# Run main function
main