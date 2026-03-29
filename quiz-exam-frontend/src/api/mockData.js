// Mock data store — simulates backend responses
export const mockExams = [
  {
    id: 1, title: 'JavaScript Fundamentals', description: 'Test your JS knowledge',
    timeLimitMinutes: 30, marksPerQuestion: 4, negativeMarking: 1,
    status: 'ACTIVE', startDatetime: '2026-01-01T00:00', endDatetime: '2026-12-31T23:59',
    createdBy: 2, totalQuestions: 10
  },
  {
    id: 2, title: 'Data Structures & Algorithms', description: 'DSA concepts and problem solving',
    timeLimitMinutes: 60, marksPerQuestion: 5, negativeMarking: 0,
    status: 'ACTIVE', startDatetime: '2026-01-01T00:00', endDatetime: '2026-12-31T23:59',
    createdBy: 2, totalQuestions: 15
  },
  {
    id: 3, title: 'Database Management', description: 'SQL and NoSQL concepts',
    timeLimitMinutes: 45, marksPerQuestion: 3, negativeMarking: 0.5,
    status: 'DRAFT', startDatetime: null, endDatetime: null,
    createdBy: 2, totalQuestions: 12
  },
]

export const mockQuestions = [
  // JavaScript — EASY
  {
    id: 1, type: 'MCQ', text: 'Which keyword declares a block-scoped variable in JavaScript?',
    difficulty: 'EASY', subject: 'JavaScript', topic: 'Variables',
    options: ['var', 'let', 'const', 'def'], correctIndex: 1
  },
  {
    id: 2, type: 'TF', text: 'JavaScript is a statically typed language.',
    difficulty: 'EASY', subject: 'JavaScript', topic: 'Basics', correctAnswer: false
  },
  {
    id: 6, type: 'MCQ', text: 'Which method adds an element to the end of an array?',
    difficulty: 'EASY', subject: 'JavaScript', topic: 'Arrays',
    options: ['push()', 'pop()', 'shift()', 'unshift()'], correctIndex: 0
  },
  // JavaScript — MEDIUM
  {
    id: 3, type: 'AR',
    text: 'Assertion: Arrays in JS are objects. Reason: typeof [] returns "object".',
    difficulty: 'MEDIUM', subject: 'JavaScript', topic: 'Types',
    assertion: 'Arrays in JS are objects.',
    reason: 'typeof [] returns "object".',
    correctChoice: 0
  },
  {
    id: 7, type: 'MCQ', text: 'What does the "==" operator do differently from "===" in JavaScript?',
    difficulty: 'MEDIUM', subject: 'JavaScript', topic: 'Operators',
    options: ['Checks value only (with type coercion)', 'Checks value and type', 'Checks reference', 'None of the above'], correctIndex: 0
  },
  // JavaScript — HARD
  {
    id: 8, type: 'MCQ', text: 'What is the output of: console.log(typeof null)?',
    difficulty: 'HARD', subject: 'JavaScript', topic: 'Types',
    options: ['"null"', '"undefined"', '"object"', '"boolean"'], correctIndex: 2
  },
  {
    id: 9, type: 'AR',
    text: 'Assertion: Closures can cause memory leaks. Reason: They keep references to outer scope variables alive.',
    difficulty: 'HARD', subject: 'JavaScript', topic: 'Closures',
    assertion: 'Closures can cause memory leaks.',
    reason: 'They keep references to outer scope variables alive.',
    correctChoice: 0
  },
  // DSA — EASY
  {
    id: 5, type: 'MCQ', text: 'Which data structure uses LIFO order?',
    difficulty: 'EASY', subject: 'DSA', topic: 'Data Structures',
    options: ['Queue', 'Stack', 'Heap', 'Tree'], correctIndex: 1
  },
  {
    id: 10, type: 'TF', text: 'A queue follows First-In-First-Out (FIFO) order.',
    difficulty: 'EASY', subject: 'DSA', topic: 'Data Structures', correctAnswer: true
  },
  // DSA — MEDIUM
  {
    id: 4, type: 'MCQ', text: 'What is the time complexity of binary search?',
    difficulty: 'MEDIUM', subject: 'DSA', topic: 'Searching',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctIndex: 1
  },
  {
    id: 11, type: 'MCQ', text: 'Which sorting algorithm has the best average-case time complexity?',
    difficulty: 'MEDIUM', subject: 'DSA', topic: 'Sorting',
    options: ['Bubble Sort', 'Insertion Sort', 'Merge Sort', 'Selection Sort'], correctIndex: 2
  },
  // DSA — HARD
  {
    id: 12, type: 'MCQ', text: 'What is the space complexity of merge sort?',
    difficulty: 'HARD', subject: 'DSA', topic: 'Sorting',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correctIndex: 2
  },
  {
    id: 13, type: 'AR',
    text: 'Assertion: Dijkstra\'s algorithm works with negative weights. Reason: It uses a greedy approach.',
    difficulty: 'HARD', subject: 'DSA', topic: 'Graphs',
    assertion: "Dijkstra's algorithm works with negative weights.",
    reason: 'It uses a greedy approach.',
    correctChoice: 3
  },
  // Database — EASY
  {
    id: 14, type: 'TF', text: 'SQL stands for Structured Query Language.',
    difficulty: 'EASY', subject: 'Database', topic: 'Basics', correctAnswer: true
  },
  {
    id: 15, type: 'MCQ', text: 'Which SQL command retrieves data from a table?',
    difficulty: 'EASY', subject: 'Database', topic: 'SQL',
    options: ['INSERT', 'UPDATE', 'SELECT', 'DELETE'], correctIndex: 2
  },
  // Database — MEDIUM
  {
    id: 16, type: 'MCQ', text: 'Which normal form eliminates transitive dependencies?',
    difficulty: 'MEDIUM', subject: 'Database', topic: 'Normalization',
    options: ['1NF', '2NF', '3NF', 'BCNF'], correctIndex: 2
  },
  // Database — HARD
  {
    id: 17, type: 'AR',
    text: 'Assertion: ACID properties ensure reliable transactions. Reason: Atomicity means all-or-nothing execution.',
    difficulty: 'HARD', subject: 'Database', topic: 'Transactions',
    assertion: 'ACID properties ensure reliable transactions.',
    reason: 'Atomicity means all-or-nothing execution.',
    correctChoice: 0
  },
]

// Mutable results store — shared across components (simulates a backend store)
export const mockResults = [
  { id: 1, examId: 1, examTitle: 'JavaScript Fundamentals', studentId: 3, studentName: 'student', totalScore: 32, maxScore: 40, percentage: 80, passed: true, submittedAt: '2026-03-10T14:30', breakdown: [] },
  { id: 2, examId: 2, examTitle: 'Data Structures & Algorithms', studentId: 3, studentName: 'student', totalScore: 45, maxScore: 75, percentage: 60, passed: true, submittedAt: '2026-03-10T15:00', breakdown: [] },
]

// Call this after a student submits an exam — persists to the shared store
export function saveResult({ examId, examTitle, studentId, studentName, score, total, breakdown }) {
  const percentage = Math.round((score / total) * 100)
  const result = {
    id: Date.now(),
    examId,
    examTitle,
    studentId,
    studentName,
    totalScore: score,
    maxScore: total,
    percentage,
    passed: percentage >= 50,
    submittedAt: new Date().toISOString(),
    breakdown,
  }
  mockResults.push(result)
  return result
}

export const mockNotifications = [
  { id: 1, message: 'JavaScript Fundamentals exam is now available!', examId: 1, createdAt: '2026-03-10T08:00', isRead: false },
  { id: 2, message: 'Your results for DSA exam have been published.', examId: 2, createdAt: '2026-03-09T16:00', isRead: true },
]
