import React from 'react';

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  label = 'elementos'
}) {
  if (totalPages <= 1) {
    return null;
  }

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="pagination-wrap">
      <p className="pagination-info">
        Mostrando {start}-{end} de {totalItems} {label}
      </p>
      <div className="pagination-controls">
        <button
          className="ghost-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span className="pagination-page">{currentPage} / {totalPages}</span>
        <button
          className="ghost-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default Pagination;
