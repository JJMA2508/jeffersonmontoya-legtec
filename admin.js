document.addEventListener('DOMContentLoaded', () => {
    // Immediate Redirection Security Check
    const token = localStorage.getItem('ordenis_token');
    const storedUser = localStorage.getItem('ordenis_user');
    
    // Si no hay token o no hay usuario de sesión, denegar e ir al login
    if (!token || !storedUser) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const userObj = JSON.parse(storedUser);
        if (!userObj || userObj.email !== 'admin@ordenis.com') {
            window.location.href = 'login.html';
            return;
        }
    } catch(e) {
        window.location.href = 'login.html';
        return;
    }

    let globalChartInstance = null;
    let clientUsersCache = [];

    // Helper: Secure Fetch with Automatic Redirection on 401/403
    const secureFetch = async (url, options = {}) => {
        const activeToken = localStorage.getItem('ordenis_token');
        if (!activeToken) {
            window.location.href = 'login.html';
            return null;
        }
        if (!options.headers) options.headers = {};
        options.headers['Authorization'] = `Bearer ${activeToken}`;
        
        try {
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('ordenis_token');
                localStorage.removeItem('ordenis_user');
                window.location.href = 'login.html';
                return null;
            }
            return response;
        } catch (error) {
            console.error(`Error en secureFetch para ${url}:`, error);
            throw error;
        }
    };

    // Helper: format bytes
    const formatBytes = (bytes, decimals = 1) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // 1. Chart.js Initialization for Platform Growth
    const initChart = () => {
        const canvasEl = document.getElementById('mainChart');
        if (!canvasEl) return;
        
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js is not loaded. Skipping main chart initialization.");
            const parent = canvasEl.parentElement;
            if (parent) {
                parent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.9rem;">Gráfico no disponible.</div>';
            }
            return;
        }

        const ctx = canvasEl.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');   
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
 
        Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
        Chart.defaults.font.family = "'Inter', sans-serif";

        globalChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Inicio'],
                datasets: [
                    {
                        label: 'Nodos Registrados en Red',
                        data: [0],
                        borderColor: '#3B82F6',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#3B82F6',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#3B82F6'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
                    tooltip: {
                        backgroundColor: 'rgba(18, 18, 20, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1, padding: 12, displayColors: true, boxPadding: 4
                    }
                },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }, beginAtZero: true },
                    x: { grid: { display: false, drawBorder: false } }
                },
                interaction: { intersect: false, mode: 'index' },
            }
        });
    };

    // Update Global Growth Chart based on real users data chronologically
    const updateChartWithUsers = (users) => {
        if (typeof Chart === 'undefined' || !globalChartInstance) return;
        
        if (users.length === 0) {
            globalChartInstance.data.labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'];
            globalChartInstance.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0];
            globalChartInstance.update();
            return;
        }

        // Sort users chronologically by registration date
        const sortedUsers = [...users].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const labels = [];
        const dataPoints = [];
        let count = 0;

        sortedUsers.forEach(user => {
            const d = new Date(user.createdAt);
            const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            count++;
            
            labels.push(dateLabel);
            dataPoints.push(count);
        });

        if (labels.length === 1) {
            labels.unshift('Inicio');
            dataPoints.unshift(0);
        }

        globalChartInstance.data.labels = labels;
        globalChartInstance.data.datasets[0].data = dataPoints;
        globalChartInstance.data.datasets[0].label = 'Cuentas Registradas Acumulativas';
        globalChartInstance.update();
    };

    // 2. Fetch and Update Admin Metric Cards
    const loadDashboardStats = async () => {
        try {
            const response = await secureFetch('/api/admin/stats');
            if (!response) return;
            const data = await response.json();

            if (response.ok) {
                // Card 0: Users Count
                const usersCard = document.querySelectorAll('.metric-card')[0];
                if (usersCard) {
                    const valEl = usersCard.querySelector('.metric-value');
                    if (valEl) valEl.innerText = data.totalUsers;
                }

                // Card 1: Assets Count
                const assetsCard = document.querySelectorAll('.metric-card')[1];
                if (assetsCard) {
                    const valEl = assetsCard.querySelector('.metric-value');
                    if (valEl) valEl.innerText = data.totalAssets;
                }

                // Card 2: Total Storage in bytes (We dynamically alter "Carga del Servidor" to Almacenamiento Total)
                const storageCard = document.querySelectorAll('.metric-card')[2];
                if (storageCard) {
                    const valEl = storageCard.querySelector('.metric-value');
                    const titleEl = storageCard.querySelector('h3');
                    const subEl = storageCard.querySelector('.metric-subtitle');
                    const trendEl = storageCard.querySelector('.trend');

                    if (titleEl) titleEl.innerText = 'Almacenamiento Red';
                    if (valEl) valEl.innerText = formatBytes(data.totalBytes || 0);
                    if (subEl) subEl.innerText = 'Cifrado de Estándar AES';
                    if (trendEl) {
                        trendEl.innerText = 'Óptimo';
                        trendEl.className = 'trend positive';
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching global admin stats:', error);
        }
    };

    // 3. Populate Recent User Registrations Audits in the main panel
    const populateAuditsTable = (users) => {
        const tableBody = document.getElementById('activityTableBody');
        if (!tableBody) return;

        let html = '';
        if (users.length === 0) {
            html = '<tr><td colspan="4" style="text-align:center;">No hay actividad reciente registrada en la red.</td></tr>';
        } else {
            // Sort by registration date descending and limit to top 5
            const sortedUsers = [...users]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            sortedUsers.forEach(u => {
                const dateObj = new Date(u.createdAt);
                const timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                html += `
                    <tr>
                        <td><strong>${u.name} (${u.company || 'Independiente'})</strong></td>
                        <td>Creación de Cuenta & Firma KYC</td>
                        <td><span class="status-badge success">200 OK</span></td>
                        <td><span style="color: var(--text-secondary); font-size: 0.85rem;">${timeStr}</span></td>
                    </tr>
                `;
            });
        }
        tableBody.innerHTML = html;
    };

    // Active states cache
    let clientLogsCache = [];
    let categoryChartInstance = null;
    let latencyChartInstance = null;

    // Navigation and UX Utils
    const handleNavigation = () => {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
        const viewSections = document.querySelectorAll('.view-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const viewName = item.getAttribute('data-view');
                
                viewSections.forEach(section => {
                    section.classList.remove('active');
                    section.style.display = 'none';
                });
                
                const targetView = document.getElementById(viewName + '-view');
                if (targetView) {
                    targetView.style.display = 'block';
                    void targetView.offsetWidth;
                    targetView.classList.add('active');
                }
                
                if (viewName === 'users') {
                    loadUsers();
                } else if (viewName === 'dashboard') {
                    loadDashboardStats();
                    loadUsers(); 
                } else if (viewName === 'records') {
                    loadSystemLogs(); // Cargar bitácoras de seguridad
                } else if (viewName === 'reports') {
                    loadDeepAnalysisCharts(); // Cargar Análisis Profundo
                }
            });
        });
    };

    // Fetch and populate critical cibersecurity audit logs
    const loadSystemLogs = async () => {
        const tableBody = document.getElementById('logsTableBody');
        if (!tableBody) return;

        try {
            const response = await secureFetch('/api/admin/logs');
            if (!response) return;
            const data = await response.json();

            if (response.ok && data.logs) {
                clientLogsCache = data.logs;
                renderLogsTable();
            }
        } catch(error) {
            console.error('Error fetching security logs:', error);
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error de comunicación con el firewall.</td></tr>';
        }
    };

    // Filter and render the system logs table
    const renderLogsTable = () => {
        const tableBody = document.getElementById('logsTableBody');
        if (!tableBody) return;

        let filtered = [...clientLogsCache];

        // 1. Search Query
        const searchVal = document.getElementById('logSearchInput')?.value.trim().toLowerCase() || '';
        if (searchVal) {
            filtered = filtered.filter(log => 
                (log.email && log.email.toLowerCase().includes(searchVal)) ||
                (log.action && log.action.toLowerCase().includes(searchVal)) ||
                (log.details && log.details.toLowerCase().includes(searchVal))
            );
        }

        // 2. Status Level Filter
        const filterVal = document.getElementById('logStatusFilter')?.value || 'all';
        if (filterVal !== 'all') {
            filtered = filtered.filter(log => log.status === filterVal);
        }

        // Render HTML
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se hallaron registros en la bitácora que coincidan.</td></tr>';
            return;
        }

        let html = '';
        filtered.forEach(log => {
            const dateObj = new Date(log.createdAt);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
            
            // Badges
            let badgeClass = 'log-ok';
            if (log.status === 'WARNING') badgeClass = 'log-warning';
            else if (log.status === 'SECURITY_ALARM') badgeClass = 'security-alarm';

            html += `
                <tr>
                    <td><span style="color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</span></td>
                    <td><strong>${log.email || 'Sistema (Automático)'}</strong> <span style="font-size:0.75rem; color:var(--text-secondary);">(ID: ${log.userId || 'N/A'})</span></td>
                    <td><span style="font-weight: 500;">${log.action}</span></td>
                    <td><span class="status-badge ${badgeClass}">${log.status}</span></td>
                    <td><span style="font-size: 0.85rem; color: var(--text-secondary);">${log.details || 'N/A'}</span></td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    };

    // Setup Admin Logs listeners
    const setupLogsListeners = () => {
        const searchInput = document.getElementById('logSearchInput');
        const filterSelect = document.getElementById('logStatusFilter');

        if (searchInput) searchInput.addEventListener('input', renderLogsTable);
        if (filterSelect) filterSelect.addEventListener('change', renderLogsTable);

        const exportBtn = document.getElementById('exportLogsReportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                showToast('Reporte Exportado', `Se ha generado un archivo PDF de auditoría de seguridad.`);
                window.print();
            });
        }
    };

    // Fetch statistics and populate advanced Chart.js graphs inside deep analysis
    const loadDeepAnalysisCharts = async () => {
        try {
            // 1. Fetch stats, users, and logs parallelly
            const [statsRes, usersRes, logsRes] = await Promise.all([
                secureFetch('/api/admin/stats'),
                secureFetch('/api/admin/users'),
                secureFetch('/api/admin/logs')
            ]);

            if (!statsRes || !usersRes || !logsRes) return;

            const statsData = await statsRes.json();
            const usersData = await usersRes.json();
            const logsData = await logsRes.json();

            if (statsRes.ok && usersRes.ok && logsRes.ok) {
                // Populate Metric 1: Tasa de Aprobación KYC
                const totalUsers = usersData.users.length;
                const approvedUsers = usersData.users.filter(u => u.kycStatus === 'Aprobado').length;
                const rate = totalUsers > 0 ? Math.round((approvedUsers / totalUsers) * 100) : 0;
                const rateEl = document.getElementById('statsKycRate');
                if (rateEl) rateEl.innerText = `${rate}%`;

                // Populate Metric 2: Archivos Promedio size
                const totalAssets = statsData.totalAssets || 0;
                const totalBytes = statsData.totalBytes || 0;
                const avgSize = totalAssets > 0 ? totalBytes / totalAssets : 0;
                const avgEl = document.getElementById('statsAvgFileSize');
                if (avgEl) avgEl.innerText = formatBytes(avgSize);

                // Populate Metric 3: Alertas de Seguridad count
                const alarms = logsData.logs.filter(l => l.status === 'SECURITY_ALARM').length;
                const alarmsEl = document.getElementById('statsSecurityAlarms');
                if (alarmsEl) alarmsEl.innerText = alarms;

                // 2. Render Category Distribution Chart (Doughnut Chart)
                renderCategoryChart(logsData.logs);

                // 3. Render Latency Mock Chart (Line Chart)
                renderLatencyChart();
            }
        } catch(error) {
            console.error('Error compiling deep analysis statistics:', error);
        }
    };

    // Render Doughnut Chart for Asset Classification
    const renderCategoryChart = (logs) => {
        const canvas = document.getElementById('categoryDistributionChart');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            const parent = canvas.parentElement;
            if (parent) {
                parent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.9rem;">Distribución no disponible.</div>';
            }
            return;
        }

        // Destroy previous instance if it exists
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        // Distribution stats
        let legalCount = 0;
        let codeCount = 0;
        let designCount = 0;

        const blindajeLogs = logs.filter(l => l.action === 'Blindaje de Activo');
        blindajeLogs.forEach(l => {
            if (l.details.includes('Código Fuente')) codeCount++;
            else if (l.details.includes('Diseño / Imagen')) designCount++;
            else legalCount++;
        });

        // Fallbacks if logs are empty (add default starting data)
        if (blindajeLogs.length === 0) {
            legalCount = 4;
            codeCount = 2;
            designCount = 1;
        }

        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Documentos Legales', 'Código Fuente', 'Diseños / Imagen'],
                datasets: [{
                    data: [legalCount, codeCount, designCount],
                    backgroundColor: ['#3b82f6', '#10b981', '#ec4899'],
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: 'rgba(255,255,255,0.6)', usePointStyle: true, padding: 12 }
                    }
                }
            }
        });
    };

    // Render Line Chart for Latency history
    const renderLatencyChart = () => {
        const canvas = document.getElementById('latencyTrendChart');
        if (!canvas) return;

        if (typeof Chart === 'undefined') {
            const parent = canvas.parentElement;
            if (parent) {
                parent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.9rem;">Latencia no disponible.</div>';
            }
            return;
        }

        if (latencyChartInstance) {
            latencyChartInstance.destroy();
        }

        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

        latencyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
                datasets: [{
                    label: 'Latencia del Firewall (ms)',
                    data: [122, 115, 128, 110, 115, 120, 118],
                    borderColor: '#8b5cf6',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#8b5cf6',
                    pointBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, beginAtZero: false },
                    x: { grid: { display: false } }
                }
            }
        });
    };

    const showToast = (title, message, icon = '✅') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
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
        }, 3000);
    };

    // Global Report Generation
    const btnReport = document.getElementById('generateReportBtn');
    if (btnReport) {
        btnReport.addEventListener('click', () => {
            const ogText = btnReport.innerText;
            btnReport.innerText = 'Compilando...';
            btnReport.disabled = true;
            btnReport.style.opacity = '0.7';
            setTimeout(() => {
                showToast('Reporte Global Generado', 'El informe analítico completo del sistema fue enviado a su correo de supervisor.');
                btnReport.innerText = ogText;
                btnReport.disabled = false;
                btnReport.style.opacity = '1';
            }, 1500);
        });
    }

    const handleLogout = () => {
        const logoutBtns = document.querySelectorAll('.logout');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                localStorage.removeItem('ordenis_user');
                localStorage.removeItem('ordenis_token');
            });
        });
    };

    // 4. Load Users list and verify identities
    const loadUsers = async () => {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) return;

        try {
            const response = await secureFetch('/api/admin/users');
            if (!response) return;
            const data = await response.json();

            if (response.ok && data.users) {
                clientUsersCache = data.users;
                // Populate users list and chart dynamically
                updateChartWithUsers(data.users);
                populateAuditsTable(data.users);

                let html = '';
                if (data.users.length === 0) {
                    html = '<tr><td colspan="6" style="text-align:center;">No hay usuarios registrados en el sistema.</td></tr>';
                } else {
                    data.users.forEach(u => {
                        const statusClass = u.kycStatus === 'Aprobado' ? 'success' : (u.kycStatus === 'Rechazado' ? 'error' : 'warning');
                        
                        // Si tiene selfie biométrico, mostramos un score
                        const hasBio = u.biometricScore > 0;
                        const bioScoreText = hasBio ? `<span style="font-family: monospace; font-weight: bold; color: ${u.biometricScore >= 65 ? '#10b981' : '#eab308'};" title="Score de Validación de IA">${u.biometricScore.toFixed(1)}%</span>` : '<span style="color: var(--text-secondary);">Sin Bio</span>';
                        
                        const docLink = u.kycFilePath ? `<button class="btn-link action-download-kyc" data-path="${u.kycFilePath}" style="font-size: 0.8rem; background:none; border:none; padding:0; cursor:pointer; color: #3B82F6; margin-right: 8px;">DNI 📥</button>` : 'Sin Doc';
                        
                        const auditBtn = hasBio ? `<button class="btn-primary btn-sm action-audit-biometry" data-id="${u.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: var(--gradient-brand); border: none; margin-right: 4px; color: white; cursor: pointer;">🔍 Auditar</button>` : '';

                        html += `
                            <tr>
                                <td><strong>${u.name}</strong></td>
                                <td>${u.company || 'Independiente'}</td>
                                <td>${u.email}</td>
                                <td>${u.docId} (${bioScoreText})</td>
                                <td><span class="status-badge ${statusClass}">${u.kycStatus || 'Pendiente'}</span></td>
                                <td style="display: flex; gap: 0.2rem; align-items: center;">
                                    ${docLink}
                                    ${auditBtn}
                                    <button class="btn-primary btn-sm action-kyc" data-id="${u.id}" data-action="Aprobado" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; border: none; background: #10b981; cursor: pointer; color: white;">✓</button>
                                    <button class="btn-primary btn-sm action-kyc" data-id="${u.id}" data-action="Rechazado" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; background: #ef4444; border: none; cursor: pointer; color: white;">✕</button>
                                </td>
                            </tr>
                        `;
                    });
                }
                tableBody.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading users:', error);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar la lista de usuarios.</td></tr>';
        }
    };

    // Función para abrir el Modal de Auditoría Biométrica Lado a Lado
    const openBiometricAudit = (user) => {
        const modal = document.getElementById('biometricAuditModal');
        const nameEl = document.getElementById('auditUserName');
        const docEl = document.getElementById('auditUserDoc');
        const badgeEl = document.getElementById('auditKycBadge');
        const scoreEl = document.getElementById('auditScoreText');
        const dniImg = document.getElementById('auditDniImage');
        const selfieImg = document.getElementById('auditSelfieImage');
        const detailBox = document.getElementById('auditStatusDetailBox');

        if (!modal) return;

        nameEl.innerText = user.name + ` (${user.company || 'Independiente'})`;
        docEl.innerText = `DNI / Documento: ${user.docId} | Correo: ${user.email}`;
        
        const score = user.biometricScore || 0;
        scoreEl.innerText = `${score.toFixed(2)}% de Coincidencia`;
        
        if (score >= 65) {
            scoreEl.style.color = '#10b981';
            badgeEl.className = 'status-badge success';
            badgeEl.innerText = 'Biometría Óptima';
            detailBox.innerText = `El motor biométrico local de ORDENIS ha validado exitosamente la identidad facial 1:1 de este usuario con una confianza excelente del ${score.toFixed(2)}%. El KYC fue aprobado automáticamente.`;
        } else if (score >= 40) {
            scoreEl.style.color = '#eab308';
            badgeEl.className = 'status-badge warning';
            badgeEl.innerText = 'Verificación Pendiente';
            detailBox.innerText = `El motor biométrico registró una correspondencia parcial del ${score.toFixed(2)}%. Esto puede deberse a mala iluminación en el selfie o calidad baja del DNI. Por favor compare visualmente ambas fotos y tome una decisión.`;
        } else {
            scoreEl.style.color = '#ef4444';
            badgeEl.className = 'status-badge error';
            badgeEl.innerText = 'Alarma Biométrica';
            detailBox.innerText = `¡ADVERTENCIA! El porcentaje de coincidencia facial fue de apenas ${score.toFixed(2)}%, lo cual representa un riesgo crítico de suplantación de identidad. Se recomienda el rechazo inmediato de la cuenta.`;
        }

        // Cargar imágenes de DNI y Selfie de forma segura
        dniImg.src = user.kycFilePath || 'dummy_kyc.pdf';
        selfieImg.src = user.selfieFilePath || '';

        // Configurar botones de acción del modal
        const approveBtn = document.getElementById('btnApproveKyc');
        const rejectBtn = document.getElementById('btnRejectKyc');

        // Eliminar listeners previos clonando los botones (para evitar fugas y dobles peticiones)
        const newApproveBtn = approveBtn.cloneNode(true);
        const newRejectBtn = rejectBtn.cloneNode(true);
        approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
        rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);

        newApproveBtn.addEventListener('click', () => {
            executeKycAction(user.id, 'Aprobado');
            modal.style.display = 'none';
        });

        newRejectBtn.addEventListener('click', () => {
            executeKycAction(user.id, 'Rechazado');
            modal.style.display = 'none';
        });

        modal.style.display = 'flex';
    };

    // Helper para ejecutar la acción de KYC del Modal
    const executeKycAction = async (userId, action) => {
        try {
            const response = await secureFetch('/api/admin/verify-kyc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: action })
            });
            if (!response) return;
            const data = await response.json();
            
            if (response.ok) {
                showToast('KYC Actualizado', `La identidad del usuario fue marcada como: ${action}`);
                loadUsers(); // refresh data
                loadDashboardStats(); // refresh counts
            } else {
                showToast('Error', data.error, 'error');
            }
        } catch (error) {
            showToast('Error', 'No se pudo contactar al servidor', 'error');
        }
    };

    // KYC Approval/Rejection Delegation
    const usersTableBody = document.getElementById('usersTableBody');
    if (usersTableBody) {
        usersTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('action-kyc')) {
                const userId = e.target.getAttribute('data-id');
                const action = e.target.getAttribute('data-action');
                executeKycAction(userId, action);
            } else if (e.target.classList.contains('action-audit-biometry')) {
                const userId = e.target.getAttribute('data-id');
                const user = clientUsersCache.find(u => String(u.id) === String(userId));
                if (user) {
                    openBiometricAudit(user);
                }
            } else if (e.target.classList.contains('action-download-kyc')) {
                const kycPath = e.target.getAttribute('data-path');

                showToast('Abriendo...', 'Descargando comprobante de forma segura.', '🔄');

                try {
                    const response = await secureFetch(`/api/download-kyc?path=${encodeURIComponent(kycPath)}`);
                    if (!response) return;

                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                    } else {
                        const data = await response.json();
                        showToast('Error', data.error || 'No se pudo descargar el archivo KYC.', 'error');
                    }
                } catch(error) {
                    showToast('Error', 'Problema al comunicarse con el servidor.', 'error');
                }
            }
        });
    }

    if (document.getElementById('mainChart')) { 
        initChart(); 
        loadDashboardStats(); 
        loadUsers(); 
    }
    handleNavigation();
    setupLogsListeners();
    handleLogout();
});
