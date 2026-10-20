#!/bin/sh
set -eu

awslocal s3api head-bucket --bucket instagram-media >/dev/null 2>&1 || awslocal s3 mb s3://instagram-media --region ap-southeast-1
awslocal s3api put-bucket-policy --bucket instagram-media --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::instagram-media/*"}]}'
