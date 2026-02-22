// Add this to the global variables section (after line 33)

// Quiz Review Mode variables
let reviewMode = false;
let reviewQuestionIndex = 0;
let lastQuizResults = null;

// Add these DOM elements to the DOM object in initializeDOM function
DOM.quizReview = null;
DOM.reviewContainer = null;
DOM.reviewNavigation = null;

// Update the initializeDOM function to include review elements
function initializeDOMWithReview() {
    // ... existing DOM initialization ...
    DOM.quizReview = document.getElementById('quiz-review');
    DOM.reviewContainer = document.getElementById('review-container');
    DOM.reviewNavigation = document.getElementById('review-navigation');
}

// Modified submitQuiz function to save results for review
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
            questionId: question.id,
            options: question.options,
            studentAnswer: studentAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            explanation: question.explanation || null // Optional explanation field
        });
    });

    // Save results for review mode
    lastQuizResults = {
        score: score,
        total: currentQuestions.length,
        results: results,
        timestamp: new Date()
    };

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

// Enhanced displayResults with Review Mode button
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

// NEW FEATURE: Start Review Mode
window.startReviewMode = function() {
    if (!lastQuizResults) {
        alert('No quiz results available to review.');
        return;
    }

    reviewMode = true;
    reviewQuestionIndex = 0;
    
    DOM.quizResults?.classList.add('hidden');
    DOM.quizReview?.classList.remove('hidden');
    
    displayReviewQuestion();
};

// NEW FEATURE: Display Review Question
function displayReviewQuestion() {
    if (!lastQuizResults || !DOM.reviewContainer) return;
    
    const result = lastQuizResults.results[reviewQuestionIndex];
    const totalQuestions = lastQuizResults.results.length;
    const questionNumber = reviewQuestionIndex + 1;
    
    // Determine status styling
    const isCorrect = result.isCorrect;
    const statusClass = isCorrect ? 'review-correct' : 'review-incorrect';
    const statusIcon = isCorrect ? '✓' : '✗';
    const statusText = isCorrect ? 'Correct' : 'Incorrect';
    
    // Build options HTML with visual indicators
    const optionsHTML = Object.entries(result.options).map(([key, value]) => {
        const isStudentAnswer = result.studentAnswer === key;
        const isCorrectAnswer = result.correctAnswer === key;
        
        let optionClass = 'review-option';
        let optionIcon = '';
        
        if (isCorrectAnswer) {
            optionClass += ' review-option-correct';
            optionIcon = '<span class="option-icon">✓</span>';
        }
        
        if (isStudentAnswer && !isCorrectAnswer) {
            optionClass += ' review-option-wrong';
            optionIcon = '<span class="option-icon">✗</span>';
        }
        
        if (isStudentAnswer) {
            optionClass += ' review-option-selected';
        }
        
        return `
            <div class="${optionClass}">
                <strong>${key}:</strong> ${value} ${optionIcon}
            </div>
        `;
    }).join('');
    
    // Build explanation section
    const explanationHTML = result.explanation ? `
        <div class="review-explanation">
            <h5>📚 Explanation:</h5>
            <p>${result.explanation}</p>
        </div>
    ` : '';
    
    // Build review content
    DOM.reviewContainer.innerHTML = `
        <div class="review-header">
            <span class="review-status ${statusClass}">
                ${statusIcon} ${statusText}
            </span>
            <span class="review-progress">
                Question ${questionNumber} of ${totalQuestions}
            </span>
        </div>
        
        <div class="review-question-card">
            <h4>Question ${questionNumber}</h4>
            <p class="review-question-text">${result.question}</p>
            
            <div class="review-options">
                ${optionsHTML}
            </div>
            
            <div class="review-answer-section">
                <div class="review-your-answer">
                    <strong>Your Answer:</strong> 
                    <span class="${isCorrect ? 'text-success' : 'text-error'}">
                        ${result.studentAnswer}
                    </span>
                </div>
                <div class="review-correct-answer">
                    <strong>Correct Answer:</strong> 
                    <span class="text-success">${result.correctAnswer}</span>
                </div>
            </div>
            
            ${explanationHTML}
        </div>
    `;
    
    updateReviewNavigation();
}

// NEW FEATURE: Update Review Navigation
function updateReviewNavigation() {
    if (!DOM.reviewNavigation) return;
    
    const totalQuestions = lastQuizResults.results.length;
    const isFirstQuestion = reviewQuestionIndex === 0;
    const isLastQuestion = reviewQuestionIndex === totalQuestions - 1;
    
    DOM.reviewNavigation.innerHTML = `
        <div class="review-nav-buttons">
            <button 
                onclick="previousReviewQuestion()" 
                class="btn btn-secondary" 
                ${isFirstQuestion ? 'disabled' : ''}>
                ← Previous
            </button>
            
            <span class="review-question-counter">
                ${reviewQuestionIndex + 1} / ${totalQuestions}
            </span>
            
            ${isLastQuestion ? `
                <button onclick="exitReviewMode()" class="btn btn-success">
                    Finish Review
                </button>
            ` : `
                <button onclick="nextReviewQuestion()" class="btn btn-primary">
                    Next →
                </button>
            `}
        </div>
        
        <div class="review-quick-nav">
            ${generateQuickNavigation()}
        </div>
    `;
}

// NEW FEATURE: Generate Quick Navigation Dots
function generateQuickNavigation() {
    if (!lastQuizResults) return '';
    
    return lastQuizResults.results.map((result, index) => {
        const isActive = index === reviewQuestionIndex;
        const isCorrect = result.isCorrect;
        const dotClass = `quick-nav-dot ${isActive ? 'active' : ''} ${isCorrect ? 'correct' : 'incorrect'}`;
        
        return `
            <button 
                class="${dotClass}" 
                onclick="jumpToReviewQuestion(${index})"
                aria-label="Question ${index + 1} - ${isCorrect ? 'Correct' : 'Incorrect'}"
                title="Question ${index + 1}">
            </button>
        `;
    }).join('');
}

// NEW FEATURE: Navigation Functions
window.nextReviewQuestion = function() {
    if (reviewQuestionIndex < lastQuizResults.results.length - 1) {
        reviewQuestionIndex++;
        displayReviewQuestion();
    }
};

window.previousReviewQuestion = function() {
    if (reviewQuestionIndex > 0) {
        reviewQuestionIndex--;
        displayReviewQuestion();
    }
};

window.jumpToReviewQuestion = function(index) {
    if (index >= 0 && index < lastQuizResults.results.length) {
        reviewQuestionIndex = index;
        displayReviewQuestion();
    }
};

window.exitReviewMode = function() {
    reviewMode = false;
    reviewQuestionIndex = 0;
    
    DOM.quizReview?.classList.add('hidden');
    DOM.quizResults?.classList.remove('hidden');
};

// NEW FEATURE: Keyboard Navigation for Review Mode
document.addEventListener('keydown', function(e) {
    if (!reviewMode || !DOM.quizReview?.classList.contains('hidden') === false) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            if (reviewQuestionIndex > 0) {
                previousReviewQuestion();
            }
            break;
        case 'ArrowRight':
            if (reviewQuestionIndex < lastQuizResults.results.length - 1) {
                nextReviewQuestion();
            }
            break;
        case 'Escape':
            exitReviewMode();
            break;
    }
});

// NEW FEATURE: Filter Review Questions
window.filterReviewQuestions = function(filterType) {
    if (!lastQuizResults) return;
    
    let filteredIndices = [];
    
    switch(filterType) {
        case 'incorrect':
            filteredIndices = lastQuizResults.results
                .map((result, index) => !result.isCorrect ? index : -1)
                .filter(index => index !== -1);
            break;
        case 'correct':
            filteredIndices = lastQuizResults.results
                .map((result, index) => result.isCorrect ? index : -1)
                .filter(index => index !== -1);
            break;
        case 'all':
        default:
            filteredIndices = lastQuizResults.results.map((_, index) => index);
            break;
    }
    
    if (filteredIndices.length === 0) {
        alert('No questions match this filter.');
        return;
    }
    
    // Jump to first filtered question
    reviewQuestionIndex = filteredIndices[0];
    displayReviewQuestion();
};

// Export for use in HTML
window.startReviewMode = startReviewMode;
window.exitReviewMode = exitReviewMode;
window.nextReviewQuestion = nextReviewQuestion;
window.previousReviewQuestion = previousReviewQuestion;
window.jumpToReviewQuestion = jumpToReviewQuestion;
window.filterReviewQuestions = filterReviewQuestions;
