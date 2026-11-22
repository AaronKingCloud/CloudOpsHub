# Persistent app data (task A3).
#
# Both SQLite databases (users; devices/metrics/alerts) live on their own EBS volume, separate from the
# server's root disk. Replacing or rebuilding the server re-attaches this volume, so no data is lost.
# Daily snapshots give point-in-time copies for restores (task C7).

data "aws_subnet" "app" {
  id = module.network.public_subnet_ids[0]
}

resource "aws_ebs_volume" "data" {
  # Same AZ as the server (EBS volumes can only attach within one AZ).
  # Taken from the subnet, not the instance, so the boot script can reference the volume ID.
  availability_zone = data.aws_subnet.app.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"
  encrypted         = true

  tags = {
    Name     = "${local.name}-data"
    Snapshot = "daily" # picked up by the snapshot policy below
  }

  lifecycle {
    # This is the only copy of the live data. To delete it on purpose, remove this line first.
    prevent_destroy = true
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf" # shows up as an NVMe disk on t3; the boot script finds it by volume ID
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.app.id

  # On replacement, detach from the old server before it is terminated
  stop_instance_before_detaching = true
}

# ── Daily snapshots (Data Lifecycle Manager) ──

data "aws_iam_policy_document" "dlm_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dlm" {
  name               = "${local.name}-dlm"
  assume_role_policy = data.aws_iam_policy_document.dlm_assume.json
}

resource "aws_iam_role_policy_attachment" "dlm" {
  role       = aws_iam_role.dlm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "data_snapshots" {
  description        = "Daily snapshots of the CloudOps Hub data volume"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]
    target_tags = {
      Snapshot = "daily"
    }

    schedule {
      name = "daily-${var.snapshot_retention_days}d"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["07:00"] # UTC = 2-3 AM Toronto
      }

      retain_rule {
        count = var.snapshot_retention_days
      }

      copy_tags = true
    }
  }
}
