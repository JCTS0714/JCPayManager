import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import EmptyState from './ui/EmptyState';
import Pagination from './ui/Pagination';
import Panel from './ui/Panel';
import SectionLoader from './ui/SectionLoader';
import StatCard from './ui/StatCard';

const PAGE_SIZE = 8;

function formatCurrency(amount) {
  return `S/. ${Number(amount || 0).toFixed(2)}`;
}

function ClientesList({ clientes, onSeleccionar, loading, onCrearCliente }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] = useState(null);
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    comercio: '',
    contacto: '',
    celular: '',
    ciudad: '',
    precio: '',
    ruc: '',
    rubro: ''
  });

  const rubros = useMemo(
    () => [...new Set(clientes.map((c) => c.rubro).filter(Boolean))].sort(),
    [clientes]
  );

  const clientesFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return clientes.filter((cliente) => {
      const nombre = `${cliente.comercio || ''}`.toLowerCase();
      const contacto = `${cliente.contacto || ''}`.toLowerCase();
      const ciudad = `${cliente.ciudad || ''}`.toLowerCase();
      const byTerm = !term || nombre.includes(term) || contacto.includes(term) || ciudad.includes(term);
      const byRubro = filtroRubro === 'todos' || cliente.rubro === filtroRubro;
      return byTerm && byRubro;
    });
  }, [clientes, busqueda, filtroRubro]);

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(paginaActual, totalPaginas);

  const clientesPaginados = useMemo(() => {
    const start = (paginaSegura - 1) * PAGE_SIZE;
    return clientesFiltrados.slice(start, start + PAGE_SIZE);
  }, [clientesFiltrados, paginaSegura]);

  const estadisticas = useMemo(() => {
    const deuda = clientes.reduce((sum, c) => sum + Number(c.precio || 0), 0);
    const promedio = clientes.length ? deuda / clientes.length : 0;

    return {
      total: clientes.length,
      deuda,
      promedio,
      rubros: rubros.length
    };
  }, [clientes, rubros.length]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroRubro('todos');
    setPaginaActual(1);
  };

  const actualizarCampoCliente = (campo, valor) => {
    setNuevoCliente((prev) => ({ ...prev, [campo]: valor }));
  };

  const resetFormularioCliente = () => {
    setNuevoCliente({
      comercio: '',
      contacto: '',
      celular: '',
      ciudad: '',
      precio: '',
      ruc: '',
      rubro: ''
    });
    setClienteEditandoId(null);
  };

  const iniciarEdicionCliente = (cliente) => {
    setMensaje(null);
    setClienteEditandoId(cliente.id);
    setNuevoCliente({
      comercio: cliente.comercio || '',
      contacto: cliente.contacto || '',
      celular: cliente.celular || '',
      ciudad: cliente.ciudad || '',
      precio: cliente.precio ?? '',
      ruc: cliente.ruc || '',
      rubro: cliente.rubro || ''
    });
    setMostrarFormulario(true);
  };

  const guardarCliente = async () => {
    if (!nuevoCliente.comercio.trim()) {
      setMensaje({ type: 'error', text: 'El comercio es obligatorio.' });
      return;
    }

    setGuardandoCliente(true);
    setMensaje(null);

    try {
      const esEdicion = Boolean(clienteEditandoId);
      const endpoint = esEdicion
        ? `http://localhost:3001/api/clientes/${clienteEditandoId}`
        : 'http://localhost:3001/api/clientes';

      const payload = {
        ...nuevoCliente,
        precio: Number(nuevoCliente.precio || 0)
      };

      const respuesta = await fetch(endpoint, {
        method: esEdicion ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          esEdicion
            ? payload
            : {
                ...payload,
                año: new Date().getFullYear(),
                usuario: '',
                contraseña: ''
              }
        )
      });

      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo guardar el cliente.');
      }

      setMensaje({
        type: 'success',
        text: clienteEditandoId ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.'
      });
      resetFormularioCliente();
      setMostrarFormulario(false);
      if (onCrearCliente) {
        onCrearCliente();
      }
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error al guardar cliente.' });
    } finally {
      setGuardandoCliente(false);
    }
  };

  return (
    <div className="view-stack">
      <div className="stats-grid">
        <StatCard
          label="Clientes activos"
          value={estadisticas.total}
          hint="base consolidada"
        />
        <StatCard
          label="Facturacion esperada"
          value={formatCurrency(estadisticas.deuda)}
          hint="monto mensual"
        />
        <StatCard
          label="Ticket promedio"
          value={formatCurrency(estadisticas.promedio)}
          hint="por cliente"
        />
        <StatCard
          label="Rubros detectados"
          value={estadisticas.rubros}
          hint="segmentacion actual"
        />
      </div>

      <Panel
        title="Directorio de clientes"
        subtitle="Busqueda operativa con filtros y paginacion"
        actions={(
          <button
            className="primary-btn compact"
            onClick={() => {
              setMensaje(null);
              if (mostrarFormulario) {
                setMostrarFormulario(false);
                resetFormularioCliente();
                return;
              }
              resetFormularioCliente();
              setMostrarFormulario(true);
            }}
          >
            {mostrarFormulario ? 'Cerrar formulario' : 'Nuevo cliente'}
          </button>
        )}
      >
        {mostrarFormulario && (
          <div className="inline-form-panel">
            <p className="helper-note">
              {clienteEditandoId ? 'Editando cliente seleccionado' : 'Completa los datos para registrar un nuevo cliente'}
            </p>
            <div className="inline-form-grid">
              <div className="field-group">
                <label htmlFor="nuevo-comercio">Comercio</label>
                <input id="nuevo-comercio" value={nuevoCliente.comercio} onChange={(e) => actualizarCampoCliente('comercio', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-contacto">Contacto</label>
                <input id="nuevo-contacto" value={nuevoCliente.contacto} onChange={(e) => actualizarCampoCliente('contacto', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-celular">Celular</label>
                <input id="nuevo-celular" value={nuevoCliente.celular} onChange={(e) => actualizarCampoCliente('celular', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-ciudad">Ciudad</label>
                <input id="nuevo-ciudad" value={nuevoCliente.ciudad} onChange={(e) => actualizarCampoCliente('ciudad', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-precio">Precio</label>
                <input id="nuevo-precio" type="number" min="0" value={nuevoCliente.precio} onChange={(e) => actualizarCampoCliente('precio', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-ruc">RUC</label>
                <input id="nuevo-ruc" value={nuevoCliente.ruc} onChange={(e) => actualizarCampoCliente('ruc', e.target.value)} />
              </div>
              <div className="field-group">
                <label htmlFor="nuevo-rubro">Rubro</label>
                <input id="nuevo-rubro" value={nuevoCliente.rubro} onChange={(e) => actualizarCampoCliente('rubro', e.target.value)} />
              </div>
            </div>
            <div className="actions-row">
              <button className="primary-btn" onClick={guardarCliente} disabled={guardandoCliente}>
                {guardandoCliente ? 'Guardando...' : clienteEditandoId ? 'Actualizar cliente' : 'Guardar cliente'}
              </button>
              <button
                className="ghost-btn"
                onClick={() => {
                  setMostrarFormulario(false);
                  resetFormularioCliente();
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {mensaje && <p className={`feedback ${mensaje.type}`}>{mensaje.text}</p>}

        <div className="filters-grid">
          <div className="field-group">
            <label htmlFor="busqueda-cliente">Buscar</label>
            <input
              id="busqueda-cliente"
              type="text"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPaginaActual(1);
              }}
              placeholder="Comercio, contacto o ciudad"
            />
          </div>

          <div className="field-group">
            <label htmlFor="filtro-rubro">Rubro</label>
            <select
              id="filtro-rubro"
              value={filtroRubro}
              onChange={(e) => {
                setFiltroRubro(e.target.value);
                setPaginaActual(1);
              }}
            >
              <option value="todos">Todos</option>
              {rubros.map((rubro) => (
                <option key={rubro} value={rubro}>{rubro}</option>
              ))}
            </select>
          </div>

          <button className="ghost-btn align-end" onClick={limpiarFiltros}>Limpiar</button>
        </div>

        {loading ? (
          <SectionLoader title="Cargando tabla de clientes" rows={6} />
        ) : clientesPaginados.length === 0 ? (
          <EmptyState
            title="No hay resultados"
            description="Prueba con otros filtros o registra nuevos clientes."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Comercio</th>
                    <th>Contacto</th>
                    <th>Ciudad</th>
                    <th>Rubro</th>
                    <th>Mensual</th>
                    <th>RUC</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPaginados.map((cliente) => (
                    <motion.tr
                      key={cliente.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <td className="cell-primary">{cliente.comercio || 'Sin nombre'}</td>
                      <td>{cliente.contacto || 'Sin contacto'}</td>
                      <td>{cliente.ciudad || 'No definido'}</td>
                      <td><span className="pill">{cliente.rubro || 'General'}</span></td>
                      <td>{formatCurrency(cliente.precio)}</td>
                      <td>{cliente.ruc || 'No definido'}</td>
                      <td>
                        <div className="table-actions-inline">
                          <button className="primary-btn compact" onClick={() => onSeleccionar(cliente)}>
                            Gestionar
                          </button>
                          <button className="ghost-btn compact" onClick={() => iniciarEdicionCliente(cliente)}>
                            Editar
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={paginaSegura}
              totalPages={totalPaginas}
              totalItems={clientesFiltrados.length}
              pageSize={PAGE_SIZE}
              label="clientes"
              onPageChange={(page) => setPaginaActual(page)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

export default ClientesList;
