EXPLAIN ANALYZE 
SELECT "chat_chatsession"."id",
    "chat_chatsession"."create_date",
    "chat_chatsession"."update_date",
    "chat_chatsession"."owner_id",
    "chat_chatsession"."uri",
    "chat_chatsession"."name",
    "chat_chatsession"."chat_type",
    "chat_chatsession"."direct_pair_key"
FROM "chat_chatsession"
    INNER JOIN "chat_chatsessionmember" ON (
        "chat_chatsession"."id"= "chat_chatsessionmember"."chat_session_id"
    )
WHERE "chat_chatsessionmember"."user_id" = 4
ORDER BY "chat_chatsession"."update_date" DESC 

