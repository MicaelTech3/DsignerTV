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

// Inicialização do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // Feedback visual
            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Autenticando...";
            
            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    console.log("Usuário logado:", userCredential.user);
                    window.location.href = 'painel.html'; // Redireciona para painel.html
                })
                .catch(error => {
                    console.error("Erro de login:", error);
                    document.getElementById('login-message').textContent = getErrorMessage(error);
                    btn.disabled = false;
                    btn.textContent = originalText;
                });
        });
    }
});

function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/invalid-email': return 'Email inválido';
        case 'auth/user-disabled': return 'Conta desativada';
        case 'auth/user-not-found': return 'Usuário não encontrado';
        case 'auth/wrong-password': return 'Senha incorreta';
        case 'auth/too-many-requests': return 'Muitas tentativas. Tente mais tarde.';
        default: return 'Erro ao fazer login: ' + error.message;
    }
}