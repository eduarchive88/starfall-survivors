FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html data.js engine.js ui.js manifest.webmanifest icon-192.png icon-512.png /usr/share/nginx/html/
COPY fonts /usr/share/nginx/html/fonts
EXPOSE 80
