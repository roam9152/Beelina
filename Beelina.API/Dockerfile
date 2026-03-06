# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project files and restore (layer cache friendly)
COPY ["Beelina.API/Beelina.API.csproj", "Beelina.API/"]
COPY ["Beelina.LIB/Beelina.LIB.csproj", "Beelina.LIB/"]
RUN dotnet restore "Beelina.API/Beelina.API.csproj"

# Copy everything and publish
COPY . .
RUN dotnet publish "Beelina.API/Beelina.API.csproj" \
    --configuration Release \
    --no-restore \
    --output /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080

ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "BeelinaAPI.dll"]
