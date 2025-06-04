document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button[type="submit"]');
        const loginMessage = document.getElementById('login-message');

        btn.disabled = true;
        btn.textContent = 'Autenticando...';

        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            window.location.href = 'painel.html';
        } catch (error) {
            loginMessage.textContent = getErrorMessage(error);
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    });
});

function getErrorMessage(error) {
    const messages = {
        'auth/invalid-email': 'Email inválido',
        'auth/user-disabled': 'Conta desativada',
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.'
    };
    return messages[error.code] || `Erro ao fazer login: ${error.message}`;
}