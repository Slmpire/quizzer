import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, onSnapshot, query, orderBy, limit, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDHDr97LespxW-Xw8tqZkFXJc1dqr-z14E",
    authDomain: "cbt-test-base.firebaseapp.com",
    projectId: "cbt-test-base",
    storageBucket: "cbt-test-base.firebasestorage.app",
    messagingSenderId: "357554144599",
    appId: "1:357554144599:web:afdea4523ef59c7a9b6a12",
    measurementId: "G-V68WRWEWGX"
};

// ADMIN SECURITY CONFIGURATION
const ADMIN_ACCESS_KEY = "QUIZ_ADMIN_2024";
const MAX_ADMINS = 1;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let currentQuestions = [];
let studentAnswers = {};
let currentQuestionIndex = 0;
let timerInterval;
let timeRemaining;
let examSchedule = { start: null, end: null };
let scoreChart = null;

// DOM Elements
const authSection = document.getElementById('auth-section');
const mainContent = document.getElementById('main-content');
const homeSection = document.getElementById('home-section');
const adminPanel = document.getElementById('admin-panel');
const studentPanel = document.getElementById('student-panel');
const timerContainer = document.getElementById('timer-container');
const timerDisplay = document.getElementById('timer');
const topScorerDetails = document.getElementById('top-scorer-details');
const upcomingTestsList = document.getElementById('upcoming-tests-list');
const progressBarFill = document.getElementById('progress-bar-fill');

// Theme Toggle
window.toggleTheme = function() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    document.querySelector('.theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
};

// Load saved theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.querySelector('.theme-toggle').textContent = '☀️';
}

// Notification Permission
window.requestNotificationPermission = async function() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            alert('Notifications enabled! You will receive exam reminders.');
            scheduleNotifications();
        } else {
            alert('Notifications denied. You can enable them in your browser settings.');
        }
    }
};

// Schedule notifications for upcoming exams
async function scheduleNotifications() {
    const adminSnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt')));
    adminSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.role === 'admin' && userData.examStart && userData.examEnd) {
            const startTime = userData.examStart.toDate();
            const notificationTime = new Date(startTime.getTime() - 15 * 60 * 1000); // 15 minutes before
            if (notificationTime > new Date()) {
                setTimeout(() => {
                    new Notification('QUIZZER Exam Reminder', {
                        body: `The quiz is starting in 15 minutes at ${startTime.toLocaleString()}!`,
                        icon: 'https://example.com/quizzer-icon.png'
                    });
                }, notificationTime - new Date());
            }
        }
    });
}

// Tab switching functions
window.switchTab = function(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
};

window.switchAdminTab = function(tab) {
    document.querySelectorAll('#admin-panel .tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#admin-panel .tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
    
    if (tab === 'view-scores') {
        loadStudentScores();
    } else if (tab === 'analytics') {
        loadAnalytics();
    }
};

window.toggleAdminKey = function() {
    const role = document.getElementById('register-role').value;
    const adminKeyGroup = document.getElementById('admin-key-group');
    const quizDurationGroup = document.getElementById('quiz-duration-group');
    const examScheduleGroup = document.getElementById('exam-schedule-group');
    
    if (role === 'admin') {
        adminKeyGroup.classList.remove('hidden');
        quizDurationGroup.classList.remove('hidden');
        examScheduleGroup.classList.remove('hidden');
        document.getElementById('admin-key').required = true;
        document.getElementById('quiz-duration').required = true;
        document.getElementById('exam-start').required = true;
        document.getElementById('exam-end').required = true;
    } else {
        adminKeyGroup.classList.add('hidden');
        quizDurationGroup.classList.add('hidden');
        examScheduleGroup.classList.add('hidden');
        document.getElementById('admin-key').required = false;
        document.getElementById('quiz-duration').required = false;
        document.getElementById('exam-start').required = false;
        document.getElementById('exam-end').required = false;
    }
};

// Validate single question input
window.validateQuestion = function() {
    const question = document.getElementById('question-text').value;
    const optionA = document.getElementById('option-a').value;
    const optionB = document.getElementById('option-b').value;
    const optionC = document.getElementById('option-c').value;
    const optionD = document.getElementById('option-d').value;
    const correctAnswer = document.getElementById('correct-answer').value;

    document.getElementById('question-error').textContent = question ? '' : 'Question is required.';
    document.getElementById('option-a-error').textContent = optionA ? '' : 'Option A is required.';
    document.getElementById('option-b-error').textContent = optionB ? '' : 'Option B is required.';
    document.getElementById('option-c-error').textContent = optionC ? '' : 'Option C is required.';
    document.getElementById('option-d-error').textContent = optionD ? '' : 'Option D is required.';
    document.getElementById('correct-answer-error').textContent = correctAnswer ? '' : 'Correct answer is required.';
};

// Validate bulk questions JSON
window.validateBulkQuestions = function() {
    const bulkQuestions = document.getElementById('bulk-questions').value;
    const errorDiv = document.getElementById('bulk-questions-error');
    
    try {
        const questions = JSON.parse(bulkQuestions);
        if (!Array.isArray(questions)) {
            errorDiv.textContent = 'Input must be a JSON array.';
            return false;
        }

        for (const q of questions) {
            if (!q.question || typeof q.question !== 'string') {
                errorDiv.textContent = 'Each question must have a valid question text.';
                return false;
            }
            if (!q.options || typeof q.options !== 'object' || !q.options.A || !q.options.B || !q.options.C || !q.options.D) {
                errorDiv.textContent = 'Each question must have four valid options (A, B, C, D).';
                return false;
            }
            if (!q.correctAnswer || !['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
                errorDiv.textContent = 'Each question must have a valid correct answer (A, B, C, or D).';
                return false;
            }
        }
        errorDiv.textContent = '';
        return true;
    } catch (e) {
        errorDiv.textContent = 'Invalid JSON format.';
        return false;
    }
};

// Check admin limit
async function checkAdminLimit() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let adminCount = 0;
        
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.role === 'admin') {
                adminCount++;
            }
        });
        
        return adminCount < MAX_ADMINS;
    } catch (error) {
        console.error('Error checking admin limit:', error);
        return false;
    }
}

// Load top scorer and upcoming tests
async function loadHomeContent() {
    // Load top scorer
    const scoresSnapshot = await getDocs(query(collection(db, 'scores'), orderBy('score', 'desc'), limit(1)));
    if (!scoresSnapshot.empty) {
        const topScore = scoresSnapshot.docs[0].data();
        const userDoc = await getDoc(doc(db, 'users', topScore.userId));
        const userName = userDoc.exists() ? userDoc.data().name : 'Unknown';
        const percentage = Math.round((topScore.score / topScore.totalQuestions) * 100);
        topScorerDetails.innerHTML = `
            <p><strong>${userName}</strong></p>
            <p>Score: ${topScore.score}/${topScore.totalQuestions} (${percentage}%)</p>
            <p>Date: ${topScore.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
        `;
    } else {
        topScorerDetails.innerHTML = '<p>No scores available yet.</p>';
    }

    // Load upcoming tests
    const adminSnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt')));
    let tests = [];
    adminSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.role === 'admin' && userData.examStart && userData.examEnd) {
            tests.push({
                start: userData.examStart.toDate(),
                end: userData.examEnd.toDate()
            });
        }
    });

    upcomingTestsList.innerHTML = tests.length > 0 ? tests.map(test => `
        <p>Quiz: ${test.start.toLocaleString()} - ${test.end.toLocaleString()}</p>
    `).join('') : '<p>No upcoming tests scheduled.</p>';
}

// Authentication functions
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;
    const adminKey = document.getElementById('admin-key').value;
    const quizDuration = document.getElementById('quiz-duration').value;
    const examStart = document.getElementById('exam-start').value;
    const examEnd = document.getElementById('exam-end').value;

    if (role === 'admin') {
        if (adminKey !== ADMIN_ACCESS_KEY) {
            alert('Invalid admin access key.');
            return;
        }

        const canCreateAdmin = await checkAdminLimit();
        if (!canCreateAdmin) {
            alert('Maximum number of administrators reached.');
            return;
        }

        if (new Date(examStart) >= new Date(examEnd)) {
            alert('Exam end time must be after start time.');
            return;
        }
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            name: name,
            email: email,
            role: role,
            quizDuration: role === 'admin' ? parseInt(quizDuration) : null,
            examStart: role === 'admin' ? new Date(examStart) : null,
            examEnd: role === 'admin' ? new Date(examEnd) : null,
            createdAt: new Date()
        });

        alert('Registration successful!');
    } catch (error) {
        alert('Registration error: ' + error.message);
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Login error: ' + error.message);
    }
});

document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;

    try {
        await sendPasswordResetEmail(auth, email);
        alert('Password reset email sent! Check your inbox.');
    } catch (error) {
        alert('Error sending reset email: ' + error.message);
    }
});

window.logout = async function() {
    try {
        clearInterval(timerInterval);
        await signOut(auth);
    } catch (error) {
        alert('Logout error: ' + error.message);
    }
};

window.showHome = function() {
    authSection.classList.remove('hidden');
    mainContent.classList.add('hidden');
    homeSection.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    studentPanel.classList.add('hidden');
    timerContainer.classList.add('hidden');
    clearInterval(timerInterval);
};

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();

        authSection.classList.add('hidden');
        homeSection.classList.add('hidden');
        mainContent.classList.remove('hidden');

        if (userData.role === 'admin') {
            adminPanel.classList.remove('hidden');
            studentPanel.classList.add('hidden');
            loadQuestions();
        } else {
            studentPanel.classList.remove('hidden');
            adminPanel.classList.add('hidden');
            loadQuizHistory();
        }
    } else {
        currentUser = null;
        authSection.classList.remove('hidden');
        mainContent.classList.add('hidden');
        homeSection.classList.remove('hidden');
        adminPanel.classList.add('hidden');
        studentPanel.classList.add('hidden');
        timerContainer.classList.add('hidden');
        clearInterval(timerInterval);
        loadHomeContent();
    }
});

// Admin functions
document.getElementById('question-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const questionData = {
        question: document.getElementById('question-text').value,
        options: {
            A: document.getElementById('option-a').value,
            B: document.getElementById('option-b').value,
            C: document.getElementById('option-c').value,
            D: document.getElementById('option-d').value
        },
        correctAnswer: document.getElementById('correct-answer').value,
        createdAt: new Date(),
        createdBy: currentUser.uid
    };

    try {
        await addDoc(collection(db, 'questions'), questionData);
        document.getElementById('question-form').reset();
        document.querySelectorAll('.validation-error').forEach(el => el.textContent = '');
        alert('Question added successfully!');
        loadQuestions();
    } catch (error) {
        alert('Error adding question: ' + error.message);
    }
});

document.getElementById('bulk-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateBulkQuestions()) {
        return;
    }

    const bulkQuestions = JSON.parse(document.getElementById('bulk-questions').value);

    try {
        for (const questionData of bulkQuestions) {
            await addDoc(collection(db, 'questions'), {
                question: questionData.question,
                options: questionData.options,
                correctAnswer: questionData.correctAnswer,
                createdAt: new Date(),
                createdBy: currentUser.uid
            });
        }
        document.getElementById('bulk-upload-form').reset();
        document.getElementById('bulk-questions-error').textContent = '';
        alert('Questions uploaded successfully!');
        loadQuestions();
    } catch (error) {
        alert('Error uploading questions: ' + error.message);
    }
});

async function loadQuestions() {
    try {
        const questionsSnapshot = await getDocs(collection(db, 'questions'));
        const questionsContainer = document.getElementById('questions-container');
        questionsContainer.innerHTML = '';

        questionsSnapshot.forEach((doc) => {
            const question = doc.data();
            const questionCard = document.createElement('div');
            questionCard.className = 'question-card';
            questionCard.innerHTML = `
                <h4>${question.question}</h4>
                <div class="question-options">
                    <p><strong>A:</strong> ${question.options.A}</p>
                    <p><strong>B:</strong> ${question.options.B}</p>
                    <p><strong>C:</strong> ${question.options.C}</p>
                    <p><strong>D:</strong> ${question.options.D}</p>
                    <p><strong>Correct Answer:</strong> ${question.correctAnswer}</p>
                </div>
            `;
            questionsContainer.appendChild(questionCard);
        });
    } catch (error) {
        console.error('Error loading questions:', error);
    }
}

async function loadStudentScores() {
    try {
        const scoresSnapshot = await getDocs(collection(db, 'scores'));
        const scoresContainer = document.getElementById('scores-container');
        scoresContainer.innerHTML = '<h4>Student Scores</h4>';

        const scores = [];
        for (const scoreDoc of scoresSnapshot.docs) {
            const score = scoreDoc.data();
            const userDoc = await getDoc(doc(db, 'users', score.userId));
            const userName = userDoc.exists() ? userDoc.data().name : 'Unknown';
            
            scores.push({
                name: userName,
                score: score.score,
                totalQuestions: score.totalQuestions,
                percentage: Math.round((score.score / score.totalQuestions) * 100),
                timestamp: score.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
            });
        }

        scores.sort((a, b) => b.percentage - a.percentage);

        const scoresDiv = document.createElement('div');
        scoresDiv.className = 'student-scores';
        
        scores.forEach(score => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <span><strong>${score.name}</strong></span>
                <span>${score.score}/${score.totalQuestions} (${score.percentage}%)</span>
                <span style="font-size: 0.9em; color: var(--text);">${score.timestamp}</span>
            `;
            scoresDiv.appendChild(scoreItem);
        });

        scoresContainer.appendChild(scoresDiv);
    } catch (error) {
        console.error('Error loading scores:', error);
        document.getElementById('scores-container').innerHTML = '<p>Error loading scores</p>';
    }
}

async function loadAnalytics() {
    try {
        const scoresSnapshot = await getDocs(collection(db, 'scores'));
        const scoreDistribution = {};

        scoresSnapshot.forEach(doc => {
            const score = doc.data();
            const percentage = Math.round((score.score / score.totalQuestions) * 100);
            const range = Math.floor(percentage / 10) * 10;
            scoreDistribution[range] = (scoreDistribution[range] || 0) + 1;
        });

        const labels = ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'];
        const data = labels.map(label => scoreDistribution[parseInt(label.split('-')[0])] || 0);

        if (scoreChart) {
            scoreChart.destroy();
        }

        const ctx = document.getElementById('score-chart').getContext('2d');
        scoreChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score Distribution',
                    data: data,
                    backgroundColor: document.body.getAttribute('data-theme') === 'dark' ? '#66BB6A' : '#4CAF50',
                    borderColor: document.body.getAttribute('data-theme') === 'dark' ? '#98FB98' : '#2E7D32',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: document.body.getAttribute('data-theme') === 'dark' ? '#E8F5E9' : '#1B5E20' },
                        grid: { color: document.body.getAttribute('data-theme') === 'dark' ? '#4B5E6A' : '#C8E6C9' }
                    },
                    x: {
                        ticks: { color: document.body.getAttribute('data-theme') === 'dark' ? '#E8F5E9' : '#1B5E20' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { labels: { color: document.body.getAttribute('data-theme') === 'dark' ? '#E8F5E9' : '#1B5E20' } }
                }
            }
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadQuizHistory() {
    try {
        const scoresSnapshot = await getDocs(query(collection(db, 'scores'), where('userId', '==', currentUser.uid)));
        const historyContainer = document.getElementById('history-container');
        historyContainer.innerHTML = '';

        const historyDiv = document.createElement('div');
        historyDiv.className = 'quiz-history';
        
        if (scoresSnapshot.empty) {
            historyContainer.innerHTML = '<p>No quiz history available.</p>';
            return;
        }

        const history = [];
        scoresSnapshot.forEach(doc => {
            const score = doc.data();
            history.push({
                score: score.score,
                totalQuestions: score.totalQuestions,
                percentage: Math.round((score.score / score.totalQuestions) * 100),
                timestamp: score.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
            });
        });

        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <span>Score: ${item.score}/${item.totalQuestions} (${item.percentage}%)</span>
                <span style="font-size: 0.9em; color: var(--text);">${item.timestamp}</span>
            `;
            historyDiv.appendChild(historyItem);
        });

        historyContainer.appendChild(historyDiv);
        document.getElementById('quiz-history').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading quiz history:', error);
        document.getElementById('history-container').innerHTML = '<p>Error loading history</p>';
    }
}

// Student functions
window.startQuiz = async function() {
    try {
        // Check exam schedule
        const adminSnapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt')));
        let canTakeQuiz = false;
        adminSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.role === 'admin' && userData.examStart && userData.examEnd) {
                examSchedule.start = userData.examStart.toDate();
                examSchedule.end = userData.examEnd.toDate();
                const now = new Date();
                if (now >= examSchedule.start && now <= examSchedule.end) {
                    canTakeQuiz = true;
                }
            }
        });

        if (!canTakeQuiz) {
            alert(`Quiz is not available. Schedule: ${examSchedule.start?.toLocaleString() || 'Not set'} - ${examSchedule.end?.toLocaleString() || 'Not set'}`);
            return;
        }

        const questionsSnapshot = await getDocs(collection(db, 'questions'));
        currentQuestions = [];
        
        questionsSnapshot.forEach((doc) => {
            currentQuestions.push({ id: doc.id, ...doc.data() });
        });

        if (currentQuestions.length === 0) {
            alert('No questions available. Please contact your teacher.');
            return;
        }

        studentAnswers = {};
        currentQuestionIndex = 0;

        // Get quiz duration
        let quizDuration = 30;
        adminSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.role === 'admin' && userData.quizDuration) {
                quizDuration = userData.quizDuration;
            }
        });

        timeRemaining = quizDuration * 60;
        startTimer();
        displayQuiz();
    } catch (error) {
        alert('Error loading quiz: ' + error.message);
    }
};

function startTimer() {
    timerContainer.classList.remove('hidden');
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 60) {
            timerContainer.classList.add('timer-critical');
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function displayQuiz() {
    const quizContainer = document.getElementById('quiz-questions');
    quizContainer.innerHTML = '';

    const question = currentQuestions[currentQuestionIndex];
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-card';
    questionDiv.innerHTML = `
        <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
        <div class="question-options">
            ${Object.entries(question.options).map(([key, value]) => `
                <div class="option ${studentAnswers[question.id] === key ? 'selected' : ''}" onclick="selectOption('${question.id}', '${key}', this)">
                    <strong>${key}:</strong> ${value}
                </div>
            `).join('')}
        </div>
    `;
    quizContainer.appendChild(questionDiv);

    // Update progress bar
    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    progressBarFill.style.width = `${progress}%`;

    document.getElementById('quiz-start').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
}

window.nextQuestion = function() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuiz();
    }
};

window.selectOption = function(questionId, option, element) {
    const questionCard = element.closest('.question-card');
    questionCard.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
    
    element.classList.add('selected');
    studentAnswers[questionId] = option;
};

window.submitQuiz = async function() {
    clearInterval(timerInterval);
    timerContainer.classList.add('hidden');

    let score = 0;
    const results = [];

    currentQuestions.forEach((question) => {
        const studentAnswer = studentAnswers[question.id] || 'Not answered';
        const isCorrect = studentAnswer === question.correctAnswer;
        if (isCorrect) score++;

        results.push({
            question: question.question,
            studentAnswer: studentAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect
        });
    });

    try {
        await addDoc(collection(db, 'scores'), {
            userId: currentUser.uid,
            score: score,
            totalQuestions: currentQuestions.length,
            timestamp: new Date(),
            answers: studentAnswers
        });

        displayResults(score, currentQuestions.length, results);
        loadHomeContent();
        loadQuizHistory();
    } catch (error) {
        alert('Error saving score: ' + error.message);
    }
};

function displayResults(score, total, results) {
    const percentage = Math.round((score / total) * 100);
    
    document.getElementById('final-score').textContent = `${score}/${total} (${percentage}%)`;
    
    const detailsDiv = document.getElementById('result-details');
    detailsDiv.innerHTML = `
        <div style="text-align: left; margin-top: 20px;">
            <h4>Detailed Results:</h4>
            ${results.map((result, index) => `
                <div class="question-card" style="border-left-color: ${result.isCorrect ? 'var(--primary)' : 'var(--error)'}">
                    <p><strong>Q${index + 1}:</strong> ${result.question}</p>
                    <p><strong>Your Answer:</strong> ${result.studentAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${result.correctAnswer}</p>
                    <p><strong>Result:</strong> <span style="color: ${result.isCorrect ? 'var(--primary)' : 'var(--error)'}">${result.isCorrect ? 'Correct' : 'Incorrect'}</span></p>
                </div>
            `).join('')}
        </div>
    `;
}