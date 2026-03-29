import React from 'react'
import styles from './Badge.module.css'

export default function Badge({ children, variant = 'default' }) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
}
