import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Printer, 
  Save, 
  Check, 
  Store, 
  Lock, 
  KeyRound,
  Zap,
  Database,
  Download,
  Upload,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { SystemSettings } from '../types';
import { api } from '../services/api';
import { customAlert } from '../utils/alert';
import { isAutoPrintEnabled, setAutoPrintEnabled } from '../utils/printHelper';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'hardware' | 'security' | 'backup'>('hardware');
  const [autoPrint, setAutoPrint] = useState<boolean>(isAutoPrintEnabled());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const sets = await api.getSettings();
      setSettings(sets);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      customAlert(err.message || 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setIsDownloading(true);
      const data = await api.getBackup();
      const dateStr = new Date().toISOString().split('T')[0];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_pos_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      customAlert(err.message || 'Error al descargar la copia de seguridad');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('¿Deseas restaurar este respaldo? Se sobrescribirá el catálogo y datos con la información del archivo.')) {
      e.target.value = '';
      return;
    }

    try {
      setIsRestoring(true);
      setRestoreMessage(null);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const backupData = JSON.parse(content);
          const res = await api.restoreBackup(backupData);
          setRestoreMessage(res.message || '¡Respaldo restaurado con éxito!');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (parseErr: any) {
          customAlert('El archivo seleccionado no es un formato JSON de respaldo válido.');
          setIsRestoring(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      customAlert(err.message || 'Error al procesar el archivo');
      setIsRestoring(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-6 text-slate-400">Cargando ajustes...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-3 md:p-6 flex flex-col gap-6 h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-white border border-slate-700 shadow-lg">
            <Settings className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Configuración del Sistema</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Administra hardware, seguridad y respaldos de base de datos
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4 text-emerald-400" />
            ¡Cambios guardados con éxito!
          </div>
        )}
      </div>

      <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800 gap-2 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'hardware' 
              ? 'bg-slate-800 text-white shadow-lg' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <Printer className="w-4 h-4" />
          Hardware e Impresora
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'security' 
              ? 'bg-slate-800 text-white shadow-lg' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          Seguridad
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'backup' 
              ? 'bg-slate-800 text-emerald-400 shadow-lg' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          Base de Datos & Respaldos
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
        
        {activeTab === 'hardware' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Restaurant Profile */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Store className="w-4 h-4 text-orange-400" />
                Datos para el Ticket
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    value={settings.restaurant_name || ''}
                    onChange={e => updateField('restaurant_name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">RFC / Identificador</label>
                  <input
                    type="text"
                    value={settings.tax_id || ''}
                    onChange={e => updateField('tax_id', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={settings.phone || ''}
                    onChange={e => updateField('phone', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Dirección</label>
                  <input
                    type="text"
                    value={settings.address || ''}
                    onChange={e => updateField('address', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mensaje al Pie del Ticket</label>
                  <input
                    type="text"
                    value={settings.ticket_footer || ''}
                    onChange={e => updateField('ticket_footer', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Thermal Printer Settings */}
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Printer className="w-4 h-4 text-orange-400" />
                Configuración de Impresora Térmica
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ancho de Papel</label>
                  <select
                    value={settings.paper_width || '80mm'}
                    onChange={e => updateField('paper_width', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="80mm">80mm (Estándar Restaurante)</option>
                    <option value="58mm">58mm (Ticketera Compacta)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo de Impresión</label>
                  <select
                    value={settings.printer_type || 'mock'}
                    onChange={e => updateField('printer_type', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="mock">Simulador Virtual en Pantalla</option>
                    <option value="network">Impresora de Red Ethernet / WiFi (ESC/POS)</option>
                  </select>
                </div>
                {settings.printer_type === 'network' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">IP de la Impresora de Red</label>
                    <input
                      type="text"
                      placeholder="Ej: 192.168.1.200"
                      value={settings.printer_ip || ''}
                      onChange={e => updateField('printer_ip', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}

                <div className="sm:col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer bg-slate-950/80 p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoPrint}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoPrint(val);
                        setAutoPrintEnabled(val);
                      }}
                      className="w-5 h-5 rounded text-orange-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-white">Impresión Automática (Manos Libres)</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Al enviar una comanda a cocina/barra o al cobrar una cuenta, se imprime de inmediato sin abrir la vista previa ni pedir confirmación manual.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" />
                PIN de Acceso Global
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                El PIN global se solicita al abrir la aplicación en cualquier dispositivo. Debe ser un número de 4 dígitos.
              </p>
              
              <div className="max-w-xs">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nuevo PIN (4 dígitos)</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={4}
                    value={settings.security_pin || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 4) updateField('security_pin', val);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-2xl tracking-widest text-white focus:outline-none focus:border-orange-500 text-center font-mono"
                    placeholder="****"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Info Banner on Railway Volume */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Persistencia en la Nube (Railway)
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SQLite
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Para que tu catálogo, productos y ventas <b>nunca se borren</b> al publicar cambios o hacer nuevos deploys en Railway, el backend ahora es compatible con <b>Railway Volumes</b>.
                </p>
                <div className="mt-2 text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-slate-300 font-mono">
                  Ruta de montaje recomendada en Railway: <span className="text-amber-400 font-bold">/app/data</span>
                </div>
              </div>
            </div>

            {restoreMessage && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                {restoreMessage} (Actualizando página...)
              </div>
            )}

            {/* Backup Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Descargar Copia */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Descargar Copia de Seguridad</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Descarga un archivo <code>.json</code> con todos tus productos, precios, fotos, categorías, modificadores, mesas y configuración.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isDownloading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Generando archivo...' : 'Descargar Respaldo JSON'}
                </button>
              </div>

              {/* Card 2: Restaurar Copia */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Restaurar Copia de Seguridad</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Carga un archivo de respaldo descargado previamente para restaurar al 100% tu catálogo y datos de forma inmediata.
                  </p>
                </div>
                <div>
                  <label className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    {isRestoring ? 'Restaurando...' : 'Seleccionar Archivo JSON y Restaurar'}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      disabled={isRestoring}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {activeTab !== 'backup' && (
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
