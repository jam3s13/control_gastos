/**
 * js/main.js
 * Responsabilidad: Unir los módulos, iniciar la app e inyectar variables globales necesarias.
 */
import { supabaseClient } from './supabaseClient.js';
import { toggleUI, initDashboardUI } from './ui.js'; 
import { checkUser, abrirPerfil } from './auth.js'; // <-- 1. Importas abrirPerfil aquí
import { initChartControls } from './charts.js';
import { obtenerGastos, setupRealtime } from './gastos.js';

// 1. Exponemos las funciones de datos de forma global para que auth.js y ui.js puedan 
// usarlas automáticamente cuando inicies sesión y cambien la interfaz.
window.obtenerGastos = obtenerGastos;
window.setupRealtime = setupRealtime;
window.abrirPerfil = abrirPerfil; // <-- 2. Expones la función globalmente para el HTML

// 2. Inicializamos los controles de los gráficos. Si alguien cambia la vista o granularidad,
// le indicamos al módulo de gastos que vuelva a consultar a la base de datos.
initChartControls(() => {
    obtenerGastos();
});

// NUEVO: Inicializamos la interfaz de usuario del Dashboard (Modo oscuro y Pestañas de navegación)
initDashboardUI();

// 3. Iniciamos la aplicación comprobando si hay una sesión activa en Supabase.
console.log("Gestor de Gastos (SRP Version) Inicializado.");
checkUser();