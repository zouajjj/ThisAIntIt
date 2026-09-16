# --- Stage 1: build worker-service ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY worker-service/pom.xml ./
RUN mvn -B dependency:go-offline
COPY worker-service/src ./src
RUN mvn -B clean package -DskipTests

# --- Stage 2: slim runtime image ---
# Not eclipse-temurin:17-jre-alpine: that tag has no arm64 manifest, which breaks
# on Oracle Cloud's free-tier Ampere (A1.Flex, arm64) VMs. This glibc-based tag
# is multi-arch (amd64 + arm64).
FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
