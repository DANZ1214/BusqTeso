import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../PantallasCss/registro.css";

interface RegistroResponse {
  message: string;
  grupoId?: number;
  numeroEnGrupo?: number;
}

interface VerificarResponse {
  existe: boolean;
  grupoId?: number;
  message?: string;
}

const Registro = () => {
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grupoActivo, setGrupoActivo] = useState<number | null>(null);
  
  const navigate = useNavigate();

  // Consulta grupo abierto cada vez que mensaje cambia
  const fetchGrupoActivo = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/grupo-abierto");
      const data = await res.json();
      if (data.grupoId) {
        setGrupoActivo(data.grupoId);
      } else {
        setGrupoActivo(null);
      }
    } catch {
      setGrupoActivo(null);
    }
  };

  useEffect(() => {
    fetchGrupoActivo();
  }, [mensaje]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      const response = await fetch("http://localhost:3001/api/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, identificacion }),
      });

      const data: RegistroResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al registrar. Inténtalo de nuevo.");
      }

      setMensaje(data.message);
      setGrupoActivo(data.grupoId ?? null);
      setNombre("");
      setIdentificacion("");
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleIngresar = async () => {
    if (!identificacion || identificacion.length !== 13) {
      setError("Por favor ingresa un ID válido de 13 caracteres.");
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      const response = await fetch("http://localhost:3001/api/verificar-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificacion }),
      });

      const data: VerificarResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al verificar ID.");
      }

      if (data.existe) {
        // Redirige a adivinanzas
        navigate("/adivinanzas", { state: { identificacion, grupoId: data.grupoId } });
      } else {
        setError("El ID no está registrado. Por favor regístrate primero.");
      }
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleCerrarGrupo = async () => {
    if (!grupoActivo) {
      setError("No hay grupo activo para cerrar.");
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      const response = await fetch("http://localhost:3001/api/cerrar-grupo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grupoId: grupoActivo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al cerrar grupo.");
      }

      setMensaje(data.message);
      setGrupoActivo(null);
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registro-page">
      <div className="registro-card">
        <h1 className="registro-title">Registro de Personas</h1>
        <p className="registro-subtitle">
          {grupoActivo
            ? `Ingresa tu nombre e ID para el grupo actual (#${grupoActivo}).`
            : "Ingresa tu nombre e ID para abrir el siguiente grupo."}
        </p>

        <form className="registro-form" onSubmit={handleSubmit}>
          <label className="registro-label">
            Nombre
            <input
              type="text"
              className="registro-input"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
              required
              disabled={loading}
            />
          </label>
          <label className="registro-label">
            ID
            <input
              type="text"
              className="registro-input"
              value={identificacion}
              onChange={e => setIdentificacion(e.target.value)}
              placeholder="Ej. 123456"
              required
              disabled={loading}
            />
          </label>

          <button
            type="submit"
            className="registro-button"
            disabled={loading}
          >
            {loading ? "Guardando..." : "Registrarse"}
          </button>
        </form>

        <button
          className="registro-button ingresar-button"
          onClick={handleIngresar}
          disabled={loading}
          style={{
            marginTop: "1rem",
            background: "#2563eb",
            color: "#fff"
          }}
        >
          {loading ? "Verificando..." : "Ingresar"}
        </button>

        <button
          className="registro-button cerrar-grupo-button"
          onClick={handleCerrarGrupo}
          disabled={loading || grupoActivo === null}
          style={{
            marginTop: "1rem",
            background: "linear-gradient(90deg,#d2691e,#dc143c)",
            color: "#fff"
          }}
        >
          {loading ? "Procesando..." : "Cerrar grupo actual"}
        </button>

        {mensaje && <p className="registro-mensaje exito">{mensaje}</p>}
        {error && <p className="registro-mensaje error">{error}</p>}
      </div>
    </div>
  );
};

export default Registro;
