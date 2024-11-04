-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : lun. 21 oct. 2024 à 14:20
-- Version du serveur : 8.3.0
-- Version de PHP : 8.2.18

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
DROP DATABASE IF EXISTS chat_app_db;
CREATE DATABASE chat_app_db;
use chat_app_db;
--

-- --------------------------------------------------------

--
-- Structure de la table `logs`
--

DROP TABLE IF EXISTS `logs`;
CREATE TABLE IF NOT EXISTS `logs` (
  `idLog` int NOT NULL AUTO_INCREMENT,
  `type` enum('connexion','création serveur','création salon','modification serveur','modification salon','suppression serveur','suppression salon','déconnexion') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ip` varchar(45) NOT NULL,
  `idUser` int DEFAULT NULL,
  `commentaire` text,
  `datetime` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idLog`),
  KEY `idUser` (`idUser`)
) ENGINE=InnoDB AUTO_INCREMENT=163 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


--
-- Structure de la table `messages`
--

DROP TABLE IF EXISTS `messages`;
CREATE TABLE IF NOT EXISTS `messages` (
  `idMessage` int NOT NULL AUTO_INCREMENT,
  `idUser` int DEFAULT NULL,
  `idSalon` int DEFAULT NULL,
  `contenu` text NOT NULL,
  `dateEnvoi` datetime DEFAULT CURRENT_TIMESTAMP,
  `dateModification` datetime DEFAULT NULL,
  `media` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idMessage`),
  KEY `idUser` (`idUser`),
  KEY `idSalon` (`idSalon`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Structure de la table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE IF NOT EXISTS `permissions` (
  `idPermission` int NOT NULL AUTO_INCREMENT,
  `permissionLabel` varchar(64) NOT NULL,
  `permissionValeur` varchar(128) NOT NULL,
  `permissionDescription` text NOT NULL,
  PRIMARY KEY (`idPermission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `roles`
--

DROP TABLE IF EXISTS `roles`;
CREATE TABLE IF NOT EXISTS `roles` (
  `idRole` int NOT NULL AUTO_INCREMENT,
  `roleLabel` varchar(32) NOT NULL,
  `idUser` int DEFAULT NULL,
  `couleur` varchar(7) DEFAULT NULL,
  `idServeur` int DEFAULT NULL,
  PRIMARY KEY (`idRole`),
  KEY `idUser` (`idUser`),
  KEY `idServeur` (`idServeur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `role_permission`
--

DROP TABLE IF EXISTS `role_permission`;
CREATE TABLE IF NOT EXISTS `role_permission` (
  `idRole` int NOT NULL,
  `idPermission` int NOT NULL,
  PRIMARY KEY (`idRole`,`idPermission`),
  KEY `idPermission` (`idPermission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `salons`
--

DROP TABLE IF EXISTS `salons`;
CREATE TABLE IF NOT EXISTS `salons` (
  `idSalon` int NOT NULL AUTO_INCREMENT,
  `type` enum('texte','vocal') NOT NULL,
  `nom` varchar(32) NOT NULL,
  `description` text,
  `idServeur` int DEFAULT NULL,
  PRIMARY KEY (`idSalon`),
  KEY `idServeur` (`idServeur`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `salon_permission`
--

DROP TABLE IF EXISTS `salon_permission`;
CREATE TABLE IF NOT EXISTS `salon_permission` (
  `idSalon` int NOT NULL,
  `idPermission` int NOT NULL,
  PRIMARY KEY (`idSalon`,`idPermission`),
  KEY `idPermission` (`idPermission`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `serveurs`
--

DROP TABLE IF EXISTS `serveurs`;
CREATE TABLE IF NOT EXISTS `serveurs` (
  `idServeur` int NOT NULL AUTO_INCREMENT,
  `serveurNom` varchar(32) NOT NULL,
  `serveurImage` varchar(255) DEFAULT '',
  `serveurDescription` varchar(255) DEFAULT NULL,
  `idProprietaire` int DEFAULT NULL,
  PRIMARY KEY (`idServeur`),
  UNIQUE KEY `serveurNom` (`serveurNom`),
  KEY `idProprietaire` (`idProprietaire`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `idUser` int NOT NULL AUTO_INCREMENT,
  `userPseudo` varchar(32) NOT NULL,
  `userEmail` varchar(64) NOT NULL,
  `userEmailConfirmer` tinyint(1) NOT NULL DEFAULT '0',
  `userImage` varchar(255) DEFAULT '',
  `userMdp` varchar(256) NOT NULL,
  `userToken` varchar(256) NOT NULL,
  `passwordUpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idUser`),
  UNIQUE KEY `userEmail` (`userEmail`),
  UNIQUE KEY `userPseudo` (`userPseudo`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `logs`
--
ALTER TABLE `logs`
  ADD CONSTRAINT `logs_ibfk_1` FOREIGN KEY (`idUser`) REFERENCES `users` (`idUser`);

--
-- Contraintes pour la table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`idUser`) REFERENCES `users` (`idUser`),
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`idSalon`) REFERENCES `salons` (`idSalon`);

--
-- Contraintes pour la table `roles`
--
ALTER TABLE `roles`
  ADD CONSTRAINT `roles_ibfk_1` FOREIGN KEY (`idUser`) REFERENCES `users` (`idUser`),
  ADD CONSTRAINT `roles_ibfk_2` FOREIGN KEY (`idServeur`) REFERENCES `serveurs` (`idServeur`);

--
-- Contraintes pour la table `role_permission`
--
ALTER TABLE `role_permission`
  ADD CONSTRAINT `role_permission_ibfk_1` FOREIGN KEY (`idRole`) REFERENCES `roles` (`idRole`),
  ADD CONSTRAINT `role_permission_ibfk_2` FOREIGN KEY (`idPermission`) REFERENCES `permissions` (`idPermission`);

--
-- Contraintes pour la table `salons`
--
ALTER TABLE `salons`
  ADD CONSTRAINT `salons_ibfk_1` FOREIGN KEY (`idServeur`) REFERENCES `serveurs` (`idServeur`);

--
-- Contraintes pour la table `salon_permission`
--
ALTER TABLE `salon_permission`
  ADD CONSTRAINT `salon_permission_ibfk_1` FOREIGN KEY (`idSalon`) REFERENCES `salons` (`idSalon`),
  ADD CONSTRAINT `salon_permission_ibfk_2` FOREIGN KEY (`idPermission`) REFERENCES `permissions` (`idPermission`);

--
-- Contraintes pour la table `serveurs`
--
ALTER TABLE `serveurs`
  ADD CONSTRAINT `serveurs_ibfk_1` FOREIGN KEY (`idProprietaire`) REFERENCES `users` (`idUser`);
COMMIT;

CREATE VIEW message_content AS
SELECT m.idMessage, m.idUser, m.contenu, m.dateEnvoi, u.userPseudo, u.userImage FROM messages m 
INNER JOIN users u WHERE u.idUser = m.idUser ORDER BY m.dateEnvoi ASC;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
