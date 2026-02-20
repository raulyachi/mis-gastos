import React, { useState, useEffect } from 'react';
import { PlusCircle, List, LayoutDashboard, Trash2, Wallet, Tag, ArrowDownCircle, ArrowUpCircle, Calendar, Settings, Pencil, Download, LogOut, User, Utensils, Car, Gamepad2, ShoppingBag, Zap, Smartphone, Users, DollarSign } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// 1. Obtención ultra-segura de las credenciales
const getSafeGlobalConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    try {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    } catch (e) {
      console.warn("Error leyendo config de canvas, usando local");
    }
  }
  return {
    apiKey: "AIzaSyCQYGMby_BTU7bPwXq5TBgnwTA2ptPWaNs",
    authDomain: "mis-gastos-app-4bc96.firebaseapp.com",
    projectId: "mis-gastos-app-4bc96",
    storageBucket: "mis-gastos-app-4bc96.firebasestorage.app",
    messagingSenderId: "463768093334",
    appId: "1:463768093334:web:c4faca89e00e568a01f8b7"
  };
};

const firebaseConfig = getSafeGlobalConfig();
const isCanvas = typeof __firebase_config !== 'undefined';
const rawAppId = typeof __app_id !== 'undefined' ? String(__app_id) : "mis-gastos-personales";
const appId = rawAppId.replace(/\//g, '_');

// 2. Inicialización segura
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Ícono de Carga Personalizado
const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// Diccionario inteligente de íconos
const getCategoryIcon = (categoryName, size = 20) => {
  const name = categoryName.toLowerCase();
  if (name.includes('alimento') || name.includes('comida')) return <Utensils size={size} />;
  if (name.includes('transporte') || name.includes('auto') || name.includes('taxi')) return <Car size={size} />;
  if (name.includes('entretenimiento') || name.includes('diversión') || name.includes('salida')) return <Gamepad2 size={size} />;
  if (name.includes('compra') || name.includes('hogar')) return <ShoppingBag size={size} />;
  if (name.includes('servicio') || name.includes('luz') || name.includes('agua') || name.includes('internet')) return <Zap size={size} />;
  if (name.includes('suscrip')) return <Smartphone size={size} />;
  if (name.includes('tercero') || name.includes('familia') || name.includes('amigo') || name.includes('pareja')) return <Users size={size} />;
  if (name.includes('ingreso') || name.includes('sueldo') || name.includes('salario') || name.includes('extra')) return <DollarSign size={size} />;
  return <Tag size={size} />; 
};

// Cálculo de fechas por defecto
const getInitialDates = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const lastDayObj = new Date(yyyy, today.getMonth() + 1, 0);
  const dd = String(lastDayObj.getDate()).padStart(2, '0');
  return { start: `${yyyy}-${mm}-01`, end: `${yyyy}-${mm}-${dd}` };
};

// Formateador de fechas
const formatDateLabel = (dateString) => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateString === todayStr) return 'Hoy';
  if (dateString === yesterdayStr) return 'Ayer';

  const dateObj = new Date(`${dateString}T12:00:00`);
  return dateObj.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' });
};

export default function App() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Estado para el filtro de fechas (con memoria)
  const initDates = getInitialDates();
  const [filterStartDate, setFilterStartDate] = useState(() => localStorage.getItem('gastos_filterStartDate') || initDates.start);
  const [filterEndDate, setFilterEndDate] = useState(() => localStorage.getItem('gastos_filterEndDate') || initDates.end);

  useEffect(() => {
    localStorage.setItem('gastos_filterStartDate', filterStartDate);
    localStorage.setItem('gastos_filterEndDate', filterEndDate);
  }, [filterStartDate, filterEndDate]);

  // Estado de formularios
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [txType, setTxType] = useState('gasto');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState(''); 
  const [txDate, setTxDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('gasto');
  const [newSubcats, setNewSubcats] = useState({}); 
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    setCategory('');
    setSubcategory(''); 
  }, [txType]);

  // Autenticación
  useEffect(() => {
    const initAuth = async () => {
      if (isCanvas) {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Error canvas auth:", error);
        }
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sincronización de base de datos
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
      }, (error) => console.error("Error transacciones:", error));

      unsubCat = onSnapshot(catRef, (snapshot) => {
        if (snapshot.empty) {
          const defaultCats = [
            { name: 'Alimentos', type: 'gasto', subcategories: ['Desayuno', 'Almuerzo', 'Cena', 'Snacks', 'Bebidas'] },
            { name: 'Transporte', type: 'gasto', subcategories: ['Público', 'Taxi', 'Gasolina', 'Cochera', 'Seguro / SOAT', 'Mantenimiento / Reparación'] },
            { name: 'Entretenimiento', type: 'gasto', subcategories: ['Salidas', 'Restaurantes', 'Bares', 'Alcohol', 'Eventos'] },
            { name: 'Compras', type: 'gasto', subcategories: ['Hogar', 'Personal'] },
            { name: 'Servicios', type: 'gasto', subcategories: ['Celular', 'Internet', 'Gas', 'Luz', 'Agua'] },
            { name: 'Suscripciones', type: 'gasto', subcategories: ['Netflix', 'ChatGPT', 'Crunchyroll', 'Spotify'] },
            { name: 'Terceros', type: 'gasto', subcategories: ['Pareja', 'Familia', 'Amigos', 'Préstamos'] },
            { name: 'Ingresos', type: 'ingreso', subcategories: ['Sueldo', 'Taxi', 'Extras', 'Intereses préstamos'] }
          ];
          defaultCats.forEach(c => addDoc(catRef, c));
        } else {
          setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }, (error) => console.error("Error categorias:", error));
    } catch (e) {
      console.error("Error Firebase:", e);
    }
    return () => { unsubTx(); unsubCat(); };
  }, [user]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error(error); alert("Error al iniciar sesión"); } 
    finally { setIsLoggingIn(false); }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingIn(true);
    try { await signInAnonymously(auth); } 
    catch (error) { console.error(error); alert("Error al entrar"); } 
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => {
    signOut(auth);
    setTransactions([]);
    setCategories([]);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || !user || isSubmitting) return;
    setIsSubmitting(true);
    const newTx = {
      amount: parseFloat(amount),
      description: description.trim(),
      category: category,
      subcategory: subcategory,
      type: txType,
      date: txDate,
      timestamp: editingId ? transactions.find(t => t.id === editingId)?.timestamp || Date.now() : Date.now() 
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingId), newTx);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), newTx);
      }
      setAmount(''); setDescription(''); setSubcategory(''); setActiveTab('list'); 
    } catch (error) { console.error(error); } 
    finally { setIsSubmitting(false); }
  };

  const handleEditClick = (tx) => {
    setAmount(tx.amount.toString()); setDescription(tx.description); setTxType(tx.type || 'gasto');
    setCategory(tx.category); setSubcategory(tx.subcategory || ''); setTxDate(tx.date); 
    setEditingId(tx.id); setActiveTab('add');
  };

  const cancelEdit = () => {
    setEditingId(null); setAmount(''); setDescription(''); setTxType('gasto'); 
    setCategory(''); setSubcategory(''); setActiveTab('list');
  };

  const deleteTransaction = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id)); } 
    catch (error) { console.error(error); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim() || !user || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'categories'), { name: newCatName.trim(), type: newCatType, subcategories: [] });
      setNewCatName('');
    } catch (error) { console.error(error); } 
    finally { setIsSubmitting(false); }
  };

  const deleteCategory = async (id) => {
    if (!user) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', id)); } 
    catch (error) { console.error(error); }
  };

  const handleAddSubcategory = async (catId) => {
    const subName = newSubcats[catId];
    if (!subName || !subName.trim() || !user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', catId), { subcategories: arrayUnion(subName.trim()) });
      setNewSubcats({ ...newSubcats, [catId]: '' }); 
    } catch (error) { console.error(error); }
  };

  const handleDeleteSubcategory = async (catId, subName) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', catId), { subcategories: arrayRemove(subName) });
    } catch (error) { console.error(error); }
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterStartDate && t.date < filterStartDate) return false;
    if (filterEndDate && t.date > filterEndDate) return false;
    return true;
  });

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Subcategoría', 'Descripción', 'Monto'];
    const csvRows = filteredTransactions.map(tx => {
      const descSegura = tx.description ? tx.description.replace(/,/g, ' ') : '';
      const subSegura = tx.subcategory ? tx.subcategory.replace(/,/g, ' ') : '';
      return `${tx.date},${tx.type === 'ingreso' ? 'Ingreso' : 'Gasto'},${tx.category},${subSegura},${descSegura},${tx.amount.toFixed(2)}`;
    });
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    let fileName = `Mis_Gastos`;
    if (filterStartDate && filterEndDate) fileName += `_${filterStartDate}_al_${filterEndDate}`;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // PANTALLA DE CARGA (Ajustada a la altura de la pantalla h-dvh)
  if (isLoading) {
    return <div className="flex justify-center bg-gray-100 h-dvh items-center"><LoadingSpinner /></div>;
  }

  // PANTALLA DE LOGIN (Ajustada a la altura de la pantalla h-dvh)
  if (!user) {
    return (
      <div className="flex justify-center bg-gray-100 h-dvh font-sans overflow-hidden">
        <div className="w-full max-w-md bg-white h-full flex flex-col items-center justify-center p-6 shadow-2xl overflow-y-auto">
          <div className="bg-emerald-100 p-6 rounded-full text-emerald-600 mb-6"><Wallet size={64} /></div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Mis Gastos</h1>
          <p className="text-gray-500 text-center mb-8">Controla tus finanzas personales y sincronízalas en todos tus dispositivos.</p>
          <div className="w-full space-y-4">
            <button onClick={handleLogin} disabled={isLoggingIn} className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-50 transition-colors shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoggingIn ? <><LoadingSpinner /> Conectando...</> : <><svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg> Ingresar con Google</>}
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase tracking-wider">o también</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>
            <button onClick={handleAnonymousLogin} disabled={isLoggingIn} className="w-full flex items-center justify-center gap-3 bg-gray-100 text-gray-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors shadow-sm active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoggingIn ? <><LoadingSpinner /> Conectando...</> : <><User size={22} className="text-gray-600" /> Continuar como Invitado</>}
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed px-4">* Si ingresas como invitado, tus datos solo se guardarán en este dispositivo.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalIngresos = filteredTransactions.filter(t => t.type === 'ingreso').reduce((sum, e) => sum + e.amount, 0);
  const totalGastos = filteredTransactions.filter(t => t.type === 'gasto' || !t.type).reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIngresos - totalGastos;
  const healthPercentage = totalIngresos > 0 ? Math.min((totalGastos / totalIngresos) * 100, 100) : (totalGastos > 0 ? 100 : 0);

  const expensesByCategory = categories.filter(c => c.type === 'gasto').map(cat => {
    const total = filteredTransactions.filter(e => e.category === cat.name && (e.type === 'gasto' || !e.type)).reduce((sum, e) => sum + e.amount, 0);
    return { category: cat.name, total, percentage: totalGastos > 0 ? (total / totalGastos) * 100 : 0 };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const currentCatObj = categories.find(c => c.name === category);
  const currentSubcats = currentCatObj?.subcategories || [];
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    // ESTRUCTURA DE APP NATIVA (h-dvh bloquea la altura al tamaño de la pantalla del celular)
    <div className="flex justify-center bg-gray-100 h-dvh font-sans overflow-hidden">
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl relative">
        
        {/* Cabecera (No hace scroll) */}
        <header className="bg-emerald-600 text-white p-4 shadow-md z-10 flex justify-between items-center shrink-0">
          <div className="w-6"></div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Wallet size={24} /> Mis Gastos</h1>
          <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${userInitial}&background=random`} alt="Perfil" className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-100" />
        </header>

        {/* Zona de contenido principal (¡AQUÍ SÍ HAY SCROLL!) */}
        <main className="flex-1 overflow-y-auto p-4 pb-16 bg-gray-50">
          
          {activeTab !== 'add' && (
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4 flex gap-3 items-end animate-in fade-in">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1"><Calendar size={10}/> Desde</label>
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1"><Calendar size={10}/> Hasta</label>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-gradient-to-br from-emerald-600 to-teal-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <p className="text-emerald-100 text-sm font-medium mb-1 mt-2 text-center">Balance del Periodo</p>
                <h2 className="text-4xl font-bold tracking-tight text-center mb-4">
                  {balance < 0 ? '-' : ''}S/ {Math.abs(balance).toFixed(2)}
                </h2>
                
                <div className="mb-5">
                  <div className="flex justify-between text-[10px] text-emerald-100 mb-1.5 px-1 uppercase tracking-wider font-semibold">
                    <span>Ingresos</span><span>{healthPercentage.toFixed(0)}% Gastado</span>
                  </div>
                  <div className="w-full bg-teal-900/50 rounded-full h-2 shadow-inner">
                    <div className={`h-2 rounded-full transition-all duration-1000 ${healthPercentage > 90 ? 'bg-red-400' : healthPercentage > 75 ? 'bg-yellow-400' : 'bg-emerald-300'}`} style={{ width: `${healthPercentage}%` }}></div>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-emerald-500/50">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="text-emerald-300" size={20} />
                    <div><p className="text-[10px] text-emerald-200 uppercase tracking-wider">Ingresos</p><p className="font-semibold">S/ {totalIngresos.toFixed(2)}</p></div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <div><p className="text-[10px] text-emerald-200 uppercase tracking-wider">Gastos</p><p className="font-semibold">S/ {totalGastos.toFixed(2)}</p></div>
                    <ArrowDownCircle className="text-red-300" size={20} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-gray-700 font-semibold mb-3 px-1">Distribución de Gastos</h3>
                {expensesByCategory.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 bg-white rounded-xl border border-dashed border-gray-300 text-sm">No hay gastos en estas fechas.</p>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 space-y-1">
                    {expensesByCategory.map((item, index) => (
                      <div key={index} className="p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-red-50 p-1.5 rounded-md text-red-500">{getCategoryIcon(item.category, 14)}</div>
                            <span className="font-medium text-gray-700 text-sm">{item.category}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-gray-900 block text-sm">S/ {item.total.toFixed(2)}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{item.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="bg-red-400 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${item.percentage}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Editar Registro' : 'Nuevo Registro'}</h2>
                {editingId && <button onClick={cancelEdit} className="text-sm text-gray-500 hover:text-gray-800 font-medium">Cancelar</button>}
              </div>
              <div className="flex p-1 bg-gray-200 rounded-xl mb-6">
                <button onClick={() => setTxType('gasto')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'gasto' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Gasto</button>
                <button onClick={() => setTxType('ingreso')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${txType === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>Ingreso</button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Monto</label>
                    <div className="flex items-center">
                      <span className={`font-semibold text-xl mr-2 ${txType === 'gasto' ? 'text-red-400' : 'text-emerald-400'}`}>S/</span>
                      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full text-3xl font-bold text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0" autoFocus />
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 col-span-2 sm:col-span-1">
                    <label className="block text-sm font-medium text-gray-500 mb-2 flex items-center gap-1"><Calendar size={14} /> Fecha</label>
                    <input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-lg font-medium" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-gray-500 mb-3 flex items-center gap-1"><Tag size={14} /> Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.filter(c => c.type === txType).map(cat => (
                      <button key={cat.id} type="button" onClick={() => { setCategory(cat.name); setSubcategory(''); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${category === cat.name ? (txType === 'gasto' ? 'bg-red-500 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md') : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Subcategoría (Opcional)</label>
                  <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Ej. Desayuno, Gasolina..." className="w-full text-gray-800 bg-transparent border-b border-gray-200 focus:outline-none focus:border-emerald-500 py-2 mb-2" />
                  {category && currentSubcats.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {currentSubcats.map((sub, idx) => (
                        <button key={idx} type="button" onClick={() => setSubcategory(sub)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${subcategory === sub ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Descripción (Opcional)</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Almuerzo con amigos" className="w-full text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 p-0" />
                </div>
                <button type="submit" disabled={!amount || !category || isSubmitting} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg mt-4 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${txType === 'gasto' ? 'bg-red-500 shadow-red-200' : 'bg-emerald-600 shadow-emerald-200'}`}>
                  {isSubmitting ? <span className="flex items-center justify-center gap-2"><LoadingSpinner /> Procesando...</span> : <>{editingId ? 'Actualizar ' : 'Guardar '} {txType === 'gasto' ? 'Gasto' : 'Ingreso'}</>}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'list' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Historial</h2>
              {filteredTransactions.length === 0 ? (
                 <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                   <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><List size={32} /></div>
                   <p className="text-gray-500 font-medium">No hay movimientos en estas fechas.</p>
                 </div>
              ) : (
                <div className="space-y-6">
                  {Object.keys(
                    filteredTransactions.reduce((acc, tx) => {
                      if (!acc[tx.date]) acc[tx.date] = [];
                      acc[tx.date].push(tx);
                      return acc;
                    }, {})
                  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => {
                    const dayTransactions = filteredTransactions.filter(t => t.date === dateKey);
                    const dayTotal = dayTransactions.reduce((sum, tx) => sum + (tx.type === 'ingreso' ? tx.amount : -tx.amount), 0);
                    
                    let dayTotalClass = 'text-gray-600';
                    let dayTotalSign = '';
                    if (dayTotal > 0.001) {
                      dayTotalClass = 'text-emerald-600';
                      dayTotalSign = '+';
                    } else if (dayTotal < -0.001) {
                      dayTotalClass = 'text-red-600';
                      dayTotalSign = '-';
                    }

                    return (
                      <div key={dateKey} className="space-y-3">
                        <div className="flex justify-between items-center px-1 border-b border-gray-200 pb-2 mb-2">
                          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{formatDateLabel(dateKey)}</h3>
                          <span className={`text-xs font-bold ${dayTotalClass}`}>
                            {dayTotalSign}S/ {Math.abs(dayTotal).toFixed(2)}
                          </span>
                        </div>

                        {dayTransactions.map((tx) => (
                          <div key={tx.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-all">
                            <div className="flex gap-3 items-center overflow-hidden flex-1">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                 {getCategoryIcon(tx.category, 24)}
                               </div>
                               <div className="overflow-hidden flex-1 pr-2">
                                 <div className="flex items-center gap-2 mb-0.5">
                                   <h3 className="font-bold text-gray-800 text-sm md:text-base truncate">{tx.category}</h3>
                                   {tx.subcategory && (
                                     <span className="bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-semibold truncate shrink-0">{tx.subcategory}</span>
                                   )}
                                 </div>
                                 {(tx.description && tx.description !== 'Sin detalle') && (
                                   <p className="text-xs text-gray-500 truncate mb-1">{tx.description}</p>
                                 )}
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <span className={`font-bold text-base ${tx.type === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {tx.type === 'ingreso' ? '+' : '-'}S/ {tx.amount.toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditClick(tx)} className="text-gray-400 hover:text-blue-500 p-1.5 rounded-full hover:bg-blue-50 transition-colors"><Pencil size={14} /></button>
                                <button onClick={() => deleteTransaction(tx.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Ajustes</h2>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{user.isAnonymous ? "Modo Invitado" : (user.displayName || "Usuario")}</h3>
                  <p className="text-xs text-gray-500">{user.isAnonymous ? "Datos locales" : (user?.email || "")}</p>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
                  <LogOut size={16} /> Salir
                </button>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Exportar Datos</h3>
                <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">Se descargará un archivo de Excel con los datos de las fechas que tengas seleccionadas arriba (Desde/Hasta).</p>
                <button onClick={exportToExcel} disabled={filteredTransactions.length === 0} className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 border border-blue-200 py-3 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:hover:bg-blue-50">
                  <Download size={18} /> Descargar en Excel (CSV)
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Agregar Nueva Categoría</h3>
                <form onSubmit={handleAddCategory} className="mb-4">
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setNewCatType('gasto')} className={`flex-1 py-1.5 text-xs font-bold rounded-md border ${newCatType === 'gasto' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400'}`}>Para Gastos</button>
                    <button type="button" onClick={() => setNewCatType('ingreso')} className={`flex-1 py-1.5 text-xs font-bold rounded-md border ${newCatType === 'ingreso' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-gray-200 text-gray-400'}`}>Para Ingresos</button>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nombre Categoría" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                    <button type="submit" disabled={!newCatName.trim() || isSubmitting} className="flex items-center justify-center min-w-[80px] bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed">
                      {isSubmitting ? <LoadingSpinner /> : 'Añadir'}
                    </button>
                  </div>
                </form>

                <div className="space-y-4 border-t border-gray-100 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tus Gastos</h4>
                    <div className="space-y-3">
                      {categories.filter(c => c.type === 'gasto').map(cat => (
                        <div key={cat.id} className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700">{cat.name}</span>
                            <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(cat.subcategories || []).map((sub, idx) => (
                              <span key={idx} className="bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded text-[11px] flex items-center gap-1 shadow-sm">
                                {sub}
                                <button onClick={() => handleDeleteSubcategory(cat.id, sub)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 size={10}/></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input type="text" value={newSubcats[cat.id] || ''} onChange={(e) => setNewSubcats({...newSubcats, [cat.id]: e.target.value})} placeholder="Nueva subcategoría..." className="flex-1 bg-white border border-gray-200 rounded text-xs px-2 py-1.5 focus:outline-none focus:border-emerald-500" />
                            <button type="button" onClick={() => handleAddSubcategory(cat.id)} disabled={!newSubcats[cat.id]?.trim()} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-300 disabled:opacity-50">Añadir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-6">Tus Ingresos</h4>
                    <div className="space-y-3">
                      {categories.filter(c => c.type === 'ingreso').map(cat => (
                        <div key={cat.id} className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700">{cat.name}</span>
                            <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(cat.subcategories || []).map((sub, idx) => (
                              <span key={idx} className="bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded text-[11px] flex items-center gap-1 shadow-sm">
                                {sub}
                                <button onClick={() => handleDeleteSubcategory(cat.id, sub)} className="text-gray-400 hover:text-red-500 ml-1"><Trash2 size={10}/></button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input type="text" value={newSubcats[cat.id] || ''} onChange={(e) => setNewSubcats({...newSubcats, [cat.id]: e.target.value})} placeholder="Nueva subcategoría..." className="flex-1 bg-white border border-gray-200 rounded text-xs px-2 py-1.5 focus:outline-none focus:border-emerald-500" />
                            <button type="button" onClick={() => handleAddSubcategory(cat.id)} disabled={!newSubcats[cat.id]?.trim()} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-300 disabled:opacity-50">Añadir</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Barra de navegación inferior (Fija y no hace scroll) */}
        <nav className="bg-white border-t border-gray-200 w-full shrink-0 z-50 pb-safe">
          <div className="flex justify-around items-center p-2">
            <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center p-2 w-16 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutDashboard size={24} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} /> <span className="text-[10px] mt-1 font-medium">Inicio</span></button>
            <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center p-2 w-16 ${activeTab === 'list' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} /> <span className="text-[10px] mt-1 font-medium">Historial</span></button>
            <button onClick={() => setActiveTab('add')} className="flex flex-col items-center justify-center -mt-8 relative z-10"><div className="bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-200 transform transition-transform active:scale-95"><PlusCircle size={28} /></div><span className="text-[10px] mt-1 font-medium text-gray-600">Nuevo</span></button>
            <button onClick={() => setActiveTab('categories')} className={`flex flex-col items-center p-2 w-16 ${activeTab === 'categories' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}><Settings size={24} strokeWidth={activeTab === 'categories' ? 2.5 : 2} /> <span className="text-[10px] mt-1 font-medium">Ajustes</span></button>
          </div>
        </nav>
      </div>
    </div>
  );
}