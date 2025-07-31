const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration de la base de données
const dbConfig = {
    host: 'mysql',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

// Fonction d'initialisation de la base de données
async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        
        // Test de connexion
        const connection = await pool.getConnection();
        console.log('✅ Connexion à MySQL réussie');
        
        // Création de la table si elle n'existe pas
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nom VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                age INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Vérifier s'il y a des données de test
        const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        if (rows[0].count === 0) {
            // Insertion de données de test
            const testUsers = [
                ['Alexandre Martin', 'alexandre.martin@exemple.com', 32],
                ['Camille Dubois', 'camille.dubois@exemple.com', 27],
                ['Thomas Bernard', 'thomas.bernard@exemple.com', 29],
                ['Julie Rousseau', 'julie.rousseau@exemple.com', 31],
                ['Lucas Petit', 'lucas.petit@exemple.com', 26],
                ['Emma Leroy', 'emma.leroy@exemple.com', 30]
            ];
            
            for (const user of testUsers) {
                await connection.execute(
                    'INSERT INTO users (nom, email, age) VALUES (?, ?, ?)',
                    user
                );
            }
            console.log('📊 Données de test insérées');
        }
        
        connection.release();
        console.log('🗄️ Base de données initialisée');
    } catch (error) {
        console.error('❌ Erreur d\'initialisation de la base de données:', error);
        process.exit(1);
    }
}

// Routes

// Page d'accueil avec documentation de l'API
app.get('/', (req, res) => {
    res.json({
        message: '🚀 API de Gestion des Utilisateurs',
        version: '1.0.0',
        endpoints: {
            'GET /': 'Documentation de l\'API',
            'GET /users': 'Récupérer tous les utilisateurs',
            'GET /users/:id': 'Récupérer un utilisateur par ID',
            'POST /users': 'Créer un nouvel utilisateur',
            'PUT /users/:id': 'Modifier un utilisateur',
            'DELETE /users/:id': 'Supprimer un utilisateur',
            'GET /health': 'Vérifier l\'état de l\'API et de la base de données'
        },
        examples: {
            'POST /users': {
                body: {
                    nom: 'John Doe',
                    email: 'john.doe@exemple.com',
                    age: 25
                }
            }
        }
    });
});

// GET /users - Récupérer tous les utilisateurs
app.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM users ORDER BY id');
        res.json({
            success: true,
            users: rows,
            total: rows.length
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des utilisateurs'
        });
    }
});

// GET /users/:id - Récupérer un utilisateur par ID
app.get('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({
            success: false,
            error: 'ID utilisateur invalide'
        });
    }
    
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            user: rows[0]
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération de l\'utilisateur'
        });
    }
});

// POST /users - Créer un nouvel utilisateur
app.post('/users', async (req, res) => {
    const { nom, email, age } = req.body;
    
    if (!nom || !email) {
        return res.status(400).json({
            success: false,
            error: 'Le nom et l\'email sont requis'
        });
    }
    
    try {
        const [result] = await pool.execute(
            'INSERT INTO users (nom, email, age) VALUES (?, ?, ?)',
            [nom, email, age || null]
        );
        
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            user: {
                id: result.insertId,
                nom,
                email,
                age
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'Un utilisateur avec cet email existe déjà'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création de l\'utilisateur'
        });
    }
});

// PUT /users/:id - Modifier un utilisateur
app.put('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    const { nom, email, age } = req.body;
    
    if (isNaN(userId)) {
        return res.status(400).json({
            success: false,
            error: 'ID utilisateur invalide'
        });
    }
    
    if (!nom && !email && age === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Au moins un champ à modifier est requis'
        });
    }
    
    try {
        // Vérifier si l'utilisateur existe
        const [existingUser] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
        
        if (existingUser.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        // Construire la requête de mise à jour dynamiquement
        const fields = [];
        const values = [];
        
        if (nom) {
            fields.push('nom = ?');
            values.push(nom);
        }
        if (email) {
            fields.push('email = ?');
            values.push(email);
        }
        if (age !== undefined) {
            fields.push('age = ?');
            values.push(age);
        }
        
        values.push(userId);
        
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        await pool.execute(query, values);
        
        res.json({
            success: true,
            message: 'Utilisateur mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'Un utilisateur avec cet email existe déjà'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour de l\'utilisateur'
        });
    }
});

// DELETE /users/:id - Supprimer un utilisateur
app.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
        return res.status(400).json({
            success: false,
            error: 'ID utilisateur invalide'
        });
    }
    
    try {
        const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            message: 'Utilisateur supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression de l\'utilisateur'
        });
    }
});

// GET /health - Vérification de l'état de santé
app.get('/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        res.json({
            success: true,
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Gestion des erreurs 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint non trouvé',
        availableEndpoints: ['/users', '/health', '/']
    });
});

// Démarrage du serveur
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        console.log(`📖 Documentation disponible sur http://localhost:${PORT}`);
    });
}

startServer().catch(error => {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
}); 