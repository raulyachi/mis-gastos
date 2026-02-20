import React, { useState, useEffect } from 'react';
import { PlusCircle, List, LayoutDashboard, Trash2, Wallet, Tag, ArrowDownCircle, ArrowUpCircle, Calendar, Settings, Pencil, Download } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// 1. Inicialización de Firebase (fuera del componente para evitar recargas)
const firebaseConfig = {
  apiKey: "AIzaSyCQYGMby_BTU7bPwXq5TBgnwTA2ptPWaNs",
  authDomain: "mis-gastos-app-4bc96.firebaseapp.com",
  projectId: "mis-gastos-app-4bc96",
  storageBucket: "mis-gastos-app-4bc96.firebasestorage.app",
  messagingSenderId: "463768093334",
  appId: "1:463768093334:web:c4faca89e00e568a01f8b7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sanitizamos el appId porque Firebase no permite '/' en el nombre de la colección
//const rawAppId = typeof __app_id !== 'undefined' ? String(__app_id) : 'default-app-id';
//const appId = rawAppId.replace(/\//g, '_');
const appId = "mi-app-personal"; 


export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estado de los formularios
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [txType, setTxType] = useState('gasto');
  const [category, setCategory] = useState('');
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Estado para nueva categoría
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('gasto');

  // Estado para edición
  const [editingId, setEditingId] = useState(null);

  // Limpiar categoría seleccionada al cambiar entre ingreso/gasto
  useEffect(() => {
    setCategory('');
  }, [txType]);

  // 2. Autenticación y Conexión Inicial
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error al conectar cuenta:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 3. Sincronización en tiempo real con la base de datos (Firestore)
  useEffect(() => {
    if (!user) return;

    let unsubTx = () => {};
    let unsubCat = () => {};

    try {
      const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      const catRef = collection(db, 'artifacts', appId, 'users', user.uid, 'categories');
      
      unsubTx = onSnapshot(txRef, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.timestamp - a.timestamp);
        setTransactions(data);
        setIsLoading(false);
      }, (error) => {
        console.error("Error transacciones:", error);
        setIsLoading(false);
      });

      unsubCat = onSnapshot(catRef, (snapshot) => {
        if (snapshot.empty) {
          const defaultCats = [
            { name: 'Comida', type: 'gasto' }, { name: 'Transporte', type: 'gasto' },
            { name: 'Servicios', type: 'gasto' }, { name: 'Salario', type: 'ingreso' }
          ];
          defaultCats.forEach(c => addDoc(catRef, c));
        } else {
          setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }, (error) => console.error("Error categorias:", error));

    } catch (e) {
      console.error("Error inicializando Firebase Collections:", e);
      setIsLoading(false);
    }

    return () => { 
      unsubTx(); 
      unsubCat(); 
    };
  }, [user]);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || !user) return;
    
    const newTx = {
      amount: parseFloat(amount),
      description: description || 'Sin detalle',
      category: category,
      type: txType,
      date: txDate,
      timestamp: editingId ? transactions.find(t => t.id === editingId)?.timestamp || Date.now() : Date.now() 
    };
    
    try {
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingId), newTx);
        setEditingId(null);
      } else {
        const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
        await addDoc(txRef, newTx);
      }
      
      setAmount('');
      setDescription('');
      setTxDate(new Date().toISOString().split('T')[0]);
      setActiveTab('list'); 
    } catch (error) {
      console.error("Error guardando:", error);
    }
  };

  const handleEditClick = (tx) => {
    setAmount(tx.amount.toString());
    setDescription(tx.description);
    setTxType(tx.type || 'gasto');
    setCategory(tx.category);
    setTxDate(tx.date);
    setEditingId(tx.id);
    setActiveTab('add');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setTxType('gasto');
    setCategory('');
    setTxDate(new Date().toISOString().split('T')[0]);
    setActiveTab('list');
  };

  const deleteTransaction = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
    } catch (error) {
      console.error("Error eliminando:", error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'categories'), {
        name: newCatName.trim(),
        type: newCatType
      });
      setNewCatName('');
    } catch (error) {
      console.error("Error agregando categoría:", error);
    }
  };

  const deleteCategory = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', id));
    } catch (error) {
      console.error("Error eliminando categoría:", error);
    }
  };

  // Función para exportar a Excel (CSV)
  const exportToExcel = () => {
    if (transactions.length === 0) return;

    // Crear las cabeceras
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'];
    
    // Crear las filas de datos
    const csvRows = transactions.map(tx => {
      // Reemplazamos las comas por espacios en la descripción para no romper el formato CSV
      const descSegura = tx.description ? tx.description.replace(/,/g, ' ') : '';
      return `${tx.date},${tx.type === 'ingreso' ? 'Ingreso' : 'Gasto'},${tx.category},${descSegura},${tx.amount.toFixed(2)}`;
    });

    // Unir cabeceras y filas con salto de línea
    const csvContent = [headers.join(','), ...csvRows].join('\n');

    // Añadir el BOM para que Excel lea correctamente tildes y caracteres especiales (UTF-8)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Crear un enlace temporal para forzar la descarga
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Mis_Gastos_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cálculos automáticos
  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  const totalGastos = transactions.filter(t => t.type === 'gasto' || !t.type).reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIngresos - totalGastos;

  const healthPercentage = totalIngresos > 0 ? Math.min((totalGastos / totalIngresos) * 100, 100) : (totalGastos > 0 ? 100 : 0);

  const expensesByCategory = categories
    .filter(c => c.type === 'gasto')
    .map(cat => {
      const total = transactions
        .filter(e => e.category === cat.name && (e.type === 'gasto' || !e.type))
        .reduce((sum, e) => sum + e.amount, 0);
      return { 
        category: cat.name, 
        total,
        percentage: totalGastos > 0 ? (total / totalGastos) * 100 : 0
      };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen font-sans">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
        
        <header className="bg-emerald-600 text-white p-4 shadow-md z-10">
          <h1 className="text-xl font-bold text-center flex items-center justify-center gap-2">
            <Wallet size={24} />
            Mis Gastos
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 bg-gray-50">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-emerald-600 animate-pulse">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="font-medium">Conectando a la nube...</p>
            </div>
          ) : (
            <>
              {/* DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-2 right-3 text-xs opacity-50 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse"></div>
                      Online
                    </div>
                    <p className="text-emerald-100 text-sm font-medium mb-1 mt-2 text-center">Balance Total</p>
                    <h2 className="text-4xl font-bold tracking-tight text-center mb-4">
                      S/ {balance.toFixed(2)}
                    </h2>
                    
                    <div className="mb-5">
                      <div className="flex justify-between text-[10px] text-emerald-100 mb-1.5 px-1 uppercase tracking-wider font-semibold">
                        <span>Ingresos</span>
                        <span>{healthPercentage.toFixed(0)}% Gastado</span>
                      </div>
                      <div className="w-full bg-teal-900/50 rounded-full h-2 shadow-inner">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${healthPercentage > 90 ? 'bg-red-400' : healthPercentage > 75 ? 'bg-yellow-400' : 'bg-emerald-300'}`} 
                          style={{ width: `${healthPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4 border-t border-emerald-500/50">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="text-emerald-300" size={20} />
                        <div>
                          <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Ingresos</p>
                          <p className="font-semibold">S/ {totalIngresos.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-[10px] text-emerald-200 uppercase tracking-wider">Gastos</p>
                          <p className="font-semibold">S/ {totalGastos.toFixed(2)}</p>
                        </div>
                        <ArrowDownCircle className="text-red-300" size={20} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-gray-700 font-semibold mb-3 px-1">Distribución de Gastos</h3>
                    {expensesByCategory.length === 0 ? (
                      <p className="text-gray-400 text-center py-4 bg-white rounded-xl border border-dashed border-gray-300">
                        Aún no hay gastos registrados.
                      </p>
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 space-y-1">
                        {expensesByCategory.map((item, index) => (
                          <div key={index} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <div className="bg-red-50 p-1.5 rounded-md text-red-500">
                                  <Tag size={14} />
                                </div>
                                <span className="font-medium text-gray-700 text-sm">{item.category}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-gray-900 block text-sm">S/ {item.total.toFixed(2)}</span>
                                <span className="text-[10px] text-gray-400 font-medium">{item.percentage.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div 
                                className="bg-red-400 h-1.5 rounded-full transition-all duration-1000" 
                                style={{ width: `${item.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AGREGAR / EDITAR */}
              {activeTab === 'add' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {editingId ? 'Editar Registro' : 'Nuevo Registro'}
                    </h2>
                    {editingId && (
                      <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-800 font-medium">
                        Cancelar
                      </button>
                    )}
                  </div>
                  
                  <div className="flex p-1 bg-gray-200 rounded-xl mb-6">
                    <button 
                      onClick={() => setTxType('gasto')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'gasto' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      Gasto
                    </button>
                    <button 
                      onClick={() => setTxType('ingreso')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                    >
                      Ingreso
                    </button>
                  </div>

                  <form onSubmit={handleAddTransaction} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-500 mb-1">Monto</label>
                        <div className="flex items-center">
                          <span className={`font-semibold text-xl mr-2 ${txType === 'gasto' ? 'text-red-400' : 'text-emerald-400'}`}>S/</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full text-3xl font-bold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <Calendar size={14} /> Fecha
                        </label>
                        <input 
                          type="date"
                          value={txDate}
                          onChange={(e) => setTxDate(e.target.value)}
                          className="w-full text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-lg font-medium"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <label className="block text-sm font-medium text-gray-500 mb-3 flex items-center gap-1">
                        <Tag size={14} /> Categoría
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.type === txType).map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.name)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                              category === cat.name 
                                ? (txType === 'gasto' ? 'bg-red-500 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Descripción (Opcional)</label>
                      <input 
                        type="text" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ej. Almuerzo con amigos"
                        className="w-full text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={!amount || !category}
                      className={`w-full text-white font-bold py-4 rounded-xl shadow-lg mt-4 disabled:opacity-50 transition-all active:scale-95 ${txType === 'gasto' ? 'bg-red-500 shadow-red-200' : 'bg-emerald-600 shadow-emerald-200'}`}
                    >
                      {editingId ? 'Actualizar ' : 'Guardar '} {txType === 'gasto' ? 'Gasto' : 'Ingreso'}
                    </button>
                  </form>
                </div>
              )}

              {/* HISTORIAL */}
              {activeTab === 'list' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Historial</h2>
                  
                  {transactions.length === 0 ? (
                     <div className="text-center py-10">
                       <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                         <List size={32} />
                       </div>
                       <p className="text-gray-500">No hay movimientos registrados aún.</p>
                     </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center group">
                          <div className="flex gap-3 items-center overflow-hidden">
                             <div className={`p-3 rounded-full flex-shrink-0 ${tx.type === 'ingreso' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                               {tx.type === 'ingreso' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                             </div>
                             <div className="overflow-hidden">
                               <p className="font-semibold text-gray-800 truncate">{tx.description}</p>
                               <div className="flex items-center text-xs text-gray-500 gap-2 mt-1">
                                 <span className="bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">{tx.category}</span>
                                 <span>{tx.date}</span>
                               </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`font-bold ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-gray-900'}`}>
                              {tx.type === 'ingreso' ? '+' : '-'}S/ {tx.amount.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleEditClick(tx)}
                                className="text-gray-300 hover:text-blue-500 p-2 rounded-full hover:bg-blue-50 transition-colors"
                              >
                                <Pencil size={18} />
                              </button>
                              <button 
                                onClick={() => deleteTransaction(tx.id)}
                                className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CATEGORIAS Y AJUSTES */}
              {activeTab === 'categories' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Ajustes</h2>
                  
                  {/* Botón de Exportación */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 mb-3">Exportar Datos</h3>
                    <button 
                      onClick={exportToExcel}
                      disabled={transactions.length === 0}
                      className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:hover:bg-blue-50"
                    >
                      <Download size={18} />
                      Descargar en Excel (CSV)
                    </button>
                    {transactions.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Añade movimientos para poder exportar.</p>
                    )}
                  </div>

                  <form onSubmit={handleAddCategory} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                    <h3 className="text-sm font-semibold text-gray-600 mb-3">Agregar Nueva Categoría</h3>
                    <div className="flex gap-2 mb-3">
                      <button 
                        type="button"
                        onClick={() => setNewCatType('gasto')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md border ${newCatType === 'gasto' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400'}`}
                      >
                        Para Gastos
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewCatType('ingreso')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md border ${newCatType === 'ingreso' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-gray-200 text-gray-400'}`}
                      >
                        Para Ingresos
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Nombre de la categoría"
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <button 
                        type="submit"
                        disabled={!newCatName.trim()}
                        className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        Añadir
                      </button>
                    </div>
                  </form>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tus Gastos</h4>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.type === 'gasto').map(cat => (
                          <div key={cat.id} className="bg-red-50 text-red-700 border border-red-100 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                            {cat.name}
                            <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Tus Ingresos</h4>
                      <div className="flex flex-wrap gap-2">
                        {categories.filter(c => c.type === 'ingreso').map(cat => (
                          <div key={cat.id} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                            {cat.name}
                            <button onClick={() => deleteCategory(cat.id)} className="text-emerald-400 hover:text-emerald-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </main>

        <nav className="bg-white border-t border-gray-200 absolute bottom-0 w-full pb-safe">
          <div className="flex justify-around items-center p-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center p-2 w-16 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
              <span className="text-[10px] mt-1 font-medium">Inicio</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('list')}
              className={`flex flex-col items-center p-2 w-16 ${activeTab === 'list' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} />
              <span className="text-[10px] mt-1 font-medium">Historial</span>
            </button>

            <button 
              onClick={() => setActiveTab('add')}
              className="flex flex-col items-center justify-center -mt-8 relative z-10"
            >
              <div className="bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-200 transform transition-transform active:scale-95">
                <PlusCircle size={28} />
              </div>
              <span className="text-[10px] mt-1 font-medium text-gray-600">Nuevo</span>
            </button>

            <button 
              onClick={() => setActiveTab('categories')}
              className={`flex flex-col items-center p-2 w-16 ${activeTab === 'categories' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Settings size={24} strokeWidth={activeTab === 'categories' ? 2.5 : 2} />
              <span className="text-[10px] mt-1 font-medium">Ajustes</span>
            </button>
          </div>
        </nav>

      </div>
    </div>
  );
}