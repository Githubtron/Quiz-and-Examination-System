import React from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const features = [
  { icon: '📝', title: 'Multiple Question Types', desc: 'MCQ, Assertion-Reason, and True/False questions for comprehensive assessment.' },
  { icon: '⏱️', title: 'Timed Exams', desc: 'Auto-submit when time runs out. Real-time countdown keeps students on track.' },
  { icon: '⚡', title: 'Instant Results', desc: 'Automated scoring with detailed per-question feedback immediately after submission.' },
  { icon: '📊', title: 'Rich Analytics', desc: 'Bar charts, pie charts, and progress graphs for deep performance insights.' },
  { icon: '🔒', title: 'Exam Security', desc: 'Randomized questions, tab-switch detection, and copy-paste prevention.' },
  { icon: '🧠', title: 'Adaptive Exams', desc: 'Dynamic difficulty adjustment based on student performance in real time.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>Online Examination Platform</div>
          <h1 className={styles.heroTitle}>
            Smarter Exams.<br />Better Outcomes.
          </h1>
          <p className={styles.heroSub}>
            A complete quiz and examination management system for administrators, professors, and students.
            Create, manage, and attempt exams with instant automated results.
          </p>
          <div className={styles.heroCta}>
            <button className={styles.btnPrimary} onClick={() => navigate('/login')}>Get Started</button>
            <button className={styles.btnOutline} onClick={() => navigate('/register')}>Create Account</button>
          </div>
          <p className={styles.demoHint}>
            Demo: <strong>admin / admin123</strong> · <strong>professor / prof123</strong> · <strong>student / student123</strong>
          </p>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.card1}>
            <div className={styles.cardHeader}>📋 JavaScript Fundamentals</div>
            <div className={styles.cardBody}>
              <div className={styles.qItem}>Q1. Which keyword declares a block-scoped variable?</div>
              <div className={styles.optionRow}><span className={styles.optionActive}>B. let</span></div>
              <div className={styles.timer}>⏱ 28:45 remaining</div>
            </div>
          </div>
          <div className={styles.card2}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreNum}>85%</span>
              <span className={styles.scoreLabel}>Score</span>
            </div>
            <div className={styles.scoreDetail}>32 / 40 marks</div>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything you need</h2>
        <p className={styles.sectionSub}>Built for educators and learners alike</p>
        <div className={styles.featureGrid}>
          {features.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.roles}>
        <div className={styles.roleCard}>
          <div className={styles.roleIcon}>👨‍💼</div>
          <h3>Administrator</h3>
          <p>Manage users, view system-wide analytics, and oversee all exam activity.</p>
        </div>
        <div className={styles.roleCard}>
          <div className={styles.roleIcon}>👨‍🏫</div>
          <h3>Professor</h3>
          <p>Create question banks, design exams, schedule windows, and export results.</p>
        </div>
        <div className={styles.roleCard}>
          <div className={styles.roleIcon}>👨‍🎓</div>
          <h3>Student</h3>
          <p>Attempt timed exams, get instant feedback, and track your progress over time.</p>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 QuizMaster · Online Examination Management System</p>
      </footer>
    </div>
  )
}
