import React from 'react';
import { motion } from 'framer-motion';

function Panel({
  title,
  subtitle,
  actions,
  className = '',
  children
}) {
  return (
    <motion.section
      className={`panel ${className}`.trim()}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      {(title || subtitle || actions) && (
        <header className="panel-header">
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </motion.section>
  );
}

export default Panel;
