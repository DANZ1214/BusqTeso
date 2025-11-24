import { Routes, Route } from 'react-router-dom';
import Registro from './Pantallas/Registro';
import Adivinanzas from './Pantallas/adivinanzas';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Registro />} />
      <Route path="/adivinanzas" element={<Adivinanzas />} />
    </Routes>
  );
}

export default App;
