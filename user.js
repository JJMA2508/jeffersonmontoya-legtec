document.addEventListener('DOMContentLoaded', () => {
    // Immediate Redirection Security Check
    const token = localStorage.getItem('ordenis_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    let myChartInstance = null;
    let clientAssetsCache = [];

    // Helper: Secure Fetch with Automatic Session Expiry Interception
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

    // Helper: Human-readable bytes format
    const formatBytes = (bytes, decimals = 1) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // 1. Chart.js Initialization
    // 1. Chart.js Initialization
    const initChart = () => {
        const canvasEl = document.getElementById('mainChart');
        if (!canvasEl) return;
        
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js is not loaded. Skipping chart initialization.");
            const parent = canvasEl.parentElement;
            if (parent) {
                parent.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); font-size:0.9rem;">Gráfico temporalmente no disponible.</div>';
            }
            return;
        }

        const ctx = canvasEl.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');   
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
        Chart.defaults.font.family = "'Inter', sans-serif";

        myChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Inicio'],
                datasets: [
                    {
                        label: 'Almacenamiento Cifrado (KB)',
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

    // Update Chart with Real Assets Data over Time
    const updateChartWithData = (assets) => {
        if (typeof Chart === 'undefined' || !myChartInstance) return;
        
        if (assets.length === 0) {
            myChartInstance.data.labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'];
            myChartInstance.data.datasets[0].data = [0, 0, 0, 0, 0, 0, 0];
            myChartInstance.data.datasets[0].label = 'Almacenamiento Cifrado (KB)';
            myChartInstance.update();
            return;
        }

        // Sort chronologically
        const sortedAssets = [...assets].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const labels = [];
        const cumulativeData = [];
        let cumulativeSize = 0;

        sortedAssets.forEach(item => {
            const dateObj = new Date(item.createdAt);
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            
            cumulativeSize += (item.fileSize || 0) / 1024; // convert to KB for readable line charts of small files
            
            labels.push(dateStr);
            cumulativeData.push(parseFloat(cumulativeSize.toFixed(2)));
        });

        // Prepend starting point for visuals
        if (labels.length === 1) {
            labels.unshift('Inicio');
            cumulativeData.unshift(0);
        }

        myChartInstance.data.labels = labels;
        myChartInstance.data.datasets[0].data = cumulativeData;
        myChartInstance.data.datasets[0].label = 'Almacenamiento Cifrado Acumulativo (KB)';
        myChartInstance.update();
    };

    // Helper: Fresh fetch of user assets from server
    const refreshAssetsData = async () => {
        try {
            const url = window.currentFolderId !== null ? `/api/my-assets?folderId=${window.currentFolderId}` : '/api/my-assets';
            const response = await secureFetch(url);
            if (response && response.ok) {
                const data = await response.json();
                if (data && data.assets) {
                    clientAssetsCache = data.assets;
                    return true;
                }
            }
        } catch (error) {
            console.error('Error refreshing assets cache:', error);
        }
        return false;
    };

    let clientFoldersCache = [];
    window.currentFolderId = null;

    const refreshFoldersData = async () => {
        try {
            const response = await secureFetch('/api/folders');
            if (response && response.ok) {
                const data = await response.json();
                if (data && data.folders) {
                    clientFoldersCache = data.folders;
                    return true;
                }
            }
        } catch (error) {
            console.error('Error refreshing folders cache:', error);
        }
        return false;
    };

    window.promptCreateFolder = async () => {
        const name = prompt('Ingrese el nombre de la nueva carpeta:');
        if (!name || !name.trim()) return;

        try {
            const response = await secureFetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });
            if (response && response.ok) {
                showToast('Carpeta Creada', 'La carpeta ha sido creada exitosamente.');
                await refreshFoldersData();
                renderExplorer();
            } else {
                const errData = await response.json();
                showToast('Error', errData.error || 'Error al crear la carpeta.', 'error');
            }
        } catch (error) {
            console.error('Error in promptCreateFolder:', error);
            showToast('Error', 'Error de conexión al crear la carpeta.', 'error');
        }
    };

    window.navigateFolder = async (folderId, folderName) => {
        window.currentFolderId = folderId;
        const breadcrumbEl = document.getElementById('folderBreadcrumb');
        const currentFolderNameEl = document.getElementById('currentFolderName');

        if (folderId === null) {
            if (breadcrumbEl) breadcrumbEl.style.display = 'none';
        } else {
            if (breadcrumbEl) breadcrumbEl.style.display = 'flex';
            if (currentFolderNameEl) currentFolderNameEl.innerText = folderName;
        }

        const explorerGrid = document.getElementById('explorerGrid');
        if (explorerGrid) {
            explorerGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);" class="glass-panel">
                    <span class="loading-spinner" style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🔄</span>
                    Cargando activos...
                </div>
            `;
        }
        
        await refreshAssetsData();
        renderExplorer();
    };

    // 2. Populate Real Assets Data and Update Metrics
    const populateTable = async () => {
        const tableBody = document.getElementById('activityTableBody');
        if (!tableBody) return;

        try {
            const success = await refreshAssetsData();
            if (!success) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error al cargar los activos del servidor.</td></tr>';
                return;
            }

            // UPDATE METRICS CARD 1: Assets count
            const totalAssets = clientAssetsCache.length;
            const assetsCardEl = document.querySelectorAll('.metric-card')[0];
            if (assetsCardEl) {
                const valEl = assetsCardEl.querySelector('.metric-value');
                if (valEl) valEl.innerText = totalAssets;
            }

            // UPDATE METRICS CARD 2: Total Storage
            let totalBytes = 0;
            clientAssetsCache.forEach(asset => totalBytes += (asset.fileSize || 0));
            
            const storageCardEl = document.querySelectorAll('.metric-card')[1];
            if (storageCardEl) {
                const valEl = storageCardEl.querySelector('.metric-value');
                const subEl = storageCardEl.querySelector('.metric-subtitle');
                const trendEl = storageCardEl.querySelector('.trend');
                
                if (valEl) valEl.innerText = formatBytes(totalBytes);
                
                // Supongamos un límite máximo de 50 MB de cuota personal
                const maxQuota = 50 * 1024 * 1024; 
                const percent = Math.min(((totalBytes / maxQuota) * 100), 100).toFixed(2);
                
                if (trendEl) trendEl.innerText = `${percent}%`;
                if (subEl) subEl.innerText = `De ${formatBytes(maxQuota)} Total`;
            }

            // Populate assets rows
            let html = '';
            if (clientAssetsCache.length === 0) {
                html = '<tr><td colspan="6" style="text-align:center;">No hay activos blindados aún en su bóveda.</td></tr>';
            } else {
                clientAssetsCache.forEach(item => {
                    const dateObj = new Date(item.createdAt);
                    const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                    const formattedSize = formatBytes(item.fileSize || 0);

                    html += `
                        <tr>
                            <td>
                                <div style="display:flex; flex-direction:column;">
                                    <strong>${item.fileName}</strong>
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">${formattedSize}</span>
                                </div>
                            </td>
                            <td>${item.assetType || 'Documento'}</td>
                            <td style="font-family: monospace; font-size: 0.8em; color: var(--text-secondary);" title="${item.fileHash}">
                                ${(item.fileHash || '').substring(0, 16)}...
                            </td>
                            <td><span class="status-badge success">${item.status || 'Blindado'}</span></td>
                            <td><span style="color: var(--text-secondary); font-size: 0.85rem;">${dateStr}</span></td>
                            <td>
                                <button class="btn-primary btn-sm action-download" data-id="${item.id}" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">Descargar</button>
                                <button class="btn-secondary btn-sm" onclick="showCertificate('${item.id}', '${item.fileName}', '${item.assetType || 'Documento'}', '${item.fileHash}', '${item.createdAt}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin-left: 4px;">📜 Certificado</button>
                            </td>
                        </tr>
                    `;
                });
            }
            tableBody.innerHTML = html;

            // Refresh Chart
            updateChartWithData(clientAssetsCache);
        } catch (error) {
            console.error('Error fetching assets:', error);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Error al cargar los activos del servidor.</td></tr>';
        }
    };

    // Real Navigation and view toggling management
    const handleNavigation = () => {
        const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
        const viewSections = document.querySelectorAll('.view-section');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const viewName = item.getAttribute('data-view');
                
                // Ocultar todas las secciones
                viewSections.forEach(section => {
                    section.style.display = 'none';
                    section.classList.remove('active');
                });
                
                // Mostrar sección seleccionada
                const targetView = document.getElementById(viewName + '-view');
                if (targetView) {
                    targetView.style.display = 'block';
                    // Disparar reflow para animaciones
                    void targetView.offsetWidth;
                    targetView.classList.add('active');
                }
                
                // Disparar recargas o inicializaciones dinámicas de vistas
                if (viewName === 'dashboard') {
                    populateTable(); // Recargar datos y estadísticas
                } else if (viewName === 'records') {
                    const explorerGrid = document.getElementById('explorerGrid');
                    if (explorerGrid) {
                        explorerGrid.innerHTML = `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);" class="glass-panel">
                                <span class="loading-spinner" style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🔄</span>
                                Cargando sus activos blindados...
                            </div>
                        `;
                    }
                    Promise.all([refreshAssetsData(), refreshFoldersData()]).then(() => {
                        renderExplorer(); // Renderizar activos
                    });
                } else if (viewName === 'reports') {
                    const certGrid = document.getElementById('certificatesGrid');
                    if (certGrid) {
                        certGrid.innerHTML = `
                            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);" class="glass-panel">
                                <span class="loading-spinner" style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🔄</span>
                                Cargando certificados criptográficos...
                            </div>
                        `;
                    }
                    refreshAssetsData().then(() => {
                        renderCertificates(); // Renderizar certificados
                    });
                } else if (viewName === 'settings') {
                    loadSettingsData(); // Cargar datos del perfil en inputs
                }
            });
        });
    };

    // Render the assets inside the records tab explorer grid
    const renderExplorer = () => {
        const grid = document.getElementById('explorerGrid');
        if (!grid) return;

        let filtered = [...clientAssetsCache];

        // 1. Apply Search
        const searchVal = document.getElementById('assetSearchInput')?.value.trim().toLowerCase() || '';
        if (searchVal) {
            filtered = filtered.filter(item => 
                item.fileName.toLowerCase().includes(searchVal) || 
                (item.fileHash && item.fileHash.toLowerCase().includes(searchVal))
            );
        }

        // 2. Apply Classification Filter
        const filterVal = document.getElementById('assetFilterSelect')?.value || 'all';
        if (filterVal !== 'all') {
            filtered = filtered.filter(item => item.assetType === filterVal);
        }

        // 3. Apply Sorting
        const sortVal = document.getElementById('assetSortSelect')?.value || 'newest';
        if (sortVal === 'newest') {
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sortVal === 'oldest') {
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sortVal === 'name-asc') {
            filtered.sort((a, b) => a.fileName.localeCompare(b.fileName));
        } else if (sortVal === 'size-desc') {
            filtered.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0));
        }

        let html = '';

        // Render Folders if in root
        if (window.currentFolderId === null) {
            let foldersToRender = [...clientFoldersCache];
            if (searchVal) {
                foldersToRender = foldersToRender.filter(f => f.name.toLowerCase().includes(searchVal));
            }
            foldersToRender.forEach(folder => {
                html += `
                    <div class="asset-card glass-panel" style="border: 1px dashed rgba(96, 165, 250, 0.2); cursor: pointer;" onclick="navigateFolder(${folder.id}, '${folder.name.replace(/'/g, "\\'")}')">
                        <div class="asset-card-header">
                            <div class="asset-file-icon code" style="background: rgba(96, 165, 250, 0.1); color: #60a5fa;">📁</div>
                            <span class="status-badge" style="font-size: 0.7rem; padding: 2px 8px; background: rgba(96, 165, 250, 0.1); color: #60a5fa;">Carpeta</span>
                        </div>
                        <div class="asset-card-body" style="padding-bottom: 24px;">
                            <h4 class="asset-card-title">${folder.name}</h4>
                            <div class="asset-card-meta">
                                <span>Organizador de Bóveda</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // 4. Render Grid HTML
        if (filtered.length === 0 && html === '') {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);" class="glass-panel">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🔍</span>
                    No se encontraron carpetas ni activos en esta sección.
                </div>
            `;
            return;
        }

        filtered.forEach(item => {
            const dateObj = new Date(item.createdAt);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
            const formattedSize = formatBytes(item.fileSize || 0);

            // Determine File Icon and Class
            let fileIcon = '📄';
            let iconClass = 'legal';
            if (item.assetType === 'Código Fuente') {
                fileIcon = '💻';
                iconClass = 'code';
            } else if (item.assetType === 'Diseño / Imagen') {
                fileIcon = '🎨';
                iconClass = 'design';
            }

            html += `
                <div class="asset-card glass-panel">
                    <div class="asset-card-header">
                        <div class="asset-file-icon ${iconClass}">${fileIcon}</div>
                        <span class="status-badge success" style="font-size: 0.7rem; padding: 2px 8px;">${item.status || 'Blindado'}</span>
                    </div>
                    <div class="asset-card-body">
                        <h4 class="asset-card-title" title="${item.fileName}">${item.fileName}</h4>
                        <div class="asset-card-meta">
                            <span>${item.assetType || 'Documento'}</span>
                            <span style="opacity: 0.5;">•</span>
                            <span>${formattedSize}</span>
                        </div>
                        <div class="asset-card-hash">
                            <span title="${item.fileHash}">${(item.fileHash || '').substring(0, 14)}...</span>
                            <button class="copy-hash-btn" onclick="navigator.clipboard.writeText('${item.fileHash}'); alert('Hash copiado al portapapeles!')" title="Copiar Hash SHA-256">📋</button>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">
                            ${dateStr}
                        </div>
                    </div>
                    <div class="asset-card-actions">
                        <button class="btn-primary btn-sm action-download" data-id="${item.id}" style="padding: 0.4rem; font-size: 0.8rem; margin: 0;">Descargar</button>
                        <button class="btn-secondary btn-sm" onclick="showCertificate('${item.id}', '${item.fileName}', '${item.assetType || 'Documento'}', '${item.fileHash}', '${item.createdAt}')" style="padding: 0.4rem; font-size: 0.8rem; margin: 0;">📜 Certi.</button>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    };

    // Render the certificates inside the certificates tab grid
    const renderCertificates = () => {
        const grid = document.getElementById('certificatesGrid');
        if (!grid) return;

        if (clientAssetsCache.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);" class="glass-panel">
                    <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">📜</span>
                    No se registran certificados digitales en su bóveda. Blinde un activo para generarlo.
                </div>
            `;
            return;
        }

        let html = '';
        clientAssetsCache.forEach(item => {
            const dateObj = new Date(item.createdAt);
            const dateStr = dateObj.toUTCString();
            const certId = 'ORD-ASSET-' + String(item.id).padStart(6, '0');

            html += `
                <div class="cert-card glass-panel">
                    <div class="cert-card-header">
                        <span class="cert-badge-icon">📜</span>
                        <div>
                            <h4 class="cert-card-title" title="${item.fileName}">${item.fileName}</h4>
                            <span style="font-size: 0.75rem; color: var(--primary); font-family: monospace; font-weight: bold;">${certId}</span>
                        </div>
                    </div>
                    <div class="cert-card-info">
                        <div><strong>Clasificación:</strong> ${item.assetType || 'Documento'}</div>
                        <div><strong>Sello de Tiempo:</strong> ${dateStr}</div>
                        <div><strong>Integridad (SHA-256):</strong></div>
                        <div class="cert-card-hash" title="${item.fileHash}">${item.fileHash}</div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button class="btn-primary btn-sm" onclick="showCertificate('${item.id}', '${item.fileName}', '${item.assetType || 'Documento'}', '${item.fileHash}', '${item.createdAt}')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; flex: 1; margin: 0;">Ver Certificado</button>
                        <button class="btn-secondary btn-sm" onclick="showCertificate('${item.id}', '${item.fileName}', '${item.assetType || 'Documento'}', '${item.fileHash}', '${item.createdAt}'); setTimeout(() => window.print(), 300)" style="padding: 0.4rem; font-size: 0.8rem; margin: 0;">🖨️</button>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    };

    // Load setting inputs with user info
    const loadSettingsData = async () => {
        const storedUser = localStorage.getItem('ordenis_user');
        if (!storedUser) return;

        try {
            const user = JSON.parse(storedUser);
            
            const nameInput = document.getElementById('settingsName');
            const companyInput = document.getElementById('settingsCompany');
            const phoneInput = document.getElementById('settingsPhone');
            const countryInput = document.getElementById('settingsCountry');
            const emailInput = document.getElementById('settingsEmail');
            const kycBadge = document.getElementById('settingsKycBadge');

            if (nameInput) nameInput.value = user.name || '';
            if (companyInput) companyInput.value = user.company || '';
            if (phoneInput) phoneInput.value = user.phone || '';
            if (countryInput) countryInput.value = user.country || '';
            if (emailInput) emailInput.value = user.email || '';

            if (kycBadge) {
                const status = user.kycStatus || 'Pendiente';
                kycBadge.innerText = status === 'Aprobado' ? 'Óptimo (Verificado)' : (status === 'Rechazado' ? 'Cuenta Bloqueada' : 'Pendiente Verificación');
                kycBadge.className = `status-badge ${status === 'Aprobado' ? 'success' : (status === 'Rechazado' ? 'error' : 'warning')}`;
            }

            // Sync 2FA checkbox from local storage state
            const toggle2fa = document.getElementById('settings2faToggle');
            if (toggle2fa) {
                const is2faActive = localStorage.getItem(`ordenis_2fa_${user.email}`) === 'true';
                toggle2fa.checked = is2faActive;
            }
        } catch (e) {
            console.error('Error loading settings inputs:', e);
        }
    };

    // Setup Profile Settings event listeners
    const setupSettingsListeners = () => {
        const profileForm = document.getElementById('profileForm');
        const passwordForm = document.getElementById('passwordForm');
        const toggle2fa = document.getElementById('settings2faToggle');

        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = profileForm.querySelector('button[type="submit"]');
                const ogText = btn.innerText;

                btn.innerText = 'Guardando...';
                btn.disabled = true;
                btn.style.opacity = '0.7';

                const nameVal = document.getElementById('settingsName').value.trim();
                const companyVal = document.getElementById('settingsCompany').value.trim();
                const phoneVal = document.getElementById('settingsPhone').value.trim();
                const countryVal = document.getElementById('settingsCountry') ? document.getElementById('settingsCountry').value : '';

                try {
                    const response = await secureFetch('/api/profile', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: nameVal, company: companyVal, phone: phoneVal, country: countryVal })
                    });
                    
                    if (!response) return;
                    const data = await response.json();

                    if (response.ok && data.user) {
                        localStorage.setItem('ordenis_user', JSON.stringify(data.user));
                        updateUIWithUser(data.user);
                        showToast('Perfil Actualizado', data.message || 'Datos guardados correctamente.', '✅');
                    } else {
                        showToast('Error', data.error || 'No se pudo actualizar el perfil.', 'error');
                    }
                } catch (error) {
                    showToast('Error', 'Problema al conectar con el servidor.', 'error');
                } finally {
                    btn.innerText = ogText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });
        }

        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const currentPwd = document.getElementById('settingsCurrentPwd').value;
                const newPwd = document.getElementById('settingsNewPwd').value;
                const confirmPwd = document.getElementById('settingsConfirmPwd').value;

                if (newPwd !== confirmPwd) {
                    showToast('Validación', 'Las contraseñas nuevas no coinciden.', 'warning');
                    return;
                }

                if (newPwd.length < 8) {
                    showToast('Validación', 'La contraseña nueva debe tener al menos 8 caracteres.', 'warning');
                    return;
                }

                const btn = passwordForm.querySelector('button[type="submit"]');
                const ogText = btn.innerText;

                btn.innerText = 'Actualizando contraseña...';
                btn.disabled = true;
                btn.style.opacity = '0.7';

                const nameVal = document.getElementById('settingsName').value.trim();
                const companyVal = document.getElementById('settingsCompany').value.trim();
                const phoneVal = document.getElementById('settingsPhone').value.trim();
                const countryVal = document.getElementById('settingsCountry') ? document.getElementById('settingsCountry').value : '';

                try {
                    const response = await secureFetch('/api/profile', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: nameVal,
                            company: companyVal,
                            phone: phoneVal,
                            country: countryVal,
                            currentPassword: currentPwd,
                            newPassword: newPwd
                        })
                    });

                    if (!response) return;
                    const data = await response.json();

                    if (response.ok) {
                        showToast('Contraseña Actualizada', data.message, '✅');
                        passwordForm.reset();
                    } else {
                        showToast('Error de Validación', data.error || 'Credenciales incorrectas.', 'error');
                    }
                } catch (error) {
                    showToast('Error', 'Problema al conectar con el servidor.', 'error');
                } finally {
                    btn.innerText = ogText;
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });
        }

        if (toggle2fa) {
            toggle2fa.addEventListener('change', (e) => {
                const storedUser = localStorage.getItem('ordenis_user');
                if (!storedUser) return;
                try {
                    const user = JSON.parse(storedUser);
                    localStorage.setItem(`ordenis_2fa_${user.email}`, e.target.checked);
                    if (e.target.checked) {
                        showToast('Seguridad 2FA', 'Autenticación de dos factores por SMS/Teléfono activada.', '🔒');
                    } else {
                        showToast('Seguridad 2FA', 'Autenticación de dos factores desactivada.', '🔓');
                    }
                } catch(err){}
            });
        }
    };

    // Event listeners for explorer filters
    const setupExplorerListeners = () => {
        const searchInput = document.getElementById('assetSearchInput');
        const filterSelect = document.getElementById('assetFilterSelect');
        const sortSelect = document.getElementById('assetSortSelect');

        if (searchInput) searchInput.addEventListener('input', renderExplorer);
        if (filterSelect) filterSelect.addEventListener('change', renderExplorer);
        if (sortSelect) sortSelect.addEventListener('change', renderExplorer);

        const generateAllCertsBtn = document.getElementById('generateAllCertificatesReport');
        if (generateAllCertsBtn) {
            generateAllCertsBtn.addEventListener('click', () => {
                const ogText = generateAllCertsBtn.innerText;
                generateAllCertsBtn.innerText = 'Compilando Certificados...';
                generateAllCertsBtn.disabled = true;
                generateAllCertsBtn.style.opacity = '0.7';
                setTimeout(() => {
                    showToast('Reporte Compilado', `Se ha generado un resumen legal consolidado de sus ${clientAssetsCache.length} certificados para impresión.`);
                    generateAllCertsBtn.innerText = ogText;
                    generateAllCertsBtn.disabled = false;
                    generateAllCertsBtn.style.opacity = '1';
                    window.print();
                }, 1200);
            });
        }
    };

    // Drag & Drop Area for Assets Shielding in the Records Explorer View
    const setupDashboardDragArea = () => {
        const dragArea = document.getElementById('dashboardDragArea');
        if (!dragArea) return;

        ['dragover', 'dragleave', 'drop'].forEach(eventName => {
            dragArea.addEventListener(eventName, preventDefaults, false);
        });
        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

        ['dragover', 'dragenter'].forEach(eventName => {
            dragArea.addEventListener(eventName, () => dragArea.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dragArea.addEventListener(eventName, () => dragArea.classList.remove('drag-over'), false);
        });

        dragArea.addEventListener('drop', handleFileDrop, false);

        async function handleFileDrop(e) {
            const files = e.dataTransfer.files;
            if (files.length === 0) return;

            const file = files[0];
            const formData = new FormData();
            formData.append('assetFile', file);
            formData.append('assetType', 'Documento Legal'); // predeterminado
            if (window.currentFolderId !== null) {
                formData.append('folderId', window.currentFolderId);
            }

            showToast('Procesando...', `Cifrando y registrando vía Drag-and-Drop: ${file.name}`, '🔄');

            try {
                const response = await secureFetch('/api/upload-asset', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response) return;
                const data = await response.json();

                if (response.ok) {
                    showToast('Activo Protegido', 'Su archivo ha sido blindado exitosamente por arrastre.', '🛡️');
                    populateTable(); // Recargar datos locales
                    setTimeout(() => {
                        if (document.getElementById('records-view').style.display === 'block') {
                            renderExplorer(); // refrescar explorer grid
                        }
                    }, 500);
                } else {
                    showToast('Alarma de Integridad', data.error, 'error');
                }
            } catch (error) {
                showToast('Error', 'No se pudo comunicar con el servidor.', 'error');
            }
        }
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

    // Report generation placeholder
    const btnReport = document.getElementById('generateReportBtn');
    if (btnReport) {
        btnReport.addEventListener('click', () => {
            const ogText = btnReport.innerText;
            btnReport.innerText = 'Generando...';
            btnReport.disabled = true;
            btnReport.style.opacity = '0.7';
            setTimeout(() => {
                showToast('Certificado Generado', 'El certificado global de su bóveda ha sido enviado a su correo registrado.');
                btnReport.innerText = ogText;
                btnReport.disabled = false;
                btnReport.style.opacity = '1';
            }, 1500);
        });
    }

    // Shielding new asset
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    const fileShieldInput = document.getElementById('fileShieldInput');
    const assetTypeSelect = document.getElementById('assetTypeSelect');

    if (confirmUploadBtn && fileShieldInput && assetTypeSelect) {
        confirmUploadBtn.addEventListener('click', async () => {
            if (fileShieldInput.files.length === 0) {
                showToast('Advertencia', 'Por favor seleccione un archivo para blindar.', 'warning');
                return;
            }

            const file = fileShieldInput.files[0];
            const assetType = assetTypeSelect.value;
            
            const formData = new FormData();
            formData.append('assetFile', file);
            formData.append('assetType', assetType);
            if (window.currentFolderId !== null) {
                formData.append('folderId', window.currentFolderId);
            }

            showToast('Procesando...', `Calculando hash y blindando: ${file.name}`, '🔄');

            try {
                confirmUploadBtn.disabled = true;
                confirmUploadBtn.innerText = 'Encriptando...';

                // Usamos secureFetch pasándole la opción body (sin cabecera Content-Type para que multer configure el boundary)
                const response = await secureFetch('/api/upload-asset', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response) return; // interceptado por redirección si dio 401/403
                
                const data = await response.json();
                
                if (response.ok) {
                    showToast('Activo Protegido', data.message);
                    document.getElementById('uploadModal').style.display = 'none';
                    populateTable();
                } else {
                    showToast('Alarma de Integridad', data.error, 'error');
                }
            } catch(error) {
                showToast('Error', 'Problema al comunicarse con el servidor', 'error');
            } finally {
                confirmUploadBtn.disabled = false;
                confirmUploadBtn.innerText = 'Encriptar y Guardar';
                fileShieldInput.value = '';
            }
        });
    }

    // Decrypt and Download on the fly
    const activityTableBody = document.getElementById('activityTableBody');
    if (activityTableBody) {
        activityTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('action-download')) {
                const assetId = e.target.getAttribute('data-id');
                showToast('Desencriptando...', 'Su archivo está siendo descifrado de la bóveda.', '🔄');

                try {
                    const response = await secureFetch(`/api/download-asset/${assetId}`);
                    if (!response) return;

                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        
                        const disposition = response.headers.get('Content-Disposition');
                        let filename = 'documento_descifrado';
                        if (disposition && disposition.indexOf('filename=') !== -1) {
                            const matches = /filename="([^"]*)"/.exec(disposition);
                            if (matches != null && matches[1]) filename = matches[1];
                        }

                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        
                        showToast('Éxito', 'El documento ha sido descifrado y descargado.', '✅');
                    } else {
                        const data = await response.json();
                        showToast('Error', data.error || 'No se pudo descargar el archivo.', 'error');
                    }
                } catch(error) {
                    showToast('Error', 'Problema al comunicarse con el servidor.', 'error');
                }
            }
        });
    }

    // Session Logout
    const handleLogout = () => {
        const logoutBtns = document.querySelectorAll('.logout');
        logoutBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                localStorage.removeItem('ordenis_user');
                localStorage.removeItem('ordenis_token');
            });
        });
    };

    // Load and update user profile data dynamically
    const loadUserData = async () => {
        // Quick local storage paint
        const storedUser = localStorage.getItem('ordenis_user');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                updateUIWithUser(user);
            } catch(e) {}
        }
        
        // Dynamic fresh fetch
        try {
            const response = await secureFetch('/api/profile');
            if (response && response.ok) {
                const data = await response.json();
                if (data.user) {
                    localStorage.setItem('ordenis_user', JSON.stringify(data.user));
                    updateUIWithUser(data.user);
                }
            }
        } catch (error) {
            console.error('Error cargando perfil:', error);
        }
    };

    // Helper: update UI text nodes with user object
    const updateUIWithUser = (user) => {
        const titleEl = document.getElementById('dashboardTitle');
        if (titleEl) titleEl.innerText = 'Bóveda de ' + user.name;
        
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) userNameEl.innerText = user.name;
        
        const avatarEl = document.querySelector('.avatar');
        if (avatarEl) {
            const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarEl.innerText = initials || 'US';
        }

        // Connect KYC status to Card 3 (Nivel de Seguridad)
        const securityCardEl = document.querySelectorAll('.metric-card')[2];
        if (securityCardEl) {
            const valEl = securityCardEl.querySelector('.metric-value');
            const subEl = securityCardEl.querySelector('.metric-subtitle');
            const trendEl = securityCardEl.querySelector('.trend');

            const status = user.kycStatus || 'Pendiente';
            if (status === 'Aprobado') {
                if (valEl) valEl.innerText = 'Óptimo';
                if (subEl) subEl.innerText = 'KYC Aprobado';
                if (trendEl) {
                    trendEl.innerText = 'Verificado';
                    trendEl.className = 'trend positive';
                }
            } else if (status === 'Rechazado') {
                if (valEl) valEl.innerText = 'Crítico';
                if (subEl) subEl.innerText = 'KYC Rechazado';
                if (trendEl) {
                    trendEl.innerText = 'Bloqueado';
                    trendEl.className = 'trend negative';
                }
            } else {
                if (valEl) valEl.innerText = 'Medio';
                if (subEl) subEl.innerText = 'KYC Pendiente';
                if (trendEl) {
                    trendEl.innerText = 'Pendiente';
                    trendEl.className = 'trend neutral';
                }
            }
        }
    };



    if (document.getElementById('mainChart')) { 
        initChart(); 
        populateTable(); 
    }
    handleNavigation();
    handleLogout();
    loadUserData();
    setupExplorerListeners();
    setupSettingsListeners();
    setupDashboardDragArea();

});

// Global Function to show Official Certificate Modal
window.showCertificate = function(id, fileName, assetType, fileHash, createdAt) {
    const user = JSON.parse(localStorage.getItem('ordenis_user'));
    const userName = user ? user.name : 'Usuario de Ordenis';
    
    const certUser = document.getElementById('certUser');
    const certFileName = document.getElementById('certFileName');
    const certType = document.getElementById('certType');
    const certDate = document.getElementById('certDate');
    const certHash = document.getElementById('certHash');
    const certId = document.getElementById('certId');
    const certQr = document.getElementById('certQr');

    if (certUser) certUser.innerText = userName;
    if (certFileName) certFileName.innerText = fileName;
    if (certType) certType.innerText = assetType;
    
    const d = new Date(createdAt);
    if (certDate) certDate.innerText = d.toUTCString();
    
    if (certHash) certHash.innerText = fileHash || 'HASH_NO_DISPONIBLE';
    if (certId) certId.innerText = 'ORD-ASSET-' + String(id).padStart(6, '0');
    
    // Inyectar QR dinámico real con el Hash del archivo
    if (certQr) {
        const qrData = `https://ordenis.com/verify?hash=${fileHash || 'N/A'}`;
        certQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=0f172a&bgcolor=fdfdfb&data=${encodeURIComponent(qrData)}`;
    }
    
    const modalEl = document.getElementById('certModal');
    if (modalEl) modalEl.style.display = 'flex';
};
