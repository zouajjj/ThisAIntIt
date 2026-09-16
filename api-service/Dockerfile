# --- Stage 1: build the React frontend ---
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY spring-frontend/package.json spring-frontend/package-lock.json ./
RUN npm ci
COPY spring-frontend/ ./
# react-scripts build only — the repo's own "npm run build" also runs a
# local "cpy" step that assumes a sibling checkout on disk, which doesn't
# exist inside the build context. We copy the output ourselves below.
RUN npx react-scripts build

# --- Stage 2: build api-service, with the frontend baked in as static resources ---
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY api-service/pom.xml ./
RUN mvn -B dependency:go-offline
COPY api-service/src ./src
COPY --from=frontend-build /frontend/build ./src/main/resources/static
RUN mvn -B clean package -DskipTests

# --- Stage 3: slim runtime image ---
# Not eclipse-temurin:17-jre-alpine: that tag has no arm64 manifest, which breaks
# on Oracle Cloud's free-tier Ampere (A1.Flex, arm64) VMs. This glibc-based tag
# is multi-arch (amd64 + arm64).
FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app
COPY --from=backend-build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
