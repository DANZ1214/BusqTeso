import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig"; // Asegúrate de la ruta correcta
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  limit,
  getDoc 
} from "firebase/firestore";
import "../PantallasCss/adivinanzas.css";

interface AdivinanzaData {
  id: number;
  texto: string;
  intentos: number;
  pista: string | null; // Pista actual para mostrar (depende de los intentos)
  eliminado: boolean;
  ganador?: boolean; // Flag local para saber si ganaron
}

const Adivinanzas = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Recibimos identificacion y grupoIdNum (número entero)
  const { identificacion, grupoId } = location.state || {};

  const [adivinanza, setAdivinanza] = useState<AdivinanzaData | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esGanador, setEsGanador] = useState(false);

  // Referencias a colecciones
  const progresoRef = collection(db, "progresogrupos");
  const adivinanzasRef = collection(db, "adivinanzas");

  useEffect(() => {
    if (grupoId === undefined || grupoId === null) {
      navigate("/");
      return;
    }
    inicializarJuego();
    // eslint-disable-next-line
  }, [grupoId]);

  const inicializarJuego = async () => {
    setLoading(true);
    try {
      // 1. Buscar progreso del grupo
      // El campo grupoid en progresogrupos es string: "/coleccion/grupos/id/X"
      const qProgreso = query(
        progresoRef, 
        where("grupoid", "==", `/coleccion/grupos/id/${grupoId}`),
        limit(1)
      );
      const progresoSnap = await getDocs(qProgreso);

      let docProgreso;
      let dataProgreso;

      if (progresoSnap.empty) {
        // Si NO existe progreso, asignamos ruta aleatoria (1 o 2) y creamos el registro inicial
        // Ruta aleatoria: 1 o 2
        const rutaAsignada = Math.random() < 0.5 ? 1 : 2;
        
        // La primera adivinanza es la #1
        // El formato del adivinanzaid inicial será "/coleccion/adivinanzas/id/1" (o como lo uses para vincular)
        // Pero para simplificar búsqueda usaremos campos numéricos 'ruta' e 'id' en la colección adivinanzas.
        
        const nuevoProgreso = {
          grupoid: `/coleccion/grupos/id/${grupoId}`,
          adivinanzaNumero: 1, // Número de la adivinanza actual (1 al 10)
          ruta: rutaAsignada,
          intentos: 0,
          completada: false,
          eliminados: false
        };

        const ref = await addDoc(progresoRef, nuevoProgreso);
        // Leemos lo que acabamos de crear (para tener la referencia)
        const snapNuevo = await getDoc(ref);
        docProgreso = snapNuevo;
        dataProgreso = snapNuevo.data();
      } else {
        // Ya existe, cargamos datos
        docProgreso = progresoSnap.docs[0];
        dataProgreso = docProgreso.data();
      }

      // 2. Verificar estado del grupo
      if (dataProgreso?.eliminados) {
        setError("Tu grupo ha sido eliminado por agotar los intentos.");
        setAdivinanza({
          id: 0, texto: "", intentos: 10, pista: null, eliminado: true
        });
        setLoading(false);
        return;
      }

      // Verificar si ya completaron todo (si adivinanzaNumero > 10)
      if (dataProgreso?.adivinanzaNumero > 10) {
        setEsGanador(true);
        setLoading(false);
        return;
      }

      // 3. Cargar la adivinanza correspondiente a su RUTA y NÚMERO actual
      await cargarDatosAdivinanza(dataProgreso?.ruta, dataProgreso?.adivinanzaNumero, dataProgreso?.intentos);

    } catch (err) {
      console.error(err);
      setError("Error al cargar el juego.");
    } finally {
      setLoading(false);
    }
  };

  const cargarDatosAdivinanza = async (ruta: number, numero: number, intentosActuales: number) => {
    // Buscar en colección 'adivinanzas' donde ruta == X y id == Y
    // OJO: En tu imagen veo que el documento tiene campos 'ruta' e 'id'.
    const qAdiv = query(
      adivinanzasRef, 
      where("ruta", "==", ruta),
      where("id", "==", numero),
      limit(1)
    );
    const adivSnap = await getDocs(qAdiv);

    if (!adivSnap.empty) {
      const dataAdiv = adivSnap.docs[0].data();
      
      // Determinar qué pista mostrar según intentos
      let pistaAMostrar = null;
      if (intentosActuales >= 3) pistaAMostrar = dataAdiv.pista3 || null;
      if (intentosActuales >= 7) pistaAMostrar = dataAdiv.pista7 || null;

      setAdivinanza({
        id: numero,
        texto: dataAdiv.texto,
        intentos: intentosActuales,
        pista: pistaAMostrar,
        eliminado: false
      });
    } else {
      setError("No se encontró la adivinanza. Contacta al administrador.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respuesta.trim()) return;
    
    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      // 1. Recuperar documento de progreso
      const qProgreso = query(
        progresoRef, 
        where("grupoid", "==", `/coleccion/grupos/id/${grupoId}`),
        limit(1)
      );
      const progresoSnap = await getDocs(qProgreso);
      
      if (progresoSnap.empty) {
        setError("Error crítico: No se encuentra progreso del grupo.");
        setLoading(false);
        return;
      }

      const docProgreso = progresoSnap.docs[0];
      const dataProgreso = docProgreso.data();
      const intentosAnt = dataProgreso.intentos || 0;
      const ruta = dataProgreso.ruta;
      const numAdivinanza = dataProgreso.adivinanzaNumero;

      // 2. Recuperar la respuesta correcta de la adivinanza actual
      const qAdiv = query(
        adivinanzasRef, 
        where("ruta", "==", ruta),
        where("id", "==", numAdivinanza),
        limit(1)
      );
      const adivSnap = await getDocs(qAdiv);
      if (adivSnap.empty) {
        setError("Error buscando adivinanza.");
        setLoading(false);
        return;
      }
      const dataAdiv = adivSnap.docs[0].data();
      const respuestaCorrectaDB = dataAdiv.respcorrecta || "";

      // Normalizar respuestas para comparar (minúsculas, sin tildes, trim)
      const respUsuario = respuesta.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const respCorrecta = respuestaCorrectaDB.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      if (respUsuario === respCorrecta) {
        // --- RESPUESTA CORRECTA ---
        setMensaje("¡Correcto! Pasando a la siguiente...");
        
        // Actualizar progreso: intentos a 0, adivinanzaNumero + 1
        const nuevoNumero = numAdivinanza + 1;
        await updateDoc(docProgreso.ref, {
          intentos: 0,
          adivinanzaNumero: nuevoNumero,
          // Si quieres guardar historial de completadas, podrías hacerlo aquí
        });

        if (nuevoNumero > 10) {
          // GANARON
          setEsGanador(true);
        } else {
          // Cargar siguiente tras breve pausa
          setTimeout(() => {
            setRespuesta("");
            setMensaje(null);
            cargarDatosAdivinanza(ruta, nuevoNumero, 0);
          }, 2000);
        }

      } else {
        // --- RESPUESTA INCORRECTA ---
        const nuevosIntentos = intentosAnt + 1;
        
        if (nuevosIntentos >= 10) {
          // ELIMINADO
          await updateDoc(docProgreso.ref, {
            intentos: nuevosIntentos,
            eliminados: true
          });
          setError("Respuesta incorrecta. Has alcanzado el límite de 10 intentos. El grupo está eliminado.");
          setAdivinanza(prev => prev ? { ...prev, intentos: 10, eliminado: true } : null);
        } else {
          // Sumar intento
          await updateDoc(docProgreso.ref, {
            intentos: nuevosIntentos
          });
          
          let mensajeError = "Respuesta incorrecta. Sigue intentando.";
          
          // Actualizar vista (pistas)
          // Volvemos a cargar datos para refrescar pistas si corresponde
          await cargarDatosAdivinanza(ruta, numAdivinanza, nuevosIntentos);
          
          setError(mensajeError);
          setRespuesta("");
        }
      }

    } catch (err) {
      console.error(err);
      setError("Error al verificar respuesta.");
    } finally {
      setLoading(false);
    }
  };

  if (!grupoId) return null;

  // --- PANTALLA DE GANADOR ---
  if (esGanador) {
    return (
      <div className="adivinanzas-page ganador-container">
        <div className="tesoro-animacion">
          {/* Aquí podrías poner un GIF o CSS de cofre abriéndose */}
          <div className="cofre-abierto">💎💰👑</div> 
        </div>
        <h1 className="titulo-ganador">¡FELICIDADES!</h1>
        <p className="texto-ganador">
          Han completado la ruta asignada y encontrado el tesoro.
        </p>
        <p className="info-grupo">Grupo #{grupoId}</p>
        <button className="boton-inicio" onClick={() => navigate("/")}>
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="adivinanzas-page">
      <div className="adivinanzas-card">
        <h1 className="adivinanzas-title">Búsqueda del Tesoro</h1>
        <p className="adivinanzas-subtitle">Grupo #{grupoId} - ID: {identificacion}</p>

        {adivinanza && !adivinanza.eliminado ? (
          <>
            <div className="progreso-badge">
              Adivinanza {adivinanza.id} / 10
            </div>

            <div className="adivinanza-texto">
              <p>{adivinanza.texto}</p>
            </div>

            <div className="intentos-info">
              <p>Intentos fallidos: {adivinanza.intentos} / 10</p>
              
              {/* Barra de progreso de intentos (opcional) */}
              <div className="barra-intentos">
                <div 
                  className="barra-relleno" 
                  style={{ width: `${(adivinanza.intentos / 10) * 100}%`, background: adivinanza.intentos > 7 ? 'red' : '#2563eb' }}
                ></div>
              </div>

              {adivinanza.pista && (
                <div className="pista-box">
                  <strong>💡 Pista desbloqueada:</strong> {adivinanza.pista}
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
                  autoComplete="off"
                  required
                />
              </label>
              <button type="submit" className="respuesta-button" disabled={loading}>
                {loading ? 'Verificando...' : 'Enviar Respuesta'}
              </button>
            </form>
          </>
        ) : null}

        {/* Mensaje cuando están eliminados */}
        {adivinanza && adivinanza.eliminado && (
          <div className="eliminado-box">
            <h2>🚫 GRUPO ELIMINADO</h2>
            <p>Han excedido el número máximo de intentos.</p>
            <button className="boton-salir" onClick={() => navigate("/")}>Salir</button>
          </div>
        )}

        {mensaje && <p className="mensaje exito">{mensaje}</p>}
        {error && !adivinanza?.eliminado && <p className="mensaje error">{error}</p>}
      </div>
    </div>
  );
};

export default Adivinanzas;
