# 使用Node.js LTS版本作为基础镜像
FROM node:20-alpine as builder

# 设置工作目录
WORKDIR /app

# 复制前端项目文件
COPY doc-block-viewer/package.json doc-block-viewer/package-lock.json ./

# 安装依赖
RUN npm ci

# 复制所有源代码
COPY doc-block-viewer/ ./

# 构建生产版本
RUN npm run build

# 使用轻量级Nginx镜像来服务静态文件
FROM nginx:alpine

# 复制构建产物到Nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]