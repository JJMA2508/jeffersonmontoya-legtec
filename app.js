document.addEventListener('DOMContentLoaded', () => {
    // Only run this script on pages that have the login/register forms
    if (!document.getElementById('loginSection')) {
        return;
    }

    // Select elements
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const recoverSection = document.getElementById('recoverSection');
    
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const showLoginFromRecoverBtn = document.getElementById('showLoginFromRecoverBtn');

    // Forms
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const recoverForm = document.getElementById('recoverForm');

    // Functions to toggle views
    const showRegister = () => {
        loginSection.style.opacity = '0';
        loginSection.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            loginSection.classList.add('hidden');
            registerSection.classList.remove('hidden');

            // Trigger reflow
            void registerSection.offsetWidth;

            registerSection.style.opacity = '1';
            registerSection.style.transform = 'translateY(0)';
        }, 300); // matches var(--transition-smooth)
    };

    const showLogin = () => {
        registerSection.style.opacity = '0';
        registerSection.style.transform = 'translateY(20px)';

        setTimeout(() => {
            registerSection.classList.add('hidden');
            loginSection.classList.remove('hidden');

            // Trigger reflow
            void loginSection.offsetWidth;

            loginSection.style.opacity = '1';
            loginSection.style.transform = 'translateY(0)';
        }, 300);
    };

    const showRecover = () => {
        loginSection.style.opacity = '0';
        loginSection.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            loginSection.classList.add('hidden');
            recoverSection.classList.remove('hidden');

            void recoverSection.offsetWidth;

            recoverSection.style.opacity = '1';
            recoverSection.style.transform = 'translateY(0)';
        }, 300);
    };

    const showLoginFromRecover = () => {
        recoverSection.style.opacity = '0';
        recoverSection.style.transform = 'translateY(20px)';

        setTimeout(() => {
            recoverSection.classList.add('hidden');
            loginSection.classList.remove('hidden');

            void loginSection.offsetWidth;

            loginSection.style.opacity = '1';
            loginSection.style.transform = 'translateY(0)';
        }, 300);
    };

    // Event listeners for toggle buttons
    showRegisterBtn.addEventListener('click', showRegister);
    showLoginBtn.addEventListener('click', showLogin);
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRecover();
        });
    }
    if (showLoginFromRecoverBtn) {
        showLoginFromRecoverBtn.addEventListener('click', showLoginFromRecover);
    }

    // Auto-toggle to registration if requested in URL
    if (window.location.search.includes('register=true') || window.location.hash === '#register') {
        // Use a tiny timeout to ensure styling is applied or just show directly
        showRegister();
    }

    // Toast System for Auth
    const showToast = (title, message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'error' ? '❌' : '✅';
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <span class="toast-title">${title}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    };

    // Form Handling Real via Backend
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = document.getElementById('loginEmail').value.trim();
        const passwordInput = document.getElementById('loginPassword').value;

        const btn = loginForm.querySelector('button[type="submit"]');
        const ogText = btn.textContent;

        btn.textContent = 'Verificando...';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput, password: passwordInput })
            });
            const data = await response.json();

            if (!response.ok) {
                showToast('Error', data.error || 'Credenciales incorrectas.', 'error');
            } else {
                showToast('Éxito', data.message || 'Identidad validada.', 'success');
                // Limpiar cualquier sesión anterior para evitar conflictos de acceso cruzado
                localStorage.removeItem('ordenis_user');
                localStorage.removeItem('ordenis_token');
                
                // Persist the user data and token to localStorage so the dashboard can read it
                if (data.user) {
                    localStorage.setItem('ordenis_user', JSON.stringify(data.user));
                }
                if (data.token) {
                    localStorage.setItem('ordenis_token', data.token);
                }
                setTimeout(() => {
                    window.location.href = data.redirect || 'user_dashboard.html';
                }, 1000);
            }
        } catch (error) {
            console.error('Error in login:', error);
            showToast('Error', 'Hubo un problema de conexión con el servidor.', 'error');
        } finally {
            btn.textContent = ogText;
            btn.style.opacity = '1';
            btn.disabled = false;
        }
    });

    // Solicitud de código por correo
    const btnRequestCode = document.getElementById('btnRequestCode');
    const groupRecoverCode = document.getElementById('groupRecoverCode');
    const btnSubmitRecover = document.getElementById('btnSubmitRecover');

    if (btnRequestCode) {
        btnRequestCode.addEventListener('click', async () => {
            const emailInput = document.getElementById('recoverEmail').value.trim();
            const docIdInput = document.getElementById('recoverDocId').value.trim();

            if (!emailInput || !docIdInput) {
                showToast('Atención', 'Por favor ingresa tu correo y número de identificación.', 'error');
                return;
            }

            const ogText = btnRequestCode.textContent;
            btnRequestCode.textContent = 'Enviando código... ✉️';
            btnRequestCode.disabled = true;
            btnRequestCode.style.opacity = '0.7';

            try {
                const response = await fetch('/api/recover-password/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, docId: docIdInput })
                });
                const data = await response.json();

                if (!response.ok) {
                    showToast('Error', data.error || 'No se pudo enviar el código.', 'error');
                    btnRequestCode.disabled = false;
                    btnRequestCode.style.opacity = '1';
                    btnRequestCode.textContent = ogText;
                } else {
                    showToast('Éxito', data.message || 'Código enviado con éxito.', 'success');
                    if (groupRecoverCode) groupRecoverCode.classList.remove('hidden');
                    if (btnSubmitRecover) btnSubmitRecover.removeAttribute('disabled');
                    
                    document.getElementById('recoverEmail').readOnly = true;
                    document.getElementById('recoverDocId').readOnly = true;
                    btnRequestCode.textContent = 'Código Enviado';
                }
            } catch (error) {
                console.error('Error requesting recovery code:', error);
                showToast('Error', 'Hubo un problema de conexión con el servidor.', 'error');
                btnRequestCode.disabled = false;
                btnRequestCode.style.opacity = '1';
                btnRequestCode.textContent = ogText;
            }
        });
    }

    if (recoverForm) {
        recoverForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('recoverEmail').value.trim();
            const docIdInput = document.getElementById('recoverDocId').value.trim();
            const codeInput = document.getElementById('recoverCode').value.trim();
            const recoveryWordInput = document.getElementById('recoverWord').value.trim();
            const newPasswordInput = document.getElementById('recoverNewPassword').value;

            if (!codeInput) {
                showToast('Atención', 'Debe ingresar el código de verificación enviado a su correo.', 'error');
                return;
            }

            const btn = document.getElementById('btnSubmitRecover');
            const ogText = btn.textContent;

            btn.textContent = 'Restableciendo...';
            btn.style.opacity = '0.7';
            btn.disabled = true;

            try {
                const response = await fetch('/api/recover-password/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: emailInput,
                        docId: docIdInput,
                        code: codeInput,
                        recoveryWord: recoveryWordInput,
                        newPassword: newPasswordInput
                    })
                });
                const data = await response.json();

                if (!response.ok) {
                    showToast('Error', data.error || 'No se pudo restablecer la contraseña.', 'error');
                } else {
                    showToast('Éxito', data.message || 'Contraseña actualizada con éxito.', 'success');
                    recoverForm.reset();
                    if (groupRecoverCode) groupRecoverCode.classList.add('hidden');
                    if (btnSubmitRecover) btnSubmitRecover.setAttribute('disabled', 'true');
                    
                    document.getElementById('recoverEmail').readOnly = false;
                    document.getElementById('recoverDocId').readOnly = false;
                    if (btnRequestCode) {
                        btnRequestCode.disabled = false;
                        btnRequestCode.style.opacity = '1';
                        btnRequestCode.textContent = 'Solicitar Código de Seguridad por Correo ✉️';
                    }

                    setTimeout(() => {
                        showLoginFromRecover();
                    }, 2000);
                }
            } catch (error) {
                console.error('Error in recover:', error);
                showToast('Error', 'Hubo un problema de conexión con el servidor.', 'error');
            } finally {
                btn.textContent = ogText;
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        });
    }

    // Nota: El flujo de Registro, Drag & Drop de KYC y Biometría Facial está controlado de manera avanzada en biometry.js.
});
