import React from 'react'
import styles from './StatCard.module.css'

export default function StatCard({ icon, label, value, color = 'primary', trend }) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        {trend && <p className={styles.trend}>{trend}</p>}
      </div>
    </div>
  )
}
