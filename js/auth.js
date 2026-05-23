/**
 * js/auth.js
 * Responsabilidad: Manejo de usuarios, login, registro y sesiones.
 */
import { supabaseClient } from './supabaseclient.js';
import { notify, showAlert, toggleUI, renderUserProfile } from './ui.js'; // <- Agrega renderUserProfile aquí

// Elementos del DOM
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const toggleAuth = document.getElementById('toggle-auth');
const forgotPassword = document.getElementById('forgot-password');
const btnCerrarSesion = document.getElementById('signout-button');
const authForm = document.getElementById('auth-form');



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
if (authForm) {
    authForm.onsubmit = async (e) => {
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
                toggleAuth.click(); // Regresamos el form a modo "Iniciar Sesión"
            }
        }
    };
}

// 3. Cerrar Sesión
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            showAlert('Error', 'No se pudo cerrar la sesión: ' + error.message);
        } else {
            toggleUI(false);
            // Limpieza visual de seguridad
            document.getElementById('gastos-list').innerHTML = '';
            document.getElementById('total-gastos').textContent = 'S/0.00';
            notify('Sesión cerrada correctamente', 'info');
        }
    });
}

// 4. Solicitar Recuperación de Contraseña
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
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) showAlert('Error', error.message);
            else Swal.fire('Revisa tu correo', 'Te hemos enviado un enlace mágico para restablecer tu contraseña.', 'success');
        }
    });
}

// 5. Comprobar sesión activa
export async function checkUser() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) {
        console.error("Error al obtener sesión:", error);
        toggleUI(false);
        return;
    }
    if (session) {
        console.log("Sesión activa encontrada para:", session.user.email);
        toggleUI(true);
        renderUserProfile(session.user.email); // <-- NUEVO: Muestra el perfil al cargar
        actualizarDatosUsuarioUI(session.user);
        
        // ¡AQUÍ ESTÁ LA MAGIA! Traemos los datos y activamos el realtime
        if (window.obtenerGastos) window.obtenerGastos();
        if (window.setupRealtime) window.setupRealtime();
    } else {
        toggleUI(false);
        renderUserProfile(null); // <-- NUEVO: Oculta el perfil si no hay sesión
    }
}

// 6. Escuchador Global de Auth (Cambios de contraseña y auto-login)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
        const { value: newPassword } = await Swal.fire({
            title: 'Nueva Contraseña',
            input: 'password',
            inputLabel: 'Ingresa tu nueva contraseña (mínimo 6 caracteres)',
            showCancelButton: false,
            confirmButtonText: 'Actualizar Contraseña',
            allowOutsideClick: false
        });

        if (newPassword) {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) showAlert('Error', error.message);
            else {
                Swal.fire('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'success');
                checkUser();
            }
        }
    } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
            toggleUI(true);
            renderUserProfile(session.user.email); // <-- NUEVO: Muestra el perfil al iniciar sesión
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // ¡TAMBIÉN AQUÍ! Por si inician sesión desde el formulario
            if (window.obtenerGastos) window.obtenerGastos();
            if (window.setupRealtime) window.setupRealtime();
        }
    } else if (event === 'SIGNED_OUT') {
        toggleUI(false);
        renderUserProfile(null); // <-- NUEVO: Oculta el perfil al salir
    }
});


// ==========================================
// LÓGICA DEL PERFIL DE USUARIO (CON SWEETALERT2)
// ==========================================

// ==========================================
// LÓGICA DEL PERFIL DE USUARIO (CON GALERÍA DE AVATARES)
// ==========================================

export async function abrirPerfil() {
    // 1. Obtener datos del usuario
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const nombreActual = user.user_metadata?.full_name || '';
    
    // Si no tiene avatar, le asignamos uno por defecto
    const avatarActual = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.email}&backgroundColor=0d6efd`;
    let avatarSeleccionado = avatarActual; // Aquí guardaremos la elección del usuario

    // 2. Crear una lista de avatares para la galería
    const avatares = [
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=0d6efd',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=198754',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Jude&backgroundColor=ffc107',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Oreo&backgroundColor=dc3545',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Leo&backgroundColor=6f42c1',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=fd7e14',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Lily&backgroundColor=e83e8c',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe&backgroundColor=6f42c1',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Sophie&backgroundColor=20c997',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Daisy&backgroundColor=d63384',
        'https://api.dicebear.com/7.x/adventurer/svg?seed=Bella&backgroundColor=0dcaf0'
    ];

    // Generar el HTML de las fotitos
    const galeriaHTML = avatares.map(url => `
        <img src="${url}" data-url="${url}" class="avatar-option rounded border border-3 m-1 shadow-sm" 
             style="width: 55px; height: 55px; cursor: pointer; transition: 0.2s; border-color: ${avatarActual === url ? '#0d6efd' : 'transparent'} !important;" >
    `).join('');

    // 3. Abrir SweetAlert
    const { isConfirmed } = await Swal.fire({
        title: '<i class="bi bi-person-circle text-primary"></i> Mi Perfil',
       html: `
            <div class="text-center mb-3">
                <img id="swalAvatarPreview" src="${avatarActual}" class="rounded-circle shadow border border-3 border-light" width="100" height="100" style="background-color: #f8f9fa;">
            </div>
            
            <div class="mb-4">
                <p class=" small fw-bold mb-2">Elige tu avatar:</p>
                <div class="d-flex flex-wrap justify-content-center gap-2">
                    ${galeriaHTML}
                </div>
            </div>
            
            <div class="text-start">
                <label class="form-label small fw-bold">Nombre de visualización</label>
                <input type="text" id="swalNombre" class="form-control mb-3 bg-light" value="${nombreActual}" placeholder="Ej. Carlos">
                
                <label class="form-label small fw-bold">Correo Electrónico</label>
                <input type="email" class="form-control  mb-3" value="${user.email}" disabled>
                
                <button type="button" id="btnIrContrasena" class="btn btn-success btn-sm w-100">
                    <i class="bi bi-shield-lock me-2"></i> Cambiar Contraseña
                </button>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#0d6efd',
        customClass: { popup: 'rounded-4 shadow-lg' },
        
        didOpen: () => {
            // Lógica para que al hacer clic en un avatar de la galería, se seleccione
            const opciones = document.querySelectorAll('.avatar-option');
            opciones.forEach(img => {
                img.addEventListener('click', (e) => {
                    // Quitar borde azul a todos
                    opciones.forEach(el => el.style.setProperty('border-color', 'transparent', 'important'));
                    
                    // Poner borde azul al que tocaste
                    e.target.style.setProperty('border-color', '#0d6efd', 'important');
                    
                    // Actualizar la variable y la vista previa principal
                    avatarSeleccionado = e.target.getAttribute('data-url');
                    document.getElementById('swalAvatarPreview').src = avatarSeleccionado;
                });
            });

            // Lógica NUEVA para el botón de cambiar contraseña
            document.getElementById('btnIrContrasena').addEventListener('click', () => {
                Swal.close(); // Cierra el modal de perfil
                abrirCambioContrasena(); // Abre el modal de contraseña
            });
        },
        
        preConfirm: async () => {
            const nuevoNombre = document.getElementById('swalNombre').value;
            Swal.showLoading();
            try {
                // Actualizamos el nombre y el avatar al mismo tiempo en la base de datos
                const { error } = await supabaseClient.auth.updateUser({
                    data: { 
                        full_name: nuevoNombre,
                        avatar_url: avatarSeleccionado
                    }
                });
                if (error) throw error;
                return true;
            } catch (error) {
                Swal.showValidationMessage(`Error: ${error.message}`);
            }
        }
    });

    if (isConfirmed) {
        Swal.fire({
            icon: 'success',
            title: '¡Perfil Actualizado!',
            showConfirmButton: false,
            timer: 1500
        });
        
        // Aquí podrías llamar a una función que actualice la barra lateral para que refleje los cambios al instante

        const { data: { user } } = await supabaseClient.auth.getUser();
        actualizarDatosUsuarioUI(user);
    }
};

// ==========================================
// LÓGICA PARA CAMBIAR CONTRASEÑA
// ==========================================
// ==========================================
// LÓGICA PARA CAMBIAR CONTRASEÑA (Con ojito para ver)
// ==========================================
async function abrirCambioContrasena() {
    const { value: nuevaContrasena } = await Swal.fire({
        title: '<i class="bi bi-shield-lock text-warning"></i> Cambiar Contraseña',
        html: `
            <div class="text-start">
                <label class="form-label small fw-bold">Nueva Contraseña</label>
                <div class="input-group mb-3">
                    <input type="password" id="swalPass1" class="form-control bg-light" placeholder="Mínimo 6 caracteres">
                    <button class="btn btn-outline-secondary btn-toggle-pass" type="button" data-target="swalPass1">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
                
                <label class="form-label small fw-bold">Confirmar Contraseña</label>
                <div class="input-group mb-1">
                    <input type="password" id="swalPass2" class="form-control bg-light" placeholder="Repite la contraseña">
                    <button class="btn btn-outline-secondary btn-toggle-pass" type="button" data-target="swalPass2">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Actualizar Contraseña',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#198754',
        customClass: { popup: 'rounded-4 shadow-lg' },
        
        didOpen: () => {
            // Lógica para el botón del "ojito" (Mostrar/Ocultar contraseña)
            const toggleButtons = document.querySelectorAll('.btn-toggle-pass');
            
            toggleButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    // Obtener el ID del input al que pertenece este botón
                    const targetId = this.getAttribute('data-target');
                    const input = document.getElementById(targetId);
                    const icon = this.querySelector('i');
                    
                    // Alternar el tipo de input y cambiar el icono
                    if (input.type === 'password') {
                        input.type = 'text';
                        icon.classList.remove('bi-eye');
                        icon.classList.add('bi-eye-slash'); // Icono de ojo tachado
                    } else {
                        input.type = 'password';
                        icon.classList.remove('bi-eye-slash');
                        icon.classList.add('bi-eye'); // Icono de ojo normal
                    }
                });
            });
        },
        
        preConfirm: () => {
            const pass1 = document.getElementById('swalPass1').value;
            const pass2 = document.getElementById('swalPass2').value;
            
            if (!pass1 || !pass2) {
                Swal.showValidationMessage('Ambos campos son obligatorios');
                return false;
            }
            if (pass1 !== pass2) {
                Swal.showValidationMessage('Las contraseñas no coinciden');
                return false;
            }
            if (pass1.length < 6) {
                Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres');
                return false;
            }
            return pass1;
        }
    });

    if (nuevaContrasena) {
        Swal.fire({
            title: 'Actualizando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: nuevaContrasena
            });

            if (error) throw error;

            Swal.fire({
                icon: 'success',
                title: '¡Contraseña Actualizada!',
                text: 'Tu nueva contraseña ha sido guardada con éxito.',
                confirmButtonColor: '#0d6efd'
            });

        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    }
};

// Actualiza visualmente el Sidebar y el saludo principal
export function actualizarDatosUsuarioUI(user) {
    if (!user) return;

    const nombre = user.user_metadata?.full_name || 'Usuario';
    const email = user.email;
    const avatarUrl = user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${email}&backgroundColor=0d6efd`;

    // 1. Actualizar Sidebar
    document.getElementById('sidebar-name').innerText = nombre;
    document.getElementById('sidebar-email').innerText = email;
    document.getElementById('sidebar-avatar').src = avatarUrl;
    
    // Mostrar la caja del perfil si estaba oculta
    document.getElementById('user-profile-box').classList.remove('d-none');

    // 2. Actualizar Saludo en el Dashboard
    const saludoElemento = document.getElementById('dashboard-saludo');
    if (saludoElemento) {
        // Opcional: Saludo por hora del día
        const hora = new Date().getHours();
        let textoSaludo = '¡Hola';
        if (hora < 12) textoSaludo = '¡Buenos días';
        else if (hora < 19) textoSaludo = '¡Buenas tardes';
        else textoSaludo = '¡Buenas noches';

        saludoElemento.innerHTML = `${textoSaludo}, <span class="text-primary">${nombre}</span>!`;
        saludoElemento.classList.remove('d-none');
    }
}