import { useState, useEffect, useCallback } from "react";

interface Model {
  id: number;
  name: string;
  line: string;
  surface: number;
  cost: number;
}

interface Aporte {
  id: string;
  fecha: string;
  monto: number;
  m2: number;
  email: string;
}

interface Config {
  valuePerM2: number;
}

const ADMIN_USERS = [
  "adrianjmartini@gmail.com",
  "gruponoa.info@gmail.com"
];

function App() {
  const [wallet, setWallet] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [view, setView] = useState<'home' | 'wallet' | 'admin'>('home');
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [config, setConfig] = useState<Config>({ valuePerM2: 1444630 });
  const [newM2Value, setNewM2Value] = useState<string>('');

  const auth = window.firebaseAuth;
  const db = window.firebaseDB;

  const initialModels: Model[] = [
    { id: 1, name: "Loft – SMALL", line: "SMALL", surface: 45, cost: 65008350 },
    { id: 2, name: "1 Dormitorio – SMALL", line: "SMALL", surface: 53, cost: 76563390 },
    { id: 3, name: "1 Dormitorio – JOVEN", line: "JOVEN", surface: 61, cost: 88122430 },
    { id: 4, name: "2 Dormitorios – JOVEN", line: "JOVEN", surface: 75, cost: 108347250 },
    { id: 5, name: "2 Dormitorios – FAMILIAR", line: "FAMILIAR", surface: 86, cost: 124233180 },
    { id: 6, name: "3 Dormitorios – FAMILIAR", line: "FAMILIAR", surface: 95, cost: 137239850 },
    { id: 7, name: "3 Dormitorios en Suite – FAMILIAR", line: "FAMILIAR", surface: 110, cost: 158909300 },
    { id: 8, name: "2 Dormitorios – DUPLEX", line: "DUPLEX", surface: 103, cost: 148792890 },
    { id: 9, name: "3 Dormitorios – DUPLEX", line: "DUPLEX", surface: 132, cost: 190692960 },
    { id: 10, name: "3 Dormitorios en Suite – DUPLEX", line: "DUPLEX", surface: 153, cost: 221030390 }
  ];

  const [models, setModels] = useState<Model[]>(initialModels);

  const calculateModels = useCallback((valuePerM2: number) => {
    return initialModels.map(model => ({
      ...model,
      cost: Math.round(model.surface * valuePerM2)
    }));
  }, []);

  useEffect(() => {
    const unsubscribe = window.onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoading(true);
        setError(null);
        const email = user.email || '';
        setUserEmail(email);
        setIsAdmin(ADMIN_USERS.includes(email));

        try {
          const configDoc = await window.getDoc(window.doc(db, 'config', 'general'));
          if (configDoc.exists()) {
            const configData = configDoc.data() as Config;
            setConfig(configData);
            setModels(calculateModels(configData.valuePerM2));
          }

          const aporteSnap = await window.getDocs(window.collection(db, 'aportes'));
          const userAportes = aporteSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Aporte))
            .filter(a => a.email === email);
          setAportes(userAportes);
          
          const totalM2 = userAportes.reduce((acc, a) => acc + a.m2, 0);
          setWallet(totalM2);

          const modelDoc = await window.getDoc(window.doc(db, 'modelos', email));
          if (modelDoc.exists()) {
            const saved = modelDoc.data();
            const model = calculateModels(config.valuePerM2).find(m => m.id === saved.modelId);
            if (model) setSelectedModel(model);
          }
        } catch (err) {
          setError('Error al cargar datos. Por favor recarga la página.');
          console.error('Error al cargar datos:', err);
        } finally {
          setLoading(false);
        }
      }
    });
    
    return () => unsubscribe();
  }, [calculateModels]);

  useEffect(() => {
    if (selectedModel) {
      const m2ToBuild = selectedModel.surface * 0.6;
      setShowNotification(wallet >= m2ToBuild);
    }
  }, [wallet, selectedModel]);

  const handleAporte = useCallback(async () => {
    if (amount <= 0) {
      setError('El monto debe ser mayor a cero');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const m2Comprados = amount / config.valuePerM2;
      const nuevoAporte: Omit<Aporte, 'id'> = {
        fecha: new Date().toLocaleDateString(),
        monto: amount,
        m2: m2Comprados,
        email: userEmail
      };
      
      const docRef = await window.addDoc(window.collection(db, 'aportes'), nuevoAporte);
      
      setWallet(prev => prev + m2Comprados);
      setAportes(prev => [{ id: docRef.id, ...nuevoAporte }, ...prev]);
      setAmount(0);
    } catch (err) {
      setError('Error al guardar el aporte. Intenta nuevamente.');
      console.error('Error al guardar aporte:', err);
    } finally {
      setLoading(false);
    }
  }, [amount, config.valuePerM2, userEmail]);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await window.signOut(auth);
      setUserEmail('');
      setAportes([]);
      setWallet(0);
      setSelectedModel(null);
      setView('home');
    } catch (err) {
      setError('Error al cerrar sesión. Intenta nuevamente.');
      console.error('Error al cerrar sesión:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelectModel = useCallback(async (model: Model) => {
    setLoading(true);
    setError(null);
    try {
      setSelectedModel(model);
      await window.setDoc(window.doc(db, 'modelos', userEmail), { 
        modelId: model.id,
        lastUpdated: new Date().toISOString() 
      });
    } catch (err) {
      setError('Error al guardar la selección. Intenta nuevamente.');
      console.error('Error al guardar modelo:', err);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  const exportToPDF = useCallback(() => {
    if (!selectedModel) return;

    setLoading(true);
    try {
      const jsPDF = window.jspdf.jsPDF;
      const doc = new jsPDF();
      let y = 10;

      const logo = new Image();
      logo.src = 'https://i.ibb.co/fYk575cp/logo-JAUS.png';
      logo.onload = () => {
        doc.addImage(logo, 'PNG', 150, 5, 40, 15);
        
        doc.setFontSize(16);
        doc.text('Resumen de Mi Billetera - JAUS', 10, y);
        y += 15;

        doc.setFontSize(12);
        doc.text(`Vivienda seleccionada: ${selectedModel.name}`, 10, y); y += 8;
        doc.text(`Línea: ${selectedModel.line}`, 10, y); y += 8;
        doc.text(`Superficie: ${selectedModel.surface} m²`, 10, y); y += 8;
        doc.text(`Valor m² actual: $${config.valuePerM2.toLocaleString()}`, 10, y); y += 8;
        doc.text(`M² acumulados: ${wallet.toFixed(2)} m²`, 10, y); y += 8;
        
        const m2ParaConstruir = selectedModel.surface * 0.6;
        const m2RestantesConstruccion = Math.max(0, m2ParaConstruir - wallet);
        doc.text(`M² para pedir construcción (60%): ${m2ParaConstruir.toFixed(2)} m²`, 10, y); y += 8;
        doc.text(`M² restantes para pedir construcción: ${m2RestantesConstruccion.toFixed(2)} m²`, 10, y); y += 8;
        
        doc.text(`M² restantes para completar: ${Math.max(0, selectedModel.surface - wallet).toFixed(2)} m²`, 10, y); y += 10;

        doc.text('Historial de aportes:', 10, y); y += 8;
        aportes.forEach((a) => {
          doc.text(`${a.fecha}: $${a.monto.toLocaleString()} = ${a.m2.toFixed(2)} m²`, 10, y);
          y += 7;
          if (y > 270) { doc.addPage(); y = 10; }
        });

        doc.save('mi_billetera_jaus.pdf');
        setLoading(false);
      };

      logo.onerror = () => {
        setLoading(false);
      };
    } catch (err) {
      setError('Error al generar el PDF. Intenta nuevamente.');
      console.error('Error al generar PDF:', err);
      setLoading(false);
    }
  }, [selectedModel, wallet, aportes, config.valuePerM2]);

  const updateM2Value = useCallback(async () => {
    if (!isAdmin) return;
    
    const newValue = parseFloat(newM2Value);
    if (isNaN(newValue)) {
      setError('Ingrese un valor numérico válido');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      await window.setDoc(window.doc(db, 'config', 'general'), {
        valuePerM2: newValue
      }, { merge: true });

      setConfig({ valuePerM2: newValue });
      setModels(calculateModels(newValue));
      setNewM2Value('');
      
      if (selectedModel) {
        const updatedModel = calculateModels(newValue).find(m => m.id === selectedModel.id);
        if (updatedModel) setSelectedModel(updatedModel);
      }
    } catch (err) {
      setError('Error al actualizar el valor. Intenta nuevamente.');
      console.error('Error al actualizar valor m2:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, newM2Value, selectedModel, calculateModels]);

  const styles = {
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '1.5rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid #e5e7eb'
    },
    logo: {
      height: '60px',
      marginRight: '1rem'
    },
    button: {
      padding: '0.5rem 1rem',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      margin: '0.5rem'
    },
    input: {
      padding: '0.5rem',
      margin: '0.5rem 0',
      width: '100%',
      borderRadius: '4px',
      border: '1px solid #ccc'
    },
    card: {
      border: '1px solid #ccc',
      padding: '1rem',
      borderRadius: '12px',
      margin: '0.5rem',
      backgroundColor: '#fff'
    },
    notification: {
      background: '#dcfce7',
      color: '#166534',
      padding: '1rem',
      borderRadius: '8px',
      margin: '1rem 0'
    },
    error: {
      background: '#fee2e2',
      color: '#b91c1c',
      padding: '1rem',
      borderRadius: '8px',
      margin: '1rem 0'
    },
    adminPanel: {
      background: '#f0f9ff',
      padding: '1rem',
      borderRadius: '8px',
      margin: '1rem 0',
      border: '1px solid #bae6fd'
    }
  };

  if (!userEmail) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px', margin: 'auto' }}>
        <h2>{authMode === 'login' ? 'Iniciar sesión' : 'Registrarse'}</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            const email = (e.currentTarget.email as HTMLInputElement).value;
            const password = (e.currentTarget.password as HTMLInputElement).value;
            try {
              if (authMode === 'login') {
                await window.signInWithEmailAndPassword(auth, email, password);
              } else {
                await window.createUserWithEmailAndPassword(auth, email, password);
              }
            } catch (err) {
              setError('Error: ' + (err as any).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <input 
            name="email" 
            type="email" 
            placeholder="Correo" 
            style={styles.input} 
            required 
            disabled={loading}
          />
          <input 
            name="password" 
            type="password" 
            placeholder="Contraseña" 
            style={styles.input} 
            required 
            disabled={loading}
          />
          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Cargando...' : authMode === 'login' ? 'Entrar' : 'Registrarse'}
          </button>
        </form>
        <p style={{ marginTop: '1rem' }}>
          {authMode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
            style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
            disabled={loading}
          >
            {authMode === 'login' ? 'Registrate' : 'Iniciá sesión'}
          </button>
        </p>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: 'auto' }}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src="https://i.ibb.co/fYk575cp/logo-JAUS.png" 
              alt="Logo JAUS" 
              style={styles.logo}
            />
            <h1 style={{ color: '#00B7FF' }}>Panel de Administración</h1>
          </div>
          <button 
            onClick={() => setView('home')} 
            style={styles.button}
            disabled={loading}
          >
            ⬅ Volver al inicio
          </button>
        </div>
        
        {loading && <p>Cargando...</p>}
        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.adminPanel}>
          <h2>Configuración del Valor m²</h2>
          <p>Valor actual: <strong>${config.valuePerM2.toLocaleString()}</strong></p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <input
              type="number"
              value={newM2Value}
              onChange={(e) => setNewM2Value(e.target.value)}
              placeholder="Nuevo valor del m²"
              style={styles.input}
              disabled={loading}
            />
            <button 
              onClick={updateM2Value}
              style={{ ...styles.button, background: '#10b981' }}
              disabled={loading || !newM2Value}
            >
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          <p style={{ marginTop: '1rem', color: '#64748b' }}>
            Al actualizar este valor, se recalcularán automáticamente los precios de todas las viviendas.
          </p>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Viviendas con nuevo valor</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {models.map((model) => (
              <div key={model.id} style={styles.card}>
                <h3>{model.name}</h3>
                <p>Superficie: {model.surface} m²</p>
                <p>Precio total: <strong>${model.cost.toLocaleString()}</strong></p>
                <p>Valor m²: ${Math.round(model.cost / model.surface).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'wallet') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: 'auto' }}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img 
              src="https://i.ibb.co/fYk575cp/logo-JAUS.png" 
              alt="Logo JAUS" 
              style={styles.logo}
            />
            <h1 style={{ color: '#00B7FF' }}>Mi Billetera</h1>
          </div>
          <button 
            onClick={() => setView('home')} 
            style={styles.button}
            disabled={loading}
          >
            ⬅ Volver
          </button>
        </div>
        
        {loading && <p>Cargando...</p>}
        {error && <div style={styles.error}>{error}</div>}

        {selectedModel ? (
          <>
            <button 
              onClick={exportToPDF} 
              style={styles.button}
              disabled={loading}
            >
              📄 Exportar a PDF
            </button>
            
            <h2>{selectedModel.name}</h2>
            <p>Valor m² actual: ${config.valuePerM2.toLocaleString()}</p>
            <p>M² acumulados: {wallet.toFixed(2)} m²</p>
            
            <p>M² para pedir construcción (60%): {(selectedModel.surface * 0.6).toFixed(2)} m²</p>
            <p>M² restantes para pedir construcción: {Math.max(0, (selectedModel.surface * 0.6) - wallet).toFixed(2)} m²</p>
            
            <p>M² restantes para completar: {Math.max(0, selectedModel.surface - wallet).toFixed(2)} m²</p>

            <div style={{ marginTop: '1rem' }}>
              <p>Progreso total ({((wallet / selectedModel.surface) * 100).toFixed(1)}%)</p>
              <div style={{ height: '20px', background: '#e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, (wallet / selectedModel.surface) * 100)}%`, 
                  background: '#3b82f6', 
                  height: '100%' 
                }} />
              </div>

              <p style={{ marginTop: '1rem' }}>Progreso para construcción ({((wallet / (selectedModel.surface * 0.6)) * 100).toFixed(1)}%)</p>
              <div style={{ height: '20px', background: '#f3f4f6', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(100, (wallet / (selectedModel.surface * 0.6)) * 100)}%`, 
                  background: '#10b981', 
                  height: '100%' 
                }} />
              </div>
            </div>

            {showNotification && (
              <div style={styles.notification}>
                🎉 ¡Felicitaciones! Alcanzaste el 60% necesario para iniciar la construcción de tu vivienda.
              </div>
            )}

            <div style={{ marginTop: '2rem' }}>
              <h3>📊 Historial de aportes</h3>
              {aportes.length === 0 ? (
                <p>No hay aportes registrados aún.</p>
              ) : (
                <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
                  {aportes.map((a) => (
                    <li key={a.id} style={{ marginBottom: '0.5rem' }}>
                      {a.fecha}: ${a.monto.toLocaleString()} = {a.m2.toFixed(2)} m²
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p>No seleccionaste una vivienda aún. Por favor selecciona una en la página principal.</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: 'auto' }}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src="https://i.ibb.co/fYk575cp/logo-JAUS.png" 
            alt="Logo JAUS" 
            style={styles.logo}
          />
          <h1 style={{ color: '#00B7FF' }}>JAUS - Bienvenido {userEmail}</h1>
        </div>
        <div>
          {isAdmin && (
            <button 
              onClick={() => setView('admin')}
              style={{ ...styles.button, background: '#f59e0b', marginRight: '0.5rem' }}
              disabled={loading}
            >
              Panel Admin
            </button>
          )}
          <button 
            onClick={handleLogout} 
            style={{ ...styles.button, background: '#ef4444' }}
            disabled={loading}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      
      <p>Seleccioná una vivienda, realizá aportes y mirá crecer tu billetera en m².</p>
      <p>Valor actual del m²: <strong>${config.valuePerM2.toLocaleString()}</strong></p>

      {loading && <p>Cargando...</p>}
      {error && <div style={styles.error}>{error}</div>}

      {selectedModel && (
        <div style={{ backgroundColor: '#fff7ed', padding: '1rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h2>{selectedModel.name}</h2>
          <p><strong>Línea:</strong> {selectedModel.line}</p>
          <p><strong>Superficie:</strong> {selectedModel.surface} m²</p>
          <p><strong>Precio total:</strong> ${selectedModel.cost.toLocaleString()}</p>
          <p><strong>Valor m²:</strong> ${Math.round(selectedModel.cost / selectedModel.surface).toLocaleString()}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setView('wallet')} 
          style={{ ...styles.button, background: '#34d399' }}
          disabled={loading}
        >
          Ir a mi billetera
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>💸 Simulador de aportes</h2>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (value >= 0) setAmount(value);
          }}
          placeholder="Monto en pesos"
          style={styles.input}
          disabled={loading}
        />
        <button 
          onClick={handleAporte} 
          style={styles.button}
          disabled={loading || amount <= 0}
        >
          {loading ? 'Procesando...' : 'Cargar aporte'}
        </button>
        {amount > 0 && (
          <p>Equivale a: {(amount / config.valuePerM2).toFixed(4)} m²</p>
        )}
      </div>

      <h2 style={{ marginBottom: '1rem' }}>🏘️ Catálogo de viviendas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {models.map((model) => (
          <div key={model.id} style={styles.card}>
            <h3>{model.name}</h3>
            <p>Línea: {model.line}</p>
            <p>Superficie: {model.surface} m²</p>
            <p>Precio total: ${model.cost.toLocaleString()}</p>
            <p>Valor m²: ${Math.round(model.cost / model.surface).toLocaleString()}</p>
            <button
              onClick={() => handleSelectModel(model)}
              style={{ ...styles.button, background: '#00B7FF' }}
              disabled={loading}
            >
              {selectedModel?.id === model.id ? 'Seleccionada' : 'Elegir esta vivienda'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;