#!/bin/bash
cd /data/data/com.termux/files/home/blog
npx wrangler pages deploy . --project-name=leon-blog --branch=main
