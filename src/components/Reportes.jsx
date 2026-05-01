import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area
} from 'recharts';
import EmptyState from './ui/EmptyState';
import Pagination from './ui/Pagination';
import Panel from './ui/Panel';
import SectionLoader from './ui/SectionLoader';
import StatCard from './ui/StatCard';

const PAGE_SIZE = 7;

function formatCurrency(amount) {
  return `S/. ${Number(amount || 0).toFixed(2)}`;
}

function Reportes({ clientes }) {
  const [reporteData, setReporteData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);

  useEffect(() => {
    cargarReporte();
  }, []);

  const cargarReporte = async () => {
    setCargando(true);
    try {
      const respuesta = await fetch('http://localhost:3001/api/reportes/resumen');
      const datos = await respuesta.json();
      setReporteData(datos);
    } catch (error) {
      console.error('Error al cargar reporte:', error);
    } finally {
      setCargando(false);
    }
  };

  const estadisticasGenerales = {
    totalClientes: clientes.length,
    deudaTotal: clientes.reduce((sum, c) => sum + (c.precio || 0), 0),
    tasaRecaudacion: 0,
    clientesMorosos: 0
  };

  const filas = Array.isArray(reporteData) ? reporteData : [];
  const totalPendientes = filas.reduce((sum, item) => sum + Number(item.pendientes || 0), 0);
  const totalPagados = filas.reduce((sum, item) => sum + Number(item.pagados || 0), 0);
  const totalRegistros = totalPendientes + totalPagados;
  const totalRecaudado = filas.reduce((sum, item) => sum + Number(item.montoRecaudado || 0), 0);

  estadisticasGenerales.tasaRecaudacion = totalRegistros
    ? Math.round((totalPagados / totalRegistros) * 100)
    : 0;
  estadisticasGenerales.clientesMorosos = filas.filter((item) => Number(item.pendientes || 0) > 0).length;

  const chartData = filas
    .slice()
    .sort((a, b) => Number(b.montoRecaudado || 0) - Number(a.montoRecaudado || 0))
    .slice(0, 8)
    .map((item) => ({
      comercio: item.comercio,
      recaudado: Number(item.montoRecaudado || 0),
      pendientes: Number(item.pendientes || 0)
    }));

  const tablaFiltrada = filas.filter((item) =>
    `${item.comercio || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const totalPaginas = Math.max(1, Math.ceil(tablaFiltrada.length / PAGE_SIZE));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const tablaPaginada = tablaFiltrada.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  const accionesNoImplementadas = () => {
    alert('Esta accion estara disponible en una siguiente iteracion.');
  };

  return (
    <div className="view-stack">
      <div className="stats-grid">
        <StatCard label="Clientes" value={estadisticasGenerales.totalClientes} hint="en cartera" />
        <StatCard label="Deuda esperada" value={formatCurrency(estadisticasGenerales.deudaTotal)} hint="mensual" />
        <StatCard label="Recaudacion" value={`${estadisticasGenerales.tasaRecaudacion}%`} hint="avance global" />
        <StatCard label="Con pendiente" value={estadisticasGenerales.clientesMorosos} hint="requieren seguimiento" />
      </div>

      <Panel
        title="Analitica de recaudacion"
        subtitle="Resumen comparativo por cliente"
        actions={<button className="ghost-btn" onClick={cargarReporte}>Actualizar</button>}
      >
        <div className="summary-strip">
          <div className="summary-item">
            <span>Pagos registrados</span>
            <strong>{totalPagados}</strong>
          </div>
          <div className="summary-item">
            <span>Pagos pendientes</span>
            <strong>{totalPendientes}</strong>
          </div>
          <div className="summary-item">
            <span>Monto recaudado</span>
            <strong>{formatCurrency(totalRecaudado)}</strong>
          </div>
        </div>

        {cargando ? (
          <SectionLoader title="Generando visualizaciones" rows={5} />
        ) : chartData.length === 0 ? (
          <EmptyState
            title="Sin datos para graficar"
            description="Aun no existen movimientos de pago para construir analitica."
            action={<button className="ghost-btn" onClick={cargarReporte}>Reintentar carga</button>}
          />
        ) : (
          <div className="charts-grid">
            <div className="chart-card">
              <h4>Top clientes por recaudado</h4>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3345" />
                    <XAxis dataKey="comercio" stroke="#90a0ba" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#90a0ba" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f1622',
                        border: '1px solid #2a3345',
                        borderRadius: '8px',
                        color: '#d5deed'
                      }}
                    />
                    <Bar dataKey="recaudado" fill="#3f77d2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <h4>Tendencia de pendientes</h4>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3345" />
                    <XAxis dataKey="comercio" stroke="#90a0ba" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#90a0ba" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f1622',
                        border: '1px solid #2a3345',
                        borderRadius: '8px',
                        color: '#d5deed'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pendientes"
                      stroke="#1e9ab4"
                      fill="rgba(30, 154, 180, 0.25)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Detalle por cliente"
        subtitle="Filtra y revisa pendientes, pagados y recaudacion"
      >
        <div className="filters-grid single-line">
          <div className="field-group">
            <label htmlFor="buscar-reporte">Buscar cliente</label>
            <input
              id="buscar-reporte"
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Escribe nombre de comercio"
            />
          </div>
        </div>

        {tablaPaginada.length === 0 ? (
          <EmptyState
            title="Sin coincidencias"
            description="No hay filas que coincidan con el filtro aplicado."
            action={
              <button
                className="ghost-btn"
                onClick={() => {
                  setBusqueda('');
                  setPaginaActual(1);
                }}
              >
                Limpiar filtro
              </button>
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pendientes</th>
                    <th>Pagados</th>
                    <th>Recaudado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaPaginada.map((item) => {
                    const pendientes = Number(item.pendientes || 0);
                    return (
                      <tr key={item.comercio}>
                        <td className="cell-primary">{item.comercio}</td>
                        <td>{pendientes}</td>
                        <td>{Number(item.pagados || 0)}</td>
                        <td>{formatCurrency(item.montoRecaudado || 0)}</td>
                        <td>
                          <span className={`status-pill ${pendientes > 0 ? 'factura_enviada' : 'pago_registrado'}`}>
                            {pendientes > 0 ? 'Con pendiente' : 'Al dia'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={paginaSegura}
              totalPages={totalPaginas}
              totalItems={tablaFiltrada.length}
              pageSize={PAGE_SIZE}
              label="clientes"
              onPageChange={(page) => setPaginaActual(page)}
            />
          </>
        )}

        <div className="actions-row">
          <button className="primary-btn" onClick={accionesNoImplementadas}>Exportar Excel</button>
          <button className="ghost-btn" onClick={accionesNoImplementadas}>Imprimir resumen</button>
          <button className="ghost-btn" onClick={accionesNoImplementadas}>Enviar por correo</button>
        </div>
      </Panel>
    </div>
  );
}

export default Reportes;
