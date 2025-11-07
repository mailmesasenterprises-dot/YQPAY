# ---------- Stage 1: Build frontend ----------
FROM node:18 AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Setup backend ----------
FROM node:18
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# ✅ Copy built frontend (React uses /build)
COPY --from=build-frontend /app/frontend/build ./build
EXPOSE 8080
CMD ["npm", "start"]

# ------------------------------