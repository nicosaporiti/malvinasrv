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

### Desktop

| Tecla | Accion |
|-------|--------|
| Flechas / WASD | Movimiento |
| Space / Z | Disparo |
| X | Arma especial |
| Enter | Confirmar / Seleccionar |
| M | Mutear / Desmutear |

### Mobile

| Control | Accion |
|---------|--------|
| Joystick (izquierda) | Movimiento |
| Boton A (derecha) | Disparo continuo |
| Boton B (derecha) | Arma especial |
| Tap en pantalla | Confirmar / Seleccionar |

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

## Enemigos

### Aereos
- **Sea Harrier** — Caza enemigo con multiples patrones de vuelo (recto, sinusoidal, picada, strafe)

### Navales
- **Fragata** — HP: 10, disparo simple dirigido
- **Destructor** — HP: 20, rafaga de 3 disparos
- **Portaaviones** — HP: 40, rafaga de 3 disparos, fuego rapido

### Bosses
- **Grupo de Fragatas** — HP: 60, disparos dirigidos
- **Escolta de Destructores** — HP: 100, patron en abanico
- **HMS Invincible** — HP: 150, rafagas circulares rotativas
- Todos los bosses tienen 3 fases segun HP restante, aumentando velocidad y agresividad

## Power-ups

| Item | Efecto |
|------|--------|
| **P** | Mejora nivel de arma (single → doble → triple spread → doble + retaguardia) |
| **S** | Aumenta velocidad de movimiento |
| **B** | +1 carga de arma especial |
| **L** | +1 vida |

## Musica

5 temas musicales MP3 que cambian segun el contexto:

| Momento | Tema | Loop |
|---------|------|------|
| Pantalla de titulo | `music_title.mp3` | Si |
| Gameplay (etapas) | `music_stage.mp3` | Si |
| Pelea de boss | `music_boss.mp3` | Si |
| Victoria / stage clear | `music_victory.mp3` | No |
| Game over | `music_gameover.mp3` | No |

Efectos de sonido procedurales 8-bit generados con Web Audio API (disparo, explosion, powerup, muerte, alarma de boss).

## Tech Stack

- **Vanilla JavaScript + HTML5 Canvas** — sin frameworks, sin bundler
- **ES Modules nativos** (`<script type="module">`)
- Resolucion interna **256x384** escalada con CSS pixelado
- **Web Audio API** para musica (MP3) y efectos procedurales 8-bit
- Sprites PNG con animaciones (explosiones de 5 frames)
- Object pooling para proyectiles (200) y explosiones (50)
- Fixed timestep a 60fps con acumulador de delta
- Deteccion de colisiones AABB
- Soporte mobile con controles tactiles (joystick + botones)
- Compatible con GitHub Pages (sitio estatico)

## Estructura

```
malvinasrv/
├── index.html                 # Entry point + controles tactiles mobile
├── style.css                  # Layout responsive (desktop + mobile)
├── README.md
├── assets/
│   ├── skyhawk.png            # Sprite A-4B Skyhawk
│   ├── mirage.png             # Sprite Mirage IIIEA
│   ├── dagger.png             # Sprite IAI Dagger
│   ├── enemy_harrier.png      # Sprite Sea Harrier (rotado 180°)
│   ├── enemy_ship.png         # Sprite fragata
│   ├── enemy_destroyer.png    # Sprite destructor
│   ├── enemy_carrier.png      # Sprite portaaviones
│   ├── boss.png               # Sprite boss (battleship)
│   ├── missile.png            # Sprite misil (arma especial Dagger)
│   ├── bomb.png               # Sprite bomba (arma especial Skyhawk)
│   ├── afterburner.png        # Sprite llamas postcombustion (Mirage)
│   ├── title_art.png          # Arte de portada
│   ├── explosion_0..4.png     # Animacion de explosion (5 frames)
│   ├── music_title.mp3        # Musica titulo
│   ├── music_stage.mp3        # Musica gameplay
│   ├── music_boss.mp3         # Musica boss
│   ├── music_victory.mp3      # Musica victoria
│   └── music_gameover.mp3     # Musica game over
├── js/
│   ├── main.js                # Boot, carga de assets, maquina de escenas
│   ├── engine/
│   │   ├── game-loop.js       # Loop con fixed timestep 60fps
│   │   ├── input.js           # Teclado + controles tactiles (joystick, botones)
│   │   ├── renderer.js        # Canvas offscreen 256x384, escalado pixelado
│   │   ├── collision.js       # Deteccion AABB
│   │   ├── audio.js           # Sistema de musica MP3 + SFX procedurales
│   │   └── assets.js          # Precarga de sprites PNG
│   ├── entities/
│   │   ├── entity.js          # Clase base (x, y, w, h, hp, vx, vy)
│   │   ├── player.js          # Jugador (movimiento, disparo, especial, muerte, respawn)
│   │   ├── enemy-plane.js     # Aviones enemigos (6 patrones de vuelo)
│   │   ├── enemy-ship.js      # Barcos enemigos (3 tipos con sprites distintos)
│   │   ├── boss.js            # Jefes de etapa (3 fases, patrones de fuego)
│   │   ├── projectile.js      # Balas y misiles con sprites (pool de 200)
│   │   ├── explosion.js       # Explosiones animadas 5 frames (pool de 50)
│   │   └── powerup.js         # Power-ups (P, S, B, L)
│   ├── scenes/
│   │   ├── title-scene.js     # Pantalla de titulo con arte
│   │   ├── select-scene.js    # Seleccion de aeronave con stats
│   │   ├── game-scene.js      # Escena principal (briefing, gameplay, boss, stage clear)
│   │   └── gameover-scene.js  # Game over / victoria
│   ├── data/
│   │   ├── aircraft.js        # Definiciones de 3 aeronaves
│   │   └── stages.js          # 5 etapas con oleadas
│   └── sprites/
│       └── sprites.js         # Sprites legacy (usado por powerups)
```

## Deploy

Sitio 100% estatico. Opciones gratuitas:

- **GitHub Pages** — push a repo y activar en Settings > Pages
- **Netlify / Vercel / Cloudflare Pages** — conectar repo o drag & drop

## Inspirado en nuestros heroes
