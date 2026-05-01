import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ClientesList from './components/ClientesList';
import ClienteDetalle from './components/ClienteDetalle';
import ImportarDatos from './components/ImportarDatos';
import Reportes from './components/Reportes';
import EnvioMasivo from './components/EnvioMasivo';
import SectionLoader from './components/ui/SectionLoader';

function App() {
  const [vista, setVista] = useState('inicio');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  useEffect(() => {
    cargarClientes();
  }, []);

  const cargarClientes = async () => {
    setCargando(true);
    try {
      const respuesta = await fetch('http://localhost:3001/api/clientes');
      const datos = await respuesta.json();
      setClientes(datos);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setCargando(false);
    }
  };

  const manejarSeleccionCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    setVista('detalle');
    setSidebarAbierto(false);
  };

  const manejarImportacion = () => {
    cargarClientes();
    setVista('inicio');
  };

  const cambiarVista = (nuevaVista) => {
    setVista(nuevaVista);
    setSidebarAbierto(false);
  };

  const getTitulo = () => {
    switch (vista) {
      case 'importar': return 'Importar Clientes';
      case 'reportes': return 'Reporte Ejecutivo';
      case 'envios': return 'Preparar Envios';
      case 'detalle': return clienteSeleccionado?.comercio || 'Detalle del Cliente';
      default: return 'Clientes';
    }
  };

  const getSubtitulo = () => {
    switch (vista) {
      case 'importar': return 'Carga masiva segura desde Excel o CSV';
      case 'reportes': return 'Analitica operativa y salud de cobranzas';
      case 'envios': return 'Planificacion de facturas y mensajes por WhatsApp';
      case 'detalle': return 'Seguimiento de pagos y comprobantes';
      default: return 'Operacion comercial centralizada';
    }
  };

  const navItems = [
    { id: 'inicio', label: 'Clientes', short: 'CL' },
    { id: 'importar', label: 'Importaciones', short: 'IM' },
    { id: 'envios', label: 'Envios', short: 'WA' },
    { id: 'reportes', label: 'Reportes', short: 'RP' }
  ];

  const vistaActiva = vista === 'detalle' ? 'detalle' : vista;

  const renderVista = () => {
    if (cargando && vista !== 'detalle') {
      return <SectionLoader rows={5} title="Sincronizando informacion de clientes" />;
    }

    if (vista === 'inicio') {
      return (
        <ClientesList
          clientes={clientes}
          onSeleccionar={manejarSeleccionCliente}
          onCrearCliente={cargarClientes}
          loading={cargando}
        />
      );
    }

    if (vista === 'detalle' && clienteSeleccionado) {
      return (
        <ClienteDetalle
          cliente={clienteSeleccionado}
          onVolver={() => cambiarVista('inicio')}
          onActualizar={cargarClientes}
        />
      );
    }

    if (vista === 'importar') {
      return <ImportarDatos onImportar={manejarImportacion} />;
    }

    if (vista === 'envios') {
      return <EnvioMasivo onActualizar={cargarClientes} />;
    }

    return <Reportes clientes={clientes} />;
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarAbierto ? 'activo' : ''}`}>
        <div className="brand-block">
          <div className="brand-chip">JC</div>
          <div>
            <p className="brand-title">JCPAYMANAGER</p>
            <p className="brand-subtitle">Control de facturacion</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${vistaActiva === item.id ? 'activo' : ''}`}
              onClick={() => cambiarVista(item.id)}
            >
              <span className="nav-flag">{item.short}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footnote">
          <p>Sistema interno</p>
          <p>Version 2.0</p>
        </div>
      </aside>

      {sidebarAbierto && <button className="sidebar-overlay" onClick={() => setSidebarAbierto(false)} />}

      <div className="workspace">
        <header className="header">
          <div className="header-content">
            <div className="header-left">
              <button
                className="menu-toggle"
                onClick={() => setSidebarAbierto(!sidebarAbierto)}
                aria-label="Abrir menu"
              >
                <span />
                <span />
                <span />
              </button>
              <div>
                <h1 className="header-title">{getTitulo()}</h1>
                <p className="header-subtitle">{getSubtitulo()}</p>
              </div>
            </div>

            <div className="header-actions">
              <button className="ghost-btn" onClick={cargarClientes}>Actualizar</button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${vista}-${clienteSeleccionado?.id || 'root'}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {renderVista()}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="footer">
          <p>PayManager 2026 | Plataforma de cobranza y seguimiento comercial</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
