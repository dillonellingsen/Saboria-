# Saboria

App de nutrición en español e inglés: calcula tus calorías, arma tu plan de la semana con lo que tienes en la cocina, te da la lista del súper y te dice si un producto te conviene.

Saboria helps you plan meals from what's already in your kitchen, builds the grocery list, and tells you whether a scanned product fits your plan.

## Qué hace

- **Onboarding:** calcula tu meta de calorías y macros (Mifflin-St Jeor, movimiento diario y entrenamiento de fuerza por separado) con rango de ±10% y proyección de peso. Si marcas una condición de salud o tienes menos de 18 años, no aplica déficit.
- **Plan de 7 días:** elige recetas que respetan tu dieta, alergias y lo que no te gusta, y ajusta porciones para que cada día quede cerca de tu meta. Cada comida se puede cambiar por otra con calorías parecidas.
- **Lista del súper:** suma los ingredientes de la semana, redondea a lo que se compra y separa lo que ya tienes.
- **Hoy:** calorías restantes, macros, las comidas de tu plan con un toque para registrarlas, y agua.
- **Escanear:** código de barras (Open Food Facts), foto del plato (Claude, requiere `vision-api/`) o búsqueda por nombre. Cada producto trae un veredicto con razones: alérgenos, dieta, azúcar, sal y calorías.

## Abrirla

Es un solo archivo: `index.html`.

- **En la compu:** ábrelo en Chrome o Safari.
- **En el teléfono, con cámara:** la cámara solo funciona desde `https://`. Lo más fácil es GitHub Pages: en el repositorio ve a Settings → Pages, elige la rama y la carpeta raíz, y guarda. En un minuto queda en `https://<usuario>.github.io/Saboria-/`.

## Foto del plato y Open Food Facts

La carpeta `vision-api/` es un Cloudflare Worker que analiza fotos con la API de Claude y hace las búsquedas de Open Food Facts con la identificación que ellos piden. Los pasos para publicarlo están en `vision-api/README.md`. Después pega su URL en `VISION.endpoint`, dentro de `index.html`.

## Antes de lanzar

- **Cuentas:** hoy viven solo en el teléfono (con contraseña cifrada con PBKDF2). Si el usuario cambia de teléfono, pierde todo. Hace falta un servicio de cuentas (Supabase, Firebase Auth o similar).
- **Recetas:** hay 15. Para que el plan no se repita hacen falta entre 60 y 100.
- **Modo oscuro:** no existe todavía.
- **Aviso médico:** revisar los textos de salud con un nutriólogo antes de publicar.
