# ESTUDIA.AWS — Plataforma de Entrenamiento Intensivo (SAP-C02)
### Aprendizaje Acelerado, Active Recall, Descarte Rápido 2x2 & Repetición Espaciada

Una Single Page Application (SPA) completa, modular y reactiva desarrollada con HTML5, Tailwind CSS y JavaScript Vanilla puro (arquitectura limpia desacoplada), diseñada específicamente para el entrenamiento intensivo de exámenes de certificación **AWS Certified Solutions Architect - Professional (SAP-C02)** a partir de dumps de preguntas.

---

## 🚀 Inicio Rápido y Despliegue

La aplicación es completamente **estática y autónoma**, sin necesidad de procesos de compilación pesados (`build`) ni dependencias complejas.

### Opción 1: Servidor HTTP local con Python (Recomendado)
```bash
python3 -m http.server 8080
```
Abre tu navegador en: `http://localhost:8080`

### Opción 2: Servidor con Node.js / npx
```bash
npx serve .
```

### Opción 3: Despliegue en la Nube
Simplemente sube la carpeta a cualquier servicio de alojamiento estático:
- **AWS S3 + CloudFront**
- **Vercel / Cloudflare Pages / GitHub Pages / Netlify**

---

## 📂 Arquitectura de Archivos

```
/
├── index.html                   # Interfaz SPA con Dark Mode profesional y arquitectura modular
├── css/
│   └── styles.css               # Estilos zen, tipografía técnica, scrollbars y animaciones
├── js/
│   ├── app.js                   # Controlador principal SPA, routing, atajos de teclado y modales
│   ├── store.js                 # Gestor reactivo de estado y persistencia (localStorage / IndexedDB)
│   ├── parser.js                # Parser universal de dumps (PDF.js en navegador + validador JSON)
│   ├── highlighter.js           # Motor de resaltado inteligente de discriminadores y servicios AWS
│   ├── focus-timer.js           # Cronómetro de Foco 35 min con alerta en pico y Web Audio
│   └── repemill-data.js         # Base de datos del "Repemill" (Patrones, servicios óptimos y descartes)
├── data/
│   └── sap_c02_questions.json   # Banco completo normalizado de las 411 preguntas del dump
└── README.md                    # Documentación técnica y operativa
```

---

## 🧠 Metodología de Alto Rendimiento Implementada

### 1. Bloques Cerrados de 25 Preguntas
- El banco de 411 preguntas está dividido automáticamente en **17 sesiones cerradas de 25 preguntas** (Sesión 1: Q1-Q25, ..., Sesión 17: Q401-Q411).
- Evita la fatiga mental y el desgaste cognitivo al fijar un objetivo acotado y alcanzable por sesión.

### 2. Cronómetro de Foco Calibrado (35 Minutos) + Corte en Pico
- La curva de atención máxima sostenida se optimiza en intervalos de 30 a 35 minutos antes del declive atencional.
- El cronómetro integrado incluye **Alerta Sonora en Pico de Rendimiento** a los 30 minutos para rematar el bloque y corte de consolidación de 5 minutos.

### 3. El "Repemill" Conceptual (Desgloses de Examen)
- Para cada uno de los 17 bloques, se genera una tabla técnica estructurada:
  * `[Palabra Gatillo / Requisito Clave]` | `[Servicio AWS Óptimo]` | `[Patrón de Descarte Rápido]`.
- Se puede consultar **antes de iniciar el test** (creación del esquema anticipatorio) y durante la revisión de fallos.

### 4. Lectura Rápida y Descarte 2x2
- **Lectura focalizada:** Identificación prioritaria de la última frase del enunciado (el discriminador: *LEAST operational overhead*, *MOST cost-effective*, *HIGHEST performance*).
- **Descarte 2x2:** Resaltado automático en color ámbar de las condiciones clave y en cian de los servicios AWS para descartar el 50% de las opciones en segundos.
- **Puntuación Neta Oficial:** Se calcula el `Net Score = Aciertos - (Fallos / 3)`, penalizando el factor azar para medir el dominio real.

### 5. Gestión de Errores & Repaso Espaciado 24h (Curva del Olvido)
- **Base de Datos de Fallos (Preguntas Rojas):** Cada fallo se registra con timestamp, bloque y concepto no consolidado.
- **Preguntas Dudosas (Amarillas):** Marcado rápido de preguntas inseguras.
- **Active Recall 24h:** Botón dinámico que genera un simulacro exclusivo con todas las preguntas falladas y dudosas para consolidarlas antes de 24 horas.
- **Notas Técnicas & Nemotecnias:** Campo integrado en cada pregunta fallada para registrar una asociación o apunte rápido de consolidación conceptual.

---

## ⌨️ Atajos de Teclado (Modo Quirúrgico / Sin Ratón)

| Tecla | Acción |
|---|---|
| `1` - `6` o `A` - `F` | Seleccionar / deseleccionar opciones |
| `Espacio` o `Enter` | Confirmar respuesta / Avanzar a la siguiente pregunta |
| `→` o `N` | Siguiente pregunta |
| `←` o `P` | Pregunta anterior |
| `D` | Marcar / desmarcar como Pregunta Dudosa (Amarilla) |
| `Z` | Alternar Modo Zen (Mesa de estudio limpia) |

---

## 📥 Ingesta de Nuevos Dumps (PDF / JSON)

1. Haz clic en **"Cargar PDF / JSON"** en la barra superior o en el Dashboard.
2. Arrastra tu documento PDF: la librería **PDF.js** integrada procesará el texto página por página mostrando una barra de progreso en tiempo real.
3. El motor extraerá:
   - Identificador `Question #`
   - Enunciado completo con corrección de ligaduras tipográficas
   - Opciones `A.`, `B.`, `C.`, `D.`, etc.
   - Respuesta Correcta oficial
   - Porcentaje de votos de la comunidad de ExamTopics
4. Visualiza la vista previa y pulsa **"Confirmar y Guardar en Banco Local"**.

---

## 💾 Respaldo y Persistencia de Datos
- Todos los aciertos, fallos, notas técnicas y minutos de Foco se guardan de forma automática y transparente en el `localStorage` del navegador.
- Puedes usar los botones **Descargar Backup** y **Restaurar Backup** (formato JSON) en cualquier momento para trasladar tu progreso a otro ordenador o navegador.
