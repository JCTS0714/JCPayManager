import React from 'react';

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-content">
        <div className="empty-dot" />
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? <div className="empty-action">{action}</div> : null}
      </div>
    </div>
  );
}

export default EmptyState;
