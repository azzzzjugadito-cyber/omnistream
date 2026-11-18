# Etapa 1: Compilación de Frontend y dependencias
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Instalar herramientas para compilar módulos nativos (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copiar manifiestos de dependencias
COPY package*.json ./
COPY client/package*.json ./client/

# Instalar dependencias raíz y del cliente
RUN npm install
RUN cd client && npm install

# Copiar todo el código fuente
COPY . .

# Compilar frontend React (Vite -> client/dist)
RUN npm run build

# Etapa 2: Imagen final de producción
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiar la aplicación compilada desde la etapa builder
COPY --from=builder /app /app

# Asegurar directorios de persistencia
RUN mkdir -p /app/logs /app/data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
