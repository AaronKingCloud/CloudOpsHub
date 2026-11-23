# HTTPS (task A5).
#
#   browser ──HTTPS──▶ CloudFront (https://<id>.cloudfront.net, free AWS certificate)
#                        │  viewer-request function: only allowed_cidrs get in (403 for everyone else)
#                        │  http:// requests are redirected to https://
#                        └──HTTP:80──▶ EC2 (security group: CloudFront only)
#
# A custom domain would need a certificate in us-east-1 (ACM) and DNS; the cloudfront.net address avoids both.

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled" # the app is dynamic; static files are small
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerExceptHostHeader" # forwards Authorization, X-Agent-Key, query strings, cookies
}

# Keeps the site private to approved IPs (the demo logins in backend/seed.py are public).
# Runs at the edge; 2M free invocations/month.
resource "aws_cloudfront_function" "ip_allowlist" {
  name    = "${local.name}-ip-allowlist"
  runtime = "cloudfront-js-2.0"
  comment = "Only allowed_cidrs may reach CloudOps Hub"
  publish = true
  code    = templatefile("${path.module}/ip_allowlist.js.tftpl", { allowed_cidrs = jsonencode(var.allowed_cidrs) })
}

resource "aws_cloudfront_distribution" "app" {
  enabled         = true
  comment         = "CloudOps Hub dev (HTTPS)"
  is_ipv6_enabled = false            # the allowlist checks IPv4 addresses
  price_class     = "PriceClass_100" # North America + Europe edges (cheapest)
  http_version    = "http2and3"

  origin {
    origin_id   = "app-server"
    domain_name = aws_eip.app.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }

  default_cache_behavior {
    target_origin_id         = "app-server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.ip_allowlist.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021" # ignored with the default certificate (AWS manages it)
  }
}

locals {
  site_url = "https://${aws_cloudfront_distribution.app.domain_name}"
}
