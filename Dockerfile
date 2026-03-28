# ==========================================
# FASE 1: CONSTRUCCIÓN (El equipo de obra)
# ==========================================
FROM node:20-alpine AS build

# Establecemos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos SOLO los archivos de dependencias primero (Aprovecha la caché de Docker)
COPY package*.json ./

# Instalamos las librerías de forma limpia y exacta
RUN npm ci --legacy-peer-deps

# Copiamos todo el resto de tu código fuente
COPY . .

# Compilamos la aplicación Angular para Producción
RUN npm run build --configuration=production

# ==========================================
# FASE 2: PRODUCCIÓN (El edificio terminado)
# ==========================================
FROM nginx:1.25-bookworm

# 🛡️ Aplicamos el parche de seguridad forzado (Mitiga falsos positivos del escáner)
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

# 1. Copiamos nuestra configuración de Nginx para el ruteo de Angular
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 2. Borramos los archivos base que trae Nginx por defecto
RUN rm -rf /usr/share/nginx/html/*

# 3. Copiamos TU código compilado desde la FASE 1
# (Ruta confirmada para Angular 17+ con tu carpeta rms-app)
COPY --from=build /app/dist/rms-app/browser /usr/share/nginx/html

# Exponemos el puerto 80 al mundo exterior
EXPOSE 80

# Arrancamos el servidor Nginx
CMD ["nginx", "-g", "daemon off;"]
