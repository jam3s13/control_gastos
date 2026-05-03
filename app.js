/**
 * GESTOR DE GASTOS - LOGICA PRINCIPAL
 * Integración: Supabase + Chart.js + SweetAlert2
 */

// ==============================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN
// ==============================================

const SUPABASE_URL = 'https://kjytkmuuyvwrcurzvsjq.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_HCaLtZlqKdWhSsHF1rOgXg_tnkyfDcV'; // Mantén tu clave segura
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referencias DOM Globales
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const gastosList = document.getElementById('gastos-list');
const totalGastosElement = document.getElementById('total-gastos');

// Estado Global de la App
let currentPage = 1;
const PAGE_SIZE = 10;
let totalPages = 1;
let currentSortColumn = 'gasto_fecha';
let currentSortOrder = 'desc';
let trendGranularity = 'dia';

// Gráficos
let categoryChart = null;
let trendChart = null;

// ==============================================
// FUNCIONES DE CONTROL DE ESTADO (UI)
// ==============================================

// ==============================================
// DETECTOR DE SESIÓN DINÁMICO
// ==============================================

// 1. Esta función debe ser capaz de leer la sesión actual
async function checkUser() {
    // Obtenemos la sesión actual (esto captura el token de la URL automáticamente)
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
        console.error("Error al obtener sesión:", error);
        toggleUI(false);
        return;
    }

    if (session) {
        console.log("Sesión activa encontrada para:", session.user.email);
        toggleUI(true);
    } else {
        toggleUI(false);
    }
}

/**
 * Cambia la visibilidad entre el Login y el Dashboard
 */
function toggleUI(loggedIn) {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (loggedIn) {
        authContainer.classList.add('d-none');
        appContainer.classList.remove('d-none');
        
        // Si el usuario está dentro, cargamos sus datos
        if (typeof obtenerGastos === 'function') {
            obtenerGastos();
        }
        if (typeof setupRealtime === 'function') {
            setupRealtime();
        }
    } else {
        authContainer.classList.remove('d-none');
        appContainer.classList.add('d-none');
    }
}

// ==============================================
// 2. UTILIDADES DE NOTIFICACIÓN (SweetAlert2)
// ==============================================

/**
 * Reemplazo de alertas tradicionales por Toasts elegantes
 */
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
});

function notify(title, icon = 'success') {
    Toast.fire({ icon, title });
}

function showAlert(title, text, icon = 'error') {
    Swal.fire({ title, text, icon, confirmButtonColor: '#0d6efd' });
}

// ==============================================
// 3. AUTENTICACIÓN Y RECUPERACIÓN DE CONTRASEÑA
// ==============================================

// Elementos del DOM
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const toggleAuth = document.getElementById('toggle-auth');
const forgotPassword = document.getElementById('forgot-password');

// 1. Cambiar visualmente entre Iniciar Sesión y Registrarse
if (toggleAuth) {
    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        const isLogin = authTitle.textContent === 'Iniciar Sesión';
        
        if (isLogin) {
            authTitle.textContent = 'Registrarse';
            authButton.textContent = 'Crear Cuenta';
            authButton.classList.replace('btn-primary', 'btn-success');
            toggleAuth.textContent = '¿Ya tienes cuenta? Inicia Sesión';
        } else {
            authTitle.textContent = 'Iniciar Sesión';
            authButton.textContent = 'Entrar';
            authButton.classList.replace('btn-success', 'btn-primary');
            toggleAuth.textContent = '¿No tienes cuenta? Regístrate';
        }
    });
}

// 2. Lógica del formulario (Login / Registro)
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const isSignIn = authTitle.textContent === 'Iniciar Sesión';

    if (isSignIn) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) showAlert('Error al entrar', error.message);
        else { notify('¡Bienvenido!'); checkUser(); }
    } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) showAlert('Error al registrar', error.message);
        else {
            Swal.fire('¡Registro exitoso!', 'Por favor, revisa tu correo electrónico para confirmar tu cuenta.', 'success');
            // Regresamos el form a modo "Iniciar Sesión"
            toggleAuth.click(); 
        }
    }
};

// ==============================================
// CERRAR SESIÓN
// ==============================================
const btnCerrarSesion = document.getElementById('signout-button');

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
        // 1. Le decimos a Supabase que cierre la sesión en el servidor
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            showAlert('Error', 'No se pudo cerrar la sesión: ' + error.message);
        } else {
            // 2. Cambiamos la interfaz para mostrar el Login nuevamente
            toggleUI(false);
            
            // 3. Limpiamos los datos visuales por seguridad (opcional pero recomendado)
            document.getElementById('gastos-list').innerHTML = '';
            document.getElementById('total-gastos').textContent = 'S/0.00';
            if (categoryChart) categoryChart.destroy();
            if (trendChart) trendChart.destroy();
            
            // 4. Mostramos una pequeña notificación
            notify('Sesión cerrada correctamente', 'info');
        }
    });
}

// 3. Solicitar Recuperación de Contraseña
if (forgotPassword) {
    forgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const { value: email } = await Swal.fire({
            title: 'Recuperar contraseña',
            input: 'email',
            inputLabel: 'Ingresa tu correo electrónico',
            inputPlaceholder: 'ejemplo@correo.com',
            showCancelButton: true,
            confirmButtonText: 'Enviar enlace',
            cancelButtonText: 'Cancelar'
        });

        if (email) {
            // Enviamos el correo de reseteo (redirige a la app actual)
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });

            if (error) {
                showAlert('Error', error.message);
            } else {
                Swal.fire('Revisa tu correo', 'Te hemos enviado un enlace mágico para restablecer tu contraseña.', 'success');
            }
        }
    });
}

// 4. Escuchar cuando el usuario entra desde el enlace del correo
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        // El usuario hizo clic en el enlace de su correo, pedimos la nueva contraseña
        const { value: newPassword } = await Swal.fire({
            title: 'Nueva Contraseña',
            input: 'password',
            inputLabel: 'Ingresa tu nueva contraseña (mínimo 6 caracteres)',
            showCancelButton: false,
            confirmButtonText: 'Actualizar Contraseña',
            allowOutsideClick: false // Obligamos a que la cambie
        });

        if (newPassword) {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            
            if (error) {
                showAlert('Error', error.message);
            } else {
                Swal.fire('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'success');
                checkUser(); // Recargamos el dashboard
            }
        }
    }
});

// ==============================================
// 4. LÓGICA DE DATOS (CRUD)
// ==============================================

/**
 * Función principal para traer datos y actualizar la vista
 */
async function obtenerGastos() {
    const filter = document.getElementById('filter-categoria').value;
    
    // 1. Obtener totales para gráficos y sumatoria
    let queryTotales = supabaseClient.from('gastos').select('monto, categoria, gasto_fecha', { count: 'exact' });
    if (filter !== 'ALL') queryTotales = queryTotales.eq('categoria', filter);
    
    const { data: allData, count } = await queryTotales;
    if (!allData) return;

    // Actualizar sumatoria y gráficos
    const total = allData.reduce((acc, g) => acc + parseFloat(g.monto), 0);
    totalGastosElement.textContent = `S/ ${total.toFixed(2)}`;
    renderCharts(allData);

    // 2. Obtener datos paginados para la tabla
    totalPages = Math.ceil(count / PAGE_SIZE);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let queryTable = supabaseClient.from('gastos').select('*').range(from, to)
        .order(currentSortColumn, { ascending: currentSortOrder === 'asc' });
    
    if (filter !== 'ALL') queryTable = queryTable.eq('categoria', filter);

    const { data: pageData } = await queryTable;
    renderTable(pageData);
    renderPagination();
}

/**
 * Crea la tabla dinámicamente
 */
function renderTable(gastos) {
    gastosList.innerHTML = '';
    if (!gastos || gastos.length === 0) {
        gastosList.innerHTML = '<tr><td colspan="5" class="text-center">No hay registros</td></tr>';
        return;
    }

    gastos.forEach(g => {
        const row = gastosList.insertRow();
        row.innerHTML = `
            <td>S/${parseFloat(g.monto).toFixed(2)}</td>
            <td>${g.descripcion}</td>
            <td><span class="badge bg-light text-dark">${g.categoria}</span></td>
            <td>${new Date(g.gasto_fecha + 'T00:00:00').toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-info text-white" onclick="abrirModalEditar('${g.id}')">Editar</button>
                <button class="btn btn-sm btn-danger" onclick="confirmarEliminar('${g.id}')">Eliminar</button>
            </td>
        `;
    });
}

// ==============================================
// 5. MANEJO DE GASTOS (NUEVO, EDITAR, BORRAR)
// ==============================================

// AGREGAR
document.getElementById('gasto-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = (await supabaseClient.auth.getUser()).data.user;
    
    const nuevoGasto = {
        user_id: user.id,
        monto: parseFloat(document.getElementById('gasto-monto').value),
        descripcion: document.getElementById('gasto-descripcion').value,
        categoria: document.getElementById('gasto-categoria').value,
        gasto_fecha: document.getElementById('gasto-fecha').value
    };

    const { error } = await supabaseClient.from('gastos').insert([nuevoGasto]);
    if (error) showAlert('Error', error.message);
    else {
        notify('Gasto guardado correctamente');
        e.target.reset();
        obtenerGastos();
    }
};

// ELIMINAR (Con SweetAlert2)
// ==============================================
// MODIFICACIÓN EN ELIMINAR
// ==============================================
// ELIMINAR MEJORADO CON DIAGNÓSTICO
async function confirmarEliminar(id) {
    // 1. Verificamos por consola qué ID estamos intentando borrar
    console.log("Intentando eliminar el gasto con ID:", id);

    if (!id || id === 'undefined') {
        showAlert('Error', 'El ID del gasto no es válido.');
        return;
    }

    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        // 2. Añadimos .select() al final para forzar que Supabase nos diga si borró algo
        const { data, error } = await supabaseClient
            .from('gastos')
            .delete()
            .eq('id', id)
            .select();

        console.log("Respuesta de Supabase al eliminar:", { data, error });

        if (error) {
            showAlert('Error de base de datos', error.message);
        } else if (data && data.length === 0) {
            // Si data es un array vacío, significa que el comando se ejecutó pero NO se borró nada
            showAlert(
                'No se pudo eliminar', 
                'No se encontró el registro o no tienes permisos (Revisa las políticas RLS de DELETE en Supabase).', 
                'warning'
            );
        } else {
            notify('Gasto eliminado correctamente');
            await obtenerGastos(); // Actualizamos la tabla
        }
    }
}

// ==============================================
// MODIFICACIÓN EN EDITAR
// ==============================================
async function abrirModalEditar(id) {
    const { data: g } = await supabaseClient.from('gastos').select('*').eq('id', id).single();
    
    const { value: formValues } = await Swal.fire({
        title: 'Editar Gasto',
        html: `
            <input id="swal-monto" type="number" class="swal2-input" placeholder="Monto" value="${g.monto}">
            <input id="swal-desc" type="text" class="swal2-input" placeholder="Descripción" value="${g.descripcion}">
            <select id="swal-cat" class="swal2-input">
                <option value="Alimentación" ${g.categoria === 'Alimentación' ? 'selected' : ''}>Alimentación</option>
                <option value="Transporte" ${g.categoria === 'Transporte' ? 'selected' : ''}>Transporte</option>
                <option value="Vivienda" ${g.categoria === 'Vivienda' ? 'selected' : ''}>Alquiler</option>
                <option value="Entretenimiento" ${g.categoria === 'Entretenimiento' ? 'selected' : ''}>Entretenimiento</option>
                <option value="Otros" ${g.categoria === 'Otros' ? 'selected' : ''}>Otros</option>
            </select>
            <input id="swal-fecha" type="date" class="swal2-input" value="${g.gasto_fecha}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        preConfirm: () => {
            return {
                monto: document.getElementById('swal-monto').value,
                descripcion: document.getElementById('swal-desc').value,
                categoria: document.getElementById('swal-cat').value,
                gasto_fecha: document.getElementById('swal-fecha').value
            }
        }
    });

    if (formValues) {
        const { error } = await supabaseClient.from('gastos').update(formValues).eq('id', id);
        
        if (error) {
            showAlert('Error', error.message);
        } else {
            notify('Actualizado correctamente');
            // AGREGAMOS ESTO: Refresco manual inmediato
            await obtenerGastos(); 
        }
    }
}

// EDITAR (Usando SweetAlert2 como formulario dinámico)
async function abrirModalEditar(id) {
    // 1. Obtener datos actuales
    const { data: g } = await supabaseClient.from('gastos').select('*').eq('id', id).single();
    
    // 2. Mostrar SweetAlert con HTML inyectado
    const { value: formValues } = await Swal.fire({
        title: 'Editar Gasto',
        html: `
            <input id="swal-monto" type="number" class="swal2-input" placeholder="Monto" value="${g.monto}">
            <input id="swal-desc" type="text" class="swal2-input" placeholder="Descripción" value="${g.descripcion}">
            <select id="swal-cat" class="swal2-input">
                <option value="Alimentación" ${g.categoria === 'Alimentación' ? 'selected' : ''}>Alimentación</option>
                <option value="Transporte" ${g.categoria === 'Transporte' ? 'selected' : ''}>Transporte</option>
                <option value="Vivienda" ${g.categoria === 'Vivienda' ? 'selected' : ''}>Alquiler</option>
                <option value="Entretenimiento" ${g.categoria === 'Entretenimiento' ? 'selected' : ''}>Entretenimiento</option>
                <option value="Otros" ${g.categoria === 'Otros' ? 'selected' : ''}>Otros</option>
            </select>
            <input id="swal-fecha" type="date" class="swal2-input" value="${g.gasto_fecha}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        preConfirm: () => {
            return {
                monto: document.getElementById('swal-monto').value,
                descripcion: document.getElementById('swal-desc').value,
                categoria: document.getElementById('swal-cat').value,
                gasto_fecha: document.getElementById('swal-fecha').value
            }
        }
    });

    if (formValues) {
        const { error } = await supabaseClient.from('gastos').update(formValues).eq('id', id);
        if (error) showAlert('Error', error.message);
        else notify('Actualizado correctamente');
    }
}

// ==============================================
// 6. FUNCIONES DE APOYO (Gráficos, Paginación, etc.)
// ==============================================

// ==============================================
// LÓGICA DE GRÁFICOS (CHART.JS)
// ==============================================

function renderCharts(data) {
    // Si no hay datos, limpiamos los gráficos y salimos
    if (!data || data.length === 0) {
        if (categoryChart) categoryChart.destroy();
        if (trendChart) trendChart.destroy();
        return;
    }

    renderCategoryChart(data);
    renderTrendChart(data);
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    // 1. Agrupar totales por categoría
    const totalesPorCategoria = {};
    data.forEach(gasto => {
        const cat = gasto.categoria || 'Otros';
        totalesPorCategoria[cat] = (totalesPorCategoria[cat] || 0) + parseFloat(gasto.monto);
    });

    const labels = Object.keys(totalesPorCategoria);
    const values = Object.values(totalesPorCategoria);

    // 2. Destruir gráfico anterior si existe para evitar solapamientos
    if (categoryChart) {
        categoryChart.destroy();
    }

    // 3. Crear el nuevo gráfico de tipo "Doughnut" (Dona)
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#0d6efd', // Primary
                    '#198754', // Success
                    '#ffc107', // Warning
                    '#dc3545', // Danger
                    '#0dcaf0', // Info
                    '#6c757d'  // Secondary
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Permite que se adapte al contenedor
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` S/ ${context.parsed.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderTrendChart(data) {
    const ctx = document.getElementById('trendChart').getContext('2d');

    // 1. Agrupar datos según la granularidad seleccionada (día, mes, año)
    const agrupado = {};
    data.forEach(gasto => {
        let key = gasto.gasto_fecha; // Por defecto: 'YYYY-MM-DD'
        
        if (trendGranularity === 'mes') {
            key = key.substring(0, 7); // Extrae 'YYYY-MM'
        } else if (trendGranularity === 'año') {
            key = key.substring(0, 4); // Extrae 'YYYY'
        }

        agrupado[key] = (agrupado[key] || 0) + parseFloat(gasto.monto);
    });

    // 2. Ordenar las fechas cronológicamente
    const labels = Object.keys(agrupado).sort();
    const values = labels.map(label => agrupado[label]);

    // 3. Destruir gráfico anterior
    if (trendChart) {
        trendChart.destroy();
    }

    // 4. Crear el nuevo gráfico (Gráfico de barras)
    trendChart = new Chart(ctx, {
        type: 'bar', // Puedes cambiar a 'line' si prefieres líneas
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Gastado (S/)',
                data: values,
                backgroundColor: 'rgba(25, 135, 84, 0.6)', // Verde translúcido
                borderColor: '#198754', // Verde oscuro
                borderWidth: 1,
                borderRadius: 4 // Bordes redondeados en las barras
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { callback: value => 'S/ ' + value }
                }
            },
            plugins: {
                legend: { display: false } // Ocultamos la leyenda por ser solo un set de datos
            }
        }
    });
}
function renderPagination() {
    const nav = document.getElementById('pagination-controls');
    nav.innerHTML = '';
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>`;
        nav.appendChild(li);
    }
}

window.cambiarPagina = (p) => {
    currentPage = p;
    obtenerGastos();
};

function setupRealtime() {
    supabaseClient.channel('custom-all-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => {
        obtenerGastos();
    }).subscribe();
}

// ==============================================
// EVENTOS DE LOS BOTONES DEL GRÁFICO DE TENDENCIA
// ==============================================
document.querySelectorAll('[data-granularity]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // 1. Quitar el color activo de todos los botones
        document.querySelectorAll('[data-granularity]').forEach(b => {
            b.classList.replace('btn-primary', 'btn-light');
            b.classList.replace('text-white', 'text-dark');
        });
        
        // 2. Poner el color activo al botón que clickeamos
        e.target.classList.replace('btn-light', 'btn-primary');
        e.target.classList.replace('text-dark', 'text-white');
        
        // 3. Cambiar la variable global y recargar datos
        trendGranularity = e.target.getAttribute('data-granularity');
        obtenerGastos(); 
    });
});

// ==============================================
// EVENTO DEL FILTRO POR CATEGORÍA
// ==============================================
const selectFiltroCategoria = document.getElementById('filter-categoria');

if (selectFiltroCategoria) {
    selectFiltroCategoria.addEventListener('change', () => {
        // Es una buena práctica regresar a la página 1 cuando aplicamos un filtro nuevo
        currentPage = 1; 
        
        // Llamamos a la función para que recargue todo inmediatamente
        obtenerGastos(); 
    });
}

// 2. El "Escuchador" global (Ponerlo justo antes del final del archivo)
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Evento Auth Detectado:", event);

    // Si el evento es SIGNED_IN (que ocurre al confirmar email o loguearse)
    // o INITIAL_SESSION (cuando recargas la página con un token activo)
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
            toggleUI(true);
            // Si quieres, puedes limpiar la URL aburrida con el token
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    if (event === 'SIGNED_OUT') {
        toggleUI(false);
    }
});

// Inicializar
checkUser();
