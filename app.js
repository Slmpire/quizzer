import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, getDoc, query, orderBy, limit, where, writeBatch } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

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

// OPTIMIZATION: Cache frequently accessed data
let cachedUserData = null;
let cachedQuestions = null;
let cachedAdminSettings = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// OPTIMIZATION: DOM Elements - cache all selectors once
const DOM = {
    authSection: null,
    mainContent: null,
    homeSection: null,
    adminPanel: null,
    studentPanel: null,
    timerContainer: null,
    timerDisplay: null,
    topScorerDetails: null,
    upcomingTestsList: null,
    progressBarFill: null,
    questionsContainer: null,
    scoresContainer: null,
    historyContainer: null,
    quizQuestions: null,
    quizStart: null,
    quizContainer: null,
    quizResults: null,
    finalScore: null,
    resultDetails: null
};

// OPTIMIZATION: Initialize DOM cache on load
function initializeDOM() {
    DOM.authSection = document.getElementById('auth-section');
    DOM.mainContent = document.getElementById('main-content');
    DOM.homeSection = document.getElementById('home-section');
    DOM.adminPanel = document.getElementById('admin-panel');
    DOM.studentPanel = document.getElementById('student-panel');
    DOM.timerContainer = document.getElementById('timer-container');
    DOM.timerDisplay = document.getElementById('timer');
    DOM.topScorerDetails = document.getElementById('top-scorer-details');
    DOM.upcomingTestsList = document.getElementById('upcoming-tests-list');
    DOM.progressBarFill = document.getElementById('progress-bar-fill');
    DOM.questionsContainer = document.getElementById('questions-container');
    DOM.scoresContainer = document.getElementById('scores-container');
    DOM.historyContainer = document.getElementById('history-container');
    DOM.quizQuestions = document.getElementById('quiz-questions');
    DOM.quizStart = document.getElementById('quiz-start');
    DOM.quizContainer = document.getElementById('quiz-container');
    DOM.quizResults = document.getElementById('quiz-results');
    DOM.finalScore = document.getElementById('final-score');
    DOM.resultDetails = document.getElementById('result-details');
}

// Call on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDOM);
} else {
    initializeDOM();
}

// OPTIMIZATION: Debounce function for validation
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Theme Toggle
window.toggleTheme = function() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    document.querySelector('.theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
};

// Load saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) themeToggle.textContent = '☀️';
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

// OPTIMIZATION: Cache admin settings and reuse
async function getAdminSettings() {
    const now = Date.now();
    if (cachedAdminSettings && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedAdminSettings;
    }

    const adminSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin'), limit(1)));
    if (!adminSnapshot.empty) {
        cachedAdminSettings = adminSnapshot.docs[0].data();
        cacheTimestamp = now;
        return cachedAdminSettings;
    }
    return null;
}

// Schedule notifications for upcoming exams
async function scheduleNotifications() {
    const settings = await getAdminSettings();
    if (settings && settings.examStart && settings.examEnd) {
        const startTime = settings.examStart.toDate();
        const notificationTime = new Date(startTime.getTime() - 15 * 60 * 1000);
        if (notificationTime > new Date()) {
            setTimeout(() => {
                new Notification('QUIZZER Exam Reminder', {
                    body: `The quiz is starting in 15 minutes at ${startTime.toLocaleString()}!`,
                    icon: 'https://example.com/quizzer-icon.png'
                });
            }, notificationTime - new Date());
        }
    }
}

// OPTIMIZATION: Use event delegation for tab switching
window.switchTab = function(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const tabButton = document.querySelector(`[onclick="switchTab('${tab}')"]`);
    const tabContent = document.getElementById(`${tab}-tab`);
    
    if (tabButton) tabButton.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
};

window.switchAdminTab = function(tab) {
    const adminPanel = DOM.adminPanel || document.getElementById('admin-panel');
    adminPanel.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    adminPanel.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) tabContent.classList.add('active');
    
    // OPTIMIZATION: Lazy load data only when needed
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
    
    const isAdmin = role === 'admin';
    const toggleClass = isAdmin ? 'remove' : 'add';
    
    adminKeyGroup.classList[toggleClass]('hidden');
    quizDurationGroup.classList[toggleClass]('hidden');
    examScheduleGroup.classList[toggleClass]('hidden');
    
    document.getElementById('admin-key').required = isAdmin;
    document.getElementById('quiz-duration').required = isAdmin;
    document.getElementById('exam-start').required = isAdmin;
    document.getElementById('exam-end').required = isAdmin;
};

// OPTIMIZATION: Debounced validation for better performance
const debouncedValidateQuestion = debounce(function() {
    const fields = [
        { id: 'question-text', error: 'question-error', message: 'Question is required.' },
        { id: 'option-a', error: 'option-a-error', message: 'Option A is required.' },
        { id: 'option-b', error: 'option-b-error', message: 'Option B is required.' },
        { id: 'option-c', error: 'option-c-error', message: 'Option C is required.' },
        { id: 'option-d', error: 'option-d-error', message: 'Option D is required.' },
        { id: 'correct-answer', error: 'correct-answer-error', message: 'Correct answer is required.' }
    ];

    fields.forEach(field => {
        const value = document.getElementById(field.id)?.value;
        const errorEl = document.getElementById(field.error);
        if (errorEl) errorEl.textContent = value ? '' : field.message;
    });
}, 300);

window.validateQuestion = debouncedValidateQuestion;

// OPTIMIZATION: Improved JSON validation with early exit
window.validateBulkQuestions = function() {
    const bulkQuestions = document.getElementById('bulk-questions').value;
    const errorDiv = document.getElementById('bulk-questions-error');
    
    if (!bulkQuestions.trim()) {
        errorDiv.textContent = 'Please enter questions in JSON format.';
        return false;
    }
    
    try {
        const questions = JSON.parse(bulkQuestions);
        if (!Array.isArray(questions)) {
            errorDiv.textContent = 'Input must be a JSON array.';
            return false;
        }

        const requiredOptions = ['A', 'B', 'C', 'D'];
        
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            
            if (!q.question || typeof q.question !== 'string') {
                errorDiv.textContent = `Question ${i + 1}: Invalid question text.`;
                return false;
            }
            
            if (!q.options || typeof q.options !== 'object') {
                errorDiv.textContent = `Question ${i + 1}: Options must be an object.`;
                return false;
            }
            
            for (const opt of requiredOptions) {
                if (!q.options[opt]) {
                    errorDiv.textContent = `Question ${i + 1}: Missing option ${opt}.`;
                    return false;
                }
            }
            
            if (!requiredOptions.includes(q.correctAnswer)) {
                errorDiv.textContent = `Question ${i + 1}: Invalid correct answer.`;
                return false;
            }
        }
        
        errorDiv.textContent = '';
        return true;
    } catch (e) {
        errorDiv.textContent = 'Invalid JSON format: ' + e.message;
        return false;
    }
};

// OPTIMIZATION: Cache admin count check
let cachedAdminCount = null;
let adminCountCacheTime = 0;

async function checkAdminLimit() {
    const now = Date.now();
    if (cachedAdminCount !== null && (now - adminCountCacheTime) < CACHE_DURATION) {
        return cachedAdminCount < MAX_ADMINS;
    }

    try {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
        cachedAdminCount = usersSnapshot.size;
        adminCountCacheTime = now;
        
        return cachedAdminCount < MAX_ADMINS;
    } catch (error) {
        console.error('Error checking admin limit:', error);
        return false;
    }
}

// OPTIMIZATION: Load home content with parallel queries
async function loadHomeContent() {
    try {
        // Parallel queries for better performance
        const [scoresSnapshot, adminSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'scores'), orderBy('score', 'desc'), limit(1))),
            getDocs(query(collection(db, 'users'), where('role', '==', 'admin'), limit(5)))
        ]);

        // Top scorer
        if (!scoresSnapshot.empty) {
            const topScore = scoresSnapshot.docs[0].data();
            const userDoc = await getDoc(doc(db, 'users', topScore.userId));
            const userName = userDoc.exists() ? userDoc.data().name : 'Unknown';
            const percentage = Math.round((topScore.score / topScore.totalQuestions) * 100);
            
            if (DOM.topScorerDetails) {
                DOM.topScorerDetails.innerHTML = `
                    <p><strong>${userName}</strong></p>
                    <p>Score: ${topScore.score}/${topScore.totalQuestions} (${percentage}%)</p>
                    <p>Date: ${topScore.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'}</p>
                `;
            }
        } else if (DOM.topScorerDetails) {
            DOM.topScorerDetails.innerHTML = '<p>No scores available yet.</p>';
        }

        // Upcoming tests
        const tests = [];
        adminSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.examStart && userData.examEnd) {
                tests.push({
                    start: userData.examStart.toDate(),
                    end: userData.examEnd.toDate()
                });
            }
        });

        if (DOM.upcomingTestsList) {
            DOM.upcomingTestsList.innerHTML = tests.length > 0 
                ? tests.map(test => `<p>Quiz: ${test.start.toLocaleString()} - ${test.end.toLocaleString()}</p>`).join('')
                : '<p>No upcoming tests scheduled.</p>';
        }
    } catch (error) {
        console.error('Error loading home content:', error);
    }
}

// Authentication functions
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
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

            // Clear cache
            cachedAdminCount = null;
            cachedAdminSettings = null;

            alert('Registration successful!');
        } catch (error) {
            alert('Registration error: ' + error.message);
        }
    });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            alert('Login error: ' + error.message);
        }
    });
}

const forgotPasswordForm = document.getElementById('forgot-password-form');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;

        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent! Check your inbox.');
        } catch (error) {
            alert('Error sending reset email: ' + error.message);
        }
    });
}

window.logout = async function() {
    try {
        clearInterval(timerInterval);
        // Clear all caches
        cachedUserData = null;
        cachedQuestions = null;
        cachedAdminSettings = null;
        cachedAdminCount = null;
        await signOut(auth);
    } catch (error) {
        alert('Logout error: ' + error.message);
    }
};

window.showHome = function() {
    DOM.authSection?.classList.remove('hidden');
    DOM.mainContent?.classList.add('hidden');
    DOM.homeSection?.classList.remove('hidden');
    DOM.adminPanel?.classList.add('hidden');
    DOM.studentPanel?.classList.add('hidden');
    DOM.timerContainer?.classList.add('hidden');
    clearInterval(timerInterval);
};

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // OPTIMIZATION: Cache user data
        if (!cachedUserData || cachedUserData.uid !== user.uid) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            cachedUserData = { uid: user.uid, ...userDoc.data() };
        }
        const userData = cachedUserData;

        DOM.authSection?.classList.add('hidden');
        DOM.homeSection?.classList.add('hidden');
        DOM.mainContent?.classList.remove('hidden');

        if (userData.role === 'admin') {
            DOM.adminPanel?.classList.remove('hidden');
            DOM.studentPanel?.classList.add('hidden');
            loadQuestions();
        } else {
            DOM.studentPanel?.classList.remove('hidden');
            DOM.adminPanel?.classList.add('hidden');
            loadQuizHistory();
        }
    } else {
        currentUser = null;
        cachedUserData = null;
        
        DOM.authSection?.classList.remove('hidden');
        DOM.mainContent?.classList.add('hidden');
        DOM.homeSection?.classList.remove('hidden');
        DOM.adminPanel?.classList.add('hidden');
        DOM.studentPanel?.classList.add('hidden');
        DOM.timerContainer?.classList.add('hidden');
        clearInterval(timerInterval);
        loadHomeContent();
    }
});

// Admin functions
const questionForm = document.getElementById('question-form');
if (questionForm) {
    questionForm.addEventListener('submit', async (e) => {
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
            questionForm.reset();
            document.querySelectorAll('.validation-error').forEach(el => el.textContent = '');
            alert('Question added successfully!');
            
            // Clear cache
            cachedQuestions = null;
            loadQuestions();
        } catch (error) {
            alert('Error adding question: ' + error.message);
        }
    });
}

// OPTIMIZATION: Use batch writes for bulk upload
const bulkUploadForm = document.getElementById('bulk-upload-form');
if (bulkUploadForm) {
    bulkUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateBulkQuestions()) {
            return;
        }

        const bulkQuestions = JSON.parse(document.getElementById('bulk-questions').value);

        try {
            const batch = writeBatch(db);
            const questionsRef = collection(db, 'questions');
            
            bulkQuestions.forEach((questionData) => {
                const newDocRef = doc(questionsRef);
                batch.set(newDocRef, {
                    question: questionData.question,
                    options: questionData.options,
                    correctAnswer: questionData.correctAnswer,
                    createdAt: new Date(),
                    createdBy: currentUser.uid
                });
            });
            
            await batch.commit();
            
            bulkUploadForm.reset();
            document.getElementById('bulk-questions-error').textContent = '';
            alert('Questions uploaded successfully!');
            
            // Clear cache
            cachedQuestions = null;
            loadQuestions();
        } catch (error) {
            alert('Error uploading questions: ' + error.message);
        }
    });
}

// OPTIMIZATION: Cache questions with timestamp
async function loadQuestions() {
    const now = Date.now();
    
    // Use cached questions if available and fresh
    if (cachedQuestions && (now - cacheTimestamp) < CACHE_DURATION) {
        displayQuestions(cachedQuestions);
        return;
    }

    try {
        const questionsSnapshot = await getDocs(collection(db, 'questions'));
        cachedQuestions = [];
        
        questionsSnapshot.forEach((doc) => {
            cachedQuestions.push({ id: doc.id, ...doc.data() });
        });
        
        cacheTimestamp = now;
        displayQuestions(cachedQuestions);
    } catch (error) {
        console.error('Error loading questions:', error);
    }
}

// OPTIMIZATION: Separate display logic from data loading
function displayQuestions(questions) {
    if (!DOM.questionsContainer) return;
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    questions.forEach((question) => {
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
        fragment.appendChild(questionCard);
    });
    
    DOM.questionsContainer.innerHTML = '';
    DOM.questionsContainer.appendChild(fragment);
}

// OPTIMIZATION: Parallel loading for scores
async function loadStudentScores() {
    if (!DOM.scoresContainer) return;
    
    try {
        const scoresSnapshot = await getDocs(collection(db, 'scores'));
        
        // Collect all user IDs
        const userIds = [...new Set(scoresSnapshot.docs.map(doc => doc.data().userId))];
        
        // Fetch all users in parallel
        const userPromises = userIds.map(uid => getDoc(doc(db, 'users', uid)));
        const userDocs = await Promise.all(userPromises);
        
        // Create user map for quick lookup
        const userMap = {};
        userDocs.forEach(userDoc => {
            if (userDoc.exists()) {
                userMap[userDoc.id] = userDoc.data().name;
            }
        });
        
        // Process scores
        const scores = scoresSnapshot.docs.map(scoreDoc => {
            const score = scoreDoc.data();
            return {
                name: userMap[score.userId] || 'Unknown',
                score: score.score,
                totalQuestions: score.totalQuestions,
                percentage: Math.round((score.score / score.totalQuestions) * 100),
                timestamp: score.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'
            };
        });

        scores.sort((a, b) => b.percentage - a.percentage);

        // Use DocumentFragment
        const fragment = document.createDocumentFragment();
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

        fragment.appendChild(scoresDiv);
        DOM.scoresContainer.innerHTML = '<h4>Student Scores</h4>';
        DOM.scoresContainer.appendChild(fragment);
    } catch (error) {
        console.error('Error loading scores:', error);
        DOM.scoresContainer.innerHTML = '<p>Error loading scores</p>';
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

        const ctx = document.getElementById('score-chart')?.getContext('2d');
        if (!ctx) return;
        
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        
        scoreChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score Distribution',
                    data: data,
                    backgroundColor: isDark ? '#66BB6A' : '#4CAF50',
                    borderColor: isDark ? '#98FB98' : '#2E7D32',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: isDark ? '#E8F5E9' : '#1B5E20' },
                        grid: { color: isDark ? '#4B5E6A' : '#C8E6C9' }
                    },
                    x: {
                        ticks: { color: isDark ? '#E8F5E9' : '#1B5E20' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { labels: { color: isDark ? '#E8F5E9' : '#1B5E20' } }
                }
            }
        });
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

async function loadQuizHistory() {
    if (!DOM.historyContainer) return;
    
    try {
        const scoresSnapshot = await getDocs(query(
            collection(db, 'scores'), 
            where('userId', '==', currentUser.uid),
            orderBy('timestamp', 'desc')
        ));
        
        if (scoresSnapshot.empty) {
            DOM.historyContainer.innerHTML = '<p>No quiz history available.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const historyDiv = document.createElement('div');
        historyDiv.className = 'quiz-history';
        
        scoresSnapshot.forEach(doc => {
            const score = doc.data();
            const percentage = Math.round((score.score / score.totalQuestions) * 100);
            const timestamp = score.timestamp?.toDate?.()?.toLocaleString() || 'Unknown';
            
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <span>Score: ${score.score}/${score.totalQuestions} (${percentage}%)</span>
                <span style="font-size: 0.9em; color: var(--text);">${timestamp}</span>
            `;
            historyDiv.appendChild(historyItem);
        });

        fragment.appendChild(historyDiv);
        DOM.historyContainer.innerHTML = '';
        DOM.historyContainer.appendChild(fragment);
        
        const quizHistory = document.getElementById('quiz-history');
        if (quizHistory) quizHistory.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading quiz history:', error);
        DOM.historyContainer.innerHTML = '<p>Error loading history</p>';
    }
}

// Student functions
window.startQuiz = async function() {
    try {
        // Get admin settings (cached)
        const settings = await getAdminSettings();
        
        if (!settings || !settings.examStart || !settings.examEnd) {
            alert('Quiz schedule not configured. Please contact your administrator.');
            return;
        }

        examSchedule.start = settings.examStart.toDate();
        examSchedule.end = settings.examEnd.toDate();
        const now = new Date();
        
        if (now < examSchedule.start || now > examSchedule.end) {
            alert(`Quiz is not available. Schedule: ${examSchedule.start.toLocaleString()} - ${examSchedule.end.toLocaleString()}`);
            return;
        }

        // Use cached questions if available
        if (!cachedQuestions || cachedQuestions.length === 0) {
            const questionsSnapshot = await getDocs(collection(db, 'questions'));
            currentQuestions = [];
            
            questionsSnapshot.forEach((doc) => {
                currentQuestions.push({ id: doc.id, ...doc.data() });
            });
        } else {
            currentQuestions = [...cachedQuestions];
        }

        if (currentQuestions.length === 0) {
            alert('No questions available. Please contact your teacher.');
            return;
        }

        studentAnswers = {};
        currentQuestionIndex = 0;

        const quizDuration = settings.quizDuration || 30;
        timeRemaining = quizDuration * 60;
        
        startTimer();
        displayQuiz();
    } catch (error) {
        alert('Error loading quiz: ' + error.message);
    }
};

function startTimer() {
    if (DOM.timerContainer) {
        DOM.timerContainer.classList.remove('hidden');
        DOM.timerContainer.classList.remove('timer-critical');
    }
    
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 60 && DOM.timerContainer) {
            DOM.timerContainer.classList.add('timer-critical');
        }

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    if (!DOM.timerDisplay) return;
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    DOM.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// OPTIMIZATION: Use template literals more efficiently
function displayQuiz() {
    if (!DOM.quizQuestions) return;
    
    const question = currentQuestions[currentQuestionIndex];
    
    const optionsHTML = Object.entries(question.options)
        .map(([key, value]) => {
            const selectedClass = studentAnswers[question.id] === key ? 'selected' : '';
            return `
                <div class="option ${selectedClass}" onclick="selectOption('${question.id}', '${key}', this)">
                    <strong>${key}:</strong> ${value}
                </div>
            `;
        })
        .join('');
    
    DOM.quizQuestions.innerHTML = `
        <div class="question-card">
            <h4>Question ${currentQuestionIndex + 1}: ${question.question}</h4>
            <div class="question-options">
                ${optionsHTML}
            </div>
        </div>
    `;

    const progress = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
    if (DOM.progressBarFill) {
        DOM.progressBarFill.style.width = `${progress}%`;
    }

    DOM.quizStart?.classList.add('hidden');
    DOM.quizContainer?.classList.remove('hidden');
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
    DOM.timerContainer?.classList.add('hidden');

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

// OPTIMIZATION: Use DocumentFragment for results
function displayResults(score, total, results) {
    const percentage = Math.round((score / total) * 100);
    
    if (DOM.finalScore) {
        DOM.finalScore.textContent = `${score}/${total} (${percentage}%)`;
    }
    
    if (DOM.resultDetails) {
        const resultsHTML = results.map((result, index) => {
            const borderColor = result.isCorrect ? 'var(--primary)' : 'var(--error)';
            const resultColor = result.isCorrect ? 'var(--primary)' : 'var(--error)';
            const resultText = result.isCorrect ? '✓ Correct' : '✗ Incorrect';
            
            return `
                <div class="question-card" style="border-left-color: ${borderColor}">
                    <p><strong>Q${index + 1}:</strong> ${result.question}</p>
                    <p><strong>Your Answer:</strong> ${result.studentAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${result.correctAnswer}</p>
                    <p><strong>Result:</strong> <span style="color: ${resultColor}">${resultText}</span></p>
                </div>
            `;
        }).join('');
        
        DOM.resultDetails.innerHTML = `
            <div style="text-align: left; margin-top: 20px;">
                <h4>Detailed Results:</h4>
                ${resultsHTML}
            </div>
        `;
    }

    DOM.quizContainer?.classList.add('hidden');
    DOM.quizResults?.classList.remove('hidden');
}

window.printResults = function() {
    window.print();
};

window.retakeQuiz = function() {
    DOM.quizResults?.classList.add('hidden');
    DOM.quizStart?.classList.remove('hidden');
    studentAnswers = {};
    currentQuestions = [];
    currentQuestionIndex = 0;
    DOM.timerContainer?.classList.add('hidden');
    clearInterval(timerInterval);
};
l
