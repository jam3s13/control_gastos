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

// Totales (Nuevo)
const totalGastosElement = document.getElementById('total-gastos');

// Filtrado (Nuevo)
const filterCategoria = document.getElementById('filter-categoria');

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
        obtenerGastos(filterCategoria.value); // Llama con el filtro inicial
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
// FASES 3, 4, 5: CRUD, Totales y Filtrado
// ==============================================

/**
 * FASE 3/UX: Obtiene, calcula el total, filtra y renderiza la lista de gastos.
 */
async function obtenerGastos(categoriaFilter = 'ALL') {
    gastosList.innerHTML = '<tr><td colspan="5" class="text-center">Cargando gastos...</td></tr>';
    
    totalGastosElement.textContent = '$0.00'; 
    
    let query = supabase
        .from('gastos')
        .select('monto, descripcion, categoria, fecha, id')
        .order('fecha', { ascending: false });

    // --- LÓGICA DE FILTRADO ---
    if (categoriaFilter !== 'ALL') {
        query = query.eq('categoria', categoriaFilter);
    }

    const { data: gastos, error } = await query;

    if (error) {
        console.error("Error al cargar gastos:", error.message);
        gastosList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        return;
    }

    // --- CÁLCULO DEL TOTAL ---
    const totalMonto = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
    totalGastosElement.textContent = `$${totalMonto.toFixed(2)}`;
    
    renderGastos(gastos);
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

        const formattedMonto = `$${parseFloat(gasto.monto).toFixed(2)}`;
        const formattedDate = new Date(gasto.fecha).toLocaleDateString('es-ES');

        row.insertCell(0).textContent = formattedMonto;
        row.insertCell(1).textContent = gasto.descripcion;
        row.insertCell(2).textContent = gasto.categoria;
        row.insertCell(3).textContent = formattedDate;

        const actionsCell = row.insertCell(4);
        actionsCell.innerHTML = `
            <button class="btn btn-sm btn-info text-white me-2 edit-btn" data-id="${gasto.id}">Editar</button>
            <button class="btn btn-sm btn-danger delete-btn" data-id="${gasto.id}">Eliminar</button>
        `;
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

    const nuevoGasto = {
        user_id: user.id,
        monto: parseFloat(montoInput.value),
        descripcion: descripcionInput.value,
        categoria: categoriaInput.value,
    };

    toggleLoading(gastoSubmitButton, true, 'Guardar Gasto');

    const { error } = await supabase
        .from('gastos')
        .insert([nuevoGasto]);

    toggleLoading(gastoSubmitButton, false, 'Guardar Gasto');

    if (error) {
        showAppAlert(`Error al agregar gasto: ${error.message}. Verifica tus permisos (RLS).`, 'danger');
    } else {
        // Manejo de éxito con Modal
        successMessage.textContent = `Monto: $${nuevoGasto.monto.toFixed(2)} - Categoría: ${nuevoGasto.categoria}`;
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
        // Abre el modal de confirmación de eliminación de Bootstrap
        confirmDeleteId.value = gastoId;
        deleteConfirmModal.show();
        
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
 * FASE 5: Event Listener para el filtro de categoría.
 */
filterCategoria.addEventListener('change', () => {
    const selectedCategory = filterCategoria.value;
    obtenerGastos(selectedCategory);
});


// ==============================================
// FASE 5: Realtime 
// ==============================================

function setupRealtime() {
    supabase
        .channel('gastos_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, (payload) => {
            console.log(`Cambio Realtime (${payload.eventType}) detectado. Recargando lista...`);
            
            // Llama a obtenerGastos con el filtro actualmente seleccionado
            obtenerGastos(filterCategoria.value); 
        })
        .subscribe();
}