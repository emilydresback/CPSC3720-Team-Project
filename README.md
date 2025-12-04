CPSC 3720 - TigerTix AI Campus Ticketing System

## Project Overview
TigerTix is a microservice-based web application designed to help students discover campus events and book tickets via a conversational AI assistant. 

The system includes:
    - A React frontend
    - Three backend microservices (Admin, Client, User Authentication)
    - A shared SQLite database
    - An LLM-powered booking assistant with speech recognition and text-to-speech 
    - Full JWT cookie-based authentication
    - Concurrent ticket purchase protection
    - Custom “Book Now” flow with optimistic UI updates

TigerTix mimics a production microservice architecture while staying easy to run locally.

## Tech Stack
Frontend:
    - React (CRA)
    - JavaScript
    - Web Speech API (TTS + STT)

Backend:
    - Node.js
    - Express.js
    - Microservices (Admin, Client, User Authentication)
    - JWT Authentication (HTTP-only cookies)
    - SQLite (via sqlite3)
    - CORS + Cookie support

Database:
    - SQLite shared DB located at backend/shared-db/database.sqlite

AI Integration:
    - OpenAI GPT-4o-mini via CORS proxy
    - LLM action tags for booking confirmation
    - Voice input + speech synthesis

Testing:
    - Jest

Deployment & Hosting:
    - Railway (Backend deployment): https://tigertix-production.up.railway.app
    - Vercel (Frontend deployment): https://frontend-gt4dh08wk-annas-projects-51838d83.vercel.app/

Platform:
    - Git version control

## Architecture Summary
Admin Service:
    - Port: 5001
    - Function: Manages events and creates/updates ticket data

Client Service: 
    - Port: 6001
    - Function: Exposes /api/events and /purchase endpoints

User Authentication Service:
    - Port: 7005
    - Handles register, login, logout, and JWT cookie auth

Frontend (React):
    - Runs on localhost:3000, calling all microservices directly.

Database:
    - Found at backend/shared-db/database.sqlite, shared by all backend services via their respective models.

Data Flow:
    1. Authentication
        - The user submits credentials from the frontend (/register or /login).
        - The frontend sends request to the auth service.
        - The auth service validates credentials, stores or verifies the user in SQLite, and issues a JWT in an HTTP-only cookie.
        - The frontend updates its session state via AuthContext.
        - Logout clears the cookie and resets the frontend session.
    
    2. Event Browsing
        - The frontend loads the home page.
        - The frontend requests GET /api/events to the client service.
        - The client service reads events from the shared database and returns them.
        - The frontend displays the events and supplies them to the LLM assistant for context.

    3. Ticket Purchasing
        - The user clicks "Book Ticket" or confirms via AI.
        - The frontend sends POST /api/events/:id/purchase to the client service.
        - The client service validates ticket availability, decrements the ticket count in SQLite, and responds with success or failure.
        - The frontend updates the UI and shows status messages.

    4. Admin Management
        - The admin sends create/update requests to the admin service.
        - The admin service writes directly to the shared database.
        - The updated event data becomes immediately visible to the client service and frontend.

## Installation and Setup Instructions
Installation:
    1. Clone the repo and navigate to "CPSC3720-Team-Project".
    2. Install dependencies in the frontend and each of the backend microservices using npm install.

Setup:
    1. Navigate to backend/admin-service.
    2. Run npm start.
    3. In a new terminal, navigate to backend/client-service.
    4. Run npm start.
    5. In a new terminal, navigate to backend/user-authentication.
    6. Run npm start.
    7. In a new terminal, navigate to the frontend.
    8. Run npm start.

## Environment Variables Setup
There exists a .env file in frontend/src that contains the API key.

The setup is as follows:

    REACT_APP_OPENAI_API_KEY=your_key_here
    PORT=7005
    DATABASE_PATH=../shared-db/database.sqlite
    JWT_SECRET=your_jwt_secret_here
    CORS_ALLOW_ORIGIN=http://localhost:3000

## How to Run Regression Tests
Full Test Suite:
    1. Navigate to the project root directory.
    2. Run npm run test:all to execute all 138 automated tests.
    3. Individual service tests: npm run test:admin, npm run test:client, npm run test:auth, npm run test:frontend.
    4. Integration tests: npm run test:integration, npm run test:e2e, npm run test:database.


## Team Members, Instructor, TAs, and Roles
Team Members:
    - Anna Galeano: Project Lead
    - Emily Dresback: Quality & Compliance Lead, Scrum Master
    - Milka Ndubuisi: Technical Lead

Instructor: Dr. Brinkley

TAs: Colt Doster and Atik Enam


## License
MIT License
Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Demo Video
Watch our demo sprint 3: [https://youtu.be/gGBjCrMPdEQ](url)

## Github
We are submitting the branch: final
[https://github.com/emilydresback/CPSC3720-Team-Project/tree/final](url)
