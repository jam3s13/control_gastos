// ==============================================
// FASE 1: Inicialización y Variables Globales
// ==============================================

// ⚠️ REEMPLAZA CON TUS CLAVES DE SUPABASE ⚠️
const SUPABASE_URL = 'https://vcjydkhtrxjpfkytmgtj.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjanlka2h0cnhqcGZreXRtZ3RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM2MjYsImV4cCI6MjA3NzY4OTYyNn0.K7Zs1_5-nyWp7cVT1wM6WZmMhk_Y_ZwICaMvETkP2DI'; 

// Inicialización corregida del cliente Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----------------------------------------------
// Referencias al DOM
// ----------------------------------------------

// Auth (Fase 2)
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const toggleAuthLink = document.getElementById('toggle-auth');
const authForm = document.getElementById('auth-form');
const alertAuth = document.getElementById('alert-auth'); 
const signoutButton = document.getElementById('signout-button');

// Aplicación (Fases 3 y 4)
const gastoForm = document.getElementById('gasto-form');
const gastosList = document.getElementById('gastos-list');
const gastoSubmitButton = document.getElementById('gasto-button'); 

// Totales
const totalGastosElement = document.getElementById('total-gastos');

// Filtrado
const filterCategoria = document.getElementById('filter-categoria');

// Ordenamiento
let currentSortColumn = 'gasto_fecha'; // Columna por defecto (Fecha de Gasto)
let currentSortOrder = 'desc'; // Orden por defecto (descendente)

// Gráfico de Distribución
const categoryChartCanvas = document.getElementById('categoryChart');
let categoryChart = null; 

// Gráfico de Tendencia
const trendChartCanvas = document.getElementById('trendChart');
const trendButtons = document.querySelectorAll('.btn-group button[data-granularity]');
let trendChart = null; 
let trendGranularity = 'day'; // Estado inicial: agrupar por día

// Fecha
const gastoFechaInput = document.getElementById('gasto-fecha');
const editGastoFecha = document.getElementById('edit-gasto-fecha');

// Paginación (NUEVO)
const paginationControls = document.getElementById('pagination-controls');
const PAGE_SIZE = 10; // Número fijo de gastos por página
let currentPage = 1; // Página actual
let totalPages = 1; // Total de páginas disponibles

// Edición Modal (Fase 4)
const editGastoModalElement = document.getElementById('editGastoModal');
const editGastoModal = new bootstrap.Modal(editGastoModalElement);
const editGastoForm = document.getElementById('edit-gasto-form');
const editGastoId = document.getElementById('edit-gasto-id');
const editGastoMonto = document.getElementById('edit-gasto-monto');
const editGastoDescripcion = document.getElementById('edit-gasto-descripcion');
const editGastoCategoria = document.getElementById('edit-gasto-categoria');

// Confirmación de Eliminación (UX)
const deleteConfirmModalElement = document.getElementById('deleteConfirmModal');
const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalElement);
const confirmDeleteId = document.getElementById('confirm-delete-id');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Modal de Éxito (UX)
const successModalElement = document.getElementById('successModal');
const successModal = new bootstrap.Modal(successModalElement);
const successMessage = document.getElementById('success-message');

// Variables de Estado
let isSignInMode = true;

// ----------------------------------------------
// FUNCIONES HELPER (Manejo de Errores y Carga)
// ----------------------------------------------

const appAlertsContainer = document.createElement('div');
appAlertsContainer.className = 'my-3';
appAlertsContainer.id = 'app-alerts';
appContainer.prepend(appAlertsContainer); 

/**
 * Muestra una alerta con Bootstrap en la vista principal y la oculta automáticamente.
 */
function showAppAlert(message, type = 'danger') {
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    appAlertsContainer.innerHTML = alertHTML;
    
    setTimeout(() => {
        const currentAlert = appAlertsContainer.querySelector('.alert');
        if (currentAlert) {
            new bootstrap.Alert(currentAlert).close();
        }
    }, 5000);
}

/**
 * Alterna el estado de carga y el spinner de un botón.
 */
function toggleLoading(buttonElement, isLoading, originalText) {
    if (isLoading) {
        buttonElement.dataset.originalText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.innerHTML = `
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            Cargando...
        `;
    } else {
        buttonElement.disabled = false;
        buttonElement.textContent = originalText || buttonElement.dataset.originalText;
        delete buttonElement.dataset.originalText;
    }
}


// ==============================================
// FASE 2: Lógica de Autenticación
// ==============================================

function toggleUI(loggedIn) {
    if (loggedIn) {
        authContainer.classList.add('d-none');
        appContainer.classList.remove('d-none');
        setupRealtime();
        // Inicializa el botón de tendencia y llama a obtenerGastos con el filtro/ordenamiento actual
        document.getElementById('trend-day').classList.add('btn-info');
        // Aseguramos que la página se restablezca a 1 al cargar
        currentPage = 1; 
        obtenerGastos(filterCategoria.value); 
    } else {
        authContainer.classList.remove('d-none');
        appContainer.classList.add('d-none');
        gastosList.innerHTML = '<tr><td colspan="5" class="text-center">No has iniciado sesión.</td></tr>';
    }
}

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    toggleUI(!!user);
}

authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    let authResponse;

    alertAuth.classList.add('d-none');
    alertAuth.classList.remove('alert-success', 'alert-danger');
    
    toggleLoading(authButton, true, isSignInMode ? 'Entrar' : 'Registrarme');

    if (isSignInMode) {
        authResponse = await supabase.auth.signInWithPassword({ email, password });
    } else {
        authResponse = await supabase.auth.signUp({ email, password });
    }
    
    toggleLoading(authButton, false, isSignInMode ? 'Entrar' : 'Registrarme');

    if (authResponse.error) {
        alertAuth.textContent = `Error: ${authResponse.error.message}`;
        alertAuth.classList.remove('d-none');
        alertAuth.classList.add('alert-danger');
    } else if (authResponse.data.user) {
        toggleUI(true);
    } else if (!isSignInMode) {
        alertAuth.textContent = 'Registro exitoso. Revisa tu email para confirmar la cuenta.';
        alertAuth.classList.remove('d-none');
        alertAuth.classList.add('alert-success');
        toggleAuthLink.click(); 
    }
};

toggleAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    isSignInMode = !isSignInMode; 

    if (isSignInMode) {
        authTitle.textContent = 'Iniciar Sesión';
        authButton.textContent = 'Entrar';
        toggleAuthLink.textContent = '¿No tienes cuenta? Regístrate';
    } else {
        authTitle.textContent = 'Registrar Cuenta';
        authButton.textContent = 'Registrarme';
        toggleAuthLink.textContent = '¿Ya tienes cuenta? Inicia Sesión';
    }
    alertAuth.classList.add('d-none');
    alertAuth.classList.remove('alert-success', 'alert-danger');
});

signoutButton.onclick = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        toggleUI(false);
    } else {
        showAppAlert(`Error al cerrar sesión: ${error.message}`, 'danger');
    }
};

checkUser();


// ==============================================
// FASES 3, 4, 5: CRUD, Totales, Filtrado y Gráficos
// ==============================================

/**
 * FASE 3/UX: Obtiene, calcula el total, filtra, ordena, pagina y renderiza la lista de gastos.
 * * ⚠️ CORRECCIÓN CLAVE: Se separa la consulta en dos: una para el Análisis (todos los gastos)
 * y otra para la Visualización (gastos de la página actual).
 */
async function obtenerGastos(categoriaFilter = 'ALL') {
    gastosList.innerHTML = '<tr><td colspan="5" class="text-center">Cargando gastos...</td></tr>';
    totalGastosElement.textContent = 'S/0.00'; 
    
    // --- QUERY 1: Obtener TODOS los datos necesarios para ANÁLISIS, Totales y Conteo ---
    let analysisQuery = supabase
        .from('gastos')
        // Solo necesitamos estos campos para Charts y Totales. Pedimos el conteo total.
        .select('monto, descripcion, categoria, gasto_fecha', { count: 'exact' }); 
        
    // LÓGICA DE FILTRADO (debe aplicarse a ambas consultas)
    if (categoriaFilter !== 'ALL') {
        analysisQuery = analysisQuery.eq('categoria', categoriaFilter);
    }
    
    // Ejecutar la consulta de análisis (sin paginación)
    const { data: allGastosForAnalysis, error: analysisError, count: totalCount } = await analysisQuery;

    if (analysisError) {
        console.error("Error al cargar datos de análisis:", analysisError.message);
        gastosList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${analysisError.message}</td></tr>`;
        return;
    }
    
    // 1. CÁLCULO DE PÁGINAS y TOTALES (Usando el conteo total)
    const totalItems = totalCount || 0;
    totalPages = Math.ceil(totalItems / PAGE_SIZE);
    
    // Si la página actual excede el nuevo total de páginas, vamos a la última página válida
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    
    // CÁLCULO DEL TOTAL (Usando TODOS los gastos)
    const totalMonto = allGastosForAnalysis.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
    totalGastosElement.textContent = `S/ ${totalMonto.toFixed(2)}`;

    // RENDERIZADO DE GRÁFICOS (Usando TODOS los gastos)
    renderChart(allGastosForAnalysis);
    renderTrendChart(allGastosForAnalysis, trendGranularity);
    renderPaginationControls(); // Actualiza los controles antes de dibujar la tabla


    // --- QUERY 2: Obtener los datos para la TABLA (con Paginación) ---
    const offset = (currentPage - 1) * PAGE_SIZE;
    const limit = PAGE_SIZE - 1; // Supabase es inclusivo (ej: 0 a 9)
    
    let displayQuery = supabase
        .from('gastos')
        // Seleccionamos todos los campos necesarios para la tabla
        .select('monto, descripcion, categoria, gasto_fecha, id'); 
    
    // LÓGICA DE FILTRADO (debe aplicarse)
    if (categoriaFilter !== 'ALL') {
        displayQuery = displayQuery.eq('categoria', categoriaFilter);
    }
    
    // LÓGICA DE ORDENAMIENTO (debe aplicarse)
    const isAscending = currentSortOrder === 'asc';
    displayQuery = displayQuery.order(currentSortColumn, { ascending: isAscending });

    // LÓGICA DE PAGINACIÓN: Aplicar el rango
    displayQuery = displayQuery.range(offset, offset + limit);

    const { data: gastosForDisplay, error: displayError } = await displayQuery;

    if (displayError) {
        console.error("Error al cargar gastos para mostrar:", displayError.message);
        gastosList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar la tabla: ${displayError.message}</td></tr>`;
        return;
    }
    
    // RENDERIZADO DE LA TABLA
    renderGastos(gastosForDisplay);
    updateSortIndicators();
}

function renderGastos(gastos) {
    gastosList.innerHTML = '';
    if (gastos.length === 0) {
        gastosList.innerHTML = '<tr><td colspan="5" class="text-center">No tienes gastos registrados.</td></tr>';
        return;
    }

    gastos.forEach(gasto => {
        const row = gastosList.insertRow();
        row.dataset.id = gasto.id;

        const formattedMonto = `S/${parseFloat(gasto.monto).toFixed(2)}`;
        
        // SOLUCIÓN DE ZONA HORARIA: Agregamos 'T00:00:00' para evitar que JS retroceda la fecha un día.
        const formattedDate = new Date(gasto.gasto_fecha + 'T00:00:00').toLocaleDateString('es-ES');

        row.insertCell(0).textContent = formattedMonto;
        row.insertCell(1).textContent = gasto.descripcion;
        row.insertCell(2).textContent = gasto.categoria;
        row.insertCell(3).textContent = formattedDate; // La columna 3 es la fecha

        const actionsCell = row.insertCell(4);
        actionsCell.innerHTML = `
            <button class="btn btn-sm btn-info text-white me-2 edit-btn" data-id="${gasto.id}">Editar</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${gasto.id}">Eliminar</button>
        `;
    });
}

/**
 * UX: Dibuja los controles de paginación (botones).
 */
function renderPaginationControls() {
    paginationControls.innerHTML = '';
    
    if (totalPages <= 1) return;

    // Botón Anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a>`;
    paginationControls.appendChild(prevLi);

    // Botones de Página (mostrar un rango limitado)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        paginationControls.appendChild(li);
    }
    
    // Mostrar puntos suspensivos si es necesario
    if (endPage < totalPages) {
        const dotsLi = document.createElement('li');
        dotsLi.className = 'page-item disabled';
        dotsLi.innerHTML = `<span class="page-link">...</span>`;
        paginationControls.appendChild(dotsLi);
    }
    
    // Botón Siguiente
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Siguiente</a>`;
    paginationControls.appendChild(nextLi);
}


/**
 * UX: Procesa los gastos y renderiza el gráfico de pastel por categoría.
 */
function renderChart(gastos) {
    const categoryTotals = gastos.reduce((acc, gasto) => {
        const monto = parseFloat(gasto.monto);
        if (acc[gasto.categoria]) {
            acc[gasto.categoria] += monto;
        } else {
            acc[gasto.categoria] = monto;
        }
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const colors = {
        'Alimentación': '#dc3545', // Rojo
        'Transporte': '#0d6efd', // Azul
        'Vivienda': '#ffc107', // Amarillo
        'Entretenimiento': '#17a2b8', // Info (Cian)
        'Otros': '#6c757d', // Gris
    };
    
    const backgroundColors = labels.map(label => colors[label] || '#CCCCCC');

    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(categoryChartCanvas, {
        type: 'doughnut', 
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: {
                    display: true,
                    text: 'Distribución Porcentual del Gasto',
                    font: { size: 14 }
                }
            }
        }
    });
}

/**
 * UX: Procesa los gastos y renderiza el gráfico de línea de tendencia.
 */
function renderTrendChart(gastos, granularity) {
    if (trendChart) {
        trendChart.destroy();
    }
    
    // Función helper para formatear la fecha según la granularidad
    const formatLabel = (date) => {
        // SOLUCIÓN DE ZONA HORARIA: Forzar la medianoche local para evitar desfases
        const d = new Date(date + 'T00:00:00'); 
        
        switch (granularity) {
            case 'año':
                return d.getFullYear();
            case 'mes':
                // Nota: Usamos ISO (YYYY-MM) para asegurar el ordenamiento correcto en el switch:
                return d.toISOString().substring(0, 7); 
            case 'dia':
            default:
                // Nota: Usamos ISO (YYYY-MM-DD) para asegurar el ordenamiento correcto en el switch:
                return date; // Ya viene como YYYY-MM-DD
        }
    };
    
    // 1. Agrupar montos por la clave de tiempo (usando gasto_fecha)
    const trendData = gastos.reduce((acc, gasto) => {
        const monto = parseFloat(gasto.monto);
        const dateKey = formatLabel(gasto.gasto_fecha); 
        
        if (acc[dateKey]) {
            acc[dateKey] += monto;
        } else {
            acc[dateKey] = monto;
        }
        return acc;
    }, {});

    // 2. ORDENAMIENTO CRONOLÓGICO:
    // Ahora las claves son YYYY-MM-DD o YYYY-MM, que se ordenan correctamente como texto (alfabéticamente).
    const sortedLabels = Object.keys(trendData).sort();
    const data = sortedLabels.map(label => trendData[label]);
    
    // 3. Formatear las etiquetas para visualización si es necesario (solo si se agrupa por mes)
    const labels = sortedLabels.map(label => {
        if (granularity === 'month') {
             // Convertimos de YYYY-MM a "Dic. 2025" para la visualización final
             const [year, month] = label.split('-');
             const d = new Date(year, month - 1); // mes - 1 porque JS es base 0
             return d.toLocaleString('es-ES', { year: 'numeric', month: 'short' });
        }
        return label; // Días ya están bien (YYYY-MM-DD)
    });

    // 4. Crear el gráfico de línea
    trendChart = new Chart(trendChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto Total',
                data: data,
                borderColor: '#17a2b8', 
                backgroundColor: 'rgba(23, 162, 184, 0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Monto (S/)' }
                }
            },
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Gasto Agrupado por ${granularity.toUpperCase()}`,
                    font: { size: 12 }
                }
            }
        }
    });
}


/**
 * FASE 3/UX: Agrega un nuevo gasto.
 */
gastoForm.onsubmit = async (e) => {
    e.preventDefault();
    
    gastoForm.classList.add('was-validated');
    if (!gastoForm.checkValidity()) {
        showAppAlert('Por favor, rellena todos los campos de forma válida.', 'warning');
        return;
    }
    
    const user = (await supabase.auth.getUser()).data.user;
    const montoInput = document.getElementById('gasto-monto');
    const descripcionInput = document.getElementById('gasto-descripcion');
    const categoriaInput = document.getElementById('gasto-categoria');
    const gastoFecha = gastoFechaInput.value; 

    const nuevoGasto = {
        user_id: user.id,
        monto: parseFloat(montoInput.value),
        descripcion: descripcionInput.value,
        categoria: categoriaInput.value,
        gasto_fecha: gastoFecha, 
    };

    toggleLoading(gastoSubmitButton, true, 'Guardar Gasto');

    const { error } = await supabase
        .from('gastos')
        .insert([nuevoGasto]);

    toggleLoading(gastoSubmitButton, false, 'Guardar Gasto');

    if (error) {
        showAppAlert(`Error al agregar gasto: ${error.message}. Verifica tus permisos (RLS).`, 'danger');
    } else {
        successMessage.textContent = `Monto: S/${nuevoGasto.monto.toFixed(2)} - Categoría: ${nuevoGasto.categoria} (Fecha: ${new Date(gastoFecha + 'T00:00:00').toLocaleDateString('es-ES')})`;
        successModal.show();
        
        gastoForm.reset();
        gastoForm.classList.remove('was-validated');
    }
};

/**
 * FASE 4/UX: Delega la eliminación y abre el modal de edición.
 */
gastosList.onclick = async (e) => {
    const target = e.target;
    const gastoId = target.dataset.id;
    
    if (!gastoId) return;

    if (target.classList.contains('delete-btn')) {
        deleteConfirmModal.show();
        confirmDeleteId.value = gastoId;
        
    } else if (target.classList.contains('edit-btn')) {
        target.disabled = true; 
        
        const { data: gasto, error } = await supabase
            .from('gastos')
            .select('*')
            .eq('id', gastoId)
            .single();

        target.disabled = false; 

        if (error || !gasto) {
            console.error("Error al obtener gasto para edición:", error?.message);
            showAppAlert(`No se pudo cargar el gasto: ${error?.message}`, 'danger');
            return;
        }

        editGastoId.value = gasto.id;
        editGastoMonto.value = gasto.monto;
        editGastoDescripcion.value = gasto.descripcion;
        editGastoCategoria.value = gasto.categoria;
        editGastoFecha.value = gasto.gasto_fecha; // Carga la fecha sin desfase

        editGastoModal.show();
    }
};

/**
 * FASE 4/UX: Lógica de eliminación tras confirmación del modal.
 */
confirmDeleteBtn.onclick = () => {
    const idToDelete = confirmDeleteId.value;
    if (idToDelete) {
        eliminarGasto(idToDelete);
    }
    deleteConfirmModal.hide();
};

async function eliminarGasto(id) {
    const { error } = await supabase
        .from('gastos')
        .delete()
        .eq('id', id);

    if (error) {
        showAppAlert(`Error al eliminar gasto: ${error.message}`, 'danger');
    } else {
        showAppAlert('Gasto eliminado exitosamente.', 'success');
    }
}

/**
 * FASE 4/UX: Actualiza un gasto desde el modal.
 */
editGastoForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const id = editGastoId.value;
    const saveButton = editGastoModalElement.querySelector('button[type="submit"]');

    const updates = {
        monto: parseFloat(editGastoMonto.value),
        descripcion: editGastoDescripcion.value,
        categoria: editGastoCategoria.value,
        gasto_fecha: editGastoFecha.value,
    };
    
    toggleLoading(saveButton, true, 'Guardar Cambios');

    const { error } = await supabase
        .from('gastos')
        .update(updates)
        .eq('id', id);

    toggleLoading(saveButton, false, 'Guardar Cambios');

    if (error) {
        showAppAlert(`Error al actualizar gasto: ${error.message}`, 'danger');
    } else {
        editGastoModal.hide(); 
        showAppAlert('Gasto actualizado exitosamente.', 'success');
    }
};

/**
 * UX: Actualiza las flechas indicadoras de orden en los encabezados.
 */
function updateSortIndicators() {
    document.querySelectorAll('.sortable span').forEach(span => {
        span.textContent = '';
    });

    const indicator = document.getElementById(`sort-${currentSortColumn}`);
    if (indicator) {
        indicator.textContent = currentSortOrder === 'asc' ? '▲' : '▼';
    }
}

/**
 * UX: Listener para hacer clic en los encabezados de la tabla.
 */
document.querySelector('#app-container table thead').addEventListener('click', (e) => {
    const header = e.target.closest('.sortable');
    if (!header) return;

    const newSortColumn = header.dataset.sort;

    if (newSortColumn === currentSortColumn) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = newSortColumn;
        currentSortOrder = 'desc'; 
    }
    
    // Al ordenar, volvemos a la página 1
    currentPage = 1;
    obtenerGastos(filterCategoria.value);
});


/**
 * FASE 5: Event Listener para el filtro de categoría.
 */
filterCategoria.addEventListener('change', () => {
    const selectedCategory = filterCategoria.value;
    // Al filtrar, volvemos a la página 1
    currentPage = 1;
    obtenerGastos(selectedCategory);
});

/**
 * UX: Listener para cambiar la granularidad del gráfico de tendencia.
 */
trendButtons.forEach(button => {
    button.addEventListener('click', () => {
        trendButtons.forEach(btn => btn.classList.remove('active', 'btn-info'));
        
        button.classList.add('active', 'btn-info');
        
        trendGranularity = button.dataset.granularity;
        obtenerGastos(filterCategoria.value);
    });
});

/**
 * UX: Listener para cambiar la página al hacer clic en los botones.
 */
paginationControls.addEventListener('click', (e) => {
    e.preventDefault();
    const target = e.target.closest('.page-link');
    if (!target) return;
    
    const newPage = parseInt(target.dataset.page);
    
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
        currentPage = newPage;
        // Recargar la lista con la nueva página
        obtenerGastos(filterCategoria.value); 
    }
});


// ==============================================
// FASE 5: Realtime 
// ==============================================

function setupRealtime() {
    supabase
        .channel('gastos_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, (payload) => {
            console.log(`Cambio Realtime (${payload.eventType}) detectado. Recargando lista...`);
            // Al detectar un cambio, aseguramos que la página se mantenga o salte si es necesario
            obtenerGastos(filterCategoria.value); 
        })
        .subscribe();
}