import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from './ui/EmptyState';
import Pagination from './ui/Pagination';
import Panel from './ui/Panel';
import SectionLoader from './ui/SectionLoader';
import StatCard from './ui/StatCard';

const PAGE_SIZE = 6;

function formatCurrency(amount) {
  return `S/. ${Number(amount || 0).toFixed(2)}`;
}

function getAnio(pago) {
  return pago.anio || pago['año'] || '-';
}

function ClienteDetalle({ cliente, onVolver, onActualizar }) {
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busquedaMes, setBusquedaMes] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [mensaje, setMensaje] = useState(null);
  const [estadoDrafts, setEstadoDrafts] = useState({});
  const [actualizandoPagoId, setActualizandoPagoId] = useState(null);
  const [pagoFacturaId, setPagoFacturaId] = useState('');
  const [archivoFactura, setArchivoFactura] = useState(null);
  const [preparandoFactura, setPreparandoFactura] = useState(false);
  const [facturaPreparada, setFacturaPreparada] = useState(null);

  useEffect(() => {
    cargarPagos();
  }, [cliente.id]);

  const cargarPagos = async () => {
    setCargando(true);
    try {
      const respuesta = await fetch(`http://localhost:3001/api/clientes/${cliente.id}`);
      const datos = await respuesta.json();
      setPagos(datos.pagos || []);
    } catch (error) {
      console.error('Error al cargar pagos:', error);
      setMensaje({ type: 'error', text: 'No fue posible cargar el historial de pagos.' });
    } finally {
      setCargando(false);
    }
  };

  const pagosPendientes = useMemo(
    () => pagos.filter((p) => p.estado === 'factura_enviada' || p.estado === 'factura_pendiente'),
    [pagos]
  );
  const pagosEnviados = useMemo(
    () => pagos.filter((p) => p.estado === 'factura_enviada'),
    [pagos]
  );
  const pagosPendienteEnvio = useMemo(
    () => pagos.filter((p) => p.estado === 'factura_pendiente'),
    [pagos]
  );
  const pagosPagados = useMemo(
    () => pagos.filter((p) => p.estado === 'pago_registrado'),
    [pagos]
  );

  const pagosFiltrados = useMemo(() => {
    const term = busquedaMes.trim().toLowerCase();
    return pagos.filter((pago) => {
      const estadoOk = filtroEstado === 'todos' || pago.estado === filtroEstado;
      const mesOk = !term || `${pago.mes || ''}`.toLowerCase().includes(term);
      return estadoOk && mesOk;
    });
  }, [pagos, filtroEstado, busquedaMes]);

  const totalPaginas = Math.max(1, Math.ceil(pagosFiltrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const pagosPaginados = useMemo(() => {
    const start = (paginaSegura - 1) * PAGE_SIZE;
    return pagosFiltrados.slice(start, start + PAGE_SIZE);
  }, [pagosFiltrados, paginaSegura]);

  const manejarSubidaComprobante = async () => {
    if (!archivo || !pagoSeleccionado) {
      setMensaje({ type: 'error', text: 'Debes seleccionar un pago pendiente y un archivo.' });
      return;
    }

    setSubiendo(true);
    setMensaje(null);

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('pagoId', pagoSeleccionado);

    try {
      const respuesta = await fetch('http://localhost:3001/api/comprobantes', {
        method: 'POST',
        body: formData
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo registrar el comprobante.');
      }

      setMensaje({ type: 'success', text: 'Comprobante registrado correctamente.' });
      setArchivo(null);
      setPagoSeleccionado('');
      await cargarPagos();
      onActualizar();
    } catch (error) {
      console.error(error);
      setMensaje({ type: 'error', text: 'Error al subir el comprobante.' });
    } finally {
      setSubiendo(false);
    }
  };

  const pagosParaFacturar = useMemo(
    () => pagos.filter((p) => p.estado !== 'pago_registrado'),
    [pagos]
  );

  const obtenerEstadoDraft = (pago) => estadoDrafts[pago.id] || pago.estado;

  const manejarCambioEstado = (pagoId, estado) => {
    setEstadoDrafts((prev) => ({ ...prev, [pagoId]: estado }));
  };

  const guardarEstadoPago = async (pago) => {
    const nuevoEstado = obtenerEstadoDraft(pago);
    if (nuevoEstado === pago.estado) {
      return;
    }

    setActualizandoPagoId(pago.id);
    setMensaje(null);
    try {
      const respuesta = await fetch(`http://localhost:3001/api/pagos/${pago.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          estado: nuevoEstado,
          notas: pago.notas || ''
        })
      });

      if (!respuesta.ok) {
        throw new Error('No se pudo actualizar el estado del pago.');
      }

      setMensaje({ type: 'success', text: 'Estado de pago actualizado.' });
      await cargarPagos();
      onActualizar();
    } catch (error) {
      console.error(error);
      setMensaje({ type: 'error', text: 'Error al actualizar estado de pago.' });
    } finally {
      setActualizandoPagoId(null);
    }
  };

  const prepararEnvioFactura = async () => {
    if (!pagoFacturaId || !archivoFactura) {
      setMensaje({ type: 'error', text: 'Selecciona un periodo y el archivo de factura.' });
      return;
    }

    setPreparandoFactura(true);
    setMensaje(null);

    const formData = new FormData();
    formData.append('pagoId', pagoFacturaId);
    formData.append('archivo', archivoFactura);

    try {
      const respuesta = await fetch('http://localhost:3001/api/facturas/preparar', {
        method: 'POST',
        body: formData
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo preparar la factura.');
      }

      setFacturaPreparada(datos);
      setMensaje({ type: 'success', text: 'Factura preparada. Ya puedes abrir WhatsApp Web y enviar manualmente.' });
      setArchivoFactura(null);
      await cargarPagos();
    } catch (error) {
      console.error(error);
      setMensaje({ type: 'error', text: error.message || 'Error preparando factura.' });
    } finally {
      setPreparandoFactura(false);
    }
  };

  const copiarMensajeFactura = async () => {
    if (!facturaPreparada?.mensaje) {
      return;
    }
    try {
      await navigator.clipboard.writeText(facturaPreparada.mensaje);
      setMensaje({ type: 'success', text: 'Mensaje copiado al portapapeles.' });
    } catch (error) {
      setMensaje({ type: 'error', text: 'No se pudo copiar el mensaje.' });
    }
  };

  const abrirWhatsApp = () => {
    if (!facturaPreparada?.whatsappUrl) {
      setMensaje({ type: 'error', text: 'El cliente no tiene celular valido para WhatsApp.' });
      return;
    }

    window.open(facturaPreparada.whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const marcarFacturaEnviada = async () => {
    if (!facturaPreparada?.pagoId) {
      return;
    }

    try {
      const respuesta = await fetch(`http://localhost:3001/api/facturas/${facturaPreparada.pagoId}/marcar-enviada`, {
        method: 'POST'
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo marcar como enviada.');
      }

      setMensaje({ type: 'success', text: 'Factura marcada como enviada.' });
      await cargarPagos();
      onActualizar();
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error actualizando envio.' });
    }
  };

  return (
    <div className="view-stack">
      <Panel
        title={cliente.comercio || 'Cliente sin nombre'}
        subtitle="Ficha operativa y seguimiento de pagos"
        actions={<button className="ghost-btn" onClick={onVolver}>Volver al listado</button>}
      >
        <div className="client-meta-grid">
          <div>
            <span>Contacto</span>
            <strong>{cliente.contacto || 'No definido'}</strong>
          </div>
          <div>
            <span>Celular</span>
            <strong>{cliente.celular || 'No definido'}</strong>
          </div>
          <div>
            <span>Ciudad</span>
            <strong>{cliente.ciudad || 'No definido'}</strong>
          </div>
          <div>
            <span>Monto mensual</span>
            <strong>{formatCurrency(cliente.precio)}</strong>
          </div>
          <div>
            <span>RUC</span>
            <strong>{cliente.ruc || 'No definido'}</strong>
          </div>
          <div>
            <span>Rubro</span>
            <strong>{cliente.rubro || 'General'}</strong>
          </div>
        </div>
      </Panel>

      <div className="stats-grid">
        <StatCard label="Pendientes" value={pagosPendientes.length} hint="en proceso" />
        <StatCard label="Factura enviada" value={pagosEnviados.length} hint="esperando pago" />
        <StatCard label="Factura pendiente" value={pagosPendienteEnvio.length} hint="falta enviar" />
        <StatCard label="Pagados" value={pagosPagados.length} hint="con comprobante" />
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total recaudado"
          value={formatCurrency(pagosPagados.length * Number(cliente.precio || 0))}
          hint="historico"
        />
        <StatCard
          label="Cobertura"
          value={`${pagos.length ? Math.round((pagosPagados.length / pagos.length) * 100) : 0}%`}
          hint="pagos completados"
        />
      </div>

      <Panel title="Registrar comprobante" subtitle="Asocia evidencia a una factura pendiente">
        <div className="upload-grid">
          <div className="field-group">
            <label htmlFor="pago-pendiente">Pago pendiente</label>
            <select
              id="pago-pendiente"
              value={pagoSeleccionado}
              onChange={(e) => setPagoSeleccionado(e.target.value)}
            >
              <option value="">Selecciona un registro</option>
              {pagosPendientes.map((pago) => (
                <option key={pago.id} value={pago.id}>
                  {pago.mes} {getAnio(pago)} | {formatCurrency(cliente.precio)}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="archivo-comprobante">Archivo</label>
            <input
              id="archivo-comprobante"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {archivo && <p className="helper-note">Archivo listo: {archivo.name}</p>}

        {mensaje && <p className={`feedback ${mensaje.type}`}>{mensaje.text}</p>}

        <button
          className="primary-btn"
          onClick={manejarSubidaComprobante}
          disabled={!archivo || !pagoSeleccionado || subiendo}
        >
          {subiendo ? 'Guardando comprobante...' : 'Registrar comprobante'}
        </button>
      </Panel>

      <Panel title="Historial de pagos" subtitle="Consulta, filtra y valida estado de cada periodo">
        <div className="filters-grid">
          <div className="field-group">
            <label htmlFor="buscar-mes">Mes</label>
            <input
              id="buscar-mes"
              type="text"
              value={busquedaMes}
              onChange={(e) => {
                setBusquedaMes(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Ejemplo: enero"
            />
          </div>

          <div className="field-group">
            <label htmlFor="filtro-estado">Estado</label>
            <select
              id="filtro-estado"
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
            >
              <option value="todos">Todos</option>
              <option value="factura_pendiente">Factura pendiente</option>
              <option value="factura_enviada">Factura enviada</option>
              <option value="pago_registrado">Pago registrado</option>
            </select>
          </div>

          <button
            className="ghost-btn align-end"
            onClick={() => {
              setBusquedaMes('');
              setFiltroEstado('todos');
              setPaginaActual(1);
            }}
          >
            Limpiar
          </button>
        </div>

        {cargando ? (
          <SectionLoader title="Cargando historial" rows={5} />
        ) : pagosPaginados.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="No hay pagos que coincidan con los filtros actuales."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Anio</th>
                    <th>Monto</th>
                    <th>Estado</th>
                    <th>Fecha pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosPaginados.map((pago) => (
                    <tr key={pago.id}>
                      <td className="cell-primary">{pago.mes}</td>
                      <td>{getAnio(pago)}</td>
                      <td>{formatCurrency(cliente.precio)}</td>
                      <td>
                        <span className={`status-pill ${pago.estado}`}>
                          {pago.estado === 'pago_registrado'
                            ? 'Pago registrado'
                            : pago.estado === 'factura_enviada'
                              ? 'Factura enviada'
                              : 'Factura pendiente'}
                        </span>
                      </td>
                      <td>{pago.fechaPago || '-'}</td>
                      <td>
                        <div className="table-actions-inline">
                          <select
                            value={obtenerEstadoDraft(pago)}
                            onChange={(e) => manejarCambioEstado(pago.id, e.target.value)}
                          >
                            <option value="factura_pendiente">Factura pendiente</option>
                            <option value="factura_enviada">Factura enviada</option>
                            <option value="pago_registrado">Pago registrado</option>
                          </select>
                          <button
                            className="ghost-btn compact"
                            disabled={actualizandoPagoId === pago.id || obtenerEstadoDraft(pago) === pago.estado}
                            onClick={() => guardarEstadoPago(pago)}
                          >
                            {actualizandoPagoId === pago.id ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={paginaSegura}
              totalPages={totalPaginas}
              totalItems={pagosFiltrados.length}
              pageSize={PAGE_SIZE}
              label="pagos"
              onPageChange={(page) => setPaginaActual(page)}
            />
          </>
        )}
      </Panel>

      <Panel title="Preparar envio por WhatsApp" subtitle="Genera factura y mensaje personalizado para envio manual seguro">
        <div className="upload-grid">
          <div className="field-group">
            <label htmlFor="pago-factura">Periodo a enviar</label>
            <select
              id="pago-factura"
              value={pagoFacturaId}
              onChange={(e) => setPagoFacturaId(e.target.value)}
            >
              <option value="">Selecciona un pago</option>
              {pagosParaFacturar.map((pago) => (
                <option key={pago.id} value={pago.id}>
                  {pago.mes} {getAnio(pago)} | {pago.estado === 'factura_pendiente' ? 'Pendiente' : 'Enviada'}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="archivo-factura">Archivo factura</label>
            <input
              id="archivo-factura"
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setArchivoFactura(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <p className="helper-note">
          Seguridad: el nombre del archivo debe ser exactamente igual al nombre del negocio ({cliente.comercio}).
        </p>

        <button
          className="primary-btn"
          onClick={prepararEnvioFactura}
          disabled={!pagoFacturaId || !archivoFactura || preparandoFactura}
        >
          {preparandoFactura ? 'Preparando...' : 'Preparar envio'}
        </button>

        {facturaPreparada && (
          <div className="wa-preview">
            <p className="wa-title">Mensaje generado</p>
            <textarea value={facturaPreparada.mensaje} readOnly rows={5} />
            <div className="actions-row">
              <button className="ghost-btn" onClick={copiarMensajeFactura}>Copiar mensaje</button>
              <button className="primary-btn" onClick={abrirWhatsApp}>Abrir WhatsApp Web</button>
              <button className="ghost-btn" onClick={marcarFacturaEnviada}>Marcar como enviada</button>
            </div>
            <p className="helper-note">Adjunta el archivo manualmente en WhatsApp antes de enviar.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default ClienteDetalle;
