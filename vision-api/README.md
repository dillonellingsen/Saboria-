# Saboria vision API

Servidor pequeño que recibe la foto de un plato y devuelve los alimentos, los gramos estimados, las calorías y los macros. Usa la API de Claude (modelo `claude-opus-5`).

Existe porque la clave de la API **no puede ir en `index.html`**: cualquiera que abra la página la podría copiar y gastar tu saldo.

## Publicarlo (Cloudflare Workers, plan gratis)

1. Crea una cuenta en https://dash.cloudflare.com y una clave de API en https://console.anthropic.com.
2. En esta carpeta:
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # pega tu clave cuando la pida
   npx wrangler deploy
   ```
3. `deploy` imprime una URL como `https://saboria-vision.<tu-usuario>.workers.dev`. Pégala en `index.html`:
   ```js
   const VISION = { endpoint: "https://saboria-vision.<tu-usuario>.workers.dev" };
   ```
4. Cuando tengas dominio, cambia `ALLOWED_ORIGIN` en `wrangler.toml` por tu sitio (por ejemplo `https://saboria.app`) y vuelve a correr `npx wrangler deploy`.

Si `VISION.endpoint` está vacío, la app sigue usando el adivinador en el teléfono (MobileNet), que es mucho menos preciso.

## Qué recibe y qué devuelve

`POST /` con JSON:

```json
{ "image": "<base64 JPEG/PNG/WebP, máx. 4 MB>", "media_type": "image/jpeg", "lang": "es" }
```

Respuesta:

```json
{
  "is_food": true,
  "items": [{ "name": "Arroz blanco", "grams": 150, "kcal": 195, "protein_g": 4, "carbs_g": 42, "fat_g": 0 }],
  "confidence": "medium",
  "note": "Calculé 1 cda de aceite en el pollo.",
  "total_kcal": 195
}
```

Errores: `400 bad_image`, `413 too_big`, `403 origin`, `422 refused`, `429 busy`, `502 upstream`.

## Costo y límites

- Cada foto cuesta unos US$0.02 con `claude-opus-5` (la app reduce la foto a 1024 px antes de mandarla). Con `claude-sonnet-5` saldría alrededor de 3 veces más barato; se cambia en `MODEL` dentro de `src/index.js`.
- **No tiene límite de uso por persona.** `ALLOWED_ORIGIN` solo frena a otros sitios web; cualquiera con `curl` puede seguir llamando la URL. Antes de lanzar, agrega un límite por usuario (Cloudflare Rate Limiting o exigir sesión iniciada) y pon un tope de gasto mensual en la consola de Anthropic.
- La API tiene activado `fallbacks: "default"`: si el modelo rechaza una foto por sus filtros de seguridad, la misma solicitud se reintenta con otro modelo.
