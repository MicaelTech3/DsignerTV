// auth.js

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAo12uC5EM7t4_nocYhfOdTY15men1Ping",
  authDomain: "dsigner-com-br.firebaseapp.com",
  databaseURL: "https://dsigner-com-br-default-rtdb.firebaseio.com",
  projectId: "dsigner-com-br",
  storageBucket: "dsigner-com-br.firebasestorage.app",
  messagingSenderId: "905799758619",
  appId: "1:905799758619:web:713beeced2de2cdd7f19be"
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