
# Prueba de Integracion-de-plataformas
He creado una interfaz para FERREMAS, con secciones funcionales
# 🧩 FERREMAS - Plataforma Web

# Descripción

FERREMAS es una solución web construida como parte de un proyecto académico. Su objetivo es integrar una interfaz moderna con una API RESTful que centralice procesos de autenticación, gestión de productos, sucursales, pedidos, y pagos en línea usando Stripe. Además, incluye conversión de divisas CLP ↔ USD.

# Funcionalidades Principales

- 🔐 **Login de usuario con autenticación** y visualización de rol.
- 📦 **Catálogo de productos** dinámico, con tarjetas y filtros.
- 🔍 **Consulta de productos individuales**.
- 🏬 **Consulta de sucursales** y sus vendedores.
- 👥 **Detalle de vendedores**.
- 🛒 **Simulación de pedidos y carrito de compras**.
- 💳 **Integración con Stripe para pagos**.
- 💱 **Selector de divisas** (CLP ↔ USD) para mostrar precios.

---

# Estructura del Proyecto

```bash
.
├── index.html         # Interfaz principal del proyecto
├── styles.css         # Estilos dinámicos (referenciados por JS)
├── script.js          # Lógica de frontend y llamadas a la API (referenciado dinámicamente)
