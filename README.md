# MALVINAS S.R.V.

**Soberania, Resistencia, Victoria**

Shooter vertical estilo 8-bit inspirado en nuestros heroes y en el clasico 1942, ambientado en la Guerra de Malvinas. Un piloto argentino atraviesa 5 etapas enfrentando aviones y barcos enemigos hasta llegar a las islas.

## Como jugar

Abrir `index.html` en un navegador moderno. No requiere instalacion, servidor ni build.

> Para evitar restricciones de CORS con ES Modules, se recomienda servir con un servidor local:
> ```bash
> python3 -m http.server 8080
> ```
> Luego abrir `http://localhost:8080`

## Controles

| Tecla | Accion |
|-------|--------|
| Flechas / WASD | Movimiento |
| Space / Z | Disparo |
| X | Arma especial |
| Enter | Confirmar / Seleccionar |
| M | Mutear / Desmutear |

## Aeronaves

| Aeronave | Velocidad | Fuego | Blindaje | Especial |
|----------|-----------|-------|----------|----------|
| **A-4B Skyhawk** | 6 | 8 | 4 | Bombardeo — 3 bombas hacia adelante, daño masivo a todos los enemigos |
| **Mirage IIIEA** | 9 | 5 | 4 | Postcombustion — 2s de invencibilidad + velocidad extra |
| **IAI Dagger** | 7 | 7 | 6 | Salva de misiles — 4 misiles guiados en abanico |

## Etapas

1. **Sortida** — Mar abierto, enemigos ligeros. Boss: Grupo de Fragatas
2. **Zona de Exclusion** — Patrullas aereas pesadas. Boss: Escolta de Destructores
3. **Estrecho San Carlos** — Presencia naval densa. Boss: HMS Invincible
4. **Supremacia Aerea** — Dogfight sobre las islas. Boss: Escolta de Destructores
5. **Malvinas** — Asalto final. Boss: HMS Invincible

## Tech Stack

- Vanilla JavaScript + HTML5 Canvas
- ES Modules nativos (sin frameworks, sin bundler)
- Resolucion interna 256x384 escalada con CSS pixelado
- Web Audio API para musica y efectos procedurales 8-bit
- Sprites PNG con animaciones (explosiones de 5 frames)

## Estructura

```
malvinasrv/
├── index.html
├── style.css
├── assets/                    # Sprites PNG y musica MP3
├── js/
│   ├── main.js                # Boot y maquina de estados de escenas
│   ├── engine/
│   │   ├── game-loop.js       # Loop con fixed timestep 60fps
│   │   ├── input.js           # Teclado poll-based
│   │   ├── renderer.js        # Canvas offscreen y escalado
│   │   ├── collision.js       # Deteccion AABB
│   │   ├── audio.js           # Musica y SFX procedurales
│   │   └── assets.js          # Carga de sprites PNG
│   ├── entities/
│   │   ├── entity.js          # Clase base
│   │   ├── player.js          # Jugador
│   │   ├── enemy-plane.js     # Aviones enemigos (Harrier)
│   │   ├── enemy-ship.js      # Barcos enemigos (fragata, destructor, portaaviones)
│   │   ├── boss.js            # Jefes de etapa con fases
│   │   ├── projectile.js      # Balas y misiles (pool de objetos)
│   │   ├── explosion.js       # Explosiones animadas (pool de objetos)
│   │   └── powerup.js         # Power-ups (P, S, B, L)
│   ├── scenes/
│   │   ├── title-scene.js     # Pantalla de titulo
│   │   ├── select-scene.js    # Seleccion de aeronave
│   │   ├── game-scene.js      # Escena principal de juego
│   │   └── gameover-scene.js  # Game over / victoria
│   ├── data/
│   │   ├── aircraft.js        # Definiciones de aeronaves
│   │   └── stages.js          # Oleadas y etapas
│   └── sprites/
│       └── sprites.js         # Sprites legacy
```

## Inspirado en nuestros heroes
