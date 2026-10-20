-- Run after the Spring application has created/updated its tables:
-- mysql -h 127.0.0.1 -P 3306 -u instagram_user -p backend_instagram < seed-demo.sql
-- Demo password for all seeded accounts: InstagramDemo!2026
-- The current application has no role column/authorization; admin is a demo login, not a privileged account.

INSERT INTO users (user_nickname, user_fullname, user_email, user_password, user_image, user_bio, is_online, created_at)
SELECT 'admin', 'Demo Admin', 'admin@instagram.local', '$2a$10$QPRY62IaT8vmj/idabOVhu4QrjX8hlOq5clVknvFkQZL8AaKRrqe.',
       'https://i.pravatar.cc/300?img=12', 'Demo account for local testing', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_email = 'admin@instagram.local');

INSERT INTO users (user_nickname, user_fullname, user_email, user_password, user_image, user_bio, is_online, created_at)
SELECT 'linh_demo', 'Linh Nguyen', 'linh@instagram.local', '$2a$10$QPRY62IaT8vmj/idabOVhu4QrjX8hlOq5clVknvFkQZL8AaKRrqe.',
       'https://i.pravatar.cc/300?img=47', 'Coffee, travel, and little moments', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_email = 'linh@instagram.local');

INSERT INTO users (user_nickname, user_fullname, user_email, user_password, user_image, user_bio, is_online, created_at)
SELECT 'minh_demo', 'Minh Tran', 'minh@instagram.local', '$2a$10$QPRY62IaT8vmj/idabOVhu4QrjX8hlOq5clVknvFkQZL8AaKRrqe.',
       'https://i.pravatar.cc/300?img=33', 'Weekend photographer', 0, NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE user_email = 'minh@instagram.local');

INSERT INTO posts (title, user_id, created_at, likes_count, comments_count, status, access)
SELECT 'A quiet morning in Saigon', u.id, NOW() - INTERVAL 2 HOUR, 1, 1, 'True', 'PUBLIC'
FROM users u WHERE u.user_email = 'admin@instagram.local'
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.user_id = u.id AND p.title = 'A quiet morning in Saigon');

INSERT INTO posts (title, user_id, created_at, likes_count, comments_count, status, access)
SELECT 'Weekend escape', u.id, NOW() - INTERVAL 1 DAY, 1, 1, 'True', 'PUBLIC'
FROM users u WHERE u.user_email = 'linh@instagram.local'
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.user_id = u.id AND p.title = 'Weekend escape');

INSERT INTO media (url, type, post_id, created_at)
SELECT 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1000', 'IMAGE', p.id, NOW()
FROM posts p JOIN users u ON u.id = p.user_id
WHERE u.user_email = 'admin@instagram.local' AND p.title = 'A quiet morning in Saigon'
AND NOT EXISTS (SELECT 1 FROM media m WHERE m.post_id = p.id);

INSERT INTO media (url, type, post_id, created_at)
SELECT 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1000', 'IMAGE', p.id, NOW()
FROM posts p JOIN users u ON u.id = p.user_id
WHERE u.user_email = 'linh@instagram.local' AND p.title = 'Weekend escape'
AND NOT EXISTS (SELECT 1 FROM media m WHERE m.post_id = p.id);

INSERT INTO comments (user_id, post_id, content, created_at)
SELECT actor.id, p.id, 'This looks lovely!', NOW()
FROM users actor CROSS JOIN posts p JOIN users owner ON owner.id = p.user_id
WHERE actor.user_email = 'linh@instagram.local' AND owner.user_email = 'admin@instagram.local'
AND p.title = 'A quiet morning in Saigon'
AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.user_id = actor.id AND c.post_id = p.id AND c.content = 'This looks lovely!');

INSERT INTO comments (user_id, post_id, content, created_at)
SELECT actor.id, p.id, 'Adding this place to my list!', NOW()
FROM users actor CROSS JOIN posts p JOIN users owner ON owner.id = p.user_id
WHERE actor.user_email = 'admin@instagram.local' AND owner.user_email = 'linh@instagram.local'
AND p.title = 'Weekend escape'
AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.user_id = actor.id AND c.post_id = p.id AND c.content = 'Adding this place to my list!');

INSERT INTO likes (user_id, post_id, created_at)
SELECT actor.id, p.id, NOW()
FROM users actor CROSS JOIN posts p JOIN users owner ON owner.id = p.user_id
WHERE actor.user_email = 'linh@instagram.local' AND owner.user_email = 'admin@instagram.local'
AND p.title = 'A quiet morning in Saigon'
AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.user_id = actor.id AND l.post_id = p.id);

INSERT INTO likes (user_id, post_id, created_at)
SELECT actor.id, p.id, NOW()
FROM users actor CROSS JOIN posts p JOIN users owner ON owner.id = p.user_id
WHERE actor.user_email = 'admin@instagram.local' AND owner.user_email = 'linh@instagram.local'
AND p.title = 'Weekend escape'
AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.user_id = actor.id AND l.post_id = p.id);

INSERT INTO user_follow (follower_id, following_id, created_at, is_blocking, is_friend)
SELECT follower.id, following.id, NOW(), 0, 1
FROM users follower CROSS JOIN users following
WHERE follower.user_email = 'admin@instagram.local' AND following.user_email = 'linh@instagram.local'
AND NOT EXISTS (SELECT 1 FROM user_follow f WHERE f.follower_id = follower.id AND f.following_id = following.id);

INSERT INTO user_follow (follower_id, following_id, created_at, is_blocking, is_friend)
SELECT follower.id, following.id, NOW(), 0, 1
FROM users follower CROSS JOIN users following
WHERE follower.user_email = 'linh@instagram.local' AND following.user_email = 'admin@instagram.local'
AND NOT EXISTS (SELECT 1 FROM user_follow f WHERE f.follower_id = follower.id AND f.following_id = following.id);

INSERT INTO stories (user_id, url, access, status, created_at)
SELECT u.id, 'https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900', 'PUBLIC', 1, NOW()
FROM users u WHERE u.user_email = 'admin@instagram.local'
AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.user_id = u.id AND s.url LIKE '%1500534623283%');

INSERT INTO stories (user_id, url, access, status, created_at)
SELECT u.id, 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=900', 'PUBLIC', 1, NOW()
FROM users u WHERE u.user_email = 'linh@instagram.local'
AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.user_id = u.id AND s.url LIKE '%1470770841072%');

INSERT INTO notifications (user_id, actor_id, post_id, type, message, sent_at, is_read)
SELECT owner.id, actor.id, p.id, 'LIKE', 'linh_demo liked your post', NOW(), 0
FROM users actor CROSS JOIN posts p JOIN users owner ON owner.id = p.user_id
WHERE actor.user_email = 'linh@instagram.local' AND owner.user_email = 'admin@instagram.local'
AND p.title = 'A quiet morning in Saigon'
AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = owner.id AND n.actor_id = actor.id AND n.post_id = p.id AND n.type = 'LIKE');

INSERT INTO conversations (name, is_group_chat, created_at, updated_at)
SELECT 'Demo chat', 0, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM conversations WHERE name = 'Demo chat');

INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
SELECT c.id, u.id, NOW()
FROM conversations c CROSS JOIN users u
WHERE c.name = 'Demo chat' AND u.user_email IN ('admin@instagram.local', 'linh@instagram.local')
AND NOT EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = u.id);

INSERT INTO messages (conversation_id, sender_id, content, created_at, is_read)
SELECT c.id, u.id, 'Hi! This is a seeded conversation for testing.', NOW(), 1
FROM conversations c CROSS JOIN users u
WHERE c.name = 'Demo chat' AND u.user_email = 'admin@instagram.local'
AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content = 'Hi! This is a seeded conversation for testing.');

INSERT INTO messages (conversation_id, sender_id, content, created_at, is_read)
SELECT c.id, u.id, 'Nice to meet you here!', NOW(), 0
FROM conversations c CROSS JOIN users u
WHERE c.name = 'Demo chat' AND u.user_email = 'linh@instagram.local'
AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content = 'Nice to meet you here!');
