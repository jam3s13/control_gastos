/**
 * js/gastos.js
 * Responsabilidad: Lógica de negocio (CRUD, paginación y tiempo real)
 */
import { supabaseClient } from "./supabaseclient.js";
import { notify, showAlert } from "./ui.js";
import { renderCharts } from "./charts.js";

// Elementos del DOM
const gastosList = document.getElementById("gastos-list");
const totalGastosElement = document.getElementById("total-gastos");
const selectFiltroCategoria = document.getElementById("filter-categoria");
const gastoForm = document.getElementById("gasto-form");

// Estado de la Tabla y Paginación
let currentPage = 1;
const PAGE_SIZE = 10;
let totalPages = 1;
let currentSortColumn = "gasto_fecha";
let currentSortOrder = "desc";
let realtimeChannel = null;

// Variable para el filtro de mes global
const globalMonthFilter = document.getElementById('global-month-filter');

if (globalMonthFilter) {
    // Al cargar, poner el input en el mes y año actual (Formato: YYYY-MM)
    const hoy = new Date();
    const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const anio = hoy.getFullYear();
    globalMonthFilter.value = `${anio}-${mes}`;

    // Si el usuario cambia el mes, regresamos a la página 1 y recargamos datos
    globalMonthFilter.addEventListener('change', () => {
        currentPage = 1;
        obtenerGastos();
    });
}

// Estado para los botones globales
let selectedGastoId = null;
const btnEditGlobal = document.getElementById("btn-edit-global");
const btnDeleteGlobal = document.getElementById("btn-delete-global");

// ==========================================
// 1. OBTENER Y RENDERIZAR DATOS
// ==========================================
export async function obtenerGastos() {
    const filter = selectFiltroCategoria ? selectFiltroCategoria.value : 'ALL';
    const mesFiltro = globalMonthFilter ? globalMonthFilter.value : null; // "YYYY-MM"
    
    // ==========================================
    // 1. CONSTRUIR CONSULTA (Filtros y Fechas)
    // ==========================================
    let queryTotales = supabaseClient.from('gastos').select('monto, categoria, gasto_fecha', { count: 'exact' });
    
    if (filter !== 'ALL') queryTotales = queryTotales.eq('categoria', filter);
    
    // Filtro mágico de fechas (Rango: desde el día 1 hasta el último día del mes)
    if (mesFiltro) {
        const [year, month] = mesFiltro.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate(); // Obtiene cuántos días tiene ese mes
        const endDate = `${year}-${month}-${lastDay}`;
        
        queryTotales = queryTotales.gte('gasto_fecha', startDate).lte('gasto_fecha', endDate);
    }
    
    const { data: allData, count } = await queryTotales;
    if (!allData) return;

    // ==========================================
    // 2. CÁLCULO DE MÉTRICAS (KPIs)
    // ==========================================
    if (allData.length > 0) {
        const total = allData.reduce((acc, g) => acc + parseFloat(g.monto), 0);
        if (document.getElementById('kpi-total')) document.getElementById('kpi-total').textContent = `S/ ${total.toFixed(2)}`;

        const mayor = Math.max(...allData.map(g => parseFloat(g.monto)));
        if (document.getElementById('kpi-mayor')) document.getElementById('kpi-mayor').textContent = `S/ ${mayor.toFixed(2)}`;

        // Promedio Inteligente basado en el mes
        let diasParaPromedio = 1;
        if (mesFiltro) {
            const [year, month] = mesFiltro.split('-');
            const hoy = new Date();
            
            // Si el mes seleccionado es exactamente el mes y año en el que estamos hoy
            if (parseInt(year) === hoy.getFullYear() && parseInt(month) === (hoy.getMonth() + 1)) {
                diasParaPromedio = hoy.getDate() || 1; // Días transcurridos
            } else {
                diasParaPromedio = new Date(year, month, 0).getDate(); // Total de días del mes pasado
            }
        }
        
        const promedio = total / diasParaPromedio;
        if (document.getElementById('kpi-promedio')) document.getElementById('kpi-promedio').textContent = `S/ ${promedio.toFixed(2)}`;

        // Categoría Principal
        const totalesPorCat = {};
        allData.forEach(g => totalesPorCat[g.categoria] = (totalesPorCat[g.categoria] || 0) + parseFloat(g.monto));
        
        let topCategoria = '-';
        let maxMontoCat = 0;
        for (const [cat, monto] of Object.entries(totalesPorCat)) {
            if (monto > maxMontoCat) { maxMontoCat = monto; topCategoria = cat; }
        }
        if (document.getElementById('kpi-categoria')) document.getElementById('kpi-categoria').textContent = topCategoria;
    } else {
        // Reiniciar tarjetas si no hay gastos ese mes
        ['kpi-total', 'kpi-promedio', 'kpi-mayor'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).textContent = 'S/ 0.00';
        });
        if (document.getElementById('kpi-categoria')) document.getElementById('kpi-categoria').textContent = '--';
    }
    
    renderCharts(allData);

    // ==========================================
    // 3. PAGINACIÓN Y TABLA
    // ==========================================
    totalPages = Math.ceil((count || 0) / PAGE_SIZE);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let queryTable = supabaseClient.from('gastos').select('*').range(from, to).order(currentSortColumn, { ascending: currentSortOrder === 'asc' });
    
    // Repetimos los mismos filtros para la tabla
    if (filter !== 'ALL') queryTable = queryTable.eq('categoria', filter);
    if (mesFiltro) {
        const [year, month] = mesFiltro.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay}`;
        queryTable = queryTable.gte('gasto_fecha', startDate).lte('gasto_fecha', endDate);
    }

    const { data: pageData } = await queryTable;
    renderTable(pageData);
    renderPagination();
}

function renderTable(gastos) {
  if (!gastosList) return;
  gastosList.innerHTML = "";

  // Deshabilitar botones al recargar la tabla
  selectedGastoId = null;
  if (btnEditGlobal) btnEditGlobal.disabled = true;
  if (btnDeleteGlobal) btnDeleteGlobal.disabled = true;

  if (!gastos || gastos.length === 0) {
    gastosList.innerHTML =
      '<tr><td colspan="5" class="text-center">No hay registros</td></tr>';
    return;
  }

  gastos.forEach((g) => {
    const row = gastosList.insertRow();
    row.style.cursor = "pointer";

    // Formateamos la hora de Supabase (ej: 03:45 pm)
    const horaFormateada = g.created_at
      ? new Date(g.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "--:--";

    row.innerHTML = `
            <td><strong>S/${parseFloat(g.monto).toFixed(2)}</strong></td>
            <td>${g.descripcion}</td>
            <td><span class="badge bg-light text-dark border">${g.categoria}</span></td>
            <td>${new Date(g.gasto_fecha + "T00:00:00").toLocaleDateString()}</td>
            <td><span class="text-muted small">${horaFormateada}</span></td> `;

    // Evento para seleccionar la fila
    row.addEventListener("click", () => {
      selectedGastoId = g.id;
      Array.from(gastosList.rows).forEach((r) =>
        r.classList.remove("table-active"),
      );
      row.classList.add("table-active");

      if (btnEditGlobal) btnEditGlobal.disabled = false;
      if (btnDeleteGlobal) btnDeleteGlobal.disabled = false;
    });
  });
}

function renderPagination() {
  const nav = document.getElementById("pagination-controls");
  if (!nav) return;
  nav.innerHTML = "";
  if (totalPages <= 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    li.innerHTML = `<a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>`;
    nav.appendChild(li);
  }
}

// ==========================================
// 2. CREAR, EDITAR Y ELIMINAR (Conexión a HTML vía Window)
// ==========================================

// Guardar nuevo gasto
window.abrirModalNuevoGasto = async () => {
  // Calculamos la fecha actual exacta para pre-llenar el formulario
  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  const fechaLocal = hoy.toISOString().split("T")[0];

  const { value: formValues } = await Swal.fire({
    title: '<i class="bi bi-plus-circle text-success"></i> <label class="text-success">Registrar nuevo gasto</label>',
    html: `
            <div class="container text-start p-2">
                <div class="row g-3">
                    <div class="col-12">
                        <label for="swal-new-monto" class="form-label fw-semibold text-secondary">Monto (S/)</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light text-muted">S/</span>
                            <input id="swal-new-monto" type="number" step="0.1" class="form-control form-control-lg border-primary-subtle fw-bold" placeholder="0.00" required>
                        </div>
                    </div>
                    
                    <div class="col-12">
                        <label for="swal-new-desc" class="form-label fw-semibold text-secondary">Descripción</label>
                        <input id="swal-new-desc" type="text" class="form-control" placeholder="En qué gastaste..." required>
                    </div>
                    
                    <div class="col-md-6">
                        <label for="swal-new-cat" class="form-label fw-semibold text-secondary">Categoría</label>
                        <select id="swal-new-cat" class="form-select">
                            <option value="" disabled selected>Seleccione...</option>
                            <option value="Alimentación">Alimentación</option>
                            <option value="Transporte">Transporte</option>
                            <option value="Vivienda">Alquiler</option>
                            <option value="Entretenimiento">Entretenimiento</option>
                            <option value="Otros">Otros</option>
                        </select>
                    </div>
                    
                    <div class="col-md-6">
                        <label for="swal-new-fecha" class="form-label fw-semibold text-secondary">Fecha</label>
                        <input id="swal-new-fecha" type="date" class="form-control" value="${fechaLocal}">
                    </div>
                </div>
            </div>
        `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "💾 Guardar Gasto",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#198754",
    cancelButtonColor: "#6c757d",
    customClass: {
      popup: "rounded-4 shadow-lg",
      title: "fs-4 text-primary pt-3 fw-bold",
    },
    preConfirm: () => {
      const monto = document.getElementById("swal-new-monto").value;
      const descripcion = document.getElementById("swal-new-desc").value;
      const categoria = document.getElementById("swal-new-cat").value;
      const fecha = document.getElementById("swal-new-fecha").value;

      // Validación visual integrada en SweetAlert
      if (!monto || !descripcion || !categoria || !fecha) {
        Swal.showValidationMessage(
          "⚠️ Por favor, llena todos los campos obligatorios",
        );
        return false;
      }

      return {
        monto: parseFloat(monto),
        descripcion: descripcion,
        categoria: categoria,
        gasto_fecha: fecha,
      };
    },
  });

  if (formValues) {
    // 1. Obtenemos el usuario activo
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      showAlert("Error", "Debes iniciar sesión para guardar.");
      return;
    }

    // 2. Le pegamos el ID del usuario al gasto antes de subirlo
    formValues.user_id = user.id;

    // 3. Lo subimos a la base de datos
    const { error } = await supabaseClient.from("gastos").insert([formValues]);

    if (error) {
      showAlert("Error al guardar", error.message);
    } else {
      notify("Gasto registrado correctamente");
      obtenerGastos();
    }
  }
};

// ATENCIÓN: Exponemos estas funciones en `window` para que el HTML pueda verlas al hacer "onclick"
window.cambiarPagina = (p) => {
  currentPage = p;
  obtenerGastos();
};

window.confirmarEliminar = async (id) => {
  const result = await Swal.fire({
    title: "¿Estás seguro?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    confirmButtonText: "Sí, eliminar",
  });

  if (result.isConfirmed) {
    const { error } = await supabaseClient.from("gastos").delete().eq("id", id);
    if (error) showAlert("Error", error.message);
    else {
      notify("Eliminado correctamente");
      obtenerGastos();
    }
  }
};

window.abrirModalEditar = async (id) => {
  const { data: g } = await supabaseClient
    .from("gastos")
    .select("*")
    .eq("id", id)
    .single();
  if (!g) return;

  const { value: formValues } = await Swal.fire({
    title: `<i class="bi bi-pencil-square text-dark"></i> <label class="text-dark"> Editar gasto</label>`,
    html: `
            <div class="container text-start p-2">
                <div class="row g-3">
                    <div class="col-12">
                        <label for="swal-monto" class="form-label fw-semibold text-secondary">Monto (S/)</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light text-muted">S/</span>
                            <input id="swal-monto" type="number" step="0.1" class="form-control form-control-lg border-primary-subtle fw-bold" placeholder="0.00" value="${g.monto}">
                        </div>
                    </div>
                    
                    <div class="col-12">
                        <label for="swal-desc" class="form-label fw-semibold text-secondary">Descripción</label>
                        <input id="swal-desc" type="text" class="form-control" placeholder="En qué gastaste..." value="${g.descripcion}">
                    </div>
                    
                    <div class="col-md-6">
                        <label for="swal-cat" class="form-label fw-semibold text-secondary">Categoría</label>
                        <select id="swal-cat" class="form-select">
                            <option value="Alimentación" ${g.categoria === "Alimentación" ? "selected" : ""}>Alimentación</option>
                            <option value="Transporte" ${g.categoria === "Transporte" ? "selected" : ""}>Transporte</option>
                            <option value="Vivienda" ${g.categoria === "Vivienda" ? "selected" : ""}>Alquiler</option>
                            <option value="Entretenimiento" ${g.categoria === "Entretenimiento" ? "selected" : ""}>Entretenimiento</option>
                            <option value="Otros" ${g.categoria === "Otros" ? "selected" : ""}>Otros</option>
                        </select>
                    </div>
                    
                    <div class="col-md-6">
                        <label for="swal-fecha" class="form-label fw-semibold text-secondary">Fecha</label>
                        <input id="swal-fecha" type="date" class="form-control" value="${g.gasto_fecha}">
                    </div>
                </div>
            </div>
        `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "💾 Guardar Cambios",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#198754", // Botón verde de éxito para guardar
    cancelButtonColor: "#6c757d",
    customClass: {
      popup: "rounded-4 shadow-lg", // Bordes más suaves para el modal
      title: "fs-4 text-primary pt-3 fw-bold",
    },
    preConfirm: () => {
      const monto = document.getElementById("swal-monto").value;
      const descripcion = document.getElementById("swal-desc").value;

      if (!monto || !descripcion) {
        Swal.showValidationMessage("Por favor llena el monto y la descripción");
        return false;
      }

      return {
        monto: parseFloat(monto),
        descripcion: descripcion,
        categoria: document.getElementById("swal-cat").value,
        gasto_fecha: document.getElementById("swal-fecha").value,
      };
    },
  });

  if (formValues) {
    const { error } = await supabaseClient
      .from("gastos")
      .update(formValues)
      .eq("id", id);
    if (error) showAlert("Error", error.message);
    else {
      notify("Actualizado correctamente");
      obtenerGastos();
    }
  }
};

// Filtro por categoría
if (selectFiltroCategoria) {
  selectFiltroCategoria.addEventListener("change", () => {
    currentPage = 1;
    obtenerGastos();
  });
}

// ==========================================
// 3. TIEMPO REAL (REALTIME)
// ==========================================
export async function setupRealtime() {
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);

  realtimeChannel = supabaseClient
    .channel("custom-all-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "gastos" },
      () => obtenerGastos(),
    )
    .subscribe();
}

// ==========================================
// 4. EVENTOS DE BOTONES GLOBALES
// ==========================================
if (btnEditGlobal) {
  btnEditGlobal.addEventListener("click", () => {
    if (selectedGastoId) window.abrirModalEditar(selectedGastoId);
  });
}

if (btnDeleteGlobal) {
  btnDeleteGlobal.addEventListener("click", () => {
    if (selectedGastoId) window.confirmarEliminar(selectedGastoId);
  });
}
