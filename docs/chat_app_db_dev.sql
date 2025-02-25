-- Adminer 4.8.1 MySQL 11.6.2-MariaDB-ubu2404 dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `channels`;
CREATE TABLE `channels` (
  `channelId` int(11) NOT NULL AUTO_INCREMENT,
  `type` enum('text','voice') NOT NULL,
  `name` varchar(32) NOT NULL,
  `description` text DEFAULT NULL,
  `guildId` int(11) DEFAULT NULL,
  `isPrivate` tinyint(1) NOT NULL,
  `friendId` int(11) DEFAULT NULL,
  PRIMARY KEY (`channelId`),
  KEY `channels_ibfk_1` (`guildId`),
  KEY `friendId` (`friendId`),
  CONSTRAINT `channels_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`),
  CONSTRAINT `channels_ibfk_2` FOREIGN KEY (`friendId`) REFERENCES `friends` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `friends`;
CREATE TABLE `friends` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `UserId` int(11) NOT NULL,
  `FriendId` int(11) NOT NULL,
  `isPending` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `UserId` (`UserId`),
  KEY `FriendId` (`FriendId`),
  CONSTRAINT `friends_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `users` (`userId`),
  CONSTRAINT `friends_ibfk_2` FOREIGN KEY (`FriendId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `guilds`;
CREATE TABLE `guilds` (
  `guildId` int(11) NOT NULL AUTO_INCREMENT,
  `guildName` varchar(32) NOT NULL,
  `guildImage` varchar(255) DEFAULT '',
  `guildDescription` varchar(255) DEFAULT NULL,
  `ownerId` int(11) DEFAULT NULL,
  PRIMARY KEY (`guildId`),
  KEY `guilds_ibfk_1` (`ownerId`),
  CONSTRAINT `guilds_ibfk_1` FOREIGN KEY (`ownerId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `guilds_joined`;
CREATE TABLE `guilds_joined` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `guildId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `guilds_joined_ibfk_1` (`guildId`),
  KEY `guilds_joined_ibfk_2` (`userId`),
  CONSTRAINT `guilds_joined_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`),
  CONSTRAINT `guilds_joined_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP VIEW IF EXISTS `guilds_user`;
CREATE TABLE `guilds_user` (`guildId` int(11), `userId` int(11), `guildName` varchar(32), `guildImage` varchar(255), `guildDescription` varchar(255), `ownerId` int(11), `userNickname` varchar(32), `userImage` varchar(255));


DROP TABLE IF EXISTS `invites`;
CREATE TABLE `invites` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `guild` int(11) NOT NULL,
  `author` int(11) NOT NULL,
  `invite` varchar(64) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite` (`invite`),
  UNIQUE KEY `invite_2` (`invite`),
  KEY `guild` (`guild`),
  KEY `author` (`author`),
  CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`guild`) REFERENCES `guilds` (`guildId`),
  CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`author`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `messages`;
CREATE TABLE `messages` (
  `messageId` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) DEFAULT NULL,
  `channelId` int(11) DEFAULT NULL,
  `content` text NOT NULL,
  `sentDate` datetime DEFAULT current_timestamp(),
  `modifiedDate` datetime DEFAULT NULL,
  `media` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`messageId`),
  KEY `messages_ibfk_1` (`userId`),
  KEY `messages_ibfk_2` (`channelId`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`),
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`channelId`) REFERENCES `channels` (`channelId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP VIEW IF EXISTS `message_content`;
CREATE TABLE `message_content` (`messageId` int(11), `userId` int(11), `content` text, `sentDate` datetime, `userNickname` varchar(32), `userImage` varchar(255));


DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
  `roleId` int(11) NOT NULL AUTO_INCREMENT,
  `roleLabel` varchar(32) NOT NULL,
  `userId` int(11) DEFAULT NULL,
  `color` varchar(7) DEFAULT NULL,
  `serverId` int(11) DEFAULT NULL,
  PRIMARY KEY (`roleId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `userId` int(11) NOT NULL AUTO_INCREMENT,
  `userNickname` varchar(32) NOT NULL,
  `userEmail` varchar(64) NOT NULL,
  `isEmailConfirmed` tinyint(1) NOT NULL DEFAULT 0,
  `userImage` varchar(255) DEFAULT '',
  `password` varchar(256) NOT NULL,
  `passwordUpdatedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`userId`),
  UNIQUE KEY `userEmail` (`userEmail`),
  UNIQUE KEY `userNickname` (`userNickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `users_invited`;
CREATE TABLE `users_invited` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `invite` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `used_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `invite` (`invite`),
  KEY `user` (`user`),
  CONSTRAINT `users_invited_ibfk_1` FOREIGN KEY (`invite`) REFERENCES `invites` (`id`),
  CONSTRAINT `users_invited_ibfk_2` FOREIGN KEY (`user`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `user_attempts`;
CREATE TABLE `user_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip` varchar(16) NOT NULL,
  `attemptedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


DROP TABLE IF EXISTS `guilds_user`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `guilds_user` AS select `gj`.`guildId` AS `guildId`,`gj`.`userId` AS `userId`,`g`.`guildName` AS `guildName`,`g`.`guildImage` AS `guildImage`,`g`.`guildDescription` AS `guildDescription`,`g`.`ownerId` AS `ownerId`,`u`.`userNickname` AS `userNickname`,`u`.`userImage` AS `userImage` from ((`guilds_joined` `gj` join `guilds` `g` on(`gj`.`guildId` = `g`.`guildId`)) join `users` `u` on(`gj`.`userId` = `u`.`userId`)) union select `g`.`guildId` AS `guildId`,`g`.`ownerId` AS `userId`,`g`.`guildName` AS `guildName`,`g`.`guildImage` AS `guildImage`,`g`.`guildDescription` AS `guildDescription`,`g`.`ownerId` AS `ownerId`,`u`.`userNickname` AS `userNickname`,`u`.`userImage` AS `userImage` from (`guilds` `g` join `users` `u` on(`g`.`ownerId` = `u`.`userId`));

DROP TABLE IF EXISTS `message_content`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `message_content` AS select `m`.`messageId` AS `messageId`,`m`.`userId` AS `userId`,`m`.`content` AS `content`,`m`.`sentDate` AS `sentDate`,`u`.`userNickname` AS `userNickname`,`u`.`userImage` AS `userImage` from (`messages` `m` join `users` `u` on(`u`.`userId` = `m`.`userId`)) order by `m`.`sentDate`;

-- 2025-02-25 11:56:43
