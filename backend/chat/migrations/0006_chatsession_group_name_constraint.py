from django.db import migrations, models


def backfill_chat_session_names(apps, schema_editor):
    chat_session_model = apps.get_model("chat", "ChatSession")
    for session in chat_session_model.objects.filter(chat_type="group", name__isnull=True):
        session.name = f"Group {session.uri}"
        session.save(update_fields=["name"])

    chat_session_model.objects.filter(chat_type="direct").exclude(name__isnull=True).update(
        name=None
    )


class Migration(migrations.Migration):
    dependencies = [
        ("chat", "0005_chatsessionmessage_idx_msg_room_created_at"),
    ]

    operations = [
        migrations.RunPython(backfill_chat_session_names, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="chatsession",
            constraint=models.CheckConstraint(
                check=(
                    (models.Q(chat_type="group") & models.Q(name__isnull=False))
                    | (models.Q(chat_type="direct") & models.Q(name__isnull=True))
                ),
                name="chk_group_name_required_direct_name_null",
            ),
        ),
    ]
