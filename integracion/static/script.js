// Archivo: script.js
// Descripción: Script para manejar la autenticación y las operaciones de la API
let token = null;
let rol = null;
let vendorToken = null;
let allArticles = [];
let currentCategory = null;
let currentSubcats  = [];

// Elementos del DOM
const formSectionEl     = document.getElementById("form-section");
const formContainerEl   = document.getElementById("form-container");
const responseSectionEl = document.getElementById("response-section");
const outputEl          = document.getElementById("output");
const catalogSectionEl  = document.getElementById("catalog-section");
const catalogButtonsEl  = document.getElementById("catalog-buttons");
const cardsContainerEl  = document.getElementById("cards-container");

// ----------------- LOGIN -----------------
async function login() {
  const userEl = document.getElementById("usuario");
  const passEl = document.getElementById("contrasena");
  const errEl  = document.getElementById("login-error");

  if (!userEl || !passEl || !errEl) return; // No estamos en login.html

  const user = userEl.value.trim();
  const pwd  = passEl.value.trim();
  errEl.textContent = "";

  if (!user || !pwd) {
    errEl.textContent = "Por favor, ingresa usuario y contraseña";
    return;
  }

  try {
    const res = await fetch("/autenticacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, password: pwd })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Credenciales inválidas");
    }

    const data = await res.json();

    if (!data.token || !data.rol) {
      throw new Error("Respuesta inválida del servidor");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("rol", data.rol);
    if (data.vendorToken) {
      localStorage.setItem("vendorToken", data.vendorToken);
    }

    // Redirigir al panel si el login fue exitoso
    window.location.href = "/panel";
  } catch (e) {
    errEl.textContent = e.message;
  }
}

// ----------------- HELPERS -----------------
// Función para obtener los headers de autenticación
// para las peticiones a la API
// Si no hay token o vendorToken, lanza un error
// Si hay token y vendorToken, devuelve un objeto con los headers
// que se pueden usar en las peticiones a la API
function authHeaders() {
  if (!token || !vendorToken) {
    throw new Error("No estás autenticado correctamente");
  }
  return {
    "x-authentication": token,
    "x-vendor-token":   vendorToken,
    "Content-Type":     "application/json"
  };
}
// Función para mostrar el menú de opciones
function hideAllSections() {
  formSectionEl.style.display     = "none";
  responseSectionEl.style.display = "none";
  catalogSectionEl.style.display  = "none";
  formContainerEl.innerHTML       = "";
  outputEl.textContent            = "";
}

// ----------------- CATÁLOGO -----------------
async function showProducts() {
  hideAllSections();
  catalogSectionEl.style.display = "block";

  if (!allArticles.length) {
    const resApi   = await fetch("/data/articulos", { headers: authHeaders() });
    const apiArts  = (await resApi.json()).map(a => ({ ...a, source: "api" }));

    const resLocal = await fetch("/db/productos.json");
    const locArts  = (await resLocal.json()).map(a => ({ ...a, source: "local" }));

    allArticles = [...apiArts, ...locArts];
  }

  catalogButtonsEl.innerHTML = "";
  cardsContainerEl.innerHTML = "";
// Limpiar respuesta previa
  const categories = {
    "Herramientas Manuales":   ["Martillos","Destornilladores","Llaves"],
    "Herramientas Eléctricas": ["Taladros","Sierras","Lijadoras"],
    "Materiales Básicos":      ["Cemento","Arena","Ladrillos"],
    "Acabados":                ["Pinturas","Barnices"],
    "Cerámicos":               [],
    "Equipos de Seguridad":    ["Cascos","Guantes","Lentes de Seguridad"],
    "Accesorios Varios":       [],
    "Tornillos y Anclajes":    [],
    "Fijaciones y Adhesivos":  [],
    "Equipos de Medición":     []
  };
// Crear botones para cada categoría
  Object.keys(categories).forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.onclick = () => {
      currentCategory = cat;
      currentSubcats  = categories[cat];
      renderCategory(cat, categories[cat]);
    };
    catalogButtonsEl.appendChild(btn);
  });
}
// Crear botón para mostrar todos los productos
function renderCategory(catName, subcats) {
  cardsContainerEl.innerHTML = "";
  
  // Filtrar artículos por categoría o subcategorías
    const filtered = allArticles.filter(article => {
    return article.categoria === catName || subcats.includes(article.categoria);
  });

  // Poner primero los productos con descuento
  filtered.sort((a, b) => {
    const aHas = a.desc && !isNaN(a.desc) && a.desc > 0;
    const bHas = b.desc && !isNaN(b.desc) && b.desc > 0;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return 0;
  });

  // Mostrar cards
  filtered.forEach(article => {
    let precioFinal = article.precio;
    if (article.desc && !isNaN(article.desc) && article.desc > 0) {
      precioFinal = Math.round(article.precio / 100 * (100 - article.desc));
    }

    // Creamos la card
    const card = document.createElement("div");
    card.className = "card";

    // Badge “new” si corresponde
    const badge = article.new === "True" || article.new === true
      ? `<div class="new-badge">new</div>`
      : "";
// Badge “out of stock” si corresponde
    card.innerHTML = `
      ${badge}
      <div class="cardNumber" style="display:none;">0</div>
      <img src="https://upload.wikimedia.org/wikipedia/commons/a/a3/Image-not-found.png" alt="Product image" />
      <h3>${article.nombre}</h3>
      <p class="marca">${article.marca || 'Sin marca'}</p>
      <p id="laid">${article.id}</p>
      <p class="stock">Stock: ${article.stock}</p>
      <div class="precio">
        ${article.desc
          ? `<p class="desc" >${article.desc}%</p>
            <p class="old-price">$${article.precio}</p>
            <p class="discounted-price">$${precioFinal}</p>`
          : `<p>$${precioFinal}</p>`
        }
      </div>
    `;
// Añadir evento de clic para mostrar el número de clicks
    // y animar la card
    // y añadir al carrito
    let count = 0;
    card.addEventListener('click', () => {
      count++;

      const numberEl = card.querySelector('.cardNumber');
      numberEl.style.display = "flex";
      numberEl.textContent = count;

      card.style.animation = "scale-down-center 0.3s ease";
      
      setTimeout(() => {
        card.style.animation = "";
      }, 300);
    });

    card.addEventListener("click", () => addToCart(article));

    cardsContainerEl.appendChild(card);
  });

  // Mostrar también en la sección de respuesta
  // Limpiar respuesta previa
  responseSectionEl.style.display = "block";
  outputEl.textContent = JSON.stringify(filtered, null, 2);
}

// ----------------------- PAGO -------------------------

let cart = [];
let currentCurrency = "CLP";
// Elementos del DOM
const cartContainerEl = document.getElementById("cart-container");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const currencyEl = document.getElementById("currency");
const currencySelectEl = document.getElementById("currency-select");
const payStatusEl = document.getElementById("pay-status");

currencySelectEl.addEventListener("change", async (e) => {
  currentCurrency = e.target.value;
  await updateCartDisplay();
});
// Cambiar moneda al cargar la página
function addToCart(article) {
  cart.push(article);
  cartContainerEl.style.display = "block";
  updateCartDisplay();
}

async function updateCartDisplay() {
  cartItemsEl.innerHTML = "";

  const summary = {};
  for (const item of cart) {
    if (!summary[item.id]) {
      summary[item.id] = { item, count: 0 };
    }
    summary[item.id].count++;
  }

  let totalCLP = 0;

  const calcUnitPrice = it => {
    if (it.desc && !isNaN(it.desc) && it.desc > 0) {
      return Math.round(it.precio / 100 * (100 - it.desc));
    }
    return it.precio;
  };
// Calcular el precio unitario
  // y el total por cada artículo
  // y añadirlo al carrito
  // y al total
  Object.values(summary).forEach(({ item, count }) => {
    const unitPrice = calcUnitPrice(item);
    const lineTotal = unitPrice * count;
    totalCLP += lineTotal;

    const prefix = count > 1 ? `${count}x ` : "";
    cartItemsEl.innerHTML += `
      <div>
        <p>${prefix}${item.nombre} - $${lineTotal} CLP</p>
      </div>
    `;
  });
// Mostrar el total
  if (currentCurrency === "USD") {
    try {
      const rate = await getConversionRate("CLP", "USD");
      const totalUSD = (totalCLP * rate).toFixed(2);
      cartTotalEl.textContent = totalUSD;
      currencyEl.textContent = "USD";
    } catch (err) {
      console.error(err);
      payStatusEl.textContent = "Error al convertir moneda";
    }
  } else {
    cartTotalEl.textContent = Math.round(totalCLP);
    currencyEl.textContent = "CLP";
  }
}
// Función para obtener la tasa de cambio
async function getConversionRate(from, to) {
  const res = await fetch(`/currency?code=${from}`);
  if (!res.ok) throw new Error("Error al obtener tasa de cambio");
  const { rate } = await res.json();
  return rate;
}

let stripe;
// Inicializar Stripe
// y obtener la clave pública
// y manejar errores
// y mostrar el error en la consola
async function initStripe() {
  try {
    const res = await fetch("/config");
    const data = await res.json();
    stripe = Stripe(data.publicKey);
  } catch (e) {
    console.error("Error al obtener la clave pública de Stripe:", e);
  }
}

initStripe();
// Inicializar Stripe al cargar la página
async function pay() {
  if (cart.length === 0) return alert("Carrito vacío");

  const items = cart.map(item => ({
    id:       item.id,
    name:     item.nombre,
    price:    item.precio,
    quantity: 1,
    currency: "clp"
  }));

  try {
    const response = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Error desconocido");
    window.location = data.url;
  } catch (err) {
    console.error(err);
    payStatusEl.style.color = "red";
    payStatusEl.textContent = "❌ Error al crear la sesión: " + err.message;
  }
}

// ----------------- FORMULARIOS DINÁMICOS -----------------
// Función para mostrar el formulario de consulta de productos
// y sucursales
// y vendedores
// y pedidos
function showProduct() {
  hideAllSections();
  formSectionEl.style.display = "block";
  formContainerEl.innerHTML = `
    <label>ID de artículo:</label>
    <input type="text" id="input-article-id" placeholder="e.j. ART001" />
    <button onclick="getProduct()">Consultar</button>
  `;
}
// Función para mostrar el formulario de consulta de sucursales
async function getProduct() {
  const id  = document.getElementById("input-article-id").value;
  const res = await fetch(`/data/articulos/${id}`, { headers: authHeaders() });
  const data = await res.json();
  showResponse(data);
}

function showBranch() {
  hideAllSections();
  formSectionEl.style.display = "block";
  formContainerEl.innerHTML = `
    <label>ID de sucursal:</label>
    <input type="text" id="input-branch-id" placeholder="e.j. SC001" />
    <button onclick="getBranch()">Consultar</button>
  `;
}
// Función para mostrar el formulario de consulta de vendedores
async function getBranch() {
  const id  = document.getElementById("input-branch-id").value;
  const res = await fetch(`/data/sucursales/${id}`, { headers: authHeaders() });
  const data = await res.json();
  showResponse(data);
}

async function showVendors() {
  const res = await fetch(`/data/vendedores`, { headers: authHeaders() });
  const data = await res.json();
  showResponse(data);
}

function showVendor() {
  hideAllSections();
  formSectionEl.style.display = "block";
  formContainerEl.innerHTML = `
    <label>ID de vendedor:</label>
    <input type="text" id="input-vendor-id" placeholder="e.j. V001" />
    <button onclick="getVendor()">Consultar</button>
  `;
}
// Función para mostrar el formulario de pedidos
async function getVendor() {
  const id  = document.getElementById("input-vendor-id").value;
  const res = await fetch(`/data/vendedores/${id}`, { headers: authHeaders() });
  const data = await res.json();
  showResponse(data);
}

function showOrderForm() {
  hideAllSections();
  formSectionEl.style.display = "block";
  formContainerEl.innerHTML = `
    <label>ID de artículo:</label>
    <input type="text" id="input-order-article" placeholder="e.j. ART001" />
    <label>Cantidad:</label>
    <input type="number" id="input-order-qty" placeholder="e.j. 5" />
    <button onclick="placeOrder()">Enviar Pedido</button>
  `;
}

async function placeOrder() {
  const aidRaw  = document.getElementById("input-order-article").value;
  const aidTrim = aidRaw.trim();
  const aidUp = aidTrim.toUpperCase();
  const qty = parseInt(document.getElementById("input-order-qty").value, 10);

  let article = allArticles.find(a => a.id === aidTrim);
// Buscamos por ID exacto
  if (!article) {
    article = allArticles.find(a => String(a.id).trim().toUpperCase() === aidUp);
  }
// Buscamos por ID normalizado
  if (!article) {
    return showResponse(`Artículo con ID "${aidRaw}" no encontrado.`);
  }
// Si no se encuentra el artículo, mostramos un mensaje de error
  let url, opts;
  if (article.source === "local") {
    url  = `/data/local/articulos/venta/${encodeURIComponent(article.id)}?cantidad=${qty}`;
    opts = { method: "PUT" };
  } else {
    url  = `/data/articulos/venta/${encodeURIComponent(article.id)}?cantidad=${qty}`;
    opts = { method: "PUT", headers: authHeaders() };
  }
// Si el artículo es de la API, usamos los headers de autenticación
  const res = await fetch(url, opts);

  let data;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    data = { error: await res.text() };
  }

  if (res.ok) {
    showResponse(data.message);
    await reloadArticles();
  } else {
    showResponse(data.error);
  }
  
}
// Función para mostrar el formulario de recarga de artículos
async function reloadArticles() {
  const resApi   = await fetch("/data/articulos", { headers: authHeaders() });
  const apiArts  = (await resApi.json()).map(a => ({ ...a, source: "api" }));
  const resLocal = await fetch("/db/productos.json");
  const locArts  = (await resLocal.json()).map(a => ({ ...a, source: "local" }));
  allArticles = [...apiArts, ...locArts];
}

// ----------------- SUCURSALES -----------------
// Función para mostrar el formulario de consulta de sucursales
async function getBranches() {
  hideAllSections();
  const res = await fetch("/data/sucursales", { headers: authHeaders() });
  const data = await res.json();
  showResponse(data);
}

// ----------------- MUESTRA RESPUESTA -----------------
// Función para mostrar la respuesta de la API
function showResponse(data) {
  formSectionEl.style.display     = "none";
  catalogSectionEl.style.display  = "none";
  responseSectionEl.style.display = "block";
  outputEl.textContent            = JSON.stringify(data, null, 2);
}

// ----------------- INICIALIZACIÓN AL CARGAR LA PÁGINA -----------------
window.onload = () => {
  // Recuperar token desde el almacenamiento local
  token = localStorage.getItem("token");
  rol = localStorage.getItem("rol");
  vendorToken = localStorage.getItem("vendorToken");

  // Elementos dinámicos cargados tras el DOM
  const currencySelectEl = document.getElementById("currency-select");

  if (currencySelectEl) {
    currencySelectEl.addEventListener("change", async (e) => {
      currentCurrency = e.target.value;
      await updateCartDisplay();
    });
  }

  initStripe();
};
