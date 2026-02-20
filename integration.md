# QUIZZER Reward System — Integration Guide

## Files Delivered
| File | Purpose |
|------|---------|
| `rewards.js`    | Core logic: points, badges, Firestore writes |
| `rewards-ui.html` | Full UI panel (copy CSS + HTML + JS into your app) |

---

## Step 1 — Add Firestore collections

No manual setup needed. The module auto-creates:
- `rewards/{userId}` — profile (points, level, badges[], streak)
- `rewardHistory/` — log of every quiz reward event

---

## Step 2 — Import `rewards.js` in your main script

```js
import {
    initRewardSystem,
    processQuizRewards
} from './rewards.js';
```

---

## Step 3 — Initialise after Firebase is ready

Add this right after your `initializeApp` block:

```js
initRewardSystem(db, {
    doc, getDoc, setDoc, addDoc,
    collection, getDocs, query, where, orderBy
});
```

---

## Step 4 — Hook into `submitQuiz()`

Track quiz start time, then call `processQuizRewards` at submission:

```js
// Add near top of your globals:
let quizStartTime = null;

// In startQuiz(), add:
quizStartTime = Date.now();

// In submitQuiz(), after calculating score, BEFORE saving to Firestore:
const timeTakenSecs = Math.round((Date.now() - quizStartTime) / 1000);

const { pointsEarned, newBadges, newLevel, streakCount }
    = await processQuizRewards(
          currentUser.uid,
          score,
          currentQuestions.length,
          timeTakenSecs
      );

// Show animated toasts & floating XP:
showRewardFeedback(pointsEarned, newBadges);

// Refresh the reward panel:
const userData = cachedUserData;
loadRewardPanel(currentUser.uid, userData.name);
```

---

## Step 5 — Add the UI panel into your student panel HTML

```html
<!-- Inside your student-panel div, add a Rewards tab: -->
<button class="tab-button" onclick="switchTab('rewards')">🏅 Rewards</button>

<!-- And the tab content: -->
<div id="rewards-tab" class="tab-content">
    <!-- paste the entire .reward-panel div from rewards-ui.html here -->
</div>
```

---

## Step 6 — Call `loadRewardPanel` on login

In your `onAuthStateChanged` handler, inside the student branch:

```js
} else {
    // existing code...
    loadQuizHistory();

    // ADD:
    loadRewardPanel(user.uid, userData.name);
}
```

---

## Badges at a Glance

| Badge | Trigger |
|-------|---------|
| 🏆 Perfect Score    | 100% on any quiz |
| 🌟 High Achiever    | ≥ 80% |
| 🎯 Halfway There    | ≥ 50% |
| 🚀 First Attempt    | 1st quiz completed |
| 💪 Comeback Kid     | Score higher than last attempt |
| 🔥 On Fire          | 70%+ three quizzes in a row |
| ⚡ Lightning         | 70%+ five quizzes in a row |
| 📚 Dedicated        | 5 total quizzes taken |
| 🎓 Veteran          | 20 total quizzes taken |
| ⏱️ Speed Demon       | Finished in under 2 minutes |
| 🦉 Night Owl        | Submitted after 10 PM |
| 🌅 Early Bird       | Submitted before 7 AM |

## Points System

| Action | Points |
|--------|--------|
| Per correct answer | +10 pts |
| Perfect score bonus | +50 pts |
| Per badge earned | +25 pts |
| Streak ≥ 3 multiplier | ×1.5 on all pts |

## Levels

| Level | XP Required |
|-------|------------|
| 1 | 0 |
| 2 | 200 |
| 3 | 500 |
| 4 | 1,000 |
| 5 | 2,000 |
| 6 | 5,000 |
| 7 | 10,000 |
| 8 | 20,000 |
| 9 | 50,000 |
