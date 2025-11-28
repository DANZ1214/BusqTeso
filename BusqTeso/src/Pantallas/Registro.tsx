import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../PantallasCss/registro.css";

// Importaciones de Firebase
import { db } from "../firebase/firebaseConfig"; // Asegúrate que esta ruta sea correcta
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc,
  updateDoc,
  limit,
  orderBy 
} from "firebase/firestore";

const Registro = () => {
  const [nombre, setNombre] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grupoActivo, setGrupoActivo] = useState<number | null>(null);

  const navigate = useNavigate();

  // --- BUSCAR GRUPO ABIERTO ---
  const fetchGrupoActivo = async () => {
    try {
      const gruposRef = collection(db, "grupos");
      // Buscamos cualquier grupo que tenga cerrado == false
      const q = query(gruposRef, where("cerrado", "==", false), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const grupoData = snapshot.docs[0].data();
        setGrupoActivo(grupoData.grupoid);
      } else {
        setGrupoActivo(null);
      }
    } catch (err) {
      console.error("Error buscando grupo activo:", err);
      setGrupoActivo(null);
    }
  };

  useEffect(() => {
    fetchGrupoActivo();
  }, [mensaje]); // Recarga cuando hay un mensaje de éxito (ej. al cerrar grupo)


  // --- REGISTRO DE USUARIO ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      // 1. Buscar si ya existe un grupo abierto
      const gruposRef = collection(db, "grupos");
      const qAbierto = query(gruposRef, where("cerrado", "==", false), limit(1));
      const abiertoSnap = await getDocs(qAbierto);

      let elGrupoId = 0;

      if (abiertoSnap.empty) {
        // NO hay grupo abierto. Buscar cuál fue el último ID usado para sumar +1.
        const qUltimo = query(gruposRef, orderBy("grupoid", "desc"), limit(1));
        const ultimoSnap = await getDocs(qUltimo);
        
        if (!ultimoSnap.empty) {
          elGrupoId = ultimoSnap.docs[0].data().grupoid + 1;
        } else {
          elGrupoId = 0; // Es el primer grupo de la historia
        }

        // Crear el nuevo grupo
        await addDoc(collection(db, "grupos"), {
          cerrado: false,
          grupoid: elGrupoId
        });
      } else {
        // SÍ hay grupo abierto, usamos ese
        elGrupoId = abiertoSnap.docs[0].data().grupoid;
      }

      // 2. Verificar si la persona ya existe (opcional, por seguridad)
      const personasRef = collection(db, "personas");
      const qExiste = query(personasRef, where("identidad", "==", identificacion));
      const existeSnap = await getDocs(qExiste);
      
      if (!existeSnap.empty) {
        throw new Error("Este ID ya está registrado.");
      }

      // 3. Calcular ID interno (número en el grupo)
      const qPersonasGrupo = query(personasRef, where("grupoid", "==", `/coleccion/grupos/id/${elGrupoId}`));
      const personasSnap = await getDocs(qPersonasGrupo);
      const numeroEnGrupo = personasSnap.size;

      // 4. Guardar la persona
      await addDoc(personasRef, {
        nombre: nombre,
        identidad: identificacion,
        grupoid: `/coleccion/grupos/id/${elGrupoId}`,
        id: numeroEnGrupo
      });

      setMensaje("Registrado correctamente");
      setGrupoActivo(elGrupoId);
      setNombre("");
      setIdentificacion("");
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al registrar. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };


  // --- INGRESAR (Verificar ID) ---
  const handleIngresar = async () => {
    if (!identificacion || identificacion.length !== 13) {
      setError("Por favor ingresa un ID válido de 13 caracteres.");
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      const personasRef = collection(db, "personas");
      const q = query(personasRef, where("identidad", "==", identificacion));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        // Extraer el número de grupo del string "/coleccion/grupos/id/X"
        // Si el string es complejo, usamos split.
        const partes = (data.grupoid || "").split("/");
        const grupoIdNum = parseInt(partes[partes.length - 1]) || 0;

        navigate("/adivinanzas", { state: { identificacion, grupoId: grupoIdNum } });
      } else {
        setError("El ID no está registrado. Por favor regístrate primero.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error inesperado al verificar ID.");
    } finally {
      setLoading(false);
    }
  };


  // --- CERRAR GRUPO ---
  const handleCerrarGrupo = async () => {
    if (grupoActivo === null) {
      setError("No hay grupo activo para cerrar.");
      return;
    }

    setLoading(true);
    setMensaje(null);
    setError(null);

    try {
      // Buscar el documento del grupo activo para obtener su ID de documento (doc.id)
      const gruposRef = collection(db, "grupos");
      const q = query(gruposRef, where("grupoid", "==", grupoActivo), limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        // Actualizar estado a cerrado: true
        await updateDoc(docRef, {
          cerrado: true
        });
        
        setMensaje(`Grupo #${grupoActivo} cerrado correctamente.`);
        setGrupoActivo(null); // Ya no hay grupo activo visible hasta que alguien cree el siguiente
      } else {
        setError("No se encontró el grupo en la base de datos.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error al cerrar el grupo.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="registro-page">
      <div className="registro-card">
        <h1 className="registro-title">Registro de Personas</h1>
        <p className="registro-subtitle">
          {grupoActivo !== null
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
              placeholder="Ej. 1234567890123"
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
