variable "aws_region" { type = string, default = "sa-east-1" }
variable "ecr_repository" { type = string, default = "kz-erp-api" }
variable "image_tag" { type = string }
variable "mongodb_uri" { type = string, sensitive = true }
variable "mongodb_db" { type = string, default = "ERP" }
variable "auth_secret" { type = string, sensitive = true }
variable "core_bootstrap_key" { type = string, sensitive = true }
variable "cors_origin" { type = string }
variable "public_zone" { type = string }
variable "api_domain" { type = string }
variable "cdn_domain" { type = string }
variable "cloudfront_certificate_arn" { type = string }
