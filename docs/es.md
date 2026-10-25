# NOAA Space Weather

## Presentación

Esta integración lleva a Gladys el clima espacial del [Space Weather Prediction Center de la NOAA](https://www.swpc.noaa.gov/) (SWPC): el índice Kp de actividad geomagnética, las escalas NOAA de tormentas geomagnéticas (G), tormentas de radiación solar (S) y apagones de radio (R), el viento solar, las fulguraciones solares, los mensajes del SWPC y la previsión de auroras OVATION para cada una de sus viviendas. Sus escenas pueden saber cuándo empieza una tormenta, cuándo ocurre una fulguración fuerte o cuándo podría verse una aurora en casa esta noche.

Transporte: nube. La integración lee archivos públicos en `services.swpc.noaa.gov`; no se envía nada suyo (ni cuenta, ni clave, nunca las coordenadas de sus viviendas: la cuadrícula de auroras se descarga entera y se lee en local). Datos: NOAA SWPC, dominio público. Esta integración no está afiliada a la NOAA.

**Las escalas en breve.** El índice **Kp** va de 0 (calma) a 9 (tormenta extrema), por periodo de 3 horas; Kp 5 es una tormenta **G1**, Kp 9 una tormenta **G5**. **S1–S5** miden los protones del Sol (satélites, vuelos polares), **R1–R5** los rayos X de las fulguraciones (radio HF y GPS en el lado diurno): R1 es una fulguración M1, R3 una X1.

## Requisitos previos

- Gladys 5.3.0 o posterior (widgets y disparadores de escena).
- Para las auroras: una vivienda con ubicación (Configuración → Viviendas). La integración pide acceso a las coordenadas de las viviendas al instalarla.
- La latitud importa. Por debajo de unos 55° de latitud magnética, como en España, una aurora es rara: solo las tormentas fuertes (G3 o más, unas pocas veces por ciclo solar) la traen tan al sur. En Escandinavia, Islandia, Canadá o Alaska es frecuente.

## Configuración

| Campo                | Uso                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Idioma de los textos | Nombres de los dispositivos, frases y errores de las escenas. Automático: el idioma del último widget mostrado.                    |
| Umbral de aurora     | 5 a 50 %: la probabilidad OVATION a partir de la cual una aurora es «posible» en una vivienda con cielo oscuro (10 % por defecto). |

El botón **Probar la conexión** lee las escalas NOAA y el Kp estimado, y enumera las viviendas con ubicación. **Diagnóstico** escribe el estado de la integración en sus registros.

La integración lee cada producto a su ritmo: el Kp estimado cada minuto, el viento solar, el campo magnético, las fulguraciones y las escalas cada 5 minutos, los mensajes cada 10 minutos, el Kp de 3 horas cada 30 minutos, la previsión cada hora, el flujo de radio cada 3 horas. La cuadrícula OVATION (cerca de 1 MB) se lee cada 20 minutos **solo** mientras exista un dispositivo Auroras o se muestre un widget de aurora. El servidor responde «no modificado» a un archivo sin cambios, un fallo duplica la espera (una hora como máximo) y los últimos valores se guardan en la carpeta de datos de la integración.

## Uso

### Dispositivos

En la pantalla de descubrimiento: un dispositivo **Clima espacial (NOAA)** y un dispositivo **Auroras** por vivienda con ubicación. Cree los que desee.

| Dispositivo           | Funciones                                                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clima espacial (NOAA) | Kp estimado (últimos minutos), índice Kp (3 h), tormenta geomagnética (G 0–5), tormenta de radiación (S 0–5), apagón de radio (R 0–5), viento solar (km/s), campo magnético Bz y Bt (nT), flujo de radio 10,7 cm (sfu), clase de rayos X (un texto, «B5.4») |
| Auroras – vivienda    | Probabilidad de aurora (%), cielo oscuro (1 = el sol a más de 6° bajo el horizonte), Kp previsto esta noche                                                                                                                                                 |

Gladys no tiene unidad para km/s, nT, sfu ni para el Kp: estas funciones no tienen unidad, va escrita en su nombre. La probabilidad es la de una aurora en el cenit, la más alta de las nueve celdas de 1° alrededor de la vivienda; una aurora más al norte puede verse de todos modos baja en el horizonte.

### Widgets del panel

![Los tres widgets: el clima espacial actual con el Kp de los últimos días y de los tres siguientes, la previsión de auroras de una vivienda, los últimos mensajes del SWPC (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-noaa-space-weather/main/docs/assets/widgets.es.png)

- **Clima espacial**: un indicador del Kp, los niveles G, S y R, el viento solar, Bz, el Kp observado en dos días y previsto en tres, los rayos X, la última fulguración, el último mensaje del SWPC.
- **Previsión de auroras**: elija un dispositivo Auroras (vacío: la primera vivienda con ubicación): probabilidad, cielo oscuro o claro, Kp previsto esta noche, umbral, las últimas 24 horas, las horas de cielo oscuro.
- **Alertas del SWPC**: los últimos mensajes con un título corto en su idioma, el tipo como insignia, el texto original en inglés al abrirlo. Ajustes: tipos, periodo.

### Escenas

Disparadores (cada uno una vez por evento, nunca al arrancar):

- **NOAA: tormenta geomagnética**: la escala G alcanza un nuevo nivel; filtro por niveles (para «G3 o más», marque G3, G4 y G5).
- **NOAA: fin de tormenta geomagnética**: de nuevo en G0 desde hace 3 horas.
- **NOAA: tormenta de radiación** (S) y **NOAA: apagón de radio** (R): un nuevo nivel.
- **NOAA: fulguración solar**: una fulguración alcanza la clase M o X (filtro: solo X); si pasa de M a X, se dispara de nuevo.
- **NOAA: aurora posible**: en una vivienda con dispositivo Auroras, la probabilidad alcanza el umbral con cielo oscuro; **NOAA: fin de aurora posible** al amanecer o cuando baja.
- **NOAA: mensaje del SWPC**: cada nueva vigilancia, aviso, alerta o resumen, filtrados por tipo y tema.
- **NOAA: tormenta prevista**: un Kp de 5 o más previsto en 3 días, una vez por episodio.

Cada disparador ofrece una frase lista, `{{triggerEvent.data.sentence}}`, en el idioma de la configuración.

Acciones: **leer el clima espacial**, **leer la previsión de aurora** (una vivienda), **leer la previsión a 3 días**, cada una con una frase `summary`. Responden con las últimas lecturas y solo vuelven a leer lo que es demasiado antiguo.

Ejemplos:

1. Cuando **tormenta geomagnética** con los niveles G3, G4, G5 → enviar la notificación `{{triggerEvent.data.sentence}}`.
2. Cuando **aurora posible** en el dispositivo Auroras de la cabaña → enviar «Aurora posible esta noche: {{triggerEvent.data.probability}} %, mire hacia el norte».
3. Cuando **fulguración solar** de clase X → enviar «Fulguración X: radio HF y GPS pueden fallar ({{triggerEvent.data.class}})» al radioaficionado de la casa.

## Solución de problemas

- **Sin dispositivo Auroras**: la vivienda no tiene ubicación (Configuración → Viviendas); luego vuelva a buscar desde la pantalla de descubrimiento.
- **El widget de aurora espera**: la cuadrícula OVATION se lee en el minuto siguiente a la primera visualización; aparece en unos minutos.
- **«El SWPC de la NOAA no responde»**: el servicio o la conexión a internet están caídos; la integración vuelve a intentarlo sola, cada vez menos a menudo (una hora como máximo).
- **Un valor queda vacío**: un producto más antiguo que su frescura (una hora para el viento solar) no se muestra como «actual»; el SWPC a veces interrumpe un flujo.
- Registros: Configuración → Supervisión; añada `DEBUG=gladys-integration-sdk` en modo desarrollador para los del SDK. Incidencias: https://github.com/William-De71/gladys-noaa-space-weather/issues
