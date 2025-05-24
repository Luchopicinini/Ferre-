
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

API RESTful desarrollada con FastAPI que ofrece endpoints para manejo de usuarios, productos, ventas, autenticación y pagos con Stripe.

Esta API sirve como backend para la gestión de productos, ventas, sucursales y vendedores. Incluye autenticación por token, proxy para servicios externos, integración con Stripe para pagos y endpoints para servir archivos estáticos de frontend.


# Requisitos

- Python 3.8+
- FastAPI
- Uvicorn
- httpx
- stripe
- python-dotenv

# Instalación

1. Clonar repositorio

2. Crear entorno virtual (recomendado):

```bash
python -m venv env
source env/bin/activate  # Linux/Mac
.\env\Scripts\activate   # Windows PowerShell

---

# Estructura del Proyecto

```bash
.
├── index.html         # Interfaz principal del proyecto
├── styles.css         # Estilos dinámicos (referenciados por JS)
├── script.js          # Lógica de frontend y llamadas a la API (referenciado dinámicamente)
