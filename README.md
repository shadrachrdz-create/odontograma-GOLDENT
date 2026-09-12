# GOLDENT · Expediente Odontológico Digital V2.1

PWA clínica responsive para iOS, Android, tablet y escritorio.

## V2.1 incluye
- Identidad GOLDENT con logo oficial integrado en PNG transparente y respaldo SVG vectorial, verde serpiente/escarola, crema y dorado.
- Odontograma FDI/ISO 3950 con dentición permanente y temporal.
- Dientes SVG diferenciados por incisivo, canino, premolar y molar.
- Registro manual por superficies M, D, V, L/P y O/I.
- Hallazgos: caries, obturación, corona, endodoncia, implante, sellador, extracción indicada, fractura, ausente y sano.
- Dictado odontológico con previsualización antes de aplicar.
- Dictado compatible con varias piezas en una sola frase, con o sin repetir la palabra “pieza”.
- Periodontograma permanente con 6 sitios por pieza, PS 0–12 mm, sangrado, supuración, movilidad y furcación.
- Cuatro perfiles periodontales gráficos: superior vestibular/palatino e inferior vestibular/lingual.
- Exploración por pieza con hallazgos, diagnóstico, manejo/tratamiento sugerido, tratamiento realizado y seguimiento.
- Historial de modificaciones.
- IndexedDB local, exportación/importación JSON, impresión/PDF y modo PWA offline.

## Importante
Esta versión es un prototipo clínico funcional. Para despliegue como expediente clínico real multiusuario se deben implementar autenticación, control de acceso, cifrado, respaldo, auditoría, consentimiento/políticas de privacidad y validación normativa correspondiente.

## Publicación en GitHub Pages
Subir todos los archivos de esta carpeta a la raíz del repositorio y usar Pages → Deploy from branch → main → /(root).

No subir únicamente `index.html`: `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js` y los archivos de logo deben conservarse juntos en la misma carpeta.
