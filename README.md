# QUIZZER - Interactive Quiz Management System

A modern quiz application with admin and student roles, built with vanilla JavaScript and Firebase.

## Features

- **Admin Panel**: Create questions, view scores, and analytics
- **Student Panel**: Take timed quizzes and view results
- **Authentication**: Secure login/registration system
- **Dark/Light Theme**: Toggle between themes
- **Real-time Analytics**: Visual score distribution charts
- **Exam Scheduling**: Set quiz availability windows
- **Notifications**: Browser notifications for upcoming exams

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/quizzer.git
cd quizzer
```

2. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)

3. Enable Authentication (Email/Password) and Firestore Database

4. Replace Firebase config in `app.js`:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

5. Set your admin access key in `app.js`:
```javascript
const ADMIN_ACCESS_KEY = "YOUR_SECURE_KEY";
```

6. Open `index.html` in your browser

## Usage

### Admin
- Register as Admin using your access key
- Create questions individually or bulk upload JSON
- Set quiz duration and schedule
- Monitor student scores and analytics

### Students
- Register as Student
- Take quizzes within scheduled time
- View results and history

## Bulk Upload Format

```json
[
  {
    "question": "What is 2+2?",
    "options": {"A": "2", "B": "4", "C": "6", "D": "8"},
    "correctAnswer": "B"
  }
]
```

## Technologies

- HTML5, CSS3, JavaScript (ES6+)
- Firebase Authentication
- Cloud Firestore
- Chart.js

## License

MIT

## Author

Dev Sioplight
