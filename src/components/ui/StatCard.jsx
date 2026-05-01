import React from 'react';
import { motion } from 'framer-motion';

function StatCard({ label, value, hint, trend, trendKind = 'neutral' }) {
  return (
    <motion.article
      className="stat-card"
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {hint && <p className="stat-hint">{hint}</p>}
      {trend && <p className={`stat-trend ${trendKind}`}>{trend}</p>}
    </motion.article>
  );
}

export default StatCard;
