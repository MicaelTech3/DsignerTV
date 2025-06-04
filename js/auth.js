// auth.js

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBhj6nv3QcIHyuznWPNM4t_0NjL0ghMwFw",
  authDomain: "dsignertv.firebaseapp.com",
  databaseURL: "https://dsignertv-default-rtdb.firebaseio.com",
  projectId: "dsignertv",
  storageBucket: "dsignertv.firebasestorage.app",
  messagingSenderId: "930311416952",
  appId: "1:930311416952:web:d0e7289f0688c46492d18d"
};

// Inicializar Firebase apenas se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Exportar serviços do Firebase
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Funções exportadas
const onAuthStateChanged = (callback) => {
    return auth.onAuthStateChanged(callback);
};

const signOut = () => {
    return auth.signOut();
};

// Exportação manual para uso como módulo
window.authModule = {
    auth,
    database,
    storage,
    onAuthStateChanged,
    signOut
};