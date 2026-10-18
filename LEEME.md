# D’Astrea · Tienda en línea

## Qué hay aquí
- `index.html` – la tienda.
- `admin/` – el administrador (entras en tusitio.netlify.app/admin).
- `assets/d/` – imágenes de los diseños.
- `data/catalog.json` – catálogo inicial. Después de publicar, todo se edita desde el administrador.
- `netlify/functions/` – el “servidor”: guarda catálogo, imágenes subidas y listas de regalo (Netlify Blobs, gratis).

## Publicar (una sola vez)
1. Crea un repositorio en GitHub llamado `dastrea-tienda` y sube TODO el contenido de esta carpeta
   (si GitHub dice que son muchos archivos, sube primero todo menos `assets` y luego la carpeta `assets`).
2. En Netlify: Add new site → Import an existing project → GitHub → elige `dastrea-tienda` → Deploy.
3. En Netlify: Site configuration → Environment variables → agrega `ADMIN_PASSWORD` con tu contraseña (mínimo 6 caracteres).
   Luego Deploys → Trigger deploy → Deploy site.
4. Site configuration → Change site name → `dastrea` (queda dastrea.netlify.app).

La URL nunca cambia: los cambios de precios, productos, temporadas y textos se hacen en /admin y se ven al instante.
