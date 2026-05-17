/**
 * js/auth.js
 * Responsabilidad: Manejo de usuarios, login, registro y sesiones.
 */
import { supabaseClient } from './supabaseClient.js';
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