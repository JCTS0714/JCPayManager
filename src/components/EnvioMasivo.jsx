import React, { useEffect, useMemo, useState } from 'react';
import EmptyState from './ui/EmptyState';
import Panel from './ui/Panel';
import SectionLoader from './ui/SectionLoader';

const API_BASE_URL = 'http://localhost:3001';

const limpiarCelular = (valor = '') => String(valor).replace(/\D/g, '');

const construirMensaje = ({ row, plantilla }) => {
  const base = String(plantilla || '').trim();
  if (!base) {
    return row.facturaMensaje || '';
  }

  return base
    .replaceAll('{NEGOCIO}', row.comercio || '')
    .replaceAll('{MES}', `${row.mes || ''} ${row.anio || ''}`.trim())
    .replaceAll('{MONTO}', Number(row.precio || 0).toFixed(2));
};

const construirWhatsAppManualUrl = ({ row, plantilla }) => {
  const celular = limpiarCelular(row.celular || '');
  if (!celular) {
    return '';
  }
  const celularConPais = celular.startsWith('51') ? celular : `51${celular}`;
  const mensaje = row.facturaMensaje || construirMensaje({ row, plantilla });
  return `https://wa.me/${celularConPais}?text=${encodeURIComponent(mensaje || '')}`;
};

function EnvioMasivo({ onActualizar }) {
  const [cargando, setCargando] = useState(false);
  const [rows, setRows] = useState([]);
  const [periodo, setPeriodo] = useState({
    mes: '',
    anio: new Date().getFullYear()
  });
  const [plantilla, setPlantilla] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [archivos, setArchivos] = useState({});
  const [correos, setCorreos] = useState({});
  const [preparandoPagoId, setPreparandoPagoId] = useState(null);
  const [marcandoPagoId, setMarcandoPagoId] = useState(null);
  const [enviandoEmailPagoId, setEnviandoEmailPagoId] = useState(null);
  const [enviandoWhatsappPagoId, setEnviandoWhatsappPagoId] = useState(null);
  const [envioModo, setEnvioModo] = useState('kapso');
  const [brevoStatus, setBrevoStatus] = useState({
    checked: false,
    configured: false,
    missing: []
  });
  const [kapsoStatus, setKapsoStatus] = useState({
    checked: false,
    configured: false,
    missing: [],
    phoneNumberId: null
  });
  const [ultimoDiagnostico, setUltimoDiagnostico] = useState([]);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    cargarPendientes();
    cargarEstadoBrevo();
    cargarEstadoKapso();
  }, []);

  const cargarEstadoBrevo = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/integraciones/brevo/status');
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo validar estado de Brevo.');
      }
      setBrevoStatus({
        checked: true,
        configured: Boolean(datos.configured),
        missing: datos.missing || []
      });
    } catch (error) {
      setBrevoStatus({ checked: true, configured: false, missing: [] });
    }
  };

  const cargarEstadoKapso = async () => {
    try {
      const respuesta = await fetch(`${API_BASE_URL}/api/integraciones/kapso/status`);
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo validar estado de Kapso.');
      }
      setKapsoStatus({
        checked: true,
        configured: Boolean(datos.configured),
        missing: datos.missing || [],
        phoneNumberId: datos.phoneNumberId || null
      });
    } catch (error) {
      setKapsoStatus({
        checked: true,
        configured: false,
        missing: [],
        phoneNumberId: null
      });
    }
  };

  const cargarPendientes = async (mesParam, anioParam) => {
    setCargando(true);
    setMensaje(null);
    try {
      const params = new URLSearchParams();
      if (mesParam || periodo.mes) {
        params.set('mes', (mesParam || periodo.mes).toUpperCase());
      }
      if (anioParam || periodo.anio) {
        params.set('anio', String(anioParam || periodo.anio));
      }

      const url = `${API_BASE_URL}/api/facturas/pendientes${params.toString() ? `?${params.toString()}` : ''}`;
      const respuesta = await fetch(url);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.error || 'No se pudo cargar la bandeja de pendientes.');
      }

      setRows(datos.rows || []);
      setPlantilla(datos.templateSugerido || '');
      setPeriodo(datos.periodo || periodo);
      setArchivos({});
      setCorreos({});
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error cargando pendientes.' });
    } finally {
      setCargando(false);
    }
  };

  const rowsFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((row) => {
      const nombre = `${row.comercio || ''}`.toLowerCase();
      const contacto = `${row.contacto || ''}`.toLowerCase();
      return nombre.includes(term) || contacto.includes(term);
    });
  }, [rows, busqueda]);

  const setArchivoPago = (pagoId, archivo) => {
    setArchivos((prev) => ({
      ...prev,
      [pagoId]: archivo || null
    }));
  };

  const setCorreoPago = (pagoId, correo) => {
    setCorreos((prev) => ({
      ...prev,
      [pagoId]: correo || ''
    }));
  };

  const prepararFila = async (row) => {
    const archivo = archivos[row.pagoId];
    if (!archivo) {
      setMensaje({ type: 'error', text: `Selecciona la factura de ${row.comercio}.` });
      return;
    }

    setPreparandoPagoId(row.pagoId);
    setMensaje(null);

    const formData = new FormData();
    formData.append('pagoId', String(row.pagoId));
    formData.append('mensajeTemplate', plantilla);
    formData.append('archivo', archivo);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/api/facturas/preparar`, {
        method: 'POST',
        body: formData
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || `No se pudo preparar ${row.comercio}.`);
      }

      setUltimoDiagnostico(datos.whatsappDiagnostics || []);

      if (envioModo === 'manual' && datos.whatsappUrl) {
        window.open(datos.whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      if (datos.whatsappApiReady) {
        setMensaje({
          type: 'success',
          text: `Factura preparada para ${row.comercio}. Ya puedes usar "Enviar archivo WA".`
        });
      } else {
        const primerError = (datos.whatsappDiagnostics || [])[0]?.message || '';
        setMensaje({
          type: 'error',
          text: `Factura preparada para ${row.comercio}, pero el envio API no esta listo.${primerError ? ` ${primerError}` : ''}`
        });
      }
      setArchivoPago(row.pagoId, null);
      await cargarPendientes(periodo.mes, periodo.anio);
      await cargarEstadoKapso();
      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error preparando envio.' });
    } finally {
      setPreparandoPagoId(null);
    }
  };

  const marcarEnviada = async (row) => {
    setMarcandoPagoId(row.pagoId);
    setMensaje(null);
    try {
      const respuesta = await fetch(`${API_BASE_URL}/api/facturas/${row.pagoId}/marcar-enviada`, { method: 'POST' });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || `No se pudo marcar ${row.comercio} como enviada.`);
      }

      setMensaje({ type: 'success', text: `Factura marcada como enviada para ${row.comercio}.` });
      await cargarPendientes(periodo.mes, periodo.anio);
      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error marcando envio.' });
    } finally {
      setMarcandoPagoId(null);
    }
  };

  const enviarCorreo = async (row) => {
    const emailDestino = `${correos[row.pagoId] || ''}`.trim();
    if (!emailDestino) {
      setMensaje({ type: 'error', text: `Ingresa un correo para ${row.comercio}.` });
      return;
    }

    setEnviandoEmailPagoId(row.pagoId);
    setMensaje(null);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/api/facturas/${row.pagoId}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailDestino,
          nombreDestino: row.contacto || undefined,
          mensajeTemplate: plantilla
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.error || `No se pudo enviar correo a ${row.comercio}.`);
      }

      setMensaje({ type: 'success', text: `Correo enviado a ${emailDestino} para ${row.comercio}.` });
      await cargarPendientes(periodo.mes, periodo.anio);
      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error enviando correo.' });
    } finally {
      setEnviandoEmailPagoId(null);
    }
  };

  const enviarWhatsappArchivo = async (row) => {
    setEnviandoWhatsappPagoId(row.pagoId);
    setMensaje(null);

    try {
      const respuesta = await fetch(`${API_BASE_URL}/api/facturas/${row.pagoId}/enviar-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mensajeTemplate: plantilla
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        const diagnostico = datos?.diagnostics || [];
        setUltimoDiagnostico(diagnostico);
        throw new Error(datos.error || `No se pudo enviar WhatsApp a ${row.comercio}.`);
      }

      setUltimoDiagnostico([]);
      setMensaje({ type: 'success', text: `Archivo enviado por WhatsApp a ${row.comercio}.` });
      await cargarPendientes(periodo.mes, periodo.anio);
      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      setMensaje({ type: 'error', text: error.message || 'Error enviando WhatsApp con archivo.' });
    } finally {
      setEnviandoWhatsappPagoId(null);
    }
  };

  const abrirWhatsappManual = (row) => {
    const whatsappUrl = construirWhatsAppManualUrl({ row, plantilla });
    if (!whatsappUrl) {
      setMensaje({ type: 'error', text: `El cliente ${row.comercio} no tiene celular valido.` });
      return;
    }
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const resumen = useMemo(() => {
    const conFacturaLista = rows.filter((row) => Boolean(row.facturaArchivoUrl)).length;
    const enPreparado = rows.filter((row) => row.facturaEnvioEstado === 'preparado').length;
    return {
      total: rows.length,
      conFacturaLista,
      enPreparado
    };
  }, [rows]);

  return (
    <div className="view-stack">
      <Panel
        title="Centro de envios"
        subtitle="Prepara facturas, envia archivo por WhatsApp API y usa fallback manual cuando sea necesario"
        actions={<button className="ghost-btn" onClick={() => cargarPendientes(periodo.mes, periodo.anio)}>Actualizar</button>}
      >
        <div className="envios-kpi-grid">
          <article className="envio-kpi-card">
            <span>Pendientes</span>
            <strong>{resumen.total}</strong>
            <small>Filas activas del periodo</small>
          </article>
          <article className="envio-kpi-card">
            <span>Factura lista</span>
            <strong>{resumen.conFacturaLista}</strong>
            <small>Con archivo preparado</small>
          </article>
          <article className="envio-kpi-card">
            <span>Listas para enviar</span>
            <strong>{resumen.enPreparado}</strong>
            <small>Estado preparado</small>
          </article>
          <article className="envio-kpi-card highlight">
            <span>Modo activo</span>
            <strong>{envioModo === 'kapso' ? 'Kapso API' : 'WhatsApp Manual'}</strong>
            <small>Configurable en un clic</small>
          </article>
        </div>

        <div className="envio-mode-toggle" role="group" aria-label="Modo de envio de WhatsApp">
          <button
            type="button"
            className={`mode-btn ${envioModo === 'kapso' ? 'active' : ''}`}
            onClick={() => setEnvioModo('kapso')}
          >
            Envio por Kapso API
          </button>
          <button
            type="button"
            className={`mode-btn ${envioModo === 'manual' ? 'active' : ''}`}
            onClick={() => setEnvioModo('manual')}
          >
            Envio manual (wa.me)
          </button>
        </div>

        <div className="filters-grid">
          <div className="field-group">
            <label htmlFor="filtro-envios">Buscar cliente</label>
            <input
              id="filtro-envios"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Comercio o contacto"
            />
          </div>
          <div className="field-group">
            <label htmlFor="periodo-mes">Mes</label>
            <input
              id="periodo-mes"
              value={periodo.mes}
              onChange={(e) => setPeriodo((prev) => ({ ...prev, mes: e.target.value.toUpperCase() }))}
            />
          </div>
          <button className="ghost-btn align-end" onClick={() => cargarPendientes(periodo.mes, periodo.anio)}>Aplicar periodo</button>
        </div>

        <div className="field-group">
          <label htmlFor="plantilla-whatsapp">Plantilla de mensaje (usa {`{NEGOCIO}`}, {`{MES}`}, {`{MONTO}`})</label>
          <textarea
            id="plantilla-whatsapp"
            rows={7}
            value={plantilla}
            onChange={(e) => setPlantilla(e.target.value)}
          />
        </div>

        <div className="integraciones-grid">
          <article className={`integration-card ${kapsoStatus.configured ? 'ok' : 'ko'}`}>
            <h4>WhatsApp (Kapso)</h4>
            <p>
              {kapsoStatus.checked
                ? kapsoStatus.configured
                  ? `Conectado (${kapsoStatus.phoneNumberId || 'sin phone_number_id'})`
                  : `No configurado${kapsoStatus.missing.length ? `: ${kapsoStatus.missing.join(', ')}` : ''}`
                : 'Validando configuracion...'}
            </p>
          </article>

          <article className={`integration-card ${brevoStatus.configured ? 'ok' : 'ko'}`}>
            <h4>Email (Brevo)</h4>
            <p>
              {brevoStatus.checked
                ? brevoStatus.configured
                  ? 'Conectado y listo para envio de correo.'
                  : `No configurado${brevoStatus.missing.length ? `: ${brevoStatus.missing.join(', ')}` : ''}`
                : 'Validando configuracion...'}
            </p>
          </article>
        </div>

        {ultimoDiagnostico.length > 0 && (
          <div className="feedback error soft">
            <strong>Diagnostico Kapso:</strong>
            <ul className="diagnostic-list">
              {ultimoDiagnostico.map((item) => (
                <li key={item.code || item.message}>{item.message}</li>
              ))}
            </ul>
          </div>
        )}

        {mensaje && <p className={`feedback ${mensaje.type}`}>{mensaje.text}</p>}

        {cargando ? (
          <SectionLoader title="Cargando pendientes de envio" rows={6} />
        ) : rowsFiltrados.length === 0 ? (
          <EmptyState
            title="Sin clientes pendientes"
            description="No hay facturas pendientes para el periodo seleccionado."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Celular</th>
                  <th>Periodo</th>
                  <th>Monto</th>
                  <th>Estado envio</th>
                  <th>Archivo factura</th>
                  <th>Email destino</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rowsFiltrados.map((row) => (
                  <tr key={row.pagoId}>
                    <td className="cell-primary">{row.comercio}</td>
                    <td>{row.contacto || '-'}</td>
                    <td>{row.celular || '-'}</td>
                    <td>{row.mes} {row.anio}</td>
                    <td>S/. {Number(row.precio || 0).toFixed(2)}</td>
                    <td>
                      <span className={`status-pill ${row.facturaEnvioEstado || 'factura_pendiente'}`}>
                        {row.facturaEnvioEstado || 'pendiente'}
                      </span>
                    </td>
                    <td>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => setArchivoPago(row.pagoId, e.target.files?.[0] || null)}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        placeholder="cliente@correo.com"
                        value={correos[row.pagoId] || ''}
                        onChange={(e) => setCorreoPago(row.pagoId, e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="envio-actions-grid">
                        <button
                          className="primary-btn compact"
                          onClick={() => prepararFila(row)}
                          disabled={preparandoPagoId === row.pagoId}
                        >
                          {preparandoPagoId === row.pagoId ? 'Preparando...' : '1) Preparar factura'}
                        </button>

                        <button
                          className="ghost-btn compact"
                          onClick={() => enviarWhatsappArchivo(row)}
                          disabled={!kapsoStatus.configured || enviandoWhatsappPagoId === row.pagoId || !row.facturaArchivoUrl}
                        >
                          {enviandoWhatsappPagoId === row.pagoId ? 'Enviando...' : '2) Enviar archivo WA'}
                        </button>

                        <button
                          className="ghost-btn compact"
                          onClick={() => abrirWhatsappManual(row)}
                          disabled={!row.celular}
                        >
                          3) Abrir WA manual
                        </button>

                        <button
                          className="ghost-btn compact"
                          onClick={() => enviarCorreo(row)}
                          disabled={!brevoStatus.configured || enviandoEmailPagoId === row.pagoId || !row.facturaArchivoUrl}
                        >
                          {enviandoEmailPagoId === row.pagoId ? 'Enviando...' : 'Enviar email'}
                        </button>

                        <button
                          className="ghost-btn compact"
                          onClick={() => marcarEnviada(row)}
                          disabled={marcandoPagoId === row.pagoId || row.facturaEnvioEstado !== 'preparado'}
                        >
                          {marcandoPagoId === row.pagoId ? 'Guardando...' : 'Marcar enviada'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default EnvioMasivo;
