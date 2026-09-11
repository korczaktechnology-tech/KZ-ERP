variable "aws_region" { type = string, default = "sa-east-1" }
variable "ecr_repository" { type = string, default = "kz-erp-api" }
variable "image_tag" { type = string }
variable "postgres_version" { type = string, default = "17.6" }
variable "db_instance_class" { type = string, default = "db.t4g.medium" }
variable "db_username" { type = string, sensitive = true }
variable "db_password" { type = string, sensitive = true }
variable "mongodb_uri" { type = string, sensitive = true }
variable "mongodb_db" { type = string, default = "ERP" }
variable "auth_secret" { type = string, sensitive = true }
variable "core_bootstrap_key" { type = string, sensitive = true }
variable "cors_origin" { type = string }
variable "public_zone" { type = string }
variable "api_domain" { type = string }
variable "cdn_domain" { type = string }
variable "cloudfront_certificate_arn" { type = string }
variable "cloudfront_oac_name" { type = string, default = "kz-erp-unused-oac" }
