/**
 * js/ui.js
 * Responsabilidad: Manejo visual de la interfaz y notificaciones
 */

// Configuración global de SweetAlert2 Toast
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
});

export function notify(title, icon = 'success') {
    Toast.fire({ icon, title });
}

export function showAlert(title, text, icon = 'error') {
    Swal.fire({ title, text, icon, confirmButtonColor: '#0d6efd' });
}

export function toggleUI(loggedIn) {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (loggedIn) {
        authContainer.classList.add('d-none');
        appContainer.classList.remove('d-none');
    } else {
        authContainer.classList.remove('d-none');
        appContainer.classList.add('d-none');
    }
}

// ==========================================
// LÓGICA DEL DASHBOARD (Vistas y Modo Oscuro)
// ==========================================
export function initDashboardUI() {
    // 1. Navegación entre Pestañas (Vistas)
    const viewButtons = document.querySelectorAll('.btn-view');
    const views = document.querySelectorAll('.app-view');

    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Apagamos todos los botones y ocultamos todas las vistas
            viewButtons.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Encendemos el botón clickeado
            e.target.classList.add('active');

            // Mostramos la vista conectada a ese botón
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 2. Lógica del Modo Oscuro
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement; // Es la etiqueta <html>

    // Revisar si el usuario ya tenía guardado el modo oscuro de antes
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-bs-theme', savedTheme);
    
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';

        // Escuchar cuando el usuario encienda/apague el switch
        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            
            // Cambiamos el tema de Bootstrap
            htmlElement.setAttribute('data-bs-theme', newTheme);
            
            // Guardamos la preferencia en el navegador
            localStorage.setItem('theme', newTheme);
            
            // (Opcional) Le avisamos a los gráficos que repinten sus letras
            window.dispatchEvent(new Event('themeChanged'));
        });
    }
}

// Pintar la información del usuario en la barra lateral
export function renderUserProfile(email) {
    const profileBox = document.getElementById('user-profile-box');
    const userEmailEl = document.getElementById('user-email');
    const userAvatarEl = document.getElementById('user-avatar');

    if (!profileBox || !userEmailEl) return;

    if (email) {
        userEmailEl.textContent = email;
        // Colocamos la primera letra del correo en mayúscula dentro del círculo
        if (userAvatarEl) {
            userAvatarEl.textContent = email.charAt(0).toUpperCase();
        }
        profileBox.classList.remove('d-none');
    } else {
        // Si no hay correo (logout), limpiamos y ocultamos
        userEmailEl.textContent = '';
        profileBox.classList.add('d-none');
    }
}