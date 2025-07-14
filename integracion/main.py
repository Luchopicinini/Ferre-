from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import stripe, os
from dotenv import load_dotenv

from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="API FERREMAS DUOC",
    description="AAAAAAAAA LOCURA A LAS 3 AM",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

API_URL = os.getenv("API_BASE")
MAIN_TOKEN = os.getenv("TOKEN_FIJO")
SELLER_TOKEN_OK = os.getenv("TOKEN_VENDEDOR_PERMITIDO")
SELLER_TOKEN_BLOCKED = os.getenv("TOKEN_VENDEDOR_DENEGADO")
FX_TOKEN = os.getenv("TOKEN_FXRATESAPI")
stripe.api_key = os.getenv("CLAVE_SECRETA_STRIPE")

# Usuarios permitidos
usuarios_autorizados = [
    {"usuario": "javier_thompson", "contrasena": "aONF4d6aNBIxRjlgjBRRzrS", "rol": "admin"},
    {"usuario": "ignacio_tapia", "contrasena": "f7rWChmQS1JYfThT", "rol": "maintainer"},
    {"usuario": "stripe_sa", "contrasena": "dzkQqDL9XZH33YDzhmsf", "rol": "service_account"},
    {"usuario": "Admin", "contrasena": "1234", "rol": "admin"},
]

app.mount("/db", StaticFiles(directory="db"), name="db")
app.mount("/static", StaticFiles(directory="static"), name="static")

class ProductoPago(BaseModel):
    id: str
    nombre: str
    precio: int   # precio en centavos (ej: 1000 = $10.00)
    cantidad: int
    moneda: str

class ProductoNuevo(BaseModel):
    nombre: str
    descripcion: str
    precio: int
    categoria: str
    stock: int
    moneda: str
    
# --- Autenticación ---

def verificar_token_general(x_authentication: str = Header(None, alias="x-authentication")):
    if x_authentication != MAIN_TOKEN:
        raise HTTPException(403, "Token inválido")
    return x_authentication

def verificar_token_vendedor(x_vendor_token: str = Header(None, alias="x-vendor-token")):
    if x_vendor_token != SELLER_TOKEN_OK:
        raise HTTPException(403, "No tienes permiso para este recurso")
    return x_vendor_token

async def obtener_desde_api(path: str, token: str):
    headers = {"x-authentication": token}
    async with httpx.AsyncClient() as cliente:
        respuesta = await cliente.get(f"{API_URL}{path}", headers=headers)
        return JSONResponse(status_code=respuesta.status_code, content=respuesta.json())

async def enviar_a_api_post(path: str, datos: dict, token: str):
    headers = {"x-authentication": token}
    async with httpx.AsyncClient() as cliente:
        respuesta = await cliente.post(f"{API_URL}{path}", json=datos, headers=headers)
        return JSONResponse(status_code=respuesta.status_code, content=respuesta.json())

async def enviar_a_api_put(path: str, headers: dict):
    async with httpx.AsyncClient() as cliente:
        respuesta = await cliente.put(f"{API_URL}{path}", headers=headers)
        return JSONResponse(status_code=respuesta.status_code, content=respuesta.json())

@app.post("/autenticacion", tags=["Auth"])
async def login_usuario(credenciales: dict):
    usuario = credenciales.get("user")
    contrasena = credenciales.get("password")
    for u in usuarios_autorizados:
        if u["usuario"] == usuario and u["contrasena"] == contrasena:
            token_vendedor = SELLER_TOKEN_BLOCKED if u["rol"] == "service_account" else SELLER_TOKEN_OK
            return {
                "token": MAIN_TOKEN,
                "rol": u["rol"],
                "vendorToken": token_vendedor
            }
    raise HTTPException(status_code=401, detail="Credenciales inválidas")

# --- Divisas ---

@app.get("/currency", tags=["Divisas"])
async def convertir_divisa(
    moneda_origen: str = Query(..., min_length=3, max_length=3),
    moneda_destino: str = Query(..., min_length=3, max_length=3)
):
    url_fx = f"https://fxratesapi.com/api/latest?base={moneda_origen.upper()}&symbols={moneda_destino.upper()}&api_key={FX_TOKEN}"
    async with httpx.AsyncClient() as cliente:
        respuesta = await cliente.get(url_fx)
    if respuesta.status_code != 200:
        raise HTTPException(status_code=502, detail="Error al obtener tasa de cambio FXRatesAPI")
    datos = respuesta.json()
    tasa = datos.get("rates", {}).get(moneda_destino.upper())
    if tasa is None:
        raise HTTPException(status_code=400, detail="Código de moneda inválido")
    return {"rate": tasa}

# --- Stripe ---

@app.post("/create-checkout-session", tags=["Stripe"])
async def crear_sesion_pago(items: list[ProductoPago], x_authentication: str = Header(..., alias="x-authentication")):
    if x_authentication != MAIN_TOKEN:
        raise HTTPException(403, "Token inválido")

    # 1. Validar stock y actualizarlo en API base
    async with httpx.AsyncClient() as client:
        for item in items:
            # Primero obtener info actual para validar stock
            res_art = await client.get(f"{API_URL}/data/articulos/{item.id}", headers={"x-authentication": x_authentication})
            if res_art.status_code != 200:
                raise HTTPException(404, detail=f"Producto {item.nombre} no encontrado")
            articulo = res_art.json()

            if articulo["stock"] < item.cantidad:
                raise HTTPException(400, detail=f"Stock insuficiente para {item.nombre}. Disponible: {articulo['stock']}")

            # Actualizar stock en API base (restar cantidad vendida)
            res_put = await client.put(
                f"{API_URL}/data/articulos/venta/{item.id}?cantidad={item.cantidad}",
                headers={"x-authentication": x_authentication}
            )
            if res_put.status_code != 200:
                raise HTTPException(500, detail=f"Error actualizando stock para {item.nombre}")

    # 2. Crear línea de items para Stripe
    try:
        line_items = [{
            "price_data": {
                "currency": item.moneda.lower(),
                "unit_amount": item.precio,
                "product_data": {"name": item.nombre}
            },
            "quantity": item.cantidad
        } for item in items]

        sesion_pago = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=line_items,
            success_url="http://127.0.0.1:8000/panel",
            cancel_url="http://127.0.0.1:8000/panel"
        )
        return {"url": sesion_pago.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/config", tags=["Stripe"])
async def obtener_clave_publica_stripe():
    clave_publica = os.getenv("CLAVE_PUBLICA_STRIPE")
    if not clave_publica:
        raise HTTPException(status_code=500, detail="Clave pública de Stripe no configurada")
    return {"publicKey": clave_publica}

# --- Endpoints proxy para API base ---

@app.get("/data/articulos", tags=["Articulos"])
async def listar_articulos(token: str = Depends(verificar_token_general)):
    return await obtener_desde_api("/data/articulos", token)

@app.get("/data/articulos/{articulo_id}", tags=["Articulos"])
async def obtener_articulo(articulo_id: str, token: str = Depends(verificar_token_general)):
    return await obtener_desde_api(f"/data/articulos/{articulo_id}", token)

@app.get("/data/sucursales", tags=["Sucursales"])
async def listar_sucursales(token: str = Depends(verificar_token_general)):
    return await obtener_desde_api("/data/sucursales", token)

@app.get("/data/sucursales/{sucursal_id}", tags=["Sucursales"])
async def obtener_sucursal(sucursal_id: str, token: str = Depends(verificar_token_general)):
    return await obtener_desde_api(f"/data/sucursales/{sucursal_id}", token)

@app.get("/data/vendedores", tags=["Vendedores"])
async def listar_vendedores(token: str = Depends(verificar_token_general), vendor_token: str = Depends(verificar_token_vendedor)):
    return await obtener_desde_api("/data/vendedores", token)

@app.get("/data/vendedores/{vendedor_id}", tags=["Vendedores"])
async def obtener_vendedor(vendedor_id: str, token: str = Depends(verificar_token_general), vendor_token: str = Depends(verificar_token_vendedor)):
    return await obtener_desde_api(f"/data/vendedores/{vendedor_id}", token)

@app.put("/data/articulos/venta/{articulo_id}", tags=["Ventas"])
async def actualizar_venta(articulo_id: str, cantidad: int = Query(...), token: str = Depends(verificar_token_general)):
    return await enviar_a_api_put(f"/data/articulos/venta/{articulo_id}?cantidad={cantidad}", headers={"x-authentication": token})

@app.post("/data/pedidos/nuevo", tags=["Pedidos"])
async def crear_pedido(datos_pedido: dict, token: str = Depends(verificar_token_general)):
    return await enviar_a_api_post("/data/pedidos/nuevo", datos_pedido, token)

@app.get("/data/articulos/novedades", tags=["Articulos"])
async def listar_novedades(token: str = Depends(verificar_token_general)):
    return await obtener_desde_api("/data/articulos/novedades", token)

@app.get("/data/articulos/promociones", tags=["Articulos"])
async def listar_promociones(token: str = Depends(verificar_token_general)):
    return await obtener_desde_api("/data/articulos/promociones", token)

@app.post("/data/contacto/vendedor", tags=["Contacto"])
async def contacto_vendedor(mensaje: dict, token: str = Depends(verificar_token_general)):
    return await enviar_a_api_post("/data/contacto/vendedor", mensaje, token)

@app.get("/data/vendedores/porSucursal", tags=["Vendedores"])
async def listar_vendedores_por_sucursal(
    sucursal_id: str = Query(..., alias="sucursal_Id"),
    token: str = Depends(verificar_token_general),
    vendor_token: str = Depends(verificar_token_vendedor)
):
    return await obtener_desde_api(f"/data/vendedores?sucursalId={sucursal_id}", token)

@app.post("/data/articulos", tags=["Articulos"])
async def agregar_producto(producto: ProductoNuevo, token: str = Depends(verificar_token_general)):
    return await enviar_a_api_post("/data/articulos", producto.dict(), token)

# --- Servir archivos estáticos y páginas web ---

@app.get("/", tags=["Web"])
async def root():
    return FileResponse("static/login.html")

@app.get("/panel", tags=["Web"])
async def panel():
    return FileResponse("static/index.html")

@app.get("/styles.css", tags=["Web"])
async def styles():
    return FileResponse("static/styles.css", media_type="text/css")

@app.get("/script.js", tags=["Web"])
async def script():
    return FileResponse("static/script.js", media_type="application/javascript")

@app.get("/success", tags=["Web"])
async def success():
    return FileResponse("static/success.html")

@app.get("/cancel", tags=["Web"])
async def cancel():
    return FileResponse("static/cancel.html")
