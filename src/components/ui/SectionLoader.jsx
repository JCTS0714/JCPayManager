import React from 'react';

function SectionLoader({ rows = 4, title = 'Cargando datos...' }) {
  return (
    <div className="section-loader" role="status" aria-live="polite">
      <p className="section-loader-title">{title}</p>
      <div className="skeleton-row skeleton-row-heading" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton-row"
          style={{ width: `${92 - index * 5}%` }}
        />
      ))}
    </div>
  );
}

export default SectionLoader;
