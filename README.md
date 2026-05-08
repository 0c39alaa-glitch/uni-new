# 🎓 University Support System

A web-based ticketing system that helps university students submit and track support requests.

## 📋 Features

- ✅ Student Registration & Login
- ✅ Submit Support Tickets
- ✅ Track Ticket Status
- ✅ Admin Dashboard
- ✅ Admin Reply to Tickets
- ✅ JWT Authentication

## 🛠️ Technologies

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (raw SQL)
- **Authentication:** JWT, bcryptjs
- **DevOps:** Docker

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL

### Installation

1. Clone the repository
```bash
git clone https://github.com/0c39alaa-glitch/university-support.git
cd university-support
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables — create a `.env` file:
```
PORT=3000
JWT_SECRET=mysecretkey123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=university_support
DB_USER=postgres
DB_PASSWORD=123456
```

4. Run the application
```bash
node src/index.js
```

5. Open browser
```
http://localhost:3000
```

> **Note:** Default users are created automatically on first run.

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login user |
| POST | /api/tickets | Create ticket |
| GET | /api/tickets/my | Get my tickets |
| GET | /api/tickets | Get all tickets (Admin) |
| PUT | /api/tickets/:id/status | Update status (Admin) |
| POST | /api/tickets/:id/reply | Reply to ticket (Admin) |

## 🐳 Docker

```bash
docker build -t university-support .
docker run -p 3000:3000 university-support
```

## 👥 Default Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@university.com | admin123 |
| Student | sara@university.com | 123456 |
