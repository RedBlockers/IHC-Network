-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
-- Host: 127.0.0.1:3306
-- Generated on: Tue, 12 Nov 2024 at 09:29
-- Server version: 8.3.0
-- PHP version: 8.2.18

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

-- Database: `chat_app_db`

-- --------------------------------------------------------
-- Table structure for table `guilds_joined`

DROP TABLE IF EXISTS `guilds_joined`;
CREATE TABLE IF NOT EXISTS `guilds_joined` (
  `id` int NOT NULL AUTO_INCREMENT,
  `guildId` int NOT NULL,
  `userId` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for table `messages`

DROP TABLE IF EXISTS `messages`;
CREATE TABLE IF NOT EXISTS `messages` (
  `messageId` int NOT NULL AUTO_INCREMENT,
  `userId` int DEFAULT NULL,
  `channelId` int DEFAULT NULL,
  `content` text NOT NULL,
  `sentDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime DEFAULT NULL,
  `media` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`messageId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for table `channels`

DROP TABLE IF EXISTS `channels`;
CREATE TABLE IF NOT EXISTS `channels` (
  `channelId` int NOT NULL AUTO_INCREMENT,
  `type` enum('text','voice') NOT NULL,
  `name` varchar(32) NOT NULL,
  `description` text,
  `guildId` int DEFAULT NULL,
  PRIMARY KEY (`channelId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for table `servers`

DROP TABLE IF EXISTS `guilds`;
CREATE TABLE IF NOT EXISTS `guilds` (
  `guildId` int NOT NULL AUTO_INCREMENT,
  `guildName` varchar(32) NOT NULL,
  `guildImage` varchar(255) DEFAULT '',
  `guildDescription` varchar(255) DEFAULT NULL,
  `ownerId` int DEFAULT NULL,
  PRIMARY KEY (`guildId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for table `users`

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `userId` int NOT NULL AUTO_INCREMENT,
  `userNickname` varchar(32) NOT NULL,
  `userEmail` varchar(64) NOT NULL,
  `isEmailConfirmed` tinyint(1) NOT NULL DEFAULT '0',
  `userImage` varchar(255) DEFAULT '',
  `password` varchar(256) NOT NULL,
  `userToken` varchar(256) NOT NULL,
  `passwordUpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`),
  UNIQUE KEY `userEmail` (`userEmail`),
  UNIQUE KEY `userNickname` (`userNickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for table `user_attempts`

DROP TABLE IF EXISTS `user_attempts`;
CREATE TABLE IF NOT EXISTS `user_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ip` varchar(16) NOT NULL,
  `attemptedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- View structure for `message_content`

DROP VIEW IF EXISTS `message_content`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `message_content` AS
SELECT
  `m`.`messageId` AS `messageId`,
  `m`.`userId` AS `userId`,
  `m`.`content` AS `content`,
  `m`.`sentDate` AS `sentDate`,
  `u`.`userNickname` AS `userNickname`,
  `u`.`userImage` AS `userImage`
FROM
  `messages` `m`
JOIN
  `users` `u` ON `u`.`userId` = `m`.`userId`
ORDER BY
  `m`.`sentDate` ASC;


-- --------------------------------------------------------
-- Adding Foreign Key Constraints

ALTER TABLE `guilds_joined`
  ADD CONSTRAINT `guilds_joined_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`),
  ADD CONSTRAINT `guilds_joined_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`);

ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`),
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`channelId`) REFERENCES `channels` (`channelId`);

ALTER TABLE `channels`
  ADD CONSTRAINT `channels_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`);

ALTER TABLE `guilds`
  ADD CONSTRAINT `guilds_ibfk_1` FOREIGN KEY (`ownerId`) REFERENCES `users` (`userId`);

COMMIT;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;


/*
CREATE DEFINER=`root`@`localhost` EVENT `delete_old_attempts` ON SCHEDULE EVERY 10 SECOND STARTS '2024-11-07 14:27:58' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM user_attempts WHERE attemptedAt < NOW() - INTERVAL 5 MINUTE
*/;