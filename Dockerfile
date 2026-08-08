FROM nginx:alpine
COPY index.html now.html more.html travel.html experience.html yaan.html ordinary.html dashboard.html 318.html 404.html robots.txt sitemap.xml /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
