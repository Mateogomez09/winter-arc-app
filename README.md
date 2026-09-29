# ❄️ Winter Arc App — 90 Días de Disciplina

Aplicación web progresiva (PWA) de alto rendimiento diseñada para el reto de 90 días del **Winter Arc**.

---

## ⚡ Características Principales

- **Gestor de Hábitos Inquebrantables**: 4 hábitos base inmutables (*Lectura, Entrenamiento, Dieta, Madrugar*) + hasta 2 hábitos personalizados.
- **Pactos de Honor**: Rendición de cuentas con código de invitación y racha compartida con tu compañero.
- **Gestor de Tareas Diarias**: Tareas prioritarias del día con arrastre automático de tareas retrasadas.
- **Tablón de la Comunidad**: Publicación de valor y aprendizajes diarios con reacciones de diamantes y respuestas anidadas.
- **Ranking Global en Tiempo Real**: Podio Top 3, clasificación en vivo con cálculo de XP y contador regresivo del reto.
- **Perfil & Calendario**: Mapa mensual de días perfectos, marcos desbloqueables por nivel y personalización de avatares con colores degradados.
- **Arquitectura Local-First + Supabase**: Máxima velocidad (0 ms de latencia en local) con sincronización en la nube mediante PostgreSQL y Supabase Auth.
- **PWA Instalable**: Experiencia nativa a pantalla completa en dispositivos iOS y Android.

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Base de Datos & Auth**: Supabase (PostgreSQL, Realtime WebSockets, Supabase Auth)
- **Persistencia**: Local-First (`localStorage` + background delta sync)

---

## 🚀 Despliegue en Producción (Vercel / Netlify)

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/winter-arc-app.git
   cd winter-arc-app
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno en `.env`:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
4. Compila para producción:
   ```bash
   npm run build
   ```
