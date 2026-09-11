terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" { region = var.aws_region }
data "aws_availability_zones" "available" { state = "available" }
data "aws_caller_identity" "current" {}
data "aws_ecr_repository" "api" { name = var.ecr_repository }
data "aws_acm_certificate" "api" { domain = var.api_domain, statuses = ["ISSUED"], most_recent = true }
data "aws_route53_zone" "public" { name = var.public_zone, private_zone = false }
data "aws_cloudfront_cache_policy" "caching_disabled" { name = "Managed-CachingDisabled" }
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" { name = "Managed-AllViewerExceptHostHeader" }

# MongoDB is managed outside this AWS stack (current KOS/ERP MongoDB deployment).
# The API receives MONGODB_URI and MONGODB_DB as runtime configuration.

resource "aws_vpc" "erp" {
  cidr_block = "10.40.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support = true
  tags = { Name = "kz-erp-vpc" }
}
resource "aws_internet_gateway" "erp" { vpc_id = aws_vpc.erp.id }
resource "aws_subnet" "public" {
  count = 2
  vpc_id = aws_vpc.erp.id
  cidr_block = cidrsubnet(aws_vpc.erp.cidr_block, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "kz-erp-public-${count.index + 1}" }
}
resource "aws_subnet" "private" {
  count = 2
  vpc_id = aws_vpc.erp.id
  cidr_block = cidrsubnet(aws_vpc.erp.cidr_block, 4, count.index + 8)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "kz-erp-private-${count.index + 1}" }
}
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.erp.id
  route { cidr_block = "0.0.0.0/0", gateway_id = aws_internet_gateway.erp.id }
}
resource "aws_route_table_association" "public" { count = 2, subnet_id = aws_subnet.public[count.index].id, route_table_id = aws_route_table.public.id }
resource "aws_eip" "nat" { count = 2, domain = "vpc" }
resource "aws_nat_gateway" "nat" { count = 2, allocation_id = aws_eip.nat[count.index].id, subnet_id = aws_subnet.public[count.index].id, depends_on = [aws_internet_gateway.erp] }
resource "aws_route_table" "private" {
  count = 2
  vpc_id = aws_vpc.erp.id
  route { cidr_block = "0.0.0.0/0", nat_gateway_id = aws_nat_gateway.nat[count.index].id }
}
resource "aws_route_table_association" "private" { count = 2, subnet_id = aws_subnet.private[count.index].id, route_table_id = aws_route_table.private[count.index].id }

resource "aws_security_group" "alb" {
  name = "kz-erp-alb"
  vpc_id = aws_vpc.erp.id
  ingress { from_port = 443, to_port = 443, protocol = "tcp", cidr_blocks = ["0.0.0.0/0"] }
  egress { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}
resource "aws_security_group" "api" {
  name = "kz-erp-api"
  vpc_id = aws_vpc.erp.id
  ingress { from_port = 10000, to_port = 10000, protocol = "tcp", security_groups = [aws_security_group.alb.id] }
  egress { from_port = 0, to_port = 0, protocol = "-1", cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_ecs_cluster" "erp" { name = "kz-erp" }
resource "aws_cloudwatch_log_group" "api" { name = "/kz-erp/api", retention_in_days = 30 }
resource "aws_iam_role" "ecs_execution" {
  name = "kz-erp-ecs-execution"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy_attachment" "ecs_execution" { role = aws_iam_role.ecs_execution.name, policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" }
resource "aws_iam_role" "ecs_task" {
  name = "kz-erp-ecs-task"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_lb" "api" { name = "kz-erp-api", load_balancer_type = "application", subnets = aws_subnet.public[*].id, security_groups = [aws_security_group.alb.id] }
resource "aws_lb_target_group" "api" {
  name = "kz-erp-api"
  port = 10000
  protocol = "HTTP"
  target_type = "ip"
  vpc_id = aws_vpc.erp.id
  health_check { path = "/health/ready", interval = 20, timeout = 5, healthy_threshold = 2, unhealthy_threshold = 3 }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port = 443
  protocol = "HTTPS"
  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-Res-2021-06"
  certificate_arn = data.aws_acm_certificate.api.arn
  default_action { type = "forward", target_group_arn = aws_lb_target_group.api.arn }
}

resource "aws_ecs_task_definition" "api" {
  family = "kz-erp-api"
  network_mode = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu = "1024"
  memory = "2048"
  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name = "api"
    image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.ecr_repository}:${var.image_tag}"
    essential = true
    portMappings = [{ containerPort = 10000, protocol = "tcp" }]
    environment = [
      { name = "PORT", value = "10000" },
      { name = "APP_VERSION", value = var.image_tag },
      { name = "CORS_ORIGIN", value = var.cors_origin },
      { name = "MONGODB_URI", value = var.mongodb_uri },
      { name = "MONGODB_DB", value = var.mongodb_db },
      { name = "AUTH_SECRET", value = var.auth_secret },
      { name = "CORE_BOOTSTRAP_KEY", value = var.core_bootstrap_key }
    ]
    logConfiguration = { logDriver = "awslogs", options = { awslogs-group = aws_cloudwatch_log_group.api.name, awslogs-region = var.aws_region, awslogs-stream-prefix = "api" } }
  }])
}
resource "aws_ecs_service" "api" {
  name = "kz-erp-api"
  cluster = aws_ecs_cluster.erp.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count = 2
  launch_type = "FARGATE"
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent = 200
  network_configuration { subnets = aws_subnet.private[*].id, security_groups = [aws_security_group.api.id], assign_public_ip = false }
  load_balancer { target_group_arn = aws_lb_target_group.api.arn, container_name = "api", container_port = 10000 }
  depends_on = [aws_lb_listener.https]
}
resource "aws_appautoscaling_target" "api" { max_capacity = 10, min_capacity = 2, resource_id = "service/${aws_ecs_cluster.erp.name}/${aws_ecs_service.api.name}", scalable_dimension = "ecs:service:DesiredCount", service_namespace = "ecs" }
resource "aws_appautoscaling_policy" "cpu" {
  name = "kz-erp-api-cpu"
  policy_type = "TargetTrackingScaling"
  resource_id = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace = aws_appautoscaling_target.api.service_namespace
  target_tracking_scaling_policy_configuration { predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }, target_value = 60 }
}
resource "aws_route53_record" "api" { zone_id = data.aws_route53_zone.public.zone_id, name = var.api_domain, type = "A", alias { name = aws_lb.api.dns_name, zone_id = aws_lb.api.zone_id, evaluate_target_health = true } }
resource "aws_cloudfront_distribution" "api" {
  enabled = true
  aliases = [var.cdn_domain]
  origin { domain_name = aws_lb.api.dns_name, origin_id = "kz-erp-alb", custom_origin_config { http_port = 80, https_port = 443, origin_protocol_policy = "https-only", origin_ssl_protocols = ["TLSv1.2"] } }
  default_cache_behavior { target_origin_id = "kz-erp-alb", viewer_protocol_policy = "redirect-to-https", allowed_methods = ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"], cached_methods = ["GET","HEAD"], cache_policy_id = data.aws_cloudfront_cache_policy.caching_disabled.id, origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id }
  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { acm_certificate_arn = var.cloudfront_certificate_arn, ssl_support_method = "sni-only", minimum_protocol_version = "TLSv1.2_2021" }
}
