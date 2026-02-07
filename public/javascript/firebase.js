// ======================== javascript/firebase.js ==========================
// Inicialização do Firebase (Script Global)

const firebaseConfig = {
  apiKey: "AIzaSyBhj6nv3QcIHyuznWPNM4t_0NjL0ghMwFw",
  authDomain: "dsignertv.firebaseapp.com",
  databaseURL: "https://dsignertv-default-rtdb.firebaseio.com",
  projectId: "dsignertv",
  storageBucket: "dsignertv.firebasestorage.app",
  messagingSenderId: "930311416952",
  appId: "1:930311416952:web:d0e7289f0688c46492d18d"
};

// Inicializar Firebase (apenas uma vez)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase inicializado com projeto:', firebaseConfig.projectId);
} else {
  console.log('⚠️ Firebase já estava inicializado');
}

const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// Expor globalmente
window.authModule = {
  auth,
  database,
  storage,
  onAuthStateChanged: (callback) => auth.onAuthStateChanged(callback),
  signOut: () => auth.signOut()
};

console.log('✅ window.authModule disponível');