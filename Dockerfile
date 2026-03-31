# Image nginx légère
FROM nginx:alpine

# Install envsubst (inclus dans gettext)
RUN apk add --no-cache gettext

# Nettoyer le dossier par défaut
RUN rm -rf /usr/share/nginx/html/*

# Copier uniquement le build Angular (browser)
COPY dist/tracking-bo/browser /usr/share/nginx/html

# Copier la config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier l'entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
