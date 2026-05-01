import React, { useState } from 'react';

function ClientesList({ clientes, onSeleccionar }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('todos');

  const clientesFiltrados = clientes.filter(cliente => {
    const coincideNombre = cliente.comercio
      .toLowerCase()
      .includes(busqueda.toLowerCase());
    const coincideRubro = filtroRubro === 'todos' || cliente.rubro === filtroRubro;
    return coincideNombre && coincideRubro;
  });

  const rubrosUnicos = [...new Set(clientes.map(c => c.rubro).filter(Boolean))];

  const estadisticas = {
    total: clientes.length,
    deuda: clientes.reduce((sum, c) => sum + (c.precio || 0), 0),
    promedio: clientes.length > 0 ? clientes.reduce((sum, c) => sum + (c.precio || 0), 0) / clientes.length : 0
  };

  return (
    <div className="clientes-container">
      {/* Tarjetas de estadísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total de Clientes</div>
          <div className="stat-value">{estadisticas.total}</div>
          <div className="stat-change">Activos en el sistema</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Deuda Total Esperada</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>S/. {estadisticas.deuda.toFixed(2)}</div>
          <div className="stat-change">Por cobrar mensualmente</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Promedio por Cliente</div>
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>S/. {estadisticas.promedio.toFixed(2)}</div>
          <div className="stat-change">Monto promedio</div>
        </div>
      </div>

      {/* Tarjeta de búsqueda y filtros */}
      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <label>🔍 Buscar cliente</label>
            <input
              type="text"
              placeholder="Escribe el nombre de un cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}>
            <label>🏢 Filtrar por rubro</label>
            <select
              value={filtroRubro}
              onChange={(e) => setFiltroRubro(e.target.value)}
            >
              <option value="todos">Todos los rubros</option>
              {rubrosUnicos.map(rubro => (
                <option key={rubro} value={rubro}>{rubro}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid de clientes */}
      {clientesFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {busqueda || filtroRubro !== 'todos' ? '❌ No se encontraron clientes' : '📭 Sin clientes registrados'}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
            {busqueda || filtroRubro !== 'todos' ? 'Intenta con otros criterios de búsqueda' : 'Importa clientes para comenzar'}
          </p>
        </div>
      ) : (
        <div className="clientes-grid">
          {clientesFiltrados.map(cliente => (
            <div
              key={cliente.id}
              className="cliente-card"
              onClick={() => onSeleccionar(cliente)}
            >
              <div className="cliente-nombre">
                {cliente.comercio}
              </div>
              
              <div className="cliente-info">
                <div className="cliente-info-item">
                  <span className="cliente-info-item-icon">👤</span>
                  <span>{cliente.contacto || 'N/A'}</span>
                </div>
                <div className="cliente-info-item">
                  <span className="cliente-info-item-icon">📱</span>
                  <span>{cliente.celular || 'N/A'}</span>
                </div>
                <div className="cliente-info-item">
                  <span className="cliente-info-item-icon">🏙️</span>
                  <span>{cliente.ciudad || 'N/A'}</span>
                </div>
                <div className="cliente-info-item">
                  <span className="cliente-info-item-icon">💼</span>
                  <span>{cliente.rubro || 'N/A'}</span>
                </div>
              </div>

              <div className="cliente-badge">
                💰 S/. {(cliente.precio || 0).toFixed(2)}
              </div>

              <div className="cliente-card-footer">
                <div className="cliente-ruc">RUC: {cliente.ruc || 'N/A'}</div>
                <button className="cliente-card-btn">
                  Ver más →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientesList;
