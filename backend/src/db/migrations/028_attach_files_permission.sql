INSERT INTO guild_role_permissions (roleId, permission, effect)
SELECT roleId, 'ATTACH_FILES', effect
  FROM guild_role_permissions
 WHERE permission = 'SEND_MESSAGES'
ON DUPLICATE KEY UPDATE effect = VALUES(effect);
