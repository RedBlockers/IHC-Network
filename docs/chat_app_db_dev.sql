-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : mer. 11 déc. 2024 à 13:58
-- Version du serveur : 8.0.40-0ubuntu0.24.04.1
-- Version de PHP : 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `chat_app_db_dev`
--

-- --------------------------------------------------------

--
-- Structure de la table `channels`
--

CREATE TABLE `channels` (
  `channelId` int NOT NULL,
  `type` enum('text','voice') NOT NULL,
  `name` varchar(32) NOT NULL,
  `description` text,
  `guildId` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `guilds`
--

CREATE TABLE `guilds` (
  `guildId` int NOT NULL,
  `guildName` varchar(32) NOT NULL,
  `guildImage` varchar(255) DEFAULT '',
  `guildDescription` varchar(255) DEFAULT NULL,
  `ownerId` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `guilds`
--

INSERT INTO `guilds` (`guildId`, `guildName`, `guildImage`, `guildDescription`, `ownerId`) VALUES
(2, 'e', 'guilds\\f1afd812-1633-4a4f-a900-f2315a302b5e.png', 'e', 1),
(3, 'test', 'guilds\\41a91629-c287-4f7b-b582-b7f9750cad94.png', 'c\'est un serveur test', 1),
(4, 'test', 'guilds\\d86abe4b-be5c-4045-827c-2393d69c5a52.png', 'gfbekuferqf', 1),
(5, 'test2', 'guilds\\d9edbc6c-2cd2-4be1-b046-d8bb1b18ac43.png', 'c\'est le test', 1);

-- --------------------------------------------------------

--
-- Structure de la table `guilds_joined`
--

CREATE TABLE `guilds_joined` (
  `id` int NOT NULL,
  `guildId` int NOT NULL,
  `userId` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `guilds_user`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `guilds_user` (
`guildDescription` varchar(255)
,`guildId` int
,`guildImage` varchar(255)
,`guildName` varchar(32)
,`ownerId` int
,`userId` int
,`userImage` varchar(255)
,`userNickname` varchar(32)
);

-- --------------------------------------------------------

--
-- Structure de la table `messages`
--

CREATE TABLE `messages` (
  `messageId` int NOT NULL,
  `userId` int DEFAULT NULL,
  `channelId` int DEFAULT NULL,
  `content` text NOT NULL,
  `sentDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `modifiedDate` datetime DEFAULT NULL,
  `media` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `messages`
--

INSERT INTO `messages` (`messageId`, `userId`, `channelId`, `content`, `sentDate`, `modifiedDate`, `media`) VALUES
(85, 2, NULL, '# Heading 1\n\n## Heading 2\n\n### Heading 3\n\n**Bold Text**\n\n*Italic Text*\n\n***Bold and Italic Text***\n\n- Bullet List Item 1\n- Bullet List Item 2\n  - Subitem 2.1\n  - Subitem 2.2\n\n1. Numbered List Item 1\n2. Numbered List Item 2\n3. Numbered List Item 3\n\n> \"This is a blockquote. It is used to highlight quotes or important text.\"\n\n[This is a link to Google](https://www.google.com)\n\n![Image Description](https://via.placeholder.com/150)\n\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Row 1    | Data 1   | Data 1   |\n| Row 2    | Data 2   | Data 2   |\n| Row 3    | Data 3   | Data 3   |\n\n---\n\n***\n\n~~This is a strikethrough text~~\n\n', '2024-11-16 22:04:54', NULL, NULL),
(86, 2, NULL, '> je suis con\n> j\'ai sus pk ça ne marchais pas\n', '2024-11-16 22:21:55', NULL, NULL),
(87, 2, NULL, '- test\n  - test\n    - test\n', '2024-11-16 22:25:16', NULL, NULL),
(88, 2, NULL, '1) test\n2) test\n', '2024-11-16 22:25:28', NULL, NULL),
(89, 2, NULL, 'A) test\nB) test\n', '2024-11-16 22:25:40', NULL, NULL),
(90, 2, NULL, 'test\nnope\n', '2024-11-16 22:25:51', NULL, NULL),
(91, 2, NULL, 'p\n\n\n\np\n', '2024-11-16 22:25:56', NULL, NULL),
(92, 2, NULL, 'test\nno\n', '2024-11-16 22:26:01', NULL, NULL),
(93, 2, NULL, 'humm\ntest\n2\n3\n', '2024-11-16 22:27:38', NULL, NULL),
(94, 2, NULL, 'test\ndeux\n\n', '2024-11-16 22:29:32', NULL, NULL),
(95, 1, NULL, 'test\ndeux\n', '2024-11-16 22:29:38', NULL, NULL),
(96, 2, NULL, 'test\n\n\ntest\n', '2024-11-16 22:38:29', NULL, NULL),
(97, 2, NULL, 'test\n\n\n\nnope\n', '2024-11-16 22:42:56', NULL, NULL),
(98, 2, NULL, 'test\n\n\ntest\n', '2024-11-16 22:52:10', NULL, NULL),
(99, 2, NULL, 'test\ntest2\n\ntest3\n\n\ntest4\n', '2024-11-16 22:55:06', NULL, NULL),
(100, 2, NULL, '🙉\n', '2024-11-16 23:00:04', NULL, NULL),
(101, 2, NULL, 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1332010/header.jpg?t=1729097732\n', '2024-11-16 23:02:22', NULL, NULL),
(102, 2, NULL, 'https://vuejsexamples.com/content/images/2018/04/spinkit.gif\n', '2024-11-16 23:28:47', NULL, NULL),
(103, 2, NULL, '![](https://wallpapercave.com/wp/wp4472914.jpg)\n', '2024-11-17 00:20:08', NULL, NULL),
(104, 2, NULL, 'https://wallpapercave.com/wp/wp4472914.jpg\n', '2024-11-17 00:20:49', NULL, NULL),
(105, 2, NULL, '😱\n', '2024-11-17 00:40:30', NULL, NULL),
(106, 2, NULL, 'test\n', '2024-11-17 00:40:46', NULL, NULL),
(107, 2, NULL, 't\n', '2024-11-17 00:41:32', NULL, NULL),
(108, 2, NULL, 'e\n', '2024-11-17 00:42:38', NULL, NULL),
(109, 2, NULL, 't\n', '2024-11-17 00:42:41', NULL, NULL),
(110, 2, NULL, 't\n', '2024-11-17 00:42:42', NULL, NULL),
(111, 2, NULL, 'z\n', '2024-11-17 00:42:42', NULL, NULL),
(112, 2, NULL, '😶\n', '2024-11-17 00:42:47', NULL, NULL),
(113, 2, NULL, 'e\n', '2024-11-17 00:42:52', NULL, NULL),
(114, 2, NULL, 'e\n', '2024-11-17 00:43:01', NULL, NULL),
(115, 2, NULL, 'et\n', '2024-11-17 00:47:35', NULL, NULL),
(116, 2, NULL, 'test\n', '2024-11-17 00:47:37', NULL, NULL),
(117, 2, NULL, '< test\n', '2024-11-17 00:47:39', NULL, NULL),
(118, 2, NULL, '> test\n', '2024-11-17 00:47:43', NULL, NULL),
(119, 2, NULL, 't\ne\n', '2024-11-17 00:47:50', NULL, NULL),
(120, 2, NULL, 't\n\ne\n', '2024-11-17 00:47:55', NULL, NULL),
(121, 2, NULL, '🤐\n', '2024-11-17 00:48:06', NULL, NULL),
(122, 2, NULL, 'https://wallpapercave.com/wp/wp4472914.jpg\n', '2024-11-17 00:49:54', NULL, NULL),
(123, 2, NULL, 'et', '2024-11-17 01:05:59', NULL, NULL),
(124, 2, NULL, 'test', '2024-11-17 01:06:02', NULL, NULL),
(125, 2, NULL, '👍', '2024-11-17 01:06:32', NULL, NULL),
(126, 2, NULL, 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1332010/header.jpg', '2024-11-17 01:25:21', NULL, NULL),
(127, 1, NULL, 'test', '2024-11-18 10:21:01', NULL, NULL),
(128, 1, NULL, 'test', '2024-11-18 10:24:11', NULL, NULL),
(129, 1, NULL, '```js\nimport {Auth} from \'./services/auth.js\';\nimport {Listeners} from \"./services/listeners.js\";\nimport {Messages} from \"./api/messages.js\";\nimport {handleMessageInput} from \"./components/resizableTextArea.js\";\n\nconst listeners = new Listeners();\nconst token = localStorage.getItem(\'token\');\n\nif(!token){\n    window.location.href = \'./pages/login.html\';\n}\n\nawait Auth.authenticateToken(token);\n\nlisteners.listenForAll();\nMessages.loadAllMessages();\nhandleMessageInput();\n```', '2024-11-18 11:51:01', NULL, NULL),
(130, 1, NULL, '\n\n\nz', '2024-11-18 11:51:10', NULL, NULL),
(131, 1, NULL, 'zzz\n\n\n\n', '2024-11-18 11:51:15', NULL, NULL),
(132, 1, NULL, '\n\n\ne', '2024-11-18 11:52:59', NULL, NULL),
(133, 1, NULL, 'eeee\n\n\n\n', '2024-11-18 11:53:05', NULL, NULL),
(134, 1, NULL, '> test', '2024-11-18 11:58:01', NULL, NULL),
(135, 1, NULL, '> je suis con', '2024-11-18 11:58:13', NULL, NULL),
(136, 1, NULL, '> et ça marche\n> sur plusieurs lignes', '2024-11-18 11:58:27', NULL, NULL),
(137, 1, NULL, '```py\nprint(\"ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt\")\n```', '2024-11-18 12:18:35', NULL, NULL),
(138, 1, NULL, 'u', '2024-11-18 12:25:04', NULL, NULL),
(139, 1, NULL, '\n\nu', '2024-11-18 12:25:07', NULL, NULL),
(140, 1, NULL, '\n\n\nuu', '2024-11-18 12:25:11', NULL, NULL),
(141, 1, NULL, 'uu\n\n\n', '2024-11-18 12:25:13', NULL, NULL),
(142, 1, NULL, 'u\nu\n\nu\n\n\nu', '2024-11-18 12:25:19', NULL, NULL),
(143, 1, NULL, '😇', '2024-11-18 12:25:29', NULL, NULL),
(144, 1, NULL, 'https://th.bing.com/th?id=OIP.Vr5hW7ykUC3l1V1yHa6RfwHaD4&w=200&h=200&c=9&rs=1&qlt=99&o=6&pid=23.1', '2024-11-18 12:25:54', NULL, NULL),
(145, 1, NULL, 'https://th.bing.com/th?id=OIP.Vr5hW7ykUC3l1V1yHa6RfwHaD4&w=200&h=200&c=9&rs=1&qlt=99&o=6&pid=23.1', '2024-11-18 12:25:59', NULL, NULL),
(146, 1, NULL, 'https://th.bing.com/th?id=OIP.Vr5hW7ykUC3l1V1yHa6RfwHaD4&w=200&h=200&c=9&rs=1&qlt=99&o=6&pid=23.1', '2024-11-18 12:26:04', NULL, NULL),
(147, 1, NULL, 'https://th.bing.com/th/id/OIP.S-pfz3_kegOXdffgwGkP_wHaHa?rs=1&pid=ImgDetMain', '2024-11-18 12:26:34', NULL, NULL),
(148, 1, NULL, '![](https://th.bing.com/th/id/OIP.S-pfz3_kegOXdffgwGkP_wHaHa?rs=1&pid=ImgDetMain)', '2024-11-18 12:27:02', NULL, NULL),
(149, 1, NULL, 'https://th.bing.com/th/id/OIP.BHojESUTW2QQX4R_6xJs8QAAAA?w=263&h=180&c=7&r=0&o=5&dpr=1.3&pid=1.7', '2024-11-18 13:21:37', NULL, NULL),
(150, 1, NULL, '![](https://th.bing.com/th/id/OIP.MBM8ZLh_-kaN3NsC9G0EWwHaD4?rs=1&pid=ImgDetMain)', '2024-11-18 13:34:49', NULL, NULL),
(151, 1, NULL, 'ee\n\n\n', '2024-11-18 15:39:24', NULL, NULL),
(152, 2, NULL, 'e', '2024-11-18 15:41:28', NULL, NULL),
(153, 2, NULL, '```md', '2024-11-18 15:41:38', NULL, NULL),
(154, 2, NULL, '```md\n#L\'antisémitisme en france\n# tg théo\n```', '2024-11-18 15:42:23', NULL, NULL),
(155, 2, NULL, '# sale noir', '2024-11-18 15:42:42', NULL, NULL),
(156, 2, NULL, '#issou', '2024-11-18 15:42:46', NULL, NULL),
(157, 2, NULL, '## nice cock', '2024-11-18 15:42:54', NULL, NULL),
(158, 2, NULL, '### petite bite', '2024-11-18 15:43:01', NULL, NULL),
(159, 2, NULL, '##### test', '2024-11-18 15:43:05', NULL, NULL),
(160, 2, NULL, '########## test', '2024-11-18 15:43:11', NULL, NULL),
(161, 2, NULL, '####### test', '2024-11-18 15:43:17', NULL, NULL),
(162, 2, NULL, '##### test', '2024-11-18 15:43:21', NULL, NULL),
(163, 1, NULL, '![](https://media.tenor.com/diNY7zTkRloAAAAM/issou.gif)', '2024-11-18 15:43:26', NULL, NULL),
(164, 2, NULL, '![pornhub.com](haveibeenpwnd.com)', '2024-11-18 15:44:03', NULL, NULL),
(165, 1, NULL, '> POV t\'est con', '2024-11-18 15:44:25', NULL, NULL),
(166, 1, NULL, 'Aled', '2024-11-18 15:46:40', NULL, NULL),
(167, 1, NULL, '🙈', '2024-11-18 15:46:58', NULL, NULL),
(168, 1, NULL, '``citation`', '2024-11-18 15:48:27', NULL, NULL),
(169, 1, NULL, '`citation`', '2024-11-18 15:48:33', NULL, NULL),
(170, 1, NULL, '🇪🇺', '2024-11-21 14:19:29', NULL, NULL),
(171, 1, NULL, '👾', '2024-11-21 14:19:59', NULL, NULL),
(172, 1, NULL, 'utgtg', '2024-11-25 10:27:41', NULL, NULL),
(173, 1, NULL, '😇', '2024-11-25 10:27:44', NULL, NULL),
(174, 1, NULL, '![](https://th.bing.com/th/id/OIP.gpR-f37sw9NXrxb38MQyXQHaEB?w=321&h=180&c=7&r=0&o=5&pid=1.7)', '2024-11-25 10:28:07', NULL, NULL),
(175, 1, NULL, '<h1>test</h1>', '2024-11-26 11:49:07', NULL, NULL),
(176, 1, NULL, '<script>alert(\"test\")</script>', '2024-11-26 11:50:25', NULL, NULL),
(177, 1, NULL, '![](https://wallpaperaccess.com/full/2111331.jpg)', '2024-11-26 11:55:40', NULL, NULL),
(178, 1, NULL, 'ygrdgfdxg', '2024-12-03 10:19:26', NULL, NULL);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `message_content`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `message_content` (
`content` text
,`messageId` int
,`sentDate` datetime
,`userId` int
,`userImage` varchar(255)
,`userNickname` varchar(32)
);

-- --------------------------------------------------------

--
-- Structure de la table `roles`
--

CREATE TABLE `roles` (
  `roleId` int NOT NULL,
  `roleLabel` varchar(32) NOT NULL,
  `userId` int DEFAULT NULL,
  `color` varchar(7) DEFAULT NULL,
  `serverId` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `userId` int NOT NULL,
  `userNickname` varchar(32) NOT NULL,
  `userEmail` varchar(64) NOT NULL,
  `isEmailConfirmed` tinyint(1) NOT NULL DEFAULT '0',
  `userImage` varchar(255) DEFAULT '',
  `password` varchar(256) NOT NULL,
  `passwordUpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`userId`, `userNickname`, `userEmail`, `isEmailConfirmed`, `userImage`, `password`, `passwordUpdatedAt`) VALUES
(1, 'e', 'ee@e.com', 0, 'profiles/46a8adf8-afb3-4e2e-b70c-dd208919f1e2.png', '$2b$10$8Ry7vc3v2dnwdGB5n.WyCenxfxwWlfJopnV8SlmHnokmQ2h9JCXRy', '2024-11-12 14:57:32'),
(2, 'test', 'test@e.com', 0, './NoScord.jpg', '$2b$10$L1PeHgzrM1Jrd20uEUnVkuL5apHjZYYxA4u.f4zEQh8Luqlujyj8y', '2024-11-13 21:11:07'),
(3, 'ezz', 'eee@e.com', 0, 'profiles/7359326c-ec9b-4761-9f90-4f224ada9200.png', '$2b$10$r0pc56Qp2yyHY3q4c7/6o.oRADMt13pd1Ks3d530r3OWoQ80nT8iy', '2024-11-25 09:25:52');

-- --------------------------------------------------------

--
-- Structure de la table `user_attempts`
--

CREATE TABLE `user_attempts` (
  `id` int NOT NULL,
  `ip` varchar(16) NOT NULL,
  `attemptedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la vue `guilds_user`
--
DROP TABLE IF EXISTS `guilds_user`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `guilds_user`  AS SELECT `gj`.`guildId` AS `guildId`, `gj`.`userId` AS `userId`, `g`.`guildName` AS `guildName`, `g`.`guildImage` AS `guildImage`, `g`.`guildDescription` AS `guildDescription`, `g`.`ownerId` AS `ownerId`, `u`.`userNickname` AS `userNickname`, `u`.`userImage` AS `userImage` FROM ((`guilds_joined` `gj` join `guilds` `g` on((`gj`.`guildId` = `g`.`guildId`))) join `users` `u` on((`gj`.`userId` = `u`.`userId`)))union select `g`.`guildId` AS `guildId`,`g`.`ownerId` AS `userId`,`g`.`guildName` AS `guildName`,`g`.`guildImage` AS `guildImage`,`g`.`guildDescription` AS `guildDescription`,`g`.`ownerId` AS `ownerId`,`u`.`userNickname` AS `userNickname`,`u`.`userImage` AS `userImage` from (`guilds` `g` join `users` `u` on((`g`.`ownerId` = `u`.`userId`)))  ;

-- --------------------------------------------------------

--
-- Structure de la vue `message_content`
--
DROP TABLE IF EXISTS `message_content`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `message_content`  AS SELECT `m`.`messageId` AS `messageId`, `m`.`userId` AS `userId`, `m`.`content` AS `content`, `m`.`sentDate` AS `sentDate`, `u`.`userNickname` AS `userNickname`, `u`.`userImage` AS `userImage` FROM (`messages` `m` join `users` `u` on((`u`.`userId` = `m`.`userId`))) ORDER BY `m`.`sentDate` ASC ;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `channels`
--
ALTER TABLE `channels`
  ADD PRIMARY KEY (`channelId`),
  ADD KEY `channels_ibfk_1` (`guildId`);

--
-- Index pour la table `guilds`
--
ALTER TABLE `guilds`
  ADD PRIMARY KEY (`guildId`),
  ADD KEY `guilds_ibfk_1` (`ownerId`);

--
-- Index pour la table `guilds_joined`
--
ALTER TABLE `guilds_joined`
  ADD PRIMARY KEY (`id`),
  ADD KEY `guilds_joined_ibfk_1` (`guildId`),
  ADD KEY `guilds_joined_ibfk_2` (`userId`);

--
-- Index pour la table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`messageId`),
  ADD KEY `messages_ibfk_1` (`userId`),
  ADD KEY `messages_ibfk_2` (`channelId`);

--
-- Index pour la table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`roleId`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`userId`),
  ADD UNIQUE KEY `userEmail` (`userEmail`),
  ADD UNIQUE KEY `userNickname` (`userNickname`);

--
-- Index pour la table `user_attempts`
--
ALTER TABLE `user_attempts`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `channels`
--
ALTER TABLE `channels`
  MODIFY `channelId` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `guilds`
--
ALTER TABLE `guilds`
  MODIFY `guildId` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `guilds_joined`
--
ALTER TABLE `guilds_joined`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `messages`
--
ALTER TABLE `messages`
  MODIFY `messageId` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=179;

--
-- AUTO_INCREMENT pour la table `roles`
--
ALTER TABLE `roles`
  MODIFY `roleId` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `userId` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `user_attempts`
--
ALTER TABLE `user_attempts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `channels`
--
ALTER TABLE `channels`
  ADD CONSTRAINT `channels_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`);

--
-- Contraintes pour la table `guilds`
--
ALTER TABLE `guilds`
  ADD CONSTRAINT `guilds_ibfk_1` FOREIGN KEY (`ownerId`) REFERENCES `users` (`userId`);

--
-- Contraintes pour la table `guilds_joined`
--
ALTER TABLE `guilds_joined`
  ADD CONSTRAINT `guilds_joined_ibfk_1` FOREIGN KEY (`guildId`) REFERENCES `guilds` (`guildId`),
  ADD CONSTRAINT `guilds_joined_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`);

--
-- Contraintes pour la table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`userId`),
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`channelId`) REFERENCES `channels` (`channelId`);

DELIMITER $$
--
-- Évènements
--
CREATE DEFINER=`root`@`localhost` EVENT `delete_old_attempts` ON SCHEDULE EVERY 10 SECOND STARTS '2024-11-07 14:27:58' ON COMPLETION NOT PRESERVE ENABLE DO DELETE FROM user_attempts WHERE attemptedAt < NOW() - INTERVAL 5 MINUTE$$

DELIMITER ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
