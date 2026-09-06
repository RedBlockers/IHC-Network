UPDATE guild_roles custom_role
JOIN guild_roles default_role
  ON default_role.guildId = custom_role.guildId
 AND default_role.isDefault = 1
 AND default_role.name = '@tous'
SET custom_role.name = CONCAT('@everyone-', custom_role.roleId)
WHERE custom_role.isDefault = 0
  AND custom_role.name = '@everyone';

UPDATE guild_roles
SET name = '@everyone'
WHERE isDefault = 1 AND name = '@tous';
