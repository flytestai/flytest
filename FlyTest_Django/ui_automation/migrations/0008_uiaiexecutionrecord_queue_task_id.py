from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ui_automation", "0007_uiaiexecutionrecord_heartbeat_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="uiaiexecutionrecord",
            name="queue_task_id",
            field=models.CharField(
                blank=True, max_length=64, null=True, verbose_name="队列任务ID"
            ),
        ),
    ]
