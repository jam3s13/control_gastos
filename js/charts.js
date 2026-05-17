/**
 * js/charts.js
 * Responsabilidad: Configurar y renderizar gráficos con Chart.js
 */

let categoryChart = null;
let trendChart = null;
export let trendGranularity = 'dia';

// Cambiar el color de fuente por defecto de Chart.js según el tema
function updateChartColors() {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    Chart.defaults.color = isDark ? '#f8f9fa' : '#6c757d'; // Texto blanco en oscuro, gris en claro
}

// Escuchamos el evento de cambio de tema que creamos en ui.js
window.addEventListener('themeChanged', () => {
    updateChartColors();
    if(window.obtenerGastos) window.obtenerGastos(); // Repintamos los gráficos
});

// Aplicamos el color correcto al cargar la página por primera vez
updateChartColors();

// Eventos de los botones de tendencia
export function initChartControls(onGranularityChange) {
    document.querySelectorAll('[data-granularity]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Quitar estilos activos
            document.querySelectorAll('[data-granularity]').forEach(b => {
                b.classList.replace('btn-primary', 'btn-light');
                b.classList.replace('text-white', 'text-dark');
            });
            // Aplicar estilos al clickeado
            e.target.classList.replace('btn-light', 'btn-primary');
            e.target.classList.replace('text-dark', 'text-white');
            
            trendGranularity = e.target.getAttribute('data-granularity');
            // Ejecutamos el callback para recargar datos
            if(onGranularityChange) onGranularityChange();
        });
    });
}

export function renderCharts(data) {
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
    const totalesPorCategoria = {};
    
    data.forEach(gasto => {
        const cat = gasto.categoria || 'Otros';
        totalesPorCategoria[cat] = (totalesPorCategoria[cat] || 0) + parseFloat(gasto.monto);
    });

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(totalesPorCategoria),
            datasets: [{
                data: Object.values(totalesPorCategoria),
                backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0', '#6c757d'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: context => ` S/ ${context.parsed.toFixed(2)}` } }
            }
        }
    });
}

function renderTrendChart(data) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const agrupado = {};
    
    data.forEach(gasto => {
        let key = gasto.gasto_fecha; 
        if (trendGranularity === 'mes') key = key.substring(0, 7);
        else if (trendGranularity === 'año') key = key.substring(0, 4);

        agrupado[key] = (agrupado[key] || 0) + parseFloat(gasto.monto);
    });

    const labels = Object.keys(agrupado).sort();
    const values = labels.map(label => agrupado[label]);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Gastado (S/)',
                data: values,
                backgroundColor: 'rgba(25, 135, 84, 0.6)',
                borderColor: '#198754',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: value => 'S/ ' + value } } },
            plugins: { legend: { display: false } }
        }
    });
}