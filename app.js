// 1. CONFIGURACIÓN E INICIALIZACIÓN
const firebaseConfig = {
    apiKey: "AIzaSyD86xvnjFFHkdMhvHPOkYUn8_PdHgNOEK0",
    authDomain: "misuperappfinanciera.firebaseapp.com",
    databaseURL: "https://misuperappfinanciera-default-rtdb.firebaseio.com",
    projectId: "misuperappfinanciera",
    storageBucket: "misuperappfinanciera.firebasestorage.app",
    messagingSenderId: "320368053330",
    appId: "1:320368053330:web:c85ec9a1108be81617a38b"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let state = { 
    cuentas: [], transacciones: [], presupuestos: {}, categoriasCustom: [], currentBase64: "", selectedColor: "#3b82f6" 
};

const categoriasBase = ['Comida', 'Servicios', 'Transporte', 'Vivienda', 'Ocio', 'Otros'];

let chartInstance = null;
let chartPatrimonioInstance = null;
let chartPresupuestosGrid = []; 
let currentEditId = null;
let currentCuentaEditId = null; 
let currentMovMode = 'pago';

// PLUGIN PARA TEXTO EN CENTRO DE GRÁFICAS DONA (CENTRO PERFECTO)
const centerTextPlugin = {
    id: 'centerText',
    beforeDraw: function(chart) {
        if (chart.config.options.plugins.centerText && chart.config.options.plugins.centerText.display) {
            let ctx = chart.ctx;
            let chartArea = chart.chartArea;
            if(!chartArea) return; 
            
            ctx.restore();
            
            let centerX = chartArea.left + (chartArea.right - chartArea.left) / 2;
            let yCenter = chartArea.top + (chartArea.bottom - chartArea.top) / 2;

            let fontSize = (chart.height / 150).toFixed(2);
            ctx.textBaseline = "middle";
            
            let textTop = chart.config.options.plugins.centerText.title || "TOTAL";
            let textBottom = chart.config.options.plugins.centerText.text;

            ctx.font = "bold " + (fontSize*0.4) + "em sans-serif";
            ctx.fillStyle = "gray";
            ctx.fillText(textTop, centerX - (ctx.measureText(textTop).width / 2), yCenter - 15);

            ctx.font = "900 " + (fontSize*0.9) + "em sans-serif";
            ctx.fillStyle = document.body.getAttribute('data-theme') === 'dark' ? '#fff' : '#1e293b';
            ctx.fillText(textBottom, centerX - (ctx.measureText(textBottom).width / 2), yCenter + 15);
            ctx.save();
        }
    }
};
Chart.register(centerTextPlugin);

// 2. SEGURIDAD DE SESIÓN
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
let inactivityTimer;

function resetTimer() {
    clearTimeout(inactivityTimer);
    if(auth.currentUser) {
        inactivityTimer = setTimeout(() => { auth.signOut().then(() => window.location.reload()); }, 15 * 60 * 1000);
    }
}
window.onload = resetTimer; document.onmousemove = resetTimer; document.onkeypress = resetTimer; document.ontouchstart = resetTimer;

// 3. COMPRESOR E INSTALACIÓN PWA
function comprimirImagen(file, callback) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX_SIZE = 300;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height); callback(canvas.toDataURL('image/jpeg', 0.7));
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
}

let regBase64 = "";
if(document.getElementById('regFoto')) document.getElementById('regFoto').addEventListener('change', function(e) { if(e.target.files[0]) comprimirImagen(e.target.files[0], (base64) => { regBase64 = base64; }); });
if(document.getElementById('perfFile')) document.getElementById('perfFile').addEventListener('change', function(e) { if(e.target.files[0]) comprimirImagen(e.target.files[0], (base64) => { state.currentBase64 = base64; document.getElementById('perfDisplayFoto').src = base64; }); });

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    const btnInstall = document.getElementById('btnInstalarApp');
    if(btnInstall) {
        btnInstall.style.display = 'block';
        btnInstall.addEventListener('click', () => {
            document.getElementById('userMenu').classList.remove('show');
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => { if (choiceResult.outcome === 'accepted') { btnInstall.style.display = 'none'; } deferredPrompt = null; });
        });
    }
});

function toggleAuthForm(type) { document.getElementById('loginForm').style.display = type === 'login' ? 'block' : 'none'; document.getElementById('registerForm').style.display = type === 'register' ? 'block' : 'none'; document.getElementById('resetForm').style.display = type === 'reset' ? 'block' : 'none'; }
function handleLogin() { auth.signInWithEmailAndPassword(document.getElementById('logEmail').value, document.getElementById('logPass').value).catch(e => alert(e.message)); }
function handleRegistro() {
    const email = document.getElementById('regEmail').value; const pass = document.getElementById('regPass').value; const nombre = document.getElementById('regNombre').value;
    if(!nombre) { alert("El nombre es obligatorio"); return; }
    auth.createUserWithEmailAndPassword(email, pass).then((cred) => {
        const defaultPic = `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=3b82f6&color=fff&size=128`;
        db.ref(`Usuarios/${cred.user.uid}/perfil`).set({ nombre: nombre, foto: regBase64 || defaultPic, color: "#3b82f6" }).then(() => alert("Bienvenido " + nombre + "!"));
    }).catch(e => alert(e.message));
}

function handleResetPassword() { auth.sendPasswordResetEmail(document.getElementById('resetEmail').value).then(() => { alert("Enviado"); toggleAuthForm('login'); }).catch(e => alert(e.message)); }
function handleCambiarPassword(e) { e.preventDefault(); const newPass = document.getElementById('newPassword').value; const user = auth.currentUser; if (user) { user.updatePassword(newPass).then(() => { alert("¡Contraseña actualizada exitosamente!"); e.target.reset(); }).catch(error => { if (error.code === 'auth/requires-recent-login') { alert("Debes cerrar sesión y volver a entrar."); } else { alert(error.message); } }); } }
function handleLogout() { auth.signOut().then(() => window.location.reload()); }

// 4. ESTADO EN TIEMPO REAL
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none'; document.getElementById('appDashboard').style.display = 'block';
        if(document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
        resetTimer();
        
        db.ref('Usuarios/' + user.uid).on('value', snap => {
            const data = snap.val() || {};
            state.cuentas = data.cuentas ? Object.values(data.cuentas) : [];
            state.transacciones = data.transacciones ? Object.entries(data.transacciones).map(([id, val]) => ({...val, firebaseId: id})) : [];
            state.presupuestos = data.presupuestos || {};
            state.categoriasCustom = data.categoriasCustom ? Object.values(data.categoriasCustom) : [];
            
            const p = data.perfil || { nombre: "Usuario", foto: "https://via.placeholder.com/100", color: "#3b82f6" };
            state.selectedColor = p.color; document.documentElement.style.setProperty('--primary', p.color);
            document.getElementById('headerGreeting').innerText = `Hola ${p.nombre} :)`; document.getElementById('headerFoto').src = p.foto; document.getElementById('perfDisplayNombre').innerText = p.nombre; document.getElementById('perfDisplayFoto').src = p.foto;
            if(document.getElementById('perfNombre')) document.getElementById('perfNombre').value = p.nombre;
            
            renderAll();
            renderCategoriasCustomConfig();
            
            setTimeout(() => { if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; }, 1500);
        });
    } else {
        document.getElementById('loginScreen').style.display = 'flex'; document.getElementById('appDashboard').style.display = 'none';
        if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; clearTimeout(inactivityTimer);
    }
});

// 5. NAVEGACIÓN Y UI
function toggleUserMenu(e) { e.stopPropagation(); document.getElementById('userMenu').classList.toggle('show'); }
function toggleFab() { const fabMain = document.getElementById('fabMain'); const fabMenu = document.getElementById('fabMenu'); fabMain.classList.toggle('active'); fabMenu.classList.toggle('show'); }
function closeDropdowns() { document.getElementById('userMenu').classList.remove('show'); const fabMain = document.getElementById('fabMain'); const fabMenu = document.getElementById('fabMenu'); if (fabMain && fabMain.classList.contains('active')) { fabMain.classList.remove('active'); fabMenu.classList.remove('show'); } }

function cambiarTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); void t.offsetWidth; }); 
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active'); 
    if(btn) btn.classList.add('active'); 
    
    const fabContainer = document.getElementById('fabContainerMain');
    if(fabContainer) { fabContainer.style.display = (id === 'cuentas') ? 'none' : 'flex'; }
    
    closeDropdowns(); window.scrollTo(0,0); currentEditId = null; 
    if(id !== 'cuentas') cancelarEdicionCuenta();
    document.querySelectorAll('form').forEach(f => { if(!f.closest('#tab-perfil')) f.reset(); });
    ['inCuenta', 'gaFuente', 'movOrigen', 'movDestino'].forEach(eid => { if(document.getElementById(eid)) document.getElementById(eid).disabled = false; });
    if(document.getElementById('ingresoFormTitle')) document.getElementById('ingresoFormTitle').innerText = "Nuevo Ingreso";
    if(document.getElementById('gastoFormTitle')) document.getElementById('gastoFormTitle').innerText = "Nuevo Gasto";
    if(document.getElementById('movTitle')) document.getElementById('movTitle').innerText = "Nuevo Movimiento";
}

function toggleThemeSwitch(checkbox) { const t = checkbox.checked ? 'light' : 'dark'; document.body.setAttribute('data-theme', t); renderChart(); renderPresupuestos(); }

function renderCategoriasCustomConfig() {
    let html = "";
    state.categoriasCustom.forEach(cat => { html += `<div class="custom-cat-tag">${cat} <span onclick="handleDelCatCustom('${cat}')">×</span></div>`; });
    if(state.categoriasCustom.length === 0) html = "<small style='color:var(--muted);'>No tienes extras.</small>";
    document.getElementById('listaCatCustom').innerHTML = html;
    actualizarSelects(); 
}
function handleAddCatCustom(e) {
    e.preventDefault(); const nuevaCat = document.getElementById('nuevaCatInput').value.trim();
    if(nuevaCat && !state.categoriasCustom.includes(nuevaCat) && !categoriasBase.includes(nuevaCat)) {
        let actualizadas = [...state.categoriasCustom, nuevaCat];
        db.ref(`Usuarios/${auth.currentUser.uid}/categoriasCustom`).set(actualizadas).then(() => { document.getElementById('nuevaCatInput').value = ""; });
    }
}
function handleDelCatCustom(catName) {
    if(!confirm(`¿Borrar etiqueta "${catName}"?`)) return;
    let actualizadas = state.categoriasCustom.filter(c => c !== catName);
    db.ref(`Usuarios/${auth.currentUser.uid}/categoriasCustom`).set(actualizadas);
}

// 6. LÓGICA TRANSACCIONAL
function revertirTransaccion(fid) { 
    const t = state.transacciones.find(x => x.firebaseId === fid); if (!t) return {}; let updates = {};
    if (t.tipo === 'ingreso') { const c = state.cuentas.find(x => x.id == t.cuentaId); if(c) updates[`cuentas/${c.id}/saldo`] = c.saldo - t.monto; } 
    else if (t.tipo === 'gasto') { const c = state.cuentas.find(x => x.id == t.cuentaId); if(c) updates[`cuentas/${c.id}/saldo`] = (c.tipo === 'debito' || c.tipo === 'efectivo') ? c.saldo + t.monto : c.saldo - t.monto; } 
    else if (t.tipo === 'movimiento') { const or = state.cuentas.find(x => x.id == t.origenId); const des = state.cuentas.find(x => x.id == t.destinoId); if(or) updates[`cuentas/${or.id}/saldo`] = or.saldo + t.monto; if(des) updates[`cuentas/${des.id}/saldo`] = (des.tipo === 'debito' || des.tipo === 'efectivo') ? des.saldo - t.monto : des.saldo + t.monto; }
    return updates;
}
function eliminarTransaccion(fid) { if(!confirm("¿Borrar y devolver saldos?")) return; let updates = revertirTransaccion(fid); updates[`transacciones/${fid}`] = null; db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates); }

function handleIngreso(e) {
    e.preventDefault(); const m = parseFloat(document.getElementById('inMonto').value); let updates = currentEditId ? revertirTransaccion(currentEditId) : {};
    const cId = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).cuentaId : document.getElementById('inCuenta').value; const c = state.cuentas.find(x => x.id == cId); let currentSaldo = updates[`cuentas/${c.id}/saldo`] !== undefined ? updates[`cuentas/${c.id}/saldo`] : c.saldo;
    const id = currentEditId || db.ref(`Usuarios/${auth.currentUser.uid}/transacciones`).push().key; const oldFecha = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).fecha : new Date().toISOString().split('T')[0];
    updates[`transacciones/${id}`] = { desc: document.getElementById('inDesc').value, monto: m, tipo: 'ingreso', cuentaId: c.id, fecha: oldFecha }; updates[`cuentas/${c.id}/saldo`] = currentSaldo + m;
    db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates).then(() => { e.target.reset(); currentEditId = null; document.getElementById('inCuenta').disabled = false; document.getElementById('ingresoFormTitle').innerText = "Nuevo Ingreso"; });
}
function editIngreso(fid) { const t = state.transacciones.find(x => x.firebaseId === fid); cambiarTab('ingresos'); document.getElementById('inDesc').value = t.desc; document.getElementById('inMonto').value = t.monto; document.getElementById('inCuenta').value = t.cuentaId; document.getElementById('inCuenta').disabled = true; currentEditId = fid; document.getElementById('ingresoFormTitle').innerText = "Editando Ingreso"; }

function handleGasto(e) {
    e.preventDefault(); const m = parseFloat(document.getElementById('gaMonto').value); let updates = currentEditId ? revertirTransaccion(currentEditId) : {};
    const cId = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).cuentaId : document.getElementById('gaFuente').value; const c = state.cuentas.find(x => x.id == cId); let currentSaldo = updates[`cuentas/${c.id}/saldo`] !== undefined ? updates[`cuentas/${c.id}/saldo`] : c.saldo;
    const id = currentEditId || db.ref(`Usuarios/${auth.currentUser.uid}/transacciones`).push().key; const oldFecha = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).fecha : new Date().toISOString().split('T')[0];
    updates[`transacciones/${id}`] = { desc: document.getElementById('gaDesc').value, cat: document.getElementById('gaCat').value, monto: m, tipo: 'gasto', cuentaId: c.id, fecha: oldFecha }; updates[`cuentas/${c.id}/saldo`] = (c.tipo === 'debito' || c.tipo === 'efectivo') ? currentSaldo - m : currentSaldo + m;
    db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates).then(() => { e.target.reset(); currentEditId = null; document.getElementById('gaFuente').disabled = false; document.getElementById('gastoFormTitle').innerText = "Nuevo Gasto"; });
}
function editGasto(fid) { const t = state.transacciones.find(x => x.firebaseId === fid); cambiarTab('gastos'); document.getElementById('gaDesc').value = t.desc; document.getElementById('gaMonto').value = t.monto; document.getElementById('gaCat').value = t.cat; document.getElementById('gaFuente').value = t.cuentaId; document.getElementById('gaFuente').disabled = true; currentEditId = fid; document.getElementById('gastoFormTitle').innerText = "Editando Gasto"; }

function setMovMode(mode) { currentMovMode = mode; document.getElementById('btnModoPago').style.background = mode === 'pago' ? 'var(--primary)' : 'var(--muted)'; document.getElementById('btnModoTras').style.background = mode === 'traspaso' ? 'var(--primary)' : 'var(--muted)'; document.getElementById('lblDestino').innerText = mode === 'pago' ? 'Destino (Crédito):' : 'Destino (Débito/Efectivo):'; actualizarSelects(); }
function handleMovimiento(e) {
    e.preventDefault(); const m = parseFloat(document.getElementById('movMonto').value); let updates = currentEditId ? revertirTransaccion(currentEditId) : {};
    const orId = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).origenId : document.getElementById('movOrigen').value; const desId = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).destinoId : document.getElementById('movDestino').value;
    const or = state.cuentas.find(x => x.id == orId); const des = state.cuentas.find(x => x.id == desId);
    let sOr = updates[`cuentas/${or.id}/saldo`] !== undefined ? updates[`cuentas/${or.id}/saldo`] : or.saldo; let sDes = updates[`cuentas/${des.id}/saldo`] !== undefined ? updates[`cuentas/${des.id}/saldo`] : des.saldo;
    updates[`cuentas/${or.id}/saldo`] = sOr - m; updates[`cuentas/${des.id}/saldo`] = (des.tipo === 'debito' || des.tipo === 'efectivo') ? sDes + m : sDes - m;
    const id = currentEditId || db.ref(`Usuarios/${auth.currentUser.uid}/transacciones`).push().key; const oldFecha = currentEditId ? state.transacciones.find(x => x.firebaseId === currentEditId).fecha : new Date().toISOString().split('T')[0];
    updates[`transacciones/${id}`] = { tipo: 'movimiento', subtipo: currentMovMode, monto: m, desc: currentMovMode === 'pago' ? `Pago a ${des.nombre}` : `Traspaso a ${des.nombre}`, origenId: or.id, destinoId: des.id, fecha: oldFecha };
    if (currentMovMode === 'pago') updates[`cuentas/${des.id}/mesPagado`] = new Date().getMonth(); 
    db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates).then(() => { e.target.reset(); currentEditId = null; document.getElementById('movOrigen').disabled = false; document.getElementById('movDestino').disabled = false; document.getElementById('movTitle').innerText = "Nuevo Movimiento"; });
}
function editMovimiento(fid) { const t = state.transacciones.find(x => x.firebaseId === fid); cambiarTab('traspasos'); setMovMode(t.subtipo || 'traspaso'); document.getElementById('movOrigen').value = t.origenId; document.getElementById('movDestino').value = t.destinoId; document.getElementById('movMonto').value = t.monto; document.getElementById('movOrigen').disabled = true; document.getElementById('movDestino').disabled = true; currentEditId = fid; document.getElementById('movTitle').innerText = "Editando Movimiento"; }

function sumarInteres(id) { const m = parseFloat(prompt("Interés generado hoy ($):")); if (!m || isNaN(m) || m <= 0) return; const c = state.cuentas.find(x => x.id == id); if (!c) return; const transId = db.ref(`Usuarios/${auth.currentUser.uid}/transacciones`).push().key; let updates = {}; updates[`transacciones/${transId}`] = { desc: `Rendimiento`, monto: m, tipo: 'ingreso', cuentaId: c.id, fecha: new Date().toISOString().split('T')[0] }; updates[`cuentas/${c.id}/saldo`] = c.saldo + m; db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates); }
function resetearCuenta() { if(!confirm("¿Borrar historial y dejar saldos en $0?")) return; let updates = { 'transacciones': null }; state.cuentas.forEach(c => { updates[`cuentas/${c.id}/saldo`] = 0; updates[`cuentas/${c.id}/mesPagado`] = null; }); db.ref(`Usuarios/${auth.currentUser.uid}`).update(updates).then(() => alert("Restablecido a $0.")); }
function eliminarUsuario() { if(!confirm("¡PELIGRO! Esto borrará tu cuenta permanentemente. ¿Continuar?")) return; const user = auth.currentUser; db.ref(`Usuarios/${user.uid}`).remove().then(() => { user.delete().then(() => { alert("Cuenta eliminada."); window.location.reload(); }).catch(e => { alert(e.message); }); }); }

// 8. RENDERIZADO VISUAL
function getBankColor(banco) {
    const b = banco.toLowerCase();
    if (b.includes('nu') || b.includes('klar') || b.includes('stori')) return 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
    if (b.includes('bbva') || b.includes('azteca') || b.includes('bienestar')) return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    if (b.includes('santander') || b.includes('banorte') || b.includes('scotiabank')) return 'linear-gradient(135deg, #ef4444, #b91c1c)';
    if (b.includes('hey') || b.includes('mercadopago')) return 'linear-gradient(135deg, #10b981, #047857)';
    return 'linear-gradient(135deg, #475569, #1e293b)';
}

function renderPatrimonioChart(patrimonioActual) {
    const ctx = document.getElementById('chartPatrimonio').getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 150); gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)'); gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    if (chartPatrimonioInstance) chartPatrimonioInstance.destroy();
    let dataCurve = patrimonioActual > 0 ? [patrimonioActual*0.7, patrimonioActual*0.75, patrimonioActual*0.72, patrimonioActual*0.8, patrimonioActual*0.85, patrimonioActual*0.9, patrimonioActual] : [0,0,0,0,0,0,0];
    chartPatrimonioInstance = new Chart(ctx, { type: 'line', data: { labels: ['1', '2', '3', '4', '5', '6', 'Hoy'], datasets: [{ data: dataCurve, borderColor: '#ffffff', borderWidth: 2, backgroundColor: gradient, fill: true, tension: 0.4, pointRadius: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: Math.min(...dataCurve) * 0.9 } }, layout: { padding: 0 } } });
}

function renderAll() {
    let tengo = 0; let debo = 0; let gT = 0; let iT = 0; const hoy = new Date(); const diaHoy = hoy.getDate(); const mesAct = hoy.getMonth(); let hDeb = ""; let hCre = ""; let hMae = "";
    
    state.cuentas.forEach(c => {
        let aviso = "";
        if(c.diaPago && c.diaPago > 0) {
            const yaPagado = c.mesPagado === mesAct; const vence = c.diaPago - diaHoy;
            if (yaPagado) { aviso = `<br><small style="color:#a7f3d0; font-weight:bold;">✅ Pagado</small> <span onclick="db.ref('Usuarios/${auth.currentUser.uid}/cuentas/${c.id}/mesPagado').remove()" style="font-size:9px; cursor:pointer; text-decoration:underline;">(Deshacer)</span>`; } 
            else { let textoDias = vence < 0 ? `⚠️ Atrasado` : (vence === 0 ? '🔥 ¡Paga HOY!' : `Faltan: ${vence}d`); let colorTexto = vence <= 3 ? '#fca5a5' : '#e2e8f0'; aviso = `<br><small style="color:${colorTexto}; font-weight:bold;">${textoDias}</small><br><button class="tb-action-btn" style="margin-top:4px; ${vence <= 0 ? 'background:#ef4444' : ''}" onclick="db.ref('Usuarios/${auth.currentUser.uid}/cuentas/${c.id}/mesPagado').set(${mesAct})">Marcar Pagado</button>`; }
        }
        
        const colorFondo = getBankColor(c.banco); let limiteInfo = ""; let tituloSaldo = c.tipo === 'credito' ? "DEUDA ACTUAL" : "SALDO DISPONIBLE";
        if (c.tipo === 'credito' && c.limite > 0) { const disponible = c.limite - c.saldo; limiteInfo = `<div style="text-align: right;"><div style="font-size: 10px; opacity: 0.8;">Límite: $${c.limite.toLocaleString('es-MX')}</div><div style="font-size: 13px; font-weight: bold; color: #a7f3d0;">Disp: $${disponible.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div></div>`; }
        let digitosHtml = c.tipo !== 'efectivo' ? `<div class="tb-digitos">**** ${c.digitos || '0000'}</div>` : "";

        const baseCardHtml = `<div class="tarjeta-bancaria" style="background: ${colorFondo};"><div class="tb-bg-shape tb-shape-1"></div><div class="tb-bg-shape tb-shape-2"></div><div class="tb-content"><div class="tb-header"><div style="display:flex; align-items:center; gap:10px;"><img src="${c.icon}" style="width:28px; height:28px; border-radius:50%; background:white; padding:2px; object-fit:contain;"><div><div class="tb-banco">${c.banco.toUpperCase()}</div>${digitosHtml}</div></div><div class="tb-badge">${c.tipo.toUpperCase()}</div></div><div class="tb-body"><div style="font-size: 10px; opacity: 0.8; margin-bottom: 2px;">${tituloSaldo}</div><div class="tb-saldo">$${c.saldo.toLocaleString('es-MX', {minimumFractionDigits: 2})}</div></div><div class="tb-footer"><div><div class="tb-nombre">${c.nombre}</div>${aviso}</div>${limiteInfo}</div>`;
        const actionsHtml = `<div class="tb-actions"><button class="tb-action-btn" onclick="editCuenta('${c.id}')">✏️ Editar</button><button class="tb-action-btn" onclick="sumarInteres('${c.id}')">+ Interés</button><button class="tb-action-btn" onclick="const d=prompt('Dominio web banco (ej. bbva.mx):'); if(d) db.ref('Usuarios/${auth.currentUser.uid}/cuentas/${c.id}/icon').set('https://www.google.com/s2/favicons?domain='+d+'&sz=128')">Logo</button><button class="tb-action-btn danger" onclick="if(confirm('¿Borrar permanentemente?')) db.ref('Usuarios/${auth.currentUser.uid}/cuentas/${c.id}').remove()">Borrar</button></div>`;

        if(c.tipo === 'debito' || c.tipo === 'efectivo'){ tengo += c.saldo; hDeb += baseCardHtml + `</div></div>`; } else { debo += c.saldo; hCre += baseCardHtml + `</div></div>`; }
        hMae += baseCardHtml + actionsHtml + `</div></div>`; 
    });
    
    document.getElementById('widgetDebitos').innerHTML = hDeb || "<small style='padding: 0 10px;'>Aún no agregas cuentas de débito.</small>"; 
    document.getElementById('widgetCreditos').innerHTML = hCre || "<small style='padding: 0 10px;'>Aún no agregas tarjetas de crédito.</small>"; 
    document.getElementById('listaMaestraCuentas').innerHTML = hMae;
    
    document.getElementById('valTengo').innerText = `$${tengo.toLocaleString('es-MX', {minimumFractionDigits: 2})}`; 
    document.getElementById('valDebo').innerText = `$${debo.toLocaleString('es-MX', {minimumFractionDigits: 2})}`; 
    const patrimonio = tengo - debo; document.getElementById('valPatrimonio').innerText = `$${patrimonio.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    renderPatrimonioChart(patrimonio);
    
    const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    const txMes = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoMes));
    gT = txMes.filter(t => t.tipo==='gasto').reduce((a, b) => a + Number(b.monto || 0), 0); iT = txMes.filter(t => t.tipo==='ingreso').reduce((a, b) => a + Number(b.monto || 0), 0); 
    
    document.getElementById('homeIngresos').innerText = `$${iT.toLocaleString('es-MX', {minimumFractionDigits: 2})}`; document.getElementById('homeGastos').innerText = `$${gT.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    
    let hG = ""; let hI = ""; let hM = "";
    state.transacciones.slice().reverse().forEach(t => {
        let actionStr = t.tipo === 'movimiento' ? `editMovimiento('${t.firebaseId}')` : (t.tipo === 'gasto' ? `editGasto('${t.firebaseId}')` : `editIngreso('${t.firebaseId}')`);
        const item = `<div class="bank-item"><div>${t.desc}<br><small>${t.fecha}</small></div><div style="display:flex; align-items:center;"><button class="del-btn" onclick="eliminarTransaccion('${t.firebaseId}')">🗑️</button><button class="edit-btn" onclick="${actionStr}">✏️</button><b>$${Number(t.monto || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</b></div></div>`;
        if(t.tipo === 'gasto') hG += item; else if (t.tipo === 'ingreso') hI += item; else hM += item;
    });
    
    document.getElementById('listaGastos').innerHTML = hG; document.getElementById('listaIngresos').innerHTML = hI; document.getElementById('listaMovimientos').innerHTML = hM;
    
    actualizarSelects(); renderChart(gT); renderPresupuestos();
}

function actualizarSelects() {
    const optDeb = state.cuentas.filter(c => c.tipo==='debito' || c.tipo==='efectivo').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const optCre = state.cuentas.filter(c => c.tipo==='credito').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    const optAll = state.cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    
    if(document.getElementById('inCuenta')) document.getElementById('inCuenta').innerHTML = optDeb; 
    if(document.getElementById('gaFuente')) document.getElementById('gaFuente').innerHTML = optAll; 
    if(document.getElementById('movOrigen')) document.getElementById('movOrigen').innerHTML = optDeb; 
    if(document.getElementById('movDestino')) document.getElementById('movDestino').innerHTML = currentMovMode === 'pago' ? optCre : optDeb; 
    
    const todasLasCats = [...categoriasBase, ...state.categoriasCustom];
    if(document.getElementById('gaCat')) {
        document.getElementById('gaCat').innerHTML = todasLasCats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

function renderChart(totalGasto = 0) {
    const hoy = new Date(); const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
    const ctx = document.getElementById('chartGastos').getContext('2d'); const cats = {};
    state.transacciones.filter(t => t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(prefijoMes)).forEach(t => cats[t.cat] = (cats[t.cat] || 0) + Number(t.monto || 0));
    
    if(chartInstance) chartInstance.destroy();
    
    let isDark = document.body.getAttribute('data-theme') === 'dark';
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b'; 

    chartInstance = new Chart(ctx, { 
        type:'doughnut', 
        data:{ 
            labels:Object.keys(cats), 
            datasets:[{
                data:Object.values(cats), 
                backgroundColor:['#3b82f6','#10b981','#ef4444','#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'], 
                borderWidth: 3, 
                borderColor: isDark ? '#1e293b' : '#ffffff'
            }] 
        }, 
        options:{ 
            maintainAspectRatio:false, 
            cutout:'75%',
            layout: { padding: 10 },
            plugins: {
                legend: { 
                    display: true, 
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 10 } }
                },
                centerText: { 
                    display: true,
                    title: "TOTAL MES",
                    text: "$" + totalGasto.toLocaleString('es-MX', {minimumFractionDigits: 2})
                }
            } 
        } 
    });
}

function getBankLogo(banco) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(banco)}&background=random&color=fff&size=128&bold=true`; }
function selectColor(hex, el) { state.selectedColor = hex; document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); document.documentElement.style.setProperty('--primary', hex); }
function toggleCamposCuenta() { const tipo = document.getElementById('cuTipo').value; const grupoDigitos = document.getElementById('grupoDigitos'); const cuLimite = document.getElementById('cuLimite'); const grupoFechas = document.getElementById('grupoFechas'); if (tipo === 'efectivo') { grupoDigitos.style.display = 'none'; cuLimite.style.display = 'none'; grupoFechas.style.display = 'none'; } else if (tipo === 'debito') { grupoDigitos.style.display = 'block'; cuLimite.style.display = 'none'; grupoFechas.style.display = 'none'; } else if (tipo === 'credito') { grupoDigitos.style.display = 'block'; cuLimite.style.display = 'block'; grupoFechas.style.display = 'grid'; } }
function editCuenta(id) { const c = state.cuentas.find(x => x.id == id); if (!c) return; cambiarTab('cuentas'); document.getElementById('cuNombre').value = c.nombre || ''; document.getElementById('cuBanco').value = c.banco || ''; document.getElementById('cuTipo').value = c.tipo || 'debito'; document.getElementById('cuSaldo').value = c.saldo || 0; document.getElementById('cuDigitos').value = c.digitos || ''; document.getElementById('cuLimite').value = c.limite || ''; document.getElementById('cuPago').value = c.diaPago || ''; document.getElementById('cuCorte').value = c.diaCorte || ''; toggleCamposCuenta(); currentCuentaEditId = id; document.getElementById('cuentaFormTitle').innerText = "Editando Cuenta"; document.getElementById('btnGuardarCuenta').innerText = "Guardar Cambios"; document.getElementById('btnCancelarEdicionCuenta').style.display = 'block'; window.scrollTo(0,0); }
function cancelarEdicionCuenta() { currentCuentaEditId = null; document.getElementById('formCuenta').reset(); document.getElementById('cuentaFormTitle').innerText = "Registrar Cuenta"; document.getElementById('btnGuardarCuenta').innerText = "Añadir Cuenta"; document.getElementById('btnCancelarEdicionCuenta').style.display = 'none'; toggleCamposCuenta(); }
function handleNuevaCuenta(e) { e.preventDefault(); const id = currentCuentaEditId || Date.now(); const b = document.getElementById('cuBanco').value; const tipo = document.getElementById('cuTipo').value; let digitos = "", limite = 0, diaPago = 0, diaCorte = 0; if (tipo === 'debito' || tipo === 'credito') { digitos = document.getElementById('cuDigitos').value || ""; } if (tipo === 'credito') { limite = parseFloat(document.getElementById('cuLimite').value) || 0; diaPago = parseInt(document.getElementById('cuPago').value) || 0; diaCorte = parseInt(document.getElementById('cuCorte').value) || 0; } const cExistente = state.cuentas.find(x => x.id == id); const mesPagadoActual = cExistente ? cExistente.mesPagado : null; const iconoActual = cExistente ? cExistente.icon : getBankLogo(b); let dataGuardar = { id: id, nombre: document.getElementById('cuNombre').value, banco: b, tipo: tipo, saldo: parseFloat(document.getElementById('cuSaldo').value) || 0, limite: limite, digitos: digitos, diaPago: diaPago, diaCorte: diaCorte, icon: iconoActual }; if (mesPagadoActual !== null && mesPagadoActual !== undefined) dataGuardar.mesPagado = mesPagadoActual; db.ref(`Usuarios/${auth.currentUser.uid}/cuentas/${id}`).set(dataGuardar).then(() => { alert(currentCuentaEditId ? "Cuenta actualizada" : "Cuenta añadida"); cancelarEdicionCuenta(); }); }
function handleGuardarPerfil(e) { e.preventDefault(); db.ref(`Usuarios/${auth.currentUser.uid}/perfil`).set({ nombre: document.getElementById('perfNombre').value, foto: state.currentBase64 || document.getElementById('perfDisplayFoto').src, color: state.selectedColor }).then(() => { alert("Perfil actualizado"); cambiarTab('resumen'); }); }

// 10. PRESUPUESTOS (SLIDER HORIZONTAL DE MEDIAS DONAS)
function getIconForCat(cat) {
    const iconos = { 'Comida': '🍔', 'Servicios': '⚡', 'Transporte': '🚗', 'Vivienda': '🏠', 'Ocio': '🍿', 'Otros': '📦', 'Mascotas': '🐶', 'Salud': '💊', 'Ropa': '👕', 'Suscripciones': '📺', 'Gimnasio': '🏋️' };
    return iconos[cat] || '🏷️';
}

function handleGuardarPresupuesto(e) { 
    e.preventDefault(); 
    const inputs = document.querySelectorAll('#contenedorInputsPresupuesto input');
    let nuevosPresupuestos = {};
    inputs.forEach(inp => { if(inp.value) nuevosPresupuestos[inp.dataset.cat] = parseFloat(inp.value); });
    db.ref(`Usuarios/${auth.currentUser.uid}/presupuestos`).set(nuevosPresupuestos).then(() => alert("¡Presupuesto actualizado!")); 
}

function renderPresupuestos() {
    try {
        const todasLasCats = [...categoriasBase, ...state.categoriasCustom];
        
        let inputsHtml = "";
        todasLasCats.forEach(c => {
            let valActual = state.presupuestos[c] || '';
            inputsHtml += `<div><label style="font-size:11px;">${getIconForCat(c)} ${c}</label><input type="number" data-cat="${c}" value="${valActual}" placeholder="$0" step="0.01"></div>`;
        });
        document.getElementById('contenedorInputsPresupuesto').innerHTML = inputsHtml;

        const hoy = new Date(); const prefijoMes = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}`;
        const txMes = state.transacciones.filter(t => t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(prefijoMes));
        
        let gastosPorCat = {}; todasLasCats.forEach(c => gastosPorCat[c] = 0);
        txMes.forEach(t => { let cat = t.cat || 'Otros'; if(gastosPorCat[cat] !== undefined) { gastosPorCat[cat] += Number(t.monto) || 0; } else { gastosPorCat['Otros'] += Number(t.monto) || 0; } });
        
        chartPresupuestosGrid.forEach(c => c.destroy());
        chartPresupuestosGrid = [];

        const bgColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#84cc16'];
        const catsActivas = todasLasCats.filter(c => Number(state.presupuestos[c]) > 0);
        
        let totalAsignado = 0;
        let totalGastado = 0;
        let sliderHtml = "";

        if(catsActivas.length === 0) {
            document.getElementById('presupuestosGrid').innerHTML = "<p style='width: 100%; color:var(--muted); text-align:center;'>Aún no tienes límites definidos. Configúralos abajo.</p>";
            document.getElementById('presupuestoGlobalCard').style.display = 'none';
            return;
        }

        catsActivas.forEach((c, index) => {
            let limite = Number(state.presupuestos[c]) || 0;
            let gastado = Number(gastosPorCat[c]) || 0;
            totalAsignado += limite;
            totalGastado += gastado;
            
            let pct = limite > 0 ? (gastado / limite) * 100 : 0;
            let colorPrimario = pct > 100 ? '#ef4444' : bgColors[index % bgColors.length];
            
            sliderHtml += `
                <div class="presupuesto-item">
                    <div class="presup-canvas-wrapper">
                        <canvas id="p-chart-${index}"></canvas>
                        <div class="presup-icon">${getIconForCat(c)}</div>
                    </div>
                    <div class="presup-details">
                        <p class="presup-title">${c}</p>
                        <p class="presup-amounts">$${Math.round(gastado)} / $${Math.round(limite)}</p>
                        <span class="presup-pct" style="background: ${colorPrimario}20; color: ${colorPrimario}">${pct.toFixed(0)}%</span>
                    </div>
                </div>
            `;
        });

        document.getElementById('presupuestosGrid').innerHTML = sliderHtml;

        catsActivas.forEach((c, index) => {
            let limite = Number(state.presupuestos[c]) || 0;
            let gastado = Number(gastosPorCat[c]) || 0;
            let pct = limite > 0 ? (gastado / limite) * 100 : 0;
            
            let colorPrimario = pct > 100 ? '#ef4444' : bgColors[index % bgColors.length];
            let colorFondo = document.body.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
            
            let fillData = pct > 100 ? 1 : gastado;
            let emptyData = pct > 100 ? 0 : Math.max(limite - gastado, 0);

            const ctx = document.getElementById(`p-chart-${index}`).getContext('2d');
            let chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Gastado', 'Restante'],
                    datasets: [{
                        data: [fillData, emptyData],
                        backgroundColor: [colorPrimario, colorFondo],
                        borderWidth: 0,
                        borderRadius: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    circumference: 180, 
                    rotation: 270, 
                    cutout: '80%', 
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
            chartPresupuestosGrid.push(chart);
        });

        document.getElementById('presupuestoGlobalCard').style.display = 'block';
        document.getElementById('globalPresupText').innerText = `$${totalGastado.toLocaleString('es-MX', {minimumFractionDigits: 0})} / $${totalAsignado.toLocaleString('es-MX', {minimumFractionDigits: 0})}`;
        let globalPct = totalAsignado > 0 ? (totalGastado / totalAsignado) * 100 : 0;
        let globalColor = globalPct > 100 ? 'var(--danger)' : (globalPct > 80 ? '#f59e0b' : 'var(--primary)');
        document.getElementById('globalPresupBar').style.width = Math.min(globalPct, 100) + "%";
        document.getElementById('globalPresupBar').style.background = globalColor;

    } catch (error) { console.error("Error al renderizar los presupuestos: ", error); }
}

// 11. EXPORTACIÓN A PDF
async function generarPDFMes() {
    if (!window.jspdf) { alert("Cargando librerías..."); return; }
    if(document.getElementById('loader')) document.getElementById('loader').style.display = 'flex';
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ putOnlyUsedFonts: true, orientation: "portrait" });
        const logoDataUrl = await new Promise((resolve) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; canvas.getContext('2d').drawImage(img, 0, 0, 100, 100); resolve(canvas.toDataURL('image/png')); }; img.onerror = () => resolve(null); img.src = 'logo.svg'; });
        const limpiarTexto = (txt) => txt ? txt.replace(/[^\x00-\x7F\xC0-\xFF]/g, '').trim() : '';
        const selectorMes = document.getElementById('mesReporte') ? document.getElementById('mesReporte').value : null;
        let fechaObjetivo = new Date(); if (selectorMes) { const partes = selectorMes.split('-'); fechaObjetivo = new Date(partes[0], partes[1] - 1, 10); }
        const year = fechaObjetivo.getFullYear(); const nombreMes = fechaObjetivo.toLocaleString('es-ES', { month: 'long' }).toUpperCase(); const prefijoMes = `${year}-${(fechaObjetivo.getMonth() + 1).toString().padStart(2, '0')}`;
        const userName = limpiarTexto(document.getElementById('perfDisplayNombre').innerText); const userPhotoBase64 = document.getElementById('perfDisplayFoto').src;
        const estiloBody = getComputedStyle(document.body); let colorPrimarioHex = estiloBody.getPropertyValue('--primary').trim() || "#3b82f6";
        const hexToRgb = (hex) => { let c = hex.substring(1).split(''); if(c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]]; c = '0x' + c.join(''); return [(c>>16)&255, (c>>8)&255, c&255]; }; const rgbPrimario = hexToRgb(colorPrimarioHex);
        const txMes = state.transacciones.filter(t => t.fecha && t.fecha.startsWith(prefijoMes)); let ingMes = 0, gasMes = 0; txMes.forEach(t => { if (t.tipo === 'ingreso') ingMes += Number(t.monto || 0); else gasMes += Number(t.monto || 0); });
        let activos = 0, deudas = 0; const cuentasDebito = []; const cuentasCredito = []; state.cuentas.forEach(c => { if (c.tipo === 'debito' || c.tipo === 'efectivo') { activos += Number(c.saldo || 0); cuentasDebito.push(c); } else { deudas += Number(c.saldo || 0); cuentasCredito.push(c); } });
        const patrimonio = activos - deudas; let yPos = 50; 
        doc.setTextColor(0); doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.text("BALANCE GENERAL", 15, yPos); yPos += 5;
        doc.setFillColor(240, 253, 244); doc.roundedRect(15, yPos, 55, 18, 3, 3, 'F'); doc.setTextColor(16, 185, 129); doc.setFontSize(9); doc.text("ACTIVOS (TENGO)", 18, yPos + 6); doc.setFontSize(12); doc.text(`$${activos.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 18, yPos + 14);
        doc.setFillColor(254, 242, 242); doc.roundedRect(75, yPos, 55, 18, 3, 3, 'F'); doc.setTextColor(239, 68, 68); doc.setFontSize(9); doc.text("DEUDAS (DEBO)", 78, yPos + 6); doc.setFontSize(12); doc.text(`$${deudas.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 78, yPos + 14);
        doc.setDrawColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.setFillColor(255, 255, 255); doc.roundedRect(135, yPos, 60, 18, 3, 3, 'FD'); doc.setTextColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.setFontSize(9); doc.text("PATRIMONIO TOTAL", 138, yPos + 6); doc.setFontSize(12); doc.text(`$${patrimonio.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 138, yPos + 14); yPos += 22;
        doc.setFillColor(240, 253, 244); doc.roundedRect(15, yPos, 85, 18, 3, 3, 'F'); doc.setTextColor(16, 185, 129); doc.setFontSize(9); doc.text("INGRESOS DEL MES", 18, yPos + 6); doc.setFontSize(14); doc.text(`+ $${ingMes.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 18, yPos + 14);
        doc.setFillColor(254, 242, 242); doc.roundedRect(110, yPos, 85, 18, 3, 3, 'F'); doc.setTextColor(239, 68, 68); doc.setFontSize(9); doc.text("GASTOS Y MOVS DEL MES", 113, yPos + 6); doc.setFontSize(14); doc.text(`- $${gasMes.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 113, yPos + 14); yPos += 28;
        const crearTablaCuentas = (titulo, datos, totalSaldos, startY) => { doc.setTextColor(0); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(titulo, 15, startY); const bodyCuentas = datos.map(c => [ limpiarTexto(c.nombre) || 'Cuenta', limpiarTexto(c.banco || 'N/A').toUpperCase(), `$${Number(c.saldo || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}` ]); if (bodyCuentas.length === 0) { bodyCuentas.push(['-', 'NO HAY CUENTAS', '$0.00']); } bodyCuentas.push([ { content: 'TOTAL', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `$${totalSaldos.toLocaleString('es-MX', {minimumFractionDigits: 2})}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } } ]); doc.autoTable({ startY: startY + 4, head: [['Cuenta', 'Institución', 'Saldo']], body: bodyCuentas, theme: 'striped', headStyles: { fillColor: rgbPrimario, textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { valign: 'middle', fontSize: 9 }, columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } }, margin: { top: 45, bottom: 25 } }); return doc.lastAutoTable.finalY + 12; };
        yPos = crearTablaCuentas("CUENTAS DE DÉBITO Y EFECTIVO (ACTIVOS)", cuentasDebito, activos, yPos); yPos = crearTablaCuentas("CUENTAS DE CRÉDITO Y TDC (DEUDAS)", cuentasCredito, deudas, yPos);
        if(yPos > doc.internal.pageSize.height - 40) { doc.addPage(); yPos = 55; }
        doc.setTextColor(0); doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text(`DETALLE DE MOVIMIENTOS - ${nombreMes}`, 15, yPos);
        const bodyMovs = txMes.map(t => { let catDisplay = limpiarTexto(t.cat || 'Ingreso'); if(t.tipo === 'movimiento') catDisplay = t.subtipo === 'pago' ? 'PAGO TDC' : 'TRASPASO'; const esIngreso = t.tipo === 'ingreso'; return [ t.fecha, catDisplay.toUpperCase(), limpiarTexto(t.desc) || 'Sin detalle', { content: `${esIngreso ? '+' : '-'} $${Number(t.monto || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}`, styles: { textColor: esIngreso ? [16, 185, 129] : [239, 68, 68], fontStyle: 'bold' } } ]; });
        if (bodyMovs.length === 0) { bodyMovs.push(['-', 'SIN MOVIMIENTOS ESTE MES', '-', '$0.00']); } bodyMovs.push([ { content: 'BALANCE DEL MES (INGRESOS - GASTOS)', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `$${(ingMes - gasMes).toLocaleString('es-MX', {minimumFractionDigits: 2})}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } } ]);
        doc.autoTable({ startY: yPos + 4, head: [['Fecha', 'Categoría', 'Concepto', 'Monto']], body: bodyMovs, theme: 'grid', headStyles: { fillColor: rgbPrimario, textColor: [255, 255, 255], fontStyle: 'bold' }, styles: { valign: 'middle', fontSize: 8 }, columnStyles: { 3: { halign: 'right' } }, margin: { top: 45, bottom: 25 } });
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFillColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.rect(0, 0, 210, 40, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text("ESTADO DE CUENTA MÓVIL", 45, 15); doc.setFontSize(20); doc.setFont(undefined, 'bold'); doc.text(userName.toUpperCase(), 45, 23); doc.setFontSize(10); doc.setFont(undefined, 'normal'); doc.text(`Período reportado: ${nombreMes} ${year}`, 45, 30); if (logoDataUrl) { doc.addImage(logoDataUrl, 'PNG', 15, 10, 20, 20); } if (i === 1) { try { if(userPhotoBase64 && userPhotoBase64.startsWith('data:image')) { doc.addImage(userPhotoBase64, 'JPEG', 170, 8, 24, 24, 'perfil', 'FAST'); } } catch(e) {} } const pageHeight = doc.internal.pageSize.height; doc.setFillColor(rgbPrimario[0], rgbPrimario[1], rgbPrimario[2]); doc.rect(0, pageHeight - 15, 210, 15, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.text(`Generado el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}`, 15, pageHeight - 6); doc.text(`Página ${i} de ${pageCount}`, 195, pageHeight - 6, { align: 'right' }); }
        doc.save(`EstadoCuenta_${limpiarTexto(nombreMes)}_${year}.pdf`);
    } catch (error) { alert("Ocurrió un problema al generar el reporte: " + error.message); } finally { if(document.getElementById('loader')) document.getElementById('loader').style.display = 'none'; }
}

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }