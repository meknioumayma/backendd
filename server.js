const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// Connexion à MySQL
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "gestion"
});

db.connect((err) => {
    if (err) {
        console.error("Erreur de connexion à la base de données:", err);
    } else {
        console.log("Connecté à la base de données MySQL");
    }
});

// Transporteur pour l'envoi des emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "meknioumayma619@gmail.com",
        pass: "ivjw sywt bzaa laqx"
    }
});

// Route pour récupérer tous les utilisateurs
app.get("/api/users", (req, res) => {
    const sql = "SELECT id, email, role FROM utilisateurs";
    db.query(sql, (err, result) => {
        if (err) {
            console.error("Erreur lors de la récupération des utilisateurs:", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }
        res.status(200).json(result);
    });
});

// Route pour créer un utilisateur
app.post("/api/admin/create-user", async (req, res) => {
    const { email, role } = req.body;
    
    if (!email || !role) {
        return res.status(400).json({ message: "Email et rôle sont obligatoires" });
    }

    try {
        const generatedPassword = crypto.randomBytes(5).toString("hex");
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        const sql = "INSERT INTO utilisateurs (email, mot_de_passe, role) VALUES (?, ?, ?)";
        db.query(sql, [email, hashedPassword, role], async (err, result) => {
            if (err) {
                console.error("Erreur lors de l'insertion:", err);
                return res.status(500).json({ message: "Erreur serveur" });
            }

            const mailOptions = {
                from: "meknioumayma619@gmail.com",
                to: email,
                subject: "Votre compte a été créé",
                text: `Bonjour,\n\nVotre compte a été créé avec succès.\n\nEmail: ${email}\nMot de passe: ${generatedPassword}\n\nMerci d'utiliser notre plateforme !`
            };

            try {
                await transporter.sendMail(mailOptions);
                res.status(201).json({ message: "Utilisateur ajouté et email envoyé" });
            } catch (emailError) {
                console.error("Erreur lors de l'envoi de l'email:", emailError);
                res.status(500).json({ message: "Utilisateur ajouté, mais erreur email" });
            }
        });
    } catch (error) {
        console.error("Erreur serveur:", error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});

// Route pour modifier un utilisateur
app.put("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    const { email, role } = req.body;

    if (!email || !role) {
        return res.status(400).json({ message: "Email et rôle sont obligatoires" });
    }

    const sql = "UPDATE utilisateurs SET email = ?, role = ? WHERE id = ?";
    db.query(sql, [email, role, userId], (err, result) => {
        if (err) {
            console.error("Erreur lors de la modification:", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.status(200).json({ message: "Utilisateur modifié avec succès" });
    });
});

app.delete("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    console.log("Tentative de suppression de l'utilisateur avec ID:", userId);

    // S'assurer que l'ID est correct
    const sql = "DELETE FROM utilisateurs WHERE id = ?";
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error("Erreur lors de la suppression:", err);
            return res.status(500).json({ message: "Erreur serveur", error: err });
        }

        console.log("Résultat de la suppression:", result); // Vérifiez le résultat ici

        // Vérifiez si l'utilisateur a été supprimé
        if (result.affectedRows === 0) {
            console.log("Aucun utilisateur trouvé avec cet ID:", userId);
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        console.log("Utilisateur supprimé avec succès.");
        res.status(200).json({ message: "Utilisateur supprimé avec succès" });
    });
});


// Route pour la connexion
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email et mot de passe sont obligatoires" });
    }

    const sql = "SELECT * FROM utilisateurs WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error("Erreur SQL :", err);
            return res.status(500).json({ message: "Erreur serveur" });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect" });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(password, user.mot_de_passe);
        if (!isMatch) {
            return res.status(401).json({ message: "Email ou mot de passe incorrect" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            SECRET_KEY,
            { expiresIn: "1h" }
        );
        
        res.status(200).json({ message: "Connexion réussie", token: token, role: user.role });
    });
});

// Clé secrète pour JWT
const SECRET_KEY = process.env.JWT_SECRET || "secret_key";

// Middleware d'authentification
const authenticateJWT = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Token manquant" });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Token invalide" });
        }
        req.user = user;
        next();
    });
};

// Middleware pour vérifier le rôle admin
const checkAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Accès refusé" });
    }
    next();
};

// Lancer le serveur
app.listen(5000, () => {
    console.log("Serveur Node.js démarré sur le port 5000");
});