CREATE DATABASE IF NOT EXISTS utilisateurs_db;

USE utilisateurs_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    age INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO users (nom, email, age) VALUES 
    ('gwen', 'gwen@mail.com', 39),
    ('saiko', 'saiko@mail.com', 2),
ON DUPLICATE KEY UPDATE nom=nom; 