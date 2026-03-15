# Lynx Consultancy System

A comprehensive consultancy management system built with Node.js and Express, featuring user authentication, booking management, payment processing, and real-time communication.

## 🚀 Features

- **User Management**: Authentication and authorization with JWT
- **Booking System**: Complete booking lifecycle management
- **Payment Integration**: Stripe payment processing with webhooks
- **Real-time Communication**: Socket.io for live updates
- **File Management**: Secure file upload and storage
- **Admin Panel**: Administrative interface for system management
- **Email Notifications**: Automated email communications
- **Database Integration**: MongoDB with Mongoose ODM
- **Scheduled Tasks**: Cron jobs for automated processes

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Socket.io** - Real-time communication
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

### Payment & Communication
- **Stripe** - Payment processing
- **Nodemailer** - Email sending
- **Firebase Admin** - Push notifications

### Development Tools
- **Nodemon** - Development auto-restart
- **Morgan** - HTTP request logger
- **dotenv** - Environment variable management
- **Multer** - File upload handling
- **node-cron** - Scheduled tasks
- **moment-timezone** - Date/time handling

### Security & Utilities
- **CORS** - Cross-origin resource sharing
- **Cookie-parser** - Cookie handling
- **EJS** - Template engine

## 📁 Project Structure

```
ConsultancySystem/
├── src/
│   ├── configs/          # Configuration files
│   ├── controllers/      # Route controllers
│   ├── cron/            # Scheduled tasks
│   ├── helpers/         # Utility functions
│   ├── middlewares/     # Custom middlewares
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── seeders/         # Database seeders
│   └── utils/           # General utilities
├── content/             # Static content
├── uploads/             # File uploads
├── views/               # EJS templates
├── app.js              # Main application entry
├── package.json        # Dependencies and scripts
└── .env                # Environment variables
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ConsultancySystem
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file with the following variables:
```
PORT=3000
APP_NAME=lynx-backend
DB_CONNECTION_STRING=mongodb://localhost:27017/lynx-consultancy
JWT_SECRET=your-jwt-secret
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_WEBHOOK_SECRET=your-webhook-secret
EMAIL_HOST=your-email-host
EMAIL_USER=your-email
EMAIL_PASS=your-email-password
FIREBASE_PROJECT_ID=your-firebase-project-id
```

4. Start the server
```bash
# Development
npm run server:dev

# Production
npm run server
```

## 📚 API Documentation

The API follows RESTful conventions and is available at:
```
http://localhost:3000/lynx-backend/v1/api/
```

### Authentication
All protected routes require JWT authentication in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🔧 Available Scripts

- `npm run server` - Start production server
- `npm run server:dev` - Start development server with auto-restart

## 🔐 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- CORS protection
- Input validation and sanitization
- Secure file upload handling
- Environment variable protection

## 💳 Payment Integration

Integrated with Stripe for secure payment processing:
- One-time payments
- Subscription management
- Webhook handling for payment events
- Secure checkout process

## 📧 Email & Notifications

- Automated email notifications
- Firebase push notifications
- Booking confirmations and reminders
- Payment receipts

## 🗄️ Database

Uses MongoDB with the following main collections:
- Users (authentication and profiles)
- Bookings (appointment management)
- Payments (transaction records)
- Services (consultancy services)

## 🔄 Real-time Features

Socket.io integration for:
- Live booking updates
- Real-time notifications
- Admin dashboard updates
- Chat functionality

## 📅 Scheduled Tasks

Automated processes using node-cron:
- Booking status updates
- Reminder notifications
- Data cleanup tasks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 📞 Support

For support and inquiries, please contact the development team.

---

**Note**: This is the backend API for the Lynx Consultancy System. Make sure to configure all environment variables before running the application.