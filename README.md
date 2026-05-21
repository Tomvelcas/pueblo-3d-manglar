# Pueblo 3D Manglar

Escena 3D interactiva en navegador hecha con Vite, JavaScript vanilla y Three.js. La maqueta recrea un pueblo palafitico en manglar con casas sobre pilotes, pasarelas de madera, agua animada, botes, mirador circular, montanas, vegetacion densa y un puerto distante.

Incluye modo dia/noche, manglares con brillo interno nocturno, puentes habitables con jardineras luminosas, flota de botes alrededor del muelle y modo caminar para vivir la experiencia desde altura humana.

## Requisitos

- Node.js instalado.
- pnpm instalado.

Si no tienes pnpm, puedes instalarlo con Corepack:

```sh
corepack enable
corepack prepare pnpm@latest --activate
```

Tambien puedes instalarlo con npm si ya lo tienes disponible:

```sh
npm install -g pnpm
```

## Instalar dependencias

```sh
pnpm install
```

## Ejecutar en desarrollo

```sh
pnpm dev
```

Vite mostrara una URL local, normalmente `http://localhost:5173/`.

Controles:

- Arrastrar: orbitar o mirar alrededor en modo caminar.
- Rueda: acercar o alejar.
- WASD o flechas: desplazarse por la escena.
- Q/E: bajar o subir la camara en vista dron.
- Shift: moverse mas rapido.
- Botones del panel: alternar modo noche y modo caminar.

## Compilar

```sh
pnpm build
```

## Previsualizar el build

```sh
pnpm preview
```

## Como mejorar la escena

- Ajustar las listas de posiciones en `src/main.js` para cambiar la distribucion del pueblo.
- Aumentar o reducir los conteos de `createMangroveCluster()` para controlar densidad y rendimiento.
- Agregar nuevas variantes procedurales de casas, techos, botes o muelles.
- Reemplazar materiales simples por shaders propios para agua, nubes o vegetacion con mas detalle.
- Incorporar interacciones, por ejemplo resaltar casas al pasar el cursor o mover botes lentamente.
