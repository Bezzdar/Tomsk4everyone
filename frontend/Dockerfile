FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY HTML /usr/share/nginx/html/HTML
COPY CSS /usr/share/nginx/html/CSS
COPY JS /usr/share/nginx/html/JS
COPY Sourse /usr/share/nginx/html/Sourse

EXPOSE 80
