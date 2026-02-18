// ============================================================
// QUIZZER REWARD SYSTEM MODULE
// Import and call initRewardSystem() after Firebase is ready
// ============================================================

// ── Badge Definitions ──────────────────────────────────────
export const BADGES = {
    // Performance Badges
    PERFECT:       { id: 'PERFECT',       icon: '🏆', name: 'Perfect Score',      desc: 'Score 100% on a quiz',              color: '#FFD700' },
    HIGH_ACHIEVER: { id: 'HIGH_ACHIEVER', icon: '🌟', name: 'High Achiever',      desc: 'Score 80% or above',                color: '#FFA500' },
    HALF_WAY:      { id: 'HALF_WAY',      icon: '🎯', name: 'Halfway There',      desc: 'Score 50% or above',                color: '#4CAF50' },
    FIRST_TRY:     { id: 'FIRST_TRY',     icon: '🚀', name: 'First Attempt',      desc: 'Complete your first quiz',          color: '#2196F3' },
    COMEBACK:      { id: 'COMEBACK',      icon: '💪', name: 'Comeback Kid',       desc: 'Improve score from last attempt',   color: '#9C27B0' },

    // Streak / Consistency Badges
    THREE_STREAK:  { id: 'THREE_STREAK',  icon: '🔥', name: 'On Fire',            desc: 'Score 70%+ three times in a row',   color: '#FF5722' },
    FIVE_STREAK:   { id: 'FIVE_STREAK',   icon: '⚡', name: 'Lightning',          desc: 'Score 70%+ five times in a row',    color: '#FFEB3B' },
    DEDICATED:     { id: 'DEDICATED',     icon: '📚', name: 'Dedicated',          desc: 'Take 5 quizzes total',              color: '#00BCD4' },
    VETERAN:       { id: 'VETERAN',       icon: '🎓', name: 'Veteran',            desc: 'Take 20 quizzes total',             color: '#673AB7' },

    // Speed Badges (time-based, passed in from quiz logic)
    SPEED_DEMON:   { id: 'SPEED_DEMON',   icon: '⏱️', name: 'Speed Demon',        desc: 'Finish a quiz in under 2 minutes',  color: '#F44336' },

    // Special
    NIGHT_OWL:     { id: 'NIGHT_OWL',     icon: '🦉', name: 'Night Owl',          desc: 'Complete a quiz after 10 PM',       color: '#3F51B5' },
    EARLY_BIRD:    { id: 'EARLY_BIRD',    icon: '🌅', name: 'Early Bird',         desc: 'Complete a quiz before 7 AM',       color: '#FF9800' },
};

// ── Points Table ───────────────────────────────────────────
const POINTS_PER_CORRECT   = 10;   // pts per correct answer
const POINTS_PERFECT_BONUS = 50;   // bonus for 100%
const POINTS_PER_BADGE     = 25;   // pts when earning a badge
const STREAK_MULTIPLIER    = 1.5;  // multiplier applied at streak ≥3

// ── Firestore helpers (injected by initRewardSystem) ───────
let _db, _doc, _getDoc, _setDoc, _addDoc, _collection, _getDocs, _query, _where, _orderBy;

// ── Public API ─────────────────────────────────────────────

/**
 * Call once after Firebase initialises.
 *
 * @param {object} db         Firestore db instance
 * @param {object} firestoreFns  { doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, orderBy }
 */
export function initRewardSystem(db, firestoreFns) {
    _db          = db;
    _doc         = firestoreFns.doc;
    _getDoc      = firestoreFns.getDoc;
    _setDoc      = firestoreFns.setDoc;
    _addDoc      = firestoreFns.addDoc;
    _collection  = firestoreFns.collection;
    _getDocs     = firestoreFns.getDocs;
    _query       = firestoreFns.query;
    _where       = firestoreFns.where;
    _orderBy     = firestoreFns.orderBy;
}

/**
 * Called right after a quiz is submitted.
 *
 * @param {string} userId
 * @param {number} score           correct answers
 * @param {number} total           total questions
 * @param {number} timeTakenSecs   seconds from start to submission
 * @returns {{ pointsEarned, newBadges, newLevel, streakCount }}
 */
export async function processQuizRewards(userId, score, total, timeTakenSecs = 999) {
    const percentage = (score / total) * 100;

    // Load current profile (or create)
    const profile = await _loadProfile(userId);

    // ── 1. History snapshot (for streak / improvement) ──
    const history = await _loadHistory(userId);
    const lastPct  = history.length > 0 ? history[0].percentage : null;

    // ── 2. Calculate streaks ──
    let streak = 0;
    for (const entry of history) {
        if (entry.percentage >= 70) streak++;
        else break;
    }
    if (percentage >= 70) streak++;   // count current attempt

    // ── 3. Points calculation ──
    let pts = score * POINTS_PER_CORRECT;
    if (percentage === 100) pts += POINTS_PERFECT_BONUS;
    if (streak >= 3)        pts  = Math.round(pts * STREAK_MULTIPLIER);

    // ── 4. Badge evaluation ──
    const earned = profile.badges || [];
    const newBadges = [];

    const maybeAward = (badgeId) => {
        if (!earned.includes(badgeId)) {
            earned.push(badgeId);
            newBadges.push(BADGES[badgeId]);
            pts += POINTS_PER_BADGE;
        }
    };

    const totalQuizzes = history.length + 1;
    const hour = new Date().getHours();

    if (percentage === 100)              maybeAward('PERFECT');
    if (percentage >= 80)                maybeAward('HIGH_ACHIEVER');
    if (percentage >= 50)                maybeAward('HALF_WAY');
    if (totalQuizzes === 1)              maybeAward('FIRST_TRY');
    if (lastPct !== null && percentage > lastPct) maybeAward('COMEBACK');
    if (streak >= 3)                     maybeAward('THREE_STREAK');
    if (streak >= 5)                     maybeAward('FIVE_STREAK');
    if (totalQuizzes >= 5)               maybeAward('DEDICATED');
    if (totalQuizzes >= 20)              maybeAward('VETERAN');
    if (timeTakenSecs < 120)             maybeAward('SPEED_DEMON');
    if (hour >= 22 || hour < 4)         maybeAward('NIGHT_OWL');
    if (hour >= 4  && hour < 7)         maybeAward('EARLY_BIRD');

    // ── 5. Update profile ──
    const newPoints = (profile.points || 0) + pts;
    const newLevel  = _calcLevel(newPoints);

    const updatedProfile = {
        ...profile,
        points:  newPoints,
        level:   newLevel,
        badges:  earned,
        streak:  streak,
        lastUpdated: new Date()
    };

    // ── 6. Save to Firestore ──
    await _setDoc(_doc(_db, 'rewards', userId), updatedProfile);

    await _addDoc(_collection(_db, 'rewardHistory'), {
        userId,
        pointsEarned: pts,
        badgesEarned: newBadges.map(b => b.id),
        percentage,
        streak,
        timestamp: new Date()
    });

    return { pointsEarned: pts, newBadges, newLevel, streakCount: streak };
}

/**
 * Fetch a user's reward profile (points, level, badges, streak).
 */
export async function getRewardProfile(userId) {
    return _loadProfile(userId);
}

/**
 * Fetch leaderboard: top N users by points.
 */
export async function getLeaderboard(limitN = 10) {
    // Firestore doesn't support orderBy without index on dynamic fields easily;
    // We fetch all and sort client-side for simplicity.
    const snap = await _getDocs(_collection(_db, 'rewards'));
    const rows = [];
    snap.forEach(d => rows.push({ userId: d.id, ...d.data() }));
    rows.sort((a, b) => (b.points || 0) - (a.points || 0));
    return rows.slice(0, limitN);
}

// ── Internal helpers ───────────────────────────────────────

async function _loadProfile(userId) {
    const snap = await _getDoc(_doc(_db, 'rewards', userId));
    return snap.exists() ? snap.data() : { points: 0, level: 1, badges: [], streak: 0 };
}

async function _loadHistory(userId) {
    try {
        const snap = await _getDocs(
            _query(
                _collection(_db, 'scores'),
                _where('userId', '==', userId),
                _orderBy('timestamp', 'desc')
            )
        );
        return snap.docs.map(d => {
            const s = d.data();
            return { percentage: Math.round((s.score / s.totalQuestions) * 100) };
        });
    } catch { return []; }
}

function _calcLevel(points) {
    // Level thresholds: 1→200→500→1000→2000→5000…
    const thresholds = [0, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) {
        if (points >= thresholds[i]) level = i + 1;
        else break;
    }
    return level;
}
