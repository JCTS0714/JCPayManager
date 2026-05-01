import React, { useState, useEffect } from 'react';
import './App.css';
import ClientesList from './components/ClientesList';
import ClienteDetalle from './components/ClienteDetalle';
import ImportarDatos from './components/ImportarDatos';
import Reportes from './components/Reportes';

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

  const getTitulo = () => {
    switch(vista) {
      case 'importar': return 'Importar Clientes';
      case 'reportes': return 'Reportes y Estadísticas';
      case 'detalle': return clienteSeleccionado?.comercio || 'Detalle del Cliente';
      default: return 'Mis Clientes';
    }
  };

  const getSubtitulo = () => {
    switch(vista) {
      case 'importar': return 'Carga datos desde Excel o CSV';
      case 'reportes': return 'Visualiza tu desempeño en pagos';
      case 'detalle': return 'Administra pagos y comprobantes';
      default: return 'Gestiona toda la información de tus clientes';
    }
  };

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarAbierto ? 'activo' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">PayManager</div>
          <div className="sidebar-logo-subtext">Admin Panel</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${vista === 'inicio' ? 'activo' : ''}`}
            onClick={() => { setVista('inicio'); setSidebarAbierto(false); }}
          >
            <span>👥</span>
            <span>Clientes</span>
          </button>
          <button
            className={`sidebar-nav-item ${vista === 'importar' ? 'activo' : ''}`}
            onClick={() => { setVista('importar'); setSidebarAbierto(false); }}
          >
            <span>📤</span>
            <span>Importar</span>
          </button>
          <button
            className={`sidebar-nav-item ${vista === 'reportes' ? 'activo' : ''}`}
            onClick={() => { setVista('reportes'); setSidebarAbierto(false); }}
          >
            <span>📊</span>
            <span>Reportes</span>
          </button>
        </nav>
      </aside>

      {/* HEADER */}
      <header className="header">
        <div className="header-content">
          <div>
            <button 
              className="menu-toggle"
              onClick={() => setSidebarAbierto(!sidebarAbierto)}
            >
              ☰
            </button>
            <h1 className="header-title">{getTitulo()}</h1>
            <p className="header-subtitle">{getSubtitulo()}</p>
          </div>
          <div className="header-actions">
            <button className="header-btn">⚙️ Configuración</button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="main-content">
        {cargando && <div className="loader">Cargando...</div>}

        {vista === 'inicio' && (
          <ClientesList 
            clientes={clientes}
            onSeleccionar={manejarSeleccionCliente}
          />
        )}

        {vista === 'detalle' && clienteSeleccionado && (
          <ClienteDetalle 
            cliente={clienteSeleccionado}
            onVolver={() => setVista('inicio')}
            onActualizar={cargarClientes}
          />
        )}

        {vista === 'importar' && (
          <ImportarDatos onImportar={manejarImportacion} />
        )}

        {vista === 'reportes' && (
          <Reportes clientes={clientes} />
        )}
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <p>PayManager © 2024 | Sistema profesional de administración de pagos</p>
      </footer>
    </div>
  );
}

export default App;
