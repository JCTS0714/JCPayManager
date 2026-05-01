import React, { useState } from 'react';
import Panel from './ui/Panel';
import SectionLoader from './ui/SectionLoader';

function ImportarDatos({ onImportar }) {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [dragActivo, setDragActivo] = useState(false);
  const [reseteando, setReseteando] = useState(false);

  const manejarCambioArchivo = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (!['xlsx', 'xls', 'csv'].includes(extension)) {
        setError('Formato invalido. Solo Excel (.xlsx, .xls) o CSV.');
        setArchivo(null);
        return;
      }
      setArchivo(file);
      setError(null);
      setResultado(null);
    }
  };

  const manejarImportacion = async () => {
    if (!archivo) {
      setError('Selecciona un archivo para importar.');
      return;
    }

    setCargando(true);
    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
      const respuesta = await fetch('http://localhost:3001/api/importar', {
        method: 'POST',
        body: formData
      });

      const datos = await respuesta.json();

      if (respuesta.ok) {
        setResultado({
          exito: true,
          contador: datos.contador,
          mensaje: `Se importaron ${datos.contador} clientes. Meses detectados: ${(datos.mesesDetectados || []).join(', ') || 'N/A'}.`
        });
        setArchivo(null);
        setTimeout(() => {
          onImportar();
        }, 2000);
      } else {
        setError(`Error: ${datos.error}`);
      }
    } catch (err) {
      setError(`Error al importar: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const descargarPlantilla = () => {
    alert('La descarga de plantilla sera habilitada en una siguiente version.');
  };

  const limpiarBase = async () => {
    const confirmado = window.confirm('Esto eliminara todos los clientes, pagos y comprobantes. Deseas continuar?');
    if (!confirmado) {
      return;
    }

    setReseteando(true);
    setError(null);
    setResultado(null);

    try {
      const respuesta = await fetch('http://localhost:3001/api/admin/reset', {
        method: 'DELETE'
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo limpiar la base de datos.');
      }

      setArchivo(null);
      setResultado({
        exito: true,
        contador: 0,
        mensaje: datos.message || 'Base de datos reiniciada.'
      });
      onImportar();
    } catch (err) {
      setError(err.message || 'Error al limpiar la base de datos.');
    } finally {
      setReseteando(false);
    }
  };

  const progreso = resultado?.exito ? 100 : cargando ? 68 : archivo ? 34 : 10;

  const estadoProceso = resultado?.exito
    ? 'Completado'
    : cargando
      ? 'Procesando'
      : archivo
        ? 'Listo para importar'
        : 'Esperando archivo';

  return (
    <div className="import-layout">
      <Panel
        className="import-main-panel"
        title="Importacion de clientes"
        subtitle="Carga masiva con validaciones y retroalimentacion inmediata"
        actions={<button className="ghost-btn" onClick={descargarPlantilla}>Descargar plantilla</button>}
      >
        <div className="import-steps">
          <h4>Estructura recomendada</h4>
          <ol>
            <li>Usa columnas base: COMERCIO, CONTACTO, CELULAR, CIUDAD, PRECIO, RUC, RUBRO, AÑO, MES, FECHA DE EMICION, LINK, USUARIO, CONTRASEÑA.</li>
            <li>Agrega columnas mensuales (ENERO, FEBRERO, MARZO, ...) solo con datos reales del periodo.</li>
            <li>El sistema importa meses con contenido y evita meses futuros vacios del año actual.</li>
          </ol>
        </div>

        <label htmlFor="input-archivo" className="upload-zone">
          <input
            id="input-archivo"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={manejarCambioArchivo}
          />
          <div
            className={`upload-zone-inner ${dragActivo ? 'dragging' : ''}`}
            onDragEnter={() => setDragActivo(true)}
            onDragLeave={() => setDragActivo(false)}
            onDrop={() => setDragActivo(false)}
          >
            <small className="upload-kicker">Carga segura</small>
            <strong>Selecciona el archivo de importacion</strong>
            <span>Formatos soportados: XLSX, XLS, CSV</span>
          </div>
        </label>

        {archivo && (
          <div className="file-meta-card">
            <div>
              <small>Archivo listo</small>
              <strong>{archivo.name}</strong>
            </div>
            <div>
              <small>Tamano</small>
              <strong>{(archivo.size / 1024).toFixed(1)} KB</strong>
            </div>
            <div>
              <small>Tipo</small>
              <strong>{archivo.name.split('.').pop().toUpperCase()}</strong>
            </div>
          </div>
        )}

        {error && <p className="feedback error">{error}</p>}

        {resultado?.exito && (
          <div className="feedback success">
            <strong>Importacion completada</strong>
            <span>{resultado.mensaje}</span>
          </div>
        )}

        {cargando ? (
          <SectionLoader rows={3} title="Procesando archivo y registrando clientes" />
        ) : (
          <button className="primary-btn full" onClick={manejarImportacion} disabled={!archivo}>
            Importar clientes
          </button>
        )}

        <p className="helper-note">
          Los registros nuevos se insertan en la base de datos operativa y quedaran disponibles en el modulo Clientes.
        </p>
      </Panel>

      <div className="import-side-stack">
        <Panel title="Centro de control" subtitle="Estado en tiempo real de la carga">
          <div className="import-status-grid">
            <div className="status-item">
              <span>Archivo</span>
              <strong>{archivo ? 'Detectado' : 'Pendiente'}</strong>
            </div>
            <div className="status-item">
              <span>Proceso</span>
              <strong>{estadoProceso}</strong>
            </div>
            <div className="status-item">
              <span>Registros</span>
              <strong>{resultado?.contador || 0}</strong>
            </div>
          </div>

          <div className="import-progress-wrap">
            <div className="import-progress-head">
              <span>Progreso</span>
              <strong>{progreso}%</strong>
            </div>
            <div className="import-progress-track">
              <span className="import-progress-fill" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        </Panel>

        <Panel title="Checklist rapido" subtitle="Validaciones antes de subir">
          <ul className="import-checklist">
            <li>Elimina filas vacias y encabezados duplicados.</li>
            <li>Verifica que RUC y COMERCIO no esten vacios.</li>
            <li>Confirma que los montos usen punto decimal.</li>
            <li>Mantiene un solo archivo por lote para trazabilidad.</li>
          </ul>

          <button
            className="danger-btn full"
            onClick={limpiarBase}
            disabled={reseteando || cargando}
          >
            {reseteando ? 'Limpiando base...' : 'Eliminar todos los registros'}
          </button>
        </Panel>
      </div>
    </div>
  );
}

export default ImportarDatos;
