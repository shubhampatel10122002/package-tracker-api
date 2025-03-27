# Enhanced Dockerfile with SmartProxy configuration
FROM node:18-slim

# Add repository for Chrome
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    wget \
    --no-install-recommends \
    && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Chrome and dependencies with additional required packages
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    xdg-utils \
    libxss1 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgconf-2-4 \
    libxkbcommon0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Tell Puppeteer to skip installing Chrome since we already have it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Add additional environment variables for Puppeteer to run properly in headless mode
ENV CHROME_DBUS_LAUNCHD_BUS_TYPE=1
ENV PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu,--no-zygote,--single-process,--headless=new"
ENV NODE_ENV=production
ENV CONTAINER_ENV=true
ENV USE_FALLBACK=false

# Add SmartProxy configuration
ENV USE_PROXY=true
ENV PROXY_HOST=gate.smartproxy.com
ENV PROXY_PORT=10001
ENV PROXY_USER=spjmpkfax7
ENV PROXY_PASS=r0grT~w4Lg0ykdIV4q

# Create necessary directories for Chrome in container
RUN mkdir -p /tmp/chrome-user-data
RUN mkdir -p /tmp/chrome-cache-dir
ENV CHROME_USER_DATA_DIR=/tmp/chrome-user-data
ENV CHROME_CACHE_DIR=/tmp/chrome-cache-dir

# Create cookie directory and empty file
RUN mkdir -p /usr/src/app/data
RUN echo "[]" > /usr/src/app/data/cookies.json

# Expose the port your app runs on
EXPOSE 3000

# Start the app
CMD [ "node", "server.js" ]
# # Docekerfile

# # Enhanced Dockerfile with fixes for Chrome in container
# FROM node:18-slim

# # Add repository for Chrome
# RUN apt-get update && apt-get install -y \
#     apt-transport-https \
#     ca-certificates \
#     curl \
#     gnupg \
#     wget \
#     --no-install-recommends \
#     && curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
#     && echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# # Install Chrome and dependencies with additional required packages
# RUN apt-get update && apt-get install -y \
#     google-chrome-stable \
#     fonts-ipafont-gothic \
#     fonts-wqy-zenhei \
#     fonts-thai-tlwg \
#     fonts-kacst \
#     fonts-freefont-ttf \
#     xdg-utils \
#     libxss1 \
#     libnss3 \
#     libatk1.0-0 \
#     libatk-bridge2.0-0 \
#     libcups2 \
#     libgbm1 \
#     libasound2 \
#     libpangocairo-1.0-0 \
#     libxcomposite1 \
#     libxdamage1 \
#     libxfixes3 \
#     libxrandr2 \
#     libgconf-2-4 \
#     libxkbcommon0 \
#     --no-install-recommends \
#     && rm -rf /var/lib/apt/lists/*

# # Create app directory
# WORKDIR /usr/src/app

# # Copy package.json and package-lock.json
# COPY package*.json ./

# # Install app dependencies
# RUN npm install

# # Bundle app source
# COPY . .

# # Tell Puppeteer to skip installing Chrome since we already have it
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# # Add additional environment variables for Puppeteer to run properly in headless mode
# ENV CHROME_DBUS_LAUNCHD_BUS_TYPE=1
# ENV PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu,--no-zygote,--single-process,--headless=new"
# ENV NODE_ENV=production
# ENV CONTAINER_ENV=true
# ENV USE_FALLBACK=false

# # Create necessary directories for Chrome in container
# RUN mkdir -p /tmp/chrome-user-data
# RUN mkdir -p /tmp/chrome-cache-dir
# ENV CHROME_USER_DATA_DIR=/tmp/chrome-user-data
# ENV CHROME_CACHE_DIR=/tmp/chrome-cache-dir

# # Create cookie directory and empty file
# RUN mkdir -p /usr/src/app/data
# RUN echo "[]" > /usr/src/app/data/cookies.json

# # Expose the port your app runs on
# EXPOSE 3000

# # Start the app
# CMD [ "node", "server.js" ]
