# El frontend es HTML + CSS + JavaScript puro: no se compila ni necesita Node.
# nginx sirve los archivos tal cual y hace de proxy inverso hacia la API.
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src
COPY public /usr/share/nginx/html/public
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
