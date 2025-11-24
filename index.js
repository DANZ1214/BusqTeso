import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// CORRECCIÓN 1: Ajustar la ruta. 
// Si 'data' está en la misma carpeta que 'index.js', usa 'data'.
// Si está una carpeta atrás, usa '../data'. 
// Basado en tu imagen, parece estar al mismo nivel o dentro de la raíz del proyecto.
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const GROUP_SIZE = 10;

// Verificar que el directorio existe al iniciar
(async () => {
  try {
    await fs.access(DATA_DIR);
    console.log(`Directorio de datos confirmado: ${DATA_DIR}`);
  } catch (e) {
    console.error(`ADVERTENCIA: No se encuentra el directorio de datos en: ${DATA_DIR}`);
    // Opcional: crearlo si no existe
    // await fs.mkdir(DATA_DIR, { recursive: true });
  }
})();

// Utilidades
const readJson = async (file) => {
  try {
    const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.log(`Creando archivo nuevo o vacío para: ${file}`);
    return [];
  }
};

const writeJson = async (file, data) => {
  // CORRECCIÓN: 'file' ya debe ser solo el nombre del archivo, 'DATA_DIR' tiene la ruta
  await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

// Ayudantes
const getGrupoAbierto = (grupos) => grupos.find(g => !g.cerrado);
const getMaxGrupoId = (grupos) => grupos.length ? Math.max(...grupos.map(g => g.grupo_id)) : 0;

// Endpoint: grupo abierto
app.get('/api/grupo-abierto', async (req, res) => {
  const grupos = await readJson('grupos.json');
  const grupo = grupos.find(g => !g.cerrado);
  return res.json({ grupoId: grupo ? grupo.grupo_id : null });
});

// Endpoint: registrar persona y asigna ruta aleatoria
app.post('/api/registro', async (req, res) => {
  try {
    const { nombre, identificacion } = req.body;
    
    if (!nombre || !identificacion) {
      return res.status(400).json({ message: "Nombre e identidad son obligatorios" });
    }
    if (identificacion.length !== 13) {
      return res.status(400).json({ message: "La identidad debe tener 13 caracteres" });
    }

    const personas = await readJson('personas.json');
    const grupos = await readJson('grupos.json');

    if (personas.find(p => p.identificacion === identificacion)) {
      const grupoExistente = personas.find(p => p.identificacion === identificacion).grupo_id;
      return res.status(409).json({
        message: `Esta identidad ya está registrada en el grupo ${grupoExistente}`,
        grupoId: grupoExistente
      });
    }

    let grupoAbierto = grupos.find(g => !g.cerrado);
    let grupoId, numeroEnGrupo, rutaAsignada;

    // Rutas disponibles
    const rutasDisponibles = ["1", "2"];
    
    if (!grupoAbierto) {
      grupoId = getMaxGrupoId(grupos) + 1;
      rutaAsignada = rutasDisponibles[Math.floor(Math.random() * rutasDisponibles.length)];
      grupoAbierto = { grupo_id: grupoId, cerrado: false, ruta: rutaAsignada };
      grupos.push(grupoAbierto);
      numeroEnGrupo = 1;
    } else {
      grupoId = grupoAbierto.grupo_id;
      rutaAsignada = grupoAbierto.ruta;
      const personasEnGrupo = personas.filter(p => p.grupo_id === grupoId).length;
      
      if (personasEnGrupo >= GROUP_SIZE) {
        grupoAbierto.cerrado = true;
        // Crear nuevo grupo inmediatamente para el usuario actual
        grupoId += 1;
        rutaAsignada = rutasDisponibles[Math.floor(Math.random() * rutasDisponibles.length)];
        // Importante: No reusar la variable grupoAbierto anterior para el push
        const nuevoGrupo = { grupo_id: grupoId, cerrado: false, ruta: rutaAsignada };
        grupos.push(nuevoGrupo); 
        numeroEnGrupo = 1;
      } else {
        numeroEnGrupo = personasEnGrupo + 1;
      }
    }

    personas.push({
      id: personas.length > 0 ? Math.max(...personas.map(p => p.id || 0)) + 1 : 1,
      nombre,
      identificacion,
      grupo_id: grupoId,
      creado_en: new Date().toISOString()
    });

    // CORRECCIÓN 2: Eliminado el './data/' redundante. Solo pasar el nombre del archivo.
    await writeJson('personas.json', personas);
    await writeJson('grupos.json', grupos);

    return res.status(201).json({
      message: `Registro guardado correctamente. Eres la persona #${numeroEnGrupo} del grupo ${grupoId}.`,
      grupoId,
      numeroEnGrupo,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({ message: "Error interno del servidor al guardar datos." });
  }
});

// Endpoint: verificar ID
app.post('/api/verificar-id', async (req, res) => {
  try {
    const { identificacion } = req.body;
    const personas = await readJson('personas.json');
    const persona = personas.find(p => p.identificacion === identificacion);
    return res.json({ existe: !!persona, grupoId: persona?.grupo_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al verificar ID" });
  }
});

// Endpoint: cerrar grupo
app.post('/api/cerrar-grupo', async (req, res) => {
  try {
    const { grupoId } = req.body;
    if (!grupoId) return res.status(400).json({ message: "Falta grupoId" });
    const grupos = await readJson('grupos.json');
    const grupo = grupos.find(g => g.grupo_id === grupoId);
    if (!grupo) return res.status(404).json({ message: "Grupo no existe" });
    grupo.cerrado = true;
    await writeJson('grupos.json', grupos);
    res.json({ message: `Grupo ${grupoId} cerrado correctamente.` });
  } catch (error) {
    res.status(500).json({ message: "Error al cerrar grupo" });
  }
});

// Endpoint: Obtener adivinanza actual de grupo
app.get('/api/adivinanza/:grupoId', async (req, res) => {
  try {
    const grupoId = parseInt(req.params.grupoId, 10);
    const grupos = await readJson('grupos.json');
    const grupo = grupos.find(g => g.grupo_id === grupoId);
    if (!grupo) return res.status(404).json({ message: "Grupo no encontrado" });

    const progreso = await readJson('progreso_grupos.json');
    const adivinanzas = await readJson('adivinanzas.json');
    const ruta = grupo.ruta;

    let avance = progreso.find(p => p.grupo_id === grupoId && !p.completada && !p.eliminado);

    if (avance) {
      const adiv = adivinanzas.find(a => a.id === avance.adivinanza_id && a.ruta === ruta);
      if (!adiv) return res.status(500).json({message: "Error de integridad de datos: Adivinanza no encontrada"});

      let pista = null;
      if (avance.intentos === 2) pista = adiv.pista_3;
      if (avance.intentos === 6) pista = adiv.pista_7;
      return res.json({
        adivinanzaId: adiv.id,
        texto: adiv.texto,
        intentos: avance.intentos,
        pista,
        eliminado: avance.eliminado
      });
    }

    // Si no hay progreso, asigna la primera adivinanza de la ruta
    const adivinanzasRuta = adivinanzas.filter(a => a.ruta === ruta);
    if (!adivinanzasRuta.length) return res.status(404).json({ message: "No hay adivinanzas para esta ruta" });
    const primeraAdiv = adivinanzasRuta[0];

    const nuevoProgreso = { grupo_id: grupoId, adivinanza_id: primeraAdiv.id, intentos: 0, completada: false, eliminado: false };
    progreso.push(nuevoProgreso);
    await writeJson('progreso_grupos.json', progreso);

    return res.json({
      adivinanzaId: primeraAdiv.id,
      texto: primeraAdiv.texto,
      intentos: 0,
      pista: null,
      eliminado: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo adivinanza" });
  }
});

// Endpoint: Verificar respuesta y avanzar o eliminar grupo
app.post('/api/verificar-respuesta', async (req, res) => {
  try {
    const { grupoId, adivinanzaId, respuesta } = req.body;
    const progreso = await readJson('progreso_grupos.json');
    const adivinanzas = await readJson('adivinanzas.json');
    const grupos = await readJson('grupos.json');
    const grupo = grupos.find(g => g.grupo_id === grupoId);
    const ruta = grupo?.ruta;

    const avance = progreso.find(p => p.grupo_id === grupoId && p.adivinanza_id === adivinanzaId && !p.completada && !p.eliminado);
    if (!avance) return res.status(404).json({ message: "Sin progreso para este grupo/adivinanza" });

    const adivinanza = adivinanzas.find(a => a.id === adivinanzaId && a.ruta === ruta);
    if (!adivinanza) return res.status(404).json({ message: "Adivinanza no encontrada." });

    if (avance.eliminado) return res.status(403).json({ message: "El grupo ha sido eliminado", eliminado: true });

    let nuevosIntentos = avance.intentos + 1;

    if (respuesta.trim().toLowerCase() === adivinanza.respuesta_correcta.trim().toLowerCase()) {
      avance.intentos = nuevosIntentos;
      avance.completada = true;
      // Avanzar a la siguiente adivinanza de la ruta (si existe)
      const adivinanzasRuta = adivinanzas.filter(a => a.ruta === ruta);
      const ind = adivinanzasRuta.findIndex(a => a.id === adivinanzaId);
      let siguienteAdiv = null;
      if (ind !== -1 && ind + 1 < adivinanzasRuta.length) {
        siguienteAdiv = adivinanzasRuta[ind + 1];
        progreso.push({ grupo_id: grupoId, adivinanza_id: siguienteAdiv.id, intentos: 0, completada: false, eliminado: false });
      }
      await writeJson('progreso_grupos.json', progreso);
      return res.json({ correcto: true, intentos: nuevosIntentos, message: siguienteAdiv ? "¡Correcto! Siguiente adivinanza..." : "¡Correcto! Has terminado todas las adivinanzas de tu ruta." });
    }

    // Incorrecto
    if (nuevosIntentos >= 10) {
      avance.intentos = nuevosIntentos;
      avance.eliminado = true;
      await writeJson('progreso_grupos.json', progreso);
      return res.json({
        correcto: false,
        intentos: nuevosIntentos,
        eliminado: true,
        message: "Has agotado los 10 intentos. El grupo ha sido eliminado."
      });
    }

    avance.intentos = nuevosIntentos;
    await writeJson('progreso_grupos.json', progreso);

    let pista = null;
    if (nuevosIntentos === 3) pista = adivinanza.pista_3;
    if (nuevosIntentos === 7) pista = adivinanza.pista_7;
    res.json({
      correcto: false,
      intentos: nuevosIntentos,
      eliminado: false,
      pista,
      message: `Incorrecto. Te quedan ${10 - nuevosIntentos} intentos.`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error verificando respuesta" });
  }
});

export default app;
