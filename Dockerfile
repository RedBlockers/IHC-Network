FROM node:lts
LABEL authors="theom"
WORKDIR /NoScord

# Copier uniquement les fichiers nécessaires pour l'installation
COPY package*.json /NoScord

# Installer les dépendances
RUN npm install

COPY . /NoScord
RUN npm i
EXPOSE 80
EXPOSE 443
EXPOSE 3000

CMD ["node","server.js"]
