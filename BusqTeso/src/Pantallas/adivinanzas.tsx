import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../PantallasCss/adivinanzas.css';

interface AdivinanzaData {
  adivinanzaId: number;
  texto: string;
  intentos: number;
  pista: string | null;
  eliminado: boolean;
}

interface RespuestaData {
  correcto: boolean;
  intentos: number;
  eliminado: boolean;
  pista?: string | null;
  message: string;
}

const Adivinanzas = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { identificacion, grupoId } = location.state || {};

  const [adivinanza, setAdivinanza] = useState<AdivinanzaData | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!grupoId) {
      navigate('/');
      return;
    }
    cargarAdivinanza();
  }, [grupoId]);

  const cargarAdivinanza = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/adivinanza/${grupoId}`);
      const data: AdivinanzaData = await res.json();
      if (data.eliminado) {
        setError('Tu grupo ha sido eliminado por agotar los intentos.');
        return;
      }
      setAdivinanza(data);
    } catch (err) {
      setError('Error al cargar la adivinanza');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respuesta.trim() || !adivinanza) return;

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      const res = await fetch('http://localhost:3001/api/verificar-respuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupoId,
          adivinanzaId: adivinanza.adivinanzaId,
          respuesta
        })
      });

      const data: RespuestaData = await res.json();

      if (data.correcto) {
        setMensaje(data.message);
        setRespuesta('');
        setTimeout(() => cargarAdivinanza(), 2000);
      } else if (data.eliminado) {
        setError(data.message);
        setAdivinanza(null);
      } else {
        setError(data.message);
        setAdivinanza(prev => prev ? { ...prev, intentos: data.intentos, pista: data.pista || prev.pista } : null);
        setRespuesta('');
      }
    } catch (err) {
      setError('Error al enviar respuesta');
    } finally {
      setLoading(false);
    }
  };

  if (!grupoId) return null;

  return (
    <div className="adivinanzas-page">
      <div className="adivinanzas-card">
        <h1 className="adivinanzas-title">Búsqueda del Tesoro</h1>
        <p className="adivinanzas-subtitle">Grupo #{grupoId} - ID: {identificacion}</p>

        {adivinanza && !adivinanza.eliminado && (
          <>
            <div className="adivinanza-texto">
              <p>{adivinanza.texto}</p>
            </div>

            <div className="intentos-info">
              <p>Intentos: {adivinanza.intentos} / 10</p>
              {adivinanza.pista && (
                <div className="pista-box">
                  <strong>💡 Pista:</strong> {adivinanza.pista}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="respuesta-form">
              <label className="respuesta-label">
                Tu respuesta:
                <input
                  type="text"
                  className="respuesta-input"
                  value={respuesta}
                  onChange={e => setRespuesta(e.target.value)}
                  placeholder="Escribe tu respuesta aquí"
                  disabled={loading}
                  required
                />
              </label>
              <button type="submit" className="respuesta-button" disabled={loading}>
                {loading ? 'Verificando...' : 'Enviar Respuesta'}
              </button>
            </form>
          </>
        )}

        {mensaje && <p className="mensaje exito">{mensaje}</p>}
        {error && <p className="mensaje error">{error}</p>}
      </div>
    </div>
  );
};

export default Adivinanzas;
