# 🍽️ Sistema POS para Restaurante en Red Local

Sistema de Punto de Venta (POS) y comandería para restaurante, diseñado para ejecutarse localmente en una laptop que actúa como servidor central y accesible desde cualquier tablet o teléfono inteligente en la red WiFi local sin necesidad de internet.

---

## 🚀 Inicio Rápido en 1 Clic (Windows)

Simplemente haz doble clic en el archivo:
```
iniciar-pos.bat
```
Esto arrancará automáticamente el servidor backend, el cliente web y abrirá la pantalla principal en tu navegador.

---

## 🛠️ Ejecución Manual por Consola

1. **Instalar dependencias** (solo la primera vez):
   ```bash
   npm run install:all
   ```

2. **Iniciar Backend y Frontend en paralelo**:
   - En una terminal:
     ```bash
     npm run dev:backend
     ```
   - En otra terminal:
     ```bash
     npm run dev:frontend
     ```

3. **Abrir en el navegador**:
   - En la laptop: `http://localhost:5173`
   - En tablets/celulares: `http://<IP-DE-TU-LAPTOP>:5173` (o escanea el QR en la pantalla "Config & QR").

---

## 📱 Conexión de Tablets para Meseros

1. Conecta la laptop y las tablets a la **misma red WiFi** (no requiere conexión a internet externa).
2. Entra a la sección **"Config & QR"** en la laptop.
3. Abre la app de cámara de la tablet o celular y apunta al **Código QR**.
4. ¡Listo! La tablet tendrá acceso inmediato para tomar órdenes, enviar comandas y consultar mesas.

---

## 🌟 Características Principales

- **Caja & Punto de Venta Rápido (POS):**
  - Selector táctil de platillos y bebidas por categorías.
  - Carrito interactivo con asignación a mesas o pedidos para llevar / a domicilio.
  - Notas de preparación por producto (ej. *"Sin cebolla"*, *"Término 3/4"*, *"Salsa verde aparte"*).
  - Cobro ágil con calculadora de cambio táctil, billetes rápidos y soporte para Efectivo, Tarjeta y Transferencia.
- **Mapa de Mesas Interactivo:**
  - Estados en tiempo real: 🟢 Libre, 🔴 Ocupada (con tiempo transcurrido y total acumulado), 🟡 Pidiendo cuenta.
  - Adición de múltiples rondas de comandas a la misma mesa.
- **Pantalla de Cocina / KDS en Tiempo Real:**
  - Recepción instantánea de comandas vía WebSockets (Socket.io) con alerta sonora.
  - Alertas visuales de tiempo de espera (normal, advertencia y urgente).
- **Corte de Caja Completo (Arqueos X y Z):**
  - Apertura con fondo de caja.
  - Registro de entradas y retiros/gastos con motivo.
  - Calculadora de conteo de billetes y monedas con cálculo de faltante/sobrante.
  - Generación e impresión de ticket oficial de corte.
- **Motor de Impresión Térmica & Simulador Virtual:**
  - Previsualización auténtica en pantalla con fuente monoespaciada, líneas de corte y formato de 80mm / 58mm.
  - Soporte integrado para impresoras térmicas USB y de Red (Ethernet/WiFi) usando comandos estándar ESC/POS.
- **Base de Datos SQLite de Alto Rendimiento:**
  - Modo WAL (Write-Ahead Logging) activado para soportar múltiples tablets concurrentes sin bloqueos.
  - Todo se guarda en `backend/data/pos_restaurant.db` para respaldos fáciles de un solo archivo.
