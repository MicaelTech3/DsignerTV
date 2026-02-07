// ======================== login.js ==========================
// Página de Login

document.addEventListener('DOMContentLoaded', () => {
  // 🔒 Redirecionar se já estiver logado
  window.authModule.onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuário já está logado, redirecionando para o painel...');
      window.location.href = 'painel.html';
    }
  });

  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const messageEl = document.getElementById('login-message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      showMessage('Preencha todos os campos', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('E-mail inválido', 'error');
      return;
    }

    try {
      showMessage('Entrando...', 'info');

      // Fazer login
      await window.authModule.auth.signInWithEmailAndPassword(email, password);
      
      // O onAuthStateChanged acima já vai redirecionar
      showMessage('Login realizado com sucesso!', 'success');

    } catch (error) {
      console.error('❌ Erro no login:', error);
      handleLoginError(error);
    }
  });

  function showMessage(message, type) {
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `signup-link ${type}`;
    
    if (type !== 'info') {
      setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'signup-link';
      }, 5000);
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function handleLoginError(error) {
    let message = 'Erro ao fazer login';

    switch (error.code) {
      case 'auth/invalid-email':
        message = 'E-mail inválido';
        break;
      case 'auth/user-disabled':
        message = 'Usuário desabilitado';
        break;
      case 'auth/user-not-found':
        message = 'Usuário não encontrado';
        break;
      case 'auth/wrong-password':
        message = 'Senha incorreta';
        break;
      case 'auth/invalid-credential':
        message = 'Credenciais inválidas. Verifique email e senha.';
        break;
      case 'auth/too-many-requests':
        message = 'Muitas tentativas. Aguarde alguns minutos.';
        break;
      case 'auth/network-request-failed':
        message = 'Erro de conexão. Verifique sua internet.';
        break;
      default:
        message = `Erro: ${error.message}`;
        break;
    }

    showMessage(message, 'error');
  }
});
// ======================== login.js (COM LOGS DETALHADOS) ==========================

document.addEventListener('DOMContentLoaded', () => {
  // 🔒 Redirecionar se já estiver logado
  window.authModule.onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuário já está logado:', user.email);
      window.location.href = 'painel.html';
    }
  });

  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const messageEl = document.getElementById('login-message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    console.log('🔐 Tentando login com:', email);

    if (!email || !password) {
      showMessage('Preencha todos os campos', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('E-mail inválido', 'error');
      return;
    }

    try {
      showMessage('Entrando...', 'info');

      // Fazer login
      console.log('📡 Enviando requisição para Firebase...');
      const userCredential = await window.authModule.auth.signInWithEmailAndPassword(email, password);
      
      console.log('✅ Login bem-sucedido!', userCredential.user);
      showMessage('Login realizado com sucesso!', 'success');

    } catch (error) {
      console.error('❌ Erro no login:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem do erro:', error.message);
      console.error('❌ Objeto completo:', JSON.stringify(error, null, 2));
      handleLoginError(error);
    }
  });

  function showMessage(message, type) {
    if (!messageEl) return;
    
    messageEl.textContent = message;
    messageEl.className = `signup-link ${type}`;
    
    if (type !== 'info') {
      setTimeout(() => {
        messageEl.textContent = '';
        messageEl.className = 'signup-link';
      }, 5000);
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function handleLoginError(error) {
    let message = 'Erro ao fazer login';

    switch (error.code) {
      case 'auth/invalid-email':
        message = 'E-mail inválido';
        break;
      case 'auth/user-disabled':
        message = 'Usuário desabilitado';
        break;
      case 'auth/user-not-found':
        message = 'Usuário não encontrado. Verifique o e-mail.';
        break;
      case 'auth/wrong-password':
        message = 'Senha incorreta';
        break;
      case 'auth/invalid-credential':
        message = 'E-mail ou senha inválidos';
        break;
      case 'auth/too-many-requests':
        message = 'Muitas tentativas. Aguarde alguns minutos.';
        break;
      case 'auth/network-request-failed':
        message = 'Erro de conexão. Verifique sua internet.';
        break;
      case 'auth/operation-not-allowed':
        message = 'Login com e-mail/senha não está habilitado';
        break;
      default:
        message = `Erro: ${error.message || 'Desconhecido'}`;
        break;
    }

    showMessage(message, 'error');
  }
});