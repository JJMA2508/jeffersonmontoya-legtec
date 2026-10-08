/**
 * Ordenis AI Chat Assistant Module
 * Provee la interfaz flotante interactiva para consultar e interactuar con los documentos y metadatos.
 */

document.addEventListener('DOMContentLoaded', () => {
    initOrdenisChatWidget();
});

function initOrdenisChatWidget() {
    // Evitar duplicados
    if (document.getElementById('ordenis-chat-widget-container')) return;

    // Verificar si el usuario está autenticado
    const token = localStorage.getItem('ordenis_token');
    if (!token) return;

    let userRole = 'user';
    try {
        const u = JSON.parse(localStorage.getItem('ordenis_user'));
        if (u && (u.role === 'admin' || u.email === 'admin@ordenis.com')) {
            userRole = 'admin';
        }
    } catch(e) {}

    // Crear contenedor HTML del Widget
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'ordenis-chat-widget-container';
    
    widgetContainer.innerHTML = `
        <!-- Botón Flotante -->
        <button id="ordenis-chat-toggle-btn" class="floating-chat-trigger" title="Asistente de Documentos IA">
            🤖
            <span class="badge-pulse"></span>
        </button>

        <!-- Drawer Ventana de Chat -->
        <div id="ordenis-chat-drawer" class="ai-chat-drawer hidden" style="position: fixed; bottom: 95px; right: 28px; width: 380px; height: 520px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; z-index: 9999; overflow: hidden; transition: all 0.3s ease;">
            
            <!-- Cabecera -->
            <div style="padding: 14px 18px; background: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>
                    <div>
                        <h4 style="margin: 0; font-size: 0.95rem; color: white; font-weight: 600;">Asistente de Documentos IA</h4>
                        <span style="font-size: 0.72rem; color: #94a3b8;">${userRole === 'admin' ? 'Modo Auditoría Global Admin' : 'Modo Bóveda Privada'}</span>
                    </div>
                </div>
                <button id="ordenis-chat-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer; padding: 4px;">✕</button>
            </div>

            <!-- Contenedor de Mensajes -->
            <div id="ordenis-chat-messages" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
                <div class="chat-msg assistant" style="background: rgba(255, 255, 255, 0.06); padding: 12px 14px; border-radius: 12px; border-bottom-left-radius: 2px; color: #f1f5f9; font-size: 0.85rem; line-height: 1.5; align-self: flex-start; max-width: 90%;">
                    ¡Hola! Soy tu <strong>Asistente Inteligente de Documentos</strong>. Puedo buscar activos en la bóveda, consultar detalles de archivos blindados ${userRole === 'admin' ? ', auditar usuarios' : ''} o explicar el cifrado AES-256. ¿Qué deseas consultar hoy?
                </div>
            </div>

            <!-- Suggestions Chips -->
            <div class="chat-chips-container" id="ordenis-chat-chips">
                ${userRole === 'admin' ? `
                    <div class="chat-chip" data-query="¿Cuántos usuarios hay en la red?">👥 Usuarios Totales</div>
                    <div class="chat-chip" data-query="Resumen de auditoría de documentos">📊 Auditoría Red</div>
                    <div class="chat-chip" data-query="Lista todos los documentos blindados">📂 Listar Activos</div>
                    <div class="chat-chip" data-query="Explicar seguridad inmutable">🛡️ Seguridad AES-256</div>
                ` : `
                    <div class="chat-chip" data-query="¿Qué documentos tengo en mi bóveda?">📄 Mis Documentos</div>
                    <div class="chat-chip" data-query="¿Cómo blindo un nuevo archivo?">🔒 Cómo Blindar</div>
                    <div class="chat-chip" data-query="Explicar inmutabilidad y firmas">🛡️ Seguridad AES-256</div>
                    <div class="chat-chip" data-query="Quién es el creador de Ordenis">ℹ️ Sobre Ordenis</div>
                `}
            </div>

            <!-- Formulario Input -->
            <form id="ordenis-chat-form" style="padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; gap: 8px;">
                <input type="text" id="ordenis-chat-input" placeholder="Pregunta sobre documentos, activos o auditoría..." style="flex: 1; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.85rem; outline: none;" required autocomplete="off">
                <button type="submit" style="background: linear-gradient(135deg, #2563eb 0%, #8b5cf6 100%); border: none; border-radius: 8px; color: white; padding: 0 14px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">➢</button>
            </form>
        </div>
    `;

    document.body.appendChild(widgetContainer);

    // Seleccionar elementos
    const toggleBtn = document.getElementById('ordenis-chat-toggle-btn');
    const closeBtn = document.getElementById('ordenis-chat-close-btn');
    const drawer = document.getElementById('ordenis-chat-drawer');
    const form = document.getElementById('ordenis-chat-form');
    const input = document.getElementById('ordenis-chat-input');
    const messagesContainer = document.getElementById('ordenis-chat-messages');
    const chipsContainer = document.getElementById('ordenis-chat-chips');

    // Toggle drawer
    toggleBtn.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        if (!drawer.classList.contains('hidden')) {
            input.focus();
        }
    });

    closeBtn.addEventListener('click', () => {
        drawer.classList.add('hidden');
    });

    // Chips clicks
    if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chat-chip');
            if (chip) {
                const queryText = chip.getAttribute('data-query');
                if (queryText) {
                    input.value = queryText;
                    form.dispatchEvent(new Event('submit'));
                }
            }
        });
    }

    // Submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMsg = input.value.trim();
        if (!userMsg) return;

        // Limpiar input
        input.value = '';

        // Renderizar mensaje del usuario
        appendChatMessage('user', userMsg);

        // Indicador de tipeo
        const typingId = appendTypingIndicator();

        try {
            const activeToken = localStorage.getItem('ordenis_token');
            const res = await fetch('/api/chat/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${activeToken}`
                },
                body: JSON.stringify({ message: userMsg })
            });

            removeTypingIndicator(typingId);

            if (res.ok) {
                const data = await res.json();
                appendChatMessage('assistant', data.response || 'No recibí respuesta del asistente.');
            } else {
                appendChatMessage('assistant', '⚠️ Hubo un error de conexión al consultar los documentos.');
            }
        } catch (err) {
            removeTypingIndicator(typingId);
            appendChatMessage('assistant', '❌ No se pudo conectar con el servidor.');
        }
    });

    function appendChatMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${sender}`;
        
        if (sender === 'user') {
            msgDiv.style.cssText = 'background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 10px 14px; border-radius: 12px; border-bottom-right-radius: 2px; font-size: 0.85rem; line-height: 1.4; align-self: flex-end; max-width: 85%; shadow: 0 4px 12px rgba(37, 99, 235, 0.3);';
            msgDiv.innerText = text;
        } else {
            msgDiv.style.cssText = 'background: rgba(255, 255, 255, 0.07); color: #f1f5f9; padding: 12px 14px; border-radius: 12px; border-bottom-left-radius: 2px; font-size: 0.85rem; line-height: 1.5; align-self: flex-start; max-width: 92%; border: 1px solid rgba(255,255,255,0.08);';
            msgDiv.innerHTML = parseMarkdownToHTML(text);
        }

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function appendTypingIndicator() {
        const id = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = id;
        typingDiv.className = 'chat-msg assistant typing';
        typingDiv.style.cssText = 'background: rgba(255, 255, 255, 0.05); padding: 8px 14px; border-radius: 12px; align-self: flex-start; font-size: 0.8rem; color: #94a3b8; font-style: italic;';
        typingDiv.innerText = '🔍 Consultando documentos...';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // Formateador simple de Markdown a HTML para respuestas enriquecidas
    function parseMarkdownToHTML(markdown) {
        if (!markdown) return '';
        let html = markdown
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Escapar HTML
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.8em; color: #60a5fa;">$1</code>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        return html;
    }
}
